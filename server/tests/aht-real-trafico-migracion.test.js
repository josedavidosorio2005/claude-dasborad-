// aht-real-trafico-migracion.test.js — prueba la migracion
// `dashboards_config_aht_real_trafico_v1` (server/db.js), Fase 65
// (hallazgo #3 de la auditoria de la Fase 64): la tarjeta "AHT Promedio"
// de la franja global de TELEVENTAS SURA, TELEVENTAS COMFAMA, ANDRES
// YEPES, MOVILIZE, SASCHA FITNESS y BIVETT pasa de leer el dato manual de
// Gestion de base (`{s:'resumen', modo:'ultimo', campo:'aht_segundos'}`) a
// leer el dato REAL de Trafico de Llamadas
// (`{s:'trafico', modo:'trafico_aht', campana}`) -- misma fuente/calculo
// que la sub-pestaña "AHT" del panel, para que nunca se desincronicen.
// A diferencia de dashboards_config_sascha_bivett_kpis_duplicados_v1, esta
// migracion NO quita la tarjeta: solo reemplaza su `fuente`, conserva
// titulo/formato/clase. Mismo patron de prueba: sembrar el layout VIEJO a
// mano *antes* de requerir db.js, verificar "despues".
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const tmpDb = path.join(os.tmpdir(), `inconexion-aht-real-trafico-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

const AHT_MANUAL_VIEJO = { s: 'resumen', modo: 'ultimo', campo: 'aht_segundos' };

// Forma "vieja" reconocible: AHT Promedio con la fuente manual, tal como
// salia antes de la Fase 65.
const KPIS_VIEJO = [
  { titulo: 'Base asignada', fuente: {}, formato: 'miles' },
  { titulo: 'AHT Promedio', fuente: AHT_MANUAL_VIEJO, formato: 'tiempo_mmss', cls: 'kpi-org', mejorDireccion: 'baja' },
  { titulo: 'Ventas', fuente: {}, formato: 'miles' },
];
// Cliente SIN Trafico activo (PANTERA MAIKERS/ALBERTO LINERO GO en la vida
// real) -- nunca deberia tocarse, aunque tenga el mismo titulo de KPI.
const KPIS_SIN_TRAFICO = [
  { titulo: 'AHT Promedio', fuente: AHT_MANUAL_VIEJO, formato: 'tiempo_mmss' },
];
// Cliente que YA tiene la fuente nueva (ej. sembrado despues de la Fase
// 65) -- la migracion debe dejarlo intacto, no debe fallar ni duplicar nada.
const KPIS_YA_NUEVO = [
  { titulo: 'AHT Promedio', fuente: { s: 'trafico', modo: 'trafico_aht', campana: 'MOVILIZE' }, formato: 'tiempo_mmss' },
];

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
const now = '23/09/2026 10:00:00';
const insertar = pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
);
const CLIENTES_ESPERADOS = ['TELEVENTAS SURA', 'TELEVENTAS COMFAMA', 'ANDRES YEPES', 'SASCHA FITNESS', 'BIVETT'];
CLIENTES_ESPERADOS.forEach((c) => insertar.run(c, 'Dashboard ' + c, null, '{}', JSON.stringify(layoutCon(KPIS_VIEJO)), now, now));
insertar.run('MOVILIZE', 'Dashboard Movilize', null, '{}', JSON.stringify(layoutCon(KPIS_YA_NUEVO)), now, now);
insertar.run('PANTERA MAIKERS', 'Dashboard Pantera Maikers', null, '{}', JSON.stringify(layoutCon(KPIS_SIN_TRAFICO)), now, now);
insertar.run('OTRO CLIENTE FUERA DE LA LISTA', 'Dashboard Otro', null, '{}', JSON.stringify(layoutCon(KPIS_VIEJO)), now, now);
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

function kpiAhtDe(cliente) {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(cliente);
  return JSON.parse(row.layout).kpis.find((k) => k.titulo === 'AHT Promedio');
}

['TELEVENTAS SURA', 'TELEVENTAS COMFAMA', 'ANDRES YEPES', 'SASCHA FITNESS', 'BIVETT'].forEach((cliente) => {
  test(`migracion dashboards_config_aht_real_trafico_v1: ${cliente} -- AHT Promedio pasa a leer trafico_aht de su propia campana`, () => {
    const k = kpiAhtDe(cliente);
    assert.deepEqual(k.fuente, { s: 'trafico', modo: 'trafico_aht', campana: cliente });
  });

  test(`migracion dashboards_config_aht_real_trafico_v1: ${cliente} -- conserva titulo/formato/cls tal cual, solo cambia la fuente`, () => {
    const k = kpiAhtDe(cliente);
    assert.equal(k.titulo, 'AHT Promedio');
    assert.equal(k.formato, 'tiempo_mmss');
    assert.equal(k.cls, 'kpi-org');
    assert.equal(k.mejorDireccion, 'baja');
  });
});

test('migracion dashboards_config_aht_real_trafico_v1: nunca toca otros KPIs del mismo cliente', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('TELEVENTAS SURA');
  const titulos = JSON.parse(row.layout).kpis.map((k) => k.titulo);
  assert.deepEqual(titulos, ['Base asignada', 'AHT Promedio', 'Ventas']);
});

test('migracion dashboards_config_aht_real_trafico_v1: MOVILIZE ya tenia la fuente nueva -- queda intacta, sin error ni duplicado', () => {
  const k = kpiAhtDe('MOVILIZE');
  assert.deepEqual(k.fuente, { s: 'trafico', modo: 'trafico_aht', campana: 'MOVILIZE' });
});

test('migracion dashboards_config_aht_real_trafico_v1: PANTERA MAIKERS (sin Trafico activo) NUNCA se toca, sigue con la fuente manual', () => {
  const k = kpiAhtDe('PANTERA MAIKERS');
  assert.deepEqual(k.fuente, AHT_MANUAL_VIEJO);
});

test('migracion dashboards_config_aht_real_trafico_v1: cliente fuera de la lista de 6 nunca se toca, aunque tenga el mismo titulo de KPI', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('OTRO CLIENTE FUERA DE LA LISTA');
  const k = JSON.parse(row.layout).kpis.find((x) => x.titulo === 'AHT Promedio');
  assert.deepEqual(k.fuente, AHT_MANUAL_VIEJO);
});

test('migracion dashboards_config_aht_real_trafico_v1: nunca toca tabs/panels, solo el array kpis', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('BIVETT');
  const layout = JSON.parse(row.layout);
  assert.equal(layout.tabs[1].key, 'trafico');
  assert.equal(layout.tabs[1].panels[0].tipo, 'trafico_combo');
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
