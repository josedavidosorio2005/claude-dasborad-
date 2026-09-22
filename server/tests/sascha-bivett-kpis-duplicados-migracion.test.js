// sascha-bivett-kpis-duplicados-migracion.test.js — prueba la migracion
// `dashboards_config_sascha_bivett_kpis_duplicados_v1` (server/db.js),
// Fase 59 (hallazgo de la Fase 58, mismo patron que la Fase 45/54): las 3
// tarjetas 'Llamadas Entrada'/'Nivel de Atencion'/'Abandonos' de la franja
// global de SASCHA FITNESS y BIVETT duplicaban exacto lo que ya muestra su
// pestaña real de Trafico de Llamadas -- se quitan, 'WhatsApp Entrada' se
// mantiene (sin modulo automatico de WhatsApp para estos clientes). Mismo
// patron que orlant-kpis-whatsapp-duplicados-migracion.test.js: sembrar el
// layout VIEJO a mano *antes* de requerir db.js, y verificar "despues".
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const tmpDb = path.join(os.tmpdir(), `inconexion-sascha-bivett-kpis-dup-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Forma "vieja" reconocible: los kpis de plantillaAtencion tal como salian
// antes de la Fase 59, con las 3 tarjetas duplicadas todavia adentro.
const KPIS_VIEJO = [
  { titulo: 'Llamadas Entrada', fuente: {}, formato: 'miles' },
  { titulo: 'WhatsApp Entrada', fuente: {}, formato: 'miles' },
  { titulo: 'Nivel de Atencion', fuente: {}, formato: 'porcentaje' },
  { titulo: 'Abandonos', fuente: {}, formato: 'entero' },
  { titulo: 'AHT Promedio', fuente: {}, formato: 'tiempo_mmss' },
  { titulo: 'Pedidos', fuente: {}, formato: 'miles' },
];
// Otro cliente cualquiera (nunca tuvo estos titulos) -- confirma que la
// migracion no toca clientes fuera de la lista.
const KPIS_OTRO_VIEJO = [{ titulo: 'Llamadas Entrada', fuente: {}, formato: 'miles' }];

function layoutCon(kpis) {
  return {
    kpis,
    tabs: [
      { key: 'calidad', label: 'Calidad', panels: [{ tipo: 'calidad_kpis' }] },
      { key: 'trafico', label: 'Trafico de Llamadas', panels: [{ tipo: 'trafico_combo' }] },
    ],
  };
}

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
const now = '22/09/2026 14:00:00';
const insertar = pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
);
insertar.run('SASCHA FITNESS', 'Dashboard Sascha Fitness', null, '{}', JSON.stringify(layoutCon(KPIS_VIEJO)), now, now);
insertar.run('BIVETT', 'Dashboard Bivett', null, '{}', JSON.stringify(layoutCon(KPIS_VIEJO)), now, now);
insertar.run('ANDRES YEPES', 'Dashboard Andres Yepes', null, '{}', JSON.stringify(layoutCon(KPIS_OTRO_VIEJO)), now, now);
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

function kpisDe(cliente) {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(cliente);
  return JSON.parse(row.layout).kpis.map((k) => k.titulo);
}

test('migracion dashboards_config_sascha_bivett_kpis_duplicados_v1: SASCHA FITNESS pierde las 3 tarjetas duplicadas', () => {
  const titulos = kpisDe('SASCHA FITNESS');
  ['Llamadas Entrada', 'Nivel de Atencion', 'Abandonos'].forEach((t) => {
    assert.equal(titulos.indexOf(t), -1, t + ' deberia haberse quitado');
  });
});

test('migracion dashboards_config_sascha_bivett_kpis_duplicados_v1: SASCHA FITNESS conserva WhatsApp Entrada/AHT/Pedidos, en el mismo orden', () => {
  assert.deepEqual(kpisDe('SASCHA FITNESS'), ['WhatsApp Entrada', 'AHT Promedio', 'Pedidos']);
});

test('migracion dashboards_config_sascha_bivett_kpis_duplicados_v1: BIVETT pierde las mismas 3 tarjetas', () => {
  const titulos = kpisDe('BIVETT');
  ['Llamadas Entrada', 'Nivel de Atencion', 'Abandonos'].forEach((t) => {
    assert.equal(titulos.indexOf(t), -1, t + ' deberia haberse quitado');
  });
  assert.deepEqual(titulos, ['WhatsApp Entrada', 'AHT Promedio', 'Pedidos']);
});

test('migracion dashboards_config_sascha_bivett_kpis_duplicados_v1: nunca toca otro cliente (ANDRES YEPES no esta en la lista, aunque tenga el mismo titulo)', () => {
  assert.deepEqual(kpisDe('ANDRES YEPES'), ['Llamadas Entrada']);
});

test('migracion dashboards_config_sascha_bivett_kpis_duplicados_v1: nunca toca tabs/panels, solo el array kpis', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('SASCHA FITNESS');
  const layout = JSON.parse(row.layout);
  assert.equal(layout.tabs[1].key, 'trafico');
  assert.equal(layout.tabs[1].panels[0].tipo, 'trafico_combo');
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
