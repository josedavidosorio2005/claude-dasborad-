// fase164-tablas-teclado.test.js — Fase 164 (lote 2, D-10): las tablas con
// scroll horizontal propio (.gd-tabla-scroll del tablero y la vista previa
// del Centro de cargas) se alcanzan con el teclado y se anuncian con el
// nombre de su tabla (axe: scrollable-region-focusable).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const f = require('../../public/js/filtros-movil-logic.js');

const PUB = path.join(__dirname, '..', '..', 'public');
const leer = (r) => fs.readFileSync(path.join(PUB, r), 'utf8');

test('gdAtributosTablaScroll: enfocable, region y nombre de la tabla', () => {
  assert.equal(typeof f.gdAtributosTablaScroll, 'function');
  assert.deepEqual(f.gdAtributosTablaScroll('Inasistencia por mes'),
    { tabindex: '0', role: 'region', 'aria-label': 'Tabla: Inasistencia por mes' });
  assert.equal(f.gdAtributosTablaScroll('  Llamadas\n   de salida ')['aria-label'], 'Tabla: Llamadas de salida');
  assert.equal(f.gdAtributosTablaScroll('')['aria-label'], 'Tabla');
  assert.equal(f.gdAtributosTablaScroll(null)['aria-label'], 'Tabla');
});

test('gdAtributosTablaScroll: sin titulo usa la primera cabecera; dos tablas del mismo cuadro no comparten nombre', () => {
  assert.equal(f.gdAtributosTablaScroll('', 'Codificación')['aria-label'], 'Tabla: Codificación');
  const usados = ['Tabla: Llamadas de salida'];
  assert.equal(f.gdAtributosTablaScroll('Llamadas de salida', 'Asesor', [])['aria-label'], 'Tabla: Llamadas de salida');
  assert.equal(f.gdAtributosTablaScroll('Llamadas de salida', 'Día', usados)['aria-label'], 'Tabla: Llamadas de salida (Día)');
  assert.equal(f.gdAtributosTablaScroll('Llamadas de salida', '', usados)['aria-label'], 'Tabla: Llamadas de salida 2');
  assert.equal(f.gdAtributosTablaScroll('', '', ['Tabla'])['aria-label'], 'Tabla 2');
});

test('el tablero aplica los atributos a TODO contenedor con scroll, tambien a los que ya traen .gd-tabla-scroll', () => {
  const gd = leer('js/dashboard-generic.js');
  const ini = gd.indexOf('function _gdEnvolverTablas(');
  const cuerpo = gd.slice(ini, gd.indexOf('\n}\n', ini));
  assert.doesNotMatch(cuerpo, /contains\('gd-tabla-scroll'\)\) return;/,
    'antes los contenedores que ya eran .gd-tabla-scroll (Salida, Inasistencia, Efectividad) se saltaban');
  assert.match(cuerpo, /_gdTablaScrollAccesible\(cont\)/);
  const ini2 = gd.indexOf('function _gdTablaScrollAccesible(');
  assert.ok(ini2 > 0);
  const acc = gd.slice(ini2, gd.indexOf('\n}\n', ini2));
  assert.match(acc, /gdAtributosTablaScroll\(titulo, th \? th\.textContent : '', usados\)/);
  assert.match(acc, /\.gd-help/, 'el "?" de ayuda no entra en el nombre de la tabla');
});

test('la vista previa del Centro de cargas es enfocable', () => {
  const html = leer('index.html');
  assert.match(html, /<div style="overflow-x:auto" tabindex="0" role="region" aria-label="Tabla: vista previa del archivo"><table class="aurora-rank-table" id="carga-preview-table">/);
});

test('el contenedor enfocable tiene anillo de foco visible ([tabindex]:focus-visible)', () => {
  assert.match(leer('css/styles.css'), /\[tabindex\]:focus-visible/);
});
