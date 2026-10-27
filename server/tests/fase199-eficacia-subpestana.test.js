// Fase 199 (Mobilize, Flujo de Llamadas): la Eficacia de la Fase 198 sale de
// "One & Done" y pasa a su propia sub-pestaña "Eficacia", a la derecha de One
// & Done. One & Done vuelve a como estaba antes de la Fase 198. La
// configuracion de produccion recibe la sub-pestaña por migracion
// (dashboards_config_mobilize_flujo_eficacia_v1). El calculo no cambia.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { db } = require('./helpers');
const { CONFIGS } = require('../dashboard-config-seed');
const PC = require('../plantillas-cliente');

const RAIZ = path.join(__dirname, '..', '..');
const TRAF = fs.readFileSync(path.join(RAIZ, 'public', 'js', 'trafico.js'), 'utf8');
const CSS = fs.readFileSync(path.join(RAIZ, 'public', 'css', 'styles.css'), 'utf8');
const SUBTABS = ['resumen', 'sl', 'abandono', 'asaata', 'aht', 'oneanddone', 'eficacia'];
const panelFlujo = (layout) => layout.tabs.find((t) => t.key === 'flujo').panels.find((p) => p.tipo === 'trafico_combo');
const leer = (c) => JSON.parse(db.prepare('SELECT layout FROM dashboards_config WHERE cliente=?').get(c).layout);
const guardar = (c, l) => db.prepare('UPDATE dashboards_config SET layout=? WHERE cliente=?').run(JSON.stringify(l), c);

test('seed y plantilla: "Eficacia" a la derecha de "One & Done"; ORLANT sin ella', () => {
  const seed = panelFlujo(CONFIGS.find((c) => c.cliente === 'MOBILIZE').layout);
  assert.deepEqual(seed.subtabs.map((s) => s.key), SUBTABS);
  assert.deepEqual(seed.subtabs.slice(-2).map((s) => s.label), ['One & Done', 'Eficacia']);
  assert.deepEqual(PC.PERFILES_ACTUALES.MOBILIZE.ajustes.flujo_llamadas.panel.subtabs.map((s) => s.key), SUBTABS);
  assert.ok(!JSON.stringify(CONFIGS.find((c) => c.cliente === 'ORLANT').layout).includes('eficacia'));
});

test('migración: la forma de producción (6 sub-pestañas) recibe Eficacia al final; idempotente; otra forma intacta; ORLANT intacto', () => {
  const original = leer('MOBILIZE');
  const orlant = leer('ORLANT');
  assert.deepEqual(panelFlujo(original).subtabs.map((s) => s.key), SUBTABS, 'base nueva = seed');
  const prod = JSON.parse(JSON.stringify(original));
  panelFlujo(prod).subtabs = panelFlujo(prod).subtabs.filter((s) => s.key !== 'eficacia');
  guardar('MOBILIZE', prod);
  db.migrarMobilizeFlujoEficacia();
  assert.deepEqual(leer('MOBILIZE'), original, 'solo agrega la sub-pestaña; lo demás del panel igual');
  db.migrarMobilizeFlujoEficacia();
  assert.deepEqual(leer('MOBILIZE'), original, 'idempotente');
  // Forma desconocida (sin One & Done): no se toca.
  const rara = JSON.parse(JSON.stringify(prod));
  panelFlujo(rara).subtabs = panelFlujo(rara).subtabs.filter((s) => s.key !== 'oneanddone');
  guardar('MOBILIZE', rara);
  db.migrarMobilizeFlujoEficacia();
  assert.deepEqual(leer('MOBILIZE'), rara);
  guardar('MOBILIZE', original);
  assert.deepEqual(leer('ORLANT'), orlant);
});

// Contenido HTML de cada sub-pestaña con el codigo real de trafico.js.
function contenido(activo) {
  const ctx = { esc: (s) => String(s), gdGraficaHtml: (t, c) => '<section><h3>' + t + '</h3>' + c + '</section>', console };
  vm.createContext(ctx);
  vm.runInContext(TRAF, ctx);
  return ctx._traficoSubtabContentHTML('tv', 0, activo, ctx.TRAFICO_SUBTAB_TITULOS, null);
}

test('pantalla: One & Done como antes de la Fase 198 (sin nada de Eficacia)', () => {
  const oad = contenido('oneanddone');
  assert.ok(oad.includes('id="tv-oad-kpi-0" class="aurora-kpis"'));
  assert.ok(oad.includes('id="tv-canvas-oad-0"') && oad.includes('id="tv-oad-q3-0"'));
  assert.ok(!/ef-kpi|canvas-ef|ef-nota|Eficacia|oad-ef/.test(oad));
  assert.ok(!/oad-ef-fila|oad-ef-slot/.test(CSS + TRAF), 'la fila compartida de la Fase 198 ya no existe');
});

test('pantalla: sub-pestaña Eficacia con tarjeta, barras por mes y nota; exporta su tabla', () => {
  const ef = contenido('eficacia');
  assert.ok(ef.includes('<h3>Eficacia — llamadas de ingreso con código positivo</h3>'));
  assert.ok(ef.includes('id="tv-ef-kpi-0" class="aurora-kpis"'));
  assert.ok(ef.includes('id="tv-canvas-ef-0" role="img" aria-label="Eficacia por mes'));
  assert.ok(ef.includes('id="tv-ef-nota-0" class="ef-nota"'));
  assert.ok(!/oad/.test(ef));
  assert.match(TRAF, /=== 'eficacia' && typeof _eficaciaDatosExport === 'function'/);
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'public', 'js', 'eficacia.js'), 'utf8'), ctx);
  vm.runInContext("_eficaciaUltimo[0] = { meses: [{ periodo: '2026-10', contestadas: 89, positivas: 42, pct: 47.2 }] };", ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx._eficaciaDatosExport(0))), [{ Mes: '2026-10', 'Contestadas de ingreso': 89, 'Con código positivo': 42, '% Eficacia': 47.2 }]);
});
