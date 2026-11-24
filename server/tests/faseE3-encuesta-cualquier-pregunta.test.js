// faseE3-encuesta-cualquier-pregunta.test.js — Pedido de Edwin (24/11): una encuesta de Mobilize sale para
// monitorear si contestó mal CUALQUIER pregunta (P1 a P4), no solo la 1. Se comprueba por los dos caminos que
// llenan la Encuesta del MOBILIZE real: el módulo automático (Wolkvox diagram_4, con CONN_ID desde la Fase A33)
// y la carga manual de antes (el archivo HistIVR). Wolkvox FALSO; IDs, nombres y respuestas INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('./helpers');
const M = require('../wolkvox-modulos');
const E = require('../encuesta-monitoreo');
const EN = require('../../public/js/encuesta-logic.js');
const { cargarEncuestas } = require('../encuestas');

const REAL = 'MOBILIZE';
const ENV = { NODE_ENV: 'test', WOLKVOX_MOBILIZE_TOKEN: 'TOKEN-FALSO-E3-no-es-real-0123456789', WOLKVOX_MOBILIZE_SERVIDOR: 'servidorfalsoe3' };
const AHORA = new Date('2026-11-05T12:30:00Z');
// Respuestas «bien» en todo; cada caso cambia UNA sola pregunta. La API manda los números como texto.
const BIEN = { q01: '9', q02: '5', q03: '1', q04: '5' };
const CASOS = [
  ['E3-SOLO-P1', '2026-11-02', { q01: '4' }, 'q1', 4],
  ['E3-SOLO-P2', '2026-11-02', { q02: '2' }, 'q2', 2],
  ['E3-SOLO-P3', '2026-11-03', { q03: '2' }, 'q3', 2], // P3 = «No»
  ['E3-SOLO-P4', '2026-11-03', { q04: '1' }, 'q4', 1],
  ['E3-BIEN', '2026-11-04', {}, null, null],
  ['E3-P2-SIN-RESPUESTA', '2026-11-04', { q02: '-' }, null, null], // sin respuesta no es «mal calificada»
];
function enc(conn, date, cambio) {
  return Object.assign({
    agent_dni: 'DNI-INVENTADO-E3', agent_id: '2044', agent_name: 'ASESORA INVENTADA E3', ani: '3000000444', conn_id: conn, customer_id: 'CC-INVENTADA-E3',
    date, feeling: 'neutral', q05: '-', q06: '-', q07: '-', q08: '-', q09: '-', q10: '-', result: 'ok', skill_id: '5',
    skill_name: 'SKILL INVENTADA E3', time: '10:15:00', type_interaction: 'inbound', voice_message: '', voice_message_duration: '0',
  }, BIEN, cambio);
}
function falso(data) {
  return (url) => Promise.resolve({ status: 200, json: () => Promise.resolve({ code: 200, msg: data.length + ' records were found', data }) });
}
const resumen = (l) => l.filas.map((f) => [f.connId, f.fallas.map((x) => x.pregunta + '=' + x.valor).join(',')]).sort();
const ESPERADO = CASOS.filter((c) => c[3]).map((c) => [c[0], c[3] + '=' + c[4]]).sort();

test('E3: con la API del real, sale para monitorear la que falló SOLO P2, SOLO P3 o SOLO P4 (no solo P1)', async () => {
  const r = await M.correrModulo('encuesta', {
    db, env: ENV, ahora: AHORA, fetchImpl: falso(CASOS.map((c) => enc(c[0], c[1], c[2]))), franja: 'e3-real', destino: 'real',
  });
  assert.equal(r.estado, 'ok', r.detalle);
  const l = E.listar(db, { campana: REAL, estado: 'pendientes' }, null);
  assert.deepEqual(l.conteo, { pendientes: 4, resueltas: 0, sinId: 0 }, JSON.stringify(l.conteo));
  assert.deepEqual(resumen(l), ESPERADO);
  // El botón «Monitoreo» de cada pregunta trae la suya.
  for (const [conn, , , q] of CASOS.filter((c) => c[3])) {
    const porPregunta = E.listar(db, { campana: REAL, estado: 'todas', pregunta: q }, null).filas.map((f) => f.connId);
    assert.deepEqual(porPregunta, [conn], q);
  }
  assert.equal(E.contarPendientes(db, REAL), 4);
});

test('E3: la carga manual de antes (archivo HistIVR) da exactamente la misma lista que la API', () => {
  const cab = ['AGENT_NAME', 'SKILL_NAME', 'DATE', 'Q01', 'Q02', 'Q03', 'Q04', 'CONN_ID'];
  const hoja = [cab].concat(CASOS.map((c) => {
    const e = enc(c[0], c[1], c[2]);
    return [e.agent_name, e.skill_name, e.date + ' ' + e.time, e.q01, e.q02, e.q03, e.q04, "'" + c[0]]; // el archivo trae el ID con comilla
  }));
  const p = EN.encuestaParseFilas(hoja);
  assert.ok(!p.error, p.error);
  cargarEncuestas(db, { campana: REAL, archivoNombre: 'HistIVR inventado E3', cargadoPorNombre: 'x', filas: p.filas, desde: '2026-11-01', hasta: '2026-11-30' });
  const l = E.listar(db, { campana: REAL, estado: 'pendientes' }, null);
  assert.deepEqual(l.conteo, { pendientes: 4, resueltas: 0, sinId: 0 });
  assert.deepEqual(resumen(l).map(([id, f]) => [E.claveId(id), f]).sort(), ESPERADO);
});
