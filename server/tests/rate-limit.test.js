// Baja el limite de intentos de login ANTES de cargar helpers/config.
process.env.LOGIN_RATE_LIMIT_MAX = '4';
process.env.LOGIN_RATE_LIMIT_WINDOW_MS = String(60 * 1000);

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app } = require('./helpers');

test('el rate limit de login bloquea tras el maximo de intentos', async () => {
  const max = 4;
  let sawBlocked = false;

  for (let i = 0; i < max + 3; i++) {
    const res = await request(app).post('/api/auth/login').send({ user: 'admin', password: 'mala-contrasena' });
    if (i < max) {
      assert.equal(res.status, 401, `intento ${i + 1} deberia ser 401 (credenciales malas), no ${res.status}`);
    } else {
      if (res.status === 429) sawBlocked = true;
    }
  }

  assert.ok(sawBlocked, 'tras superar el maximo de intentos, el login debe responder 429');
});
