// fase145-mobilize-ajustes.test.js — Fase 145 (pedidos de Edwin del
// 14/10/2026, entrega de Mobilize):
//   M1. Flujo de Llamadas de Mobilize: "ASA y AHT" ("asaaht") se reemplaza
//       por "ASA y ATA" ("asaata", la vista de ORLANT) + "AHT" ("aht"), y la
//       pestaña "Llamadas Únicas" pasa a "Llamadas Únicas y de Salida" --
//       seed + migracion idempotente dashboards_config_mobilize_flujo_
//       asaata_aht_v1 (server/db.js). Base nueva y base migrada terminan
//       con el MISMO layout.
//   M2. El aviso amarillo "todavia no tiene datos cargados" solo sale si el
//       dashboard tiene algo que dependa de las cargas genericas
//       (gdMostrarAvisoSinCargas, mes-global-logic.js); y el % de cada
//       porcion de una torta se elige por contraste con esa porcion
//       (contrasteTextoSobreRelleno, contraste-logic.js).
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { CONFIGS } = require('../dashboard-config-seed');
const { gdMostrarAvisoSinCargas, gdDependeDeCargasGenericas } = require('../../public/js/mes-global-logic.js');
const { contrasteTextoSobreRelleno, contrasteRazon } = require('../../public/js/contraste-logic.js');

const PUBLIC_JS = path.join(__dirname, '..', '..', 'public', 'js');
const SEED_MOBILIZE = CONFIGS.find((c) => c.cliente === 'MOBILIZE');
const SEED_ORLANT = CONFIGS.find((c) => c.cliente === 'ORLANT');

// ── M1: seed ──────────────────────────────────────────────────────────────

function panelFlujo(layout) {
  const tab = layout.tabs.find((t) => t.key === 'flujo');
  return tab.panels.find((p) => p.tipo === 'trafico_combo');
}

test('seed: Flujo de Llamadas de MOBILIZE = Flujo de Llamadas, Nivel de Servicio, Abandono, ASA y ATA, AHT', () => {
  const panel = panelFlujo(SEED_MOBILIZE.layout);
  assert.deepEqual(panel.subtabs.map((s) => s.key), ['resumen', 'sl', 'abandono', 'asaata', 'aht', 'oneanddone', 'eficacia']); // Fase 147 D: + One & Done al final; Fase 199: + Eficacia
  assert.deepEqual(panel.subtabs.map((s) => s.label), ['Resumen', 'Nivel de Servicio', 'Abandono', 'ASA y ATA', 'AHT', 'One & Done', 'Eficacia']);
});

test('seed: la pestaña llamadas_unicas se llama "Llamadas Únicas y de Salida" (la key no cambia)', () => {
  const tab = SEED_MOBILIZE.layout.tabs.find((t) => t.key === 'llamadas_unicas');
  assert.ok(tab, 'la key llamadas_unicas sigue igual');
  assert.equal(tab.label, 'Llamadas Únicas y de Salida');
});

test('trafico.js: "ASA y ATA" de Mobilize muestra su resumen (ASA y ATA ponderado por abandonadas) y "AHT" el suyo', () => {
  const src = fs.readFileSync(path.join(PUBLIC_JS, 'trafico.js'), 'utf8');
  assert.match(src, /activoSec === 'asaata'[\s\S]{0,400}ASA promedio del periodo[\s\S]{0,200}ATA promedio del periodo/);
  assert.match(src, /activoSec === 'aht'[\s\S]{0,300}AHT promedio del periodo/);
  // Fase 146: la tarjeta usa la funcion compartida traficoAtaPromedioPeriodo
  // (ponderada por abandonadas, igual que traficoAgregar) -- la ponderacion
  // se prueba en fase146-ata-cero-sin-abandonos.test.js.
  assert.match(src, /var ataProm = traficoAtaPromedioPeriodo\(filtradas\);/,
    'ATA pondera por llamadas abandonadas, igual que traficoAgregar');
  // las 2 vistas ya existian (ORLANT): titulo y canvas propios
  assert.match(src, /asaata: '-canvas-asaata-'/);
  assert.match(src, /aht: '-canvas-aht-'/);
});

// ── M1: migracion sobre una base con la forma de PRODUCCION ───────────────

// Produccion (v1.34.x) = el seed de antes de esta fase: "asaaht" y
// "Llamadas Únicas".
function layoutProduccion() {
  const l = JSON.parse(JSON.stringify(SEED_MOBILIZE.layout));
  panelFlujo(l).subtabs = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'sl', label: 'Nivel de Servicio' },
    { key: 'abandono', label: 'Abandono' },
    { key: 'asaaht', label: 'ASA y AHT' },
  ];
  l.tabs.find((t) => t.key === 'llamadas_unicas').label = 'Llamadas Únicas';
  return l;
}
const LAYOUT_PROD = layoutProduccion();
// Un cliente de prueba con una forma que la migracion no reconoce: nunca
// se toca (la migracion solo mira MOBILIZE, pero se deja como control).
const OTRO = { tabs: [{ key: 'flujo', label: 'X', panels: [{ tipo: 'trafico_combo', subtabs: [{ key: 'asaaht', label: 'ASA y AHT' }] }] }] };

