// orlant-inasistencia-subtabs-migracion.test.js — prueba la migracion
// `dashboards_config_orlant_inasistencia_panel_v4` (server/db.js, Fase 108,
// pedido textual de InCo: "la inasistencia va a ser por mes, que se pueda
// filtrar por sede, especialidad, nombre entidad... y barra por
// especialidad"): reemplaza la forma de la Fase 106 -- la que esta hoy en
// produccion (1 solo inasistencia_panel, vista:'pormes', sin subtabs) -- por
// 2 paneles (vista pormes/porespecialidad) con 2 sub-pestañas. Mismo patron
// que orlant-inasistencia-porcentaje-migracion.test.js (Fase 106): sembrar
// el layout de la forma VIEJA reconocible a mano *antes* de requerir db.js,
// y verificar panel y sub-pestaña por separado, un cliente sin relacion
// intacto, e idempotencia reabriendo la base.
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-inasist-subtabs-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Forma "vieja" reconocible: la de la Fase 106, HOY en produccion -- 1 solo
// inasistencia_panel (vista:'pormes'), sin subtabs.
const LAYOUT_VIEJO = {
  kpis: [],
  tabs: [
    { key: 'trafico', label: 'Trafico de Llamadas', panels: [{ tipo: 'trafico_combo', campana: 'ORLANT' }] },
    { key: 'inasistencia', label: 'Inasistencia', oculta: true, panels: [
      { tipo: 'inasistencia_panel', vista: 'pormes', titulo: 'Inasistencia por Mes', campana: 'ORLANT' },
    ], subtabs: []},
    { key: 'calidad', label: 'Calidad', panels: [{ tipo: 'calidad_kpis', campana: 'ORLANT' }] },
  ],
};

// Escenario 2: un tab "inasistencia" personalizado -- ni la forma vieja
// (Fase 106) ni la nueva (Fase 108). La migracion debe dejarlo intacto.
const LAYOUT_PERSONALIZADO = {
  kpis: [],
  tabs: [
    { key: 'inasistencia', label: 'Inasistencia', panels: [
      { tipo: 'line', titulo: 'Personalizado 1', series: [] },
    ]},
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
const now = '01/10/2026 10:00:00';
pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
).run('ORLANT', 'Dashboard Clinica Orlant', null, '{}', JSON.stringify(LAYOUT_VIEJO), now, now);

const OTRO_CLIENTE = 'MOBILIZE';
pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
).run(OTRO_CLIENTE, 'Dashboard Bivett', null, '{}', JSON.stringify(LAYOUT_PERSONALIZADO), now, now);
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
const { CONFIGS } = require('../dashboard-config-seed');
const ORLANT_TARGET = CONFIGS.find((c) => c.cliente === 'ORLANT');
const TARGET_TAB = ORLANT_TARGET.layout.tabs.find((t) => t.key === 'inasistencia');

test('migracion dashboards_config_orlant_inasistencia_panel_v4: deja Inasistencia con 2 paneles (pormes/porespecialidad) y 2 sub-pestañas', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const tab = layout.tabs.find((t) => t.key === 'inasistencia');

  // Verificado por separado (panel y sub-pestaña), no uno gateado por el
  // otro -- precedente real de la Fase 104.
  assert.equal(tab.panels.length, 2);
  assert.equal(tab.panels[0].vista, 'pormes');
  assert.equal(tab.panels[1].vista, 'porespecialidad');
  assert.deepEqual(tab.panels, TARGET_TAB.panels);

  assert.equal(tab.subtabs.length, 2);
  assert.deepEqual(tab.subtabs.map((s) => s.key), ['pormes', 'porespecialidad']);
  assert.deepEqual(tab.subtabs, TARGET_TAB.subtabs);

  assert.equal(tab.oculta, true); // esta migracion no toca `oculta`

  const calidad = layout.tabs.find((t) => t.key === 'calidad');
  assert.equal(calidad.panels[0].tipo, 'calidad_kpis');
});

test('migracion dashboards_config_orlant_inasistencia_panel_v4: nunca toca un tab "inasistencia" que no coincide con la forma esperada (Fase 106)', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(OTRO_CLIENTE);
  assert.deepEqual(JSON.parse(row.layout), LAYOUT_PERSONALIZADO, 'el layout de otro cliente queda byte a byte igual (la query es exclusiva de ORLANT)');
});

test('migracion dashboards_config_orlant_inasistencia_panel_v4: es idempotente -- correrla dos veces seguidas (reabriendo la base) da byte a byte el mismo resultado', () => {
  const antes = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT').layout;
  const tab = JSON.parse(antes).tabs.find((t) => t.key === 'inasistencia');
  const yaEsNuevo = tab.panels.length === 2 && tab.panels.some((p) => p.vista === 'porespecialidad') && (tab.subtabs || []).length === 2;
  assert.ok(yaEsNuevo, 'el resultado deberia ya cumplir el guard de "ya migrado" tras la primera corrida');

  delete require.cache[require.resolve('../db')];
  const db2 = require('../db');
  const despues = db2.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT').layout;
  assert.equal(antes, despues, 'reabrir la base (segunda corrida real de todas las migraciones) da byte a byte el mismo resultado');
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
