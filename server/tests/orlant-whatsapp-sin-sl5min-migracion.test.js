// orlant-whatsapp-sin-sl5min-migracion.test.js — prueba la migracion
// `dashboards_config_orlant_whatsapp_sin_sl5min_v1` (server/db.js), Fase
// 126 (pedido de Edwin): Wolkvox sigue sin mandar SERVICE_LEVEL_5MIN -- el
// panel trafico_whatsapp_combo de ORLANT debe quedar con
// mostrarSL5min:false para que el frontend quite la tarjeta/serie/aviso de
// 5 min y pase el SL a 20s al lugar principal, sin tocar Trafico de
// Llamadas (voz, que no usa este campo). Mismo patron EXACTO que
// orlant-whatsapp-sin-aht-migracion.test.js: sembrar el layout VIEJO a
// mano *antes* de requerir db.js, y verificar "despues".
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-wpp-sin-sl5min-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Forma "vieja" reconocible: el panel de WhatsApp SIN el campo mostrarSL5min
// (como quedo sembrado antes de la Fase 126) -- CON mostrarAht ya en false
// (Fase 120), para probar que esta migracion no lo toca.
function layoutViejo() {
  return {
    kpis: [],
    tabs: [
      { key: 'trafico', label: 'Trafico de Llamadas', panels: [{ tipo: 'trafico_combo', campana: 'ORLANT' }] },
      { key: 'trafico_whatsapp', label: 'Trafico de WhatsApp', panels: [{ tipo: 'trafico_whatsapp_combo', campana: 'ORLANT', mostrarAht: false }] },
    ],
  };
}

// Otro cliente: la migracion nunca debe tocarlo, ni aunque tenga un panel
// del mismo tipo.
function layoutOtroCliente() {
  return {
    kpis: [],
    tabs: [
      { key: 'trafico_whatsapp', label: 'Trafico de WhatsApp', panels: [{ tipo: 'trafico_whatsapp_combo', campana: 'MOVILIZE' }] },
    ],
  };
}

// ORLANT ya personalizado a mano (alguien reactivo el SL 5min despues del
// deploy, ej. ya llego la columna de Wolkvox): la migracion NUNCA debe
// pisar un valor ya presente, sea el que sea -- por eso aqui queda en true
// a proposito.
function layoutYaPersonalizado() {
  return {
    kpis: [],
    tabs: [
      { key: 'trafico', label: 'Trafico de Llamadas', panels: [{ tipo: 'trafico_combo', campana: 'ORLANT' }] },
      {
        key: 'trafico_whatsapp',
        label: 'Trafico de WhatsApp',
        panels: [{ tipo: 'trafico_whatsapp_combo', campana: 'ORLANT', mostrarAht: false, mostrarSL5min: true }],
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
const now = '06/10/2026 09:00:00';
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

test('migracion dashboards_config_orlant_whatsapp_sin_sl5min_v1: ORLANT (sin el campo) queda con mostrarSL5min:false', () => {
  assert.equal(panelWppDe('ORLANT').mostrarSL5min, false);
});

test('migracion dashboards_config_orlant_whatsapp_sin_sl5min_v1: nunca toca mostrarAht (sigue en false, de la Fase 120)', () => {
  assert.equal(panelWppDe('ORLANT').mostrarAht, false);
});

test('migracion dashboards_config_orlant_whatsapp_sin_sl5min_v1: nunca toca otro cliente (MOVILIZE queda sin el campo)', () => {
  assert.equal(Object.prototype.hasOwnProperty.call(panelWppDe('MOVILIZE'), 'mostrarSL5min'), false);
});

test('migracion dashboards_config_orlant_whatsapp_sin_sl5min_v1: nunca pisa un valor ya personalizado (AURORA sigue en true)', () => {
  assert.equal(panelWppDe('AURORA').mostrarSL5min, true);
});

test('migracion dashboards_config_orlant_whatsapp_sin_sl5min_v1: Trafico de Llamadas (voz) no se toca', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const tabVoz = layout.tabs.find((t) => t.key === 'trafico');
  assert.equal(Object.prototype.hasOwnProperty.call(tabVoz.panels[0], 'mostrarSL5min'), false);
});

test('migracion dashboards_config_orlant_whatsapp_sin_sl5min_v1: correrla otra vez (reabrir la misma base) no cambia nada', () => {
  db.closeDb();
  delete require.cache[require.resolve('../db')];
  db = require('../db');
  assert.equal(panelWppDe('ORLANT').mostrarSL5min, false);
  assert.equal(panelWppDe('AURORA').mostrarSL5min, true);
});
