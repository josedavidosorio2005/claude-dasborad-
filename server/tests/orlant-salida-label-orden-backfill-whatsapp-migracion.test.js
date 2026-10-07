// orlant-salida-label-orden-backfill-whatsapp-migracion.test.js — prueba
// que `dashboards_config_orlant_salida_label_orden_v1` (server/db.js, Fase
// 128 Parte 1) funciona bien ENCADENADA con
// `dashboards_config_orlant_trafico_whatsapp_tab_v1` (Fase 50) cuando un
// ORLANT viejo nunca tuvo la pestaña "trafico_whatsapp": esa migracion mas
// vieja la agrega (al final del array) ANTES de que corra la de Salida, asi
// que para cuando esta corre, el ancla SIEMPRE existe -- el "sin ancla" de
// la migracion de Salida es, en la practica, solo defensivo (nunca se
// ejercita con un ORLANT real). Esta prueba confirma el resultado COMBINADO
// final, no cada migracion aislada (mismo criterio que
// orlant-orden-pestanas-migracion.test.js con v1+v2).
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

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-salida-backfill-wpp-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

const CALIDAD = { key: 'calidad', label: 'Calidad', panels: [{ tipo: 'calidad_kpis', campana: 'ORLANT' }] };
const SALIDA_FASE127 = { key: 'salida', label: 'Salida', oculta: true, panels: [
  { tipo: 'salida_panel', campana: 'ORLANT', titulo: 'Salida (Llamadas y WhatsApp)' },
]};
// A proposito sin 'trafico_whatsapp' -- simula un ORLANT de antes de la
// Fase 50 que nunca se hubiera actualizado.
const LAYOUT_SIN_WPP = { kpis: [], tabs: [CALIDAD, SALIDA_FASE127] };

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
).run('ORLANT', 'Dashboard Clinica Orlant', null, '{}', JSON.stringify(LAYOUT_SIN_WPP), now, now);
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

test('migraciones encadenadas (trafico_whatsapp_tab_v1 + salida_label_orden_v1): "trafico_whatsapp" se agrega y "salida" queda renombrada justo despues', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const claves = layout.tabs.map((t) => t.key);
  assert.ok(claves.includes('trafico_whatsapp'), 'la migracion vieja (Fase 50) debio agregarla');
  const idxTraficoWpp = claves.indexOf('trafico_whatsapp');
  const idxSalida = claves.indexOf('salida');
  assert.equal(idxSalida, idxTraficoWpp + 1);
  const tabSalida = layout.tabs.find((t) => t.key === 'salida');
  assert.equal(tabSalida.label, targetSalida.label);
  assert.deepEqual(tabSalida.panels, targetSalida.panels);
  assert.equal(claves.length, 3, 'calidad + trafico_whatsapp (nueva) + salida, nada se perdio');
});
