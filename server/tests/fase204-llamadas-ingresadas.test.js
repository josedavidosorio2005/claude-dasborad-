// fase204-llamadas-ingresadas.test.js — Fase 204 (pedido de Edwin): en Flujo
// de Llamadas de MOBILIZE el total se llama "Llamadas ingresadas" (tarjeta,
// leyenda, tooltip, Ver datos y Excel). Solo texto: el calculo no cambia.
// ORLANT (Trafico de Llamadas) sigue con "Total de llamadas" / "Total Llamadas".
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { CONFIGS } = require('../dashboard-config-seed');
const { db } = require('./helpers');

const JS = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'trafico.js'), 'utf8');
function extraer(firma) {
  const ini = JS.indexOf(firma);
  assert.ok(ini >= 0, firma);
  const cortes = ['\nfunction ', '\nasync function '].map((s) => JS.indexOf(s, ini + 1)).filter((x) => x > 0);
  return JS.slice(ini, Math.min(...cortes));
}
const panelDe = (layout, cliente, tab) => (layout.tabs.find((t) => t.key === tab) || { panels: [] }).panels.find((p) => p.tipo === 'trafico_combo');

test('seed y plantilla: MOBILIZE trae etiquetaTotal "Llamadas ingresadas" (ORLANT también desde la Fase 206)', () => {
  assert.equal(panelDe(CONFIGS.find((c) => c.cliente === 'MOBILIZE').layout, 'MOBILIZE', 'flujo').etiquetaTotal, 'Llamadas ingresadas');
  assert.equal(CONFIGS.find((c) => c.cliente === 'ORLANT').layout.tabs.find((t) => t.key === 'trafico').panels[0].etiquetaTotal, 'Llamadas ingresadas'); // Fase 206
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'plantillas-cliente.js'), 'utf8'), /etiquetaTotal: 'Llamadas ingresadas'/);
});

test('migracion: agrega etiquetaTotal solo si falta; nunca pisa uno puesto; sin panel, intacto; ORLANT intacto', () => {
  const leer = (c) => JSON.parse(db.prepare('SELECT layout FROM dashboards_config WHERE cliente=?').get(c).layout);
  const original = leer('MOBILIZE');
  const orlant = leer('ORLANT');
  const sin = JSON.parse(JSON.stringify(original));
  delete panelDe(sin, 'MOBILIZE', 'flujo').etiquetaTotal;
  db.prepare("UPDATE dashboards_config SET layout=? WHERE cliente='MOBILIZE'").run(JSON.stringify(sin));
  db.migrarMobilizeFlujoEtiquetaTotal();
  assert.equal(panelDe(leer('MOBILIZE'), 'MOBILIZE', 'flujo').etiquetaTotal, 'Llamadas ingresadas');
  db.migrarMobilizeFlujoEtiquetaTotal();
  assert.deepEqual(leer('MOBILIZE'), original, 'idempotente y igual al seed');
  const otro = JSON.parse(JSON.stringify(original));
  panelDe(otro, 'MOBILIZE', 'flujo').etiquetaTotal = 'Entrantes';
  db.prepare("UPDATE dashboards_config SET layout=? WHERE cliente='MOBILIZE'").run(JSON.stringify(otro));
  db.migrarMobilizeFlujoEtiquetaTotal();
  assert.equal(panelDe(leer('MOBILIZE'), 'MOBILIZE', 'flujo').etiquetaTotal, 'Entrantes', 'no pisa');
  const rara = { kpis: [], tabs: [{ key: 'otro', label: 'Otro', panels: [] }] };
  db.prepare("UPDATE dashboards_config SET layout=? WHERE cliente='MOBILIZE'").run(JSON.stringify(rara));
  db.migrarMobilizeFlujoEtiquetaTotal();
  assert.deepEqual(leer('MOBILIZE'), rara);
  db.prepare("UPDATE dashboards_config SET layout=? WHERE cliente='MOBILIZE'").run(JSON.stringify(original));
  assert.deepEqual(leer('ORLANT'), orlant);
});

test('tarjeta y leyenda: usan etiquetaTotal del panel; sin ella, los textos de siempre (ORLANT)', () => {
  assert.match(JS, /\{ total: pCfgKpis\.etiquetaTotal \|\| 'Total de llamadas', contestadas:/);
  assert.match(JS, /_traficoDibujarResumenChart\('tv', i, agregado, estado\.combinar, pCfgKpis\.etiquetaTotal \|\| 'Total Llamadas', 'Llamadas Contestadas', campana\);/);
  // Tooltip y "Ver datos" leen ctx.dataset.label / las etiquetas del dataset: la misma leyenda.
  assert.match(extraer('function _traficoDibujarResumenChart'), /return ctx\.dataset\.label \+ ': '/);
});

test('barras por skill y Excel: "Llamadas ingresadas" en Mobilize, "Total" / "Total Llamadas" en ORLANT; mismos numeros', () => {
  const datos = (etiqueta) => {
    const ctx = {
      _traficoPanelConfig: { 0: etiqueta ? { etiquetaTotal: etiqueta } : {} },
      _traficoAgregadoActual: { MOBILIZE: [{ periodo: '2026-10', skillName: '', totalLlamadas: 106, contestadas: 104, llamadasAbandonadas: 2 }] },
      _traficoSubtabActivo: {},
      document: { getElementById: () => ({ dataset: { campana: 'MOBILIZE', sede: '' } }) },
    };
    vm.createContext(ctx);
    vm.runInContext(['function _traficoClaveEstado', 'function _traficoExportEsOneAndDone', 'function _traficoExportEsEficacia', 'function _traficoDatosExport'].map(extraer).join('\n'), ctx);
    return JSON.parse(JSON.stringify(ctx._traficoDatosExport(0)[0]));
  };
  const m = datos('Llamadas ingresadas');
  assert.equal(m['Llamadas ingresadas'], 106);
  assert.ok(!('Total Llamadas' in m));
  assert.deepEqual(Object.keys(m).slice(0, 4), ['Periodo', 'Skill', 'Llamadas ingresadas', 'Llamadas Contestadas'], 'misma posicion de columna');
  const o = datos(null);
  assert.equal(o['Total Llamadas'], 106);
  assert.match(extraer('function _traficoDibujarResumenChart'), /label: skLbl\+' — '\+\(labelTotal === 'Total Llamadas' \? 'Total' : labelTotal\)/);
});
