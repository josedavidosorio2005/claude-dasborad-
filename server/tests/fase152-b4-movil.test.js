// fase152-b4-movil.test.js — Fase 152 (B4): movil y tableta (filtros
// plegables, leyenda debajo, etiquetas sin montarse, tablas con scroll
// propio y primera columna fija, objetivos tactiles), limpieza de estilos
// (.atab, estilos en linea repetidos, escala de z-index) y coma decimal
// es-CO en porcentajes de graficas y tooltips.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const f = require('../../public/js/filtros-movil-logic.js');

const PUB = path.join(__dirname, '..', '..', 'public');
const leer = (r) => fs.readFileSync(path.join(PUB, r), 'utf8');
const css = leer('css/styles.css');

// gdFmtValor real de charts.js, ejecutado aislado (charts.js usa Chart al cargar).
function cargarGdFmtValor() {
  const src = leer('js/charts.js');
  const i = src.indexOf('function gdFmtValor(');
  const fin = src.indexOf('\n}\n', i) + 2;
  const ctx = {};
  vm.runInNewContext(src.slice(i, fin) + '\nthis.gdFmtValor = gdFmtValor;', ctx);
  return ctx.gdFmtValor;
}

test('coma decimal es-CO en porcentajes de graficas y tooltips ("95,1 %")', () => {
  const fmt = cargarGdFmtValor();
  assert.equal(fmt(95.1, '%'), '95,1 %');
  assert.equal(fmt(95.14, '%'), '95,1 %');
  assert.equal(fmt(80, '%'), '80 %');
  assert.equal(fmt(0.05, '%'), '0,1 %');
  assert.equal(fmt(125, 'tiempo'), '2:05', 'los tiempos siguen en m:ss');
  assert.equal(fmt(4547), '4.547', 'conteos con punto de miles');
  assert.equal(fmt(null, '%'), '');
  assert.match(leer('js/charts.js'), /Math\.round\(v\/s\*100\)\+' %'/, 'porcentaje del total en barras/tortas');
});

test('la exportacion de Salida conserva su formato de siempre (no cambia)', () => {
  const gd = leer('js/dashboard-generic.js');
  const ini = gd.indexOf('async function _gdExportarSalida');
  const cuerpo = gd.slice(ini, gd.indexOf('\n}\n', ini));
  assert.doesNotMatch(cuerpo, /gdFmtValor\([^)]*'%'\)/);
  assert.match(cuerpo, /n\.toFixed\(1\) : n\) \+ '%'/);
});

test('gdContarFiltrosActivos / texto del boton "Filtros (N)"', () => {
  const campos = [
    { tipo: 'select-one', valor: 'ORLANT - Inbound' },
    { tipo: 'date', valor: '2026-09-01' },
    { tipo: 'select-one', valor: '' },
    { tipo: 'select-one', valor: 'Todos' },
    { tipo: 'checkbox', marcado: false },
    { tipo: 'checkbox', marcado: true },
  ];
  assert.equal(f.gdContarFiltrosActivos(campos), 3);
  assert.equal(f.gdTextoBotonFiltros(3), 'Filtros (3)');
  assert.equal(f.gdTextoBotonFiltros(0), 'Filtros');
  assert.equal(f.gdContarFiltrosActivos(null), 0);
});

test('graficas en movil: leyenda debajo y etiquetas del eje inclinadas hasta 45 grados', () => {
  const cfg = { type: 'bar', options: { plugins: { legend: { display: true } }, scales: { x: { ticks: { maxRotation: 60 } } } } };
  f.gdOpcionesGraficaMovil(cfg, 375);
  assert.equal(cfg.options.plugins.legend.position, 'bottom');
  assert.equal(cfg.options.scales.x.ticks.maxRotation, 45);
  assert.equal(cfg.options.scales.x.ticks.autoSkip, true);
  const sinLeyenda = { type: 'line', options: { plugins: { legend: { display: false } } } };
  f.gdOpcionesGraficaMovil(sinLeyenda, 768);
  assert.equal(sinLeyenda.options.plugins.legend.position, undefined, 'una leyenda oculta sigue oculta');
  const torta = { type: 'doughnut', options: {} };
  f.gdOpcionesGraficaMovil(torta, 375);
  assert.equal(torta.options.plugins.legend.position, 'bottom');
  assert.equal(torta.options.scales, undefined, 'una torta no tiene eje X');
  const escritorio = { type: 'bar', options: { plugins: { legend: { position: 'top' } } } };
  f.gdOpcionesGraficaMovil(escritorio, 1440);
  assert.equal(escritorio.options.plugins.legend.position, 'top', 'en escritorio no cambia nada');
  assert.match(leer('js/dashboard-generic.js'), /gdOpcionesGraficaMovil\(cfg, window\.innerWidth\)/);
});

