// cliente-movilize-renombrado-mobilize-migracion.test.js — prueba la
// migracion `cliente_movilize_renombrado_mobilize_v1` (server/db.js), Fase
// 131 (Parte 1, pedido de Edwin): el cliente se escribia "MOVILIZE" en todo
// el codigo -- se corrige al nombre real de su marca, "MOBILIZE", sin que
// ningun usuario pierda acceso ni se pierda ninguna personalizacion que un
// admin ya hubiera hecho (dashboards_config.layout, calidad_plantillas.items).
//
// Siembra el estado VIEJO a mano (incluida la fila GENERICA nueva que el
// propio seed de CONFIGS/PLANTILLAS crea solo para 'MOBILIZE' en cuanto el
// codigo fuente pasa a usar ese nombre -- mismo riesgo de choque de UNIQUE
// que describe el comentario de la migracion en db.js) *antes* de requerir
// db.js, y verifica el estado "despues".
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const tmpDb = path.join(os.tmpdir(), `inconexion-movilize-mobilize-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

const LAYOUT_PERSONALIZADO = {
  kpis: [{ titulo: 'Marca de personalizacion admin', fuente: {}, formato: 'entero' }],
  tabs: [{ key: 'flujo', label: 'Flujo de gestion', panels: [] }],
};
const ITEMS_PERSONALIZADOS = [
  { n: 1, cat: 'APERTURA', label: 'Item personalizado por un admin antes del rename', weight: 100, critico: true },
];

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
  CREATE TABLE trafico_skill_mapeo (
    skillName TEXT PRIMARY KEY,
    campana TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
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
`);
const now = '07/10/2026 10:00:00';

// Fila VIEJA de MOVILIZE, con personalizaciones de un admin (layout/items
// distintos del generico) -- la migracion debe conservarlas tal cual, solo
// renombradas.
pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
).run('MOVILIZE', 'Dashboard Movilize', null, '{}', JSON.stringify(LAYOUT_PERSONALIZADO), now, now);
pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
).run('ORLANT', 'Dashboard Clinica Orlant', null, '{}', JSON.stringify({ kpis: [], tabs: [] }), now, now);

pre.prepare(
  `INSERT INTO calidad_plantillas (campana, engine, items, activo, updatedAt) VALUES (?,?,?,1,?)`
).run('MOVILIZE', 'standard', JSON.stringify(ITEMS_PERSONALIZADOS), now);

pre.prepare(
  `INSERT INTO users (nombre, user, rol, active, password_hash, perms, asesorCampana, createdAt)
   VALUES (?,?,?,1,?,?,NULL,?)`
).run(
  'Usuario Cliente Mobilize', 'cliente_mobilize_test', 'CLIENTES_DASH', 'hash-no-real',
  JSON.stringify({ ClientesDash: true, cliente_MOVILIZE: true, cliente_ORLANT: true }), now
);
pre.prepare(
  `INSERT INTO users (nombre, user, rol, active, password_hash, perms, asesorCampana, createdAt)
   VALUES (?,?,?,1,?,?,NULL,?)`
).run(
  'Usuario Calidad Mobilize', 'calidad_mobilize_test', 'CALIDAD', 'hash-no-real',
  JSON.stringify({ Calidad: true, campana_MOVILIZE: true }), now
);
// Usuario sin ningun permiso de MOVILIZE -- no debe tocarse ni cambiar nada.
pre.prepare(
  `INSERT INTO users (nombre, user, rol, active, password_hash, perms, asesorCampana, createdAt)
   VALUES (?,?,?,1,?,?,NULL,?)`
).run(
  'Usuario Sin Relacion', 'sin_relacion_test', 'CLIENTES_DASH', 'hash-no-real',
  JSON.stringify({ ClientesDash: true, cliente_ORLANT: true }), now
);

pre.prepare(
  `INSERT INTO trafico_skill_mapeo (skillName, campana, createdAt, updatedAt) VALUES (?,?,?,?)`
).run('SAC MOBILIZE TEST', 'MOVILIZE', now, now);

