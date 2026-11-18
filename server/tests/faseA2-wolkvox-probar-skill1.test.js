// faseA2-wolkvox-probar-skill1.test.js — Fase A2 (18/11): «Probar» pide skill_1 del dia completo
// (el formato que funciono desde el PC), sin el encabezado Accept, muestra nombres de skill y,
// ante un error HTTP, el code/msg de Wolkvox sin secretos. La consulta automatica toma un 404
// «sin registros» como dia vacio. Wolkvox FALSO, datos INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const wv = require('../wolkvox');
const rutaWv = require('../routes/wolkvox');
const auto = require('../wolkvox-auto');

const R = 'MOBILIZE PRUEBAS API';
const TOKEN = 'TOKEN-FALSO-A2-no-es-real-0123456789';
const SERVIDOR = 'servidorfalsoa2';
const H = (t) => ({ Authorization: 'Bearer ' + t });
const ultima = { url: null, opts: null };
let responder = null;
app.locals.wolkvoxFetch = (url, opts) => { ultima.url = url; ultima.opts = opts; return responder(url, opts); };
const json = (status, cuerpo) => () => Promise.resolve({ status, json: () => Promise.resolve(cuerpo) });

test('Probar: skill_1 del dia completo, sin Accept, con nombres de skill y sin valores', async () => {
  process.env.WOLKVOX_MOBILIZE_TOKEN = TOKEN;
  process.env.WOLKVOX_MOBILIZE_SERVIDOR = SERVIDOR;
  rutaWv._reiniciarEspera();
  responder = json(200, { code: 200, msg: '2 records were found', data: [
    { skill_name: 'SKILL INVENTADA Z', skill_id: '7', inbound_calls: '123456', answer_calls: '99' },
    { skill_name: 'SKILL INVENTADA A<b>', skill_id: '8', inbound_calls: '5', answer_calls: '5' },
  ] });
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const r = await request(app).post('/api/wolkvox/probar').set(H(admin)).send({ campana: R, fecha: '2026-11-17' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const u = new URL(ultima.url);
  assert.deepEqual(Object.fromEntries(u.searchParams), { api: 'skill_1', date_ini: '20261117000000', date_end: '20261117235959' });
  assert.equal(u.pathname, '/api/v2/reports_manager.php');
  assert.deepEqual(Object.keys(ultima.opts.headers), ['wolkvox-token']);
  assert.equal(r.body.reporte, 'skill_1');
  assert.deepEqual([r.body.desde, r.body.hasta], ['00:00', '23:59']);
  assert.deepEqual(r.body.campos, ['answer_calls', 'inbound_calls', 'skill_id', 'skill_name']);
  assert.deepEqual(r.body.skills, ['SKILL INVENTADA Ab', 'SKILL INVENTADA Z']);
  assert.ok(!r.text.includes('123456') && !r.text.includes(TOKEN) && !r.text.includes(SERVIDOR));
});

test('Probar con 404: muestra el code y msg de Wolkvox (limpios), nunca el token', async () => {
  rutaWv._reiniciarEspera();
  responder = json(404, { code: 404, error: true, msg: 'No records found' });
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const r = await request(app).post('/api/wolkvox/probar').set(H(admin)).send({ campana: R, fecha: '2026-11-17' });
  assert.equal(r.status, 502);
  assert.equal(r.body.httpStatus, 404);
  assert.equal(r.body.wolkvoxCode, '404');
  assert.equal(r.body.wolkvoxMsg, 'No records found');
  assert.match(r.body.error, /^Wolkvox respondió 404 \(code 404: No records found\)$/);
  const h = db.prepare("SELECT detalle FROM historial WHERE accion = 'WOLKVOX_PRUEBA' ORDER BY id DESC LIMIT 1").get();
  assert.match(h.detalle, /skill_1 · 2026-11-17 · error http 404 code 404$/);
  // Un msg que traiga el token (o algo con forma de clave) no se muestra.
  rutaWv._reiniciarEspera();
  responder = json(404, { code: 404, msg: 'token ' + TOKEN });
  const r2 = await request(app).post('/api/wolkvox/probar').set(H(admin)).send({ campana: R, fecha: '2026-11-17' });
  assert.equal(r2.body.wolkvoxMsg, null);
  assert.ok(!r2.text.includes(TOKEN));
});

test('consulta automatica: un 404 «sin registros» es un dia vacio; otro 404 detiene la corrida', async () => {
  const env = { NODE_ENV: 'test', WOLKVOX_MOBILIZE_TOKEN: TOKEN, WOLKVOX_MOBILIZE_SERVIDOR: SERVIDOR };
  const ahora = new Date('2026-11-04T12:30:00Z'); // 4/11: pide 1, 2 y 3
  let n = 0;
  const f1 = () => { n++; return n === 2 ? json(404, { code: 404, msg: 'No records found' })() : json(200, { code: 200, msg: '1 records were found', data: [{ skill_name: 'SKILL A2', inbound_calls: '3', answer_calls: '2' }] })(); };
  const r = await auto.correrUnaVez({ db, env, ahora, fetchImpl: f1, franja: 'a2-1' });
  assert.equal(r.estado, 'ok', r.detalle);
  assert.equal(n, 3);
  assert.equal(r.meses[0].filas, 2);
  let m = 0;
  const f2 = () => { m++; return json(404, { code: 404, msg: 'Report not found' })(); };
  const r2 = await auto.correrUnaVez({ db, env, ahora, fetchImpl: f2, franja: 'a2-2' });
  assert.equal(r2.error, 'http');
  assert.equal(m, 1);
});

test('nombresDeSkill: unicos, ordenados, limpios y solo skill_name', () => {
  assert.deepEqual(wv.nombresDeSkill({ data: [{ skill_name: 'B' }, { skill_name: 'A' }, { skill_name: 'B' }, { otro: 'X' }, null, { skill_name: 5 }] }), ['A', 'B']);
  assert.deepEqual(wv.nombresDeSkill({}), []);
});
