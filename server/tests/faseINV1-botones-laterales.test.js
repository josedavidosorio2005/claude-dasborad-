// faseINV1-botones-laterales.test.js — Fase INV1 (HTML de Edwin): botones laterales «Menú» e «Inicio» y el botón
// flotante «Inventario», SOLO dentro de la ventana del Inventario (#activos-overlay). «Menú» muestra u oculta el
// menú; «Inicio» cierra el Inventario y vuelve a SinCo; «Inventario» abre la vista Inventario o, si ya está
// abierta, vuelve a la pantalla de antes.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

global.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const RAIZ = path.join(__dirname, '..', '..', 'public');
const UI = require(path.join(RAIZ, 'js', 'activos.js'));
const SRC = fs.readFileSync(path.join(RAIZ, 'js', 'activos.js'), 'utf8');
const HTML = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const CSS = fs.readFileSync(path.join(RAIZ, 'css', 'styles.css'), 'utf8');

// La ventana del Inventario completa (desde su apertura hasta el comentario siguiente).
const ventana = HTML.slice(HTML.indexOf('id="activos-overlay"'), HTML.indexOf('<!-- Fase 356'));

test('los tres botones viven dentro de la ventana del Inventario y en ningún otro lado', () => {
  for (const id of ['ac-rail-menu', 'ac-rail-inicio', 'ac-rail-inv']) {
    assert.ok(ventana.includes('id="' + id + '"'), id);
    assert.equal(HTML.split('id="' + id + '"').length, 2, id + ' una sola vez');
  }
  // después del .modal: el foco inicial sigue siendo la ventana
  assert.ok(ventana.indexOf('<!-- .ac-layout -->') < ventana.indexOf('class="ac-rail ac-rail-izq"'));
  assert.match(ventana, /id="ac-rail-menu" aria-controls="ac-menu" aria-expanded="true" onclick="activosAlternarMenu\(\)"/);
  assert.match(ventana, /id="ac-rail-inicio" onclick="activosCerrar\(\)"/);
  assert.match(ventana, /id="ac-rail-inv" aria-pressed="false" onclick="activosAlternarInventario\(\)"/);
  for (const t of ['Menú', 'Inicio', 'Inventario']) assert.ok(ventana.includes('<span>' + t + '</span>'), t);
});

test('el botón flotante abre el Inventario y, desde allí, vuelve a la pantalla de antes', () => {
  assert.equal(UI.activosDestinoFab('panel', null), 'elementos');
  assert.equal(UI.activosDestinoFab('agentes', 'panel'), 'elementos');
  assert.equal(UI.activosDestinoFab('elementos', 'agentes'), 'agentes');
  assert.equal(UI.activosDestinoFab('elementos', null), 'panel');
  assert.equal(UI.activosDestinoFab('elementos', 'elementos'), 'panel');
  assert.equal(UI.activosDestinoFab('elementos', "x');alert(1);('"), 'panel');
});

test('activosTab marca el botón flotante; al abrir, el menú arranca visible y sin pantalla anterior', () => {
  assert.match(SRC, /_acRefrescarMenu\(\);\n  _acPintarFab\(\);/);
  assert.match(SRC, /openModal\('activos-overlay'\);\n  activosAlternarMenu\(true\);[^\n]*\n  _ac\.prev = null;/);
  assert.match(SRC, /lay\.classList\.toggle\('ac-sin-menu', !ver\)/);
  assert.match(SRC, /b\.setAttribute\('aria-expanded', String\(ver\)\)/);
});

test('estilos: solo dentro de #activos-overlay, solo tokens y objetivos de 44 px', () => {
  const i = CSS.indexOf('/* Fase INV1b');
  assert.ok(i >= 0);
  const bloque = CSS.slice(i, CSS.indexOf('/* Fase', i + 5)).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(bloque, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(bloque, /rgba?\(/i);
  assert.match(bloque, /\.ac-rail-btn\{[^}]*min-width:44px;min-height:44px/);
  const selectores = [...bloque.matchAll(/(^|\n)\s*([^{}\n@][^{}]*)\{/g)].map((m) => m[2].trim());
  for (const s of selectores) for (const p of s.split(',')) assert.match(p.trim(), /^(#activos-overlay|\.ac-)/, p);
  // «Ocultar el menú» solo dentro de la ventana
  assert.match(bloque, /\.ac-sin-menu > \.ac-menu\{display:none\}/);
});
