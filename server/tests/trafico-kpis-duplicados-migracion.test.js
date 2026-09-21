// trafico-kpis-duplicados-migracion.test.js — prueba la migracion
// `dashboards_config_trafico_kpis_duplicados_v1` (server/db.js), Fase 45
// (pedido de Edwin): quita de la franja global de KPIs (arriba de las
// pestanas, #gd-kpis) los que duplicaban en nombre las tarjetas del resumen
// de "Trafico de Llamadas" -- esa informacion queda SOLO ahi. Mismo patron
// que orlant-ocultar-pestanas-migracion.test.js: sembrar el layout VIEJO a
// mano *antes* de requerir db.js, y verificar "despues".
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const tmpDb = path.join(os.tmpdir(), `inconexion-trafico-kpis-dup-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Forma "vieja" reconocible: los kpis de AURORA/HLM tal como salian antes de
// la Fase 45, con los duplicados de Trafico de Llamadas todavia adentro.
const KPIS_AURORA_VIEJO = [
  { titulo: 'Llamadas Entrada', fuente: {}, formato: 'miles' },
  { titulo: 'Nivel Atencion', fuente: {}, formato: 'porcentaje' },
  { titulo: 'Abandonos', fuente: {}, formato: 'entero' },
  { titulo: 'AHT Promedio', fuente: {}, formato: 'tiempo_mmss' },
  { titulo: 'WhatsApp Entrada', fuente: {}, formato: 'miles' },
];
const KPIS_HLM_VIEJO = [
  { titulo: 'Llamadas Ingresadas', fuente: {}, formato: 'miles' },
  { titulo: 'Nivel Atencion Llamadas', fuente: {}, formato: 'porcentaje' },
  { titulo: 'Llamadas Contestadas', fuente: {}, formato: 'miles' },
  { titulo: 'Llamadas Abandonadas', fuente: {}, formato: 'miles' },
  { titulo: 'AHT Promedio', fuente: {}, formato: 'tiempo_mmss' },
  { titulo: 'Total Agendas', fuente: {}, formato: 'miles' },
];
// Otro cliente cualquiera (ORLANT no aplica: no tiene estos titulos
// duplicados) -- confirma que la migracion no toca clientes fuera de su lista.
const KPIS_OTRO_VIEJO = [{ titulo: 'Llamadas Contestadas', fuente: {}, formato: 'miles' }];

function layoutCon(kpis) {
  return { kpis, tabs: [{ key: 'trafico', label: 'Trafico de Llamadas', panels: [{ tipo: 'trafico_combo' }] }] };
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
const now = '21/09/2026 14:00:00';
const insertar = pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
);
insertar.run('CLINICA AURORA', 'Dashboard Clinica Aurora', null, '{}', JSON.stringify(layoutCon(KPIS_AURORA_VIEJO)), now, now);
insertar.run('HOSPITAL LA MARIA', 'Dashboard Hospital La Maria', null, '{}', JSON.stringify(layoutCon(KPIS_HLM_VIEJO)), now, now);
insertar.run('BIVETT', 'Dashboard Bivett', null, '{}', JSON.stringify(layoutCon(KPIS_OTRO_VIEJO)), now, now);
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

test('migracion dashboards_config_trafico_kpis_duplicados_v1: AURORA pierde los 3 duplicados de Trafico', () => {
  const titulos = kpisDe('CLINICA AURORA');
  assert.equal(titulos.indexOf('Llamadas Entrada'), -1);
  assert.equal(titulos.indexOf('Nivel Atencion'), -1);
  assert.equal(titulos.indexOf('Abandonos'), -1);
});

test('migracion dashboards_config_trafico_kpis_duplicados_v1: AURORA conserva AHT Promedio y el resto', () => {
  const titulos = kpisDe('CLINICA AURORA');
  assert.deepEqual(titulos, ['AHT Promedio', 'WhatsApp Entrada']);
});

test('migracion dashboards_config_trafico_kpis_duplicados_v1: HOSPITAL LA MARIA pierde los 4 duplicados de Trafico', () => {
  const titulos = kpisDe('HOSPITAL LA MARIA');
  ['Llamadas Ingresadas', 'Nivel Atencion Llamadas', 'Llamadas Contestadas', 'Llamadas Abandonadas'].forEach((t) => {
    assert.equal(titulos.indexOf(t), -1, t + ' deberia haberse quitado');
  });
});

test('migracion dashboards_config_trafico_kpis_duplicados_v1: HOSPITAL LA MARIA conserva AHT Promedio y Total Agendas', () => {
  const titulos = kpisDe('HOSPITAL LA MARIA');
  assert.deepEqual(titulos, ['AHT Promedio', 'Total Agendas']);
});

test('migracion dashboards_config_trafico_kpis_duplicados_v1: nunca toca otro cliente (BIVETT no esta en la lista)', () => {
  assert.deepEqual(kpisDe('BIVETT'), ['Llamadas Contestadas']);
});

test('migracion dashboards_config_trafico_kpis_duplicados_v1: nunca toca tabs/panels, solo el array kpis', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('CLINICA AURORA');
  const layout = JSON.parse(row.layout);
  assert.equal(layout.tabs[0].key, 'trafico');
  assert.equal(layout.tabs[0].panels[0].tipo, 'trafico_combo');
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
