// faseINV1-inventario-oscuro.test.js — Fase INV1 (pedido de Edwin, 26/11/2026): el Inventario de sistemas va siempre
// en tema oscuro, como su HTML, SOLO dentro de su ventana (#activos-overlay). No copia colores: #activos-overlay se
// suma al selector de cada bloque :root[data-theme="dark"] de SinCo, así un cambio allá llega solo al Inventario.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const leer = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'css', f), 'utf8');
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
// El bloque del Inventario: desde su comentario hasta el siguiente comentario de fase.
const bloqueInv = (s) => { const i = s.indexOf('/* Fase INV1'); assert.ok(i >= 0); const f = s.indexOf('/* Fase', i + 5); return sinComentarios(s.slice(i, f < 0 ? undefined : f)); };

test('cada bloque de tokens del tema oscuro también aplica a la ventana del Inventario', () => {
  for (const f of ['paleta.css', 'styles.css']) {
    const css = sinComentarios(leer(f));
    const bloques = [...css.matchAll(/(^|\n)([^{}\n]*):root\[data-theme="dark"\]\{/g)];
    assert.ok(bloques.length >= 1, f);
    for (const m of bloques) assert.equal(m[2], '#activos-overlay,', `${f}: ${m[0].trim()}`);
  }
});

test('sin colores copiados: el bloque del Inventario no escribe tokens ni colores', () => {
  const styles = leer('styles.css');
  const resto = bloqueInv(styles);
  assert.doesNotMatch(resto, /--[a-z0-9-]+\s*:/i);
  assert.doesNotMatch(resto, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(resto, /rgba?\(/i);
});

test('solo dentro de la ventana del Inventario: ningún otro selector nuevo ni :root', () => {
  const styles = leer('styles.css');
  const resto = bloqueInv(styles);
  const selectores = [...resto.matchAll(/(^|\n)([^{}\n][^{}]*)\{/g)].map((m) => m[2].trim());
  assert.deepEqual(selectores, ['#activos-overlay', '#activos-overlay > .modal']);
});
