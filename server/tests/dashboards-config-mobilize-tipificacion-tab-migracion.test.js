// dashboards-config-mobilize-tipificacion-tab-migracion.test.js — prueba la
// migracion `dashboards_config_mobilize_tipificacion_tab_v1` (server/db.js),
// Fase 131 (Parte 3): agrega el tab oculto "tipificacion" a una fila de
// MOBILIZE que YA paso por `dashboards_config_mobilize_flujo_llamadas_v1`
// (el deploy real de la Parte 2, 2 tabs: flujo + calidad, SIN
// tipificacion) -- escenario EXACTO de produccion. Mismo patron de prueba
// que las demas migraciones de "agregar un tab nuevo oculto": sembrar
// `schema_migrations` con la migracion anterior ya marcada "aplicada" +
// el layout de 2 tabs, *antes* de requerir db.js.
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const tmpDb = path.join(os.tmpdir(), `inconexion-mobilize-tipif-tab-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Forma real de produccion tras la Parte 2 (2 tabs: flujo + calidad, SIN
// tipificacion todavia) -- la que de verdad tiene hoy la fila de MOBILIZE.
const LAYOUT_PARTE_2 = {
  kpis: [],
  tabs: [
    { key: 'flujo', label: 'Flujo de Llamadas', panels: [{ tipo: 'trafico_combo', campana: 'MOBILIZE' }] },
    { key: 'calidad', label: 'Calidad', panels: [{ tipo: 'calidad_kpis', campana: 'MOBILIZE' }] },
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
  CREATE TABLE schema_migrations (
    name TEXT PRIMARY KEY,
    appliedAt TEXT NOT NULL
  );
`);
const now = '08/10/2026 10:00:00';
pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
).run('MOBILIZE', 'Dashboard Mobilize', null, JSON.stringify({}), JSON.stringify(LAYOUT_PARTE_2), now, now);
// Ya paso por la migracion de la Parte 2 -- no debe volver a correr (si
// corriera de nuevo no rompería nada, pero esta prueba fija el escenario
// REAL: solo la migracion de esta fase, la Parte 3, es la que esta en
// juego aqui).
pre.prepare('INSERT INTO schema_migrations (name, appliedAt) VALUES (?, ?)').run('dashboards_config_mobilize_flujo_llamadas_v1', now);
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
const { CONFIGS } = require('../dashboard-config-seed');
const targetMobilize = CONFIGS.find((c) => c.cliente === 'MOBILIZE');
const targetTipificacion = targetMobilize.layout.tabs.find((t) => t.key === 'tipificacion');

test('migracion dashboards_config_mobilize_tipificacion_tab_v1: agrega el tab "tipificacion" (oculto) sin tocar flujo/calidad', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('MOBILIZE');
  const layout = JSON.parse(row.layout);
  assert.equal(layout.tabs.length, 3);
  assert.deepEqual(layout.tabs[0], LAYOUT_PARTE_2.tabs[0], 'el tab "flujo" original no se toco');
  assert.deepEqual(layout.tabs[1], LAYOUT_PARTE_2.tabs[1], 'el tab "calidad" original no se toco');
  const tabTipif = layout.tabs.find((t) => t.key === 'tipificacion');
  assert.ok(tabTipif, 'el tab "tipificacion" debe existir ahora');
  assert.equal(tabTipif.oculta, true, 'nace oculto -- se destapa en memoria solo cuando ya hay datos');
  assert.deepEqual(tabTipif, targetTipificacion);
});

test('migracion dashboards_config_mobilize_tipificacion_tab_v1: el panel trae soloCanal LLAMADAS y las 3 opciones nuevas', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('MOBILIZE');
  const layout = JSON.parse(row.layout);
  const panel = layout.tabs.find((t) => t.key === 'tipificacion').panels[0];
  assert.equal(panel.tipo, 'tipificacion_panel');
  assert.equal(panel.campana, 'MOBILIZE');
  assert.equal(panel.soloCanal, 'LLAMADAS');
  assert.equal(panel.mostrarFiltroTipo, true);
  assert.equal(panel.mostrarTablaDetalle, true);
  assert.equal(panel.mostrarTarjetasSalida, true);
});

test('idempotente: correr la migracion otra vez (segunda apertura de la base) no duplica el tab', () => {
  db.closeDb();
  delete require.cache[require.resolve('../db')];
  const db2 = require('../db');
  const row = db2.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('MOBILIZE');
  const layout = JSON.parse(row.layout);
  assert.equal(layout.tabs.filter((t) => t.key === 'tipificacion').length, 1);
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
