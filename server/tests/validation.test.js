const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const base = { nombre: 'Valido', user: 'validouser', password: 'ClaveSegura123', rol: 'CALIDAD', perms: {} };

test('user con espacios -> 400', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/users').set(auth(t)).send({ ...base, user: 'con espacio' });
  assert.equal(res.status, 400);
});

test('user con caracteres raros -> 400', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/users').set(auth(t)).send({ ...base, user: 'ju@n!' });
  assert.equal(res.status, 400);
});

test('rol fuera de la lista -> 400', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/users').set(auth(t)).send({ ...base, user: 'roluser', rol: 'SUPERJEFE' });
  assert.equal(res.status, 400);
});

test('password corta (< 8) -> 400 al crear', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/users').set(auth(t)).send({ ...base, user: 'shortpw', password: 'abc12' });
  assert.equal(res.status, 400);
});

test('password corta -> 400 al cambiar contrasena', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const list = await request(app).get('/api/users').set(auth(t));
  const id = list.body[0].id;
  const res = await request(app).put(`/api/users/${id}/password`).set(auth(t)).send({ password: '1234' });
  assert.equal(res.status, 400);
});

test('perms con valor no booleano -> 400', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/users').set(auth(t)).send({ ...base, user: 'permsbad', perms: { Calidad: 'si' } });
  assert.equal(res.status, 400);
});

test('id no numerico -> 400', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).put('/api/users/abc').set(auth(t)).send({ nombre: 'X' });
  assert.equal(res.status, 400);
});

test('JSON malformado -> 400', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app)
    .post('/api/users')
    .set(auth(t))
    .set('Content-Type', 'application/json')
    .send('{ esto no es json');
  assert.equal(res.status, 400);
});

test('payload valido -> 201', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app)
    .post('/api/users')
    .set(auth(t))
    .send({ ...base, user: 'okuser_' + Date.now() });
  assert.equal(res.status, 201);
  await request(app).delete(`/api/users/${res.body.id}`).set(auth(t));
});
