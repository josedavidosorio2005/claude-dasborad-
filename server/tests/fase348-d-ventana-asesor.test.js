// fase348-d-ventana-asesor.test.js — Fase 348, punto D (reunion con Edwin del 12/11): la ventana
// del panel de Calidad del dashboard (Detalle por mes / Resumen por asesor / detalle de un
// monitoreo / Diccionario) tiene una X arriba a la derecha y se cierra con clic afuera y con
// Escape. Antes, en el detalle de un monitoreo abierto desde la lista, Escape y el clic afuera
// volvian a la lista en vez de cerrar; ahora eso lo hace solo el boton de abajo («Volver a la lista»).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');
const js = PUB('js/calidad-panel.js');

test('D: la ventana tiene la X arriba a la derecha, con nombre accesible', () => {
  assert.match(js, /<div class="cmp-dlg-cab"><h3 id="cmp-ov-t"><\/h3>' \+\s*'<button type="button" class="cmp-x" aria-label="Cerrar" title="Cerrar \(Esc\)" onclick="_cmpCerrarTodo\(\)">/);
});

test('D: X, clic afuera y Escape cierran del todo; el boton de abajo vuelve a la lista si hay a donde', () => {
  assert.match(js, /ov\.addEventListener\('click', function \(e\) \{ if \(e\.target === ov\) _cmpCerrarTodo\(\); \}\);/);
  assert.match(js, /e\.key === 'Escape' && ov && !ov\.hidden\) \{ e\.stopPropagation\(\); _cmpCerrarTodo\(\); \}/);
  const f = js.slice(js.indexOf('function _cmpCerrarTodo'));
  assert.match(f.slice(0, f.indexOf('\n}')), /_cmpVolverA = null;/);
  assert.match(js, /id="cmp-ov-abajo" onclick="_cmpCerrar\(\)"/);
  assert.match(js, /abajo\.textContent = _cmpVolverA \? 'Volver a la lista' : 'Cerrar';/);
});

test('D: la cabecera queda pegada arriba (la X se ve al bajar) y la X mide 44 px en movil', () => {
  const css = PUB('css/styles.css');
  assert.match(css, /\.cmp-dlg-cab\{position:sticky;top:-20px;z-index:var\(--z-sticky-header\)/);
  assert.match(css, /@media \(max-width:768px\)\{\.cmp-x\{width:44px;height:44px\}\}/);
  const bloque = css.slice(css.indexOf('/* Fase 348 (D)'), css.indexOf('@media (max-width:768px){.cmp-x'));
  assert.doesNotMatch(bloque, /#[0-9a-f]{3,8}\b/i, 'sin colores escritos');
});
