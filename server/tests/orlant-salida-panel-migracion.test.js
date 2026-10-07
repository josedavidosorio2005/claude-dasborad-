// orlant-salida-panel-migracion.test.js — prueba la migracion
// `dashboards_config_orlant_salida_panel_v1` (server/db.js), Fase 127
// (pedido textual de Edwin: "las llamadas de salida estan muy bajas"): el
// tab "salida" (2 paneles `line`/filtroSerie leyendo dashboard_cargas
// generico POR DIA, nunca tuvo datos reales) se reemplaza por su propio
// `salida_panel` (tabla nueva `salida_mensual`). Mismo patron que
// orlant-efectividad-citas-migracion.test.js (reemplazo de panel), sin
// reposicionamiento de tab: sembrar el layout VIEJO a mano *antes* de
// requerir db.js, verificar "despues".
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
const targetSalida = (ORLANT_TARGET.layout.tabs || []).find((t) => t.key === 'salida');

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-salida-panel-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Forma "vieja" reconocible: tab "salida" con 2 paneles `line`/filtroSerie
// (dashboard_cargas generico por dia) + subtabs.
const SALIDA_VIEJO = {
  key: 'salida', label: 'Salida', oculta: true,
  panels: [
    { tipo: 'line', titulo: 'Llamadas de salida', filtroSerie: true, series: [
      { label: 'Línea General', fuente: { s: 'salida', modo: 'filas', x: 'fecha', campo: 'salida_general' } },
      { label: 'Línea 3P', fuente: { s: 'salida', modo: 'filas', x: 'fecha', campo: 'salida_3p' } },
    ]},
    { tipo: 'line', titulo: 'WhatsApp de salida', filtroSerie: true, series: [
      { label: 'Línea General', fuente: { s: 'salida', modo: 'filas', x: 'fecha', campo: 'wpp_salida_general' } },
      { label: 'Línea 3P', fuente: { s: 'salida', modo: 'filas', x: 'fecha', campo: 'wpp_salida_3p' } },
    ]},
  ],
  subtabs: [
    { key: 'llamadas', label: 'Llamadas de Salida', indices: [0] },
    { key: 'whatsapp', label: 'WhatsApp de Salida', indices: [1] },
  ],
};
const OTRO_TAB = { key: 'calidad', label: 'Calidad', panels: [{ tipo: 'calidad_kpis', campana: 'ORLANT' }] };
const LAYOUT_VIEJO = { kpis: [], tabs: [OTRO_TAB, SALIDA_VIEJO] };

// Escenario 2: un tab "salida" personalizado (no coincide con la forma
// vieja reconocible) -- la migracion debe dejarlo intacto.
const SALIDA_PERSONALIZADO = { key: 'salida', label: 'Salida a mano', panels: [{ tipo: 'bar', titulo: 'Panel a mano' }] };
const OTRO_CLIENTE = 'BIVETT';
const LAYOUT_OTRO = { kpis: [], tabs: [SALIDA_PERSONALIZADO] };

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

test('migracion dashboards_config_orlant_salida_panel_v1: el panel pasa de line/filtroSerie generico a salida_panel, igual a la config actual', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const tab = layout.tabs.find((t) => t.key === 'salida');
  assert.ok(tab);
  assert.deepEqual(tab.panels, targetSalida.panels);
  assert.equal(tab.panels[0].tipo, 'salida_panel');
  // Fase 128 (Parte 1): dashboards_config_orlant_salida_label_orden_v1
  // corre despues de esta en la misma carga de db.js y renombra el label
  // -- se compara contra la config ACTUAL (targetSalida.label), no contra
  // el literal viejo 'Salida', para no quedar desalineado la proxima vez
  // que cambie el nombre.
  assert.equal(tab.label, targetSalida.label);
  assert.equal(tab.subtabs, undefined, 'el panel nuevo no usa subtabs -- dibuja sus 2 graficas el mismo');
});

// Fase 128 (Parte 1): dashboards_config_orlant_salida_label_orden_v1 SI
// reposiciona "salida" (justo despues de 'trafico_whatsapp'), de forma
// INCONDICIONAL sobre la posicion -- este fixture no tenia esa pestaña,
// pero dashboards_config_orlant_trafico_whatsapp_tab_v1 (Fase 50, corre
// antes en la misma carga de db.js) la agrega al final si falta, asi que
// para cuando la migracion de Salida corre, el ancla SI existe y "salida"
// SI se reubica justo despues. El titulo de este test (heredado de la Fase
// 127, cuando esa migracion nunca reposicionaba nada) queda desactualizado
// a proposito -- ver orlant-salida-label-orden-migracion.test.js para la
// prueba dedicada de reubicacion.
test('migracion dashboards_config_orlant_salida_panel_v1: no reposiciona ELLA MISMA el tab (esa migracion vieja nunca lo hizo) -- la reubicacion final la hace la migracion de la Fase 128, no esta', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const idxTraficoWpp = layout.tabs.findIndex((t) => t.key === 'trafico_whatsapp');
  const idxSalida = layout.tabs.findIndex((t) => t.key === 'salida');
  assert.ok(idxTraficoWpp !== -1, 'trafico_whatsapp_tab_v1 debio agregarla');
  assert.equal(idxSalida, idxTraficoWpp + 1);
});

test('migracion dashboards_config_orlant_salida_panel_v1: nunca toca un tab "salida" que no coincide con la forma vieja reconocible', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(OTRO_CLIENTE);
  assert.deepEqual(JSON.parse(row.layout), LAYOUT_OTRO, 'el layout de otro cliente queda byte a byte igual (la query es exclusiva de ORLANT)');
});

test('migracion dashboards_config_orlant_salida_panel_v1: es idempotente -- correrla dos veces seguidas da el mismo resultado', () => {
  const antes = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT').layout;

  delete require.cache[require.resolve('../db')];
  const db2 = require('../db');
  const despues = db2.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT').layout;
  assert.equal(antes, despues, 'reabrir la base (segunda corrida real de todas las migraciones) da byte a byte el mismo resultado');
});
