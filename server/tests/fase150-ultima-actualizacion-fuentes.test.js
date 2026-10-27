// fase150-ultima-actualizacion-fuentes.test.js — Fase 150 (OK del usuario):
// "Ultima actualizacion" tambien cuenta Encuesta, Llamadas Unicas, Llamadas
// de Salida y Tiempos de WhatsApp. Antes la Encuesta del 15/10 de Mobilize
// no movia la fecha (se quedaba en la ultima Tipificacion del 08/10).
// Datos SIEMPRE inventados, en campanas de prueba (nunca ORLANT/MOBILIZE).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { FUENTES, obtenerUltimaActualizacion } = require('../ultima-actualizacion');
const { db } = require('./helpers');

const uid = () => Math.random().toString(36).slice(2, 8);
const tipif = (campana, createdAt) => db.prepare(
  `INSERT INTO tipificaciones (campana, canal, agente, fecha, tipificacion, skill, archivoNombre, cargadoPorNombre, createdAt)
   VALUES (?, 'LLAMADAS', 'A', '2026-10-01', 'T', 'S', '', '-', ?)`
).run(campana, createdAt);
const INSERTS = {
  encuestas: (c, t) => db.prepare(`INSERT INTO encuestas (campana, fecha, q3, createdAt) VALUES (?, '2026-09-30', 1, ?)`).run(c, t),
  llamadas_unicas: (c, t) => db.prepare(`INSERT INTO llamadas_unicas (campana, fecha, tipo, skill, agente, createdAt) VALUES (?, '2026-09-30', 'CONTESTADA', 'S', 'A', ?)`).run(c, t),
  llamadas_salida: (c, t) => db.prepare(`INSERT INTO llamadas_salida (campana, fecha, tipo, agente, createdAt) VALUES (?, '2026-09-30', 'CONECTADA', 'A', ?)`).run(c, t),
  whatsapp_tiempos: (c, t) => db.prepare(`INSERT INTO whatsapp_tiempos (campana, skill, fecha, hora, segundos, createdAt) VALUES (?, 'S', '2026-09-30', 9, 30, ?)`).run(c, t),
};

test('las 4 tablas nuevas estan en FUENTES (14 en total)', () => {
  const tablas = FUENTES.map((f) => f.tabla);
  for (const t of Object.keys(INSERTS)) assert.ok(tablas.includes(t), t);
  assert.equal(FUENTES.length, 18); // Fase 172: + calidad_resumen_asesor; Fase 191: + llamadas_abandonadas; Fase 194: + llamadas_no_conectadas; Fase 196: + flujo_hora
});

for (const tabla of Object.keys(INSERTS)) {
  test(`${tabla}: una carga mas nueva que la Tipificacion mueve la fecha (caso Mobilize: Encuesta del 15/10 vs Tipificacion del 08/10)`, () => {
    const c = 'FASE150_UA_' + tabla.toUpperCase() + '_' + uid();
    tipif(c, '08/10/2026 15:00:00');
    assert.equal(obtenerUltimaActualizacion(db, c).fechaColombia, '08/10/2026 10:00:00');
    INSERTS[tabla](c, '15/10/2026 13:00:00');
    assert.equal(obtenerUltimaActualizacion(db, c).fechaColombia, '15/10/2026 08:00:00');
  });
}

test('caso ORLANT: sin cargas mas nuevas en las 4 tablas, la fecha no cambia', () => {
  const c = 'FASE150_UA_COMO_ORLANT_' + uid();
  tipif(c, '08/10/2026 15:00:00');
  // Una carga VIEJA en una tabla nueva no le gana a la Tipificacion.
  INSERTS.whatsapp_tiempos(c, '01/09/2026 10:00:00');
  assert.equal(obtenerUltimaActualizacion(db, c).fechaColombia, '08/10/2026 10:00:00');
  // Una carga nueva de OTRA campana tampoco.
  INSERTS.encuestas('FASE150_UA_OTRA_' + uid(), '15/10/2026 13:00:00');
  assert.equal(obtenerUltimaActualizacion(db, c).fechaColombia, '08/10/2026 10:00:00');
});