test('filtros plegables: boton accesible, solo en movil, sin onclick nuevos; tablas con scroll propio', () => {
  const gd = leer('js/dashboard-generic.js');
  const ini = gd.indexOf('// ── Fase 152 (B4): movil y tableta');
  const bloque = gd.slice(ini, gd.indexOf('.observe(raiz', ini) + 60);
  assert.match(bloque, /tog\.setAttribute\('aria-expanded', 'false'\);/);
  assert.match(bloque, /tog\.setAttribute\('aria-controls', fila\.id\);/);
  assert.match(bloque, /new MutationObserver\(/);
  assert.match(bloque, /document\.getElementById\('gd-overlay'\)/);
  assert.doesNotMatch(bloque, /onclick/);
  assert.match(css, /\.gd-filtros-toggle\{display:none;\}/, 'en escritorio el boton no se ve');
  assert.match(css, /@media\(max-width:768px\)\{\n  \.gd-filtros-toggle\{display:inline-flex;/);
  assert.match(css, /\.gd-filtros-plegables\.gd-filtros-cerrado > :not\(\.gd-filtros-siempre\)\{display:none !important;\}/);
  assert.match(css, /\.gd-tabla-scroll\{overflow-x:auto;max-width:100%;\}/);
  assert.match(css, /\.gd-tabla-scroll table th:first-child,\.gd-tabla-scroll table td:first-child\{position:sticky;left:0;/);
  assert.match(css, /#gd-modal \.gd-subtab-btn\{min-height:44px;\}/, 'objetivos tactiles de 44 px');
});

test('limpieza: estilos en linea repetidos de los paneles nuevos pasan a clases', () => {
  for (const archivo of ['encuesta.js', 'llamadas-unicas.js', 'whatsapp-tiempos.js', 'salida.js', 'efectividad-citas.js', 'inasistencia.js']) {
    const src = leer('js/' + archivo);
    assert.doesNotMatch(src, /<div style="text-align:center;color:var\(--c-text-muted\);padding:(24|16)px 8px">/, archivo);
    assert.doesNotMatch(src, /<div class="ig" style="(min-width:170px;)?margin-bottom:0">/, archivo);
    assert.doesNotMatch(src, /<div style="overflow-x:auto;margin-top:10px">/, archivo);
    assert.doesNotMatch(src, /<th style="text-align:left">/, archivo);
  }
  assert.doesNotMatch(leer('js/llamadas-unicas.js'), /class="lu-aviso" style=/);
  for (const clase of ['.gd-vacio{', '.gd-vacio-chico{', '.ig.ig-sm{', '.ig.ig-filtro{', '.th-izq{', '.lu-aviso{']) {
    assert.ok(css.includes(clase), clase);
  }
});

test('escala de z-index como tokens: ningun z-index numerico suelto', () => {
  assert.doesNotMatch(css, /z-index:\s*\d/);
  for (const t of ['--z-sticky-col', '--z-sticky-header', '--z-menu-fila', '--z-navbar', '--z-panel', '--z-dialogo', '--z-toast']) {
    assert.match(css, new RegExp(t + ':\\d+;'), t);
  }
  const doc = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'sistema-de-diseno.md'), 'utf8');
  assert.match(doc, /Escala de z-index/);
});

test('el script nuevo se carga antes de dashboard-generic.js', () => {
  const html = leer('index.html');
  const i = (s) => html.indexOf('<script src="js/' + s + '"></script>');
  assert.ok(i('filtros-movil-logic.js') > 0 && i('filtros-movil-logic.js') < i('dashboard-generic.js'));
});
