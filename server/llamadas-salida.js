// llamadas-salida.js — Llamadas de salida de Mobilize (Fase 141, Parte C,
// reunion con Edwin del 13/10/2026): escritura (reemplazo por periodo) y
// agregacion filtrada. Mismo patron que llamadas-unicas.js: el servidor
// NUNCA descarga filas crudas al dashboard, todo sale ya agregado (ver
// routes/llamadas-salida.js).
//
// PRIVACIDAD: el telefono se usa SOLO en memoria, en el navegador, para
// deduplicar por (dia, telefono, tipo) -- ver public/js/llamadas-salida-
// logic.js. La tabla `llamadas_salida` NO TIENE columna de telefono.
// Los nombres de asesor solo salen hacia roles internos (la ruta decide
// quien puede pedir `agente`/`detalle`).
'use strict';

const { aplicarAliasAFilas } = require('./alias-asesores');
const { respaldarAntesDeCambiar } = require('./cargas-versiones');

function nowStr() {
  const d = new Date();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Orden FIJO del payload compacto -- debe coincidir EXACTO con
// LLAMADAS_SALIDA_ORDEN_ARRAY (public/js/llamadas-salida-logic.js) y con
// llamadasSalidaFilaArraySchema (validation.js). 'telefono' NUNCA aparece.
const CAMPOS_FILA = ['agente', 'fecha', 'tipo', 'tipificacion'];

function filaArrayAObjeto(arr) {
  const obj = {};
  CAMPOS_FILA.forEach((k, i) => { obj[k] = arr[i]; });
  return obj;
}

function rangoFechas(filasObj) {
  let min = filasObj[0].fecha;
  let max = filasObj[0].fecha;
  for (const f of filasObj) {
    if (f.fecha < min) min = f.fecha;
    if (f.fecha > max) max = f.fecha;
  }
  return { desde: min, hasta: max };
}

// Cuenta lo que YA existe en el rango que este archivo reemplazaria (no
// escribe nada) + conteos de control del archivo que se esta subiendo.
function impactoLlamadasSalida(db, { campana, filas }) {
  const filasObj = filas.map(filaArrayAObjeto);
  const { desde, hasta } = rangoFechas(filasObj);
  const existentes = db
    .prepare('SELECT COUNT(*) AS n FROM llamadas_salida WHERE campana = ? AND fecha >= ? AND fecha <= ?')
    .get(campana, desde, hasta).n;
  const conectadas = filasObj.filter((f) => f.tipo === 'CONECTADA').length;
  const noConectadas = filasObj.filter((f) => f.tipo === 'NO_CONECTADA').length;
  const alias = aplicarAliasAFilas(db, campana, filasObj, 'agente');
  return {
    desde, hasta, filasExistentes: existentes, filasNuevas: filasObj.length,
    conectadas, noConectadas,
    filasUnificadasPorAlias: alias.filasUnificadas, asesoresUnificadosPorAlias: alias.asesoresUnificados,
  };
}

// Reemplaza por PERIODO: borra todo lo de [desde,hasta] de esta campana y
// despues inserta las filas nuevas -- una sola transaccion (mismo patron que
// cargarLlamadasUnicas). Cargar OTRO mes nunca borra el anterior.
function cargarLlamadasSalida(db, { campana, archivoNombre, cargadoPorNombre, filas }) {
  const ts = nowStr();
  let filasObj = filas.map(filaArrayAObjeto);
  filasObj = aplicarAliasAFilas(db, campana, filasObj, 'agente').filas;
  const { desde, hasta } = rangoFechas(filasObj);

  const del = db.prepare('DELETE FROM llamadas_salida WHERE campana = ? AND fecha >= ? AND fecha <= ?');
  const insert = db.prepare(
    `INSERT INTO llamadas_salida (campana, fecha, tipo, agente, tipificacion, archivoNombre, cargadoPorNombre, createdAt)
     VALUES (@campana, @fecha, @tipo, @agente, @tipificacion, @archivoNombre, @cargadoPorNombre, @createdAt)`
  );

  let borradas = 0;
  const tx = db.transaction(() => {
    // Fase 153 (Centro de cargas, PR 2): guarda el/los mes(es) completo(s) antes de cambiarlos (Deshacer 30 dias).
    respaldarAntesDeCambiar(db, 'llamadas_salida', { campana, desde, hasta, guardadoPorNombre: cargadoPorNombre });
    borradas = del.run(campana, desde, hasta).changes;
    for (const f of filasObj) {
      insert.run({
        campana, fecha: f.fecha, tipo: f.tipo, agente: f.agente, tipificacion: f.tipificacion,
        archivoNombre: archivoNombre || '', cargadoPorNombre: cargadoPorNombre || '-', createdAt: ts,
      });
    }
  });
  tx();

  return { insertadas: filasObj.length, borradas, desde, hasta };
}

function llamadasSalidaWhereClausulas(q) {
  const clausulas = ['campana = @campana'];
  const params = { campana: q.campana };
  if (q.desde) { clausulas.push('fecha >= @desde'); params.desde = q.desde; }
  if (q.hasta) { clausulas.push('fecha <= @hasta'); params.hasta = q.hasta; }
  if (q.agente) { clausulas.push('agente = @agente'); params.agente = q.agente; }
  if (q.tipo) { clausulas.push('tipo = @tipo'); params.tipo = q.tipo; }
  return { where: clausulas.join(' AND '), params };
}

const SUMAS = `COUNT(*) AS total,
        SUM(CASE WHEN tipo='NO_CONECTADA' THEN 1 ELSE 0 END) AS noConectadas,
        SUM(CASE WHEN tipo='CONECTADA' THEN 1 ELSE 0 END) AS conectadas`;

function normSumas(r) {
  return { total: r.total || 0, noConectadas: r.noConectadas || 0, conectadas: r.conectadas || 0 };
}

// ── Fase 191 (pedido del 27/10): salida conectada desde el CDR ─────────────
// En los meses que tienen CDR cargado en Tipificacion (canal LLAMADAS), las
// conectadas salen de ahi: las filas con SKILL_NAME "-" (guardadas como "-" o
// como "LLAMADAS DE SALIDA", ver tipificacion-logic.js), una por registro.
// Las no conectadas necesitan otra base que todavia no existe: en esos meses
// van en null (pendiente) y el total tambien -- nunca se inventa la cifra.
// Los meses sin CDR siguen con la carga vieja (llamadas_salida).
const SKILLS_SALIDA_CDR = ['-', 'LLAMADAS DE SALIDA'];
const SQL_SALIDA_CDR = 'skill IN (' + SKILLS_SALIDA_CDR.map((x) => "'" + x + "'").join(', ') + ')';
const FUENTE = { CDR: 'CDR', PLANTILLA: 'PLANTILLA', NO_CONECTADAS: 'NO_CONECTADAS' };

function _rangoCdr(q) {
  const c = ["campana = @campana", "canal = 'LLAMADAS'"];
  const p = { campana: q.campana };
  if (q.desde) { c.push('fecha >= @desde'); p.desde = q.desde; }
  if (q.hasta) { c.push('fecha <= @hasta'); p.hasta = q.hasta; }
  return { where: c.join(' AND '), params: p };
}
function mesesConCdr(db, q) {
  const { where, params } = _rangoCdr(q);
  return db.prepare(`SELECT DISTINCT substr(fecha,1,7) AS v FROM tipificaciones WHERE ${where} ORDER BY v`).all(params).map((x) => x.v);
}
// Conectadas del CDR agrupadas por `grupo` (expresion SQL fija de este archivo).
function _conectadasCdr(db, q, grupo) {
  const { where, params } = _rangoCdr(q);
  let extra = '';
  if (q.agente) { extra += ' AND agente = @agente'; params.agente = q.agente; }
  // El CDR solo da conectadas: con el filtro "No conectada" no hay ninguna.
  if (q.tipo === 'NO_CONECTADA') extra += ' AND 0';
  return db
    .prepare(`SELECT ${grupo} AS g, substr(fecha,1,7) AS periodo, COUNT(*) AS n FROM tipificaciones
      WHERE ${where} AND ${SQL_SALIDA_CDR}${extra} GROUP BY g, periodo`)
    .all(params);
}
// Fase 194: no conectadas del reporte de Wolkvox "5. Detalle de las llamadas
// para las no conectadas" (tabla llamadas_no_conectadas, una fila por llamada,
// sin quitar repetidas). Un mes "tiene la base" si tiene alguna fila.
function _rangoNc(q) {
  const c = ['campana = @campana'];
  const p = { campana: q.campana };
  if (q.desde) { c.push('fecha >= @desde'); p.desde = q.desde; }
  if (q.hasta) { c.push('fecha <= @hasta'); p.hasta = q.hasta; }
  return { where: c.join(' AND '), params: p };
}
function mesesConNoConectadas(db, q) {
  const { where, params } = _rangoNc(q);
  return db.prepare(`SELECT DISTINCT substr(fecha,1,7) AS v FROM llamadas_no_conectadas WHERE ${where} ORDER BY v`).all(params).map((x) => x.v);
}
function _noConectadasBase(db, q, grupo) {
  const { where, params } = _rangoNc(q);
  let extra = '';
  if (q.agente) { extra += ' AND agente = @agente'; params.agente = q.agente; }
  if (q.tipo === 'CONECTADA') extra += ' AND 0'; // con el filtro "Conectada" no hay ninguna
  return db
    .prepare(`SELECT ${grupo} AS g, substr(fecha,1,7) AS periodo, COUNT(*) AS n FROM llamadas_no_conectadas
      WHERE ${where}${extra} GROUP BY g, periodo`)
    .all(params);
}
// Filas de la carga vieja agrupadas, sin los meses que ya salen del CDR.
function _vieja(db, q, grupo, mesesCdr) {
  const { where, params } = llamadasSalidaWhereClausulas(q);
  return db
    .prepare(`SELECT ${grupo} AS g, substr(fecha,1,7) AS periodo, ${SUMAS} FROM llamadas_salida WHERE ${where} GROUP BY g, periodo`)
    .all(params)
    .filter((x) => !mesesCdr.has(x.periodo));
}
// Junta las fuentes por grupo, mes a mes:
// - conectadas: CDR si el mes tiene CDR; si no, la carga vieja;
// - no conectadas: la base nueva si el mes la tiene; si no, la carga vieja
//   en los meses sin CDR; en un mes con CDR y sin la base, null (pendiente)
//   y el total tambien -- nunca se inventa la cifra.
function _combinar(db, q, grupo) {
  const mesesCdr = new Set(mesesConCdr(db, q));
  const mesesNc = new Set(mesesConNoConectadas(db, q));
  const celdas = {};
  const celda = (g, periodo) => celdas[g + '|' + periodo] || (celdas[g + '|' + periodo] = { g, periodo, conectadas: 0, noConectadas: 0 });
  _vieja(db, q, grupo, mesesCdr).forEach((x) => {
    const c = celda(x.g, x.periodo);
    const n = normSumas(x);
    c.conectadas += n.conectadas;
    if (!mesesNc.has(x.periodo)) c.noConectadas += n.noConectadas;
  });
  _conectadasCdr(db, q, grupo).forEach((x) => { if (mesesCdr.has(x.periodo)) celda(x.g, x.periodo).conectadas += x.n; });
  _noConectadasBase(db, q, grupo).forEach((x) => { celda(x.g, x.periodo).noConectadas += x.n; });
  // Por mes: un mes con CDR o con la base aparece aunque no tenga filas con estos filtros.
  if (grupo === 'substr(fecha,1,7)') [...mesesCdr, ...mesesNc].forEach((m) => celda(m, m));
  const fuenteCon = (periodo) => (mesesCdr.has(periodo) ? FUENTE.CDR : FUENTE.PLANTILLA);
  const fuenteNc = (periodo) => (mesesNc.has(periodo) ? FUENTE.NO_CONECTADAS : (mesesCdr.has(periodo) ? null : FUENTE.PLANTILLA));
  const out = {};
  Object.values(celdas).forEach((c) => {
    const o = out[c.g] || (out[c.g] = { g: c.g, conectadas: 0, noConectadas: 0, pendiente: false, fCon: new Set(), fNc: new Set() });
    o.conectadas += c.conectadas;
    o.noConectadas += c.noConectadas;
    o.fCon.add(fuenteCon(c.periodo));
    const fn = fuenteNc(c.periodo);
    if (fn === null) o.pendiente = true; else o.fNc.add(fn);
  });
  const una = (set) => (set.size === 1 ? [...set][0] : (set.size ? 'MIXTA' : null));
  return Object.values(out).map((o) => ({
    g: o.g, conectadas: o.conectadas,
    noConectadas: o.pendiente ? null : o.noConectadas,
    total: o.pendiente ? null : o.conectadas + o.noConectadas,
    fuente: una(o.fCon),
    fuenteNoConectadas: o.pendiente ? null : una(o.fNc),
  }));
}

function llamadasSalidaPorMes(db, q) {
  return _combinar(db, q, 'substr(fecha,1,7)')
    .sort((a, b) => (a.g < b.g ? -1 : 1))
    .map((x) => ({ periodo: x.g, total: x.total, noConectadas: x.noConectadas, conectadas: x.conectadas, fuente: x.fuente, fuenteNoConectadas: x.fuenteNoConectadas }));
}

// Fase 191: suma de los meses; si alguno salio del CDR sin la base de no
// conectadas (Fase 194), no conectadas y total quedan en null
// (noConectadasPendiente) -- nunca una suma a medias.
function llamadasSalidaResumen(db, q) {
  const meses = llamadasSalidaPorMes(db, q);
  const pendiente = meses.some((m) => m.noConectadas === null);
  const conectadas = meses.reduce((a, m) => a + m.conectadas, 0);
  return {
    conectadas,
    noConectadas: pendiente ? null : meses.reduce((a, m) => a + m.noConectadas, 0),
    total: pendiente ? null : meses.reduce((a, m) => a + m.total, 0),
    noConectadasPendiente: pendiente,
  };
}

function llamadasSalidaDetalle(db, q) {
  const porAsesor = _combinar(db, q, 'agente')
    .map((x) => ({ agente: x.g, total: x.total, noConectadas: x.noConectadas, conectadas: x.conectadas }))
    .sort((a, b) => (b.conectadas - a.conectadas) || (a.agente < b.agente ? -1 : 1));
  const porDia = _combinar(db, q, 'fecha')
    .map((x) => ({ fecha: x.g, total: x.total, noConectadas: x.noConectadas, conectadas: x.conectadas }))
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  return { porAsesor, porDia };
}

// Meses con datos (para el estado vacio) y, SOLO si `incluirAgentes`, la
// lista de asesores para el filtro (la ruta lo decide por rol).
function llamadasSalidaOpciones(db, campana, { incluirAgentes } = {}) {
  const unir = (...listas) => [...new Set([].concat(...listas))].sort();
  const out = {
    meses: unir(
      db.prepare('SELECT DISTINCT substr(fecha,1,7) AS v FROM llamadas_salida WHERE campana = ?').all(campana).map((r) => r.v),
      mesesConCdr(db, { campana }), // Fase 191
      mesesConNoConectadas(db, { campana }) // Fase 194
    ),
  };
  if (incluirAgentes) {
    out.agentes = unir(
      db.prepare('SELECT DISTINCT agente AS v FROM llamadas_salida WHERE campana = ?').all(campana).map((r) => r.v),
      db.prepare(`SELECT DISTINCT agente AS v FROM tipificaciones WHERE campana = ? AND canal = 'LLAMADAS' AND ${SQL_SALIDA_CDR}`).all(campana).map((r) => r.v),
      db.prepare('SELECT DISTINCT agente AS v FROM llamadas_no_conectadas WHERE campana = ?').all(campana).map((r) => r.v) // Fase 194
    );
  }
  return out;
}

// ── Fase 194: carga del reporte de no conectadas ──────────────────────────
// Filas [fecha, agente] (llamadasNoConectadasParseFilas): el telefono nunca
// llega aqui. Una fila por llamada, sin quitar repetidas. Reemplaza por
// periodo (primera a ultima fecha del archivo), igual que las demas.
const CAMPOS_FILA_NO_CONECTADAS = ['fecha', 'agente'];

function _ncObjetos(filas) {
  return filas.map((arr) => ({ fecha: arr[0], agente: arr[1] }));
}

function impactoLlamadasNoConectadas(db, { campana, filas }) {
  const filasObj = _ncObjetos(filas);
  const { desde, hasta } = rangoFechas(filasObj);
  const existentes = db
    .prepare('SELECT COUNT(*) AS n FROM llamadas_no_conectadas WHERE campana = ? AND fecha >= ? AND fecha <= ?')
    .get(campana, desde, hasta).n;
  const alias = aplicarAliasAFilas(db, campana, filasObj, 'agente');
  return { desde, hasta, filasExistentes: existentes, filasNuevas: filasObj.length,
    filasUnificadasPorAlias: alias.filasUnificadas, asesoresUnificadosPorAlias: alias.asesoresUnificados };
}

function cargarLlamadasNoConectadas(db, { campana, archivoNombre, cargadoPorNombre, filas }) {
  const ts = nowStr();
  let filasObj = _ncObjetos(filas);
  filasObj = aplicarAliasAFilas(db, campana, filasObj, 'agente').filas;
  const { desde, hasta } = rangoFechas(filasObj);
  const del = db.prepare('DELETE FROM llamadas_no_conectadas WHERE campana = ? AND fecha >= ? AND fecha <= ?');
  const insert = db.prepare(
    `INSERT INTO llamadas_no_conectadas (campana, fecha, agente, archivoNombre, cargadoPorNombre, createdAt)
     VALUES (@campana, @fecha, @agente, @archivoNombre, @cargadoPorNombre, @createdAt)`
  );
  let borradas = 0;
  db.transaction(() => {
    respaldarAntesDeCambiar(db, 'llamadas_no_conectadas', { campana, desde, hasta, guardadoPorNombre: cargadoPorNombre });
    borradas = del.run(campana, desde, hasta).changes;
    for (const f of filasObj) {
      insert.run({ campana, fecha: f.fecha, agente: f.agente, archivoNombre: archivoNombre || '', cargadoPorNombre: cargadoPorNombre || '-', createdAt: ts });
    }
  })();
  return { insertadas: filasObj.length, borradas, desde, hasta };
}

module.exports = {
  CAMPOS_FILA,
  filaArrayAObjeto,
  impactoLlamadasSalida,
  cargarLlamadasSalida,
  llamadasSalidaResumen,
  llamadasSalidaPorMes,
  llamadasSalidaDetalle,
  llamadasSalidaOpciones,
  mesesConCdr, // Fase 191
  // Fase 194
  CAMPOS_FILA_NO_CONECTADAS,
  mesesConNoConectadas,
  impactoLlamadasNoConectadas,
  cargarLlamadasNoConectadas,
};
