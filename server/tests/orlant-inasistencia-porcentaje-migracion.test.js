// orlant-inasistencia-porcentaje-migracion.test.js — prueba la migracion
// `dashboards_config_orlant_inasistencia_panel_v3` (server/db.js, Fase 106,
// pedido textual de InCo: "que en Inasistencia solo quede en porcentaje,
// por mes"): reemplaza la forma de la Fase 101 -- la que SI esta hoy en
// produccion (3 inasistencia_panel con vista pormes/porespecialidad/detalle,
// subtabs en ese mismo orden) -- por un SOLO panel (vista:'pormes'), sin
// subtabs (`[]`). Mismo patron que orlant-inasistencia-pormes-migracion.test.js
// (Fase 101): sembrar el layout de la forma VIEJA reconocible a mano *antes*
// de requerir db.js, y verificar "despues". A diferencia de los fixtures de
// los otros 2 archivos de pruebas de inasistencia (que arrancan de formas
// MAS viejas que la Fase 101 y por eso v1/v2 los convierten directo a la
// forma final, dejando a v3 como no-op) este fixture arranca EXACTAMENTE de
// la forma de produccion de hoy, asi que v1 y v2 son los no-ops aqui y v3 es
// quien hace el trabajo real -- el escenario mas representativo de lo que le
// va a pasar al ORLANT real en el deploy de esta fase.
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-inasist-pct-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Forma "vieja" reconocible: la de la Fase 101, HOY en produccion -- 3
// inasistencia_panel con vista pormes/porespecialidad/detalle (en ese
// orden) y subtabs en el mismo orden.
const LAYOUT_VIEJO = {
  kpis: [],
  tabs: [
    { key: 'trafico', label: 'Trafico de Llamadas', panels: [{ tipo: 'trafico_combo', campana: 'ORLANT' }] },
    { key: 'agendamiento', label: 'Agendamiento', oculta: true, panels: [{ tipo: 'agendas_panel', vista: 'especialidad', campana: 'ORLANT' }] },
    { key: 'inasistencia', label: 'Inasistencia', oculta: true, panels: [
      { tipo: 'inasistencia_panel', vista: 'pormes', titulo: 'Inasistencia por Mes', campana: 'ORLANT' },
      { tipo: 'inasistencia_panel', vista: 'porespecialidad', titulo: 'Inasistencia por Especialidad', campana: 'ORLANT' },
      { tipo: 'inasistencia_panel', vista: 'detalle', titulo: 'Detalle de Inasistencia', campana: 'ORLANT' },
    ], subtabs: [
      { key: 'pormes', label: 'Por mes', indices: [0] },
      { key: 'porespecialidad', label: 'Por especialidad', indices: [1] },
      { key: 'detalle', label: 'Detalle', indices: [2] },
    ]},
    { key: 'calidad', label: 'Calidad', panels: [{ tipo: 'calidad_kpis', campana: 'ORLANT' }] },
  ],
};

// Escenario 2: un tab "inasistencia" personalizado a algo que no es ni la
// forma vieja (Fase 101) ni la nueva (Fase 106) -- la migracion debe
// dejarlo intacto.
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

test('migracion dashboards_config_orlant_inasistencia_panel_v3: reemplaza panels/subtabs por la forma EN VIVO de CONFIGS (hoy, Fase 108: 2 paneles con subtabs; en su momento, Fase 106: 1 solo panel sin subtabs)', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const tab = layout.tabs.find((t) => t.key === 'inasistencia');

  // Verificado por separado (panel y sub-pestaña), no uno gateado por el
  // otro -- precedente real de la Fase 104 (interaccion entre migraciones
  // por cantidad de paneles). v3 reemplaza con la forma EN VIVO del seed
  // (dashboard-config-seed.js), no con una copia fija de como se veian en
  // la Fase 106 -- mismo criterio que v1/v2 (ver cabecera del archivo).
  assert.equal(tab.panels.length, TARGET_TAB.panels.length);
  assert.ok(tab.panels.every((p) => p.tipo === 'inasistencia_panel'));
  assert.deepEqual(tab.panels, TARGET_TAB.panels);
  assert.deepEqual(tab.subtabs, TARGET_TAB.subtabs);

  // `oculta` no lo toca esta migracion (dashboard-generic.js decide en
  // memoria segun si hay inasistencias cargadas, nunca la migracion).
  assert.equal(tab.oculta, true);

  // El tab "calidad" (sin relacion con este fix) no se toca.
  const calidad = layout.tabs.find((t) => t.key === 'calidad');
  assert.equal(calidad.panels[0].tipo, 'calidad_kpis');
});

test('migracion dashboards_config_orlant_inasistencia_panel_v3: nunca toca un tab "inasistencia" que no coincide con la forma esperada (Fase 101 ni Fase 106)', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(OTRO_CLIENTE);
  assert.deepEqual(JSON.parse(row.layout), LAYOUT_PERSONALIZADO, 'el layout de otro cliente queda byte a byte igual (la query es exclusiva de ORLANT)');
});

test('migracion dashboards_config_orlant_inasistencia_panel_v3: es idempotente -- correrla dos veces seguidas (reabriendo la base) da byte a byte el mismo resultado', () => {
  const antes = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT').layout;
  const tab = JSON.parse(antes).tabs.find((t) => t.key === 'inasistencia');
  assert.deepEqual(tab.panels, TARGET_TAB.panels, 'el resultado deberia ya cumplir el guard de "ya migrado" (forma EN VIVO de CONFIGS) tras la primera corrida');
  assert.deepEqual(tab.subtabs, TARGET_TAB.subtabs);

  delete require.cache[require.resolve('../db')];
  const db2 = require('../db');
  const despues = db2.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT').layout;
  assert.equal(antes, despues, 'reabrir la base (segunda corrida real de todas las migraciones) da byte a byte el mismo resultado');
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
