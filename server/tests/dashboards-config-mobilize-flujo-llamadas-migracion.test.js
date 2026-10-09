// dashboards-config-mobilize-flujo-llamadas-migracion.test.js — prueba la
// migracion `dashboards_config_mobilize_flujo_llamadas_v1` (server/db.js),
// Fase 131 (Parte 2, pedido de Edwin): MOBILIZE reemplaza la plantilla
// generica de "ventas" (base_asignada/contactados/conversion/asesores) por
// su dashboard real (Flujo de Llamadas con trafico_combo + Calidad). Mismo
// patron de prueba que las migraciones de reemplazo de ORLANT: sembrar el
// layout VIEJO reconocible a mano *antes* de requerir db.js, verificar
// "despues".
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const tmpDb = path.join(os.tmpdir(), `inconexion-mobilize-flujo-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Forma VIEJA reconocible: plantillaVentas tal cual (tab "asesores" +
// seccion "asesores", combinacion que ninguna otra forma tiene).
const SECCIONES_VIEJAS = {
  resumen: { titulo: 'Resumen mensual', cadencia: 'mensual', periodo: 'mes', filaUnica: true, columnas: [] },
  asesores: { titulo: 'Resultados por asesor', cadencia: 'mensual', periodo: 'mes', filaUnica: false, columnas: [] },
};
const LAYOUT_VIEJO = {
  kpis: [{ titulo: 'Ventas', fuente: {}, formato: 'miles' }],
  tabs: [
    { key: 'flujo', label: 'Flujo de gestion', panels: [{ tipo: 'line', titulo: 'Gestionados por dia' }] },
    { key: 'asesores', label: 'Ranking asesores', panels: [{ tipo: 'bar', titulo: 'Ventas por asesor' }] },
  ],
};
// Forma ya NUEVA (si otra corrida ya migro, o el seed la crea asi de
// entrada) -- reconocible por un panel trafico_combo en el tab "flujo".
const LAYOUT_NUEVO = {
  kpis: [],
  tabs: [{ key: 'flujo', label: 'Flujo de Llamadas', panels: [{ tipo: 'trafico_combo', campana: 'MOBILIZE' }] }],
};
// Forma personalizada por un admin a algo que NO es ninguna de las 2
// formas reconocibles -- nunca se debe tocar.
const LAYOUT_PERSONALIZADO = {
  kpis: [],
  tabs: [{ key: 'otro', label: 'Otro completamente distinto', panels: [] }],
};

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
const now = '07/10/2026 10:00:00';
const insertar = pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
);
insertar.run('MOBILIZE', 'Dashboard Mobilize', null, JSON.stringify(SECCIONES_VIEJAS), JSON.stringify(LAYOUT_VIEJO), now, now);
// Otro cliente cualquiera con la misma forma vieja (un tab "asesores") --
// la migracion de MOBILIZE nunca debe tocarlo, solo lee/escribe el cliente
// 'MOBILIZE' por nombre. Nombre inventado (Fase 134: ya no hay un segundo
// cliente real de plantilla de ventas) a proposito, para no depender de
// ningun cliente real de la lista.
insertar.run('OTRO CLIENTE CON ASESORES', 'Dashboard Otro', null, JSON.stringify(SECCIONES_VIEJAS), JSON.stringify(LAYOUT_VIEJO), now, now);
pre.close();

function setEnvDefault(key, value) {
  if (process.env[key] === undefined || process.env[key] === '') process.env[key] = value;
}
setEnvDefault('NODE_ENV', 'test');
setEnvDefault('JWT_SECRET', crypto.randomBytes(48).toString('hex'));
setEnvDefault('JWT_EXPIRES_IN', '1h');
setEnvDefault('MASTER_ADMIN_USER', 'admin');
const bcrypt = require('bcryptjs');
setEnvDefault('MASTER_ADMIN_PASSWORD_HASH', bcrypt.hashSync('NoUsadaEnEsteTest#1', 10));
setEnvDefault('DB_PATH', tmpDb);
setEnvDefault('TRUST_PROXY', 'false');
setEnvDefault('RATE_LIMIT_MAX', '10000');
setEnvDefault('LOGIN_RATE_LIMIT_MAX', '10000');

const db = require('../db');
const { CONFIGS } = require('../dashboard-config-seed');
const targetMobilize = CONFIGS.find((c) => c.cliente === 'MOBILIZE');

test('migracion dashboards_config_mobilize_flujo_llamadas_v1: reemplaza la forma vieja de MOBILIZE por el layout/secciones nuevo de CONFIGS', () => {
  const row = db.prepare('SELECT secciones, layout FROM dashboards_config WHERE cliente = ?').get('MOBILIZE');
  assert.deepEqual(JSON.parse(row.layout), targetMobilize.layout);
  assert.deepEqual(JSON.parse(row.secciones), targetMobilize.secciones);
});

test('migracion dashboards_config_mobilize_flujo_llamadas_v1: el tab "flujo" nuevo trae un panel trafico_combo de la campana MOBILIZE', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('MOBILIZE');
  const layout = JSON.parse(row.layout);
  const tabFlujo = layout.tabs.find((t) => t.key === 'flujo');
  assert.ok(tabFlujo);
  assert.equal(tabFlujo.panels[0].tipo, 'trafico_combo');
  assert.equal(tabFlujo.panels[0].campana, 'MOBILIZE');
});

test('migracion dashboards_config_mobilize_flujo_llamadas_v1: nunca toca otro cliente con la misma forma vieja (OTRO CLIENTE CON ASESORES intacto)', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('OTRO CLIENTE CON ASESORES');
  assert.deepEqual(JSON.parse(row.layout), LAYOUT_VIEJO);
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
