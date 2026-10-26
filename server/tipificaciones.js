// tipificaciones.js — Tipificacion de ORLANT (Fase 77, pedido de Edwin/
// Jairo): escritura (reemplazo por periodo, por canal) y agregacion
// filtrada. Mismo patron que agendas.js (Fase 78), pero con un canal
// (LLAMADAS/WHATSAPP) explicito en cada fila/consulta -- las dos comparten
// una sola tabla (`tipificaciones`) porque tienen el mismo grano exacto,
// solo cambia el canal. El servidor NUNCA descarga filas crudas al
// dashboard -- todo lo que sale de aqui hacia el navegador ya viene
// agrupado (ver routes/tipificaciones.js). Volumen (~15.000 filas/mes solo
// Llamadas) obliga a esto mas que en Agendas: una fila por fila nunca debe
// llegar al navegador.
'use strict';

const { fechaLimitesRangoDeMes } = require('./fecha-limites');
const { aplicarAliasAFilas } = require('./alias-asesores');
const { respaldarAntesDeCambiar } = require('./cargas-versiones');
const { leerRegistro } = require('./clientes-registro');

const CANALES = ['LLAMADAS', 'WHATSAPP'];

function nowStr() {
  const d = new Date();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Orden FIJO del payload compacto (arrays, no objetos) -- debe coincidir
// EXACTO con TIPIFICACION_ORDEN_ARRAY (public/js/tipificacion-logic.js) y
// con tipificacionFilaArraySchema (validation.js). Los 3 definen el mismo
// contrato; cambiar el orden en uno sin los otros 2 mezclaria columnas en
// silencio. Las 5 ultimas (Fase 131, Parte 3) son del CDR de Mobilize,
// todas opcionales -- ORLANT las guarda como null, igual que siempre.
const CAMPOS_FILA = ['agente', 'fecha', 'hora', 'duracionMin', 'tipificacion', 'skill', 'duracionSeg', 'codAct', 'tipoInteraccion', 'hungUp', 'skillId'];

// Fase 131, Parte 3 (configurable, mismo criterio que
// TIPIFICACION_CDR_NO_CONECTADA_POR_DEFECTO en tipificacion-logic.js -- el
// servidor nunca requiere ese archivo, asi que la lista se repite aqui,
// literal, a proposito): codificaciones que, en una llamada SALIENTE
// (tipoInteraccion='outbound_ma'), cuentan como "NO conectada". Cualquier
// otra codificacion en una saliente cuenta como "conectada".
// Fase 174: es solo el valor por defecto; cada cliente tiene el suyo en el
// registro (parametros.salidaNoConectada, ver salidaNoConectadaDe).
const SALIDA_NO_CONECTADA = ['Cliente_no_contesta'];
function salidaNoConectadaDe(db, campana) {
  const c = leerRegistro(db).find((x) => x.nombre === campana);
  const l = c && c.parametros && c.parametros.salidaNoConectada;
  return Array.isArray(l) && l.length ? l : SALIDA_NO_CONECTADA;
}

// Fase 169: en Tipificacion de LLAMADAS, los meses cargados antes de la Fase
// 168 guardan las llamadas de salida con el skill "LINEA DE SALIDA" (o con
// otra mayuscula); desde la Fase 168 se guardan como "LLAMADAS DE SALIDA".
// Son el mismo skill: en el filtro salen una sola vez (SKILL_SALIDA) y
// filtrar por cualquiera de los nombres trae todos. Solo cambia como se
// agrupan y muestran; los datos guardados no se tocan.
const SKILL_SALIDA = 'LLAMADAS DE SALIDA';
const SKILLS_SALIDA_EQUIVALENTES = ['LLAMADAS DE SALIDA', 'LINEA DE SALIDA'];
// Fase 171 (Mobilize): el CDR guarda la salida con SKILL_NAME "-" y
// TYPE_INTERACTION outbound_ma (filas cargadas antes de la Fase 168). Esas
// tambien son "Llamadas de salida"; un "-" que no es outbound_ma (internalcall,
// sin tipo) sigue como "-".
const COND_SALIDA_SQL = "(UPPER(TRIM(skill)) IN (" + SKILLS_SALIDA_EQUIVALENTES.map((s) => "'" + s + "'").join(', ') + ") OR (TRIM(skill) = '-' AND tipoInteraccion = 'outbound_ma'))";
// Fase 183 (pedido de Edwin, 26/10, solo ORLANT): en el CDR de llamadas,
// SKILL_NAME "-" es llamada de salida con cualquier TYPE_INTERACTION
// (agosto: 6.560 filas), y las out_pre que llegan con skill propio (4070
// CANCELACIONES Y REPROGRAMACION) cuentan en su skill, no como salida. Las
// filas ya guardadas no se tocan: el parser las guardo como LLAMADAS DE
// SALIDA con su SKILL_ID original, y aqui se leen con su skill.
const CLIENTES_SALIDA_POR_GUION = ['ORLANT'];
const SKILLS_LLAMADAS_POR_ID = { '4070': 'CANCELACIONES Y REPROGRAMACION' };
const SKILLS_SALIDA_SQL = SKILLS_SALIDA_EQUIVALENTES.map((s) => "'" + s + "'").join(', ');
const SALIDA_CON_SKILL_PROPIO_SQL = `(UPPER(TRIM(skill)) IN (${SKILLS_SALIDA_SQL}) AND skillId IS NOT NULL AND TRIM(skillId) NOT IN ('', '-', '0'))`;
// Un skill de salida con un tipo de entrada no cuenta (Fase 177); el "-" si, con cualquier tipo.
const COND_SALIDA_GUION_SQL = `((UPPER(TRIM(skill)) IN (${SKILLS_SALIDA_SQL}) AND (tipoInteraccion IS NULL OR tipoInteraccion = 'outbound_ma') AND NOT ${SALIDA_CON_SKILL_PROPIO_SQL}) OR TRIM(skill) = '-')`;
const SKILL_GUION_SQL = `CASE WHEN ${SALIDA_CON_SKILL_PROPIO_SQL} THEN CASE TRIM(skillId) ` +
  Object.keys(SKILLS_LLAMADAS_POR_ID).map((id) => `WHEN '${id}' THEN '${SKILLS_LLAMADAS_POR_ID[id]}' `).join('') +
  `ELSE 'Skill ' || TRIM(skillId) END WHEN ${COND_SALIDA_GUION_SQL} THEN '${SKILL_SALIDA}' ELSE skill END`;
function salidaPorGuion(campana) { return CLIENTES_SALIDA_POR_GUION.includes(campana); }
// Condicion SQL de "llamada de salida" (canal LLAMADAS) de este cliente.
function condSalidaLlamadasSql(campana) { return salidaPorGuion(campana) ? COND_SALIDA_GUION_SQL : COND_SALIDA_SQL; }
// Fase 186: salida de un canal (llamadas: la regla del cliente; WhatsApp: SKILL_ID 0, guardado como outbound_ma).
function condSalidaCanalSql(campana, canal) { return canal === 'WHATSAPP' ? "tipoInteraccion = 'outbound_ma'" : condSalidaLlamadasSql(campana); }
// Fase 186 (pedido de Edwin, solo ORLANT): la salida se reparte por la
// clasificacion del asesor (tabla asesor_clasificacion, por cliente).
const CLIENTES_CLASIFICACION_ASESORES = ['ORLANT'];
function usaClasificacionAsesores(campana) { return CLIENTES_CLASIFICACION_ASESORES.includes(campana); }
// linea: 'GENERAL' | '3P' | 'SIN' (asesor sin clasificar).
function condLineaClasificacionSql(linea) {
  return linea === 'SIN'
    ? 'agente NOT IN (SELECT c.agente FROM asesor_clasificacion c WHERE c.campana = @campana)'
    : 'agente IN (SELECT c.agente FROM asesor_clasificacion c WHERE c.campana = @campana AND c.linea = @lineaClasif)';
}

function esSkillSalida(skill) {
  return SKILLS_SALIDA_EQUIVALENTES.includes(String(skill == null ? '' : skill).trim().replace(/\s+/g, ' ').toUpperCase());
}

function filaArrayAObjeto(arr) {
  const obj = {};
  CAMPOS_FILA.forEach((k, i) => { obj[k] = arr[i]; });
  return obj;
}

// Primera y ultima fecha entre las filas del archivo que se esta subiendo
// -- define el periodo (dia a dia, sin hora) que la carga va a REEMPLAZAR
// para ESTE canal (nunca el otro: subir Llamadas nunca toca WhatsApp).
function rangoFechas(filasObj) {
  let min = filasObj[0].fecha;
  let max = filasObj[0].fecha;
  for (const f of filasObj) {
    if (f.fecha < min) min = f.fecha;
    if (f.fecha > max) max = f.fecha;
  }
  return { desde: min, hasta: max };
}

// Cuenta cuantas filas YA EXISTEN (de este canal) en el rango que este
// archivo reemplazaria -- no escribe nada. El frontend lo usa para pedir
// confirmacion explicita ("se reemplazaran N registros del dd/mm al
// dd/mm") antes de guardar, mismo patron que Agendas/WhatsApp de Trafico.
function impactoTipificaciones(db, { campana, canal, filas }) {
  const filasObj = filas.map(filaArrayAObjeto);
  const { desde, hasta } = rangoFechas(filasObj);
  const existentes = db
    .prepare('SELECT COUNT(*) AS n FROM tipificaciones WHERE campana = ? AND canal = ? AND fecha >= ? AND fecha <= ?')
    .get(campana, canal, desde, hasta).n;
  // Fase 122: transparencia del alias de asesor ANTES de confirmar la carga
  // -- cuantas filas/asesores distintos se van a unificar, nunca el nombre
  // real (ver aplicarAliasAFilas).
  const alias = aplicarAliasAFilas(db, campana, filasObj, 'agente');
  return {
    desde, hasta, filasExistentes: existentes, filasNuevas: filasObj.length,
    filasUnificadasPorAlias: alias.filasUnificadas, asesoresUnificadosPorAlias: alias.asesoresUnificados,
  };
}

// Reemplaza por PERIODO Y CANAL: borra todo lo que haya de este canal en
// [desde,hasta], despues inserta las filas nuevas -- una sola transaccion.
// Volver a subir el MISMO archivo deja el mismo conteo total (nunca
// duplica). Subir Llamadas nunca borra ni un solo registro de WhatsApp (la
// clausula WHERE siempre incluye canal = ?).
function cargarTipificaciones(db, { campana, canal, archivoNombre, cargadoPorNombre, filas }) {
  const ts = nowStr();
  let filasObj = filas.map(filaArrayAObjeto);
  // Fase 122: alias de nombre de asesor ANTES de guardar -- el nombre que
  // queda en la base es siempre el canonico (ver alias-asesores.js). El
  // rango de fechas a reemplazar no cambia (sale de `fecha`, nunca de
  // `agente`).
  filasObj = aplicarAliasAFilas(db, campana, filasObj, 'agente').filas;
  const { desde, hasta } = rangoFechas(filasObj);

  const del = db.prepare('DELETE FROM tipificaciones WHERE campana = ? AND canal = ? AND fecha >= ? AND fecha <= ?');
  const insert = db.prepare(
    `INSERT INTO tipificaciones
       (campana, canal, agente, fecha, hora, duracionMin, tipificacion, skill,
        duracionSeg, codAct, tipoInteraccion, hungUp, skillId, archivoNombre, cargadoPorNombre, createdAt)
     VALUES (@campana,@canal,@agente,@fecha,@hora,@duracionMin,@tipificacion,@skill,
             @duracionSeg,@codAct,@tipoInteraccion,@hungUp,@skillId,@archivoNombre,@cargadoPorNombre,@createdAt)`
  );

  let borradas = 0;
  const tx = db.transaction(() => {
    // Fase 153 (Centro de cargas, PR 2): guarda el/los mes(es) completo(s) antes de cambiarlos (Deshacer 30 dias).
    respaldarAntesDeCambiar(db, 'tipificaciones', { campana, desde, hasta, filtro: { canal }, guardadoPorNombre: cargadoPorNombre });
    borradas = del.run(campana, canal, desde, hasta).changes;
    for (const f of filasObj) {
      insert.run({
        campana, canal,
        agente: f.agente, fecha: f.fecha, hora: f.hora == null ? null : f.hora,
        duracionMin: f.duracionMin == null ? null : f.duracionMin,
        tipificacion: f.tipificacion, skill: f.skill,
        duracionSeg: f.duracionSeg == null ? null : f.duracionSeg,
        codAct: f.codAct == null ? null : f.codAct,
        tipoInteraccion: f.tipoInteraccion == null ? null : f.tipoInteraccion,
        hungUp: f.hungUp == null ? null : f.hungUp,
        skillId: f.skillId == null ? null : f.skillId,
        archivoNombre: archivoNombre || '', cargadoPorNombre: cargadoPorNombre || '-', createdAt: ts,
      });
    }
  });
  tx();

  return { insertadas: filasObj.length, borradas, desde, hasta };
}

function tipificacionesWhereClausulas(q) {
  const clausulas = ['campana = @campana', 'canal = @canal'];
  const params = { campana: q.campana, canal: q.canal };
  if (q.mes) {
    // Fase 88: rango directo sobre `fecha` (columna sin hora, 'AAAA-MM-DD')
    // en vez de `substr(fecha,1,7) = @mes` -- mismo resultado, pero ahora
    // aprovecha idx_tipificaciones_campana_canal_fecha en vez de escanear
    // TODO el historico de esa campana+canal en cada apertura del tab.
    const rango = fechaLimitesRangoDeMes(q.mes);
    clausulas.push('fecha >= @mesDesde AND fecha <= @mesHasta');
    params.mesDesde = rango.desde;
    params.mesHasta = rango.hasta;
  }
  if (q.desde) {
    clausulas.push('fecha >= @desde');
    params.desde = q.desde;
  }
  if (q.hasta) {
    clausulas.push('fecha <= @hasta');
    params.hasta = q.hasta;
  }
  if (q.agente) {
    clausulas.push('agente = @agente');
    params.agente = q.agente;
  }
  if (q.skill && q.canal === 'LLAMADAS' && salidaPorGuion(q.campana)) {
    // Fase 183: ORLANT filtra por el skill ya leido (salida, o el skill propio de las out_pre).
    if (esSkillSalida(q.skill)) {
      clausulas.push(COND_SALIDA_GUION_SQL);
    } else {
      clausulas.push(`(${SKILL_GUION_SQL}) = @skill`);
      params.skill = q.skill;
    }
  } else if (q.skill && q.canal === 'LLAMADAS' && esSkillSalida(q.skill)) {
    // Fase 169: cualquiera de los nombres de salida trae los de todos los meses
    // (Fase 171: tambien el "-" de salida de Mobilize).
    clausulas.push(COND_SALIDA_SQL);
  } else if (q.skill && q.canal === 'LLAMADAS' && String(q.skill).trim() === '-') {
    // Fase 171: "-" queda solo para lo que no es salida (internalcall, sin tipo).
    clausulas.push("TRIM(skill) = '-' AND (tipoInteraccion IS NULL OR tipoInteraccion <> 'outbound_ma')");
  } else if (q.skill) {
    clausulas.push('skill = @skill');
    params.skill = q.skill;
  }
  // Fase 131, Parte 3 (Mobilize): filtro Entrante/Saliente -- ORLANT nunca
  // lo manda (su archivo no trae TYPE_INTERACTION), sin cambio alguno.
  if (q.tipoInteraccion) {
    clausulas.push('tipoInteraccion = @tipoInteraccion');
    params.tipoInteraccion = q.tipoInteraccion;
  }
  // Fase 186: filtro "Línea de salida" -- deja solo la salida del canal de los
  // asesores de esa linea (o de los sin clasificar).
  if (q.linea && usaClasificacionAsesores(q.campana)) {
    clausulas.push(condSalidaCanalSql(q.campana, q.canal));
    clausulas.push(condLineaClasificacionSql(q.linea));
    if (q.linea !== 'SIN') params.lineaClasif = q.linea;
  }
  return { where: clausulas.join(' AND '), params };
}

const TOP_N = 10;

// Agrupa un conteo por tipificacion (ya agregado en SQL, orden desc) en las
// TOP_N categorias mas grandes + una sola "Otras (N tipificaciones)" -- N es
// la cantidad de categorias DISTINTAS agrupadas ahi (no la suma de filas).
// Con 62 categorias reales en un solo mes, un pie sin agrupar es ilegible;
// el TOP_N ya cubre la gran mayoria del volumen. Pura (sin DB), facil de
// probar con datos inventados.
function agruparTop10YOtras(conteoPorTipificacion) {
  const ordenado = (conteoPorTipificacion || []).slice().sort((a, b) => b.cantidad - a.cantidad);
  const top = ordenado.slice(0, TOP_N);
  const resto = ordenado.slice(TOP_N);
  const total = ordenado.reduce((a, r) => a + r.cantidad, 0);
  const otrasCantidad = resto.reduce((a, r) => a + r.cantidad, 0);
  const resultado = top.map((r) => ({ tipificacion: r.tipificacion, cantidad: r.cantidad }));
  if (resto.length) {
    resultado.push({ tipificacion: 'Otras (' + resto.length + ' tipificaciones)', cantidad: otrasCantidad, esOtras: true, distintas: resto.length });
  }
  return { datos: resultado, total };
}

// Grafica principal: conteo por tipificacion (respeta todos los filtros),
// ya agrupado top10+Otras -- el navegador NUNCA ve las filas crudas.
function tipificacionesPorTipo(db, q) {
  const { where, params } = tipificacionesWhereClausulas(q);
  const conteo = db
    .prepare(`SELECT tipificacion, COUNT(*) AS cantidad FROM tipificaciones WHERE ${where} GROUP BY tipificacion ORDER BY cantidad DESC`)
    .all(params);
  return agruparTop10YOtras(conteo);
}

// Fase 131, Parte 3 (Mobilize): tarjetas de SALIDA -- total/conectadas/no
// conectadas de las llamadas SALIENTES (tipoInteraccion='outbound_ma') que
// respetan los filtros de mes/rango/agente/skill (nunca el filtro de
// Entrante/Saliente del panel -- esta tarjeta es SIEMPRE sobre salientes).
// "Conectada" = Regla B (ver SALIDA_NO_CONECTADA arriba): su codificacion
// NO esta en la lista de "no conectada". Canal siempre 'LLAMADAS' (Mobilize
// no tiene WhatsApp).
function tipificacionesResumenSalida(db, q) {
  // Fase 183: totalLlamadas = todas las llamadas (entrada y salida) con los
  // mismos filtros -- la tarjeta "Total llamadas" de ORLANT.
  const todas = tipificacionesWhereClausulas({ ...q, canal: 'LLAMADAS', tipoInteraccion: undefined });
  const totalLlamadas = db.prepare(`SELECT COUNT(*) AS n FROM tipificaciones WHERE ${todas.where}`).get(todas.params).n;
  const { where, params } = salidaPorGuion(q.campana)
    ? (() => { const w = tipificacionesWhereClausulas({ ...q, canal: 'LLAMADAS', tipoInteraccion: undefined }); return { where: `${w.where} AND ${COND_SALIDA_GUION_SQL}`, params: w.params }; })()
    : tipificacionesWhereClausulas({ ...q, canal: 'LLAMADAS', tipoInteraccion: 'outbound_ma' });
  const total = db.prepare(`SELECT COUNT(*) AS n FROM tipificaciones WHERE ${where}`).get(params).n;
  const soloTotal = salidaPorGuion(q.campana); // ORLANT: una sola tarjeta, Total llamadas
  const extra = soloTotal ? { totalLlamadas, soloTotal } : {};
  if (!total) return { total: 0, conectadas: 0, noConectadas: 0, ...extra };
  const noConectada = salidaNoConectadaDe(db, q.campana);
  const placeholders = noConectada.map((_, i) => `@noConectada${i}`).join(', ');
  const paramsNoConectadas = { ...params };
  noConectada.forEach((v, i) => { paramsNoConectadas['noConectada' + i] = v; });
  const noConectadas = db
    .prepare(`SELECT COUNT(*) AS n FROM tipificaciones WHERE ${where} AND tipificacion IN (${placeholders})`)
    .get(paramsNoConectadas).n;
  return { total, conectadas: total - noConectadas, noConectadas, ...extra };
}

// Valores distintos para los filtros ("Todos" + seleccion) + si hay datos
// (meses.length) -- tambien lo usa dashboard-generic.js para decidir si el
// tab "Tipificacion" se destapa (ver _gdBootstrap): SIN filtrar por canal,
// asi que basta con tipificaciones de CUALQUIER canal para destaparlo.
function tipificacionesOpciones(db, campana, canal) {
  const distintos = (columna) =>
    db.prepare(`SELECT DISTINCT ${columna} AS v FROM tipificaciones WHERE campana = ? AND canal = ? ORDER BY v`).all(campana, canal).map((r) => r.v);
  return {
    meses: db.prepare('SELECT DISTINCT substr(fecha,1,7) AS v FROM tipificaciones WHERE campana = ? AND canal = ? ORDER BY v').all(campana, canal).map((r) => r.v),
    agentes: distintos('agente'),
    // Fase 169: en Llamadas, los nombres de salida de meses anteriores se
    // muestran una sola vez, como LLAMADAS DE SALIDA.
    // Fase 186: el panel muestra el filtro "Línea de salida" y las tarjetas por linea.
    clasificacionAsesores: usaClasificacionAsesores(campana),
    skills: canal === 'LLAMADAS'
      ? db.prepare(`SELECT DISTINCT ${salidaPorGuion(campana) ? SKILL_GUION_SQL : `CASE WHEN ${COND_SALIDA_SQL} THEN '${SKILL_SALIDA}' ELSE skill END`} AS v FROM tipificaciones WHERE campana = ? AND canal = ? ORDER BY v`)
        .all(campana, canal).map((r) => r.v)
      : distintos('skill'),
  };
}

// Si ORLANT tiene ALGUNA tipificacion cargada (cualquier canal) -- usado
// SOLO para decidir si el tab se destapa en memoria (dashboard-generic.js).
function tieneAlgunaTipificacion(db, campana) {
  const n = db.prepare('SELECT COUNT(*) AS n FROM tipificaciones WHERE campana = ?').get(campana).n;
  return n > 0;
}

module.exports = {
  CANALES,
  condSalidaLlamadasSql,
  condSalidaCanalSql,
  usaClasificacionAsesores,
  tipificacionesWhereClausulas,
  salidaPorGuion,
  SKILL_SALIDA,
  esSkillSalida,
  CAMPOS_FILA,
  filaArrayAObjeto,
  impactoTipificaciones,
  cargarTipificaciones,
  tipificacionesPorTipo,
  tipificacionesResumenSalida,
  salidaNoConectadaDe,
  tipificacionesOpciones,
  tieneAlgunaTipificacion,
  agruparTop10YOtras,
};
