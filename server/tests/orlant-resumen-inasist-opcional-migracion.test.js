// orlant-resumen-inasist-opcional-migracion.test.js — prueba la migracion
// `dashboards_config_orlant_resumen_inasist_opcional_v1` (server/db.js),
// Fase 100 (hallazgo real en produccion, revision final antes de entregar
// ORLANT): la Fase 98 (adenda, PR #212) marco los 4 campos viejos de
// inasistencia de la hoja "resumen" como opcional+ocultaEnPlantilla en
// dashboard-secciones.js, pero ese cambio nunca le llego a la fila YA
// sembrada de dashboards_config -- la plantilla descargable de produccion
// seguia listando esos 4 campos (confirmado bajando la plantilla real).
// Mismo patron que orlant-resumen-trafico-opcional-migracion.test.js:
// sembrar el esquema VIEJO a mano *antes* de requerir db.js, verificar
// "despues".
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-resumen-inasist-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Forma "vieja" reconocible: los 4 campos de inasistencia SIN
// opcional/ocultaEnPlantilla, tal como estaban sembrados antes de esta
// migracion (el estado real de produccion encontrado en la Fase 100).
const SECCIONES_ORLANT_VIEJO = {
  resumen: {
    titulo: 'Resumen mensual (KPIs y tendencias)',
    cadencia: 'mensual',
    periodo: 'mes',
    filaUnica: true,
    columnas: [
      { key: 'total_agendas', label: 'Total agendas del mes', tipo: 'entero' },
      { key: 'inasist_audifonos', label: '% Inasistencia Audifonos', tipo: 'porcentaje' },
      { key: 'inasist_audiologia', label: '% Inasistencia Audiologia', tipo: 'porcentaje' },
      { key: 'inasist_examenes', label: '% Inasistencia Examenes', tipo: 'porcentaje' },
      { key: 'inasist_total', label: '% Inasistencia Total', tipo: 'porcentaje' },
      { key: 'sta_ordenes', label: 'STA — Ordenes cargadas', tipo: 'entero' },
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
const now = '30/09/2026 12:00:00';
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

test('migracion dashboards_config_orlant_resumen_inasist_opcional_v1: los 4 campos viejos de inasistencia quedan opcional+ocultaEnPlantilla', () => {
  const resumen = resumenColsDe('ORLANT');
  const INASIST = ['inasist_audifonos', 'inasist_audiologia', 'inasist_examenes', 'inasist_total'];
  INASIST.forEach((key) => {
    const col = resumen.columnas.find((c) => c.key === key);
    assert.ok(col, key + ' debe seguir existiendo en el esquema (compatibilidad hacia atras)');
    assert.equal(col.opcional, true, key + ' debe quedar opcional');
    assert.equal(col.ocultaEnPlantilla, true, key + ' debe quedar ocultaEnPlantilla');
  });
});

test('migracion dashboards_config_orlant_resumen_inasist_opcional_v1: nunca toca columnas que no son de inasistencia (total_agendas/sta_ordenes siguen obligatorias)', () => {
  const resumen = resumenColsDe('ORLANT');
  ['total_agendas', 'sta_ordenes'].forEach((key) => {
    const col = resumen.columnas.find((c) => c.key === key);
    assert.equal(col.opcional, undefined, key + ' no debe quedar opcional');
    assert.equal(col.ocultaEnPlantilla, undefined, key + ' no debe quedar ocultaEnPlantilla');
  });
});

test('migracion dashboards_config_orlant_resumen_inasist_opcional_v1: nunca toca otras secciones de ORLANT (salida intacta)', () => {
  const row = db.prepare("SELECT secciones FROM dashboards_config WHERE cliente = 'ORLANT'").get();
  const secciones = JSON.parse(row.secciones);
  assert.deepEqual(secciones.salida, SECCIONES_ORLANT_VIEJO.salida);
});

test('migracion dashboards_config_orlant_resumen_inasist_opcional_v1: nunca toca otro cliente', () => {
  const row = db.prepare("SELECT secciones FROM dashboards_config WHERE cliente = 'CLINICA AURORA'").get();
  assert.deepEqual(JSON.parse(row.secciones), SECCIONES_OTRO);
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
