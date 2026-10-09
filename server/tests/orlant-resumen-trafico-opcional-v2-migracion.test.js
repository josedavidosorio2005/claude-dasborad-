// orlant-resumen-trafico-opcional-v2-migracion.test.js — prueba la
// migracion `dashboards_config_orlant_resumen_trafico_opcional_v2`
// (server/db.js), Fase 84. Reproduce el escenario real encontrado: la
// migracion `_v1` (Fase 71) SI habia corrido (esta en schema_migrations) y
// habia dejado autoTrafico/notasExtra correctos -- pero un PUT posterior a
// /dashboards/config/ORLANT (ANTES del fix de Fase 84 a
// seccionSpecSchema/columnaSchema en validation.js) los volvio a borrar en
// silencio, porque Zod nunca los tenia declarados. Como `runOnceMigration`
// nunca se repite, `_v1` sola nunca se autocorrige -- se necesita `_v2`.
// Mismo patron que orlant-resumen-trafico-opcional-migracion.test.js:
// sembrar el estado "corrupto" a mano *antes* de requerir db.js (incluida
// la fila de schema_migrations que marca `_v1` como ya corrida), verificar
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

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-resumen-trafico-v2-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Estado "corrupto" real: opcional SI quedo (por eso no dispara _v1 de
// nuevo si _v1 pudiera repetirse), pero autoTrafico y notasExtra NO --
// exactamente lo que encontro la Fase 84 en la base local.
const SECCIONES_ORLANT_CORRUPTO = {
  resumen: {
    titulo: 'Resumen mensual (KPIs y tendencias)',
    cadencia: 'mensual',
    periodo: 'mes',
    filaUnica: true,
    columnas: [
      { key: 'llamadas_3p', label: 'Llamadas 3P', tipo: 'entero', opcional: true },
      { key: 'wpp_3p', label: 'WhatsApp 3P', tipo: 'entero', opcional: true },
      { key: 'total_agendas', label: 'Total agendas del mes', tipo: 'entero' },
    ],
    // notasExtra ausente -- se borro en el PUT que reprodujo el bug.
  },
  salida: { titulo: 'Salida', cadencia: 'diaria', periodo: 'mes', filaUnica: false, columnas: [{ key: 'fecha', label: 'Fecha (AAAA-MM-DD)', tipo: 'fecha' }] },
};
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
  CREATE TABLE schema_migrations (
    name TEXT PRIMARY KEY,
    appliedAt TEXT NOT NULL
  );
`);
const now = '28/09/2026 12:00:00';
pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
).run('ORLANT', 'Dashboard Clinica Orlant', null, JSON.stringify(SECCIONES_ORLANT_CORRUPTO), '{"kpis":[],"tabs":[]}', now, now);
pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
).run('MOBILIZE', 'Dashboard Clinica Aurora', null, JSON.stringify(SECCIONES_OTRO), '{"kpis":[],"tabs":[]}', now, now);
// `_v1` ya corrida -- por eso hace falta `_v2` para reparar el estado corrupto.
pre.prepare('INSERT INTO schema_migrations (name, appliedAt) VALUES (?, ?)').run('dashboards_config_orlant_resumen_trafico_opcional_v1', now);
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

test('migracion _v2: repara autoTrafico aunque _v1 ya haya corrido antes (runOnceMigration nunca se repite sola)', () => {
  const resumen = resumenColsDe('ORLANT');
  const col3p = resumen.columnas.find((c) => c.key === 'llamadas_3p');
  assert.equal(col3p.opcional, true);
  assert.equal(col3p.autoTrafico, true, 'autoTrafico debe quedar reparado por _v2');
});

test('migracion _v2: repara notasExtra aunque estuviera completamente ausente', () => {
  const resumen = resumenColsDe('ORLANT');
  assert.equal(resumen.notasExtra.length, 1);
  assert.match(resumen.notasExtra[0], /se calculan solas/i);
});

test('migracion _v2: nunca toca columnas que no son de trafico (total_agendas sigue igual)', () => {
  const resumen = resumenColsDe('ORLANT');
  const col = resumen.columnas.find((c) => c.key === 'total_agendas');
  assert.equal(col.opcional, undefined);
  assert.equal(col.autoTrafico, undefined);
});

test('migracion _v2: nunca toca otro cliente', () => {
  const row = db.prepare("SELECT secciones FROM dashboards_config WHERE cliente = 'MOBILIZE'").get();
  assert.deepEqual(JSON.parse(row.secciones), SECCIONES_OTRO);
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
