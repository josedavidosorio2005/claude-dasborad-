// faseINV1-menu-usuario.test.js — Fase INV1 (pedido de Edwin, 26/11/2026): al pie del menú del Inventario va el usuario
// de la sesión («Usuario: …», como en su HTML). Escapado; sin usuario, no se pinta. Nombres INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

global.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const UI = require(path.join(__dirname, '..', '..', 'public', 'js', 'activos.js'));

test('pie del menú con el usuario de la sesión, escapado', () => {
  const html = UI.activosMenuHtml('sistemas', 'panel', null, 'USUARIA INVENTADA <b>');
  assert.match(html, /<p class="ac-menu-pie">Usuario: <b>USUARIA INVENTADA &lt;b&gt;<\/b><\/p>$/);
});

test('sin usuario no hay pie, y el resto del menú no cambia', () => {
  const sin = UI.activosMenuHtml('sistemas', 'panel', null);
  assert.doesNotMatch(sin, /ac-menu-pie/);
  assert.equal(UI.activosMenuHtml('sistemas', 'panel', null, 'X').replace(/<p class="ac-menu-pie">.*$/, ''), sin);
});

test('el menú se pinta con el nombre de currentUser', () => {
  const src = require('fs').readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'activos.js'), 'utf8');
  assert.match(src, /activosMenuHtml\(_ac\.ambito, _ac\.tab, _ac\.resumen, typeof currentUser !== 'undefined' && currentUser \? currentUser\.nombre \|\| currentUser\.user : '', _ac\.plegadas\)/);
});
