// faseQA-bajos-tactiles.test.js — auditoría del 24/11, hallazgos BAJOS que quedaban: objetivos táctiles de 44 px
// en ≤768 px (docs/sistema-de-diseno.md). Sin datos.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..', '..');
const leer = (r) => fs.readFileSync(path.join(RAIZ, r), 'utf8');

test('Talento humano: pestañas y botones de 44 px en el celular, añadido por su generador (el HTML de Edwin no cambia)', () => {
  const css = leer('public/gestion-humana/talento-humano.css');
  const i = css.indexOf('/* SinCo (auditoría 24/11): objetivos táctiles de 44 px en el celular. */');
  assert.ok(i > 0, 'bloque al final de su hoja');
  const b = css.slice(i);
  assert.match(b, /@media \(max-width:768px\)\{/);
  assert.match(b, /\.tabs button,\.ptabs button\{display:inline-flex;align-items:center;min-height:44px;/);
  assert.match(b, /\.btn,\.filters input,\.filters select,select\.btn\{min-height:44px;/);
  assert.match(b, /\.btn\.sm,\.btn\.ic\{min-width:44px;/);
  const gen = leer('scripts/gestion-humana/generar-talento-humano.js');
  assert.match(gen, /'talento-humano\.css'\), css\.trim\(\) \+ '\\n' \+ CSS_TACTIL\.trim\(\)/, 'lo escribe el generador');
});

test('Malla: «+ Agregar novedad», «Horario especial», «Quitar todas las semanas» y la «×» de 44 px en ≤768 px', () => {
  const css = leer('public/css/styles.css');
  const b = css.slice(css.indexOf('/* Auditoría del 24/11 (bajos): objetivos táctiles de 44 px en ≤768 px. Malla'));
  assert.match(b, /@media \(max-width: 768px\)\{\n  \.modal-malla \.ml-btn-sm,\.modal-malla \.ml-rep-quitar\{min-height:44px;/);
  assert.match(b, /\.modal-malla \.ml-chip-x\{min-width:44px;min-height:44px\}/);
  assert.ok(!/transition|animation|rgba?\(/.test(b), 'sin animaciones ni colores sueltos');
});
