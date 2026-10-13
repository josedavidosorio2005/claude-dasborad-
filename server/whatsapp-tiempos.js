// whatsapp-tiempos.js — ORLANT, WhatsApp: Nivel de Servicio por rangos de
// minutos (Fase 142, punto 4). Escritura (reemplazo por campaña + rango de
// fechas) y agregacion en SQL -- el dashboard nunca descarga filas crudas.
// El archivo de origen (HistQueue de Wolkvox) no trae telefonos ni nombres,
// y esta tabla tampoco los tiene.
'use strict';

function nowStr() {
  const d = new Date();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Orden FIJO del payload -- igual a WPP_TIEMPOS_ORDEN_ARRAY
// (public/js/whatsapp-tiempos-logic.js) y whatsappTiemposFilaArraySchema.
const CAMPOS_FILA = ['skill', 'fecha', 'hora', 'segundos'];

// Mismos cortes que WPP_TIEMPOS_RANGOS (segundos, limite superior incluido).
const RANGOS = [
  { key: 'r0_3', label: '0-3 minutos', hasta: 180 },
  { key: 'r3_5', label: '3-5 minutos', hasta: 300 },
  { key: 'r5_8', label: '5-8 minutos', hasta: 480 },
  { key: 'r8_10', label: '8-10 minutos', hasta: 600 },
  { key: 'r10', label: '10 minutos en adelante', hasta: null },
];
const CASE_RANGO = 'CASE ' + RANGOS.filter((r) => r.hasta !== null)
  .map((r) => `WHEN segundos <= ${r.hasta} THEN '${r.key}'`).join(' ') + " ELSE 'r10' END";

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

function contarPorRango(filasObj) {
  const out = {};
  RANGOS.forEach((r) => { out[r.key] = 0; });
  for (const f of filasObj) {
    const r = RANGOS.find((x) => x.hasta === null || f.segundos <= x.hasta);
    out[r.key]++;
  }
  return out;
}

// Lo que YA existe en el rango que este archivo reemplazaria (no escribe).
function impactoWhatsappTiempos(db, { campana, filas }) {
  const filasObj = filas.map(filaArrayAObjeto);
  const { desde, hasta } = rangoFechas(filasObj);
  const existentes = db
    .prepare('SELECT COUNT(*) AS n FROM whatsapp_tiempos WHERE campana = ? AND fecha >= ? AND fecha <= ?')
    .get(campana, desde, hasta).n;
  return {
    desde, hasta, filasExistentes: existentes, filasNuevas: filasObj.length,
    porRango: contarPorRango(filasObj), dias: new Set(filasObj.map((f) => f.fecha)).size,
  };
}

// Reemplaza por PERIODO (campaña + primera..ultima fecha del archivo) en una
// sola transaccion. Cargar septiembre nunca borra agosto.
function cargarWhatsappTiempos(db, { campana, archivoNombre, cargadoPorNombre, filas }) {
  const ts = nowStr();
  const filasObj = filas.map(filaArrayAObjeto);
  const { desde, hasta } = rangoFechas(filasObj);
  const del = db.prepare('DELETE FROM whatsapp_tiempos WHERE campana = ? AND fecha >= ? AND fecha <= ?');
  const insert = db.prepare(
    `INSERT INTO whatsapp_tiempos (campana, skill, fecha, hora, segundos, archivoNombre, cargadoPorNombre, createdAt)
     VALUES (@campana, @skill, @fecha, @hora, @segundos, @archivoNombre, @cargadoPorNombre, @createdAt)`
  );
  let borradas = 0;
  db.transaction(() => {
    borradas = del.run(campana, desde, hasta).changes;
    for (const f of filasObj) {
      insert.run({
        campana, skill: f.skill, fecha: f.fecha, hora: f.hora, segundos: f.segundos,
        archivoNombre: archivoNombre || '', cargadoPorNombre: cargadoPorNombre || '-', createdAt: ts,
      });
    }
  })();
  return { insertadas: filasObj.length, borradas, desde, hasta };
}

// Meses con datos y colas (para los filtros de la vista).
function whatsappTiemposOpciones(db, campana) {
  return {
    meses: db.prepare('SELECT DISTINCT substr(fecha,1,7) AS v FROM whatsapp_tiempos WHERE campana = ? ORDER BY v').all(campana).map((r) => r.v),
    skills: db.prepare('SELECT DISTINCT skill AS v FROM whatsapp_tiempos WHERE campana = ? ORDER BY v').all(campana).map((r) => r.v),
  };
}

// Las 5 franjas de UN mes (y cola opcional): cantidad y % sobre el total.
function whatsappTiemposRangos(db, { campana, mes, skill }) {
  const clausulas = ['campana = @campana', 'substr(fecha,1,7) = @mes'];
  const params = { campana, mes };
  if (skill) { clausulas.push('skill = @skill'); params.skill = skill; }
  const filas = db
    .prepare(`SELECT ${CASE_RANGO} AS rango, COUNT(*) AS n FROM whatsapp_tiempos WHERE ${clausulas.join(' AND ')} GROUP BY rango`)
    .all(params);
  const conteo = {};
  filas.forEach((r) => { conteo[r.rango] = r.n; });
  const total = filas.reduce((a, r) => a + r.n, 0);
  const dias = db.prepare(`SELECT COUNT(DISTINCT fecha) AS n FROM whatsapp_tiempos WHERE ${clausulas.join(' AND ')}`).get(params).n;
  return {
    mes, total, dias,
    rangos: RANGOS.map((r) => ({
      key: r.key, label: r.label, cantidad: conteo[r.key] || 0,
      pct: total ? Math.round(((conteo[r.key] || 0) / total) * 1000) / 10 : 0,
    })),
  };
}

module.exports = {
  CAMPOS_FILA,
  RANGOS,
  impactoWhatsappTiempos,
  cargarWhatsappTiempos,
  whatsappTiemposOpciones,
  whatsappTiemposRangos,
};
