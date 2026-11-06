// fase276-flujo-hora-sin-lienzo.test.js — Fase 276: Mobilize › Flujo por hora
// mostraba, ademas de sus tablas, una tarjeta de grafica con un <canvas> vacio.
// Causa: renderGenericTab armaba el panel flujo_hora_panel como panel propio de
// ancho completo, pero la lista (copiada a mano) que lo saca de la rejilla de
// graficas no lo tenia -> tarjeta con <canvas id="gd-c<i>"> que nadie dibuja.
// Ahora las dos salen de GD_TIPOS_PANEL_PROPIO. Corre el renderGenericTab REAL
// con un DOM minimo; los datos del panel son inventados (no se dibujan aqui:
// solo importa que la pestaña no traiga un lienzo de mas). Falla con el codigo
// anterior.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'dashboard-generic.js'), 'utf8');

function render(tab) {
  const ini = SRC.indexOf('var GD_TIPOS_PANEL_PROPIO') !== -1 ? SRC.indexOf('var GD_TIPOS_PANEL_PROPIO') : SRC.indexOf('function renderGenericTab(key){');
  const fin = SRC.indexOf('\n}\n', SRC.indexOf('function renderGenericTab(key){')) + 2;
  const host = { innerHTML: '' };
  const dibujados = [];
  const ctx = {
    _gd: { config: { layout: { tabs: [tab] } } },
    document: { getElementById: (id) => (id === 'gd-panels' ? host : null) },
    esc: (s) => String(s == null ? '' : s),
    _gdSubtabActiva: () => null,
    gdClaseSeccion: () => '', gdSeccionDeTipo: () => '',
    _gdPanelTipo: (p) => p.tipo, _gdPanelFiltroTipo: () => false,
    _gdRenderPanel: (p, i) => dibujados.push(p.tipo + '#' + i),
  };
  vm.createContext(ctx);
  vm.runInContext(SRC.slice(ini, fin), ctx, { filename: 'dashboard-generic.js' });
  ctx.renderGenericTab(tab.key);
  return { html: host.innerHTML, dibujados };
}
const lienzos = (html) => (html.match(/<canvas id="gd-c\d+"/g) || []).length;

// La pestaña tal como la tiene MOBILIZE (migracion fase196_flujo_hora_v1), con
// datos inventados de una hora (el panel los pide aparte; aqui no se usan).
const FLUJO_HORA = { key: 'flujo_hora', label: 'Flujo por hora', panels: [{ tipo: 'flujo_hora_panel', campana: 'MOBILIZE', datosSinteticos: { mes: '2026-10', hora: '08', ingresadas: 120, contestadas: 110, abandonadas: 10 } }] };

test('Mobilize › Flujo por hora: el panel va solo, sin tarjeta de grafica ni <canvas> vacio', () => {
  const r = render(FLUJO_HORA);
  assert.equal(lienzos(r.html), 0, 'antes de la Fase 276 aparecia <canvas id="gd-c0"> sin dibujar');
  assert.doesNotMatch(r.html, /aurora-grid-2/, 'sin rejilla de graficas');
  assert.match(r.html, /<div id="gd-p0"><\/div>/, 'el contenedor del panel propio sigue');
  assert.deepEqual(r.dibujados, ['flujo_hora_panel#0'], 'y se le pide dibujarse a si mismo');
});

test('ningun panel propio de ancho completo deja un lienzo de la rejilla (todos los tipos)', () => {
  const ctx = vm.createContext({});
  vm.runInContext(SRC.slice(SRC.indexOf('var GD_TIPOS_PANEL_PROPIO'), SRC.indexOf('function renderGenericTab(key){')), ctx);
  assert.ok(ctx.GD_TIPOS_PANEL_PROPIO.includes('flujo_hora_panel'));
  for (const tipo of ctx.GD_TIPOS_PANEL_PROPIO.concat(['kpi_row', 'calidad_kpis', 'tabla', 'nota_kpi'])) {
    assert.equal(lienzos(render({ key: 't', panels: [{ tipo }] }).html), 0, tipo);
  }
});

test('las graficas de siempre siguen en la rejilla con su <canvas> (line, bar, pie, calidad_pie)', () => {
  for (const tipo of ['line', 'bar', 'pie', 'calidad_pie', 'calidad_bar_asesores']) {
    const r = render({ key: 't', panels: [{ tipo, titulo: 'X' }] });
    assert.equal(lienzos(r.html), 1, tipo);
  }
  const mixta = render({ key: 't', panels: [{ tipo: 'flujo_hora_panel' }, { tipo: 'line', titulo: 'L' }] });
  assert.equal(lienzos(mixta.html), 1, 'una pestaña con panel propio + grafica: solo el lienzo de la grafica');
  assert.match(mixta.html, /<canvas id="gd-c1"/);
});

test('una sola lista: el armado del panel propio y la exclusion de la rejilla usan GD_TIPOS_PANEL_PROPIO', () => {
  assert.match(SRC, /\} else if\(GD_TIPOS_PANEL_PROPIO\.indexOf\(p\.tipo\) !== -1\)\{/);
  assert.match(SRC, /GD_TIPOS_SIN_LIENZO\.indexOf\(x\.p\.tipo\) === -1/);
  assert.doesNotMatch(SRC, /x\.p\.tipo!=='kpi_row'/, 'la copia a mano ya no existe');
});
