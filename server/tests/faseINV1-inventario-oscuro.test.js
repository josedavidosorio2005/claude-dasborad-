// faseINV1-inventario-oscuro.test.js — Fase INV1 (pedido de Edwin, 26/11/2026): el Inventario de sistemas va siempre
// en tema oscuro, como su HTML, SOLO dentro de su ventana (#activos-overlay). Los tokens son los del tema oscuro de
// SinCo: si alguien cambia uno allá, esta prueba avisa para cambiarlo también aquí. El resto de SinCo no cambia.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const leer = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'css', f), 'utf8');
const tokens = (txt) => txt.replace(/\/\*[\s\S]*?\*\//g, '').split(';').map((x) => x.trim()).filter((x) => x.startsWith('--'));
const bloque = (s, sel) => { const i = s.indexOf(sel); assert.ok(i >= 0, sel); return s.slice(s.indexOf('{', i) + 1, s.indexOf('\n}', i)); };

test('el Inventario usa exactamente los tokens del tema oscuro de SinCo', () => {
  const styles = leer('styles.css');
  const oscuro = [...tokens(bloque(leer('paleta.css'), ':root[data-theme="dark"]{')), ...tokens(bloque(styles, ':root[data-theme="dark"]{'))];
  const inv = tokens(bloque(styles, '\n#activos-overlay{color-scheme:dark;'));
  assert.ok(oscuro.length > 50);
  assert.deepEqual(inv, oscuro);
});

test('solo dentro de la ventana del Inventario: ningún otro selector nuevo ni :root', () => {
  const styles = leer('styles.css');
  const i = styles.indexOf('/* Fase INV1');
  const resto = styles.slice(i).replace(/\/\*[\s\S]*?\*\//g, '');
  const selectores = [...resto.matchAll(/(^|\n)([^{}\n][^{}]*)\{/g)].map((m) => m[2].trim());
  assert.deepEqual(selectores, ['#activos-overlay', '#activos-overlay > .modal']);
});
