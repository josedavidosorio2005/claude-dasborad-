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

// Fase 72 (hallazgo N1): un usuario inexistente ya no responde
// "instantaneo" comparado con uno que si existe -- ambos casos hacen un
// bcrypt.compare real, para no dejar inferir por tiempo de respuesta que
// usuarios existen. Se toma la MEDIANA de varias corridas (no el promedio)
// para que un solo pico de latencia del entorno de CI no tumbe el test, y
// se compara contra el mismo umbral relativo que ya usa este tipo de
// verificacion (bcrypt cost 10 domina por completo sobre una consulta a
// SQLite en memoria/local, asi que incluso con jitter la diferencia entre
// "con bcrypt" y "sin bcrypt" es de un orden de magnitud, no de porcentaje).
test('N1: login con usuario inexistente tarda un tiempo comparable a uno que existe (sin fuga por tiempo)', async () => {
  async function medianMs(fn, veces) {
    const tiempos = [];
    for (let i = 0; i < veces; i++) {
      const t0 = process.hrtime.bigint();
      await fn();
      const t1 = process.hrtime.bigint();
      tiempos.push(Number(t1 - t0) / 1e6);
    }
    tiempos.sort((a, b) => a - b);
    return tiempos[Math.floor(tiempos.length / 2)];
  }

  const tInexistente = await medianMs(() => login('fantasma_timing_' + Math.random(), 'loquesea1234'), 5);
  const tExistenteMalaClave = await medianMs(() => login('psuarez', 'clave-mala-a-proposito'), 5);

  // Antes del fix, tInexistente no llamaba a bcrypt.compare y era muchas
  // veces mas rapido (tipicamente <5ms vs >40ms). Con el fix, ambos hacen
  // el mismo bcrypt.compare -- exigimos que el inexistente sea al menos la
  // MITAD de lento que el existente (nunca "casi instantaneo" en
  // comparacion), con margen generoso para CI.
  assert.ok(
    tInexistente >= tExistenteMalaClave * 0.5,
    `usuario inexistente (${tInexistente.toFixed(1)}ms) fue mucho mas rapido que uno existente (${tExistenteMalaClave.toFixed(1)}ms) -- posible fuga por tiempo`
  );
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
