// seed-vacia-produccion-fase110.test.js — Fase 110 (URGENTE): completa el
// primer caso descrito en usuarios-ejemplo-produccion-fase110.test.js que
// ese archivo no cubre (ahi la base YA viene pre-sembrada con 4 filas para
// probar la red de seguridad). Aqui la base arranca COMPLETAMENTE VACIA,
// con NODE_ENV=production desde el arranque de este proceso de pruebas
// (mismo patron: cada archivo de `node --test` corre en su propio
// proceso) -- antes de este fix, la semilla de los 6 usuarios de ejemplo
// se creaba SIEMPRE sin importar el entorno; ahora, en produccion, no debe
// crear ninguno.
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const tmpDb = path.join(os.tmpdir(), `inconexion-seed-vacia-prod-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

function setEnvDefault(key, value) {
  if (process.env[key] === undefined || process.env[key] === '') process.env[key] = value;
}
setEnvDefault('NODE_ENV', 'production');
setEnvDefault('JWT_SECRET', crypto.randomBytes(48).toString('hex'));
setEnvDefault('JWT_EXPIRES_IN', '1h');
setEnvDefault('MASTER_ADMIN_USER', 'admin');
setEnvDefault('MASTER_ADMIN_PASSWORD_HASH', bcrypt.hashSync('NoUsadaEnEsteTest#2', 10));
setEnvDefault('DB_PATH', tmpDb);
setEnvDefault('TRUST_PROXY', '1');
setEnvDefault('CORS_ORIGIN', 'https://ejemplo-prueba.invalido');
setEnvDefault('RATE_LIMIT_MAX', '10000');
setEnvDefault('LOGIN_RATE_LIMIT_MAX', '10000');

const config = require('../config');
const db = require('../db');

test('config.isProduction queda en true para todo este archivo (precondicion de la prueba de abajo)', () => {
  assert.equal(config.isProduction, true);
});

test('base vacia + produccion: la semilla de usuarios de ejemplo nunca se crea', () => {
  const n = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  assert.equal(n, 0, 'en produccion, una base vacia debe quedar con 0 usuarios -- el unico usuario valido es el admin maestro, que no vive en esta tabla');
});

test('ninguno de los 6 usuarios de ejemplo existe por nombre en una base vacia + produccion', () => {
  const nombres = ['crodriguez', 'mlopez', 'jherrera', 'agomez', 'lrios', 'psuarez'];
  for (const u of nombres) {
    const row = db.prepare('SELECT * FROM users WHERE user = ?').get(u);
    assert.equal(row, undefined, `"${u}" no deberia existir en una base vacia en produccion`);
  }
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
