// encuestas.js — Mobilize, Encuesta de satisfaccion post-llamada (Fase 147,
// Parte B). Escritura (reemplazo por campaña + rango de fechas, una sola
// transaccion) y agregacion en SQL -- el dashboard nunca descarga filas
// crudas, salvo la lista de comentarios con texto. El archivo de origen
// (Wolkvox, hoja HistIVR) no trae telefonos y esta tabla tampoco los tiene.
'use strict';
const { respaldarAntesDeCambiar } = require('./cargas-versiones');

function nowStr() {
  const d = new Date();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Orden FIJO del payload -- igual a ENCUESTA_ORDEN_ARRAY
// (public/js/encuesta-logic.js) y encuestaFilaArraySchema (validation.js).
const CAMPOS_FILA = ['fecha', 'agente', 'skill', 'q1', 'q2', 'q3', 'q4', 'comentario', 'connId'];

// Mismos rangos que ENCUESTA_PREGUNTAS (encuesta-logic.js).
const PREGUNTAS = [
  { key: 'q1', min: 0, max: 10 },
  { key: 'q2', min: 1, max: 5 },
  { key: 'q3', min: 1, max: 2 },
  { key: 'q4', min: 1, max: 5 },
];

const FCR_BASES = ['total', 'respondieron'];

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

function contar(filasObj) {
  const out = { total: filasObj.length, comentarios: 0, preguntas: {} };
  for (const p of PREGUNTAS) {
    const valores = {};
    for (let v = p.min; v <= p.max; v++) valores[v] = 0;
    out.preguntas[p.key] = { sinRespuesta: 0, valores };
  }
  for (const f of filasObj) {
    for (const p of PREGUNTAS) {
      if (f[p.key] === null || f[p.key] === undefined) out.preguntas[p.key].sinRespuesta++;
      else out.preguntas[p.key].valores[f[p.key]]++;
    }
    if (f.comentario) out.comentarios++;
  }
  return out;
}

// Lo que YA existe en el rango que este archivo reemplazaria (no escribe).
function impactoEncuestas(db, { campana, filas }) {
  const filasObj = filas.map(filaArrayAObjeto);
  const { desde, hasta } = rangoFechas(filasObj);
  const existentes = db
    .prepare('SELECT COUNT(*) AS n FROM encuestas WHERE campana = ? AND fecha >= ? AND fecha <= ?')
    .get(campana, desde, hasta).n;
  return {
    desde, hasta, filasExistentes: existentes, filasNuevas: filasObj.length,
    dias: new Set(filasObj.map((f) => f.fecha)).size, conteos: contar(filasObj),
  };
}

// Reemplaza por PERIODO (campaña + primera..ultima fecha del archivo) en una
// sola transaccion: volver a subir una base corregida no duplica, y cargar
// octubre nunca borra septiembre.
function cargarEncuestas(db, { campana, archivoNombre, cargadoPorNombre, filas }) {
  const ts = nowStr();
  const filasObj = filas.map(filaArrayAObjeto);
  const { desde, hasta } = rangoFechas(filasObj);
  const del = db.prepare('DELETE FROM encuestas WHERE campana = ? AND fecha >= ? AND fecha <= ?');
  const insert = db.prepare(
    `INSERT INTO encuestas (campana, fecha, agente, skill, q1, q2, q3, q4, comentario, connId, archivoNombre, cargadoPorNombre, createdAt)
     VALUES (@campana, @fecha, @agente, @skill, @q1, @q2, @q3, @q4, @comentario, @connId, @archivoNombre, @cargadoPorNombre, @createdAt)`
  );
  let borradas = 0;
  db.transaction(() => {
    // Fase 153 (Centro de cargas, PR 2): guarda el/los mes(es) completo(s) antes de cambiarlos (Deshacer 30 dias).
    respaldarAntesDeCambiar(db, 'encuestas', { campana, desde, hasta, guardadoPorNombre: cargadoPorNombre });
    borradas = del.run(campana, desde, hasta).changes;
    for (const f of filasObj) {
      insert.run({
        campana, fecha: f.fecha, agente: f.agente || '', skill: f.skill || '',
        q1: f.q1, q2: f.q2, q3: f.q3, q4: f.q4, comentario: f.comentario || '', connId: f.connId || '',
        archivoNombre: archivoNombre || '', cargadoPorNombre: cargadoPorNombre || '-', createdAt: ts,
      });
    }
  })();
  return { insertadas: filasObj.length, borradas, desde, hasta };
}

function whereClausulas(q) {
  const clausulas = ['campana = @campana'];
  const params = { campana: q.campana };
  if (q.desde) { clausulas.push('fecha >= @desde'); params.desde = q.desde; }
  if (q.hasta) { clausulas.push('fecha <= @hasta'); params.hasta = q.hasta; }
  if (q.skill) { clausulas.push('skill = @skill'); params.skill = q.skill; }
  if (q.agente) { clausulas.push('agente = @agente'); params.agente = q.agente; }
  return { where: clausulas.join(' AND '), params };
}

// Rango con datos, skills y (si el rol puede verlos) asesores.
function encuestasOpciones(db, campana, { incluirAgentes }) {
  const r = db.prepare('SELECT MIN(fecha) AS desde, MAX(fecha) AS hasta, COUNT(*) AS n FROM encuestas WHERE campana = ?').get(campana);
  const out = {
    total: r.n, desde: r.desde, hasta: r.hasta,
    meses: db.prepare('SELECT DISTINCT substr(fecha,1,7) AS v FROM encuestas WHERE campana = ? ORDER BY v').all(campana).map((x) => x.v),
    skills: db.prepare("SELECT DISTINCT skill AS v FROM encuestas WHERE campana = ? AND skill <> '' ORDER BY v").all(campana).map((x) => x.v),
  };
  if (incluirAgentes) {
    out.agentes = db.prepare("SELECT DISTINCT agente AS v FROM encuestas WHERE campana = ? AND agente <> '' ORDER BY v").all(campana).map((x) => x.v);
  }
  return out;
}

// Por pregunta: cantidad por cada valor posible (todos, aunque sean 0),
// cuantos respondieron y cuantos no.
function encuestasResumen(db, q) {
  const { where, params } = whereClausulas(q);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM encuestas WHERE ${where}`).get(params).n;
  const preguntas = PREGUNTAS.map((p) => {
    const filas = db.prepare(`SELECT ${p.key} AS v, COUNT(*) AS n FROM encuestas WHERE ${where} AND ${p.key} IS NOT NULL GROUP BY ${p.key}`).all(params);
    const conteo = {};
    filas.forEach((r) => { conteo[r.v] = r.n; });
    const valores = [];
    for (let v = p.min; v <= p.max; v++) valores.push({ valor: v, cantidad: conteo[v] || 0 });
    const respondieron = valores.reduce((a, x) => a + x.cantidad, 0);
    return { key: p.key, respondieron, sinRespuesta: total - respondieron, valores };
  });
  return { total, preguntas };
}

// Comentarios con texto (lo mas reciente primero). Sin `agente` si el rol no
// puede ver nombres de asesor.
function encuestasComentarios(db, q, { incluirAgentes }) {
  const { where, params } = whereClausulas(q);
  // Fase 184: connId = ID de la llamada ('' si el archivo no lo traia).
  const cols = incluirAgentes ? 'fecha, connId, skill, agente, comentario' : 'fecha, connId, skill, comentario';
  return db.prepare(`SELECT ${cols} FROM encuestas WHERE ${where} AND comentario <> '' ORDER BY fecha DESC, id DESC LIMIT 1000`).all(params);
}

// FCR por mes (Parte C): encuestas con q3 = 1 sobre la base elegida.
function encuestasFcrPorMes(db, q) {
  const { where, params } = whereClausulas(q);
  const base = FCR_BASES.includes(q.base) ? q.base : 'total';
  return db.prepare(
    `SELECT substr(fecha,1,7) AS periodo, COUNT(*) AS total,
            SUM(CASE WHEN q3 IS NOT NULL THEN 1 ELSE 0 END) AS respondieron,
            SUM(CASE WHEN q3 = 1 THEN 1 ELSE 0 END) AS si
       FROM encuestas WHERE ${where} GROUP BY periodo ORDER BY periodo`
  ).all(params).map((r) => {
    const den = base === 'respondieron' ? r.respondieron : r.total;
    return { periodo: r.periodo, base, si: r.si, total: r.total, respondieron: r.respondieron, den, pct: den > 0 ? Math.round((r.si / den) * 1000) / 10 : null };
  });
}

module.exports = {
  CAMPOS_FILA,
  PREGUNTAS,
  FCR_BASES,
  impactoEncuestas,
  cargarEncuestas,
  encuestasOpciones,
  encuestasResumen,
  encuestasComentarios,
  encuestasFcrPorMes,
};
