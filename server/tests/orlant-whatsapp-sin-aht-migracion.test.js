// orlant-whatsapp-sin-aht-migracion.test.js — prueba la migracion
// `dashboards_config_orlant_whatsapp_sin_aht_v1` (server/db.js), Fase 120:
// Wolkvox nunca entrega AHT de WhatsApp (confirmado contra los 2 archivos
// reales de ago-sep/2026, 258 filas, AHT siempre "----") -- el panel
// trafico_whatsapp_combo de ORLANT debe quedar con mostrarAht:false para
// que el frontend quite la sub-pestana AHT, la tarjeta "AHT Promedio" y la
// columna de export, sin tocar Trafico de Llamadas (voz, que SI tiene AHT
// real). Mismo patron que orlant-kpis-vacios-migracion.test.js: sembrar el
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

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-wpp-sin-aht-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Forma "vieja" reconocible: el panel de WhatsApp SIN el campo mostrarAht
// (como quedo sembrado antes de la Fase 120).
function layoutViejo() {
  return {
    kpis: [],
    tabs: [
      { key: 'trafico', label: 'Trafico de Llamadas', panels: [{ tipo: 'trafico_combo', campana: 'ORLANT' }] },
      { key: 'trafico_whatsapp', label: 'Trafico de WhatsApp', panels: [{ tipo: 'trafico_whatsapp_combo', campana: 'ORLANT' }] },
    ],
  };
}

// Otro cliente: la migracion nunca debe tocarlo, ni aunque tenga un panel
// del mismo tipo (MOVILIZE a proposito, igual que en el test de kpis).
function layoutOtroCliente() {
  return {
    kpis: [],
    tabs: [
      { key: 'trafico_whatsapp', label: 'Trafico de WhatsApp', panels: [{ tipo: 'trafico_whatsapp_combo', campana: 'MOVILIZE' }] },
    ],
  };
}

// ORLANT ya personalizado a mano (alguien reactivo el AHT despues del
// deploy): la migracion NUNCA debe pisar un valor ya presente, sea el que
// sea -- por eso aqui queda en true a proposito.
function layoutYaPersonalizado() {
  return {
    kpis: [],
    tabs: [
      { key: 'trafico', label: 'Trafico de Llamadas', panels: [{ tipo: 'trafico_combo', campana: 'ORLANT' }] },
      {
        key: 'trafico_whatsapp',
        label: 'Trafico de WhatsApp',
        panels: [{ tipo: 'trafico_whatsapp_combo', campana: 'ORLANT', mostrarAht: true }],
      },
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
const now = '05/10/2026 09:00:00';
const insertar = pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
);
insertar.run('ORLANT', 'Dashboard Clinica Orlant', null, '{}', JSON.stringify(layoutViejo()), now, now);
insertar.run('MOVILIZE', 'Dashboard Movilize', null, '{}', JSON.stringify(layoutOtroCliente()), now, now);
insertar.run('AURORA', 'Dashboard Aurora', null, '{}', JSON.stringify(layoutYaPersonalizado()), now, now);
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

let db = require('../db');

function panelWppDe(cliente) {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(cliente);
  const layout = JSON.parse(row.layout);
  const tab = layout.tabs.find((t) => t.key === 'trafico_whatsapp');
  return tab.panels.find((p) => p.tipo === 'trafico_whatsapp_combo');
}

test('migracion dashboards_config_orlant_whatsapp_sin_aht_v1: ORLANT (sin el campo) queda con mostrarAht:false', () => {
  assert.equal(panelWppDe('ORLANT').mostrarAht, false);
});

test('migracion dashboards_config_orlant_whatsapp_sin_aht_v1: nunca toca otro cliente (MOVILIZE queda sin el campo)', () => {
  assert.equal(Object.prototype.hasOwnProperty.call(panelWppDe('MOVILIZE'), 'mostrarAht'), false);
});

test('migracion dashboards_config_orlant_whatsapp_sin_aht_v1: nunca pisa un valor ya personalizado (AURORA sigue en true)', () => {
  assert.equal(panelWppDe('AURORA').mostrarAht, true);
});

test('migracion dashboards_config_orlant_whatsapp_sin_aht_v1: Trafico de Llamadas (voz) no se toca', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const tabVoz = layout.tabs.find((t) => t.key === 'trafico');
  assert.equal(Object.prototype.hasOwnProperty.call(tabVoz.panels[0], 'mostrarAht'), false);
});

test('migracion dashboards_config_orlant_whatsapp_sin_aht_v1: correrla otra vez (reabrir la misma base) no cambia nada', () => {
  db.closeDb();
  delete require.cache[require.resolve('../db')];
  db = require('../db');
  assert.equal(panelWppDe('ORLANT').mostrarAht, false);
  assert.equal(panelWppDe('AURORA').mostrarAht, true);
});
