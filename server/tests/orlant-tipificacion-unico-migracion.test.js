// orlant-tipificacion-unico-migracion.test.js — prueba la migracion
// `dashboards_config_orlant_tipificacion_unico_v1` (server/db.js), que
// corrige el bug real de categorias duplicadas en el pie de Tipificacion de
// ORLANT (verificacion con InCo, 2026-09-18): la migracion anterior
// (dashboards_config_orlant_pdf_graficas_v1) dejo el panel con
// filtroCampo:'linea' pero SIN filtroUnico (multi-select, 3P+General
// combinados por defecto). Mismo patron que hlm-sede-migracion.test.js /
// orlant-graficas-migracion.test.js: sembrar el layout VIEJO a mano *antes*
// de requerir db.js, y verificar "despues".
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-tipif-unico-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Forma "vieja" reconocible: filtroCampo:'linea' SIN filtroUnico (el estado
// exacto en el que quedo ORLANT tras el PR #64-66, antes de este fix).
const LAYOUT_VIEJO = {
  kpis: [],
  tabs: [
    { key: 'salida', label: 'Salida', panels: [{ tipo: 'line', titulo: 'x', series: [], filtroSerie: true }] },
    { key: 'tipificacion', label: 'Tipificacion', panels: [
      { tipo: 'pie', titulo: 'Tipificacion de llamadas y WhatsApp', filtroCampo: 'linea',
        fuente: { s: 'tipificacion', modo: 'filas', x: 'tipificacion', campo: 'cantidad' },
        notas: ['nota vieja'] },
    ]},
  ],
};

// Escenario 2: un tab "tipificacion" que ya fue personalizado a algo que no
// es ni la forma vieja (1 panel, filtroCampo sin filtroUnico) ni la nueva
// (filtroUnico:true) -- ej. un admin le agrego un segundo panel a mano. La
// migracion debe dejarlo intacto.
const LAYOUT_PERSONALIZADO = {
  kpis: [],
  tabs: [
    { key: 'tipificacion', label: 'Tipificacion', panels: [
      { tipo: 'pie', titulo: 'Personalizado 1', filtroCampo: 'linea', fuente: {} },
      { tipo: 'pie', titulo: 'Personalizado 2 — agregado a mano', fuente: {} },
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
const now = '18/09/2026 15:00:00';
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

test('migracion dashboards_config_orlant_tipificacion_unico_v1: agrega filtroUnico al pie de Tipificacion de ORLANT', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const tab = layout.tabs.find((t) => t.key === 'tipificacion');
  assert.equal(tab.panels.length, 1);
  assert.equal(tab.panels[0].filtroUnico, true);
  assert.equal(tab.panels[0].filtroCampo, 'linea');
  // Migro a la forma actual del seed (dashboard-config-seed.js), no algo
  // reescrito a mano -- por eso trae el glosario real, no "nota vieja".
  assert.ok(Array.isArray(tab.panels[0].notas) && tab.panels[0].notas.some((n) => n.includes('INFORMACION_3P')));

  // El tab "salida" (ya migrado en la fase anterior, sin relacion con este
  // fix) no se toca.
  const salida = layout.tabs.find((t) => t.key === 'salida');
  assert.equal(salida.panels[0].filtroSerie, true);
});

test('migracion dashboards_config_orlant_tipificacion_unico_v1: nunca toca otro cliente (la query es exclusiva de ORLANT)', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(OTRO_CLIENTE);
  const layout = JSON.parse(row.layout);
  assert.deepEqual(layout, LAYOUT_PERSONALIZADO);
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
