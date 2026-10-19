// fase154-tope-cargas.test.js — Fase 154: tope de cargas simultaneas.
// Pasado el tope, una carga recibe 503 (codigo CARGAS_EN_CURSO, Retry-After)
// ANTES de leer su archivo, y el navegador reintenta solo. Lo demas (lecturas,
// otras escrituras) no se frena.
'use strict';
process.env.CARGAS_SIMULTANEAS_MAX = '1'; // solo en este proceso de prueba
const http = require('http');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, tokenFor, MASTER_PASSWORD, cleanup } = require('./helpers');
const { esRutaDeCarga } = require('../cargas-simultaneas');
const T = require('../../public/js/cargas-turno-logic.js');

let server;
let base;
let token;
before(async () => {
  token = await tokenFor('admin', MASTER_PASSWORD);
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = 'http://127.0.0.1:' + server.address().port;
});
after(() => { server.closeAllConnections(); server.close(); cleanup(); });

const RUTA = '/api/calidad/tipificacion/carga';

// Una carga "a medio subir": manda las cabeceras y parte del cuerpo, y espera.
function cargaEnCurso() {
  const cuerpo = Buffer.from(JSON.stringify({ campana: 'ORLANT', canal: 'LLAMADAS', filas: [] }));
  const req = http.request(base + RUTA, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Content-Length': cuerpo.length },
  });
  const respuesta = new Promise((resolve) => req.on('response', (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); }));
  req.write(cuerpo.subarray(0, 5));
  return { terminar: () => { req.end(cuerpo.subarray(5)); return respuesta; } };
}
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const conToken = (r) => r.set('Authorization', 'Bearer ' + token);

test('con el tope lleno: la otra carga recibe 503 con su codigo y Retry-After, sin leer el archivo', async () => {
  const primera = cargaEnCurso();
  await pausa(150);
  const res = await conToken(request(base).post(RUTA)).send({ campana: 'ORLANT', canal: 'LLAMADAS', filas: [] });
  assert.equal(res.status, 503);
  assert.equal(res.body.codigo, 'CARGAS_EN_CURSO');
  assert.equal(res.headers['retry-after'], '3');
  // Lo demas no se frena: una lectura y una escritura que no es carga.
  assert.equal((await conToken(request(base).get('/api/dashboard/clientes'))).status, 200);
  assert.notEqual((await conToken(request(base).post('/api/auth/logout')).send({})).status, 503);
  // Sin sesion sigue siendo 401 (no ocupa ni pide turno).
  assert.equal((await request(base).post(RUTA).send({ campana: 'ORLANT' })).status, 401);
  // Al terminar la primera, el turno se libera.
  assert.notEqual(await primera.terminar(), 503);
  const despues = await conToken(request(base).post(RUTA)).send({ campana: 'ORLANT', canal: 'LLAMADAS', filas: [] });
  assert.notEqual(despues.status, 503);
});

test('Eliminar un mes y Deshacer tambien cuentan como carga', async () => {
  const primera = cargaEnCurso();
  await pausa(150);
  assert.equal((await conToken(request(base).delete('/api/centro-cargas/ORLANT/agendas/2026-08'))).status, 503);
  assert.equal((await conToken(request(base).post('/api/centro-cargas/versiones/1/deshacer')).send({})).status, 503);
  await primera.terminar();
});

test('toda ruta que carga, reemplaza o borra en bloque esta cubierta por el tope', () => {
  const rutas = [];
  (function walk(stack) {
    stack.forEach((l) => {
      if (l.route) Object.keys(l.route.methods).forEach((m) => rutas.push({ method: m.toUpperCase(), path: '/api' + l.route.path }));
      else if (l.handle && l.handle.stack) walk(l.handle.stack);
    });
  })((app.router || app._router).stack);
  const ejemplo = (p) => p.replace(/:id/g, '7').replace(/:\w+/g, 'X');
  const deCarga = rutas.filter((r) => (r.method === 'POST' || r.method === 'DELETE') && /carga|bulk|deshacer|borrado/.test(r.path));
  assert.ok(deCarga.length >= 30, 'inventario de rutas de carga');
  deCarga.forEach((r) => assert.ok(esRutaDeCarga({ method: r.method, path: ejemplo(r.path) }), r.method + ' ' + r.path));
  for (const [method, path] of [['POST', '/api/monitoreos'], ['PUT', '/api/users/7'], ['POST', '/api/auth/login'], ['GET', '/api/calidad/tipificacion/opciones'], ['GET', '/api/centro-cargas/ORLANT/agendas/2026-08/datos']]) {
    assert.equal(esRutaDeCarga({ method, path }), false, method + ' ' + path);
  }
});

test('navegador: reintenta solo con el codigo de turno, con un poco de azar, y se rinde a los ~3 minutos', () => {
  const d = { codigo: 'CARGAS_EN_CURSO' };
  assert.equal(T.cargasTurnoEspera(503, d, 0, '3', 0), 3000);
  assert.equal(T.cargasTurnoEspera(503, d, 0, '3', 1), 4500);
  assert.equal(T.cargasTurnoEspera(503, d, 0, null, 0), 3000, 'sin cabecera: 3 s');
  assert.equal(T.cargasTurnoEspera(503, d, 0, '999', 0), 3000, 'una espera absurda no se respeta');
  assert.equal(T.cargasTurnoEspera(503, d, T.CARGAS_TURNO_INTENTOS_MAX, '3', 0), null, 'se rinde');
  assert.equal(T.cargasTurnoEspera(503, { error: 'x' }, 0, '3', 0), null, 'otro 503 no se reintenta');
  assert.equal(T.cargasTurnoEspera(500, d, 0, '3', 0), null);
  assert.equal(T.cargasTurnoEspera(201, {}, 0, null, 0), null);
});
