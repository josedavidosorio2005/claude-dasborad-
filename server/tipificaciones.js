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
const SALIDA_NO_CONECTADA = ['Cliente_no_contesta'];

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
  if (q.skill) {
    clausulas.push('skill = @skill');
    params.skill = q.skill;
  }
  // Fase 131, Parte 3 (Mobilize): filtro Entrante/Saliente -- ORLANT nunca
  // lo manda (su archivo no trae TYPE_INTERACTION), sin cambio alguno.
  if (q.tipoInteraccion) {
    clausulas.push('tipoInteraccion = @tipoInteraccion');
    params.tipoInteraccion = q.tipoInteraccion;
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
  const { where, params } = tipificacionesWhereClausulas({ ...q, canal: 'LLAMADAS', tipoInteraccion: 'outbound_ma' });
  const total = db.prepare(`SELECT COUNT(*) AS n FROM tipificaciones WHERE ${where}`).get(params).n;
  if (!total) return { total: 0, conectadas: 0, noConectadas: 0 };
  const placeholders = SALIDA_NO_CONECTADA.map((_, i) => `@noConectada${i}`).join(', ');
  const paramsNoConectadas = { ...params };
  SALIDA_NO_CONECTADA.forEach((v, i) => { paramsNoConectadas['noConectada' + i] = v; });
  const noConectadas = db
    .prepare(`SELECT COUNT(*) AS n FROM tipificaciones WHERE ${where} AND tipificacion IN (${placeholders})`)
    .get(paramsNoConectadas).n;
  return { total, conectadas: total - noConectadas, noConectadas };
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
    skills: distintos('skill'),
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
  CAMPOS_FILA,
  filaArrayAObjeto,
  impactoTipificaciones,
  cargarTipificaciones,
  tipificacionesPorTipo,
  tipificacionesResumenSalida,
  tipificacionesOpciones,
  tieneAlgunaTipificacion,
  agruparTop10YOtras,
};
