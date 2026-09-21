// orlant-ocultar-pestanas-migracion.test.js — prueba la migracion
// `dashboards_config_orlant_ocultar_pestanas_v1` (server/db.js), Fase 40b
// (2026-09-21): mientras se termina de organizar/llenar 7 de las 9
// pestanas de ORLANT, se ocultan del menu (TEMPORAL) y solo quedan
// visibles Calidad y Trafico de Llamadas. `oculta: true` es puramente
// aditivo -- no toca panels/subtabs. Mismo patron que
// orlant-subpestanas-migracion.test.js: sembrar el layout VIEJO a mano
// *antes* de requerir db.js, y verificar "despues".
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-ocultar-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

const CLAVES_A_OCULTAR = ['flujo', 'salida', 'tipificacion', 'agendamiento', 'inasistencia', 'sta', 'efectividad'];

// Forma "vieja" reconocible: los 9 tabs de ORLANT, ninguno con `oculta`
// todavia -- el estado real de cualquier ORLANT ya sembrado antes de esta
// fase. El tab "agendamiento" trae paneles "personalizados" (forma
// distinta a la config actual) a proposito, para confirmar que la
// migracion no depende de la forma de `panels` (a diferencia de
// dashboards_config_orlant_subpestanas_v1).
const LAYOUT_VIEJO = {
  kpis: [],
  tabs: [
    { key: 'flujo', label: 'Flujo Mensual', panels: [{ tipo: 'line', titulo: 'x' }] },
    { key: 'salida', label: 'Salida', panels: [{ tipo: 'line', titulo: 'x' }] },
    { key: 'tipificacion', label: 'Tipificacion', panels: [{ tipo: 'pie', titulo: 'x' }] },
    { key: 'agendamiento', label: 'Agendamiento', panels: [{ tipo: 'combo', titulo: 'personalizado a mano' }] },
    { key: 'inasistencia', label: 'Inasistencia', panels: [{ tipo: 'line', titulo: 'x' }] },
    { key: 'sta', label: 'Gestion STA', panels: [{ tipo: 'bar', titulo: 'x' }] },
    { key: 'efectividad', label: 'Efectividad Citas', panels: [{ tipo: 'combo', titulo: 'x' }] },
    { key: 'calidad', label: 'Calidad', panels: [{ tipo: 'calidad_kpis', campana: 'ORLANT' }] },
    { key: 'trafico', label: 'Trafico de Llamadas', panels: [{ tipo: 'trafico_combo', campana: 'ORLANT' }] },
  ],
};

// Escenario 2: un tab que un admin YA oculto a mano (o que ya paso por
// esta migracion) -- debe quedar intacto (idempotente), no se toca dos veces.
const LAYOUT_YA_OCULTO = {
  kpis: [],
  tabs: [
    { key: 'flujo', label: 'Flujo Mensual', oculta: true, panels: [{ tipo: 'line', titulo: 'ya oculto a mano' }] },
  ],
};

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
`);
const now = '21/09/2026 14:00:00';
pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
).run('ORLANT', 'Dashboard Clinica Orlant', null, '{}', JSON.stringify(LAYOUT_VIEJO), now, now);

const OTRO_CLIENTE = 'BIVETT';
pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
).run(OTRO_CLIENTE, 'Dashboard Bivett', null, '{}', JSON.stringify(LAYOUT_YA_OCULTO), now, now);
pre.close();

function setEnvDefault(key, value) {
  if (process.env[key] === undefined || process.env[key] === '') process.env[key] = value;
}
setEnvDefault('NODE_ENV', 'test');
setEnvDefault('JWT_SECRET', crypto.randomBytes(48).toString('hex'));
setEnvDefault('JWT_EXPIRES_IN', '1h');
setEnvDefault('MASTER_ADMIN_USER', 'admin');
setEnvDefault('MASTER_ADMIN_PASSWORD_HASH', bcrypt.hashSync('NoUsadaEnEsteTest#1', 10));
setEnvDefault('DB_PATH', tmpDb);
setEnvDefault('TRUST_PROXY', 'false');
setEnvDefault('RATE_LIMIT_MAX', '10000');
setEnvDefault('LOGIN_RATE_LIMIT_MAX', '10000');

const db = require('../db');

test('migracion dashboards_config_orlant_ocultar_pestanas_v1: oculta exactamente las 7 pestanas pedidas', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  CLAVES_A_OCULTAR.forEach((key) => {
    const tab = layout.tabs.find((t) => t.key === key);
    assert.equal(tab.oculta, true, key + ' deberia quedar oculta');
  });
});

test('migracion dashboards_config_orlant_ocultar_pestanas_v1: nunca oculta Calidad ni Trafico de Llamadas', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  ['calidad', 'trafico'].forEach((key) => {
    const tab = layout.tabs.find((t) => t.key === key);
    assert.equal(tab.oculta, undefined, key + ' NO deberia quedar oculta');
  });
});

test('migracion dashboards_config_orlant_ocultar_pestanas_v1: nunca toca panels/subtabs, solo agrega el flag', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const agendamiento = layout.tabs.find((t) => t.key === 'agendamiento');
  assert.equal(agendamiento.panels[0].titulo, 'personalizado a mano');
});

test('migracion dashboards_config_orlant_ocultar_pestanas_v1: nunca toca otro cliente (la query es exclusiva de ORLANT)', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(OTRO_CLIENTE);
  const layout = JSON.parse(row.layout);
  assert.deepEqual(layout, LAYOUT_YA_OCULTO);
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
