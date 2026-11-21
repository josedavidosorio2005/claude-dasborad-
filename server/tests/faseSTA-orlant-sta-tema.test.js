// faseSTA-orlant-sta-tema.test.js — Fase STA (prueba local del 21/11): «Gestión STA» sigue el tema
// oscuro de la plataforma y cumple contraste AA (docs/sistema-de-diseno.md). El CSS y el JS los arma
// scripts/orlant/generar-sta.js desde el HTML de Edwin; esta prueba mira lo publicado.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const css = fs.readFileSync(path.join(REPO, 'public/css/orlant-sta-app.css'), 'utf8');
const js = fs.readFileSync(path.join(REPO, 'public/js/orlant-sta-app.js'), 'utf8');
const estilos = fs.readFileSync(path.join(REPO, 'public/css/styles.css'), 'utf8');

const lum = (hex) => {
  const v = hex.replace('#', '').match(/../g).map((x) => parseInt(x, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// valor de un token de la plataforma en claro (:root) o en oscuro (bloque data-theme="dark")
function token(nombre, oscuro) {
  const i = oscuro ? estilos.indexOf(':root[data-theme="dark"]') : estilos.indexOf(':root');
  const m = estilos.slice(i).match(new RegExp(nombre.replace(/-/g, '\\-') + '\\s*:\\s*(#[0-9a-fA-F]{6})'));
  assert.ok(m, 'token ' + nombre + (oscuro ? ' (oscuro)' : ''));
  return m[1];
};

test('sin fondos blancos ni textos fijos de Edwin: todo pasa por variables del tema', () => {
  assert.doesNotMatch(css, /background:#fff[;}]/, 'fondos blancos → var(--card)');
  assert.doesNotMatch(css, /[^,(]color:var\(--teal\)/, 'títulos teal → var(--sta-titulo, …)');
  for (const fijo of ['fill="#f2f5f7"', 'fill:#003C50', 'fill:#6b7c86', 'stroke="#fff" stroke-width="2"']) assert.ok(!js.includes(fijo), 'JS sin ' + fijo);
  assert.match(css, /:host\(\[data-theme="dark"\]\)\{[^}]*--card:var\(--c-surface\)[^}]*--txt:var\(--c-text\)/);
  // cada variable que se usa con respaldo tiene su valor en el bloque oscuro
  const usadas = new Set([...css.matchAll(/var\((--sta-[a-z0-9-]+),/g)].map((m) => m[1]).concat([...js.matchAll(/var\((--sta-[a-z0-9-]+),/g)].map((m) => m[1])));
  const oscuro = css.slice(css.indexOf(':host([data-theme="dark"]){'));
  for (const v of usadas) assert.ok(oscuro.includes(v + ':'), v + ' definida en oscuro');
});

test('contraste AA en claro (colores propios de la herramienta)', () => {
  const pares = [
    ['texto gris sobre tarjeta', token('--c-text-muted'), '#ffffff'],
    ['texto gris sobre fondo', token('--c-text-muted'), '#f3f6f8'],
    ['texto gris sobre tarjeta verde', token('--c-text-muted'), '#eaf6e6'],
    ['botón azul', '#ffffff', '#1f6c9c'], ['botón verde', '#ffffff', '#2e7d32'], ['pastilla verde', '#ffffff', '#2e7d32'],
    ['etiqueta azul', '#1a5c86', '#e6f2fa'], ['etiqueta verde', '#2e6a1d', '#e8f4e2'], ['etiqueta ámbar', '#7d520c', '#fbf0dc'],
    ['botón peligro', token('--c-danger-text'), '#ffffff'],
  ];
  for (const [q, fg, bg] of pares) assert.ok(ratio(fg, bg) >= 4.5, `${q}: ${ratio(fg, bg).toFixed(2)}`);
  for (const usado of ['--btn-pri:#1f6c9c', '--btn-ok:#2e7d32', '.tag{color:#1a5c86}', '.tag.v{color:#2e6a1d}', '.tag.a{color:#7d520c}', '.pill{background:#2e7d32}', '--muted:var(--c-text-muted']) assert.ok(css.includes(usado), usado);
});

test('contraste AA en oscuro (tokens de la plataforma)', () => {
  const fondo = token('--c-bg', true), tarjeta = token('--c-surface', true), sel = token('--c-hover-bg', true);
  for (const [q, fg] of [['texto', token('--c-text', true)], ['texto secundario (--muted)', token('--c-text-2', true)], ['peligro', token('--c-danger-text', true)], ['enlace', token('--c-text-link', true)]]) {
    for (const [d, bg] of [['fondo', fondo], ['tarjeta', tarjeta], ['seleccionado', sel]]) assert.ok(ratio(fg, bg) >= 4.5, `${q} sobre ${d}: ${ratio(fg, bg).toFixed(2)}`);
  }
});
