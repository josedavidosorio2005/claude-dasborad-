// fase154-cuerpo-tras-limites.test.js — Fase 154: el cuerpo de una peticion
// se lee DESPUES del limite de tasa, y sin sesion solo se lee el del login.
// Antes, cualquiera sin cuenta hacia que el servidor procesara un JSON de
// hasta 8 MB, aunque el limite ya hubiera cortado.
'use strict';
// Limite anonimo bajo SOLO en este proceso de prueba (cada archivo de
// node --test corre aparte); helpers no lo pisa (setEnvDefault).
process.env.RATE_LIMIT_MAX = '4';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, tokenFor, MASTER_PASSWORD, cleanup } = require('./helpers');

after(cleanup);
// El token se saca antes de gastar el cupo anonimo (el login cuenta en el).
let token;
before(async () => { token = await tokenFor('admin', MASTER_PASSWORD); });

const RUTA_CARGA = '/api/calidad/tipificacion/carga';
const JSON_ROTO = '{"campana":"ORLANT","filas":[["a"';

test('sin sesion, el cuerpo no se procesa: 401 (no 400 de JSON invalido)', async () => {
  const res = await request(app).post(RUTA_CARGA).set('Content-Type', 'application/json').send(JSON_ROTO);
  assert.equal(res.status, 401);
});

test('con la sesion vencida y un archivo grande, llega el 401 con su mensaje (no una conexion cortada)', async () => {
  const grande = JSON.stringify({ campana: 'ORLANT', filas: Array.from({ length: 40000 }, (_, i) => ['a' + i, '2026-09-01']) });
  const res = await request(app).post(RUTA_CARGA).set('Authorization', 'Bearer token-vencido')
    .set('Content-Type', 'application/json').send(grande);
  assert.equal(res.status, 401);
  assert.equal(res.body.error, 'Sesion invalida o expirada');
});

test('el login con un cuerpo grande se rechaza (413) sin procesarlo', async () => {
  const res = await request(app).post('/api/auth/login').send({ user: 'x', password: 'y'.repeat(64 * 1024) });
  assert.equal(res.status, 413);
});

test('con sesion, un cuerpo que no es JSON responde 415', async () => {
  const res = await request(app).post(RUTA_CARGA).set('Authorization', 'Bearer ' + token)
    .set('Content-Type', 'text/plain').send('campana=ORLANT');
  assert.equal(res.status, 415);
});

test('con sesion, el JSON se sigue leyendo igual (JSON roto = 400)', async () => {
  const res = await request(app).post(RUTA_CARGA).set('Authorization', 'Bearer ' + token)
    .set('Content-Type', 'application/json').send(JSON_ROTO);
  assert.equal(res.status, 400);
});

test('cuando el limite anonimo ya corto, el cuerpo tampoco se procesa: 429', async () => {
  let ultimo;
  for (let i = 0; i < 8; i++) {
    ultimo = await request(app).post(RUTA_CARGA).set('Content-Type', 'application/json').send(JSON_ROTO);
  }
  assert.equal(ultimo.status, 429);
});
