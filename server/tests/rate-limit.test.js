// Baja el limite de intentos de login ANTES de cargar helpers/config.
process.env.LOGIN_RATE_LIMIT_MAX = '4';
process.env.LOGIN_RATE_LIMIT_WINDOW_MS = String(60 * 1000);

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, SEED } = require('./helpers');

test('el rate limit de login bloquea tras el maximo de intentos', async () => {
  const max = 4;
  let sawBlocked = false;

  for (let i = 0; i < max + 3; i++) {
    const res = await request(app).post('/api/auth/login').send({ user: 'admin', password: 'mala-contrasena' });
    if (i < max) {
      assert.equal(res.status, 401, `intento ${i + 1} deberia ser 401 (credenciales malas), no ${res.status}`);
    } else {
      if (res.status === 429) sawBlocked = true;
      assert.match(res.body.error, /\d+ minutos?/, 'el mensaje de bloqueo debe decir cuanto falta para reintentar');
    }
  }

  assert.ok(sawBlocked, 'tras superar el maximo de intentos, el login debe responder 429');
});

// Fase 130 (Parte 7): la llave ahora es IP + usuario intentado (antes era
// solo IP) -- agotar el cupo de UN usuario no debe tocar el de otro,
// aunque las peticiones vengan de la misma IP (todas las de este test
// salen del mismo proceso de supertest, misma IP de siempre).
test('dos usuarios distintos desde la misma IP no se bloquean entre si en el login', async () => {
  const max = 4;

  // Agota el cupo de 'crodriguez' a puro fallo.
  for (let i = 0; i < max; i++) {
    const res = await request(app).post('/api/auth/login').send({ user: 'crodriguez', password: 'password-incorrecta' });
    assert.equal(res.status, 401, `intento ${i + 1} contra crodriguez deberia ser 401, no ${res.status}`);
  }
  const bloqueado = await request(app).post('/api/auth/login').send({ user: 'crodriguez', password: 'password-incorrecta' });
  assert.equal(bloqueado.status, 429, 'crodriguez deberia estar bloqueado tras agotar su cupo');

  // mlopez, misma IP (mismo supertest/app), login CORRECTO -- no debe
  // verse afectado por el bloqueo de crodriguez.
  const otroUsuario = await request(app).post('/api/auth/login').send({ user: 'mlopez', password: SEED.mlopez });
  assert.equal(otroUsuario.status, 200, 'un usuario distinto, misma IP, no deberia estar bloqueado');
});
