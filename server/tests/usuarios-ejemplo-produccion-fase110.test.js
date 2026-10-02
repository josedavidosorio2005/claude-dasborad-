// usuarios-ejemplo-produccion-fase110.test.js — Fase 110 (URGENTE,
// hallazgo real: los 6 usuarios de ejemplo de server/db.js, con
// contraseña fija en el código de un repo PÚBLICO, seguían activos en
// producción con la contraseña de ejemplo intacta -- cualquiera que leyera
// el repo podía entrar como ADMIN completo o ver los dashboards de todos
// los clientes). Prueba 2 cosas, con NODE_ENV=production desde el
// arranque de ESTE proceso de pruebas (cada archivo de `node --test`
// corre en su propio proceso, mismo patrón que las pruebas de migración
// de este repo):
//   1) base vacía + producción -> la semilla de usuarios de ejemplo NUNCA
//      se crea (antes de este fix, SIEMPRE se creaba, sin importar el
//      entorno).
//   2) red de seguridad al arrancar: una base YA afectada (como la
//      producción real antes de este fix) con alguno de los 6 usuarios
//      todavía activo y con la contraseña de ejemplo -- se suspende solo,
//      queda en el Historial sin la contraseña, es idempotente, y nunca
//      toca una cuenta con otra contraseña, ya suspendida, o que no esté
//      en la lista de los 6.
// Datos SIEMPRE sintéticos -- nunca la contraseña real se imprime aquí
// fuera de este archivo de prueba (ya existía en otros tests, ver
// no-password-leak.test.js/helpers.js).
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const tmpDb = path.join(os.tmpdir(), `inconexion-usuarios-ejemplo-prod-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Pre-siembra SOLO lo necesario para este archivo: `users` con 4 filas
// (una con la contraseña de ejemplo real de "psuarez" -- debe quedar
// suspendida --, una con otra contraseña -- nunca se toca --, una ya
// suspendida con la contraseña de ejemplo -- nunca se vuelve a tocar --,
// y una fuera de la lista de los 6 -- nunca se toca) y `historial` vacío.
// El resto de las tablas las crea db.js normalmente (CREATE TABLE IF NOT
// EXISTS, no colisiona con esta pre-siembra).
const HASH_EJEMPLO_PSUAREZ = bcrypt.hashSync('admin456', 10);
const HASH_OTRA_JHERRERA = bcrypt.hashSync('OtraClaveReal2026!', 10);
const HASH_EJEMPLO_LRIOS = bcrypt.hashSync('aux123', 10);

const pre = new Database(tmpDb);
pre.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    user TEXT NOT NULL UNIQUE,
    rol TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    password_hash TEXT NOT NULL,
    perms TEXT NOT NULL DEFAULT '{}',
    asesorCampana TEXT,
    createdAt TEXT NOT NULL
  );
  CREATE TABLE historial (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    accion TEXT NOT NULL,
    nombre TEXT,
    username TEXT,
    rol TEXT,
    actor TEXT,
    detalle TEXT
  );
`);
const now = '01/10/2026 10:00:00';
const insertUser = pre.prepare(
  `INSERT INTO users (nombre, user, rol, active, password_hash, perms, asesorCampana, createdAt) VALUES (?,?,?,?,?,?,NULL,?)`
);
insertUser.run('Pedro Suarez', 'psuarez', 'ADMIN', 1, HASH_EJEMPLO_PSUAREZ, '{"isAdmin":true}', now);
insertUser.run('Jorge Herrera', 'jherrera', 'GERENCIA', 1, HASH_OTRA_JHERRERA, '{}', now); // contrasena YA cambiada -- nunca se toca
insertUser.run('Laura Rios', 'lrios', 'AUX_ADMIN', 0, HASH_EJEMPLO_LRIOS, '{}', now); // YA suspendida a mano -- nunca se vuelve a tocar
insertUser.run('Usuario Normal', 'unormal', 'CALIDAD', 1, bcrypt.hashSync('cualquiera', 10), '{}', now); // fuera de la lista de los 6
pre.close();

