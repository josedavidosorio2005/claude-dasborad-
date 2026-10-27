// fase139-llamadas-unicas-tab-migracion.test.js — Fase 139 (decision del
// usuario 13/10/2026): `dashboards_config_mobilize_llamadas_unicas_tab_v1`
// (server/db.js) saca el panel de Llamadas Unicas de "Flujo de Llamadas" a
// su propio tab "llamadas_unicas", justo despues de "flujo".
//
// Base en el ESTADO REAL DE PRODUCCION (v1.30.x): "flujo" = [llamadas_unicas
// _panel, trafico_combo] y sin tab propio. Tras requerir db.js, el layout de
// MOBILIZE debe quedar IDENTICO al del seed (dashboard-config-seed.js) -- el
// mismo que obtiene una base NUEVA (ver fase139-llamadas-unicas-tab-base-
// nueva.test.js, en su propio proceso). Ademas: idempotente y sin tocar
// ningun dato de la tabla llamadas_unicas.
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { CONFIGS } = require('../dashboard-config-seed');

const tmpDb = path.join(os.tmpdir(), `inconexion-fase139-lu-tab-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

const SEED_MOBILIZE = CONFIGS.find((c) => c.cliente === 'MOBILIZE');
// Estado de produccion = el seed de la Fase 138 PR3: el panel de llamadas
// unicas PRIMERO dentro de "flujo", sin tab propio.
function layoutProduccion() {
  const l = JSON.parse(JSON.stringify(SEED_MOBILIZE.layout));
  const iLu = l.tabs.findIndex((t) => t.key === 'llamadas_unicas');
  const [tabLu] = l.tabs.splice(iLu, 1);
  const flujo = l.tabs.find((t) => t.key === 'flujo');
  flujo.panels = [...tabLu.panels, ...flujo.panels];
  return l;
}
const LAYOUT_PROD = layoutProduccion();

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
pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES ('MOBILIZE','Dashboard Mobilize',NULL,?,?,1,'13/10/2026','13/10/2026')`
).run(JSON.stringify(SEED_MOBILIZE.secciones), JSON.stringify(LAYOUT_PROD));
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
const layoutMobilize = () => JSON.parse(db.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'MOBILIZE'").get().layout);

test('el fixture SI es el estado de produccion: llamadas unicas dentro de "flujo", sin tab propio', () => {
  assert.deepEqual(LAYOUT_PROD.tabs.find((t) => t.key === 'flujo').panels.map((p) => p.tipo), ['llamadas_unicas_panel', 'trafico_combo']);
  assert.ok(!LAYOUT_PROD.tabs.some((t) => t.key === 'llamadas_unicas'));
});

test('base migrada (produccion) == seed: mismo layout final que una base nueva', () => {
  assert.deepEqual(layoutMobilize(), SEED_MOBILIZE.layout);
});

test('"flujo" queda solo con trafico_combo; sus sub-pestañas terminan en la forma de la Fase 145 (Resumen / Nivel de Servicio / Abandono / ASA y ATA / AHT)', () => {
  const flujo = layoutMobilize().tabs.find((t) => t.key === 'flujo');
  assert.deepEqual(flujo.panels.map((p) => p.tipo), ['trafico_combo']);
  // Fase 145: la migracion dashboards_config_mobilize_flujo_asaata_aht_v1
  // (misma carga de db.js) cambia "ASA y AHT" por "ASA y ATA" + "AHT".
  assert.deepEqual(flujo.panels[0].subtabs.map((s) => s.label), ['Resumen', 'Nivel de Servicio', 'Abandono', 'ASA y ATA', 'AHT', 'One & Done', 'Eficacia']); // Fase 147 D: + One & Done al final; Fase 199: + Eficacia
  const { subtabs: _subMigradas, ...restoMigrado } = flujo.panels[0];
  const { subtabs: _subProd, ...restoProd } = LAYOUT_PROD.tabs.find((t) => t.key === 'flujo').panels[1];
  assert.deepEqual(restoMigrado, restoProd, 'fuera de las sub-pestañas, el trafico_combo no cambio en nada');
});

test('el tab "llamadas_unicas" queda justo despues de "flujo", visible, con el panel de ingreso', () => {
  const tabs = layoutMobilize().tabs;
  assert.deepEqual(tabs.map((t) => t.key), ['flujo', 'llamadas_unicas', 'flujo_hora', 'tipificacion', 'encuesta', 'calidad']); // Fase 147 (Parte B): Encuesta antes de Calidad; Fase 196: Flujo por hora despues de Llamadas Unicas
  assert.equal(tabs[1].label, 'Llamadas Únicas y de Salida'); // Fase 145: solo el texto
  assert.equal(tabs[1].oculta, undefined, 'siempre visible: el panel trae su propio aviso de "sin datos"');
  assert.deepEqual(tabs[1].panels, [{ tipo: 'llamadas_unicas_panel', campana: 'MOBILIZE' }]);
});

test('idempotente: correr la migracion 2 veces mas no cambia nada', () => {
  const antes = layoutMobilize();
  assert.equal(db.migrarMobilizeLlamadasUnicasATabPropio(), false);
  assert.equal(db.migrarMobilizeLlamadasUnicasATabPropio(), false);
  assert.deepEqual(layoutMobilize(), antes);
  const n = db.prepare("SELECT COUNT(*) AS n FROM schema_migrations WHERE name = 'dashboards_config_mobilize_llamadas_unicas_tab_v1'").get().n;
  assert.equal(n, 1, 'registrada una sola vez');
});

test('si alguien vuelve a poner el panel en "flujo", la migracion lo saca sin duplicar el tab', () => {
  const l = layoutMobilize();
  l.tabs.find((t) => t.key === 'flujo').panels.unshift({ tipo: 'llamadas_unicas_panel', campana: 'MOBILIZE' });
  db.prepare("UPDATE dashboards_config SET layout = ? WHERE cliente = 'MOBILIZE'").run(JSON.stringify(l));
  assert.equal(db.migrarMobilizeLlamadasUnicasATabPropio(), true);
  assert.deepEqual(layoutMobilize(), SEED_MOBILIZE.layout);
});

test('defensiva: un tab "llamadas_unicas" personalizado sin el panel no se toca', () => {
  const l = layoutMobilize();
  l.tabs.find((t) => t.key === 'llamadas_unicas').panels = [{ tipo: 'line', titulo: 'personalizado' }];
  l.tabs.find((t) => t.key === 'flujo').panels.unshift({ tipo: 'llamadas_unicas_panel', campana: 'MOBILIZE' });
  db.prepare("UPDATE dashboards_config SET layout = ? WHERE cliente = 'MOBILIZE'").run(JSON.stringify(l));
  assert.equal(db.migrarMobilizeLlamadasUnicasATabPropio(), false);
  assert.deepEqual(layoutMobilize(), l);
  db.prepare("UPDATE dashboards_config SET layout = ? WHERE cliente = 'MOBILIZE'").run(JSON.stringify(SEED_MOBILIZE.layout));
});

test('nunca toca los datos cargados de llamadas_unicas', () => {
  const ins = db.prepare("INSERT INTO llamadas_unicas (campana, fecha, tipo, skill, agente, archivoNombre, cargadoPorNombre, createdAt) VALUES ('MOBILIZE', ?, ?, 'SKILL SINTETICO', 'Asesor Sintetico', 'x.xlsx', 'test', '13/10/2026')");
  ins.run('2026-09-01', 'CONTESTADA');
  ins.run('2026-09-02', 'ABANDONADA');
  const antes = db.prepare('SELECT * FROM llamadas_unicas ORDER BY id').all();
  const l = layoutMobilize();
  l.tabs = l.tabs.filter((t) => t.key !== 'llamadas_unicas');
  l.tabs[0].panels.unshift({ tipo: 'llamadas_unicas_panel', campana: 'MOBILIZE' });
  db.prepare("UPDATE dashboards_config SET layout = ? WHERE cliente = 'MOBILIZE'").run(JSON.stringify(l));
  assert.equal(db.migrarMobilizeLlamadasUnicasATabPropio(), true);
  assert.deepEqual(db.prepare('SELECT * FROM llamadas_unicas ORDER BY id').all(), antes);
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
