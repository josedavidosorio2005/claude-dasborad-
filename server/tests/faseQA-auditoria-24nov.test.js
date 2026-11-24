// faseQA-auditoria-24nov.test.js — Auditoría de diseño y bugs del 24/11 (local, datos inventados).
// Cada arreglo de prioridad alta o media tiene su prueba aquí.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const CSS = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'css', 'styles.css'), 'utf8');
const regla = (sel) => { const i = CSS.indexOf(sel + '{'); assert.ok(i >= 0, 'falta la regla ' + sel); return CSS.slice(i, CSS.indexOf('}', i)); };
// Contraste WCAG entre dos colores #rrggbb.
function contraste(a, b) {
  const l = (h) => { const [r, g, bl] = [1, 3, 5].map((i) => { const x = parseInt(h.slice(i, i + 2), 16) / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const [x, y] = [l(a), l(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05);
}
// Valor de un token en claro (primer :root) y en oscuro (:root[data-theme="dark"]).
function token(nombre, oscuro) {
  const ini = oscuro ? CSS.indexOf(':root[data-theme="dark"]') : CSS.indexOf(':root');
  const bloque = CSS.slice(ini, CSS.indexOf('\n}', ini));
  const m = bloque.match(new RegExp('--' + nombre + ':\\s*#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\\b'));
  if (m) return '#' + (m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1]).toLowerCase();
  assert.ok(oscuro, 'token ' + nombre);
  return token(nombre, false); // no cambia en oscuro
}

test('Inventario: títulos de las gráficas y menú seleccionado con contraste AA en claro y oscuro', () => {
  assert.match(regla('.acp-card h4'), /color:var\(--c-primary\)/, 'no --c-brand-blue como texto (sistema de diseño)');
  assert.match(regla('.ac-menu-btn[aria-current="page"]'), /background:var\(--c-brand\);color:var\(--c-on-brand\)/);
  for (const oscuro of [false, true]) {
    assert.ok(contraste(token('c-primary', oscuro), token('c-surface', oscuro)) >= 4.5, 'título sobre la tarjeta, oscuro=' + oscuro);
    assert.ok(contraste(token('c-brand', oscuro), token('c-on-brand', oscuro)) >= 4.5, 'menú seleccionado, oscuro=' + oscuro);
  }
});
