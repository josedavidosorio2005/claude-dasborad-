// orlant-ranking-asesores-migracion.test.js — prueba la migracion
// `dashboards_config_orlant_ranking_asesores_v1` (server/db.js), Fase 104
// (pedido de InCo): el panel 3 de la pestaña Agendamiento
// (tipo:'agendas_panel', vista:'agente', "Agendas por Agente" -- Fase 94)
// se reemplaza por vista:'ranking' ("Ranking de Asesores"), y su sub-pestaña
// (key:'agendasporagente') pasa a key:'rankingasesores'. Mismo patron que
// orlant-agendamiento-edwin-migracion.test.js: sembrar el layout VIEJO a
// mano *antes* de requerir db.js, y verificar "despues".
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
const targetAgenda = (ORLANT_TARGET.layout.tabs || []).find((t) => t.key === 'agendamiento');

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-ranking-asesores-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Forma "vieja" reconocible (Fase 94 -> antes de la Fase 104): 4 paneles,
// panels[3] = agendas_panel vista:'agente' ("Agendas por Agente").
const AGENDAMIENTO_VIEJO = {
  key: 'agendamiento', label: 'Agendamiento', oculta: true,
  panels: [
    { tipo: 'agendas_panel', vista: 'especialidad', titulo: 'Agendas por Especialidad', campana: 'ORLANT' },
    { tipo: 'agendas_panel', vista: 'mensual', titulo: 'Total de Agendas por Mes', campana: 'ORLANT' },
    { tipo: 'agendas_panel', vista: 'linea', titulo: 'Agendas por Línea', campana: 'ORLANT' },
    { tipo: 'agendas_panel', vista: 'agente', titulo: 'Agendas por Agente', campana: 'ORLANT' },
  ],
  subtabs: [
    { key: 'porespecialidad', label: 'Por especialidad', indices: [0] },
    { key: 'totalagendas', label: 'Total agendas', indices: [1] },
    { key: 'agendasporlinea', label: 'Agendas por línea', indices: [2] },
    { key: 'agendasporagente', label: 'Agendas por agente', indices: [3] },
  ],
};
const LAYOUT_VIEJO = {
  kpis: [],
  tabs: [
    AGENDAMIENTO_VIEJO,
    { key: 'calidad', label: 'Calidad', panels: [{ tipo: 'calidad_kpis', campana: 'ORLANT' }] },
  ],
};

// Escenario 2: un tab "agendamiento" personalizado (panel 3 no es
// agendas_panel, o vista distinta de "agente") -- la migracion debe
// dejarlo intacto, igual que las demas migraciones de ORLANT.
const AGENDAMIENTO_PERSONALIZADO = {
  key: 'agendamiento', label: 'Agendamiento',
  panels: [
    { tipo: 'agendas_panel', vista: 'especialidad', campana: 'ORLANT' },
    { tipo: 'agendas_panel', vista: 'mensual', campana: 'ORLANT' },
    { tipo: 'agendas_panel', vista: 'linea', campana: 'ORLANT' },
    { tipo: 'combo', titulo: 'Panel a mano en vez del de agente' },
  ],
  subtabs: [{ key: 'personalizado', label: 'Personalizado', indices: [3] }],
};
const OTRO_CLIENTE = 'MOBILIZE';
const LAYOUT_OTRO = { kpis: [], tabs: [AGENDAMIENTO_PERSONALIZADO] };

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

test('migracion dashboards_config_orlant_ranking_asesores_v1: el panel 3 pasa de vista "agente" a lo que la config actual tenga para ese panel, igual a la config actual', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const agenda = layout.tabs.find((t) => t.key === 'agendamiento');
  assert.deepEqual(agenda.panels, targetAgenda.panels);
  assert.deepEqual(agenda.subtabs, targetAgenda.subtabs);
  // El panel 3 ya no es necesariamente 'agendas_panel'/vista:'ranking' --
  // una migracion POSTERIOR (Fase 111) lo reemplaza por su propio
  // efectividad_agendamiento_panel; en una base que corre TODAS las
  // migraciones desde cero (como esta prueba), el resultado final de
  // panels[3] es el de la fase mas reciente. El titulo "Ranking de
  // Asesores" si se mantuvo igual a traves de ese cambio.
  assert.equal(agenda.panels[3].titulo, 'Ranking de Asesores');
  // Los otros 3 paneles (especialidad/mensual/linea) quedan intactos.
  assert.equal(agenda.panels[0].vista, 'especialidad');
  assert.equal(agenda.panels[1].vista, 'mensual');
  assert.equal(agenda.panels[2].vista, 'linea');
});

test('migracion dashboards_config_orlant_ranking_asesores_v1: la sub-pestaña pasa de "agendasporagente" a "rankingasesores"', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const agenda = layout.tabs.find((t) => t.key === 'agendamiento');
  const subtab = agenda.subtabs.find((s) => (s.indices || []).includes(3));
  assert.ok(subtab);
  assert.equal(subtab.key, 'rankingasesores');
  assert.equal(subtab.label, 'Ranking de asesores');
});

test('migracion dashboards_config_orlant_ranking_asesores_v1: nunca toca un tab "agendamiento" que no coincide con la forma vieja reconocible (panel 3 personalizado)', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(OTRO_CLIENTE);
  assert.deepEqual(JSON.parse(row.layout), LAYOUT_OTRO, 'el layout de otro cliente queda byte a byte igual (la query es exclusiva de ORLANT)');
});

test('migracion dashboards_config_orlant_ranking_asesores_v1: es idempotente -- correrla dos veces seguidas da el mismo resultado', () => {
  // db.js ya corrio la migracion una vez al requerirse arriba -- se
  // confirma corriendo TODAS las migraciones una SEGUNDA vez de verdad,
  // reabriendo la base (panels[3].vista ya no aplica como guard, ver la
  // prueba de arriba: una migracion posterior, Fase 111, le cambio el
  // tipo).
  const antes = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT').layout;

  delete require.cache[require.resolve('../db')];
  const db2 = require('../db');
  const despues = db2.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT').layout;
  assert.equal(antes, despues, 'reabrir la base (segunda corrida real de todas las migraciones) da byte a byte el mismo resultado');
});
