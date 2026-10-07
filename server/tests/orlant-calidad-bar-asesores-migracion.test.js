// orlant-calidad-bar-asesores-migracion.test.js — prueba la migracion
// `dashboards_config_orlant_calidad_bar_asesores_v1` (server/db.js), Fase
// 130 (pedido de Edwin, aprobado: nombre + % promedio por asesor, sin
// numero de monitoreos). A diferencia de las migraciones de reemplazo
// (salida_panel, efectividad_citas), esta es ADITIVA: agrega un panel
// nuevo a un tab "calidad" que YA existe, sin tocar los 2 paneles viejos.
// Mismo patron: sembrar el layout VIEJO a mano *antes* de requerir db.js,
// verificar "despues".
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { CONFIGS } = require('../dashboard-config-seed');

const ORLANT_TARGET = CONFIGS.find((c) => c.cliente === 'ORLANT');
const targetCalidad = (ORLANT_TARGET.layout.tabs || []).find((t) => t.key === 'calidad');

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-calidad-bar-asesores-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Forma "antes de esta fase": tab "calidad" con solo los 2 paneles de
// siempre (kpis + pie), sin el panel nuevo.
const CALIDAD_VIEJO = {
  key: 'calidad', label: 'Calidad',
  panels: [
    { tipo: 'calidad_kpis', campana: 'ORLANT' },
    { tipo: 'calidad_pie', campana: 'ORLANT', titulo: 'Distribución de clasificación' },
  ],
};
const OTRO_TAB = { key: 'trafico_whatsapp', label: 'Tráfico de WhatsApp', panels: [] };
const LAYOUT_VIEJO = { kpis: [], tabs: [OTRO_TAB, CALIDAD_VIEJO] };

// Escenario 2: otra campaña con su propio tab "calidad" (CLINICA AURORA, por
// ejemplo) -- la migracion es exclusiva de ORLANT (query WHERE cliente =
// 'ORLANT'), nunca debe tocarla.
const OTRO_CLIENTE = 'BIVETT';
const CALIDAD_OTRO_CLIENTE = { key: 'calidad', label: 'Calidad', panels: [{ tipo: 'calidad_kpis', campana: 'BIVETT' }] };
const LAYOUT_OTRO = { kpis: [], tabs: [CALIDAD_OTRO_CLIENTE] };

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
const now = '07/10/2026 10:00:00';
pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
).run('ORLANT', 'Dashboard Clinica Orlant', null, '{}', JSON.stringify(LAYOUT_VIEJO), now, now);
pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
).run(OTRO_CLIENTE, 'Dashboard Bivett', null, '{}', JSON.stringify(LAYOUT_OTRO), now, now);
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

test('migracion dashboards_config_orlant_calidad_bar_asesores_v1: agrega el panel nuevo SIN tocar los 2 viejos', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const tab = layout.tabs.find((t) => t.key === 'calidad');
  assert.ok(tab);
  assert.equal(tab.panels.length, 3);
  assert.deepEqual(tab.panels[0], CALIDAD_VIEJO.panels[0], 'calidad_kpis queda exactamente igual');
  assert.deepEqual(tab.panels[1], CALIDAD_VIEJO.panels[1], 'calidad_pie queda exactamente igual');
  assert.equal(tab.panels[2].tipo, 'calidad_bar_asesores');
  assert.deepEqual(tab.panels[2], targetCalidad.panels.find((p) => p.tipo === 'calidad_bar_asesores'));
});

test('migracion dashboards_config_orlant_calidad_bar_asesores_v1: nunca toca el tab "calidad" de otra campaña', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(OTRO_CLIENTE);
  assert.deepEqual(JSON.parse(row.layout), LAYOUT_OTRO, 'byte a byte igual -- la query es exclusiva de ORLANT');
});

test('migracion dashboards_config_orlant_calidad_bar_asesores_v1: es idempotente -- correrla dos veces seguidas no duplica el panel', () => {
  const antes = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT').layout;

  delete require.cache[require.resolve('../db')];
  const db2 = require('../db');
  const despues = db2.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT').layout;
  assert.equal(antes, despues, 'reabrir la base (segunda corrida real de todas las migraciones) da byte a byte el mismo resultado');
  const tab = JSON.parse(despues).tabs.find((t) => t.key === 'calidad');
  assert.equal(tab.panels.length, 3, 'sigue siendo 3 -- no se agrego un segundo calidad_bar_asesores');
});
