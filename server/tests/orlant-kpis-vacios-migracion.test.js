// orlant-kpis-vacios-migracion.test.js — prueba la migracion
// `dashboards_config_orlant_kpis_vacios_v1` (server/db.js), Fase 68 Pedido 2
// (Edwin, 23/09): la franja global de KPIs de ORLANT se vacia por completo
// -- Llamadas/Nivel de Atencion ya estan en la pestaña de Trafico, Total
// Agendas volvera cuando se grafiquen agendas, y las demas no se usan asi.
// Mismo patron que orlant-kpis-whatsapp-duplicados-migracion.test.js (Fase
// 54): sembrar el layout VIEJO a mano *antes* de requerir db.js, y
// verificar "despues".
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-kpis-vacios-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Forma "vieja" reconocible: los 9 kpis de ORLANT tal como quedaron tras la
// Fase 54 (ya sin las 4 tarjetas de WhatsApp, pero con las de Llamadas y las
// demas todavia adentro).
const KPIS_ORLANT_VIEJO = [
  { titulo: 'Llamadas 3P', fuente: {}, formato: 'miles' },
  { titulo: 'Nivel Atencion 3P', fuente: {}, formato: 'porcentaje' },
  { titulo: 'Llamadas Linea General', fuente: {}, formato: 'miles' },
  { titulo: 'Nivel Atencion L.General', fuente: {}, formato: 'porcentaje' },
  { titulo: 'Total Agendas', fuente: {}, formato: 'miles' },
  { titulo: 'Efec. Ordenamiento Medico', fuente: {}, formato: 'porcentaje' },
  { titulo: 'Recuperacion Cancelados', fuente: {}, formato: 'porcentaje' },
  { titulo: 'Llamadas Salida (Gral+3P)', fuente: {}, formato: 'miles' },
  { titulo: '% Citas Atendidas', fuente: {}, formato: 'porcentaje' },
];
// Otro cliente cualquiera -- confirma que la migracion no toca clientes
// fuera de ORLANT (pedido explicito: los demas clientes conservan su
// franja). MOVILIZE a proposito: no aparece en ninguna otra migracion de
// kpis de este archivo (ni Fase 45 ni Fase 59), asi que este titulo no se
// puede confundir con el efecto de otra migracion distinta.
const KPIS_OTRO_VIEJO = [{ titulo: 'Llamadas Entrada', fuente: {}, formato: 'miles' }];

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
const now = '24/09/2026 09:00:00';
const insertar = pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
);
insertar.run('ORLANT', 'Dashboard Clinica Orlant', null, '{}', JSON.stringify(layoutCon(KPIS_ORLANT_VIEJO)), now, now);
insertar.run('MOVILIZE', 'Dashboard Movilize', null, '{}', JSON.stringify(layoutCon(KPIS_OTRO_VIEJO)), now, now);
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

test('migracion dashboards_config_orlant_kpis_vacios_v1: ORLANT queda con la franja de KPIs vacia', () => {
  assert.deepEqual(kpisDe('ORLANT'), []);
});

test('migracion dashboards_config_orlant_kpis_vacios_v1: nunca toca otro cliente', () => {
  assert.deepEqual(kpisDe('MOVILIZE'), ['Llamadas Entrada']);
});

test('migracion dashboards_config_orlant_kpis_vacios_v1: nunca toca tabs/panels, solo el array kpis', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  assert.equal(layout.tabs[1].key, 'trafico_whatsapp');
  assert.equal(layout.tabs[1].panels[0].tipo, 'trafico_whatsapp_combo');
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
