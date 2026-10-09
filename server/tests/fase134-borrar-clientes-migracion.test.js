// fase134-borrar-clientes-migracion.test.js — prueba la migracion
// `fase134_borrar_clientes_v1` (server/db.js), Fase 134 (decision del
// usuario, 2026-10-09): "dejar SOLO 2 clientes, ORLANT y MOBILIZE. Todos
// los demas clientes/dashboards se BORRAN". Mismo patron que el resto de
// pruebas de migracion de este archivo: sembrar el estado VIEJO a mano
// (tablas minimas, representativas de las 19 que toca la migracion real)
// *antes* de requerir db.js, verificar "despues", y reabrir la base para
// probar idempotencia.
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const tmpDb = path.join(os.tmpdir(), `inconexion-fase134-borrar-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

const pre = new Database(tmpDb);
pre.exec(`
  CREATE TABLE dashboards_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente TEXT NOT NULL UNIQUE,
    titulo TEXT NOT NULL,
    vista TEXT,
    secciones TEXT NOT NULL,
    layout TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  CREATE TABLE calidad_plantillas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campana TEXT NOT NULL UNIQUE,
    engine TEXT NOT NULL DEFAULT 'standard',
    items TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    updatedAt TEXT NOT NULL
  );
  CREATE TABLE monitoreos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campana TEXT NOT NULL,
    asesor TEXT NOT NULL,
    fecha TEXT NOT NULL,
    mes TEXT NOT NULL,
    canal TEXT NOT NULL DEFAULT 'LLAMADA',
    idLlamada TEXT,
    telefono TEXT,
    codificacion TEXT,
    evaluador TEXT NOT NULL,
    evaluadorUserId INTEGER,
    answers TEXT NOT NULL,
    puntaje REAL,
    clasificacion TEXT,
    fallos INTEGER,
    nivelCritico TEXT,
    observaciones TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT
  );
  CREATE TABLE dashboard_cargas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente TEXT NOT NULL,
    seccion TEXT NOT NULL,
    cadencia TEXT NOT NULL,
    periodo TEXT NOT NULL,
    filas TEXT NOT NULL,
    archivoNombre TEXT,
    cargadoPor INTEGER,
    cargadoPorNombre TEXT,
    cargadoEn TEXT NOT NULL,
    UNIQUE(cliente, seccion, periodo)
  );
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
`);
const now = '09/10/2026 00:00:00';

function insertDashboard(cliente) {
  pre.prepare(
    `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
     VALUES (?,?,?,?,?,1,?,?)`
  ).run(cliente, 'Dashboard ' + cliente, null, '{}', JSON.stringify({ kpis: [], tabs: [] }), now, now);
}
['HOSPITAL LA MARIA', 'CLINICA AURORA', 'ORLANT', 'MOBILIZE'].forEach(insertDashboard);

function insertPlantilla(campana) {
  pre.prepare(`INSERT INTO calidad_plantillas (campana, engine, items, activo, updatedAt) VALUES (?,?,?,1,?)`).run(
    campana,
    'standard',
    JSON.stringify([{ n: 1, cat: 'X', label: 'Item', weight: 100, critico: false }]),
    now
  );
}
['CARTERA INTERNA', 'ORLANT', 'MOBILIZE'].forEach(insertPlantilla);

pre.prepare(
  `INSERT INTO monitoreos (campana, asesor, fecha, mes, canal, evaluador, answers, createdAt) VALUES (?,?,?,?,?,?,?,?)`
).run('CARTERA INTERNA', 'Asesor de prueba', '2026-09-01', '2026-09', 'LLAMADA', 'Evaluador', '{"1":"SI"}', now);
pre.prepare(
  `INSERT INTO monitoreos (campana, asesor, fecha, mes, canal, evaluador, answers, createdAt) VALUES (?,?,?,?,?,?,?,?)`
).run('ORLANT', 'Asesor de prueba', '2026-09-01', '2026-09', 'LLAMADA', 'Evaluador', '{"1":"SI"}', now);

pre.prepare(
  `INSERT INTO dashboard_cargas (cliente, seccion, cadencia, periodo, filas, cargadoEn) VALUES (?,?,?,?,?,?)`
).run('HOSPITAL LA MARIA', 'resumen', 'mensual', '2026-09', '[]', now);
pre.prepare(
  `INSERT INTO dashboard_cargas (cliente, seccion, cadencia, periodo, filas, cargadoEn) VALUES (?,?,?,?,?,?)`
).run('MOBILIZE', 'notas', 'mensual', '2026-09', '[]', now);

// 4 usuarios que cubren los 4 casos de Paso 2:
// - con_hospital: tiene HOSPITAL LA MARIA (a borrar) Y ORLANT -- conserva ORLANT.
// - solo_cartera: tiene SOLO CARTERA INTERNA (a borrar) -- queda sin ningun
//   acceso campana_*/cliente_*, pero el USUARIO NUNCA se borra ni se suspende.
// - solo_orlant: sin ningun cliente a borrar -- queda exactamente igual.
// - asesor_hlm: asesorCampana = 'HOSPITAL LA MARIA' (campo libre) -- Paso 2
//   dice que esto NO se toca (no es un permiso campana_*/cliente_*).
pre.prepare(
  `INSERT INTO users (nombre, user, rol, active, password_hash, perms, asesorCampana, createdAt) VALUES (?,?,?,1,?,?,NULL,?)`
).run('Con Hospital', 'f134_con_hospital', 'CLIENTES_DASH', 'hash-no-real',
  JSON.stringify({ ClientesDash: true, ['cliente_HOSPITAL LA MARIA']: true, cliente_ORLANT: true }), now);
pre.prepare(
  `INSERT INTO users (nombre, user, rol, active, password_hash, perms, asesorCampana, createdAt) VALUES (?,?,?,1,?,?,NULL,?)`
).run('Solo Cartera', 'f134_solo_cartera', 'CALIDAD', 'hash-no-real',
  JSON.stringify({ Calidad: true, ['campana_CARTERA INTERNA']: true }), now);
pre.prepare(
  `INSERT INTO users (nombre, user, rol, active, password_hash, perms, asesorCampana, createdAt) VALUES (?,?,?,1,?,?,NULL,?)`
).run('Solo Orlant', 'f134_solo_orlant', 'CALIDAD', 'hash-no-real',
  JSON.stringify({ Calidad: true, campana_ORLANT: true }), now);
pre.prepare(
  `INSERT INTO users (nombre, user, rol, active, password_hash, perms, asesorCampana, createdAt) VALUES (?,?,?,1,?,?,?,?)`
).run('Asesor HLM', 'f134_asesor_hlm', 'ASESOR', 'hash-no-real', JSON.stringify({}), 'HOSPITAL LA MARIA', now);

pre.close();

function setEnvDefault(key, value) {
  if (process.env[key] === undefined || process.env[key] === '') process.env[key] = value;
}
setEnvDefault('NODE_ENV', 'test');
setEnvDefault('JWT_SECRET', crypto.randomBytes(48).toString('hex'));
setEnvDefault('JWT_EXPIRES_IN', '1h');
setEnvDefault('MASTER_ADMIN_USER', 'admin');
const bcrypt = require('bcryptjs');
setEnvDefault('MASTER_ADMIN_PASSWORD_HASH', bcrypt.hashSync('NoUsadaEnEsteTest#1', 10));
setEnvDefault('DB_PATH', tmpDb);
setEnvDefault('TRUST_PROXY', 'false');
setEnvDefault('RATE_LIMIT_MAX', '10000');
setEnvDefault('LOGIN_RATE_LIMIT_MAX', '10000');

let db = require('../db');

// ── (a) Tras la migracion solo existen ORLANT y MOBILIZE ──────────────────
test('fase134_borrar_clientes_v1: dashboards_config queda SOLO con ORLANT y MOBILIZE', () => {
  const clientes = db.prepare('SELECT cliente FROM dashboards_config ORDER BY cliente').all().map((r) => r.cliente);
  assert.deepEqual(clientes, ['MOBILIZE', 'ORLANT']);
});

test('fase134_borrar_clientes_v1: calidad_plantillas pierde CARTERA INTERNA, conserva ORLANT y MOBILIZE', () => {
  const campanas = db.prepare('SELECT campana FROM calidad_plantillas ORDER BY campana').all().map((r) => r.campana);
  assert.deepEqual(campanas, ['MOBILIZE', 'ORLANT']);
});

test('fase134_borrar_clientes_v1: monitoreos de CARTERA INTERNA se borran, los de ORLANT quedan intactos', () => {
  const cartera = db.prepare('SELECT COUNT(*) c FROM monitoreos WHERE campana = ?').get('CARTERA INTERNA').c;
  const orlant = db.prepare('SELECT COUNT(*) c FROM monitoreos WHERE campana = ?').get('ORLANT').c;
  assert.equal(cartera, 0);
  assert.equal(orlant, 1);
});

test('fase134_borrar_clientes_v1: dashboard_cargas de HOSPITAL LA MARIA se borra, el de MOBILIZE queda intacto', () => {
  const hlm = db.prepare('SELECT COUNT(*) c FROM dashboard_cargas WHERE cliente = ?').get('HOSPITAL LA MARIA').c;
  const mobilize = db.prepare('SELECT COUNT(*) c FROM dashboard_cargas WHERE cliente = ?').get('MOBILIZE').c;
  assert.equal(hlm, 0);
  assert.equal(mobilize, 1);
});

// ── (d) Los usuarios conservan su acceso a ORLANT/MOBILIZE; nunca se borran ──
test('fase134_borrar_clientes_v1: usuario con HOSPITAL LA MARIA + ORLANT pierde solo la clave eliminada', () => {
  const u = db.prepare('SELECT perms FROM users WHERE user = ?').get('f134_con_hospital');
  const perms = JSON.parse(u.perms);
  assert.equal(perms['cliente_HOSPITAL LA MARIA'], undefined);
  assert.equal(perms.cliente_ORLANT, true);
  assert.equal(perms.ClientesDash, true);
});

test('fase134_borrar_clientes_v1: usuario que SOLO tenia CARTERA INTERNA no se borra ni se suspende, queda sin acceso campana_*/cliente_*', () => {
  const u = db.prepare('SELECT * FROM users WHERE user = ?').get('f134_solo_cartera');
  assert.ok(u, 'el usuario debe seguir existiendo');
  assert.equal(u.active, 1, 'nunca se suspende');
  const perms = JSON.parse(u.perms);
  assert.equal(perms['campana_CARTERA INTERNA'], undefined);
  assert.equal(perms.Calidad, true, 'el resto de permisos no se toca');
  const quedaAlgo = Object.keys(perms).some((k) => (k.startsWith('campana_') || k.startsWith('cliente_')) && perms[k] === true);
  assert.equal(quedaAlgo, false);
});

test('fase134_borrar_clientes_v1: usuario sin ningun cliente a borrar queda exactamente igual', () => {
  const u = db.prepare('SELECT perms FROM users WHERE user = ?').get('f134_solo_orlant');
  assert.deepEqual(JSON.parse(u.perms), { Calidad: true, campana_ORLANT: true });
});

test('fase134_borrar_clientes_v1: asesorCampana (campo libre) no se toca, aunque apunte a un cliente eliminado', () => {
  const u = db.prepare('SELECT asesorCampana FROM users WHERE user = ?').get('f134_asesor_hlm');
  assert.equal(u.asesorCampana, 'HOSPITAL LA MARIA');
});

// ── (b) Correr la migracion 2 veces no rompe nada (idempotente) ───────────
test('fase134_borrar_clientes_v1: idempotente -- reabrir la base (segunda corrida) no vuelve a tocar nada ni falla', () => {
  db.closeDb();
  delete require.cache[require.resolve('../db')];
  db = require('../db');

  const clientes = db.prepare('SELECT cliente FROM dashboards_config ORDER BY cliente').all().map((r) => r.cliente);
  assert.deepEqual(clientes, ['MOBILIZE', 'ORLANT']);

  const u = db.prepare('SELECT * FROM users WHERE user = ?').get('f134_solo_cartera');
  assert.ok(u, 'sigue sin borrarse en la segunda corrida');
  assert.equal(JSON.parse(u.perms).Calidad, true);
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