const tmpDb = path.join(os.tmpdir(), `inconexion-fase145-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);
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
const ins = pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,NULL,?,?,1,'14/10/2026','14/10/2026')`
);
ins.run('MOBILIZE', 'Dashboard Mobilize', JSON.stringify(SEED_MOBILIZE.secciones), JSON.stringify(LAYOUT_PROD));
ins.run('CLIENTE_FASE145', 'Otro', JSON.stringify({}), JSON.stringify(OTRO));
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
const layoutDe = (cliente) => JSON.parse(db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(cliente).layout);

test('el fixture SI es la forma de produccion: "asaaht" y "Llamadas Únicas"', () => {
  assert.deepEqual(panelFlujo(LAYOUT_PROD).subtabs.map((s) => s.key), ['resumen', 'sl', 'abandono', 'asaaht']);
  assert.equal(LAYOUT_PROD.tabs.find((t) => t.key === 'llamadas_unicas').label, 'Llamadas Únicas');
});

test('migracion: base migrada == seed (mismo layout final que una base nueva)', () => {
  assert.deepEqual(layoutDe('MOBILIZE'), SEED_MOBILIZE.layout);
  const m = db.prepare("SELECT name FROM schema_migrations WHERE name = 'dashboards_config_mobilize_flujo_asaata_aht_v1'").get();
  assert.ok(m, 'quedo registrada en schema_migrations');
});

test('migracion: fuera de sub-pestañas y nombre, nada mas cambia (resumenOcultar, resumenPorSeccion, titulos, paneles)', () => {
  const migrado = layoutDe('MOBILIZE');
  const { subtabs: _a, ...restoMigrado } = panelFlujo(migrado);
  const { subtabs: _b, ...restoProd } = panelFlujo(LAYOUT_PROD);
  assert.deepEqual(restoMigrado, restoProd);
  assert.deepEqual(migrado.tabs.map((t) => t.key), LAYOUT_PROD.tabs.map((t) => t.key));
  migrado.tabs.forEach((t, i) => {
    if (t.key !== 'flujo') assert.deepEqual(t.panels, LAYOUT_PROD.tabs[i].panels, t.key);
  });
});

test('migracion: idempotente -- correrla otra vez no cambia nada', () => {
  const antes = db.prepare("SELECT layout, updatedAt FROM dashboards_config WHERE cliente = 'MOBILIZE'").get();
  db.migrarMobilizeAsaAtaAhtYNombreLlamadasUnicas();
  const despues = db.prepare("SELECT layout, updatedAt FROM dashboards_config WHERE cliente = 'MOBILIZE'").get();
  assert.deepEqual(despues, antes);
});

test('migracion: si la forma no es la esperada, no toca nada', () => {
  const raro = JSON.parse(JSON.stringify(LAYOUT_PROD));
  panelFlujo(raro).subtabs = [{ key: 'resumen', label: 'Resumen' }, { key: 'asaaht', label: 'ASA y AHT' }];
  raro.tabs.find((t) => t.key === 'llamadas_unicas').label = 'Otro nombre puesto a mano';
  db.prepare("UPDATE dashboards_config SET layout = ?, updatedAt = 'X' WHERE cliente = 'MOBILIZE'").run(JSON.stringify(raro));
  db.migrarMobilizeAsaAtaAhtYNombreLlamadasUnicas();
  const row = db.prepare("SELECT layout, updatedAt FROM dashboards_config WHERE cliente = 'MOBILIZE'").get();
  assert.deepEqual(JSON.parse(row.layout), raro);
  assert.equal(row.updatedAt, 'X');
});

test('migracion: nunca toca otro cliente', () => {
  assert.deepEqual(layoutDe('CLIENTE_FASE145'), OTRO);
});

// ── M2: aviso amarillo de "sin datos cargados" ───────────────────────────

test('aviso sin cargas: un dashboard SOLO de paneles autonomos (Mobilize) no lo muestra', () => {
  assert.equal(gdDependeDeCargasGenericas(SEED_MOBILIZE.layout), false);
  assert.equal(gdMostrarAvisoSinCargas(SEED_MOBILIZE.layout, false), false);
});