function setEnvDefault(key, value) {
  if (process.env[key] === undefined || process.env[key] === '') process.env[key] = value;
}
setEnvDefault('NODE_ENV', 'production');
setEnvDefault('JWT_SECRET', crypto.randomBytes(48).toString('hex'));
setEnvDefault('JWT_EXPIRES_IN', '1h');
setEnvDefault('MASTER_ADMIN_USER', 'admin');
setEnvDefault('MASTER_ADMIN_PASSWORD_HASH', bcrypt.hashSync('NoUsadaEnEsteTest#1', 10));
setEnvDefault('DB_PATH', tmpDb);
setEnvDefault('TRUST_PROXY', '1');
setEnvDefault('CORS_ORIGIN', 'https://ejemplo-prueba.invalido');
setEnvDefault('RATE_LIMIT_MAX', '10000');
setEnvDefault('LOGIN_RATE_LIMIT_MAX', '10000');

const config = require('../config');
const db = require('../db');

test('config.isProduction queda en true para todo este archivo (precondicion de las pruebas de abajo)', () => {
  assert.equal(config.isProduction, true);
});

test('red de seguridad: "psuarez" (activo, con la contraseña de ejemplo) queda suspendido tras requerir db.js', () => {
  const row = db.prepare('SELECT * FROM users WHERE user = ?').get('psuarez');
  assert.equal(row.active, 0);
});

test('red de seguridad: el Historial registra la suspension automatica, SIN la contraseña', () => {
  const evento = db.prepare("SELECT * FROM historial WHERE username = 'psuarez' AND accion = 'SUSPENDIDO'").get();
  assert.ok(evento, 'debe existir un evento SUSPENDIDO para psuarez');
  assert.match(evento.detalle, /contrase.*ejemplo/i);
  assert.ok(!/admin456/.test(evento.detalle), 'el detalle NUNCA debe contener la contraseña');
  assert.ok(!/admin456/.test(JSON.stringify(evento)), 'ningun campo del evento debe contener la contraseña');
  assert.equal(evento.actor.includes('admin456'), false);
});

test('red de seguridad: "jherrera" (ya tiene OTRA contraseña) queda intacto, activo, sin evento en el Historial', () => {
  const row = db.prepare('SELECT * FROM users WHERE user = ?').get('jherrera');
  assert.equal(row.active, 1);
  assert.equal(row.password_hash, HASH_OTRA_JHERRERA);
  const evento = db.prepare("SELECT * FROM historial WHERE username = 'jherrera'").get();
  assert.equal(evento, undefined);
});

test('red de seguridad: "lrios" (ya estaba suspendida a mano) no genera un evento nuevo (nunca se vuelve a tocar)', () => {
  const row = db.prepare('SELECT * FROM users WHERE user = ?').get('lrios');
  assert.equal(row.active, 0);
  const evento = db.prepare("SELECT * FROM historial WHERE username = 'lrios'").get();
  assert.equal(evento, undefined, 'una cuenta que YA estaba suspendida (por el usuario, a mano) no debe generar un evento automatico nuevo');
});

test('red de seguridad: "unormal" (fuera de la lista de los 6) nunca se toca', () => {
  const row = db.prepare('SELECT * FROM users WHERE user = ?').get('unormal');
  assert.equal(row.active, 1);
});

test('red de seguridad: nunca BORRA usuarios -- los 4 sembrados siguen existiendo', () => {
  const n = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  assert.equal(n, 4);
});

test('idempotente: reabrir la base (segunda corrida real de la red de seguridad) no duplica el evento ni vuelve a tocar nada', () => {
  const antesUsers = db.prepare('SELECT * FROM users ORDER BY id').all();
  const antesHistorial = db.prepare('SELECT * FROM historial ORDER BY id').all();

  delete require.cache[require.resolve('../db')];
  const db2 = require('../db');

  const despuesUsers = db2.prepare('SELECT * FROM users ORDER BY id').all();
  const despuesHistorial = db2.prepare('SELECT * FROM historial ORDER BY id').all();
  assert.deepEqual(despuesUsers, antesUsers);
  assert.deepEqual(despuesHistorial, antesHistorial);
  assert.equal(despuesHistorial.filter((h) => h.username === 'psuarez' && h.accion === 'SUSPENDIDO').length, 1);
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
