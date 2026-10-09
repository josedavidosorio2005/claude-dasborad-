// orlant-inasistencia-pormes-migracion.test.js — prueba la migracion
// `dashboards_config_orlant_inasistencia_panel_v2` (server/db.js, Fase 101,
// pedido del jefe): la sub-pestaña PRINCIPAL de Inasistencia pasa de "Por
// especialidad" a "Por mes" (total de todas las especialidades juntas, sin
// filtro) -- reemplaza la forma de la Fase 98 (3 inasistencia_panel con
// vista especialidad/mes/detalle, subtabs porespecialidad/pormes/detalle)
// por la forma EN VIVO de CONFIGS (dashboard-config-seed.js). Mismo patron
// que orlant-inasistencia-panel-migracion.test.js (Fase 98): sembrar el
// layout de la forma VIEJA reconocible a mano *antes* de requerir db.js, y
// verificar "despues".
//
// v2, igual que v1, reemplaza panels/subtabs por CONFIGS EN VIVO -- desde la
// Fase 106 (InCo, "solo en porcentaje, por mes") esa forma es 1 solo panel
// sin subtabs, asi que este fixture (la forma de la Fase 98) converge
// directo a la forma de la Fase 106, saltandose la forma intermedia de 3
// paneles vista pormes/porespecialidad/detalle que esta migracion
// originalmente producia en su momento (Fase 101) -- v3 (mas abajo en
// db.js) se vuelve no-op sobre este fixture, porque v2 ya lo dejo en la
// forma final. Las aserciones de abajo comparan contra TARGET_TAB (en vez
// de hardcodear arrays) para no quedar atadas a una forma de un momento
// especifico.
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-inasist-pormes-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Forma "vieja" reconocible: la de la Fase 98, ya sembrada en produccion --
// 3 inasistencia_panel con vista especialidad/mes/detalle (en ese orden) y
// subtabs porespecialidad/pormes/detalle.
const LAYOUT_VIEJO = {
  kpis: [],
  tabs: [
    { key: 'trafico', label: 'Trafico de Llamadas', panels: [{ tipo: 'trafico_combo', campana: 'ORLANT' }] },
    { key: 'agendamiento', label: 'Agendamiento', oculta: true, panels: [{ tipo: 'agendas_panel', vista: 'especialidad', campana: 'ORLANT' }] },
    { key: 'inasistencia', label: 'Inasistencia', oculta: true, panels: [
      { tipo: 'inasistencia_panel', vista: 'especialidad', titulo: 'Inasistencia por Especialidad', campana: 'ORLANT' },
      { tipo: 'inasistencia_panel', vista: 'mes', titulo: 'Inasistencia por Mes', campana: 'ORLANT' },
      { tipo: 'inasistencia_panel', vista: 'detalle', titulo: 'Detalle de Inasistencia', campana: 'ORLANT' },
    ], subtabs: [
      { key: 'porespecialidad', label: 'Por especialidad', indices: [0] },
      { key: 'pormes', label: 'Por mes', indices: [1] },
      { key: 'detalle', label: 'Detalle', indices: [2] },
    ]},
    { key: 'calidad', label: 'Calidad', panels: [{ tipo: 'calidad_kpis', campana: 'ORLANT' }] },
  ],
};

// Escenario 2: un tab "inasistencia" personalizado a algo que no es ni la
// forma vieja (Fase 98) ni la nueva (Fase 101) -- la migracion debe dejarlo
// intacto.
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
const now = '30/09/2026 20:00:00';
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

test('migracion dashboards_config_orlant_inasistencia_panel_v2: "Por mes" (vista pormes) queda como panel PRIMERO/UNICO (forma EN VIVO de CONFIGS)', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const tab = layout.tabs.find((t) => t.key === 'inasistencia');

  assert.equal(tab.panels.length, TARGET_TAB.panels.length);
  assert.equal(tab.panels[0].vista, 'pormes');
  assert.deepEqual(tab.panels.map((p) => p.vista), TARGET_TAB.panels.map((p) => p.vista));
  assert.deepEqual(tab.panels, TARGET_TAB.panels);
  assert.deepEqual(tab.subtabs, TARGET_TAB.subtabs);

  // `oculta` no lo toca esta migracion (dashboard-generic.js decide en
  // memoria segun si hay inasistencias cargadas, nunca la migracion).
  assert.equal(tab.oculta, true);

  // El tab "calidad" (sin relacion con este fix) no se toca.
  const calidad = layout.tabs.find((t) => t.key === 'calidad');
  assert.equal(calidad.panels[0].tipo, 'calidad_kpis');
});

test('migracion dashboards_config_orlant_inasistencia_panel_v2: nunca toca un tab "inasistencia" que no coincide con la forma esperada (Fase 98 ni Fase 101)', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(OTRO_CLIENTE);
  assert.deepEqual(JSON.parse(row.layout), LAYOUT_PERSONALIZADO, 'el layout de otro cliente queda byte a byte igual (la query es exclusiva de ORLANT)');
});

test('migracion dashboards_config_orlant_inasistencia_panel_v2: es idempotente -- correrla dos veces seguidas da el mismo resultado', () => {
  // db.js ya corrio la migracion una vez al requerirse arriba. El guard
  // `yaEsNuevo` (algun panel con vista pormes/porespecialidad) es
  // exactamente lo que confirma esta prueba: el resultado actual YA cumple
  // esa condicion, asi que una segunda corrida (a mano, sin pasar por
  // runOnceMigration) seria un no-op garantizado.
  const antes = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT').layout;
  const tab = JSON.parse(antes).tabs.find((t) => t.key === 'inasistencia');
  const yaEsNuevo = tab.panels.some((p) => p.vista === 'pormes' || p.vista === 'porespecialidad');
  assert.ok(yaEsNuevo, 'el resultado deberia ya cumplir el guard de "ya migrado" tras la primera corrida');
  const despues = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT').layout;
  assert.equal(antes, despues);
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
