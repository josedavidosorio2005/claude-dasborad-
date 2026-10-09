// orlant-efectividad-agendamiento-migracion.test.js — prueba la migracion
// `dashboards_config_orlant_efectividad_agendamiento_v1` (server/db.js),
// Fase 111 (pedido textual de Edwin: "el ranking va a ser efectividad por
// agendamiento"): el panel 3 de la pestaña Agendamiento
// (tipo:'agendas_panel', vista:'ranking' -- forma de la Fase 104, YA
// sembrada en produccion) se reemplaza por tipo:'efectividad_agendamiento_panel'
// ("Ranking de Asesores", ahora calculado por EFECTIVIDAD). Mismo patron
// que orlant-ranking-asesores-migracion.test.js: sembrar el layout VIEJO
// (Fase 104) a mano *antes* de requerir db.js, y verificar "despues".
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

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-efectividad-agendamiento-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Forma "vieja" reconocible (Fase 104, YA sembrada en produccion): panels[3]
// = agendas_panel vista:'ranking' ("Ranking de Asesores", por CANTIDAD).
const AGENDAMIENTO_FASE104 = {
  key: 'agendamiento', label: 'Agendamiento', oculta: true,
  panels: [
    { tipo: 'agendas_panel', vista: 'especialidad', titulo: 'Agendas por Especialidad', campana: 'ORLANT' },
    { tipo: 'agendas_panel', vista: 'mensual', titulo: 'Total de Agendas por Mes', campana: 'ORLANT' },
    { tipo: 'agendas_panel', vista: 'linea', titulo: 'Agendas por Línea', campana: 'ORLANT' },
    { tipo: 'agendas_panel', vista: 'ranking', titulo: 'Ranking de Asesores', campana: 'ORLANT' },
  ],
  subtabs: [
    { key: 'porespecialidad', label: 'Por especialidad', indices: [0] },
    { key: 'totalagendas', label: 'Total agendas', indices: [1] },
    { key: 'agendasporlinea', label: 'Agendas por línea', indices: [2] },
    { key: 'rankingasesores', label: 'Ranking de asesores', indices: [3] },
  ],
};
const LAYOUT_FASE104 = {
  kpis: [],
  tabs: [
    AGENDAMIENTO_FASE104,
    { key: 'calidad', label: 'Calidad', panels: [{ tipo: 'calidad_kpis', campana: 'ORLANT' }] },
  ],
};

// Escenario 2: un tab "agendamiento" personalizado (panel 3 no es el de la
// Fase 104 reconocible) -- la migracion debe dejarlo intacto.
const AGENDAMIENTO_PERSONALIZADO = {
  key: 'agendamiento', label: 'Agendamiento',
  panels: [
    { tipo: 'agendas_panel', vista: 'especialidad', campana: 'ORLANT' },
    { tipo: 'agendas_panel', vista: 'mensual', campana: 'ORLANT' },
    { tipo: 'agendas_panel', vista: 'linea', campana: 'ORLANT' },
    { tipo: 'combo', titulo: 'Panel a mano en vez del ranking' },
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
).run('ORLANT', 'Dashboard Clinica Orlant', null, '{}', JSON.stringify(LAYOUT_FASE104), now, now);
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

test('migracion dashboards_config_orlant_efectividad_agendamiento_v1: el panel 3 pasa de agendas_panel/vista "ranking" a efectividad_agendamiento_panel, igual a la config actual', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const agenda = layout.tabs.find((t) => t.key === 'agendamiento');
  assert.deepEqual(agenda.panels, targetAgenda.panels);
  assert.equal(agenda.panels[3].tipo, 'efectividad_agendamiento_panel');
  assert.equal(agenda.panels[3].titulo, 'Ranking de Asesores');
  // Los otros 3 paneles (especialidad/mensual/linea) quedan intactos.
  assert.equal(agenda.panels[0].vista, 'especialidad');
  assert.equal(agenda.panels[1].vista, 'mensual');
  assert.equal(agenda.panels[2].vista, 'linea');
});

test('migracion dashboards_config_orlant_efectividad_agendamiento_v1: la sub-pestaña "rankingasesores" (indices:[3]) no cambia de key/label', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const agenda = layout.tabs.find((t) => t.key === 'agendamiento');
  assert.deepEqual(agenda.subtabs, targetAgenda.subtabs);
  const subtab = agenda.subtabs.find((s) => (s.indices || []).includes(3));
  assert.equal(subtab.key, 'rankingasesores');
  assert.equal(subtab.label, 'Ranking de asesores');
});

test('migracion dashboards_config_orlant_efectividad_agendamiento_v1: nunca toca un tab "agendamiento" que no coincide con la forma vieja reconocible (panel 3 personalizado)', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(OTRO_CLIENTE);
  assert.deepEqual(JSON.parse(row.layout), LAYOUT_OTRO, 'el layout de otro cliente queda byte a byte igual (la query es exclusiva de ORLANT)');
});

test('migracion dashboards_config_orlant_efectividad_agendamiento_v1: es idempotente -- correrla dos veces seguidas da el mismo resultado', () => {
  const antes = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT').layout;
  const agenda = JSON.parse(antes).tabs.find((t) => t.key === 'agendamiento');
  assert.equal(agenda.panels[3].tipo, 'efectividad_agendamiento_panel', 'el resultado deberia ya cumplir el guard de "ya migrado" tras la primera corrida');

  delete require.cache[require.resolve('../db')];
  const db2 = require('../db');
  const despues = db2.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT').layout;
  assert.equal(antes, despues, 'reabrir la base (segunda corrida real de todas las migraciones) da byte a byte el mismo resultado');
});
