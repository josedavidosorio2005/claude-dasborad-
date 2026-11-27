// faseA15-wolkvox-no-conectadas.test.js — llenar la réplica con la API: cdr_5 → Llamadas de salida, no
// conectadas. Solo la réplica; nunca se guardan teléfono, destino, cliente ni CONN_ID. Wolkvox FALSO;
// datos INVENTADOS (centinelas que no deben quedar guardados).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('./helpers');
const M = require('../wolkvox-modulos');

const R = 'MOBILIZE'; // Fase W10: antes la réplica «MOBILIZE PRUEBAS API» (borrada); ahora el destino real
const ENV = { NODE_ENV: 'test', WOLKVOX_MOBILIZE_TOKEN: 'TOKEN-FALSO-A15-no-es-real-0123456789', WOLKVOX_MOBILIZE_SERVIDOR: 'servidorfalsoa15' };
const AHORA = new Date('2026-11-04T12:30:00Z');
const TEL = '3000000155', DEST = '3000000156', CLIENTE = 'CC-INVENTADA-155', CONN = 'CONN-INVENTADO-155';
const nc = (date, extra) => ({ agent_id: '3001', agent_name: 'ASESORA INVENTADA A15', campaign_id: '9', conn_id: CONN, customer_id: CLIENTE, date, destiny: DEST, result: 'NO ANSWER', ring_time: '30', telephone: TEL, type_interaction: 'outbound_ma', ...extra });
const DATA = [nc('2026-11-02 08:15:00'), nc('2026-11-02 09:00:00'), nc('2026-11-03 10:20:00', { agent_name: '' })];
function falso(data) {
  const f = { urls: [] };
  f.fetch = (url) => { f.urls.push(url); return Promise.resolve({ status: 200, json: () => Promise.resolve({ code: 200, msg: data.length + ' records were found', data }) }); };
  return f;
}

test('hoja de no conectadas: solo asesor, fecha, ring_time y result', () => {
  const h = M.hojaNoConectadas(DATA);
  assert.deepEqual(h[0], ['AGENT_NAME', 'DATE', 'RING_TIME', 'RESULT']);
  const txt = JSON.stringify(h);
  for (const x of [TEL, DEST, CLIENTE, CONN]) assert.ok(!txt.includes(x), x);
});

test('corrida: una consulta, reemplaza el mes de la réplica con respaldo, sin datos sensibles; MOBILIZE real intacto', async () => {
  const ins = db.prepare("INSERT INTO llamadas_no_conectadas (campana, fecha, agente, archivoNombre, cargadoPorNombre, createdAt) VALUES (?, ?, 'X', 'x', 'x', 'x')");
  ins.run(R, '2026-11-25'); // vieja del mes: sale (mes completo)
  ins.run('ORLANT', '2026-11-02');
  const versiones = db.prepare('SELECT COUNT(*) n FROM cargas_versiones WHERE campana = ?').get(R).n;
  const f = falso(DATA);
  const r = await M.correrModulo('no_conectadas', { db, destino: 'real', env: ENV, ahora: AHORA, fetchImpl: f.fetch, franja: 'a15-1' });
  assert.equal(r.estado, 'ok', r.detalle);
  assert.equal(f.urls.length, 1);
  assert.equal(new URL(f.urls[0]).searchParams.get('api'), 'cdr_5');
  const filas = db.prepare('SELECT * FROM llamadas_no_conectadas WHERE campana = ? ORDER BY fecha, agente').all(R);
  assert.deepEqual(filas.map((x) => [x.fecha, x.agente]), [['2026-11-02', 'ASESORA INVENTADA A15'], ['2026-11-02', 'ASESORA INVENTADA A15'], ['2026-11-03', 'Sin asesor']]);
  const txt = JSON.stringify(filas);
  for (const x of [TEL, DEST, CLIENTE, CONN]) assert.ok(!txt.includes(x), 'se guardó ' + x);
  assert.match(r.detalle, /3 no conectadas \(reemplazó 1, con respaldo\)/);
  assert.ok(db.prepare('SELECT COUNT(*) n FROM cargas_versiones WHERE campana = ?').get(R).n > versiones, 'respaldo');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM llamadas_no_conectadas WHERE campana = 'ORLANT'").get().n, 1);
});

test('el módulo está en la lista y arranca apagado', () => {
  assert.equal(M.MODULOS.no_conectadas.api, 'cdr_5');
  assert.deepEqual(M.modulosDe('flujo_hora,cdr,encuesta'), ['flujo_hora', 'cdr', 'encuesta']);
  assert.deepEqual(M.modulosDe('cdr,no_conectadas'), ['cdr', 'no_conectadas']);
});
