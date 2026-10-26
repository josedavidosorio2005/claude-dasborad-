// clasificacion-asesores.js — Fase 186 (pedido de Edwin, 26/10, solo ORLANT).
// La salida de Tipificacion (llamadas: skill "-" del HistCDR; WhatsApp:
// SKILL_ID 0 del HistChat) se reparte entre Linea General y Linea 3P segun
// el ASESOR que la hizo (AGENT_NAME). La clasificacion es por cliente, sin
// mes (tabla asesor_clasificacion); la edita un administrador desde
// Tipificacion. Un asesor sin clasificar suma a "Sin clasificar": nunca se
// descarta, asi General + 3P + Sin clasificar = salida del canal.
// Aparte de la linea por mes de la pestaña de salida (Fase 170, asesor_linea),
// que no cambia.
'use strict';

const { condSalidaCanalSql, tipificacionesWhereClausulas } = require('./tipificaciones');

const LINEAS_CLASIFICACION = ['GENERAL', '3P'];

// Asesores de los CDR cargados del cliente (los 2 canales, todos los meses),
// mas los ya clasificados que hoy no tengan filas (no se pierden al guardar).
// [{ agente, linea|null, salidaLlamadas, salidaWpp }], por nombre.
function listarClasificacion(db, campana) {
  const lineas = {};
  db.prepare('SELECT agente, linea FROM asesor_clasificacion WHERE campana = ?').all(campana)
    .forEach((f) => { lineas[f.agente] = f.linea; });
  const filas = db.prepare(`
    SELECT agente,
      SUM(CASE WHEN canal = 'LLAMADAS' AND ${condSalidaCanalSql(campana, 'LLAMADAS')} THEN 1 ELSE 0 END) AS salidaLlamadas,
      SUM(CASE WHEN canal = 'WHATSAPP' AND ${condSalidaCanalSql(campana, 'WHATSAPP')} THEN 1 ELSE 0 END) AS salidaWpp
    FROM tipificaciones WHERE campana = ? GROUP BY agente`).all(campana);
  const out = filas.map((f) => ({ agente: f.agente, linea: lineas[f.agente] || null, salidaLlamadas: f.salidaLlamadas, salidaWpp: f.salidaWpp }));
  const vistos = new Set(out.map((a) => a.agente));
  Object.keys(lineas).filter((a) => !vistos.has(a))
    .forEach((agente) => out.push({ agente, linea: lineas[agente], salidaLlamadas: 0, salidaWpp: 0 }));
  return out.sort((a, b) => a.agente.localeCompare(b.agente, 'es'));
}

// Reemplaza la clasificacion completa del cliente (una transaccion). linea
// null = sin clasificar (no se guarda fila).
function guardarClasificacion(db, { campana, asignaciones, guardadoPorNombre }) {
  const ahora = new Date().toISOString();
  const del = db.prepare('DELETE FROM asesor_clasificacion WHERE campana = ?');
  const ins = db.prepare('INSERT INTO asesor_clasificacion (campana, agente, linea, guardadoPorNombre, updatedAt) VALUES (?, ?, ?, ?, ?)');
  let general = 0;
  let p3 = 0;
  db.transaction(() => {
    del.run(campana);
    for (const a of asignaciones) {
      if (!a.linea) continue;
      ins.run(campana, a.agente, a.linea, guardadoPorNombre || '-', ahora);
      if (a.linea === '3P') p3++; else general++;
    }
  })();
  return { general, p3, sinClasificar: asignaciones.length - general - p3 };
}

// Tarjetas y torta de "Salida por linea" de un canal, con los mismos filtros
// de la mitad (mes/rango/agente/skill) y SIN el filtro de linea: { total,
// salida, general, p3, sinClasificar } -- total = todos los registros del
// canal (no cambia con la clasificacion).
function salidaPorLinea(db, q) {
  const { where, params } = tipificacionesWhereClausulas({ ...q, linea: undefined, tipoInteraccion: undefined });
  const r = db.prepare(`
    SELECT COUNT(*) AS total,
      COALESCE(SUM(esSalida), 0) AS salida,
      COALESCE(SUM(CASE WHEN esSalida = 1 AND lin = 'GENERAL' THEN 1 ELSE 0 END), 0) AS general,
      COALESCE(SUM(CASE WHEN esSalida = 1 AND lin = '3P' THEN 1 ELSE 0 END), 0) AS p3,
      COALESCE(SUM(CASE WHEN esSalida = 1 AND lin IS NULL THEN 1 ELSE 0 END), 0) AS sinClasificar
    FROM (
      SELECT CASE WHEN ${condSalidaCanalSql(q.campana, q.canal)} THEN 1 ELSE 0 END AS esSalida,
        (SELECT c.linea FROM asesor_clasificacion c WHERE c.campana = tipificaciones.campana AND c.agente = tipificaciones.agente) AS lin
      FROM tipificaciones WHERE ${where}
    )`).get(params);
  return { canal: q.canal, total: r.total, salida: r.salida, general: r.general, p3: r.p3, sinClasificar: r.sinClasificar };
}

module.exports = { LINEAS_CLASIFICACION, listarClasificacion, guardarClasificacion, salidaPorLinea };