test('aviso sin cargas: un dashboard generico (KPI o panel de resumen) sin cargas SI lo muestra; con cargas no', () => {
  const conKpis = { kpis: [{ key: 'x' }], tabs: [] };
  const conPanelResumen = { kpis: [], tabs: [{ key: 't', panels: [{ tipo: 'line' }] }] };
  const mixto = { kpis: [], tabs: [{ key: 'a', panels: [{ tipo: 'trafico_combo' }] }, { key: 'b', oculta: true, panels: [{ tipo: 'combo' }] }] };
  assert.equal(gdMostrarAvisoSinCargas(conKpis, false), true);
  assert.equal(gdMostrarAvisoSinCargas(conPanelResumen, false), true);
  assert.equal(gdMostrarAvisoSinCargas(mixto, false), true, 'un panel de resumen en una pestaña oculta tambien cuenta');
  assert.equal(gdMostrarAvisoSinCargas(conPanelResumen, true), false);
  assert.equal(gdMostrarAvisoSinCargas(undefined, false), false, 'sin layout no hay nada que dependa de cargas');
});

test('aviso sin cargas: ORLANT no cambia (sigue dependiendo de cargas genericas)', () => {
  assert.equal(gdDependeDeCargasGenericas(SEED_ORLANT.layout), true);
  assert.equal(gdMostrarAvisoSinCargas(SEED_ORLANT.layout, false), true);
  assert.equal(gdMostrarAvisoSinCargas(SEED_ORLANT.layout, true), false);
});

test('dashboard-generic.js: renderGenericBanner usa gdMostrarAvisoSinCargas', () => {
  const src = fs.readFileSync(path.join(PUBLIC_JS, 'dashboard-generic.js'), 'utf8');
  const cuerpo = src.slice(src.indexOf('function renderGenericBanner'), src.indexOf('function renderGenericKpis'));
  assert.match(cuerpo, /gdMostrarAvisoSinCargas\(layoutGd, hayCargas\)/);
});

// ── M2: % legibles sobre cada porcion de la torta ────────────────────────

const OSCURO = '#0a1e25';
function leerPaleta(nombre) {
  const src = fs.readFileSync(path.join(PUBLIC_JS, 'charts.js'), 'utf8');
  const m = src.match(new RegExp('var ' + nombre + "=\\[([^\\]]+)\\]"));
  return m[1].split(',').map((s) => s.trim().replace(/'/g, ''));
}

test('contrasteTextoSobreRelleno: oscuro sobre claro, blanco sobre oscuro', () => {
  assert.equal(contrasteTextoSobreRelleno('#abeded', OSCURO).color, OSCURO);
  assert.equal(contrasteTextoSobreRelleno('#d9c68c', OSCURO).color, OSCURO);
  assert.equal(contrasteTextoSobreRelleno('#1f1f93', OSCURO).color, '#ffffff');
  assert.equal(contrasteTextoSobreRelleno('#461a66', OSCURO).color, '#ffffff');
  const r = contrasteTextoSobreRelleno('#abeded', OSCURO);
  assert.ok(r.razon >= 4.5 && r.halo === null);
});

test('contrasteTextoSobreRelleno: relleno no hex -> blanco con contorno oscuro', () => {
  assert.deepEqual(contrasteTextoSobreRelleno('rgba(0,0,0,0.5)', OSCURO), { color: '#ffffff', razon: null, halo: OSCURO });
});

test('paleta clara (PC) + gris de "Otras": todas las porciones llegan a >=4.5:1 sin contorno', () => {
  for (const hex of leerPaleta('PC').concat(['#9aa0a6'])) {
    const r = contrasteTextoSobreRelleno(hex, OSCURO);
    assert.ok(r.razon >= 4.5, hex + ' ' + r.razon);
    assert.equal(r.halo, null, hex);
  }
});

test('paleta oscura (PC_DARK): >=4.5:1 contra la porcion, o contorno del otro color que da >=4.5:1 contra la letra', () => {
  for (const hex of leerPaleta('PC_DARK')) {
    const r = contrasteTextoSobreRelleno(hex, OSCURO);
    if (r.halo === null) assert.ok(r.razon >= 4.5, hex + ' ' + r.razon);
    else assert.ok(contrasteRazon(r.color, r.halo) >= 4.5, hex);
  }
});

test('charts.js: loPie elige el color del % por porcion (no mas blanco fijo) y contraste-logic.js carga antes', () => {
  const src = fs.readFileSync(path.join(PUBLIC_JS, 'charts.js'), 'utf8');
  const cuerpo = src.slice(src.indexOf('function loPie('), src.indexOf('function loPie(') + 600);
  assert.match(cuerpo, /color:_loPieDlColor,textStrokeColor:_loPieDlHalo,textStrokeWidth:_loPieDlHaloAncho/);
  assert.doesNotMatch(cuerpo, /color:'#fff'/);
  assert.match(src, /var CHART_DL_OSCURO='#0a1e25'/);
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  const iC = html.indexOf('<script src="js/contraste-logic.js"></script>');
  const iCh = html.indexOf('<script src="js/charts.js"></script>');
  assert.ok(iC !== -1 && iC < iCh, 'contraste-logic.js antes de charts.js');
});