pre.prepare(
  `INSERT INTO dashboard_cargas (cliente, seccion, cadencia, periodo, filas, cargadoEn) VALUES (?,?,?,?,?,?)`
).run('MOVILIZE', 'resumen', 'mensual', '2026-09', '[]', now);

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

const db = require('../db');

test('migracion cliente_movilize_renombrado_mobilize_v1: la fila VIEJA de MOVILIZE se renombra a MOBILIZE, sin duplicados', () => {
  const movilize = db.prepare('SELECT * FROM dashboards_config WHERE cliente = ?').get('MOVILIZE');
  assert.equal(movilize, undefined);
  const todas = db.prepare('SELECT cliente FROM dashboards_config WHERE cliente = ?').all('MOBILIZE');
  assert.equal(todas.length, 1, 'no debe quedar ninguna fila generica duplicada');
});

test('migracion cliente_movilize_renombrado_mobilize_v1: conserva el layout personalizado del admin tal cual, solo renombra cliente/titulo', () => {
  const mobilize = db.prepare('SELECT * FROM dashboards_config WHERE cliente = ?').get('MOBILIZE');
  assert.ok(mobilize);
  assert.equal(mobilize.titulo, 'Dashboard Mobilize');
  assert.deepEqual(JSON.parse(mobilize.layout), LAYOUT_PERSONALIZADO);
});

test('migracion cliente_movilize_renombrado_mobilize_v1: nunca toca otro cliente (ORLANT sigue existiendo, sin fila duplicada)', () => {
  const filas = db.prepare('SELECT cliente FROM dashboards_config WHERE cliente = ?').all('ORLANT');
  assert.equal(filas.length, 1);
});

test('migracion cliente_movilize_renombrado_mobilize_v1: calidad_plantillas se renombra conservando los items personalizados', () => {
  const vieja = db.prepare('SELECT * FROM calidad_plantillas WHERE campana = ?').get('MOVILIZE');
  assert.equal(vieja, undefined);
  const filas = db.prepare('SELECT * FROM calidad_plantillas WHERE campana = ?').all('MOBILIZE');
  assert.equal(filas.length, 1, 'no debe quedar ninguna plantilla generica duplicada');
  assert.deepEqual(JSON.parse(filas[0].items), ITEMS_PERSONALIZADOS);
});

test('migracion cliente_movilize_renombrado_mobilize_v1: renombra las claves de permisos cliente_/campana_ sin tocar el resto', () => {
  const uCliente = db.prepare('SELECT perms FROM users WHERE user = ?').get('cliente_mobilize_test');
  const permsCliente = JSON.parse(uCliente.perms);
  assert.equal(permsCliente.cliente_MOVILIZE, undefined);
  assert.equal(permsCliente.cliente_MOBILIZE, true);
  assert.equal(permsCliente.cliente_ORLANT, true);
  assert.equal(permsCliente.ClientesDash, true);

  const uCampana = db.prepare('SELECT perms FROM users WHERE user = ?').get('calidad_mobilize_test');
  const permsCampana = JSON.parse(uCampana.perms);
  assert.equal(permsCampana.campana_MOVILIZE, undefined);
  assert.equal(permsCampana.campana_MOBILIZE, true);
  assert.equal(permsCampana.Calidad, true);
});

test('migracion cliente_movilize_renombrado_mobilize_v1: usuario sin permisos de Movilize queda intacto', () => {
  const u = db.prepare('SELECT perms FROM users WHERE user = ?').get('sin_relacion_test');
  const perms = JSON.parse(u.perms);
  assert.deepEqual(perms, { ClientesDash: true, cliente_ORLANT: true });
});

test('migracion cliente_movilize_renombrado_mobilize_v1: trafico_skill_mapeo y dashboard_cargas tambien se renombran', () => {
  const skill = db.prepare('SELECT campana FROM trafico_skill_mapeo WHERE skillName = ?').get('SAC MOBILIZE TEST');
  assert.equal(skill.campana, 'MOBILIZE');

  const carga = db.prepare('SELECT cliente FROM dashboard_cargas WHERE seccion = ? AND periodo = ?').get('resumen', '2026-09');
  assert.equal(carga.cliente, 'MOBILIZE');
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
