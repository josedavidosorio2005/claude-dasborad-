const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

// Ninguna respuesta de la API debe contener el hash de contrasena ni la columna
// password_hash. Revisamos el texto CRUDO de la respuesta, no solo el JSON.
function assertNoSecrets(res, label) {
  const raw = res.text || JSON.stringify(res.body);
  assert.ok(!/password_hash/i.test(raw), `${label}: no debe aparecer "password_hash"`);
  assert.ok(!/\$2[aby]\$\d{2}\$/.test(raw), `${label}: no debe aparecer un hash bcrypt`);
  assert.ok(!/"password"\s*:/.test(raw), `${label}: no debe devolverse "password"`);
}

test('GET /api/users no filtra hashes', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).get('/api/users').set(auth(t));
  assert.equal(res.status, 200);
  assertNoSecrets(res, 'GET /api/users');
});

test('POST /api/users (respuesta de creacion) no filtra hashes', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app)
    .post('/api/users')
    .set(auth(t))
    .send({ nombre: 'Sin Fuga', user: 'sinfuga_' + Date.now(), password: 'ClaveSegura123', rol: 'CALIDAD', perms: {} });
  assert.equal(res.status, 201);
  assertNoSecrets(res, 'POST /api/users');
  await request(app).delete(`/api/users/${res.body.id}`).set(auth(t));
});

test('PUT /api/users/:id no filtra hashes', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const list = await request(app).get('/api/users').set(auth(t));
  const id = list.body[0].id;
  const res = await request(app).put(`/api/users/${id}`).set(auth(t)).send({ password: 'RotarClave789' });
  assert.equal(res.status, 200);
  assertNoSecrets(res, 'PUT /api/users/:id');
});

test('login (master y normal) no filtra hashes', async () => {
  const m = await request(app).post('/api/auth/login').send({ user: 'admin', password: MASTER_PASSWORD });
  assertNoSecrets(m, 'login master');
  const n = await request(app).post('/api/auth/login').send({ user: 'psuarez', password: 'admin456' });
  assertNoSecrets(n, 'login normal');
});

test('GET /api/historial no filtra hashes', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).get('/api/historial').set(auth(t));
  assert.equal(res.status, 200);
  assertNoSecrets(res, 'GET /api/historial');
});
