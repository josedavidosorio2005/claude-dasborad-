const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, login, MASTER_PASSWORD } = require('./helpers');

test('admin maestro: login correcto devuelve token', async () => {
  const res = await login('admin', MASTER_PASSWORD);
  assert.equal(res.status, 200);
  assert.ok(res.body.token, 'debe venir un token');
  assert.equal(res.body.user.isMasterAdmin, true);
});

test('admin maestro: contrasena incorrecta -> 401', async () => {
  const res = await login('admin', 'contrasena-mala');
  assert.equal(res.status, 401);
  assert.ok(!res.body.token);
});

test('usuario normal (semilla): login correcto', async () => {
  const res = await login('psuarez', 'admin456');
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  assert.equal(res.body.user.user, 'psuarez');
});

test('usuario normal: contrasena incorrecta -> 401', async () => {
  const res = await login('crodriguez', 'nope');
  assert.equal(res.status, 401);
});

test('usuario inexistente -> 401', async () => {
  const res = await login('fantasma', 'loquesea1234');
  assert.equal(res.status, 401);
});

test('login sin campos -> 400', async () => {
  const res = await request(app).post('/api/auth/login').send({});
  assert.equal(res.status, 400);
});

test('usuario suspendido no puede iniciar sesion -> 403', async () => {
  const adminToken = (await login('admin', MASTER_PASSWORD)).body.token;
  const list = await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`);
  const target = list.body.find((u) => u.user === 'agomez');
  assert.ok(target, 'usuario semilla agomez debe existir');

  const susp = await request(app)
    .put(`/api/users/${target.id}/active`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(susp.status, 200);
  assert.equal(susp.body.active, false);

  const res = await login('agomez', 'cli123');
  assert.equal(res.status, 403);

  // reactivar para no afectar otras pruebas del mismo archivo
  await request(app).put(`/api/users/${target.id}/active`).set('Authorization', `Bearer ${adminToken}`);
});

test('endpoint protegido sin token -> 401', async () => {
  const res = await request(app).get('/api/users');
  assert.equal(res.status, 401);
});

test('endpoint protegido con token invalido -> 401', async () => {
  const res = await request(app).get('/api/users').set('Authorization', 'Bearer no-es-un-jwt');
  assert.equal(res.status, 401);
});
