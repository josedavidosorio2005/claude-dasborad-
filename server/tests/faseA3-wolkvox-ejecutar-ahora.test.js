// faseA3-wolkvox-ejecutar-ahora.test.js — Fase A3 (18/11): «Ejecutar ahora» de la consulta
// automatica. Solo admin y solo la replica; exige el interruptor; tope de consultas de la corrida;
// una vez cada 10 min; Historial con quien la pidio. Wolkvox FALSO, datos INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const rutaWv = require('../routes/wolkvox');
const auto = require('../wolkvox-auto');

const R = 'ORLANT PRUEBAS API'; // Fase W10: antes la réplica de MOBILIZE (borrada); «Ejecutar ahora» sigue en las réplicas
const TOKEN = 'TOKEN-FALSO-A3-no-es-real-0123456789';
const SERVIDOR = 'servidorfalsoa3';
const H = (t) => ({ Authorization: 'Bearer ' + t });
process.env.WOLKVOX_ORLANT_TOKEN = TOKEN;
process.env.WOLKVOX_ORLANT_SERVIDOR = SERVIDOR;
app.locals.wolkvoxValor = async () => 'flujo'; // Fase N3b: el Flujo de ORLANT va por la lista
let llamadas = 0;
let encendido = false;
app.locals.wolkvoxInterruptor = async () => encendido;
app.locals.wolkvoxFetch = () => {
  llamadas++;
  return Promise.resolve({ status: 200, json: () => Promise.resolve({ code: 200, msg: '1 records were found', data: [{ skill_name: 'SKILL INVENTADA A3', inbound_calls: '4', answer_calls: '3', abandon_calls: '1' }] }) });
};
const ejecutar = (t, extra) => request(app).post('/api/wolkvox/auto/ejecutar').set(H(t)).send(Object.assign({ campana: R }, extra || {}));
// Dias que pediria hoy (depende de la fecha real): para saber cuantas consultas esperar.
const necesarias = () => auto.plan(new Date()).reduce((n, m) => n + m.dias.length, 0);

test('apagada: 409 y no consulta', async () => {
  rutaWv._reiniciarEspera();
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  encendido = false;
  const r = await ejecutar(admin);
  assert.equal(r.status, 409);
  assert.equal(r.body.codigo, 'apagada');
  assert.equal(llamadas, 0);
});

test('maxConsultas invalido: 400; Mobilize real: 404; sin sesion: 401', async () => {
  rutaWv._reiniciarEspera();
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  encendido = true;
  assert.equal((await ejecutar(admin, { maxConsultas: 0 })).status, 400);
  assert.equal((await ejecutar(admin, { maxConsultas: 999 })).status, 400);
  assert.equal((await request(app).post('/api/wolkvox/auto/ejecutar').set(H(admin)).send({ campana: 'MOBILIZE' })).status, 404);
  assert.equal((await request(app).post('/api/wolkvox/auto/ejecutar').send({ campana: R })).status, 401);
  assert.equal(llamadas, 0);
});

test('encendida: corre una vez, Historial con «Ejecutar ahora» y quien; la segunda espera 10 min', async () => {
  rutaWv._reiniciarEspera();
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  encendido = true;
  const n = necesarias();
  const r = await ejecutar(admin, { maxConsultas: 62 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.consultas, n);
  assert.equal(llamadas, n);
  if (n) assert.equal(r.body.estado, 'ok');
  const h = db.prepare("SELECT actor, detalle FROM historial WHERE accion = 'WOLKVOX_AUTO' ORDER BY id DESC LIMIT 1").get();
  assert.match(h.detalle, /^Ejecutar ahora · ORLANT PRUEBAS API · skill_1 · /);
  assert.notEqual(h.actor, auto.QUIEN);
  for (const s of [TOKEN, SERVIDOR, 'SKILL INVENTADA A3']) assert.ok(!r.text.includes(s) && !h.detalle.includes(s));
  const r2 = await ejecutar(admin);
  assert.equal(r2.status, 429);
  assert.equal(llamadas, n);
});

test('tope de la corrida: si el plan necesita mas que maxConsultas, no consulta', async () => {
  const n = necesarias();
  if (n < 2) return; // el dia 1 sin mes anterior no aplica
  rutaWv._reiniciarEspera();
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  encendido = true;
  const antes = llamadas;
  const r = await ejecutar(admin, { maxConsultas: n - 1 });
  assert.equal(r.status, 200);
  assert.equal(r.body.estado, 'omitida');
  assert.equal(llamadas, antes);
});

test('candado: «Ejecutar ahora» no corre si hay otra corrida; interruptor ilegible: no corre', async () => {
  let soltar;
  const lento = () => new Promise((ok) => { soltar = () => ok({ status: 200, json: () => Promise.resolve({ code: 200, msg: '0 records were found' }) }); });
  const env = { NODE_ENV: 'test', WOLKVOX_ORLANT_TOKEN: TOKEN, WOLKVOX_ORLANT_SERVIDOR: SERVIDOR };
  const O = { destino: 'orlant_replica', leerValor: async () => 'flujo' };
  const primera = auto.ejecutarAhora({ ...O, db, env, ahora: new Date('2026-11-03T12:00:00Z'), fetchImpl: lento, leerInterruptor: async () => true });
  await new Promise((ok) => setImmediate(ok));
  await new Promise((ok) => setImmediate(ok));
  assert.equal((await auto.ejecutarAhora({ ...O, db, env, leerInterruptor: async () => true })).estado, 'ocupada');
  while (!soltar) await new Promise((ok) => setImmediate(ok));
  // Responde todos los dias pendientes.
  const fin = primera.then((x) => x);
  const intervalo = setInterval(() => soltar && soltar(), 1);
  const r = await fin;
  clearInterval(intervalo);
  assert.equal(r.estado === 'ok' || r.estado === 'omitida', true, r.estado);
  assert.equal((await auto.ejecutarAhora({ ...O, db, env, leerInterruptor: async () => { throw new Error('x'); } })).estado, 'sin_interruptor');
});

test('navegador: wvAutoFilas solo pinta conteos y codigos', () => {
  const { wvAutoFilas } = require(path.join(__dirname, '..', '..', 'public', 'js', 'wolkvox-prueba.js'));
  const f = wvAutoFilas({ estado: 'ok', consultas: 17, usoHoy: 20, tope: 2800, meses: [{ mes: '2026-11', estado: 'ok', dias: 17, filas: 60, skills: 4, reemplazadas: 0 }] });
  assert.deepEqual(f.map((x) => x[0]), ['Estado', 'Consultas usadas', 'Mes 2026-11', 'Consultas de hoy']);
  assert.match(f[2][1], /17 días, 60 filas, 4 skills/);
});
