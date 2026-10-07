// orlant-calidad-bar-asesores-personalizado-migracion.test.js — prueba que
// `dashboards_config_orlant_calidad_bar_asesores_v1` (server/db.js, Fase
// 130) NUNCA toca un tab "calidad" de ORLANT cuyos paneles no coinciden
// EXACTO con la forma estandar (kpis + pie, en ese orden, nada mas) --
// podria ser una personalizacion de un admin desde el constructor visual
// (hallazgo real: orlant-orden-pestanas-migracion.test.js ya sembraba un
// tab "calidad" con un panel `combo` a mano, y esta migracion le agregaba
// el panel nuevo igual, rompiendo esa prueba). Mismo patron defensivo que
// las demas migraciones de este tipo (ver
// orlant-salida-label-orden-personalizado-migracion.test.js).
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-calidad-bar-asesores-personalizado-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// mostrarAht/mostrarSL5min YA estan en 'false' a proposito (igual que la
// config actual) -- si no, otras migraciones no relacionadas
// (dashboards_config_orlant_whatsapp_sin_aht_v1/_sin_sl5min_v1) los
// backfillean en esta misma carga de db.js y el layout ya no queda byte a
// byte igual, aunque esta migracion de Calidad nunca lo haya tocado.
const TRAFICO_WPP = { key: 'trafico_whatsapp', label: 'Tráfico de WhatsApp', panels: [{ tipo: 'trafico_whatsapp_combo', campana: 'ORLANT', mostrarAht: false, mostrarSL5min: false }] };
// Tab "calidad" personalizado a mano: un panel `combo` en vez de los 2
// estandar (kpis + pie) -- no coincide con la forma reconocible.
const CALIDAD_PERSONALIZADA = { key: 'calidad', label: 'Calidad', panels: [{ tipo: 'combo', titulo: 'Panel calidad' }] };
const LAYOUT = { kpis: [], tabs: [TRAFICO_WPP, CALIDAD_PERSONALIZADA] };

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
const now = '07/10/2026 10:00:00';
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

test('migracion dashboards_config_orlant_calidad_bar_asesores_v1: un tab "calidad" personalizado (no kpis+pie) queda byte a byte igual', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  assert.deepEqual(JSON.parse(row.layout), LAYOUT, 'nunca se asume la forma de un tab "calidad" que no coincide con el estandar reconocible');
});
