// faseINV1-volver.test.js — Fase INV1 (pedido de Edwin, 26/11/2026): desde la vista «Inventario» hay un botón para
// volver a la pantalla de antes (como su HTML, que recuerda de dónde se entró). Sin pantalla anterior, no aparece.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

global.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const UI = require(path.join(__dirname, '..', '..', 'public', 'js', 'activos.js'));
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'activos.js'), 'utf8');

test('el botón vuelve a la pantalla de antes, con su nombre', () => {
  const html = UI.activosVolverHtml('agentes');
  assert.match(html, /^<button type="button" class="ac-volver" onclick="activosTab\('agentes'\)">← Volver a /);
  assert.ok(html.includes(esc('Agentes')) || /Volver a [^<]+<\/button>$/.test(html));
});

test('sin pantalla anterior, desde el mismo Inventario o con una vista desconocida: sin botón', () => {
  for (const p of [undefined, null, '', 'elementos', "x');alert(1);('"]) assert.equal(UI.activosVolverHtml(p), '', String(p));
});

test('activosTab recuerda la pantalla de antes solo al entrar al Inventario y pinta el botón en su cabecera', () => {
  assert.match(SRC, /if \(tab === 'elementos' && _ac\.tab && _ac\.tab !== 'elementos'\) _ac\.prev = _ac\.tab;/);
  assert.match(SRC, /\+ \(tab === 'elementos' \? activosVolverHtml\(_ac\.prev\) : ''\);/);
});
