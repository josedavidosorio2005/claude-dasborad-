// orlant-graficas-migracion.test.js — prueba la migracion
// `dashboards_config_orlant_pdf_graficas_v1` (server/db.js) contra un archivo
// SQLite que simula el estado de PRODUCCION antes de este cambio: ORLANT ya
// existe en `dashboards_config` (dashboards_config solo se siembra si el
// cliente TODAVIA no existe), asi que la unica forma de que el layout nuevo
// llegue a produccion es esta migracion. Mismo patron que
// hlm-sede-migracion.test.js: sembrar el esquema/datos VIEJOS a mano *antes*
// de requerir db.js (que corre la migracion al arrancar), y verificar
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

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-graficas-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Layout VIEJO reconocible: "salida" se deja con una forma PERSONALIZADA (5
// paneles, ninguno con filtroSerie) que no coincide ni con la vieja (4
// paneles) ni con la nueva — para probar que la migracion la deja intacta.
// El resto (tipificacion/agendamiento/sta) SI tiene la forma vieja
// reconocible, para confirmar que esos tabs migran igual aunque "salida" se
// salte.
const LAYOUT_VIEJO = {
  kpis: [],
  tabs: [
    { key: 'flujo', label: 'Flujo Mensual', panels: [{ tipo: 'line', titulo: 'x', series: [] }] },
    { key: 'salida', label: 'Salida', panels: [
      { tipo: 'line', titulo: 'Personalizado 1', series: [] },
      { tipo: 'line', titulo: 'Personalizado 2', series: [] },
      { tipo: 'line', titulo: 'Personalizado 3', series: [] },
      { tipo: 'line', titulo: 'Personalizado 4', series: [] },
      { tipo: 'line', titulo: 'Personalizado 5 — agregado a mano', series: [] },
    ]},
    { key: 'tipificacion', label: 'Tipificacion', panels: [
      { tipo: 'pie', titulo: 'Tipificacion Linea 3P', fuente: {} },
      { tipo: 'pie', titulo: 'Tipificacion Linea General', fuente: {} },
    ]},
    { key: 'agendamiento', label: 'Agendamiento', panels: [
      { tipo: 'combo', titulo: 'Ordenamiento medico', barras: [] },
      { tipo: 'combo', titulo: 'Recuperacion de cancelados', barras: [] },
      { tipo: 'line', titulo: 'Total agendas por mes', series: [] },
      { tipo: 'bar', titulo: 'Agendas por linea', series: [] },
    ]},
    { key: 'inasistencia', label: 'Inasistencia', panels: [{ tipo: 'line', titulo: 'x', series: [] }] },
    { key: 'sta', label: 'Gestion STA', panels: [
      { tipo: 'bar', titulo: 'Ordenes por servicio', series: [] },
      { tipo: 'pie', titulo: 'Ordenes por estado', fuente: {} },
      { tipo: 'combo', titulo: 'STA por mes', barras: [{ label: 'Ordenes Cargadas' }, { label: 'Facturado + Cumplida' }] },
      { tipo: 'combo', titulo: 'STA del mes por tipo', barras: [] },
    ]},
  ],
};

// Escenario 2: la migracion es EXCLUSIVA de ORLANT (query hardcodeada por
// cliente) — otro cliente cualquiera con su propio layout nunca deberia
// tocarse, ni siquiera leerse.
const OTRO_CLIENTE = 'ALBERTO LINERO GO';
const LAYOUT_OTRO_CLIENTE = {
  kpis: [],
  tabs: [{ key: 'salida', label: 'Salida', panels: [{ tipo: 'line', titulo: 'Lo que sea', series: [] }] }],
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
const now = '18/09/2026 10:00:00';
pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
).run('ORLANT', 'Dashboard Clinica Orlant', null, '{}', JSON.stringify(LAYOUT_VIEJO), now, now);
pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
).run(OTRO_CLIENTE, 'Dashboard Alberto Linero Go', null, '{}', JSON.stringify(LAYOUT_OTRO_CLIENTE), now, now);
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

test('migracion dashboards_config_orlant_pdf_graficas_v1: reescribe los 4 tabs viejos de ORLANT a la forma nueva', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const tab = (key) => layout.tabs.find((t) => t.key === key);

  // "salida" tenia una forma personalizada (5 paneles) que no coincide ni
  // con la vieja reconocible (4) ni con la nueva (filtroSerie) — la
  // migracion debe dejarla exactamente igual, nunca pisar algo que no
  // reconoce.
  const salida = tab('salida');
  assert.equal(salida.panels.length, 5);
  assert.ok(salida.panels.every((p) => !p.filtroSerie));
  assert.equal(salida.panels[4].titulo, 'Personalizado 5 — agregado a mano');

  // Fase 77: el pie viejo de Tipificacion (aqui recien migrado a 1 solo pie
  // con filtroCampo:'linea') encadena de inmediato con la migracion
  // dashboards_config_orlant_tipificacion_panel_v1 (db.js, corre despues en
  // este mismo require de db.js) hacia el panel autonomo nuevo -- por eso
  // la forma FINAL ya no es un pie con filtroCampo, sino tipificacion_panel.
  const tipif = tab('tipificacion');
  assert.equal(tipif.panels.length, 1, 'Tipificacion pasa de 2 pies a 1');
  assert.equal(tipif.panels[0].tipo, 'tipificacion_panel');

  const agenda = tab('agendamiento');
  assert.ok(agenda.panels.some((p) => p.tipo === 'nota_kpi'), 'se agrego el KPI anual con texto');
  assert.ok(agenda.panels.some((p) => p.titulo === 'Total agendas — variacion % mes a mes'));

  const sta = tab('sta');
  assert.equal(sta.panels[1].tipo, 'bar', '"Ordenes por estado" paso de pie a bar');
  assert.equal(sta.panels[1].pctDeTotal, true);
  const staPorMes = sta.panels.find((p) => p.titulo === 'STA por mes');
  assert.equal(staPorMes.barras.length, 3, 'STA por mes gana la barra "Agendada"');
  assert.ok(staPorMes.barras.some((b) => b.label === 'Agendada'));

  // Tabs sin equivalente en el PDF quedan intactos, ni un panel de mas o de menos.
  assert.equal(tab('flujo').panels.length, 1);
  assert.equal(tab('inasistencia').panels.length, 1);
});

test('migracion dashboards_config_orlant_pdf_graficas_v1: nunca toca otro cliente', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(OTRO_CLIENTE);
  const layout = JSON.parse(row.layout);
  assert.deepEqual(layout, LAYOUT_OTRO_CLIENTE, 'el layout de otro cliente queda byte a byte igual');
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
