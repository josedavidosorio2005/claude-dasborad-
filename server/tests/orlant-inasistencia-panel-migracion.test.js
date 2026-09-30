// orlant-inasistencia-panel-migracion.test.js — prueba las migraciones
// `dashboards_config_orlant_inasistencia_panel_v1` y
// `dashboards_config_orlant_orden_pestanas_v2` (server/db.js, Fase 98,
// pedido URGENTE de Edwin): reemplaza las 4 graficas de linea viejas de
// "inasistencia" por el panel autonomo nuevo (inasistencia_panel, tabla
// `inasistencias`) y reubica la pestaña justo despues de "agendamiento".
// Mismo patron que orlant-tipificacion-panel-migracion.test.js: sembrar el
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

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-inasist-panel-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Forma "vieja" reconocible: las 4 lineP de siempre, en el orden de
// siempre (inasist_audifonos/audiologia/examenes/total), con el orden de
// pestañas viejo (sin Inasistencia despues de Agendamiento todavia).
const LAYOUT_VIEJO = {
  kpis: [],
  tabs: [
    { key: 'trafico', label: 'Trafico de Llamadas', panels: [{ tipo: 'trafico_combo', campana: 'ORLANT' }] },
    { key: 'trafico_whatsapp', label: 'Trafico de WhatsApp', panels: [{ tipo: 'trafico_whatsapp_combo', campana: 'ORLANT' }] },
    { key: 'agendamiento', label: 'Agendamiento', oculta: true, panels: [{ tipo: 'agendas_panel', vista: 'especialidad', campana: 'ORLANT' }] },
    { key: 'tipificacion', label: 'Tipificacion', oculta: true, panels: [{ tipo: 'tipificacion_panel', campana: 'ORLANT' }] },
    { key: 'calidad', label: 'Calidad', panels: [{ tipo: 'calidad_kpis', campana: 'ORLANT' }] },
    { key: 'inasistencia', label: 'Inasistencia', oculta: true, panels: [
      { tipo: 'line', titulo: '% Inasistencia Audífonos', series: [{ label: 'x', fuente: { s: 'resumen', modo: 'serie', campo: 'inasist_audifonos' } }], unidad: '%' },
      { tipo: 'line', titulo: '% Inasistencia Audiología', series: [{ label: 'x', fuente: { s: 'resumen', modo: 'serie', campo: 'inasist_audiologia' } }], unidad: '%' },
      { tipo: 'line', titulo: '% Inasistencia Exámenes', series: [{ label: 'x', fuente: { s: 'resumen', modo: 'serie', campo: 'inasist_examenes' } }], unidad: '%' },
      { tipo: 'line', titulo: '% Inasistencia Total', series: [{ label: 'x', fuente: { s: 'resumen', modo: 'serie', campo: 'inasist_total' } }], unidad: '%' },
    ], subtabs: [
      { key: 'audifonos', label: 'Audífonos', indices: [0] },
      { key: 'audiologia', label: 'Audiología', indices: [1] },
      { key: 'examenes', label: 'Exámenes', indices: [2] },
      { key: 'total', label: 'Total', indices: [3] },
    ]},
  ],
};

// Escenario 2: un tab "inasistencia" personalizado a algo que no es ni la
// forma vieja (4 lineP) ni la nueva (inasistencia_panel) -- la migracion
// debe dejarlo intacto.
const LAYOUT_PERSONALIZADO = {
  kpis: [],
  tabs: [
    { key: 'inasistencia', label: 'Inasistencia', panels: [
      { tipo: 'line', titulo: 'Personalizado 1', series: [] },
    ]},
  ],
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
const now = '30/09/2026 15:00:00';
pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
).run('ORLANT', 'Dashboard Clinica Orlant', null, '{}', JSON.stringify(LAYOUT_VIEJO), now, now);

const OTRO_CLIENTE = 'BIVETT';
pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
).run(OTRO_CLIENTE, 'Dashboard Bivett', null, '{}', JSON.stringify(LAYOUT_PERSONALIZADO), now, now);
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
const { CONFIGS } = require('../dashboard-config-seed');
const ORLANT_TARGET = CONFIGS.find((c) => c.cliente === 'ORLANT');
const TARGET_TAB = ORLANT_TARGET.layout.tabs.find((t) => t.key === 'inasistencia');

test('migracion dashboards_config_orlant_inasistencia_panel_v1: reemplaza las 4 graficas viejas por 3 inasistencia_panel + subtabs nuevos', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const tab = layout.tabs.find((t) => t.key === 'inasistencia');

  assert.equal(tab.panels.length, 3);
  assert.ok(tab.panels.every((p) => p.tipo === 'inasistencia_panel'));
  assert.deepEqual(tab.panels, TARGET_TAB.panels);
  assert.deepEqual(tab.subtabs, TARGET_TAB.subtabs);

  // `oculta` no lo toca esta migracion (dashboard-generic.js decide en
  // memoria segun si hay inasistencias cargadas, nunca la migracion).
  assert.equal(tab.oculta, true);

  // El tab "calidad" (sin relacion con este fix) no se toca.
  const calidad = layout.tabs.find((t) => t.key === 'calidad');
  assert.equal(calidad.panels[0].tipo, 'calidad_kpis');
});

test('migracion dashboards_config_orlant_orden_pestanas_v2: Inasistencia queda justo despues de Agendamiento', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const claves = layout.tabs.map((t) => t.key);
  const idxAgendamiento = claves.indexOf('agendamiento');
  const idxInasistencia = claves.indexOf('inasistencia');
  assert.equal(idxInasistencia, idxAgendamiento + 1);
  // El resto del orden (trafico/trafico_whatsapp antes, tipificacion/calidad
  // despues) no se altero -- solo se reubico inasistencia.
  assert.deepEqual(claves, ['trafico', 'trafico_whatsapp', 'agendamiento', 'inasistencia', 'tipificacion', 'calidad']);
});

test('migraciones de inasistencia: nunca tocan otro cliente', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(OTRO_CLIENTE);
  assert.deepEqual(JSON.parse(row.layout), LAYOUT_PERSONALIZADO);
});

test('migracion dashboards_config_orlant_inasistencia_panel_v1: es idempotente -- correrla de nuevo no vuelve a tocar nada', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const tab = JSON.parse(row.layout).tabs.find((t) => t.key === 'inasistencia');
  assert.equal(tab.panels.filter((p) => p.tipo === 'inasistencia_panel').length, 3);
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
