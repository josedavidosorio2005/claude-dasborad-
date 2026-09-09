// tests/helpers.js — Entorno de pruebas aislado.
//
// Cada archivo de test se ejecuta en su propio proceso (node --test), asi que
// aqui fijamos variables de entorno ANTES de cargar config/db/app y usamos una
// base de datos SQLite temporal y unica por corrida (se borra al terminar).
const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Contrasena conocida del admin maestro para las pruebas.
const MASTER_PASSWORD = 'MasterTest#2026';

function setEnvDefault(key, value) {
  if (process.env[key] === undefined || process.env[key] === '') {
    process.env[key] = value;
  }
}

const tmpDb = path.join(
  os.tmpdir(),
  `inconexion-test-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`
);

setEnvDefault('NODE_ENV', 'test');
setEnvDefault('JWT_SECRET', crypto.randomBytes(48).toString('hex'));
setEnvDefault('JWT_EXPIRES_IN', '1h');
setEnvDefault('MASTER_ADMIN_USER', 'admin');
setEnvDefault('MASTER_ADMIN_PASSWORD_HASH', bcrypt.hashSync(MASTER_PASSWORD, 10));
setEnvDefault('DB_PATH', tmpDb);
setEnvDefault('TRUST_PROXY', 'false');
// Limites altos por defecto para no interferir con las pruebas funcionales;
// el test de rate-limit los baja antes de requerir este modulo.
setEnvDefault('RATE_LIMIT_MAX', '10000');
setEnvDefault('LOGIN_RATE_LIMIT_MAX', '10000');

const { createApp } = require('../server');
const db = require('../db');

const app = createApp();

// Contrasenas de los usuarios semilla (definidas en db.js).
const SEED = {
  crodriguez: 'calidad123',
  mlopez: 'inv123',
  jherrera: 'ger123',
  agomez: 'cli123',
  lrios: 'aux123', // AUX_ADMIN sin ningun permiso de administracion
  psuarez: 'admin456', // ADMIN completo
};

const request = require('supertest');

async function login(user, password) {
  const res = await request(app).post('/api/auth/login').send({ user, password });
  return res;
}

async function tokenFor(user, password) {
  const res = await login(user, password);
  if (res.status !== 200) {
    throw new Error(`login fallo para ${user}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.token;
}

function cleanup() {
  try {
    db.closeDb();
  } catch (_) {}
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.unlinkSync(tmpDb + suffix);
    } catch (_) {}
  }
}

process.on('exit', cleanup);

module.exports = {
  app,
  db,
  request,
  login,
  tokenFor,
  cleanup,
  MASTER_PASSWORD,
  SEED,
};
