// fase164-titulos.test.js — Fase 164 (lote 2, D-11): los titulos de cada
// grafica son <h3>, justo debajo del <h2> del tablero (#gd-title), sin
// saltar de nivel (axe: heading-order). Se ven igual: el tamaño, el peso y el
// margen salen de la clase .gd-grafica-titulo, no de la etiqueta.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const S = require('../../public/js/secciones-logic.js');

const PUB = path.join(__dirname, '..', '..', 'public');
const leer = (r) => fs.readFileSync(path.join(PUB, r), 'utf8');

test('gdGraficaHtml pinta el titulo como <h3>', () => {
  assert.match(S.gdGraficaHtml('Llamadas por mes', '<canvas></canvas>'), /^<section class="gd-grafica"><h3 class="gd-grafica-titulo">Llamadas por mes<\/h3>/);
});

test('ningun modulo del tablero pinta un titulo de grafica como <h4>', () => {
  const js = fs.readdirSync(path.join(PUB, 'js')).filter((f) => f.endsWith('.js'));
  for (const f of js) assert.doesNotMatch(leer('js/' + f), /<h4 class="gd-grafica-titulo"/, f);
});

test('el tablero tiene su <h2> y el titulo de grafica no depende de la etiqueta para verse', () => {
  assert.match(leer('index.html'), /<h2 id="gd-title">/);
  assert.match(leer('css/styles.css'), /\.gd-grafica-titulo\{ margin:0 0 var\(--space-3\); font-size:var\(--fs-body\); font-weight:var\(--fw-semibold\);/);
});
