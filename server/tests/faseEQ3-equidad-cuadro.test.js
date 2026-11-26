// faseEQ3-equidad-cuadro.test.js — pedido de Edwin (reunión 26/11/2026): «Equidad profesionales» de ORLANT va dentro
// de un cuadro con su título, igual que las demás pestañas (p. ej. «Gestión de la base STA»). Adentro, la vista de
// siempre (por mes, con sus 3 pestañas). No cambia la carga ni los datos. Sin datos reales.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

global.esc = require('../../public/js/esc.js').esc;
const E = require('../../public/js/orlant-equidad.js');
const JS = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'orlant-equidad.js'), 'utf8');

test('el cuadro lleva el título «Equidad profesionales» y adentro el contenedor de la vista de siempre', () => {
  const h = E.equidadMarcoHtml();
  assert.equal(E.EQ_TITULO, 'Equidad profesionales');
  assert.match(h, /^<section class="aurora-card eq-cuadro" aria-label="Equidad profesionales">/);
  assert.match(h, /<div class="aurora-card-title">Equidad profesionales<\/div>/, 'mismo título que las demás pestañas (aurora-card-title)');
  assert.match(h, /<div class="eq-host"><\/div><\/section>$/, 'adentro, el contenedor donde se monta la vista por mes');
});

test('usa el título del panel si lo trae, escapado; vacío o raro vuelve al de siempre', () => {
  assert.match(E.equidadMarcoHtml('  Equidad profesionales  '), /aurora-card-title">Equidad profesionales</);
  assert.match(E.equidadMarcoHtml('Otro <b>título</b>'), /aurora-card-title">Otro &lt;b&gt;título&lt;\/b&gt;</);
  for (const v of [undefined, null, '', '   ', 5]) assert.match(E.equidadMarcoHtml(v), /aurora-card-title">Equidad profesionales</, String(v));
});

test('el panel monta la vista de Edwin DENTRO del cuadro (no en lugar de él); la carga y los datos no cambian', () => {
  const cuerpo = JS.slice(JS.indexOf('async function _equidadRenderPanel'), JS.indexOf('// «Exportar»'));
  assert.match(cuerpo, /host\.innerHTML = equidadMarcoHtml\(p && p\.titulo\);/);
  assert.match(cuerpo, /var cont = host\.querySelector\('\.eq-host'\);/);
  assert.match(cuerpo, /cont\.attachShadow\(\{ mode: 'open' \}\)/);
  // Lo mismo de antes para leer los datos (una sola ruta, sin cambios).
  assert.match(JS, /apiRequest\('GET', '\/orlant\/equidad\/estado'\)/);
});
