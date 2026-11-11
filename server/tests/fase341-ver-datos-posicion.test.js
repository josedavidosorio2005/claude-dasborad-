// fase341-ver-datos-posicion.test.js — Fase 341 (11/11): el boton «Ver datos» va siempre debajo de la
// grafica Y de su leyenda, a la derecha. Antes, en «Monitoreos por clasificación» quedaba entre la torta y
// su leyenda (misma fila flex) y en «Calificación definitiva por asesor» quedaba encima de la banda de
// colores. Se prueba la funcion real de dashboard-generic.js con un DOM minimo.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'dashboard-generic.js'), 'utf8');
const ctx = {};
vm.createContext(ctx);
const ini = SRC.indexOf('var GD_VER_DATOS_CONTENEDOR');
const fin = SRC.indexOf('function _gdVerDatosBoton(');
assert.ok(ini > 0 && fin > ini, 'la logica de la posicion esta antes de _gdVerDatosBoton');
vm.runInContext(SRC.slice(ini, fin), ctx);

// Nodo minimo: clases, padre, hermanos y matches() con selectores de clase separados por coma.
function nodo(clase, hijos) {
  const n = { clase, hijos: hijos || [], parentElement: null, nextElementSibling: null,
    matches(sel) { return sel.split(',').some((s) => this.clase.split(' ').includes(s.trim().replace(/^\./, ''))); } };
  n.hijos.forEach((h, i) => { h.parentElement = n; h.nextElementSibling = n.hijos[i + 1] || null; });
  return n;
}

test('torta con la leyenda al lado: el boton va despues de la fila completa (no entre torta y leyenda)', () => {
  const wrap = nodo('aurora-chart-wrap cmp-chart-pie');
  const fila = nodo('cmp-torta', [wrap, nodo('cmp-pie-leg')]);
  nodo('aurora-card', [nodo('cmp-sub'), fila]);
  assert.equal(ctx._gdVerDatosAncla(wrap), fila);
});

test('banda de colores debajo de la grafica: el boton va despues de la banda', () => {
  const wrap = nodo('aurora-chart-wrap cmp-chart-as');
  const banda = nodo('cmp-banda');
  nodo('aurora-card', [wrap, banda]);
  assert.equal(ctx._gdVerDatosAncla(wrap), banda);
});

test('grafica normal (o seguida de una tabla): igual que antes, el boton va justo despues de la grafica', () => {
  const wrap = nodo('aurora-chart-wrap');
  nodo('aurora-card', [wrap, nodo('gd-tabla')]);
  assert.equal(ctx._gdVerDatosAncla(wrap), wrap);
  const solo = nodo('aurora-chart-wrap');
  nodo('aurora-card', [solo]);
  assert.equal(ctx._gdVerDatosAncla(solo), solo);
});

test('_gdVerDatosBoton usa la ancla y busca el boton existente junto a ella (no lo duplica al repintar)', () => {
  const cuerpo = SRC.slice(fin, SRC.indexOf('function abrirVerDatos('));
  assert.match(cuerpo, /wrap = _gdVerDatosAncla\(wrap\);\n\s+var btn = wrap\.parentElement\.querySelector\('\.btn-ver-datos\[data-canvas="' \+ canvasId \+ '"\]'\);/);
  assert.match(cuerpo, /wrap\.insertAdjacentElement\('afterend', btn\);/);
});
