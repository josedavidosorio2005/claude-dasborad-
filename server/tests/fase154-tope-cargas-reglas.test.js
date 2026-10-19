// fase154-tope-cargas-reglas.test.js — Fase 154 (ajustes pedidos al PR 3):
//   1. el turno solo lo toma quien puede cargar: el que no, recibe 403 sin
//      ocupar turno;
//   2. maximo 1 turno por persona;
//   3. una subida que no termina en el tiempo maximo se corta (408) y
//      libera el turno.
'use strict';
process.env.CARGAS_SIMULTANEAS_MAX = '2'; // solo en este proceso de prueba
process.env.CARGAS_TIEMPO_CUERPO_MS = '400';
const http = require('http');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, db, request, cleanup } = require('./helpers');
const { signToken } = require('../auth');

let server;
let base;
const T = {};
function tokenDe(user, rol, perms) {
  db.prepare(
    "INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt) VALUES (?, ?, ?, 1, 'x', ?, '2026-10-19')"
  ).run('Persona ' + user, user, rol, JSON.stringify(perms));
  const row = db.prepare('SELECT * FROM users WHERE user = ?').get(user);
  return signToken({ isMasterAdmin: false, userId: row.id, rol: row.rol, tokenVersion: row.token_version });
}
before(async () => {
  T.a = tokenDe('f154a', 'REPORTES', { cargarDatos: true, campana_ORLANT: true });
  T.b = tokenDe('f154b', 'REPORTES', { cargarDatos: true, campana_ORLANT: true });
  T.c = tokenDe('f154c', 'REPORTES', { cargarDatos: true, campana_ORLANT: true });
  T.cliente = tokenDe('f154cliente', 'CLIENTES_DASH', { ClientesDash: true, cliente_ORLANT: true });
  T.inventario = tokenDe('f154inv', 'INVENTARIO', { Inventario: true });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = 'http://127.0.0.1:' + server.address().port;
});
after(() => { server.closeAllConnections(); server.close(); cleanup(); });

const RUTA = '/api/calidad/tipificacion/carga';
const CUERPO = { campana: 'ORLANT', canal: 'LLAMADAS', filas: [] };
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

// Una carga "a medio subir" de `token`: cabeceras y parte del cuerpo.
function cargaEnCurso(token) {
  const cuerpo = Buffer.from(JSON.stringify(CUERPO));
  const req = http.request(base + RUTA, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Content-Length': cuerpo.length },
  });
  req.on('error', () => {});
  const respuesta = new Promise((resolve) => {
    req.on('response', (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('close', () => resolve(null));
  });
  req.write(cuerpo.subarray(0, 5));
  return {
    respuesta,
    terminar: () => { req.end(cuerpo.subarray(5)); return respuesta; },
    cortar: () => req.destroy(),
  };
}
const post = (token, ruta, cuerpo) => request(base).post(ruta || RUTA).set('Authorization', 'Bearer ' + token).send(cuerpo || CUERPO);

test('1. quien no puede cargar recibe 403 y no ocupa turno (aunque el tope este lleno)', async () => {
  const a = cargaEnCurso(T.a);
  const b = cargaEnCurso(T.b);
  await pausa(100);
  assert.equal((await post(T.cliente)).status, 403, 'sin permiso: 403, no 503');
  assert.equal((await post(T.c)).status, 503, 'con permiso y el tope lleno: espera turno');
  await a.terminar();
  await b.terminar();
  // Libre: el cliente sigue en 403 y el turno quedo libre para quien carga.
  assert.equal((await post(T.cliente)).status, 403);
  assert.notEqual((await post(T.c)).status, 503);
  // Inventario si puede intentar su propia carga (no queda en 403 por el tope).
  const inv = await post(T.inventario, '/api/inventario/carga-items', { items: [] });
  assert.notEqual(inv.status, 503);
  assert.notEqual(inv.body && inv.body.error, 'Sin permiso para cargar estos datos');
});

test('2. maximo 1 turno por persona: la segunda carga de la misma persona espera', async () => {
  const a = cargaEnCurso(T.a);
  await pausa(100);
  const segunda = await post(T.a);
  assert.equal(segunda.status, 503, 'hay turnos libres, pero ya tiene uno');
  assert.equal(segunda.body.codigo, 'CARGAS_EN_CURSO');
  assert.notEqual((await post(T.b)).status, 503, 'otra persona si entra');
  await a.terminar();
  assert.notEqual((await post(T.a)).status, 503, 'al terminar, la persona vuelve a tener turno');
});

test('3. una subida que no termina a tiempo se corta (408) y libera el turno', async () => {
  const a = cargaEnCurso(T.a);
  const b = cargaEnCurso(T.b);
  const fin = await Promise.race([a.respuesta, pausa(2000).then(() => 'sin respuesta')]);
  a.cortar();
  b.cortar();
  assert.equal(fin, 408, 'la subida lenta se corta con 408');
  await pausa(100);
  // Los dos turnos quedaron libres: dos personas cargan a la vez.
  const [r1, r2] = await Promise.all([post(T.a), post(T.c)]);
  assert.notEqual(r1.status, 503);
  assert.notEqual(r2.status, 503);
});
