// fase147-a-ajustes-reunion.test.js — Fase 147, Parte A (reunion con Edwin
// del 14/10/2026): fechas con nombre, "Ultima actualizacion" en naranja,
// Calidad al final en Mobilize. (Asesor para el cliente de Mobilize y el
// filtro Tipo se prueban en fase141-llamadas-salida.test.js; el contraste del
// naranja, en fase133-parte6-regresion-wcag.test.js.)
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { periodoLegible, fechaDiaCorta } = require('../../public/js/mes-nombre-logic.js');
const { traficoRangoTexto } = require('../../public/js/trafico-logic.js');
const { CONFIGS } = require('../dashboard-config-seed');

const PUB = path.join(__dirname, '..', '..', 'public');

// ── fechas con nombre ──
test('periodoLegible: AAAA-MM -> "Septiembre 2026"; AAAA-MM-DD -> "15 sep"; lo demas igual', () => {
  assert.equal(periodoLegible('2026-09'), 'Septiembre 2026');
  assert.equal(periodoLegible('2026-01'), 'Enero 2026');
  assert.equal(periodoLegible('2026-09-15'), '15 sep');
  assert.equal(periodoLegible('2026-12-01'), '1 dic');
  assert.equal(periodoLegible('2026'), '2026', 'el año se queda igual');
  assert.equal(periodoLegible('Total'), 'Total');
  assert.equal(periodoLegible(null), '');
  assert.equal(fechaDiaCorta('2026-04-01', true), '1 abr 2026');
});

test('"Mostrando:" con el mes en letras', () => {
  assert.equal(traficoRangoTexto('2026-09-01', '2026-09-30'), 'Mostrando: 1 sep 2026 – 30 sep 2026');
});

