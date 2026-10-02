// orlant-efectividad-citas-migracion.test.js — prueba la migracion
// `dashboards_config_orlant_efectividad_citas_v1` (server/db.js), Fase 111
// (pedido textual de InCo): el tab "efectividad" (panel `combo` generico
// leyendo citas_para_mes/citas_atendidas de "resumen", al FINAL del
// layout, despues de "Gestión STA") se reemplaza por su propio
// `efectividad_citas_panel` Y se mueve justo DESPUES de "Inasistencia".
// Mismo patron que orlant-ranking-asesores-migracion.test.js (reemplazo de
// panel) + orlant-orden-pestanas-migracion.test.js (reubicacion de tab):
// sembrar el layout VIEJO a mano *antes* de requerir db.js, verificar
// "despues".
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
const targetEfectividad = (ORLANT_TARGET.layout.tabs || []).find((t) => t.key === 'efectividad');

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-efectividad-citas-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Forma "vieja" reconocible: tab "efectividad" con 1 panel `combo` leyendo
// citas_para_mes/citas_atendidas, ubicado AL FINAL (despues de "sta").
const EFECTIVIDAD_VIEJO = {
  key: 'efectividad', label: 'Efectividad Citas', oculta: true,
  panels: [
    { tipo: 'combo', titulo: 'Efectividad de citas', barras: [
      { label: 'Citas para el Mes', fuente: { s: 'resumen', modo: 'serie', campo: 'citas_para_mes' } },
      { label: 'Total Atendidas', fuente: { s: 'resumen', modo: 'serie', campo: 'citas_atendidas' } }],
      linea: { label: '% Efectividad', fuente: { s: 'resumen', modo: 'formula', formula: 'a/b*100', a: 'citas_atendidas', b: 'citas_para_mes' } } },
  ],
};
const INASISTENCIA = { key: 'inasistencia', label: 'Inasistencia', oculta: true, panels: [{ tipo: 'inasistencia_panel', vista: 'pormes', campana: 'ORLANT' }] };
const STA = { key: 'sta', label: 'Gestión STA', oculta: true, panels: [{ tipo: 'bar', titulo: 'X' }] };
const LAYOUT_VIEJO = { kpis: [], tabs: [INASISTENCIA, STA, EFECTIVIDAD_VIEJO] };

// Escenario 2: un tab "efectividad" personalizado (no coincide con la
// forma vieja reconocible) -- la migracion debe dejarlo intacto.
const EFECTIVIDAD_PERSONALIZADO = { key: 'efectividad', label: 'Personalizado', panels: [{ tipo: 'bar', titulo: 'Panel a mano' }] };
const OTRO_CLIENTE = 'BIVETT';
const LAYOUT_OTRO = { kpis: [], tabs: [{ key: 'inasistencia', label: 'Inasistencia', panels: [] }, EFECTIVIDAD_PERSONALIZADO] };

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

test('migracion dashboards_config_orlant_efectividad_citas_v1: el panel pasa de combo generico a efectividad_citas_panel, igual a la config actual', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const tab = layout.tabs.find((t) => t.key === 'efectividad');
  assert.ok(tab);
  assert.deepEqual(tab.panels, targetEfectividad.panels);
  assert.equal(tab.panels[0].tipo, 'efectividad_citas_panel');
  assert.equal(tab.label, 'Efectividad de Citas');
});

test('migracion dashboards_config_orlant_efectividad_citas_v1: el tab se mueve justo DESPUES de "Inasistencia" (antes vivia al final, despues de "sta")', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const idxInasistencia = layout.tabs.findIndex((t) => t.key === 'inasistencia');
  const idxEfectividad = layout.tabs.findIndex((t) => t.key === 'efectividad');
  assert.equal(idxEfectividad, idxInasistencia + 1);
  // "sta" sigue existiendo, ahora DESPUES de "efectividad".
  const idxSta = layout.tabs.findIndex((t) => t.key === 'sta');
  assert.equal(idxSta, idxEfectividad + 1);
});

test('migracion dashboards_config_orlant_efectividad_citas_v1: nunca toca un tab "efectividad" que no coincide con la forma vieja reconocible', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(OTRO_CLIENTE);
  assert.deepEqual(JSON.parse(row.layout), LAYOUT_OTRO, 'el layout de otro cliente queda byte a byte igual (la query es exclusiva de ORLANT)');
});

test('migracion dashboards_config_orlant_efectividad_citas_v1: es idempotente -- correrla dos veces seguidas da el mismo resultado', () => {
  const antes = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT').layout;
  const layout = JSON.parse(antes);
  const idxInasistencia = layout.tabs.findIndex((t) => t.key === 'inasistencia');
  const idxEfectividad = layout.tabs.findIndex((t) => t.key === 'efectividad');
  assert.equal(idxEfectividad, idxInasistencia + 1, 'el resultado deberia ya cumplir el guard de "ya migrado" tras la primera corrida');

  delete require.cache[require.resolve('../db')];
  const db2 = require('../db');
  const despues = db2.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT').layout;
  assert.equal(antes, despues, 'reabrir la base (segunda corrida real de todas las migraciones) da byte a byte el mismo resultado');
});
