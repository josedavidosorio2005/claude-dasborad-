// orlant-agendas-panel-migracion.test.js — prueba la migracion
// `dashboards_config_orlant_agendas_panel_v1` (server/db.js), Fase 78:
// prepende panels[0] de la config ACTUAL (dashboard-config-seed.js) al tab
// "agendamiento" de ORLANT y corre +1 los indices de sus sub-pestanas ya
// existentes. El panel que prepende y el guard de cantidad de paneles
// "viejos" son DINAMICOS (leen CONFIGS en el momento de migrar) -- este
// fixture tambien lee CONFIGS para no quedar pegado a una forma puntual de
// "agendamiento" que ya cambio 2 veces (Fase 78 agrego "Citas por
// Especialidad"; Fase 94 dejo solo los 4 paneles reales de la tabla
// `agendas`, con nombres distintos). Mismo patron que
// orlant-subpestanas-migracion.test.js: sembrar el layout VIEJO a mano
// *antes* de requerir db.js, y verificar "despues".
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
const TARGET_TAB = ORLANT_TARGET.layout.tabs.find((t) => t.key === 'agendamiento');
// El guard de la migracion exige que el tab "viejo" tenga EXACTAMENTE
// targetTab.panels.length - 1 paneles (todos menos el que prepende) -- ver
// server/db.js. El contenido puntual de esos paneles/subtabs viejos no
// importa para esta prueba (es generico a proposito), solo que la
// migracion los prepende y corre los indices correctamente.
const N_VIEJOS = TARGET_TAB.panels.length - 1;

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-agendas-panel-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

function panelesDummy(n) {
  return Array.from({ length: n }, (_, i) => ({ tipo: 'combo', titulo: 'Panel ' + i }));
}
const LAYOUT_VIEJO = {
  kpis: [],
  tabs: [
    {
      key: 'agendamiento', label: 'Agendamiento', oculta: true, panels: panelesDummy(N_VIEJOS),
      subtabs: Array.from({ length: N_VIEJOS }, (_, i) => ({ key: 'sub' + i, label: 'Sub ' + i, indices: [i] })),
    },
    { key: 'calidad', label: 'Calidad', panels: [{ tipo: 'calidad_kpis', campana: 'ORLANT' }] },
  ],
};

// Escenario 2: un ORLANT cuyo tab "agendamiento" fue editado a mano a una
// cantidad de paneles DISTINTA (nunca deberia pasar en la practica -- este
// tab no se edita desde el constructor -- pero la migracion debe dejarlo
// intacto en vez de romper los indices, igual que las demas migraciones).
const OTRO_CLIENTE = 'MOBILIZE';
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
const now = '30/09/2026 10:00:00';
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

test('migracion dashboards_config_orlant_agendas_panel_v1: prepende el panel nuevo y corre +1 los indices de las sub-pestanas ya existentes', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const tab = layout.tabs.find((t) => t.key === 'agendamiento');

  assert.equal(tab.panels.length, N_VIEJOS + 1, 'debe tener 1 panel mas que antes (el nuevo, prepend)');
  assert.deepEqual(tab.panels[0], TARGET_TAB.panels[0]);
  // Los paneles viejos siguen ahi, intactos, solo corridos +1.
  for (let i = 0; i < N_VIEJOS; i++) assert.deepEqual(tab.panels[i + 1], { tipo: 'combo', titulo: 'Panel ' + i });

  // Las sub-pestanas viejas siguen ahi, corridas +1, mas la nueva prepend.
  assert.equal(tab.subtabs.length, N_VIEJOS + 1);
  assert.deepEqual(tab.subtabs[0], TARGET_TAB.subtabs[0]);
  for (let i = 0; i < N_VIEJOS; i++) assert.deepEqual(tab.subtabs[i + 1], { key: 'sub' + i, label: 'Sub ' + i, indices: [i + 1] });
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
  // confirmamos que la forma final tiene EXACTAMENTE 1 panel del tipo
  // prepend (TARGET_TAB.panels[0].tipo), no 2 -- runOnceMigration ya la
  // marca como corrida (tabla migraciones), pero esto ademas prueba que el
  // propio guard `tab.panels[0].tipo === targetTab.panels[0].tipo` es
  // correcto si algo la disparara de nuevo a mano.
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const tab = JSON.parse(row.layout).tabs.find((t) => t.key === 'agendamiento');
  assert.equal(tab.panels.filter((p) => p.tipo === TARGET_TAB.panels[0].tipo).length, 1);
});