test('charts.js: un complemento global traduce SOLO las etiquetas AAAA-MM / AAAA-MM-DD (ejes y tooltips de todas las graficas)', () => {
  const src = fs.readFileSync(path.join(PUB, 'js', 'charts.js'), 'utf8');
  assert.match(src, /Chart\.register\(\{\s*id: 'periodoLegible',\s*beforeUpdate: function \(chart\)/);
  // la logica real, ejecutada con el helper real
  const sandbox = { periodoLegible, Chart: undefined };
  const vm = require('vm');
  vm.createContext(sandbox);
  vm.runInContext(src.slice(src.indexOf('var CHART_RE_PERIODO'), src.indexOf('if (typeof Chart !== \'undefined\' && typeof Chart.register')), sandbox);
  assert.deepEqual(sandbox.chartEtiquetasLegibles(['2026-08', '2026-09', '2026-09-15', '2026', 'Agendamiento']),
    ['Agosto 2026', 'Septiembre 2026', '15 sep', '2026', 'Agendamiento']);
  // idempotente: aplicarlo dos veces da lo mismo
  assert.deepEqual(sandbox.chartEtiquetasLegibles(sandbox.chartEtiquetasLegibles(['2026-09'])), ['Septiembre 2026']);
});

test('avisos y titulos con el mes completo; los nombres de archivo exportado NO cambian (siguen cortos)', () => {
  const gd = fs.readFileSync(path.join(PUB, 'js', 'dashboard-generic.js'), 'utf8');
  assert.match(gd, /var fmt = formatearMes \|\| _gdMesLargo;/, 'aviso de mes sin datos');
  assert.match(gd, /' · comparado con ' \+ esc\(_gdMesLargo\(_gd\.compSel\)\)/, 'titulo del PDF');
  // Fase 207: los meses de MESES, en el mismo formato corto ("Sep-26" o "Ago-26_a_Oct-26").
  assert.match(gd, /var mesLbl = _gdMesesLblExport\(\);/, 'nombre de archivo exportado: formato corto de siempre');
  assert.match(gd, /return m\.length === 1 \? _gdMesLbl\(m\[0\]\) : _gdMesLbl\(m\[0\]\) \+ '_a_' \+ _gdMesLbl\(m\[m\.length-1\]\);/);
  const cargas = fs.readFileSync(path.join(PUB, 'js', 'cargas.js'), 'utf8');
  assert.ok(!/_gdMesLbl/.test(cargas), 'los avisos de Cargar Datos usan el mes completo');
});

// ── Calidad al final en Mobilize: seed + migracion ──
test('seed: Calidad es la ultima pestaña de MOBILIZE', () => {
  const tabs = CONFIGS.find((c) => c.cliente === 'MOBILIZE').layout.tabs.map((t) => t.key);
  assert.equal(tabs[tabs.length - 1], 'calidad');
});

const tmpDb = path.join(os.tmpdir(), `inconexion-fase147a-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);
const SEED_M = CONFIGS.find((c) => c.cliente === 'MOBILIZE');
// Forma de PRODUCCION: ... calidad, tipificacion (la migracion de la Fase 131 la agrego al final)
const LAYOUT_PROD = JSON.parse(JSON.stringify(SEED_M.layout));
// (Fase 147 Parte B: produccion todavia no tiene "encuesta" -- la agrega su
// propia migracion, dashboards_config_mobilize_encuesta_tab_v1.)
LAYOUT_PROD.tabs = LAYOUT_PROD.tabs.filter((t) => t.key !== 'encuesta');
{
  const i = LAYOUT_PROD.tabs.findIndex((t) => t.key === 'calidad');
  const [cal] = LAYOUT_PROD.tabs.splice(i, 1);
  const j = LAYOUT_PROD.tabs.findIndex((t) => t.key === 'tipificacion');
  LAYOUT_PROD.tabs.splice(j, 0, cal);
}
const pre = new Database(tmpDb);
pre.exec(`CREATE TABLE dashboards_config (id INTEGER PRIMARY KEY AUTOINCREMENT, cliente TEXT NOT NULL UNIQUE, titulo TEXT NOT NULL, vista TEXT, secciones TEXT NOT NULL, layout TEXT NOT NULL, activo INTEGER NOT NULL DEFAULT 1, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);`);
pre.prepare("INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt) VALUES ('MOBILIZE','Dashboard Mobilize',NULL,?,?,1,'x','x')").run(JSON.stringify(SEED_M.secciones), JSON.stringify(LAYOUT_PROD));
pre.close();
function setEnvDefault(k, v) { if (process.env[k] === undefined || process.env[k] === '') process.env[k] = v; }
setEnvDefault('NODE_ENV', 'test');
setEnvDefault('JWT_SECRET', crypto.randomBytes(48).toString('hex'));
setEnvDefault('JWT_EXPIRES_IN', '1h');
setEnvDefault('MASTER_ADMIN_USER', 'admin');
setEnvDefault('MASTER_ADMIN_PASSWORD_HASH', bcrypt.hashSync('NoUsadaEnEsteTest#1', 4));
setEnvDefault('DB_PATH', tmpDb);
setEnvDefault('TRUST_PROXY', 'false');
const db = require('../db');
const layout = () => JSON.parse(db.prepare("SELECT layout FROM dashboards_config WHERE cliente='MOBILIZE'").get().layout);

test('migracion: produccion ("... Calidad, Tipificacion") queda con Calidad al final, igual que el seed; nada mas cambia', () => {
  assert.deepEqual(LAYOUT_PROD.tabs.map((t) => t.key).slice(-2), ['calidad', 'tipificacion'], 'el fixture SI es la forma de produccion');
  const l = layout();
  assert.deepEqual(l.tabs.map((t) => t.key), SEED_M.layout.tabs.map((t) => t.key));
  assert.deepEqual(l, SEED_M.layout, 'base migrada == base nueva');
});

test('migracion: idempotente y sin pestaña "calidad" no toca nada', () => {
  const antes = db.prepare("SELECT layout, updatedAt FROM dashboards_config WHERE cliente='MOBILIZE'").get();
  db.migrarMobilizeCalidadAlFinal();
  assert.deepEqual(db.prepare("SELECT layout, updatedAt FROM dashboards_config WHERE cliente='MOBILIZE'").get(), antes);
  const sinCal = layout(); sinCal.tabs = sinCal.tabs.filter((t) => t.key !== 'calidad');
  db.prepare("UPDATE dashboards_config SET layout=?, updatedAt='Y' WHERE cliente='MOBILIZE'").run(JSON.stringify(sinCal));
  db.migrarMobilizeCalidadAlFinal();
  assert.deepEqual(layout(), sinCal);
});
