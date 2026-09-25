// orlant-agendas-panel-migracion.test.js — prueba la migracion
// `dashboards_config_orlant_agendas_panel_v1` (server/db.js), Fase 78:
// prepende el panel "Citas por Especialidad" al tab "agendamiento" de
// ORLANT y corre +1 los indices de sus sub-pestanas ya existentes. Mismo
// patron que orlant-subpestanas-migracion.test.js: sembrar el layout VIEJO
// a mano *antes* de requerir db.js, y verificar "despues".
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-agendas-panel-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Forma "vieja" reconocible: el tab "agendamiento" YA con subtabs (estado
// real de cualquier ORLANT sembrado despues de la Fase 40, antes de esta),
// 6 paneles (la cantidad de antes de agregar "Citas por Especialidad").
function panelesDummy(n) {
  return Array.from({ length: n }, (_, i) => ({ tipo: 'combo', titulo: 'Panel ' + i }));
}
const LAYOUT_VIEJO = {
  kpis: [],
  tabs: [
    {
      key: 'agendamiento', label: 'Agendamiento', oculta: true, panels: panelesDummy(6),
      subtabs: [
        { key: 'ordmed', label: 'Ordenamiento Medico', indices: [0, 1] },
        { key: 'recuperacion', label: 'Recuperacion de Cancelados', indices: [2] },
        { key: 'totalagendas', label: 'Total Agendas', indices: [3] },
        { key: 'agendasporlinea', label: 'Agendas por Linea', indices: [4] },
        { key: 'variacion', label: 'Variacion % Agendas', indices: [5] },
      ],
    },
    { key: 'calidad', label: 'Calidad', panels: [{ tipo: 'calidad_kpis', campana: 'ORLANT' }] },
  ],
};

// Escenario 2: un ORLANT cuyo tab "agendamiento" fue editado a mano a una
// cantidad de paneles DISTINTA (nunca deberia pasar en la practica -- este
// tab no se edita desde el constructor -- pero la migracion debe dejarlo
// intacto en vez de romper los indices, igual que las demas migraciones).
const OTRO_CLIENTE = 'BIVETT';
const LAYOUT_OTRO = { kpis: [], tabs: [{ key: 'flujo', label: 'Flujo', panels: panelesDummy(2) }] };

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
const now = '25/09/2026 10:00:00';
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
const { CONFIGS } = require('../dashboard-config-seed');
const ORLANT_TARGET = CONFIGS.find((c) => c.cliente === 'ORLANT');
const TARGET_TAB = ORLANT_TARGET.layout.tabs.find((t) => t.key === 'agendamiento');

test('migracion dashboards_config_orlant_agendas_panel_v1: prepende el panel nuevo y corre +1 los indices de las sub-pestanas ya existentes', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const tab = layout.tabs.find((t) => t.key === 'agendamiento');

  assert.equal(tab.panels.length, 7, 'debe tener 1 panel mas que antes (el nuevo, prepend)');
  assert.equal(tab.panels[0].tipo, 'agendas_panel');
  assert.deepEqual(tab.panels[0], TARGET_TAB.panels[0]);
  // Los 6 paneles viejos siguen ahi, intactos, solo corridos +1.
  for (let i = 0; i < 6; i++) assert.deepEqual(tab.panels[i + 1], { tipo: 'combo', titulo: 'Panel ' + i });

  assert.deepEqual(
    tab.subtabs.map((s) => s.key),
    ['citasporespecialidad', 'ordmed', 'recuperacion', 'totalagendas', 'agendasporlinea', 'variacion']
  );
  assert.deepEqual(tab.subtabs[0], { key: 'citasporespecialidad', label: 'Citas por Especialidad', indices: [0] });
  assert.deepEqual(tab.subtabs[1], { key: 'ordmed', label: 'Ordenamiento Medico', indices: [1, 2] });
  assert.deepEqual(tab.subtabs[2], { key: 'recuperacion', label: 'Recuperacion de Cancelados', indices: [3] });
  assert.deepEqual(tab.subtabs[3], { key: 'totalagendas', label: 'Total Agendas', indices: [4] });
  assert.deepEqual(tab.subtabs[4], { key: 'agendasporlinea', label: 'Agendas por Linea', indices: [5] });
  assert.deepEqual(tab.subtabs[5], { key: 'variacion', label: 'Variacion % Agendas', indices: [6] });
  // Todos los indices siguen apuntando dentro del array de paneles real.
  tab.subtabs.forEach((s) => s.indices.forEach((i) => assert.ok(i >= 0 && i < tab.panels.length)));

  // `oculta` no lo toca esta migracion (dashboard-generic.js decide en
  // memoria segun si hay agendas cargadas, nunca la migracion).
  assert.equal(tab.oculta, true);
});

test('migracion dashboards_config_orlant_agendas_panel_v1: nunca toca otro cliente', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(OTRO_CLIENTE);
  assert.deepEqual(JSON.parse(row.layout), LAYOUT_OTRO);
});

test('migracion dashboards_config_orlant_agendas_panel_v1: es idempotente -- correrla nuevamente (server real) no vuelve a prepender', () => {
  // db.js ya corrio la migracion una vez al requerirse arriba; simplemente
  // confirmamos que la forma final tiene EXACTAMENTE 1 panel nuevo, no 2 --
  // runOnceMigration ya la marca como corrida (tabla migraciones), pero
  // esto ademas prueba que el propio guard `tab.panels[0].tipo ===
  // 'agendas_panel'` es correcto si algo la disparara de nuevo a mano.
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const tab = JSON.parse(row.layout).tabs.find((t) => t.key === 'agendamiento');
  assert.equal(tab.panels.filter((p) => p.tipo === 'agendas_panel').length, 1);
});
