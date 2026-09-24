// orlant-resumen-trafico-opcional-migracion.test.js — prueba la migracion
// `dashboards_config_orlant_resumen_trafico_opcional_v1` (server/db.js),
// Fase 71 (Edwin, 24/09): dashboards_config.secciones (schema que describe
// la hoja "resumen") solo se siembra la primera vez que un cliente no
// existe -- esta migracion actualiza una fila YA sembrada para marcar las 7
// metricas de trafico como opcional+autoTrafico y agregar la nota
// explicativa, igual que dashboard-secciones.js ya trae para un cliente
// nuevo. Mismo patron que orlant-kpis-vacios-migracion.test.js: sembrar el
// esquema VIEJO a mano *antes* de requerir db.js, y verificar "despues".
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-resumen-trafico-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Forma "vieja" reconocible: las 7 metricas de trafico SIN opcional/autoTrafico,
// tal como estaban antes de la Fase 71 (mismas 23 columnas de
// dashboard-secciones.js, sin las banderas nuevas ni notasExtra).
const SECCIONES_ORLANT_VIEJO = {
  resumen: {
    titulo: 'Resumen mensual (KPIs y tendencias)',
    cadencia: 'mensual',
    periodo: 'mes',
    filaUnica: true,
    columnas: [
      { key: 'llamadas_3p', label: 'Llamadas 3P', tipo: 'entero' },
      { key: 'wpp_3p', label: 'WhatsApp 3P', tipo: 'entero' },
      { key: 'llamadas_general', label: 'Llamadas Linea General', tipo: 'entero' },
      { key: 'wpp_general', label: 'WhatsApp Linea General', tipo: 'entero' },
      { key: 'nivel_atencion_3p', label: 'Nivel Atencion 3P (%)', tipo: 'porcentaje' },
      { key: 'nivel_atencion_wpp_3p', label: 'Nivel Atencion WhatsApp 3P (%)', tipo: 'porcentaje' },
      { key: 'nivel_atencion_general', label: 'Nivel Atencion Linea General (%)', tipo: 'porcentaje' },
      { key: 'total_agendas', label: 'Total agendas del mes', tipo: 'entero' },
    ],
  },
  salida: { titulo: 'Salida', cadencia: 'diaria', periodo: 'mes', filaUnica: false, columnas: [{ key: 'fecha', label: 'Fecha (AAAA-MM-DD)', tipo: 'fecha' }] },
};
// Otro cliente cualquiera -- confirma que la migracion no toca clientes
// fuera de ORLANT.
const SECCIONES_OTRO = { resumen: { titulo: 'Resumen', cadencia: 'mensual', periodo: 'mes', filaUnica: true, columnas: [{ key: 'nivel_atencion', label: 'Nivel de atencion (%)', tipo: 'porcentaje' }] } };

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
const now = '24/09/2026 12:00:00';
const insertar = pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
);
insertar.run('ORLANT', 'Dashboard Clinica Orlant', null, JSON.stringify(SECCIONES_ORLANT_VIEJO), '{"kpis":[],"tabs":[]}', now, now);
insertar.run('CLINICA AURORA', 'Dashboard Clinica Aurora', null, JSON.stringify(SECCIONES_OTRO), '{"kpis":[],"tabs":[]}', now, now);
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

function resumenColsDe(cliente) {
  const row = db.prepare('SELECT secciones FROM dashboards_config WHERE cliente = ?').get(cliente);
  return JSON.parse(row.secciones).resumen;
}

test('migracion dashboards_config_orlant_resumen_trafico_opcional_v1: las 7 metricas de trafico quedan opcional+autoTrafico', () => {
  const resumen = resumenColsDe('ORLANT');
  const AUTO = ['llamadas_3p', 'wpp_3p', 'llamadas_general', 'wpp_general', 'nivel_atencion_3p', 'nivel_atencion_wpp_3p', 'nivel_atencion_general'];
  AUTO.forEach((key) => {
    const col = resumen.columnas.find((c) => c.key === key);
    assert.ok(col, key + ' debe seguir existiendo en el esquema');
    assert.equal(col.opcional, true, key + ' debe quedar opcional');
    assert.equal(col.autoTrafico, true, key + ' debe quedar autoTrafico');
  });
});

test('migracion dashboards_config_orlant_resumen_trafico_opcional_v1: agrega la nota explicativa (notasExtra)', () => {
  const resumen = resumenColsDe('ORLANT');
  assert.equal(resumen.notasExtra.length, 1);
  assert.match(resumen.notasExtra[0], /se calculan solas/i);
});

test('migracion dashboards_config_orlant_resumen_trafico_opcional_v1: nunca toca columnas que no son de trafico (total_agendas sigue obligatoria)', () => {
  const resumen = resumenColsDe('ORLANT');
  const col = resumen.columnas.find((c) => c.key === 'total_agendas');
  assert.equal(col.opcional, undefined);
  assert.equal(col.autoTrafico, undefined);
});

test('migracion dashboards_config_orlant_resumen_trafico_opcional_v1: nunca toca otras secciones de ORLANT (salida intacta)', () => {
  const row = db.prepare("SELECT secciones FROM dashboards_config WHERE cliente = 'ORLANT'").get();
  const secciones = JSON.parse(row.secciones);
  assert.deepEqual(secciones.salida, SECCIONES_ORLANT_VIEJO.salida);
});

test('migracion dashboards_config_orlant_resumen_trafico_opcional_v1: nunca toca otro cliente', () => {
  const row = db.prepare("SELECT secciones FROM dashboards_config WHERE cliente = 'CLINICA AURORA'").get();
  assert.deepEqual(JSON.parse(row.secciones), SECCIONES_OTRO);
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
