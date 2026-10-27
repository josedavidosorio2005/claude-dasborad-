// fase147-d-one-and-done.test.js — Fase 147, Parte D: sub-pestaña "One &
// Done" en Mobilize → Flujo de Llamadas (FCR por mes, Q03 = 1 sobre la base
// del panel). Logica pura, seed + migracion y la vista. Todo SINTETICO.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const L = require('../../public/js/encuesta-logic.js');
const { CONFIGS } = require('../dashboard-config-seed');
const { db } = require('./helpers');

const SEPT = { periodo: '2026-09', si: 3, total: 45, respondieron: 4 };

test('serie: % con base total y con base respondieron (mismo numero que la tarjeta FCR)', () => {
  const total = L.encuestaOneAndDoneSerie([SEPT], ['2026-09'], 'total');
  assert.deepEqual([total[0].pct, total[0].si, total[0].den], [6.7, 3, 45]);
  assert.equal(L.encuestaFmtPct(total[0].pct) + ' (' + L.encuestaFcrFraccion(3, 45, 'total') + ')', '6,7 % (3 de 45 encuestas)');
  const resp = L.encuestaOneAndDoneSerie([SEPT], ['2026-09'], 'respondieron');
  assert.deepEqual([resp[0].pct, resp[0].den], [75, 4]);
  // Identico a la tarjeta FCR (encuestaFcr / encuestaFcrTarjeta).
  assert.equal(total[0].pct, L.encuestaFcr(3, 45, 4, 'total').pct);
});

test('serie: mes del rango sin encuestas = "sin encuestas" (pct null, nunca 0 %); division por cero = null', () => {
  const s = L.encuestaOneAndDoneSerie([SEPT], ['2026-08', '2026-09', '2026-10'], 'total');
  assert.deepEqual(s.map((x) => x.sinEncuestas), [true, false, true]);
  assert.equal(s[0].pct, null);
  const cero = L.encuestaOneAndDoneSerie([{ periodo: '2026-09', si: 0, total: 5, respondieron: 0 }], ['2026-09'], 'respondieron');
  assert.equal(cero[0].pct, null);
  assert.equal(L.encuestaFmtPct(cero[0].pct), '—');
});

test('meses del rango Desde/Hasta (cruza de año); sin rango = meses con datos', () => {
  assert.deepEqual(L.encuestaMesesRango('2026-11-15', '2027-02-03', []), ['2026-11', '2026-12', '2027-01', '2027-02']);
  assert.deepEqual(L.encuestaMesesRango('', '', [{ periodo: '2026-09' }, { periodo: '2026-08' }]), ['2026-08', '2026-09']);
  assert.deepEqual(L.encuestaMesesRango('', '', []), []);
});

test('desglose de la pregunta 3: Si / No / Sin respuesta en cantidad y % del total', () => {
  const d = L.encuestaQ3Desglose([SEPT]);
  assert.deepEqual([d.si, d.no, d.sinRespuesta], [3, 1, 41]);
  assert.deepEqual([d.pctSi, d.pctNo, d.pctSinRespuesta], [6.7, 2.2, 91.1]);
  const vacio = L.encuestaQ3Desglose([]);
  assert.deepEqual([vacio.total, vacio.pctSi], [0, null]);
});

const panelFlujo = (layout) => layout.tabs.find((t) => t.key === 'flujo').panels.find((p) => p.tipo === 'trafico_combo');
// Fase 199: + Eficacia a la derecha de One & Done (migracion propia, abajo).
const SUBTABS = ['resumen', 'sl', 'abandono', 'asaata', 'aht', 'oneanddone', 'eficacia'];

test('seed: One & Done al final; las 5 sub-pestañas, sus textos y fcrBase no cambian; ORLANT intacto', () => {
  const p = panelFlujo(CONFIGS.find((c) => c.cliente === 'MOBILIZE').layout);
  assert.deepEqual(p.subtabs.map((s) => s.key), SUBTABS);
  assert.deepEqual(p.subtabs.map((s) => s.label), ['Resumen', 'Nivel de Servicio', 'Abandono', 'ASA y ATA', 'AHT', 'One & Done', 'Eficacia']);
  assert.equal(p.fcrBase, 'empezaron'); // Fase 200: base = contestaron la pregunta 1
  assert.ok(!JSON.stringify(CONFIGS.find((c) => c.cliente === 'ORLANT').layout).includes('oneanddone'));
});

test('migracion: base migrada = seed; idempotente; forma desconocida intacta; ORLANT intacto', () => {
  const leer = (c) => JSON.parse(db.prepare('SELECT layout FROM dashboards_config WHERE cliente=?').get(c).layout);
  const original = leer('MOBILIZE');
  const orlant = leer('ORLANT');
  assert.deepEqual(panelFlujo(original), panelFlujo(CONFIGS.find((c) => c.cliente === 'MOBILIZE').layout));
  // Forma de produccion (5 sub-pestañas) -> agrega One & Done al final.
  const prod = JSON.parse(JSON.stringify(original));
  panelFlujo(prod).subtabs = panelFlujo(prod).subtabs.filter((s) => s.key !== 'oneanddone' && s.key !== 'eficacia');
  db.prepare("UPDATE dashboards_config SET layout=? WHERE cliente='MOBILIZE'").run(JSON.stringify(prod));
  db.migrarMobilizeFlujoOneAndDone();
  db.migrarMobilizeFlujoEficacia(); // Fase 199: despues de One & Done
  assert.deepEqual(panelFlujo(leer('MOBILIZE')).subtabs.map((s) => s.key), SUBTABS);
  db.migrarMobilizeFlujoOneAndDone();
  db.migrarMobilizeFlujoEficacia();
  assert.deepEqual(panelFlujo(leer('MOBILIZE')).subtabs.map((s) => s.key), SUBTABS, 'idempotente');
  assert.deepEqual(leer('MOBILIZE'), original);
  const rara = { kpis: [], tabs: [{ key: 'flujo', label: 'Flujo', panels: [{ tipo: 'trafico_combo', campana: 'MOBILIZE', subtabs: [{ key: 'resumen', label: 'R' }] }] }] };
  db.prepare("UPDATE dashboards_config SET layout=? WHERE cliente='MOBILIZE'").run(JSON.stringify(rara));
  db.migrarMobilizeFlujoOneAndDone();
  assert.deepEqual(leer('MOBILIZE'), rara);
  db.prepare("UPDATE dashboards_config SET layout=? WHERE cliente='MOBILIZE'").run(JSON.stringify(original));
  assert.deepEqual(leer('ORLANT'), orlant);
});

test('vista: grafica accesible, texto de datos escapado, exportacion con su tabla', () => {
  const traf = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'trafico.js'), 'utf8');
  const enc = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'encuesta.js'), 'utf8');
  assert.match(traf, /role="img" aria-label="One &amp; Done por mes/);
  assert.match(traf, /'oneanddone' && typeof _encuestaOadDatosExport === 'function'/);
  const vista = enc.slice(enc.indexOf('async function _encuestaDibujarOneAndDone'), enc.indexOf('function _encuestaOadDatosExport'));
  assert.match(vista, /esc\(mesLbl\(t\.mes\)\)/);
  assert.match(vista, /esc\(sinMes\.join/);
  assert.match(vista, /Sin encuestas este mes/);
  assert.match(vista, /max: 100/);
  assert.ok(!/kpi-red|kpi-green|semaforo/i.test(vista), 'sin semaforo: no hay meta');
});
