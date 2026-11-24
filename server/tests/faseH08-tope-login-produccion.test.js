// H-08 (hallazgo L-03 de la auditoría de la Fase 151): en producción el límite de intentos de login
// nunca pasa del valor del código, aunque la configuración del servidor diga otro más alto.
// Cada caso carga config.js en un proceso aparte, con su propio entorno, sin secretos reales.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const SERVER = path.join(__dirname, '..');

function cargarConfig(extra) {
  const env = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot || '',
    JWT_SECRET: 'x'.repeat(48),
    MASTER_ADMIN_PASSWORD_HASH: '$2a$10$' + 'a'.repeat(53),
    CORS_ORIGIN: 'https://example.com',
    ...extra,
  };
  const r = spawnSync(process.execPath, ['-e', "process.stdout.write(JSON.stringify(require('./config').loginRateLimit))"], { cwd: SERVER, env, encoding: 'utf8' });
  assert.equal(r.status, 0, 'config.js debe arrancar: ' + r.stderr);
  return { limite: JSON.parse(r.stdout), avisos: r.stderr };
}

test('producción: un límite más alto que el del código se baja al tope y avisa al arrancar', () => {
  const { limite, avisos } = cargarConfig({ NODE_ENV: 'production', LOGIN_RATE_LIMIT_MAX: '20', LOGIN_RATE_LIMIT_USUARIO_MAX: '100' });
  assert.equal(limite.max, 10);
  assert.equal(limite.usuarioMax, 30);
  assert.match(avisos, /LOGIN_RATE_LIMIT_MAX=20 supera el tope de producción \(10\)/);
  assert.match(avisos, /LOGIN_RATE_LIMIT_USUARIO_MAX=100 supera el tope de producción \(30\)/);
});

test('producción: sin configuración se usan los valores del código, sin avisos', () => {
  const { limite, avisos } = cargarConfig({ NODE_ENV: 'production' });
  assert.equal(limite.max, 10);
  assert.equal(limite.usuarioMax, 30);
  assert.doesNotMatch(avisos, /supera el tope/);
});

test('producción: un límite más bajo que el tope se respeta', () => {
  const { limite } = cargarConfig({ NODE_ENV: 'production', LOGIN_RATE_LIMIT_MAX: '5', LOGIN_RATE_LIMIT_USUARIO_MAX: '12' });
  assert.equal(limite.max, 5);
  assert.equal(limite.usuarioMax, 12);
});

test('fuera de producción (pruebas y CI) el valor configurado no se toca', () => {
  for (const NODE_ENV of ['test', 'development']) {
    const { limite, avisos } = cargarConfig({ NODE_ENV, LOGIN_RATE_LIMIT_MAX: '100000', LOGIN_RATE_LIMIT_USUARIO_MAX: '100000' });
    assert.equal(limite.max, 100000, NODE_ENV);
    assert.equal(limite.usuarioMax, 100000, NODE_ENV);
    assert.doesNotMatch(avisos, /supera el tope/);
  }
});
