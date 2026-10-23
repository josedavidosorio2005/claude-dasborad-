// whatsapp-tiempos.js — ORLANT, WhatsApp: Nivel de Servicio por rangos de
// minutos (Fase 142, punto 4). Escritura (reemplazo por campaña + rango de
// fechas) y agregacion en SQL -- el dashboard nunca descarga filas crudas.
// El archivo de origen (HistQueue de Wolkvox) no trae telefonos ni nombres,
// y esta tabla tampoco los tiene.
'use strict';
const { respaldarAntesDeCambiar } = require('./cargas-versiones');

function nowStr() {
  const d = new Date();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Orden FIJO del payload -- igual a WPP_TIEMPOS_ORDEN_ARRAY
// (public/js/whatsapp-tiempos-logic.js) y whatsappTiemposFilaArraySchema.
const CAMPOS_FILA = ['skill', 'fecha', 'hora', 'segundos'];

// Mismos cortes que WPP_TIEMPOS_RANGOS (Fase 165: segundos, limite superior
// EXCLUIDO -- <180, <300, <480, <600, resto). Se calculan al consultar, asi
// que valen tambien para lo ya cargado.
const RANGOS = [
  { key: 'r0_3', label: '0 a 3 minutos', menorQue: 180 },
  { key: 'r3_5', label: '3 a 5 minutos', menorQue: 300 },
  { key: 'r5_8', label: '5 a 8 minutos', menorQue: 480 },
  { key: 'r8_10', label: '8 a 10 minutos', menorQue: 600 },
  { key: 'r10', label: '10 minutos en adelante', menorQue: null },
];
const CASE_RANGO = 'CASE ' + RANGOS.filter((r) => r.menorQue !== null)
  .map((r) => `WHEN segundos < ${r.menorQue} THEN '${r.key}'`).join(' ') + " ELSE 'r10' END";

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
    const r = RANGOS.find((x) => x.menorQue === null || f.segundos < x.menorQue);
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
    // Fase 153 (Centro de cargas, PR 2): guarda el/los mes(es) completo(s) antes de cambiarlos (Deshacer 30 dias).
    respaldarAntesDeCambiar(db, 'whatsapp_tiempos', { campana, desde, hasta, guardadoPorNombre: cargadoPorNombre });
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

// Conteos por grupo (rango x grupo) -> [{ grupo, total, rangos:[{key,label,cantidad,pct}] }].
function agruparRangos(filas) {
  const porGrupo = new Map();
  for (const r of filas) {
    if (!porGrupo.has(r.grupo)) porGrupo.set(r.grupo, {});
    porGrupo.get(r.grupo)[r.rango] = r.n;
  }
  return [...porGrupo.entries()].map(([grupo, conteo]) => {
    const total = Object.values(conteo).reduce((a, n) => a + n, 0);
    return {
      grupo, total,
      rangos: RANGOS.map((x) => ({
        key: x.key, label: x.label, cantidad: conteo[x.key] || 0,
        pct: total ? Math.round(((conteo[x.key] || 0) / total) * 1000) / 10 : 0,
      })),
    };
  });
}

// Fase 165 (pedido de Edwin): conteo y % por rango POR COLA (del mes elegido)
// y POR MES (todos los meses, de la cola elegida o de todas).
function whatsappTiemposResumen(db, { campana, mes, skill }) {
  const porSkill = db
    .prepare(`SELECT skill AS grupo, ${CASE_RANGO} AS rango, COUNT(*) AS n FROM whatsapp_tiempos
      WHERE campana = @campana AND substr(fecha,1,7) = @mes GROUP BY grupo, rango ORDER BY grupo`)
    .all({ campana, mes });
  const clausulas = ['campana = @campana'];
  const params = { campana };
  if (skill) { clausulas.push('skill = @skill'); params.skill = skill; }
  const porMes = db
    .prepare(`SELECT substr(fecha,1,7) AS grupo, ${CASE_RANGO} AS rango, COUNT(*) AS n FROM whatsapp_tiempos
      WHERE ${clausulas.join(' AND ')} GROUP BY grupo, rango ORDER BY grupo`)
    .all(params);
  return {
    mes,
    porSkill: agruparRangos(porSkill).map(({ grupo, ...r }) => ({ skill: grupo, ...r })),
    porMes: agruparRangos(porMes).map(({ grupo, ...r }) => ({ mes: grupo, ...r })),
  };
}

module.exports = {
  CAMPOS_FILA,
  RANGOS,
  whatsappTiemposResumen,
  impactoWhatsappTiempos,
  cargarWhatsappTiempos,
  whatsappTiemposOpciones,
  whatsappTiemposRangos,
};
