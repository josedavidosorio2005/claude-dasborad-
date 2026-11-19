// faseA5-wolkvox-probar-reportes.test.js — Fase A5 (18/11): «Probar» elige el reporte de una lista
// cerrada (skill_1, skill_4, agent_1, agent_7, chat_1, cdr_1). Solo admin y solo la replica; solo
// columnas y numero de filas; nombres de skill solo en reportes de skills. Wolkvox FALSO, datos
// INVENTADOS (nombres y telefonos centinela que nunca deben salir).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const rutaWv = require('../routes/wolkvox');
const wv = require('../wolkvox');

const R = 'MOBILIZE PRUEBAS API';
const TOKEN = 'TOKEN-FALSO-A5-no-es-real-0123456789';
const NOMBRE = 'Persona Inventada A5';
const TEL = '3000000055';
const H = (t) => ({ Authorization: 'Bearer ' + t });
process.env.WOLKVOX_MOBILIZE_TOKEN = TOKEN;
process.env.WOLKVOX_MOBILIZE_SERVIDOR = 'servidorfalsoa5';
let ultimaUrl = null;
app.locals.wolkvoxFetch = (url) => {
  ultimaUrl = url;
  return Promise.resolve({ status: 200, json: () => Promise.resolve({ code: 200, msg: '1 records were found', data: [
    { agent_name: NOMBRE, agent_id: '1001', customer_phone: TEL, skill_name: 'SKILL INVENTADA A5', login: '2026-11-17 07:58:00' },
  ] }) });
};
const probar = (t, reporte) => request(app).post('/api/wolkvox/probar').set(H(t)).send({ campana: R, fecha: '2026-11-17', ...(reporte === undefined ? {} : { reporte }) });

test('cada reporte de la lista: pide ese api del dia completo y devuelve solo columnas y filas', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  for (const api of ['skill_4', 'agent_1', 'agent_7', 'chat_1', 'cdr_1']) {
    rutaWv._reiniciarEspera();
    const r = await probar(admin, api);
    assert.equal(r.status, 200, api + ' ' + JSON.stringify(r.body));
    const u = new URL(ultimaUrl);
    assert.deepEqual(Object.fromEntries(u.searchParams), { api, date_ini: '20261117000000', date_end: '20261117235959' });
    assert.equal(r.body.reporte, api);
    assert.equal(r.body.filas, 1);
    assert.deepEqual(r.body.campos, ['agent_id', 'agent_name', 'customer_phone', 'login', 'skill_name']);
    assert.deepEqual(r.body.skills, api.startsWith('skill_') ? ['SKILL INVENTADA A5'] : []);
    for (const x of [NOMBRE, TEL, '1001', '07:58', TOKEN]) assert.ok(!r.text.includes(x), api + ': salio ' + x);
    const h = db.prepare("SELECT detalle FROM historial WHERE accion = 'WOLKVOX_PRUEBA' ORDER BY id DESC LIMIT 1").get();
    assert.equal(h.detalle, 'MOBILIZE · ' + api + ' · 2026-11-17 · 200 · 1 filas');
  }
});

test('sin reporte sigue siendo skill_1; uno fuera de la lista: 400 sin consultar', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  rutaWv._reiniciarEspera();
  assert.equal((await probar(admin)).body.reporte, 'skill_1');
  const usadas = wv.usoDelDia(db, 'MOBILIZE');
  for (const malo of ['agent_99', 'skill_1;x', 'constructor', 5, '']) {
    rutaWv._reiniciarEspera();
    const r = await probar(admin, malo);
    assert.equal(r.status, 400, String(malo));
    assert.equal(r.body.codigo, 'reporte');
  }
  assert.equal(wv.usoDelDia(db, 'MOBILIZE'), usadas);
});

test('estado trae la lista de reportes con su nombre', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const e = await request(app).get('/api/wolkvox/estado?campana=' + encodeURIComponent(R)).set(H(admin));
  assert.deepEqual(Object.keys(e.body.reportesNombres).sort(), ['agent_1', 'agent_7', 'cdr_1', 'cdr_2', 'cdr_3', 'cdr_4', 'cdr_5', 'chat_1', 'chat_13', 'diagram_1', 'diagram_4', 'diagram_5', 'ivr_1', 'skill_1', 'skill_2', 'skill_4', 'skill_7', 'skill_9']); // + Fase A10, A18
});

test('navegador: wvLlenarReportes arma las opciones con textContent', () => {
  const { wvLlenarReportes } = require(path.join(__dirname, '..', '..', 'public', 'js', 'wolkvox-prueba.js'));
  const hijos = [];
  const sel = { value: 'skill_1', set textContent(v) { hijos.length = 0; }, appendChild: (o) => hijos.push(o) };
  global.document = { createElement: () => ({}) };
  try {
    wvLlenarReportes(sel, { skill_1: 'A', agent_7: 'B<img>' });
  } finally { delete global.document; }
  assert.deepEqual(hijos.map((o) => [o.value, o.textContent]), [['agent_7', 'agent_7 — B<img>'], ['skill_1', 'skill_1 — A']]);
  assert.equal(sel.value, 'skill_1');
});

test('Fase A6: rango «mes» pide del 1 del mes hasta el día; otro rango: 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  rutaWv._reiniciarEspera();
  const r = await request(app).post('/api/wolkvox/probar').set(H(admin)).send({ campana: R, fecha: '2026-11-17', reporte: 'skill_7', rango: 'mes' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(Object.fromEntries(new URL(ultimaUrl).searchParams), { api: 'skill_7', date_ini: '20261101000000', date_end: '20261117235959' });
  assert.equal(r.body.desdeDia, '2026-11-01');
  assert.match(db.prepare("SELECT detalle FROM historial WHERE accion = 'WOLKVOX_PRUEBA' ORDER BY id DESC LIMIT 1").get().detalle, /skill_7 · 2026-11-01 a 2026-11-17 · 200/);
  rutaWv._reiniciarEspera();
  assert.equal((await request(app).post('/api/wolkvox/probar').set(H(admin)).send({ campana: R, fecha: '2026-11-17', reporte: 'cdr_5', rango: 'año' })).status, 400);
});
