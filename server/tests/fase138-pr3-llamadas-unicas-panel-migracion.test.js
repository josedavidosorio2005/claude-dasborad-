// fase138-pr3-llamadas-unicas-panel-migracion.test.js — prueba la migracion
// `dashboards_config_mobilize_llamadas_unicas_panel_v1` (server/db.js),
// Fase 138 (PR3, pedido de Edwin 09/10/2026): agrega el panel
// "llamadas_unicas_panel" a MOBILIZE. Mismo patron de prueba que
// fase138-pr2-tipificacion-asaaht.test.js: sembrar el layout VIEJO
// reconocible a mano *antes* de requerir db.js, verificar "despues".
//
// Fase 139 (decision del usuario 13/10/2026): en la MISMA carga de db.js
// corre despues `dashboards_config_mobilize_llamadas_unicas_tab_v1`, que
// saca el panel de "flujo" a su propio tab "llamadas_unicas". Lo que esta
// prueba siempre comprobo (el panel se agrega una sola vez, el
// trafico_combo y "calidad" quedan intactos, otro cliente / forma no
// reconocible nunca se toca, idempotente) se sigue comprobando, ahora sobre
// el estado FINAL: panel en su tab propio, "flujo" como antes de la PR3.
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const tmpDb = path.join(os.tmpdir(), `inconexion-fase138-pr3-panel-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

function tab(key, panels) {
  return { key, label: 'Label ' + key, panels };
}

// MOBILIZE: forma reconocible real (trafico_combo en "flujo", SIN
// llamadas_unicas_panel todavia) + un cliente de control que nunca deberia
// tocarse, y una forma de "flujo" NO reconocible (otro cliente de control).
const LAYOUT_MOBILIZE = {
  kpis: [],
  tabs: [
    tab('flujo', [{ tipo: 'trafico_combo', campana: 'MOBILIZE', resumenOcultar: ['tasaAbandono'] }]),
    tab('calidad', [{ tipo: 'calidad_kpis', campana: 'MOBILIZE' }]),
  ],
};
const OTRO_CLIENTE = 'CLINICA_AURORA_CONTROL';
const LAYOUT_OTRO = { kpis: [], tabs: [tab('flujo', [{ tipo: 'line', titulo: 'x' }])] };

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
const now = '09/10/2026 10:00:00';
const insertRow = pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
);
insertRow.run('MOBILIZE', 'Dashboard Mobilize', null, '{}', JSON.stringify(LAYOUT_MOBILIZE), now, now);
insertRow.run(OTRO_CLIENTE, 'Dashboard Control', null, '{}', JSON.stringify(LAYOUT_OTRO), now, now);
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

function layoutMobilize(conDb) {
  return JSON.parse((conDb || db).prepare("SELECT layout FROM dashboards_config WHERE cliente = 'MOBILIZE'").get().layout);
}

test('migraciones de llamadas unicas: el panel se agrega UNA vez, en su tab propio, justo despues de "flujo"', () => {
  const layout = layoutMobilize();
  // (la migracion del tab "tipificacion", misma carga de db.js, le agrega
  // ademas su propio tab a este fixture -- no es parte de esta prueba)
  assert.deepEqual(layout.tabs.map((t) => t.key).filter((k) => k !== 'tipificacion' && k !== 'encuesta'), ['flujo', 'llamadas_unicas', 'calidad']); // Fase 147: + encuesta (su propia migracion)
  const tabLu = layout.tabs[1];
  assert.equal(tabLu.label, 'Llamadas Únicas y de Salida'); // Fase 145: solo el texto
  assert.deepEqual(tabLu.panels, [{ tipo: 'llamadas_unicas_panel', campana: 'MOBILIZE' }]);
  const todos = layout.tabs.flatMap((t) => t.panels).filter((p) => p.tipo === 'llamadas_unicas_panel');
  assert.equal(todos.length, 1, 'un solo panel de llamadas unicas en todo el dashboard');
});

test('migraciones de llamadas unicas: "flujo" queda EXACTAMENTE como antes (solo el trafico_combo original, con sus opciones)', () => {
  const tabFlujo = layoutMobilize().tabs.find((t) => t.key === 'flujo');
  assert.deepEqual(tabFlujo, LAYOUT_MOBILIZE.tabs[0]);
});

test('migraciones de llamadas unicas: no tocan el tab "calidad" de MOBILIZE', () => {
  const tabCalidad = layoutMobilize().tabs.find((t) => t.key === 'calidad');
  assert.deepEqual(tabCalidad, LAYOUT_MOBILIZE.tabs[1]);
});

test('migraciones de llamadas unicas: nunca tocan otro cliente, ni uno con "flujo" en forma NO reconocible', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(OTRO_CLIENTE);
  assert.deepEqual(JSON.parse(row.layout), LAYOUT_OTRO, 'un "flujo" sin trafico_combo reconocible nunca se toca');
});

test('migraciones de llamadas unicas: idempotentes -- reabrir la base no duplica el panel ni el tab', () => {
  const antes = layoutMobilize();
  db.closeDb();
  delete require.cache[require.resolve('../db')];
  const db2 = require('../db');
  const despues = layoutMobilize(db2);
  assert.deepEqual(despues, antes);
  db2.closeDb();
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
