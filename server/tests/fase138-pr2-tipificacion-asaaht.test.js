// fase138-pr2-tipificacion-asaaht.test.js — Fase 138 (PR2, pedido de Edwin
// 09/10/2026): (1) el panel de Tipificacion de ORLANT pasa a tener las
// mismas opciones que ya tenia Mobilize (1 torta Llamadas + filtro + tabla
// de detalle + tarjetas de salida); (2) en Flujo de Llamadas de Mobilize,
// las sub-pestañas separadas "ASA"/"AHT" (Fase 131) se combinan en 1 sola
// ("asaaht"), confirmado contra la plantilla REAL de Flujo que SI trae AHT.
// Dos partes: migraciones de `dashboards_config` (server/db.js, con su
// propio DB temporal, mismo patron que orlant-orden-pestanas-migracion.test.js)
// y la logica compartida de trafico.js (regex sobre el archivo, igual que
// fase132-08-logo-mobilize.test.js — trafico.js es global-en-navegador).
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

// ── Parte 1: config-seed.js (sin requerir db.js) ──────────────────────────

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const SERVER_DIR = path.join(__dirname, '..');
const { CONFIGS } = require('../dashboard-config-seed');

function tabPanel(cliente, tabKey) {
  const c = CONFIGS.find((x) => x.cliente === cliente);
  const t = c && (c.layout.tabs || []).find((x) => x.key === tabKey);
  return t && t.panels && t.panels[0];
}

test('dashboard-config-seed.js: el panel de Tipificacion de ORLANT tiene las MISMAS opciones que el de MOBILIZE (salvo campana)', () => {
  const orlant = tabPanel('ORLANT', 'tipificacion');
  const mobilize = tabPanel('MOBILIZE', 'tipificacion');
  assert.ok(orlant && mobilize);
  const { campana: campanaO, ...restoO } = orlant;
  const { campana: campanaM, ...restoM } = mobilize;
  assert.deepEqual(restoO, restoM);
  assert.equal(campanaO, 'ORLANT');
  assert.equal(campanaM, 'MOBILIZE');
  assert.equal(orlant.soloCanal, 'LLAMADAS');
  assert.equal(orlant.mostrarFiltroTipo, true);
  assert.equal(orlant.mostrarTablaDetalle, true);
  assert.equal(orlant.mostrarTarjetasSalida, true);
});

test('dashboard-config-seed.js: el tab de Tipificacion de ORLANT sigue oculto (sin cambiar el acceso) y el titulo del panel sigue en español', () => {
  const c = CONFIGS.find((x) => x.cliente === 'ORLANT');
  const t = (c.layout.tabs || []).find((x) => x.key === 'tipificacion');
  assert.equal(t.oculta, true);
  assert.equal(t.panels[0].titulo, 'Tipificación');
});

test('dashboard-config-seed.js: Flujo de Llamadas de MOBILIZE tiene "asaaht" en vez de "asa"+"aht" por separado', () => {
  const panel = tabPanel('MOBILIZE', 'flujo');
  const keys = panel.subtabs.map((s) => s.key);
  assert.ok(keys.indexOf('asaaht') !== -1, 'falta la sub-pestaña combinada "asaaht"');
  assert.equal(keys.indexOf('asa'), -1, '"asa" por separado ya no deberia estar');
  assert.equal(keys.indexOf('aht'), -1, '"aht" por separado ya no deberia estar');
  assert.deepEqual(keys, ['resumen', 'sl', 'abandono', 'asaaht']);
});

// ── Parte 2: trafico.js (global-en-navegador, igual patron que fase132-08) ─

const traficoJs = fs.readFileSync(path.join(PUBLIC_DIR, 'js', 'trafico.js'), 'utf8');

