// orlant-salida-label-orden-migracion.test.js — prueba la migracion
// `dashboards_config_orlant_salida_label_orden_v1` (server/db.js), Fase 128
// (Parte 1, pedido textual de Edwin en la reunion de validacion): el tab
// "salida" (ya en forma `salida_panel`, dejada por
// dashboards_config_orlant_salida_panel_v1 en la Fase 127) se renombra de
// "Salida" a "Llamadas y WhatsApp de salida" (label + titulo del panel) y
// se reubica justo despues de "trafico_whatsapp". Mismo patron que
// orlant-salida-panel-migracion.test.js: sembrar el layout VIEJO a mano
// *antes* de requerir db.js, verificar "despues". Los escenarios de
// "nunca toca algo que no identifico con certeza" (label personalizado,
// sin pestaña ancla) viven en sus propios archivos aparte (ver
// orlant-salida-label-orden-personalizado-migracion.test.js y
// orlant-salida-label-orden-sin-ancla-migracion.test.js) porque cada uno
// necesita su PROPIO layout de ORLANT (solo puede existir una fila por
// cliente en una misma base).
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

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-salida-label-orden-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Forma reconocible post-Fase-127 (lo que dejaba dashboards_config_orlant_
// salida_panel_v1 en una base real): label 'Salida', un unico panel
// `salida_panel` con el titulo viejo.
const SALIDA_FASE127 = { key: 'salida', label: 'Salida', oculta: true, panels: [
  { tipo: 'salida_panel', campana: 'ORLANT', titulo: 'Salida (Llamadas y WhatsApp)' },
]};
const TRAFICO = { key: 'trafico', label: 'Tráfico de Llamadas', panels: [{ tipo: 'trafico_combo', campana: 'ORLANT' }] };
const TRAFICO_WPP = { key: 'trafico_whatsapp', label: 'Tráfico de WhatsApp', panels: [{ tipo: 'trafico_whatsapp_combo', campana: 'ORLANT' }] };
const AGENDAMIENTO = { key: 'agendamiento', label: 'Agendamiento', oculta: true, panels: [{ tipo: 'agendas_panel', vista: 'especialidad', campana: 'ORLANT' }] };
const CALIDAD = { key: 'calidad', label: 'Calidad', panels: [{ tipo: 'calidad_kpis', campana: 'ORLANT' }] };

// Orden viejo real: Salida al final, despues de Calidad -- junto con las
// pestañas ancla que SI existen en produccion (trafico, trafico_whatsapp).
const LAYOUT_VIEJO = { kpis: [], tabs: [TRAFICO, TRAFICO_WPP, AGENDAMIENTO, CALIDAD, SALIDA_FASE127] };

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
const now = '06/10/2026 10:00:00';
pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
).run('ORLANT', 'Dashboard Clinica Orlant', null, '{}', JSON.stringify(LAYOUT_VIEJO), now, now);
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

test('migracion dashboards_config_orlant_salida_label_orden_v1: renombra label y titulo del panel a la config actual', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const tab = layout.tabs.find((t) => t.key === 'salida');
  assert.ok(tab);
  assert.equal(tab.label, targetSalida.label);
  assert.equal(tab.label, 'Llamadas y WhatsApp de salida');
  assert.deepEqual(tab.panels, targetSalida.panels);
});

test('migracion dashboards_config_orlant_salida_label_orden_v1: reubica "salida" justo despues de "trafico_whatsapp"', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const idxTraficoWpp = layout.tabs.findIndex((t) => t.key === 'trafico_whatsapp');
  const idxSalida = layout.tabs.findIndex((t) => t.key === 'salida');
  assert.equal(idxSalida, idxTraficoWpp + 1);
  assert.equal(layout.tabs.length, 5, 'ninguna pestaña se perdio ni se duplico');
});

// No se compara byte a byte contra TRAFICO/TRAFICO_WPP/etc.: otras
// migraciones no relacionadas (ej. dashboards_config_orlant_whatsapp_sin_
// aht_v1) tambien corren en esta misma carga de db.js y pueden backfillear
// campos en esos tabs -- legitimo e independiente de esta migracion. Lo
// unico que le compete verificar aqui es que esos tabs sigan siendo el
// MISMO tipo de panel (nunca se reemplazaron ni se vaciaron).
test('migracion dashboards_config_orlant_salida_label_orden_v1: no toca el tipo de panel de ningun otro tab, solo "salida"', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const porClave = {};
  layout.tabs.forEach((t) => { porClave[t.key] = t; });
  assert.equal(porClave.trafico.panels[0].tipo, TRAFICO.panels[0].tipo);
  assert.equal(porClave.trafico_whatsapp.panels[0].tipo, TRAFICO_WPP.panels[0].tipo);
  assert.equal(porClave.agendamiento.panels[0].tipo, AGENDAMIENTO.panels[0].tipo);
  assert.equal(porClave.calidad.panels[0].tipo, CALIDAD.panels[0].tipo);
});

test('migracion dashboards_config_orlant_salida_label_orden_v1: es idempotente -- correrla dos veces seguidas da el mismo resultado', () => {
  const antes = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT').layout;
  delete require.cache[require.resolve('../db')];
  const db2 = require('../db');
  const despues = db2.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT').layout;
  assert.equal(antes, despues, 'reabrir la base (segunda corrida real de todas las migraciones) da byte a byte el mismo resultado');
});
