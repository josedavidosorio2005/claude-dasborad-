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

// Tarjetas: total / no conectadas / conectadas, respetando los filtros.
function llamadasSalidaResumen(db, q) {
  const { where, params } = llamadasSalidaWhereClausulas(q);
  return normSumas(db.prepare(`SELECT ${SUMAS} FROM llamadas_salida WHERE ${where}`).get(params));
}

// Barras por mes ('AAAA-MM'), ya agregado en SQL.
function llamadasSalidaPorMes(db, q) {
  const { where, params } = llamadasSalidaWhereClausulas(q);
  return db
    .prepare(`SELECT substr(fecha,1,7) AS periodo, ${SUMAS} FROM llamadas_salida WHERE ${where} GROUP BY periodo ORDER BY periodo`)
    .all(params)
    .map((r) => Object.assign({ periodo: r.periodo }, normSumas(r)));
}

// Detalle por asesor y por dia (la ruta lo limita a roles internos).
function llamadasSalidaDetalle(db, q) {
  const { where, params } = llamadasSalidaWhereClausulas(q);
  const porAsesor = db
    .prepare(`SELECT agente, ${SUMAS} FROM llamadas_salida WHERE ${where} GROUP BY agente ORDER BY total DESC, agente`)
    .all(params)
    .map((r) => Object.assign({ agente: r.agente }, normSumas(r)));
  const porDia = db
    .prepare(`SELECT fecha, ${SUMAS} FROM llamadas_salida WHERE ${where} GROUP BY fecha ORDER BY fecha`)
    .all(params)
    .map((r) => Object.assign({ fecha: r.fecha }, normSumas(r)));
  return { porAsesor, porDia };
}

// Meses con datos (para el estado vacio) y, SOLO si `incluirAgentes`, la
// lista de asesores para el filtro (la ruta lo decide por rol).
function llamadasSalidaOpciones(db, campana, { incluirAgentes } = {}) {
  const out = {
    meses: db.prepare('SELECT DISTINCT substr(fecha,1,7) AS v FROM llamadas_salida WHERE campana = ? ORDER BY v').all(campana).map((r) => r.v),
  };
  if (incluirAgentes) {
    out.agentes = db.prepare('SELECT DISTINCT agente AS v FROM llamadas_salida WHERE campana = ? ORDER BY v').all(campana).map((r) => r.v);
  }
  return out;
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
};