test('trafico.js: "asaaht" tiene titulo, sufijo de canvas y funcion de dibujo propios', () => {
  assert.match(traficoJs, /asaaht:\s*'ASA y AHT/, 'falta el titulo de "asaaht" en TRAFICO_SUBTAB_TITULOS');
  assert.match(traficoJs, /asaaht:\s*'-canvas-asaaht-'/, 'falta el sufijo de canvas de "asaaht"');
  assert.match(traficoJs, /function _traficoDibujarAsaAht\(/, 'falta la funcion _traficoDibujarAsaAht');
  assert.match(traficoJs, /_traficoDibujarAsaAht\('tv', i, agregadoComb\)/, '_traficoRenderContenido no llama a _traficoDibujarAsaAht');
});

test('trafico.js: _traficoDibujarAsaAht grafica ASA (asaSegundos) y AHT (ahtSegundos) juntos, en el mismo canvas', () => {
  const m = traficoJs.match(/function _traficoDibujarAsaAht[\s\S]*?\n\}/);
  assert.ok(m);
  const cuerpo = m[0];
  assert.match(cuerpo, /label:'ASA'.*asaSegundos/);
  assert.match(cuerpo, /label:'AHT'.*ahtSegundos/);
  assert.match(cuerpo, /canvasId\s*=\s*prefijo\+'-canvas-asaaht-'\+i/);
});

test('trafico.js: la sub-pestaña "asaaht" tambien muestra la nota de "ponderado por volumen" (igual que sl/aht)', () => {
  assert.match(traficoJs, /activo === 'sl' \|\| activo === 'aht' \|\| activo === 'asaaht'/);
});

test('trafico.js: resumenPorSeccion muestra ASA Y AHT juntos cuando la sub-pestaña activa es "asaaht"', () => {
  assert.match(traficoJs, /activoSec === 'asaaht'[\s\S]{0,400}ASA promedio del periodo[\s\S]{0,200}AHT promedio del periodo/);
});

// ── Parte 3: migraciones de dashboards_config (DB temporal, requiere db.js) ─

const tmpDb = path.join(os.tmpdir(), `inconexion-fase138-pr2-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

function tab(key, panels, oculta) {
  const t = { key, label: 'Label ' + key, panels };
  if (oculta) t.oculta = true;
  return t;
}

// ORLANT: forma VIEJA reconocible (1 panel tipificacion_panel SIN soloCanal,
// Fase 77) + un cliente de control que nunca deberia tocarse.
const LAYOUT_ORLANT_VIEJO = {
  kpis: [],
  tabs: [
    tab('tipificacion', [{ tipo: 'tipificacion_panel', titulo: 'Tipificación', campana: 'ORLANT' }], true),
    tab('calidad', [{ tipo: 'calidad_kpis', campana: 'ORLANT' }], false),
  ],
};
// MOBILIZE: forma VIEJA reconocible (subtabs con "asa"+"aht" separados, Fase 131).
const LAYOUT_MOBILIZE_VIEJO = {
  kpis: [],
  tabs: [
    tab('flujo', [{
      tipo: 'trafico_combo', campana: 'MOBILIZE',
      resumenOcultar: ['tasaAbandono', 'nivelServicio'], resumenPorSeccion: true,
      subtabs: [{ key: 'resumen', label: 'Resumen' }, { key: 'sl', label: 'Nivel de Servicio' }, { key: 'abandono', label: 'Abandono' }, { key: 'asa', label: 'ASA' }, { key: 'aht', label: 'AHT' }],
      subtabsTitulos: { sl: 'Nivel de Servicio 80 - 20' },
    }], false),
  ],
};
const OTRO_CLIENTE = 'CLINICA_AURORA_CONTROL';
const LAYOUT_OTRO = { kpis: [], tabs: [tab('flujo', [{ tipo: 'line', titulo: 'x' }], false)] };

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
const now = '09/10/2026 10:00:00';
const insertRow = pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
);
insertRow.run('ORLANT', 'Dashboard Clinica Orlant', null, '{}', JSON.stringify(LAYOUT_ORLANT_VIEJO), now, now);
insertRow.run('MOBILIZE', 'Dashboard Mobilize', null, '{}', JSON.stringify(LAYOUT_MOBILIZE_VIEJO), now, now);
insertRow.run(OTRO_CLIENTE, 'Dashboard Control', null, '{}', JSON.stringify(LAYOUT_OTRO), now, now);
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

test('migracion dashboards_config_orlant_tipificacion_opciones_mobilize_v1: el panel de ORLANT queda con las mismas opciones que MOBILIZE', () => {
  const row = db.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'ORLANT'").get();
  const layout = JSON.parse(row.layout);
  const panel = layout.tabs.find((t) => t.key === 'tipificacion').panels[0];
  assert.equal(panel.soloCanal, 'LLAMADAS');
  assert.equal(panel.mostrarFiltroTipo, true);
  assert.equal(panel.mostrarTablaDetalle, true);
  assert.equal(panel.mostrarTarjetasSalida, true);
  assert.equal(panel.campana, 'ORLANT');
});

test('migracion dashboards_config_orlant_tipificacion_opciones_mobilize_v1: no toca el tab "calidad" de ORLANT', () => {
  const row = db.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'ORLANT'").get();
  const layout = JSON.parse(row.layout);
  const calidad = layout.tabs.find((t) => t.key === 'calidad');
  assert.deepEqual(calidad.panels, LAYOUT_ORLANT_VIEJO.tabs[1].panels);
});

test('migracion dashboards_config_mobilize_flujo_asaaht_v1: el panel de MOBILIZE queda con "asaaht" en vez de "asa"+"aht"', () => {
  const row = db.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'MOBILIZE'").get();
  const layout = JSON.parse(row.layout);
  const panel = layout.tabs.find((t) => t.key === 'flujo').panels[0];
  const keys = panel.subtabs.map((s) => s.key);
  assert.deepEqual(keys, ['resumen', 'sl', 'abandono', 'asaaht']);
  // resumenOcultar/resumenPorSeccion/subtabsTitulos (otras opciones del
  // mismo panel) no se pierden en el reemplazo.
  assert.deepEqual(panel.resumenOcultar, ['tasaAbandono', 'nivelServicio']);
  assert.equal(panel.resumenPorSeccion, true);
});

test('las 2 migraciones nunca tocan otro cliente', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(OTRO_CLIENTE);
  assert.deepEqual(JSON.parse(row.layout), LAYOUT_OTRO);
});

test('las 2 migraciones son idempotentes: la forma final ya coincide con CONFIGS, una segunda pasada a mano seria un no-op', () => {
  const { CONFIGS: configsFrescos } = require('../dashboard-config-seed');
  const rowOrlant = db.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'ORLANT'").get();
  const panelOrlant = JSON.parse(rowOrlant.layout).tabs.find((t) => t.key === 'tipificacion').panels[0];
  const targetOrlant = configsFrescos.find((c) => c.cliente === 'ORLANT').layout.tabs.find((t) => t.key === 'tipificacion').panels[0];
  assert.deepEqual(panelOrlant, targetOrlant);

  const rowMobilize = db.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'MOBILIZE'").get();
  const panelMobilize = JSON.parse(rowMobilize.layout).tabs.find((t) => t.key === 'flujo').panels[0];
  const targetMobilize = configsFrescos.find((c) => c.cliente === 'MOBILIZE').layout.tabs.find((t) => t.key === 'flujo').panels[0];
  assert.deepEqual(panelMobilize.subtabs, targetMobilize.subtabs);
});
