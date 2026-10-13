// fase139-llamadas-unicas-tab-base-nueva.test.js — Fase 139: una base NUEVA
// (seed + TODAS las migraciones, incluida la vieja
// dashboards_config_mobilize_llamadas_unicas_panel_v1, que vuelve a meter el
// panel en "flujo" despues del seed) termina con el MISMO layout de MOBILIZE
// que el seed -- igual que una base en el estado de produccion (ver
// fase139-llamadas-unicas-tab-migracion.test.js). Proceso propio = base propia.
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { CONFIGS } = require('../dashboard-config-seed');

const tmpDb = path.join(os.tmpdir(), `inconexion-fase139-lu-nueva-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

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

test('base nueva: el layout final de MOBILIZE es identico al seed (Flujo sin el panel de unicas, tab propio despues)', () => {
  const layout = JSON.parse(db.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'MOBILIZE'").get().layout);
  assert.deepEqual(layout, CONFIGS.find((c) => c.cliente === 'MOBILIZE').layout);
  assert.deepEqual(layout.tabs.find((t) => t.key === 'flujo').panels.map((p) => p.tipo), ['trafico_combo']);
  assert.deepEqual(layout.tabs.map((t) => t.key).slice(0, 2), ['flujo', 'llamadas_unicas']);
});

test('base nueva: las 2 migraciones de llamadas unicas quedan registradas una vez cada una', () => {
  for (const name of ['dashboards_config_mobilize_llamadas_unicas_panel_v1', 'dashboards_config_mobilize_llamadas_unicas_tab_v1']) {
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM schema_migrations WHERE name = ?').get(name).n, 1, name);
  }
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
