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

const R = 'MOBILIZE PRUEBAS API', REAL = 'MOBILIZE';
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

test('réplica, un mes cerrado: Tipificación, salida y Encuesta sin la cuenta de prueba; el Historial no lleva el nombre', async () => {
  const historial = [];
  const logEvent = (accion, t, actor, detalle) => historial.push(detalle);
  const f = falso({
    cdr_1: [cdr(), cdr({ type_interaction: 'outbound_ma', skill_name: '', skill_id: '', date: '2026-10-26 12:00:00' }), cdr({ agent_name: PRUEBA, agent_id: '4242', type_interaction: 'outbound_ma', skill_name: '', skill_id: '', date: '2026-10-26 12:30:00' })],
    cdr_5: [nc(), nc({ agent_name: PRUEBA, agent_id: '4242' })],
    diagram_4: [enc(), enc({ agent_name: PRUEBA, agent_id: '4242', time: '10:00:00' })],
  });
  const base = { db, env: ENV, ahora: new Date('2026-11-20T15:00:00Z'), mes: '2026-10', fetchImpl: f.fetch, logEvent };
  for (const m of ['cdr', 'no_conectadas', 'encuesta']) {
    const r = await M.correrModulo(m, Object.assign({ franja: 'a26-r-' + m }, base));
    assert.equal(r.estado, 'ok', r.detalle);
  }
  const mes = "fecha BETWEEN '2026-10-01' AND '2026-10-31'";
  assert.equal(n(`SELECT COUNT(*) n FROM tipificaciones WHERE campana = ? AND canal = 'LLAMADAS' AND ${mes}`, R), 2);
  assert.equal(n(`SELECT COUNT(*) n FROM tipificaciones WHERE campana = ? AND agente = ?`, R, PRUEBA), 0);
  assert.equal(n(`SELECT COUNT(*) n FROM llamadas_no_conectadas WHERE campana = ? AND ${mes}`, R), 1);
  assert.equal(n(`SELECT COUNT(*) n FROM encuestas WHERE campana = ? AND ${mes}`, R), 1);
  assert.equal(n(`SELECT COUNT(*) n FROM encuestas WHERE campana = ? AND agente = ?`, R, PRUEBA), 0);
  assert.equal(historial.length, 3);
  for (const d of historial) {
    assert.ok(d.includes('1 de la cuenta de prueba fuera (agent_id 4242)'), d);
    assert.ok(!d.toUpperCase().includes(PRUEBA.toUpperCase()), 'sin el nombre en el Historial');
  }
});

test('un mes con solo filas de la cuenta de prueba se vacía (con respaldo), no queda lo de antes', async () => {
  // Primero el mes con una llamada normal; después Wolkvox solo trae la cuenta de prueba.
  const ahora = new Date('2026-11-20T15:00:00Z');
  const f1 = falso({ cdr_5: [nc({ date: '2026-07-23 09:00:00' })], diagram_4: [enc({ date: '2026-07-28' })], cdr_1: [cdr({ date: '2026-07-23 09:00:00' })] });
  for (const m of ['cdr', 'no_conectadas', 'encuesta']) await M.correrModulo(m, { db, env: ENV, ahora, mes: '2026-07', fetchImpl: f1.fetch, franja: 'a26-v1-' + m });
  const julio = (t, extra) => n(`SELECT COUNT(*) n FROM ${t} WHERE campana = ? AND fecha BETWEEN '2026-07-01' AND '2026-07-31'${extra || ''}`, R);
  assert.equal(julio('llamadas_no_conectadas'), 1);
  assert.equal(julio('encuestas'), 1);
  assert.equal(julio('tipificaciones', " AND canal = 'LLAMADAS'"), 1);
  const respaldos0 = n("SELECT COUNT(*) n FROM cargas_versiones WHERE campana = ? AND mes = '2026-07'", R);
  const f2 = falso({ cdr_5: [nc({ agent_name: PRUEBA, date: '2026-07-23 09:00:00' })], diagram_4: [enc({ agent_name: PRUEBA, date: '2026-07-28' })], cdr_1: [cdr({ agent_name: PRUEBA, date: '2026-07-23 09:00:00' })] });
  for (const m of ['cdr', 'no_conectadas', 'encuesta']) {
    const r = await M.correrModulo(m, { db, env: ENV, ahora, mes: '2026-07', fetchImpl: f2.fetch, franja: 'a26-v2-' + m });
    assert.equal(r.estado, 'ok', r.detalle);
    assert.ok(/solo filas de la cuenta de prueba, 1 de la cuenta de prueba fuera \(agent_id 1001\), mes vaciado \(borró 1\), con respaldo/.test(r.detalle), r.detalle);
  }
  assert.equal(julio('llamadas_no_conectadas'), 0);
  assert.equal(julio('encuestas'), 0);
  assert.equal(julio('tipificaciones', " AND canal = 'LLAMADAS'"), 0);
  assert.equal(n("SELECT COUNT(*) n FROM cargas_versiones WHERE campana = ? AND mes = '2026-07'", R), respaldos0 + 3, 'un respaldo por tabla');
  assert.throws(() => M.vaciarMes(db, 'tipificaciones', 'ORLANT', '2026-07'), /no permitida/);
  assert.throws(() => M.vaciarMes(db, 'users', R, '2026-07'), /no permitida/);
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
