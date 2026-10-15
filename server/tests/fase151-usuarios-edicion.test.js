// fase151-usuarios-edicion.test.js — Fase 151: "Editar usuario" (PUT
// /users/:id) respeta los mismos limites que la ruta dedicada de contrasena:
// solo un administrador completo edita una cuenta ADMIN o AUX_ADMIN, y una
// contrasena nueva cierra las sesiones abiertas de esa cuenta.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, login, tokenFor, MASTER_PASSWORD, SEED } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const AUX = { user: 'aux151', password: 'AuxClave#151x' };
let adminToken;
let auxToken;
let idAdmin;

before(async () => {
  adminToken = await tokenFor('admin', MASTER_PASSWORD);
  const crear = await request(app).post('/api/users').set(auth(adminToken)).send({
    nombre: 'Aux Prueba', user: AUX.user, password: AUX.password, rol: 'AUX_ADMIN',
    perms: { crearUsuarios: true, editarUsuarios: true, cambiarPassword: true },
  });
  assert.equal(crear.status, 201);
  auxToken = await tokenFor(AUX.user, AUX.password);
  idAdmin = db.prepare("SELECT id FROM users WHERE user = 'psuarez'").get().id;
});

test('AUX_ADMIN no puede cambiar la contrasena de un ADMIN desde "Editar usuario"', async () => {
  const hashAntes = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(idAdmin).password_hash;
  const res = await request(app).put(`/api/users/${idAdmin}`).set(auth(auxToken)).send({ password: 'Tomada#151xyz' });
  assert.equal(res.status, 403);
  assert.equal(db.prepare('SELECT password_hash FROM users WHERE id = ?').get(idAdmin).password_hash, hashAntes);
  assert.equal((await login('psuarez', 'Tomada#151xyz')).status, 401);
});

test('AUX_ADMIN no puede cambiar nombre ni usuario de un ADMIN o de otro AUX_ADMIN', async () => {
  const r1 = await request(app).put(`/api/users/${idAdmin}`).set(auth(auxToken)).send({ user: 'psuarez2' });
  assert.equal(r1.status, 403);
  const r2 = await request(app).put(`/api/users/${idAdmin}`).set(auth(auxToken)).send({ nombre: 'Otro' });
  assert.equal(r2.status, 403);
  const otroAux = await request(app).post('/api/users').set(auth(adminToken)).send({
    nombre: 'Aux Dos', user: 'aux151b', password: 'AuxClave#151y', rol: 'AUX_ADMIN', perms: {},
  });
  const r3 = await request(app).put(`/api/users/${otroAux.body.id}`).set(auth(auxToken)).send({ password: 'Tomada#151abc' });
  assert.equal(r3.status, 403);
});

test('AUX_ADMIN sigue pudiendo editar a un usuario comun (sin perder acceso legitimo)', async () => {
  const id = db.prepare("SELECT id FROM users WHERE user = 'mlopez'").get().id;
  const res = await request(app).put(`/api/users/${id}`).set(auth(auxToken)).send({ nombre: 'Maria Lopez Editada' });
  assert.equal(res.status, 200);
  assert.equal(res.body.nombre, 'Maria Lopez Editada');
});

test('el administrador completo sigue pudiendo editar una cuenta ADMIN', async () => {
  const res = await request(app).put(`/api/users/${idAdmin}`).set(auth(adminToken)).send({ nombre: 'Pedro Suarez' });
  assert.equal(res.status, 200);
});

test('contrasena nueva desde "Editar usuario" cierra las sesiones abiertas de esa cuenta', async () => {
  const id = db.prepare("SELECT id FROM users WHERE user = 'jherrera'").get().id;
  const tokenViejo = await tokenFor('jherrera', SEED.jherrera);
  assert.equal((await request(app).get('/api/users').set(auth(tokenViejo))).status, 200);
  const res = await request(app).put(`/api/users/${id}`).set(auth(adminToken)).send({ password: 'NuevaClave#151z' });
  assert.equal(res.status, 200);
  assert.equal((await request(app).get('/api/users').set(auth(tokenViejo))).status, 401);
  assert.equal((await login('jherrera', 'NuevaClave#151z')).status, 200);
});

test('editar sin contrasena NO cierra las sesiones abiertas', async () => {
  const id = db.prepare("SELECT id FROM users WHERE user = 'crodriguez'").get().id;
  const t = await tokenFor('crodriguez', SEED.crodriguez);
  const res = await request(app).put(`/api/users/${id}`).set(auth(adminToken)).send({ nombre: 'Carlos R.' });
  assert.equal(res.status, 200);
  assert.equal((await request(app).get('/api/users').set(auth(t))).status, 200);
});
