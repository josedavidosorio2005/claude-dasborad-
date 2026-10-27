// llamadas-unicas.js — Llamadas Unicas de Mobilize (Fase 138, PR3, pedido de
// Edwin 09/10/2026): escritura (reemplazo por periodo) y agregacion
// filtrada. Mismo patron que tipificaciones.js (Fase 77): el servidor NUNCA
// descarga filas crudas al dashboard, todo lo que sale de aqui ya viene
// agregado (ver routes/llamadas-unicas.js).
//
// PRIVACIDAD (dura, pedido explicito): el telefono (TELEPHONE del archivo
// real) se usa SOLO EN MEMORIA, en el navegador, para deduplicar por
// (dia, telefono) -- ver public/js/llamadas-unicas-logic.js. Esta tabla NO
// TIENE columna de telefono (ver server/db.js) y este archivo nunca la
// referencia; server/tests/fase138-pr3-llamadas-unicas-privacidad.test.js
// falla si algun INSERT algun dia llegara a incluirla.
'use strict';

const { aplicarAliasAFilas } = require('./alias-asesores');
const { respaldarAntesDeCambiar } = require('./cargas-versiones');

function nowStr() {
  const d = new Date();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Orden FIJO del payload compacto (arrays, no objetos) -- debe coincidir
// EXACTO con LLAMADAS_UNICAS_ORDEN_ARRAY (public/js/llamadas-unicas-logic.js)
// y con llamadasUnicasFilaArraySchema (validation.js). Los 3 definen el
// mismo contrato. A proposito, 'telefono' NUNCA aparece aqui.
const CAMPOS_FILA = ['agente', 'fecha', 'tipo', 'skill'];

function filaArrayAObjeto(arr) {
  const obj = {};
  CAMPOS_FILA.forEach((k, i) => { obj[k] = arr[i]; });
  return obj;
}

// Primera y ultima fecha entre las filas del archivo que se esta subiendo --
// define el periodo (dia a dia, sin hora) que la carga va a REEMPLAZAR.
function rangoFechas(filasObj) {
  let min = filasObj[0].fecha;
  let max = filasObj[0].fecha;
  for (const f of filasObj) {
    if (f.fecha < min) min = f.fecha;
    if (f.fecha > max) max = f.fecha;
  }
  return { desde: min, hasta: max };
}

// Cuenta cuantas filas YA EXISTEN en el rango que este archivo reemplazaria
// -- no escribe nada. Tambien da los conteos de control (contestadas/
// abandonadas/total del archivo QUE SE ESTA SUBIENDO, no de lo ya guardado)
// para que el dry-run de "OK cargar" los pueda comparar sin imprimir filas.
function impactoLlamadasUnicas(db, { campana, filas }) {
  const filasObj = filas.map(filaArrayAObjeto);
  const { desde, hasta } = rangoFechas(filasObj);
  const existentes = db
    .prepare('SELECT COUNT(*) AS n FROM llamadas_unicas WHERE campana = ? AND fecha >= ? AND fecha <= ?')
    .get(campana, desde, hasta).n;
  const contestadas = filasObj.filter((f) => f.tipo === 'CONTESTADA').length;
  const abandonadas = filasObj.filter((f) => f.tipo === 'ABANDONADA').length;
  const alias = aplicarAliasAFilas(db, campana, filasObj, 'agente');
  return {
    desde, hasta, filasExistentes: existentes, filasNuevas: filasObj.length,
    contestadas, abandonadas,
    filasUnificadasPorAlias: alias.filasUnificadas, asesoresUnificadosPorAlias: alias.asesoresUnificados,
  };
}

// Reemplaza por PERIODO: borra todo lo que haya en [desde,hasta] para esta
// campana, despues inserta las filas nuevas -- una sola transaccion. Volver
// a subir el MISMO archivo deja el mismo conteo total (nunca duplica).
// Cargar OTRO mes nunca borra el anterior (el rango sale del archivo que se
// esta subiendo, nunca "todo el historico").
function cargarLlamadasUnicas(db, { campana, archivoNombre, cargadoPorNombre, filas }) {
  const ts = nowStr();
  let filasObj = filas.map(filaArrayAObjeto);
  filasObj = aplicarAliasAFilas(db, campana, filasObj, 'agente').filas;
  const { desde, hasta } = rangoFechas(filasObj);

  const del = db.prepare('DELETE FROM llamadas_unicas WHERE campana = ? AND fecha >= ? AND fecha <= ?');
  const insert = db.prepare(
    `INSERT INTO llamadas_unicas (campana, fecha, tipo, skill, agente, archivoNombre, cargadoPorNombre, createdAt)
     VALUES (@campana, @fecha, @tipo, @skill, @agente, @archivoNombre, @cargadoPorNombre, @createdAt)`
  );

  let borradas = 0;
  const tx = db.transaction(() => {
    // Fase 153 (Centro de cargas, PR 2): guarda el/los mes(es) completo(s) antes de cambiarlos (Deshacer 30 dias).
    respaldarAntesDeCambiar(db, 'llamadas_unicas', { campana, desde, hasta, guardadoPorNombre: cargadoPorNombre });
    borradas = del.run(campana, desde, hasta).changes;
    for (const f of filasObj) {
      insert.run({
        campana, fecha: f.fecha, tipo: f.tipo, skill: f.skill, agente: f.agente,
        archivoNombre: archivoNombre || '', cargadoPorNombre: cargadoPorNombre || '-', createdAt: ts,
      });
    }
  });
  tx();

  return { insertadas: filasObj.length, borradas, desde, hasta };
}

function llamadasUnicasWhereClausulas(q) {
  const clausulas = ['campana = @campana'];
  const params = { campana: q.campana };
  if (q.desde) {
    clausulas.push('fecha >= @desde');
    params.desde = q.desde;
  }
  if (q.hasta) {
    clausulas.push('fecha <= @hasta');
    params.hasta = q.hasta;
  }
  if (q.skill) {
    clausulas.push('skill = @skill');
    params.skill = q.skill;
  }
  if (q.agente) {
    clausulas.push('agente = @agente');
    params.agente = q.agente;
  }
  return { where: clausulas.join(' AND '), params };
}

// Fase 191: la carga vieja (plantilla armada a mano) por mes. Ya no es la
// unica fuente: ver llamadasUnicasPorMes.
function _porMesPlantilla(db, q) {
  const { where, params } = llamadasUnicasWhereClausulas(q);
  return db
    .prepare(`SELECT substr(fecha,1,7) AS periodo,
        SUM(CASE WHEN tipo='CONTESTADA' THEN 1 ELSE 0 END) AS contestadas,
        SUM(CASE WHEN tipo='ABANDONADA' THEN 1 ELSE 0 END) AS abandonadas,
        COUNT(*) AS total
      FROM llamadas_unicas WHERE ${where} GROUP BY periodo ORDER BY periodo`)
    .all(params);
}

// ── Fase 191: fuentes de cada mes (pedido del 27/10) ──────────────────────
// - Contestadas unicas: del CDR que se carga en Tipificacion (filas de
//   ingreso con unicaDia = 1, ver tipificacion-logic.js). Un mes "tiene CDR"
//   si alguna fila de LLAMADAS de ese mes trae la marca (no NULL).
// - Abandonadas unicas: del reporte "Detalle de llamadas abandonadas" de
//   Wolkvox (tabla llamadas_abandonadas), si ese mes tiene filas.
// - Si no, las contestadas salen de la carga vieja (llamadas_unicas) y las
//   abandonadas son 0 (Fase 194). Total =
//   contestadas + abandonadas. Cada mes dice de donde sale cada parte.
const SKILLS_SALIDA_CDR = ['-', 'LLAMADAS DE SALIDA'];
const SQL_NO_SALIDA = 'skill NOT IN (' + SKILLS_SALIDA_CDR.map((x) => "'" + x + "'").join(', ') + ')';
const FUENTE = { CDR: 'CDR', ABANDONADAS: 'ABANDONADAS', PLANTILLA: 'PLANTILLA' };

function _rango(q) {
  const c = [];
  const p = {};
  if (q.desde) { c.push('fecha >= @desde'); p.desde = q.desde; }
  if (q.hasta) { c.push('fecha <= @hasta'); p.hasta = q.hasta; }
  return { sql: c.length ? ' AND ' + c.join(' AND ') : '', params: p };
}

// Meses con CDR marcado (sin filtros de skill/asesor: el mes tiene CDR aunque
// un asesor no tenga llamadas en el).
function mesesCdrMarcado(db, campana, q) {
  const r = _rango(q || {});
  return db
    .prepare(`SELECT DISTINCT substr(fecha,1,7) AS v FROM tipificaciones
      WHERE campana = @campana AND canal = 'LLAMADAS' AND unicaDia IS NOT NULL${r.sql} ORDER BY v`)
    .all({ campana, ...r.params }).map((x) => x.v);
}
function mesesAbandonadas(db, campana, q) {
  const r = _rango(q || {});
  return db
    .prepare(`SELECT DISTINCT substr(fecha,1,7) AS v FROM llamadas_abandonadas WHERE campana = @campana${r.sql} ORDER BY v`)
    .all({ campana, ...r.params }).map((x) => x.v);
}

function _contestadasCdrPorMes(db, q) {
  const r = _rango(q);
  const params = { campana: q.campana, ...r.params };
  let extra = '';
  if (q.skill) { extra += ' AND skill = @skill'; params.skill = q.skill; }
  if (q.agente) { extra += ' AND agente = @agente'; params.agente = q.agente; }
  const out = {};
  db.prepare(`SELECT substr(fecha,1,7) AS periodo, COUNT(*) AS n FROM tipificaciones
      WHERE campana = @campana AND canal = 'LLAMADAS' AND unicaDia = 1 AND ${SQL_NO_SALIDA}${r.sql}${extra}
      GROUP BY periodo`).all(params).forEach((x) => { out[x.periodo] = x.n; });
  return out;
}

function _abandonadasPorMes(db, q) {
  const out = {};
  // Las abandonadas no traen asesor: con filtro de asesor no hay ninguna.
  if (q.agente) return out;
  const r = _rango(q);
  const params = { campana: q.campana, ...r.params };
  let extra = '';
  if (q.skill) { extra += ' AND skill = @skill'; params.skill = q.skill; }
  db.prepare(`SELECT substr(fecha,1,7) AS periodo, COUNT(*) AS n FROM llamadas_abandonadas
      WHERE campana = @campana${r.sql}${extra} GROUP BY periodo`).all(params).forEach((x) => { out[x.periodo] = x.n; });
  return out;
}

// Grafica de barras por mes: 1 fila por 'AAAA-MM' con total/contestadas/
// abandonadas y la fuente de cada parte -- ya agregado en SQL, el navegador
// nunca ve filas crudas.
function llamadasUnicasPorMes(db, q) {
  const mesesCdr = new Set(mesesCdrMarcado(db, q.campana, q));
  const mesesAb = new Set(mesesAbandonadas(db, q.campana, q));
  const cdr = _contestadasCdrPorMes(db, q);
  const ab = _abandonadasPorMes(db, q);
  const vieja = {};
  _porMesPlantilla(db, q).forEach((m) => { vieja[m.periodo] = m; });
  const meses = [...new Set([...mesesCdr, ...mesesAb, ...Object.keys(vieja)])].sort();
  return meses.map((periodo) => {
    const v = vieja[periodo] || { contestadas: 0, abandonadas: 0 };
    const deCdr = mesesCdr.has(periodo);
    const deAb = mesesAb.has(periodo);
    const contestadas = deCdr ? (cdr[periodo] || 0) : (v.contestadas || 0);
    // Fase 194 (pedido del 27/10): las abandonadas salen SOLO del reporte de
    // Wolkvox; un mes sin ese reporte muestra 0 (la carga vieja no se borra).
    const abandonadas = deAb ? (ab[periodo] || 0) : 0;
    return {
      periodo, contestadas, abandonadas, total: contestadas + abandonadas,
      fuenteContestadas: deCdr ? FUENTE.CDR : (vieja[periodo] ? FUENTE.PLANTILLA : null),
      fuenteAbandonadas: deAb ? FUENTE.ABANDONADAS : null,
    };
  });
}

// Tarjetas-resumen: contestadas/abandonadas/total (suma) que respetan los
// filtros actuales (fecha/skill/asesor). Fase 191: la suma de los meses, con
// la misma fuente por mes que la grafica.
function llamadasUnicasResumen(db, q) {
  return llamadasUnicasPorMes(db, q).reduce((a, m) => ({
    contestadas: a.contestadas + m.contestadas, abandonadas: a.abandonadas + m.abandonadas, total: a.total + m.total,
  }), { contestadas: 0, abandonadas: 0, total: 0 });
}

// Valores distintos para los filtros (skill incluye "Abandonadas" si hay
// alguna fila de ese tipo) + meses con datos (para que el panel sepa si
// mostrar el estado vacio). La lista de asesores va SOLO si `incluirAgentes`
// (la ruta lo decide con puedeVerAsesores, Fase 149).
function llamadasUnicasOpciones(db, campana, { incluirAgentes } = {}) {
  const distintos = (columna) =>
    db.prepare(`SELECT DISTINCT ${columna} AS v FROM llamadas_unicas WHERE campana = ? ORDER BY v`).all(campana).map((r) => r.v);
  // Fase 191: tambien los skills/asesores de ingreso del CDR marcado y los skills de las abandonadas.
  const delCdr = (columna) =>
    db.prepare(`SELECT DISTINCT ${columna} AS v FROM tipificaciones
      WHERE campana = ? AND canal = 'LLAMADAS' AND unicaDia = 1 AND ${SQL_NO_SALIDA}`).all(campana).map((r) => r.v);
  const unir = (...listas) => [...new Set([].concat(...listas))].sort();
  const out = {
    meses: unir(
      db.prepare('SELECT DISTINCT substr(fecha,1,7) AS v FROM llamadas_unicas WHERE campana = ?').all(campana).map((r) => r.v),
      mesesCdrMarcado(db, campana), mesesAbandonadas(db, campana)
    ),
    skills: unir(distintos('skill'), delCdr('skill'),
      db.prepare('SELECT DISTINCT skill AS v FROM llamadas_abandonadas WHERE campana = ?').all(campana).map((r) => r.v)),
  };
  if (incluirAgentes) out.agentes = unir(distintos('agente'), delCdr('agente')).filter((a) => a !== ''); // Fase 163: las abandonadas no traen asesor
  return out;
}

// ── Fase 191: carga del reporte "Detalle de llamadas abandonadas" ─────────
// Filas [fecha, skill] ya deduplicadas por (dia, telefono) en el navegador
// (llamadasAbandonadasParseFilas): el telefono nunca llega aqui. Reemplaza
// por periodo (primera a ultima fecha del archivo), igual que las demas.
const CAMPOS_FILA_ABANDONADAS = ['fecha', 'skill'];

function _abandonadasObjetos(filas) {
  return filas.map((arr) => ({ fecha: arr[0], skill: arr[1] }));
}

function impactoLlamadasAbandonadas(db, { campana, filas }) {
  const filasObj = _abandonadasObjetos(filas);
  const { desde, hasta } = rangoFechas(filasObj);
  const existentes = db
    .prepare('SELECT COUNT(*) AS n FROM llamadas_abandonadas WHERE campana = ? AND fecha >= ? AND fecha <= ?')
    .get(campana, desde, hasta).n;
  return { desde, hasta, filasExistentes: existentes, filasNuevas: filasObj.length };
}

function cargarLlamadasAbandonadas(db, { campana, archivoNombre, cargadoPorNombre, filas }) {
  const ts = nowStr();
  const filasObj = _abandonadasObjetos(filas);
  const { desde, hasta } = rangoFechas(filasObj);
  const del = db.prepare('DELETE FROM llamadas_abandonadas WHERE campana = ? AND fecha >= ? AND fecha <= ?');
  const insert = db.prepare(
    `INSERT INTO llamadas_abandonadas (campana, fecha, skill, archivoNombre, cargadoPorNombre, createdAt)
     VALUES (@campana, @fecha, @skill, @archivoNombre, @cargadoPorNombre, @createdAt)`
  );
  let borradas = 0;
  db.transaction(() => {
    respaldarAntesDeCambiar(db, 'llamadas_abandonadas', { campana, desde, hasta, guardadoPorNombre: cargadoPorNombre });
    borradas = del.run(campana, desde, hasta).changes;
    for (const f of filasObj) {
      insert.run({ campana, fecha: f.fecha, skill: f.skill, archivoNombre: archivoNombre || '', cargadoPorNombre: cargadoPorNombre || '-', createdAt: ts });
    }
  })();
  return { insertadas: filasObj.length, borradas, desde, hasta };
}

module.exports = {
  CAMPOS_FILA,
  filaArrayAObjeto,
  impactoLlamadasUnicas,
  cargarLlamadasUnicas,
  llamadasUnicasResumen,
  llamadasUnicasPorMes,
  llamadasUnicasOpciones,
  // Fase 191
  SKILLS_SALIDA_CDR,
  FUENTE,
  CAMPOS_FILA_ABANDONADAS,
  mesesCdrMarcado,
  impactoLlamadasAbandonadas,
  cargarLlamadasAbandonadas,
};
