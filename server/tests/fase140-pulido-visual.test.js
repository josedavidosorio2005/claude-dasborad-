// fase140-pulido-visual.test.js — Fase 140 (pulido visual, capa aditiva
// al final de styles.css). Cada prueba fija un hallazgo real de las
// capturas locales (seed:demo, claro/oscuro, 1440px y 412px) para que no
// vuelva: controles con la fuente del sistema en vez de Quicksand,
// franja vacia de #gd-kpis, .btn-sm sin fondo propio, la entrada de los
// modulos de bienvenida anulando el :hover, y el retraso escalonado de
// las tarjetas sobreviviendo a los apagados de movimiento.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { request, app } = require('./helpers');

async function css() {
  const res = await request(app).get('/css/styles.css');
  assert.equal(res.status, 200);
  return res.text;
}

test('botones, campos y selects heredan la tipografia de marca (no la del sistema)', async () => {
  const texto = await css();
  assert.match(texto, /button,input,select,textarea,optgroup\{font-family:inherit;\}/);
});

test('#gd-kpis vacio no dibuja una franja entre la cabecera y las pestanas', async () => {
  const texto = await css();
  assert.match(texto, /#gd-kpis:empty\{display:none;\}/);
});

test('.btn-sm sin variante tiene fondo/color propios con tokens del tema, y no pisa a las variantes', async () => {
  const texto = await css();
  const m = texto.match(/\.btn-sm:not\(([^)]*)\)\{([^}]*)\}/);
  assert.ok(m, 'deberia existir la regla base de .btn-sm sin variante');
  for (const v of ['.btn-primary', '.btn-edit', '.btn-delete', '.btn-cancel']) {
    assert.ok(m[1].includes(v), 'la regla base no deberia aplicar a ' + v);
  }
  assert.match(m[2], /background:var\(--c-surface-alt\)/);
  assert.match(m[2], /color:var\(--c-text\)/);
});

test('la entrada de .dash-btn usa fill-mode backwards (con both anularia el levantado de :hover)', async () => {
  const texto = await css();
  const m = texto.match(/\.dash-btn\{animation:([^;}]*)/);
  assert.ok(m, 'deberia existir la animacion de entrada de .dash-btn');
  assert.match(m[1], /\bbackwards\b/);
  assert.ok(!/\bboth\b/.test(m[1]));
});

test('el retraso escalonado de las tarjetas se anula con prefers-reduced-motion y con data-motion="off"', async () => {
  const texto = await css();
  assert.match(texto, /@media \(prefers-reduced-motion: reduce\)\{\s*#gd-panels \.aurora-kpi,#gd-panels \.aurora-card\{transition-delay:0s !important;\}/);
  assert.match(texto, /html\[data-motion="off"\] #gd-panels \.aurora-kpi,html\[data-motion="off"\] #gd-panels \.aurora-card\{transition-delay:0s !important;\}/);
});

test('la entrada escalonada es transicion ligada a .motion-show (no @keyframes): un cambio de filtro no hace parpadear las tarjetas', async () => {
  const texto = await css();
  assert.match(texto, /#gd-panels:not\(\.motion-show\) \.aurora-kpi,#gd-panels:not\(\.motion-show\) \.aurora-card\{opacity:0;transform:translateY\(8px\);\}/);
  assert.ok(!/#gd-panels[^{]*\{[^}]*animation:/.test(texto), '#gd-panels y sus tarjetas no deberian usar animation (se re-dispararia en cada redibujado)');
});

// Fase 152 (B4, con el "OK limpieza atab"): ya no anima "all", solo lo que cambia.
test('.atab anima solo color, fondo y borde (sin transition:all)', async () => {
  const texto = await css();
  const m = texto.match(/\.atab\{([^}]*)\}/);
  assert.ok(m, 'deberia existir la regla .atab');
  assert.doesNotMatch(m[1], /transition:all/);
  assert.match(m[1], /transition:color 0\.2s,background-color 0\.2s,border-color 0\.2s/);
});
