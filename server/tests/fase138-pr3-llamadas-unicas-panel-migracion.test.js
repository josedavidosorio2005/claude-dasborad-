// fase138-pr3-llamadas-unicas-panel-migracion.test.js — prueba la migracion
// `dashboards_config_mobilize_llamadas_unicas_panel_v1` (server/db.js),
// Fase 138 (PR3, pedido de Edwin 09/10/2026): agrega el panel
// "llamadas_unicas_panel" PRIMERO en el array de paneles del tab "flujo" de
// MOBILIZE. Mismo patron de prueba que
// fase138-pr2-tipificacion-asaaht.test.js: sembrar el layout VIEJO
// reconocible a mano *antes* de requerir db.js, verificar "despues".
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const tmpDb = path.join(os.tmpdir(), `inconexion-fase138-pr3-panel-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

function tab(key, panels) {
  return { key, label: 'Label ' + key, panels };
}

// MOBILIZE: forma reconocible real (trafico_combo en "flujo", SIN
// llamadas_unicas_panel todavia) + un cliente de control que nunca deberia
// tocarse, y una forma de "flujo" NO reconocible (otro cliente de control).
const LAYOUT_MOBILIZE = {
  kpis: [],
  tabs: [
    tab('flujo', [{ tipo: 'trafico_combo', campana: 'MOBILIZE', resumenOcultar: ['tasaAbandono'] }]),
    tab('calidad', [{ tipo: 'calidad_kpis', campana: 'MOBILIZE' }]),
  ],
};
const OTRO_CLIENTE = 'CLINICA_AURORA_CONTROL';
const LAYOUT_OTRO = { kpis: [], tabs: [tab('flujo', [{ tipo: 'line', titulo: 'x' }])] };

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
const now = '09/10/2026 10:00:00';
const insertRow = pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
);
insertRow.run('MOBILIZE', 'Dashboard Mobilize', null, '{}', JSON.stringify(LAYOUT_MOBILIZE), now, now);
insertRow.run(OTRO_CLIENTE, 'Dashboard Control', null, '{}', JSON.stringify(LAYOUT_OTRO), now, now);
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

test('migracion dashboards_config_mobilize_llamadas_unicas_panel_v1: agrega el panel PRIMERO en "flujo", sin tocar el trafico_combo existente', () => {
  const row = db.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'MOBILIZE'").get();
  const layout = JSON.parse(row.layout);
  const tabFlujo = layout.tabs.find((t) => t.key === 'flujo');
  assert.equal(tabFlujo.panels.length, 2);
  assert.equal(tabFlujo.panels[0].tipo, 'llamadas_unicas_panel');
  assert.equal(tabFlujo.panels[0].campana, 'MOBILIZE');
  assert.deepEqual(tabFlujo.panels[1], LAYOUT_MOBILIZE.tabs[0].panels[0], 'el panel trafico_combo original (con sus opciones) sigue intacto');
});

test('migracion dashboards_config_mobilize_llamadas_unicas_panel_v1: no toca el tab "calidad" de MOBILIZE', () => {
  const row = db.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'MOBILIZE'").get();
  const layout = JSON.parse(row.layout);
  const tabCalidad = layout.tabs.find((t) => t.key === 'calidad');
  assert.deepEqual(tabCalidad, LAYOUT_MOBILIZE.tabs[1]);
});

test('migracion dashboards_config_mobilize_llamadas_unicas_panel_v1: nunca toca otro cliente, ni uno con "flujo" en forma NO reconocible', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(OTRO_CLIENTE);
  assert.deepEqual(JSON.parse(row.layout), LAYOUT_OTRO, 'un "flujo" sin trafico_combo reconocible nunca se toca');
});

test('migracion dashboards_config_mobilize_llamadas_unicas_panel_v1: idempotente -- reabrir la base no duplica el panel', () => {
  db.closeDb();
  delete require.cache[require.resolve('../db')];
  const db2 = require('../db');
  const row = db2.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'MOBILIZE'").get();
  const layout = JSON.parse(row.layout);
  const tabFlujo = layout.tabs.find((t) => t.key === 'flujo');
  assert.equal(tabFlujo.panels.filter((p) => p.tipo === 'llamadas_unicas_panel').length, 1);
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
