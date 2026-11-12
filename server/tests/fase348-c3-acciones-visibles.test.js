// fase348-c3-acciones-visibles.test.js — Fase 348, punto C3 (reunion con Edwin del 12/11): la
// columna de acciones de las listas del Modulo de Calidad (Editar, Cambiar fecha, Eliminar en
// Monitoreos; Calificar en Calidad de encuestas › Pendientes) queda fija a la derecha de la tabla,
// sin depender del scroll horizontal (con mouse no se veia en ORLANT). Solo CSS y marcas de clase.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');

test('C3: la celda y el encabezado de acciones llevan cl-acc en Monitoreos y Pendientes', () => {
  const cal = PUB('js/calidad.js');
  assert.match(cal, /<th class="cl-acc"><span class="sr-only">Acciones<\/span><\/th>/);
  assert.match(cal, /<td class="cal-acciones cl-acc"><div class="cl-acc-btns">/);
  const cen = PUB('js/calidad-encuestas.js');
  assert.match(cen, /<th class="cl-acc"><span class="sr-only">Acción<\/span><\/th>/);
  assert.match(cen, /'<td class="cl-acc">' \+ accion/);
});

test('C3: la columna queda pegada a la derecha con fondo opaco (de los tokens, sin colores nuevos)', () => {
  const css = PUB('css/styles.css');
  const bloque = css.slice(css.indexOf('/* Fase 348 (C3)'));
  assert.match(bloque, /\.aurora-rank-table th\.cl-acc,\.aurora-rank-table td\.cl-acc\{position:sticky;right:0;z-index:var\(--z-sticky-col\)/);
  assert.match(bloque, /td\.cl-acc\{background:var\(--c-surface\)\}/);
  assert.match(bloque, /tr:nth-child\(even\) td\.cl-acc\{background:var\(--c-surface-subtle\)\}/);
  assert.match(bloque, /th\.cl-acc\{background:var\(--c-brand\)\}/);
  assert.doesNotMatch(bloque.split('\n').slice(0, 12).join('\n'), /#[0-9a-f]{3,8}\b/i, 'sin colores escritos');
});
