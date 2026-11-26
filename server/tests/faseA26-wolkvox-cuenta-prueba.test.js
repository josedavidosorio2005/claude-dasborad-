// faseA26-wolkvox-cuenta-prueba.test.js — Fase A26 (20/11/2026, pedido de Edwin): la cuenta de PRUEBA de
// Wolkvox sale de todas las pestañas con asesor (Tipificación/salida por cdr_1, no conectadas por cdr_5,
// Encuesta por diagram_4), en la réplica y en el MOBILIZE real. Se reconoce por agent_id o por la huella
// sha256 del nombre normalizado: el nombre nunca está en el repo. Wolkvox FALSO y datos INVENTADOS.
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { db } = require('./helpers');
const auto = require('../wolkvox-auto');
const M = require('../wolkvox-modulos');

// Fase W10: las pruebas de la réplica de MOBILIZE se fueron con ella; el mes vaciado del real lo cubre faseA32.
const REAL = 'MOBILIZE';
const ENV = { NODE_ENV: 'test', WOLKVOX_MOBILIZE_TOKEN: 'TOKEN-FALSO-A26-no-es-real-0123456789', WOLKVOX_MOBILIZE_SERVIDOR: 'servidorfalsoa26' };
const PRUEBA = 'Cuenta Inventada De Prueba A26'; // nombre ficticio, solo en esta prueba
const ASESORA = 'ASESORA INVENTADA A26';
auto.asegurarTablas(db);
M._configurarPruebaParaPruebas([M._huellaParaPruebas(PRUEBA)], ['7777']);
after(() => M._configurarPruebaParaPruebas());

const n = (sql, ...a) => db.prepare(sql).get(...a).n;
const ok = (cuerpo) => Promise.resolve({ status: 200, json: () => Promise.resolve(cuerpo) });
function falso(porApi) {
  const f = { urls: [] };
  f.fetch = (url) => { f.urls.push(url); const api = new URL(url).searchParams.get('api'); const data = porApi[api] || []; return ok({ code: 200, msg: data.length + ' records were found', data }); };
  return f;
}
const cdr = (extra) => ({ agent_id: '1001', agent_name: ASESORA, description_cod_act: 'VENTA INVENTADA', skill_name: 'SKILL INVENTADA A26', skill_id: '7', telephone: '3000000026', type_interaction: 'inbound', date: '2026-10-26 10:11:12', time_min: 1, time_seg: 60, cod_act: '1', hang_up: 'agent', ...extra });
const nc = (extra) => ({ agent_id: '1001', agent_name: ASESORA, campaign_id: '9', conn_id: 'C', customer_id: 'X', date: '2026-10-26 11:00:00', destiny: 'D', result: 'NO ANSWER', ring_time: '30', telephone: '3000000027', type_interaction: 'outbound_ma', ...extra });
const enc = (extra) => ({ agent_dni: 'DNI', agent_id: '1001', agent_name: ASESORA, ani: '3000000028', conn_id: 'C', customer_id: 'X', date: '2026-10-26', time: '09:00:00', q01: '9', q02: '5', q03: '1', q04: '4', result: 'ok', skill_id: '5', skill_name: 'SKILL INVENTADA A26', type_interaction: 'inbound', voice_message: '', ...extra });

test('sin nombres en el repo: solo huellas sha256 y ids', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'wolkvox-modulos.js'), 'utf8');
  // Ningún texto entre comillas del código es el nombre de una cuenta de prueba (su huella no está en la lista).
  const textos = [...src.matchAll(/'([^'\\\n]{3,80})'/g)].map((m) => m[1]);
  assert.ok(textos.length > 50);
  for (const t of textos) assert.ok(!M.PRUEBA_HUELLAS.includes(M._huellaParaPruebas(t)), 'el nombre de la cuenta no está en el código');
  assert.ok(M.PRUEBA_HUELLAS.length >= 1 && M.PRUEBA_HUELLAS.every((h) => /^[0-9a-f]{64}$/.test(h)));
  assert.ok(Array.isArray(M.PRUEBA_IDS));
});

test('reconoce la cuenta por agent_id o por nombre (sin importar mayúsculas, tildes ni espacios)', () => {
  assert.equal(M.esCuentaPrueba({ agent_name: '  cuenta   inventada de prueba a26 ' }), true);
  assert.equal(M.esCuentaPrueba({ AGENT_NAME: 'CUENTA INVENTADA DE PRUEBA A26' }), true);
  assert.equal(M.esCuentaPrueba({ agent_id: 7777, agent_name: 'Otro nombre' }), true);
  assert.equal(M.esCuentaPrueba({ agent_id: '1001', agent_name: ASESORA }), false);
  assert.equal(M.esCuentaPrueba({ agent_name: '' }), false);
  assert.equal(M.esCuentaPrueba(null), false);
  const r = M.quitarCuentasPrueba([cdr(), cdr({ agent_name: PRUEBA, agent_id: '4242' }), cdr({ agent_id: '7777', agent_name: 'x' }), cdr({ agent_name: PRUEBA, agent_id: 'raro<script>' })]);
  assert.equal(r.data.length, 1);
  assert.equal(r.quitadas, 3);
  assert.deepEqual(r.ids, ['4242', '7777'], 'solo ids con caracteres seguros');
});

test('MOBILIZE real (programador, diciembre): también sin la cuenta de prueba', async (t) => {
  // El lector rechaza fechas futuras y el real solo admite diciembre: se simula la fecha (solo Date).
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-12-05T12:05:00Z') });
  const f = falso({ cdr_5: [nc({ date: '2026-12-03 11:00:00' }), nc({ agent_name: PRUEBA, date: '2026-12-03 11:30:00' })] });
  const r = await M.correrModulo('no_conectadas', { db, env: ENV, ahora: new Date('2026-12-05T12:05:00Z'), destino: 'real', fetchImpl: f.fetch, franja: 'a26-real' });
  assert.equal(r.estado, 'ok', r.detalle);
  assert.ok(r.detalle.startsWith('MOBILIZE · no_conectadas'), r.detalle);
  assert.equal(n("SELECT COUNT(*) n FROM llamadas_no_conectadas WHERE campana = ? AND fecha LIKE '2026-12%'", REAL), 1);
  assert.equal(n("SELECT COUNT(*) n FROM llamadas_no_conectadas WHERE campana = ? AND agente = ?", REAL, PRUEBA), 0);
});
