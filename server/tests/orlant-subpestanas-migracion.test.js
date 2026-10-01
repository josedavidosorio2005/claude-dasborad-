// orlant-subpestanas-migracion.test.js — prueba la migracion
// `dashboards_config_orlant_subpestanas_v1` (server/db.js), Fase 40
// (2026-09-21): agrupa las graficas de 5 pestanas de ORLANT (Flujo Mensual,
// Salida, Agendamiento, Inasistencia, Gestion STA) en sub-pestanas
// (`subtabs`) -- puramente aditivo, agrupa INDICES del mismo array `panels`
// de siempre, sin tocarlo. Mismo patron que
// orlant-tipificacion-unico-migracion.test.js: sembrar el layout VIEJO a
// mano *antes* de requerir db.js, y verificar "despues".
//
// Fase 106 (pedido de InCo): Inasistencia dejo de tener sub-pestañas (queda
// un solo panel). Sigue en CLAVES_CON_SUBPESTANAS de db.js -- por eso esta
// migracion todavia la toca -- pero converge a `subtabs:[]` en vez de un
// array con contenido, distinto de Tipificacion/Efectividad (que nunca
// estuvieron en esa lista y quedan en `undefined`). Ver la prueba dedicada
// mas abajo.
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-subpestanas-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// La config actual (dashboard-config-seed.js), leida ANTES de requerir
// db.js -- el guard de esta migracion exige que el tab "viejo" tenga
// EXACTAMENTE la misma CANTIDAD de paneles que la config actual espera
// para esa clave (ver server/db.js); "agendamiento" en particular ya
// cambio de forma 2 veces desde que esta migracion se escribio (Fase 78 y
// Fase 94), asi que su cantidad de paneles dummy se deriva de CONFIGS en
// vez de quedar hardcodeada a un numero que dejaria de ser cierto.
const { CONFIGS: CONFIGS_ACTUAL } = require('../dashboard-config-seed');
const ORLANT_ACTUAL = CONFIGS_ACTUAL.find((c) => c.cliente === 'ORLANT');
const targetTabsActual = {};
(ORLANT_ACTUAL.layout.tabs || []).forEach((t) => { targetTabsActual[t.key] = t; });
function nPaneles(key) { return (targetTabsActual[key].panels || []).length; }

// Forma "vieja" reconocible: mismos 5 tabs, mismo NUMERO de paneles que la
// config actual (dashboard-config-seed.js) pero SIN `subtabs` -- el estado
// real de cualquier ORLANT ya sembrado antes de esta fase.
function panelesDummy(n, tipo) {
  return Array.from({ length: n }, (_, i) => ({ tipo: tipo || 'line', titulo: 'Panel ' + i }));
}
const LAYOUT_VIEJO = {
  kpis: [],
  tabs: [
    { key: 'flujo', label: 'Flujo Mensual', panels: panelesDummy(nPaneles('flujo')) },
    { key: 'salida', label: 'Salida', panels: panelesDummy(nPaneles('salida')) },
    { key: 'tipificacion', label: 'Tipificacion', panels: panelesDummy(nPaneles('tipificacion'), 'pie') },
    { key: 'agendamiento', label: 'Agendamiento', panels: panelesDummy(nPaneles('agendamiento')) },
    { key: 'inasistencia', label: 'Inasistencia', panels: panelesDummy(nPaneles('inasistencia')) },
    { key: 'sta', label: 'Gestion STA', panels: panelesDummy(nPaneles('sta')) },
    { key: 'efectividad', label: 'Efectividad Citas', panels: panelesDummy(nPaneles('efectividad'), 'combo') },
  ],
};

// Escenario 2: un tab que ya fue personalizado a un numero de paneles
// DISTINTO al que espera la config actual (ej. un admin borro/agrego un
// panel a mano desde el constructor). La migracion debe dejarlo intacto
// (los indices de `subtabs` ya no significarian lo mismo).
const LAYOUT_PERSONALIZADO = {
  kpis: [],
  tabs: [
    { key: 'flujo', label: 'Flujo Mensual', panels: panelesDummy(3) }, // le falta 1 respecto a la config actual (4)
  ],
};

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
const now = '21/09/2026 13:00:00';
pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
).run('ORLANT', 'Dashboard Clinica Orlant', null, '{}', JSON.stringify(LAYOUT_VIEJO), now, now);

const OTRO_CLIENTE = 'BIVETT';
pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
).run(OTRO_CLIENTE, 'Dashboard Bivett', null, '{}', JSON.stringify(LAYOUT_PERSONALIZADO), now, now);
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
const targetTabs = targetTabsActual;

test('migracion dashboards_config_orlant_subpestanas_v1: agrega subtabs a las 4 pestanas que se dividieron (Inasistencia aparte, Fase 106 la dejo sin sub-pestañas)', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  ['flujo', 'salida', 'agendamiento', 'sta'].forEach((key) => {
    const tab = layout.tabs.find((t) => t.key === key);
    assert.ok(Array.isArray(tab.subtabs) && tab.subtabs.length > 0, key + ' deberia tener subtabs');
    assert.deepEqual(tab.subtabs, targetTabs[key].subtabs, key + ' subtabs deberia migrar a la forma exacta de la config actual');
    // Los indices de cada subtab siguen apuntando dentro del MISMO array de
    // paneles (nunca se toco `panels`, solo se agrego `subtabs`).
    tab.subtabs.forEach((s) => s.indices.forEach((i) => assert.ok(i >= 0 && i < tab.panels.length)));
  });
});

test('migracion dashboards_config_orlant_subpestanas_v1: Inasistencia (Fase 106, sin sub-pestañas en la config actual) converge a subtabs:[], no se le deja contenido viejo', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const tab = layout.tabs.find((t) => t.key === 'inasistencia');
  assert.deepEqual(tab.subtabs, []);
});

test('migracion dashboards_config_orlant_subpestanas_v1: nunca toca pestanas sin subtabs en la config actual (Tipificacion, Efectividad)', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  ['tipificacion', 'efectividad'].forEach((key) => {
    const tab = layout.tabs.find((t) => t.key === key);
    assert.equal(tab.subtabs, undefined);
  });
});

test('migracion dashboards_config_orlant_subpestanas_v1: nunca toca otro cliente (la query es exclusiva de ORLANT)', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(OTRO_CLIENTE);
  const layout = JSON.parse(row.layout);
  assert.deepEqual(layout, LAYOUT_PERSONALIZADO);
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
