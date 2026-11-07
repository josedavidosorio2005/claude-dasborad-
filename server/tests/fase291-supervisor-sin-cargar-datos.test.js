// fase291-supervisor-sin-cargar-datos.test.js — Fase 291 (revision del 07/11, #14): al
// guardar un SUPERVISOR (crear, editar o cambiar permisos), «Puede cargar datos» general
// (cargarDatos) queda en false: carga bases solo de los clientes que supervisa. Los
// demas roles no cambian (REPORTES sigue con cargarDatos). Cuentas SINTETICAS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { app, db, request, tokenFor, MASTER_PASSWORD } = require('./helpers');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const CLAVE = 'ClavePrueba1234';
const permsDe = (id) => JSON.parse(db.prepare('SELECT perms FROM users WHERE id = ?').get(id).perms);
async function crear(rol, perms) {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const user = 'p291_' + Math.random().toString(36).slice(2, 8);
  const r = await request(app).post('/api/users').set(H(admin)).send({ nombre: 'Cuenta Sintética', user, password: CLAVE, rol, perms });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { id: r.body.id, user };
}

test('crear un SUPERVISOR con cargarDatos: queda en false', async () => {
  const s = await crear('SUPERVISOR', { cargarDatos: true, supervisa_ORLANT: true });
  assert.equal(permsDe(s.id).cargarDatos, false);
  assert.equal(permsDe(s.id).supervisa_ORLANT, true);
});

test('editar (PUT /users/:id) y cambiar permisos (PUT /users/:id/perms) de un SUPERVISOR: false', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const s = await crear('SUPERVISOR', { supervisa_MOBILIZE: true });
  // Una cuenta vieja con el permiso general (como si viniera de antes de la Fase 283).
  db.prepare('UPDATE users SET perms = ? WHERE id = ?').run(JSON.stringify({ supervisa_MOBILIZE: true, cargarDatos: true }), s.id);
  const e = await request(app).put('/api/users/' + s.id).set(H(admin)).send({ nombre: 'Cuenta Sintética', user: s.user, rol: 'SUPERVISOR', perms: { supervisa_MOBILIZE: true, cargarDatos: true } });
  assert.equal(e.status, 200, JSON.stringify(e.body));
  assert.equal(permsDe(s.id).cargarDatos, false);
  const p = await request(app).put('/api/users/' + s.id + '/perms').set(H(admin)).send({ perms: { supervisa_MOBILIZE: true, cargarDatos: true } });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.equal(permsDe(s.id).cargarDatos, false);
  // Sigue cargando, pero solo de su cliente: /dashboard/cargas no lista otros clientes.
  const tok = await tokenFor(s.user, CLAVE);
  const c = await request(app).get('/api/dashboard/cargas').set(H(tok));
  assert.equal(c.status, 200);
  assert.ok(c.body.every((x) => x.cliente === 'MOBILIZE'), JSON.stringify(c.body.map((x) => x.cliente)));
});

test('los demas roles no cambian: REPORTES con cargarDatos, CALIDAD como se guarde', async () => {
  const r = await crear('REPORTES', { campana_ORLANT: true });
  assert.equal(permsDe(r.id).cargarDatos, true);
  const c = await crear('CALIDAD', { campana_ORLANT: true, cargarDatos: true });
  assert.equal(permsDe(c.id).cargarDatos, true);
});

test('el formulario de Usuarios manda cargarDatos: false para un SUPERVISOR', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'users.js'), 'utf8');
  assert.match(js, /if\(rol==='SUPERVISOR'\) payload\.perms\.cargarDatos=false;/);
  assert.match(js, /newPerms\.cargarDatos = rol==='SUPERVISOR' \? false : document\.getElementById\('mu-cargar-datos'\)\.checked;/);
});
