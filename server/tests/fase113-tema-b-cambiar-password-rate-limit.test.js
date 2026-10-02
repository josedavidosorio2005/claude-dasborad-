// Fase 113 (tema B): limite de intentos propio de "cambiar mi contrasena"
// -- mismo patron que tests/rate-limit.test.js (baja el limite ANTES de
// cargar helpers/config, en su propio archivo/proceso de node --test).
process.env.LOGIN_RATE_LIMIT_MAX = '4';
process.env.LOGIN_RATE_LIMIT_WINDOW_MS = String(60 * 1000);

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, SEED } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

test('cambiar mi contrasena: el limite de intentos propio bloquea tras varios fallos seguidos (nunca sirve para adivinar la contrasena actual)', async () => {
  const max = 4;
  const t = await tokenFor('jherrera', SEED.jherrera);
  let sawBlocked = false;

  for (let i = 0; i < max + 3; i++) {
    const res = await request(app)
      .put('/api/auth/password')
      .set(auth(t))
      .send({ currentPassword: 'clave-mala-' + i, newPassword: 'NuevaClaveValida123' });
    if (i < max) {
      assert.equal(res.status, 401, `intento ${i + 1} deberia ser 401 (contrasena actual mala), no ${res.status}`);
    } else if (res.status === 429) {
      sawBlocked = true;
    }
  }

  assert.ok(sawBlocked, 'tras superar el maximo de intentos, el endpoint debe responder 429');
});
