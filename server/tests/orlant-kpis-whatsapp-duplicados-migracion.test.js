// orlant-kpis-whatsapp-duplicados-migracion.test.js — prueba la migracion
// `dashboards_config_orlant_kpis_whatsapp_duplicados_v1` (server/db.js),
// Fase 54 (hallazgo real del usuario: las 4 tarjetas de WhatsApp de la
// franja global de KPIs de ORLANT mostraban "0" en produccion porque nunca
// consultaron trafico_whatsapp -- salian de la seccion "resumen"/"salida" de
// Gestion de base, carga manual, nunca llenada para esos campos). Mismo
// patron que trafico-kpis-duplicados-migracion.test.js (Fase 45): sembrar
// el layout VIEJO a mano *antes* de requerir db.js, y verificar "despues".
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-kpis-wpp-dup-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Forma "vieja" reconocible: los kpis de ORLANT tal como salian antes de la
// Fase 54, con las 4 tarjetas de WhatsApp desconectadas todavia adentro.
const KPIS_ORLANT_VIEJO = [
  { titulo: 'Llamadas 3P', fuente: {}, formato: 'miles' },
  { titulo: 'Nivel Atencion 3P', fuente: {}, formato: 'porcentaje' },
  { titulo: 'WhatsApp 3P', fuente: {}, formato: 'miles' },
  { titulo: 'Nivel Atencion WPP 3P', fuente: {}, formato: 'porcentaje' },
  { titulo: 'Llamadas Linea General', fuente: {}, formato: 'miles' },
  { titulo: 'Nivel Atencion L.General', fuente: {}, formato: 'porcentaje' },
  { titulo: 'WhatsApp Linea General', fuente: {}, formato: 'miles' },
  { titulo: 'Total Agendas', fuente: {}, formato: 'miles' },
  { titulo: 'Llamadas Salida (Gral+3P)', fuente: {}, formato: 'miles' },
  { titulo: 'WhatsApp Salida (Gral+3P)', fuente: {}, formato: 'miles' },
  { titulo: '% Citas Atendidas', fuente: {}, formato: 'porcentaje' },
];
// Otro cliente cualquiera (nunca tuvo estos titulos) -- confirma que la
// migracion no toca clientes fuera de ORLANT.
const KPIS_OTRO_VIEJO = [{ titulo: 'WhatsApp 3P', fuente: {}, formato: 'miles' }];

function layoutCon(kpis) {
  return {
    kpis,
    tabs: [
      { key: 'trafico', label: 'Trafico de Llamadas', panels: [{ tipo: 'trafico_combo' }] },
      { key: 'trafico_whatsapp', label: 'Trafico de WhatsApp', panels: [{ tipo: 'trafico_whatsapp_combo', campana: 'ORLANT' }] },
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
insertar.run('ORLANT', 'Dashboard Clinica Orlant', null, '{}', JSON.stringify(layoutCon(KPIS_ORLANT_VIEJO)), now, now);
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

test('migracion dashboards_config_orlant_kpis_whatsapp_duplicados_v1: ORLANT pierde las 4 tarjetas de WhatsApp', () => {
  const titulos = kpisDe('ORLANT');
  ['WhatsApp 3P', 'Nivel Atencion WPP 3P', 'WhatsApp Linea General', 'WhatsApp Salida (Gral+3P)'].forEach((t) => {
    assert.equal(titulos.indexOf(t), -1, t + ' deberia haberse quitado');
  });
});

test('migracion dashboards_config_orlant_kpis_whatsapp_duplicados_v1: ORLANT conserva las tarjetas de Llamadas y el resto, en el mismo orden', () => {
  const titulos = kpisDe('ORLANT');
  assert.deepEqual(titulos, [
    'Llamadas 3P', 'Nivel Atencion 3P', 'Llamadas Linea General', 'Nivel Atencion L.General',
    'Total Agendas', 'Llamadas Salida (Gral+3P)', '% Citas Atendidas',
  ]);
});

test('migracion dashboards_config_orlant_kpis_whatsapp_duplicados_v1: nunca toca otro cliente (BIVETT no es ORLANT, aunque tenga el mismo titulo)', () => {
  assert.deepEqual(kpisDe('BIVETT'), ['WhatsApp 3P']);
});

test('migracion dashboards_config_orlant_kpis_whatsapp_duplicados_v1: nunca toca tabs/panels, solo el array kpis', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  assert.equal(layout.tabs[1].key, 'trafico_whatsapp');
  assert.equal(layout.tabs[1].panels[0].tipo, 'trafico_whatsapp_combo');
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
