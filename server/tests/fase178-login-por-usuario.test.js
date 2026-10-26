// fase178-login-por-usuario.test.js — Fase 178, punto 6 de la auditoria de
// v1.72.1: segundo limite de login SOLO por usuario intentado (sin IP). Baja
// el limite ANTES de cargar helpers/config (mismo patron que
// rate-limit.test.js) y confia en X-Forwarded-For para simular muchas IP.
process.env.LOGIN_RATE_LIMIT_USUARIO_MAX = '5';
process.env.LOGIN_RATE_LIMIT_USUARIO_WINDOW_MS = String(60 * 60 * 1000);
process.env.LOGIN_RATE_LIMIT_MAX = '3'; // el de IP + usuario sigue igual
process.env.TRUST_PROXY = '1';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, SEED, db } = require('./helpers');

const login = (user, password, ip) => request(app).post('/api/auth/login').set('X-Forwarded-For', ip).send({ user, password });
const bloqueos = (user) => db.prepare(`SELECT COUNT(*) AS n FROM historial WHERE accion = 'LOGIN_BLOQUEADO' AND username = ?`).get(user).n;

test('muchas IP contra una sola cuenta: tras el tope por usuario responde 429, aunque la contrasena sea la correcta', async () => {
  // 5 fallidos, cada uno desde una IP distinta (el limite por IP nunca salta).
  for (let i = 0; i < 5; i++) {
    const r = await login('crodriguez', 'mala-' + i, `10.0.0.${i + 1}`);
    assert.equal(r.status, 401, `intento ${i + 1}`);
  }
  const bloqueado = await login('crodriguez', 'mala-x', '10.0.1.1');
  assert.equal(bloqueado.status, 429);
  assert.match(bloqueado.body.error, /Demasiados intentos\. Intenta de nuevo en \d+ minutos?\./);
  // Mientras dure la ventana, ni la contrasena correcta entra (desde otra IP).
  const correcta = await login('crodriguez', SEED.crodriguez, '10.0.2.1');
  assert.equal(correcta.status, 429);
});

test('el bloqueo queda UNA vez en el Historial (no uno por intento), con el usuario y sin la contrasena', async () => {
  assert.equal(bloqueos('crodriguez'), 1);
  await login('crodriguez', 'mala-y', '10.0.3.1');
  assert.equal(bloqueos('crodriguez'), 1);
  const h = db.prepare(`SELECT * FROM historial WHERE accion = 'LOGIN_BLOQUEADO' AND username = 'crodriguez'`).get();
  assert.match(h.detalle, /^5 intentos fallidos en 60 min/);
  assert.ok(!/mala/.test(JSON.stringify(h)), 'nunca la contrasena probada');
  assert.equal(h.ip, '10.0.1.1');
});

test('otra cuenta no se ve afectada, y los logins correctos no cuentan para el tope', async () => {
  for (let i = 0; i < 8; i++) {
    const r = await login('mlopez', SEED.mlopez, `10.1.0.${i + 1}`);
    assert.equal(r.status, 200, `login correcto ${i + 1}`);
  }
  assert.equal(bloqueos('mlopez'), 0);
});

test('mayusculas y espacios cuentan como la misma cuenta', async () => {
  for (let i = 0; i < 5; i++) await login(i % 2 ? ' JHERRERA ' : 'jherrera', 'mala-' + i, `10.2.0.${i + 1}`);
  const r = await login('JHerrera', 'mala-z', '10.2.1.1');
  assert.equal(r.status, 429);
});

// Fase 180: el admin maestro (nombre exacto) no entra en el tope por usuario:
// muchos fallidos desde muchas IP no lo dejan fuera. El limite por IP +
// usuario (loginLimiter) sigue igual para el.
test('Fase 180: el admin maestro no se bloquea por el tope por usuario; variantes de su nombre si cuentan', async () => {
  const { MASTER_PASSWORD } = require('./helpers');
  for (let i = 0; i < 12; i++) {
    const r = await login('admin', 'mala-' + i, `10.3.0.${i + 1}`);
    assert.equal(r.status, 401, `intento ${i + 1}`);
  }
  const ok = await login('admin', MASTER_PASSWORD, '10.3.1.1');
  assert.equal(ok.status, 200, 'el maestro entra con su contrasena');
  assert.equal(bloqueos('admin'), 0);
  // " ADMIN " no es el maestro (el login compara el nombre exacto): cuenta.
  for (let i = 0; i < 5; i++) await login(' ADMIN ', 'mala-' + i, `10.4.0.${i + 1}`);
  assert.equal((await login(' ADMIN ', 'mala-z', '10.4.1.1')).status, 429);
});

test('Fase 180: el limite por IP + usuario sigue aplicando al admin maestro', async () => {
  for (let i = 0; i < 3; i++) assert.equal((await login('admin', 'mala-ip-' + i, '10.5.0.1')).status, 401);
  assert.equal((await login('admin', 'mala-ip-x', '10.5.0.1')).status, 429);
});
