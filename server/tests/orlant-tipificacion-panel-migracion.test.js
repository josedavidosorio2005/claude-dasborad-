// orlant-tipificacion-panel-migracion.test.js — prueba la migracion
// `dashboards_config_orlant_tipificacion_panel_v1` (server/db.js, Fase 77):
// reemplaza el pie viejo (basado en la hoja "tipificacion" de
// dashboard_cargas, que nunca llego a tener datos reales de ORLANT) por el
// panel autonomo nuevo (tipificacion_panel, tabla `tipificaciones`). Mismo
// patron que orlant-tipificacion-unico-migracion.test.js: sembrar el
// layout VIEJO a mano *antes* de requerir db.js, y verificar "despues".
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-tipif-panel-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Forma "vieja" reconocible: 1 solo pie (el estado real de cualquier ORLANT
// sembrado despues de la Fase 76, antes de esta) -- no importa si trae
// filtroUnico o no, cualquier pie de 1 panel es reconocible.
const LAYOUT_VIEJO = {
  kpis: [],
  tabs: [
    { key: 'salida', label: 'Salida', panels: [{ tipo: 'line', titulo: 'x', series: [], filtroSerie: true }] },
    { key: 'tipificacion', label: 'Tipificacion', oculta: true, panels: [
      { tipo: 'pie', titulo: 'Tipificacion de llamadas y WhatsApp', filtroCampo: 'linea', filtroUnico: true,
        fuente: { s: 'tipificacion', modo: 'filas', x: 'tipificacion', campo: 'cantidad' },
        notas: ['glosario viejo'] },
    ]},
  ],
};

// Escenario 2: un tab "tipificacion" personalizado a algo que no es ni la
// forma vieja (1 pie) ni la nueva (tipificacion_panel) -- ej. un admin le
// agrego un segundo panel a mano. La migracion debe dejarlo intacto.
const LAYOUT_PERSONALIZADO = {
  kpis: [],
  tabs: [
    { key: 'tipificacion', label: 'Tipificacion', panels: [
      { tipo: 'pie', titulo: 'Personalizado 1', fuente: {} },
      { tipo: 'pie', titulo: 'Personalizado 2 — agregado a mano', fuente: {} },
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
const now = '25/09/2026 15:00:00';
pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
).run('ORLANT', 'Dashboard Clinica Orlant', null, '{}', JSON.stringify(LAYOUT_VIEJO), now, now);

const OTRO_CLIENTE = 'BIVETT';
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
const TARGET_TAB = ORLANT_TARGET.layout.tabs.find((t) => t.key === 'tipificacion');

test('migracion dashboards_config_orlant_tipificacion_panel_v1: reemplaza el pie viejo por tipificacion_panel', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const tab = layout.tabs.find((t) => t.key === 'tipificacion');

  assert.equal(tab.panels.length, 1);
  assert.equal(tab.panels[0].tipo, 'tipificacion_panel');
  assert.deepEqual(tab.panels[0], TARGET_TAB.panels[0]);

  // `oculta` no lo toca esta migracion (dashboard-generic.js decide en
  // memoria segun si hay tipificaciones cargadas, nunca la migracion).
  assert.equal(tab.oculta, true);

  // El tab "salida" (sin relacion con este fix) no se toca.
  const salida = layout.tabs.find((t) => t.key === 'salida');
  assert.equal(salida.panels[0].filtroSerie, true);
});

test('migracion dashboards_config_orlant_tipificacion_panel_v1: nunca toca otro cliente', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(OTRO_CLIENTE);
  assert.deepEqual(JSON.parse(row.layout), LAYOUT_PERSONALIZADO);
});

test('migracion dashboards_config_orlant_tipificacion_panel_v1: es idempotente -- correrla de nuevo no vuelve a tocar nada', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const tab = JSON.parse(row.layout).tabs.find((t) => t.key === 'tipificacion');
  assert.equal(tab.panels.filter((p) => p.tipo === 'tipificacion_panel').length, 1);
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
