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

// Tarjetas-resumen: contestadas/abandonadas/total (suma) que respetan los
// filtros actuales (fecha/skill/asesor).
function llamadasUnicasResumen(db, q) {
  const { where, params } = llamadasUnicasWhereClausulas(q);
  const fila = db
    .prepare(`SELECT
        SUM(CASE WHEN tipo='CONTESTADA' THEN 1 ELSE 0 END) AS contestadas,
        SUM(CASE WHEN tipo='ABANDONADA' THEN 1 ELSE 0 END) AS abandonadas,
        COUNT(*) AS total
      FROM llamadas_unicas WHERE ${where}`)
    .get(params);
  return { contestadas: fila.contestadas || 0, abandonadas: fila.abandonadas || 0, total: fila.total || 0 };
}

// Grafica de barras por mes: 1 fila por 'AAAA-MM' con total/contestadas/
// abandonadas -- ya agregado en SQL, el navegador nunca ve filas crudas.
function llamadasUnicasPorMes(db, q) {
  const { where, params } = llamadasUnicasWhereClausulas(q);
  return db
    .prepare(`SELECT substr(fecha,1,7) AS periodo,
        SUM(CASE WHEN tipo='CONTESTADA' THEN 1 ELSE 0 END) AS contestadas,
        SUM(CASE WHEN tipo='ABANDONADA' THEN 1 ELSE 0 END) AS abandonadas,
        COUNT(*) AS total
      FROM llamadas_unicas WHERE ${where} GROUP BY periodo ORDER BY periodo`)
    .all(params);
}

// Valores distintos para los filtros (skill incluye "Abandonadas" si hay
// alguna fila de ese tipo) + meses con datos (para que el panel sepa si
// mostrar el estado vacio).
function llamadasUnicasOpciones(db, campana) {
  const distintos = (columna) =>
    db.prepare(`SELECT DISTINCT ${columna} AS v FROM llamadas_unicas WHERE campana = ? ORDER BY v`).all(campana).map((r) => r.v);
  return {
    meses: db.prepare('SELECT DISTINCT substr(fecha,1,7) AS v FROM llamadas_unicas WHERE campana = ? ORDER BY v').all(campana).map((r) => r.v),
    agentes: distintos('agente'),
    skills: distintos('skill'),
  };
}

module.exports = {
  CAMPOS_FILA,
  filaArrayAObjeto,
  impactoLlamadasUnicas,
  cargarLlamadasUnicas,
  llamadasUnicasResumen,
  llamadasUnicasPorMes,
  llamadasUnicasOpciones,
};
