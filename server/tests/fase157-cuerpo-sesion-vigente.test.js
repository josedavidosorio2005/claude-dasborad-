// fase157-cuerpo-sesion-vigente.test.js — Fase 157: el cuerpo de una
// peticion solo se lee con una sesion VIGENTE (no cerrada, sin cambio de
// clave despues, usuario que existe y activo), no solo con un token bien
// firmado. Antes, un token ya cerrado con logout hacia que el servidor
// procesara el cuerpo (hasta 8 MB) antes de rechazarlo.
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, db, request, cleanup } = require('./helpers');
const { signToken } = require('../auth');

const RUTA_CARGA = '/api/calidad/encuestas/carga'; // ruta de 8 MB
const JSON_ROTO = '{"campana":"ORLANT","filas":[["a"';

let usuario;
const tokenDe = (u) => signToken({ isMasterAdmin: false, userId: u.id, rol: u.rol, tokenVersion: u.token_version });
before(() => {
  db.prepare("INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt) VALUES ('Carga', 'f157carga', 'REPORTES', 1, 'x', ?, '2026-10-20')").run(JSON.stringify({ cargarDatos: true, campana_ORLANT: true }));
  usuario = db.prepare("SELECT * FROM users WHERE user = 'f157carga'").get();
});
after(cleanup);

const mandarRoto = (token) => request(app).post(RUTA_CARGA).set('Authorization', 'Bearer ' + token)
  .set('Content-Type', 'application/json').send(JSON_ROTO);

test('sesion vigente: el JSON se sigue leyendo (JSON roto = 400)', async () => {
  assert.equal((await mandarRoto(tokenDe(usuario))).status, 400);
});

test('token cerrado con logout: 401 sin leer el cuerpo', async () => {
  const token = tokenDe(usuario);
  assert.equal((await request(app).post('/api/auth/logout').set('Authorization', 'Bearer ' + token)).status, 200);
  const res = await mandarRoto(token);
  assert.equal(res.status, 401);
  assert.equal(res.body.error, 'No autenticado');
});

test('token de antes de un cambio de clave: 401 sin leer el cuerpo', async () => {
  const token = tokenDe(usuario);
  db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(usuario.id);
  assert.equal((await mandarRoto(token)).status, 401);
  usuario = db.prepare('SELECT * FROM users WHERE id = ?').get(usuario.id);
});

test('usuario suspendido: 403 sin leer el cuerpo', async () => {
  const token = tokenDe(usuario);
  db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(usuario.id);
  const res = await mandarRoto(token);
  assert.equal(res.status, 403);
  assert.equal(res.body.error, 'Usuario suspendido. Contacte al administrador.');
  db.prepare('UPDATE users SET active = 1 WHERE id = ?').run(usuario.id);
});

test('usuario borrado: 401 sin leer el cuerpo', async () => {
  const token = tokenDe(usuario);
  db.prepare('DELETE FROM users WHERE id = ?').run(usuario.id);
  assert.equal((await mandarRoto(token)).status, 401);
});
