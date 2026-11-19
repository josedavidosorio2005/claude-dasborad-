// faseA18-wolkvox-skill2.test.js — Fase A18 (19/11): «Probar» acepta skill_2 (detalle de llamadas
// abandonadas) y devuelve cuantas filas trae cada dia (solo AAAA-MM-DD, sin hora ni otros valores).
// Wolkvox FALSO, datos INVENTADOS (nombre y telefono centinela que nunca deben salir).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');
const rutaWv = require('../routes/wolkvox');
const wv = require('../wolkvox');

const R = 'MOBILIZE PRUEBAS API';
const NOMBRE = 'Persona Inventada A18';
const TEL = '3000000018';
process.env.WOLKVOX_MOBILIZE_TOKEN = 'TOKEN-FALSO-A18-no-es-real-0123456789';
process.env.WOLKVOX_MOBILIZE_SERVIDOR = 'servidorfalsoa18';
let ultimaUrl = null;
app.locals.wolkvoxFetch = (url) => {
  ultimaUrl = url;
  return Promise.resolve({ status: 200, json: () => Promise.resolve({ code: 200, msg: '3 records were found', data: [
    { date: '2026-11-14 14:07:31', skill_name: 'SKILL INVENTADA', telephone: TEL, agent_name: NOMBRE },
    { date: '2026-11-14 16:40:02', skill_name: 'SKILL INVENTADA', telephone: TEL, agent_name: NOMBRE },
    { date: '2026-11-03 09:00:00', skill_name: 'SKILL INVENTADA', telephone: TEL, agent_name: NOMBRE },
  ] }) });
};

test('skill_2 está en la lista; «Probar» del mes devuelve filas por día sin horas ni datos', async () => {
  assert.ok(Object.prototype.hasOwnProperty.call(wv.REPORTES, 'skill_2'));
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  rutaWv._reiniciarEspera();
  const r = await request(app).post('/api/wolkvox/probar').set({ Authorization: 'Bearer ' + admin }).send({ campana: R, fecha: '2026-11-18', reporte: 'skill_2', rango: 'mes' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(Object.fromEntries(new URL(ultimaUrl).searchParams), { api: 'skill_2', date_ini: '20261101000000', date_end: '20261118235959' });
  assert.equal(r.body.filas, 3);
  assert.deepEqual(r.body.porDia, { '2026-11-03': 1, '2026-11-14': 2 });
  for (const x of [NOMBRE, TEL, '14:07', '16:40']) assert.ok(!r.text.includes(x), 'salio ' + x);
});

test('filasPorDia: solo campos de fecha con AAAA-MM-DD; ignora lo demás', () => {
  assert.deepEqual(wv.filasPorDia({ data: [{ date: 'x' }, { fecha: '2026-11-02' }, { hour: '2026-11-02' }, { call_date: '2026-11-02 10:00' }, null, [1]] }), { '2026-11-02': 2 });
  assert.deepEqual(wv.filasPorDia(null), {});
});
