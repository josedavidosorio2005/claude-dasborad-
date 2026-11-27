// faseA11-wolkvox-encuesta.test.js — llenar la réplica con la API, paso 3: diagram_4 (HistIVR) → Encuesta.
// Solo la réplica; nunca se guardan teléfono, documento, cliente, comentario ni CONN_ID. Wolkvox FALSO;
// todos los datos son INVENTADOS (centinelas que no deben quedar guardados).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('./helpers');
const M = require('../wolkvox-modulos');

const R = 'MOBILIZE'; // Fase W10: antes la réplica «MOBILIZE PRUEBAS API» (borrada); ahora el destino real
const ENV = { NODE_ENV: 'test', WOLKVOX_MOBILIZE_TOKEN: 'TOKEN-FALSO-A11-no-es-real-0123456789', WOLKVOX_MOBILIZE_SERVIDOR: 'servidorfalsoa11' };
const AHORA = new Date('2026-11-04T12:30:00Z');
const ANI = '3000000111', DNI = 'DNI-INVENTADO-111', CLIENTE = 'CC-INVENTADA-111', COMENTARIO = 'comentario inventado secreto 111', CONN = 'CONN-INVENTADO-111';
function enc(date, time, extra) {
  return {
    agent_dni: DNI, agent_id: '2001', agent_name: 'ASESORA INVENTADA A11', ani: ANI, conn_id: CONN, customer_id: CLIENTE, date, feeling: 'neutral',
    q01: '9', q02: '5', q03: '1', q04: '4', q05: '-', q06: '-', q07: '-', q08: '-', q09: '-', q10: '-', result: 'ok', skill_id: '5',
    skill_name: 'SKILL INVENTADA A11', time, type_interaction: 'inbound', voice_message: COMENTARIO, voice_message_duration: '12', ...extra,
  };
}
const DATA = [enc('2026-11-02', '08:15:00'), enc('2026-11-03', '10:20:00', { q01: '3', q03: '2' })];
function falso(data) {
  const f = { urls: [] };
  f.fetch = (url) => { f.urls.push(url); return Promise.resolve({ status: 200, json: () => Promise.resolve({ code: 200, msg: data.length + ' records were found', data }) }); };
  return f;
}
const filasRep = () => db.prepare('SELECT * FROM encuestas WHERE campana = ? ORDER BY fecha').all(R);

test('hoja de la encuesta: solo asesor, skill, fecha y Q01–Q04', () => {
  const hoja = M.hojaEncuesta(DATA);
  assert.deepEqual(hoja[0], ['AGENT_NAME', 'SKILL_NAME', 'DATE', 'Q01', 'Q02', 'Q03', 'Q04']);
  assert.equal(hoja[1][2], '2026-11-02 08:15:00');
  const txt = JSON.stringify(hoja);
  for (const x of [ANI, DNI, CLIENTE, COMENTARIO, CONN]) assert.ok(!txt.includes(x), x);
});

test('corrida: una consulta por mes, reemplaza el mes de la réplica con respaldo, sin datos sensibles; MOBILIZE real intacto', async () => {
  const ins = db.prepare("INSERT INTO encuestas (campana, fecha, agente, skill, q1, q2, q3, q4, comentario, connId, hora, telefono, archivoNombre, cargadoPorNombre, createdAt) VALUES (?, ?, 'X', 'S', 1, 1, 1, 1, '', '', '', '', 'x', 'x', 'x')");
  ins.run(R, '2026-11-25'); // vieja del mes: sale (mes completo)
  ins.run('ORLANT', '2026-11-02');
  const versiones = db.prepare('SELECT COUNT(*) n FROM cargas_versiones WHERE campana = ?').get(R).n;
  const f = falso(DATA);
  const r = await M.correrModulo('encuesta', { db, destino: 'real', env: ENV, ahora: AHORA, fetchImpl: f.fetch, franja: 'a11-1' });
  assert.equal(r.estado, 'ok', r.detalle);
  assert.equal(f.urls.length, 1);
  assert.deepEqual(Object.fromEntries(new URL(f.urls[0]).searchParams), { api: 'diagram_4', date_ini: '20261101000000', date_end: '20261103235959' });
  const filas = filasRep();
  assert.deepEqual(filas.map((x) => [x.fecha, x.hora, x.q1, x.q3]), [['2026-11-02', '08:15', 9, 1], ['2026-11-03', '10:20', 3, 2]]);
  const txt = JSON.stringify(filas);
  for (const x of [ANI, DNI, CLIENTE, COMENTARIO]) // Fase W10: el real sí guarda el CONN_ID (Fase A33)
  assert.ok(!txt.includes(x), 'se guardó ' + x);
  assert.ok(db.prepare('SELECT COUNT(*) n FROM cargas_versiones WHERE campana = ?').get(R).n > versiones, 'respaldo');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM encuestas WHERE campana = 'ORLANT' AND fecha = '2026-11-02'").get().n, 1);
});

test('el módulo está en la lista y arranca apagado (solo corre si está en WOLKVOX_REAL_MODULOS)', () => {
  assert.equal(M.MODULOS.encuesta.api, 'diagram_4');
  assert.deepEqual(M.modulosDe('flujo_hora,cdr'), ['flujo_hora', 'cdr']);
  assert.deepEqual(M.modulosDe('flujo_hora,cdr,encuesta'), ['flujo_hora', 'cdr', 'encuesta']);
});
