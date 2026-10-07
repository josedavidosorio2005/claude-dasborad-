// orlant-salida-label-orden-personalizado-migracion.test.js — prueba que
// `dashboards_config_orlant_salida_label_orden_v1` (server/db.js, Fase 128
// Parte 1) NUNCA toca un tab "salida" cuyo label ya no es el default
// 'Salida' -- podria ser una personalizacion de un admin desde el
// constructor visual. Mismo patron defensivo que las migraciones
// anteriores de este mismo tab (ver orlant-salida-panel-migracion.test.js).
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-salida-label-orden-personalizado-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// mostrarAht/mostrarSL5min YA estan en 'false' a proposito (igual que la
// config actual) -- si no, otras migraciones no relacionadas
// (dashboards_config_orlant_whatsapp_sin_aht_v1/_sin_sl5min_v1) los
// backfillean en esta misma carga de db.js y el layout ya no queda byte a
// byte igual, aunque esta migracion de Salida nunca lo haya tocado.
const TRAFICO_WPP = { key: 'trafico_whatsapp', label: 'Tráfico de WhatsApp', panels: [{ tipo: 'trafico_whatsapp_combo', campana: 'ORLANT', mostrarAht: false, mostrarSL5min: false }] };
// Label personalizado: forma de panel idéntica a la de Fase 127, pero el
// admin ya le habia puesto su propio nombre al tab.
const SALIDA_PERSONALIZADA = { key: 'salida', label: 'Salida a mano', oculta: true, panels: [
  { tipo: 'salida_panel', campana: 'ORLANT', titulo: 'Salida (Llamadas y WhatsApp)' },
]};
const LAYOUT = { kpis: [], tabs: [TRAFICO_WPP, SALIDA_PERSONALIZADA] };

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
).run('ORLANT', 'Dashboard Clinica Orlant', null, '{}', JSON.stringify(LAYOUT), now, now);
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

test('migracion dashboards_config_orlant_salida_label_orden_v1: nunca toca un label personalizado, ni renombra ni reubica', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  assert.deepEqual(layout, LAYOUT, 'el layout queda byte a byte igual, incluida la posicion -- nunca se reubica ni renombra un tab que no se identifico con certeza como el default');
});
