// faseA20-wolkvox-meses-pasados.test.js — Fase A20 (19/11): «Ejecutar ahora» con `mes` (un mes pasado
// completo, hasta 12 atrás) y `modulo: 'todos'` (Flujo + módulos encendidos, en orden). Solo admin y
// solo la réplica. Wolkvox FALSO, datos INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const rutaWv = require('../routes/wolkvox');
const auto = require('../wolkvox-auto');
const M = require('../wolkvox-modulos');

const R = auto.CAMPANA;
const H = (t) => ({ Authorization: 'Bearer ' + t });
process.env.WOLKVOX_MOBILIZE_TOKEN = 'TOKEN-FALSO-A20-no-es-real-0123456789';
process.env.WOLKVOX_MOBILIZE_SERVIDOR = 'servidorfalsoa20';
const urls = [];
let modulos = 'flujo_hora,cdr,encuesta,no_conectadas,abandonadas';
app.locals.wolkvoxInterruptor = async () => true;
app.locals.wolkvoxValor = async () => modulos;
// Respuesta vacía («sin registros»): ningún módulo escribe, solo se cuentan las consultas.
app.locals.wolkvoxFetch = (url) => { urls.push(url); return Promise.resolve({ status: 200, json: () => Promise.resolve({ code: 200, msg: '0 records were found', data: [] }) }); };
const ejecutar = (t, extra) => request(app).post('/api/wolkvox/auto/ejecutar').set(H(t)).send(Object.assign({ campana: R }, extra || {}));

test('planMes: solo meses cerrados de los últimos 12, completos', () => {
  const ahora = new Date('2026-11-19T20:00:00Z');
  const oct = auto.planMes('2026-10', ahora);
  assert.equal(oct.length, 1);
  assert.equal(oct[0].dias.length, 31);
  assert.equal(oct[0].dias[0], '2026-10-01');
  assert.equal(oct[0].dias[30], '2026-10-31');
  assert.equal(auto.planMes('2026-09', ahora)[0].dias.length, 30);
  assert.equal(auto.planMes('2025-11', ahora)[0].mes, '2025-11');
  for (const malo of ['2026-11', '2026-12', '2025-10', '2026-7', '2026-13', 'x', 5, null]) assert.equal(auto.planMes(malo, ahora), null, String(malo));
  assert.deepEqual(auto.planDe({ mes: '2026-12', ahora }), []);
  assert.deepEqual(auto.planDe({ ahora }), auto.plan(ahora));
});

test('un módulo con mes: pide el mes completo en una consulta', async () => {
  const f = { urls: [] };
  const r = await M.correrModulo('no_conectadas', { db, env: { NODE_ENV: 'test', WOLKVOX_MOBILIZE_TOKEN: 'T-A20-0123456789', WOLKVOX_MOBILIZE_SERVIDOR: 'srvfalsoa20' }, ahora: new Date('2026-11-19T20:00:00Z'), mes: '2026-07',
    fetchImpl: (u) => { f.urls.push(u); return Promise.resolve({ status: 200, json: () => Promise.resolve({ code: 200, msg: '0 records were found', data: [] }) }); }, franja: 'a20-1' });
  assert.equal(r.estado, 'ok', r.detalle);
  assert.equal(f.urls.length, 1);
  const u = new URL(f.urls[0]);
  assert.equal(u.searchParams.get('date_ini'), '20260701000000');
  assert.equal(u.searchParams.get('date_end'), '20260731235959');
});

test('ruta: mes inválido o «todos» sin mes = 400 sin consultar', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  for (const extra of [{ mes: '2099-01' }, { mes: 'julio' }, { modulo: 'todos' }, { modulo: 'nada', mes: '2026-07' }]) {
    rutaWv._reiniciarEspera();
    const n = urls.length;
    const r = await ejecutar(admin, extra);
    assert.equal(r.status, 400, JSON.stringify(extra));
    assert.equal(urls.length, n);
  }
});

test('ruta: «todos» con mes corre Flujo (un día por consulta) y luego cada módulo encendido, en orden', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  // Un mes cerrado relativo a hoy: el anterior al actual.
  const hoy = require('../fecha-limites').fechaLimitesHoyColombia();
  let [y, m] = hoy.slice(0, 7).split('-').map(Number); m -= 1; if (!m) { m = 12; y -= 1; }
  const elMes = y + '-' + String(m).padStart(2, '0');
  const dias = auto.planMes(elMes)[0].dias.length;
  modulos = 'flujo_hora,cdr,abandonadas'; // encuesta y no_conectadas apagados: se saltan
  rutaWv._reiniciarEspera();
  urls.length = 0;
  const r = await ejecutar(admin, { modulo: 'todos', mes: elMes });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.mes, elMes);
  assert.deepEqual(r.body.partes.map((p) => [p.modulo, p.estado]), [['flujo', 'ok'], ['flujo_hora', 'ok'], ['cdr', 'ok'], ['encuesta', 'apagado'], ['no_conectadas', 'apagado'], ['abandonadas', 'ok']]);
  const apis = urls.map((u) => new URL(u).searchParams.get('api'));
  assert.equal(apis.filter((a) => a === 'skill_1').length, dias);
  assert.deepEqual(apis.filter((a) => a !== 'skill_1'), ['skill_7', 'cdr_1', 'skill_2']);
  assert.ok(apis.indexOf('skill_7') > apis.lastIndexOf('skill_1'), 'flujo_hora después del Flujo');
  for (const u of urls) assert.equal(new URL(u).searchParams.get('date_ini').slice(0, 6), elMes.replace('-', ''));
  const h = db.prepare("SELECT detalle FROM historial WHERE accion = 'WOLKVOX_MODULO' ORDER BY id DESC LIMIT 1").get();
  assert.ok(h.detalle.startsWith('Ejecutar ahora (mes ' + elMes + ')'), h.detalle);
});
