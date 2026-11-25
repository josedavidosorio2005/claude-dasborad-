// faseEQ4-equidad-estilo-sinco.test.js — Pedido de Edwin (25/11/2026): «Equidad profesionales» con el estilo de la
// plataforma (SinCo), con los colores de paleta.css, como las demás pestañas de ORLANT. Estructura, 3 pestañas,
// cálculos y cifras sin cambios. El cambio va por el generador (scripts/orlant/generar-equidad.js); el HTML de
// Edwin no se edita. Sin datos reales: solo lee los archivos generados.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');
const css = leer('public/css/orlant-equidad-app.css');
const js = leer('public/js/orlant-equidad-app.js');
const gen = leer('scripts/orlant/generar-equidad.js');
const COLOR_FIJO = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-zA-Z])|rgba?\(|hsla?\(/g;

test('ningún color fijo en el CSS ni en el JS generados: todo sale de los tokens de la plataforma', () => {
  assert.deepEqual(css.match(COLOR_FIJO), null, 'CSS');
  assert.deepEqual(js.match(COLOR_FIJO), null, 'JS');
});

test('las variables del HTML de Edwin apuntan a los tokens (paleta.css y los de estado de styles.css)', () => {
  const host = css.slice(0, css.indexOf('}') + 1);
  for (const [v, token] of [['--bg', '--c-bg'], ['--card', '--c-surface'], ['--line', '--c-border'], ['--ink', '--c-text'], ['--muted', '--c-text-muted'],
    ['--title', '--acento-texto'], ['--sky', '--serie-1'], ['--green', '--c-success'], ['--amber', '--c-warning'], ['--red', '--c-danger']]) {
    assert.match(host, new RegExp(v + ':var\\(' + token + '\\);'), v);
  }
  // Pestaña activa, botones y foco con los tokens de paleta.css.
  assert.match(css, /nav\.tabs button\.active\{background:var\(--acento-suave\);border-color:var\(--acento\);color:var\(--acento-texto\)\}/);
  assert.match(css, /\.btn\{background:var\(--btn-secundario-bg\);border:1px solid var\(--btn-secundario-borde\);color:var\(--btn-secundario-fg\)/);
  assert.match(css, /button:focus-visible,select:focus-visible,input:focus-visible\{outline:2px solid var\(--c-focus\)/);
});

test('cada var(--…) usada existe: en paleta.css, en styles.css o en el :host de la Equidad', () => {
  const definidas = new Set();
  for (const f of ['public/css/paleta.css', 'public/css/styles.css', 'public/css/orlant-equidad-app.css']) {
    for (const m of leer(f).matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) definidas.add(m[1]);
  }
  const usadas = new Set([...(css + js).matchAll(/var\((--[a-zA-Z0-9-]+)/g)].map((m) => m[1]));
  usadas.delete('--c'); // variable local de la leyenda (style="--c:…"), definida en el mismo elemento
  const faltan = [...usadas].filter((v) => !definidas.has(v));
  assert.deepEqual(faltan, []);
});

test('SVG con style (var() no sirve en atributos de presentación) y estados con sus tokens de texto', () => {
  assert.doesNotMatch(js, /(fill|stroke)="var\(/);
  assert.doesNotMatch(js, /(fill|stroke)="\$\{/);
  assert.match(js, /'var\(--c-success-text\)':A\.eq>=\.65\?'var\(--c-warning-text\)':'var\(--c-danger-text\)'/);
  assert.match(css, /\.pill\.ok\{background:var\(--c-success-bg\);color:var\(--c-success-text\)\}/);
  assert.match(css, /\.pill\.over\{background:var\(--c-danger-bg\);color:var\(--c-danger-text\)\}/);
  assert.match(css, /\.pill\.under\{background:var\(--c-warning-bg\);color:var\(--c-warning-text\)\}/);
});

test('mapa de calor: serie 1 de la paleta hasta 50 % (texto AA en claro y oscuro) y se desplaza con el teclado', () => {
  assert.match(js, /color-mix\(in srgb, var\(--serie-1\) \$\{Math\.round\(a\*100\)\}%, transparent\)/);
  assert.match(js, /const a=v\?0\.12\+0\.38\*v\/mx:0;/);
  assert.match(js, /<div class="heat" tabindex="0" role="region" aria-label="Mapa de calor: citas por profesional y día \(se desplaza con las flechas\)">/);
});

test('cálculos y estructura sin cambios: mismas funciones, 3 pestañas y sin datos', () => {
  for (const f of ['function analyze(', 'function filtered(', 'function donutHTML(', 'function tableHTML(', 'function chartSVG(', 'function sedesHTML(', 'function heatHTML(']) {
    assert.ok(js.includes(f), f);
  }
  assert.match(js, /\{id:'poliza', grupo:'polizas', name:'Pólizas'/);
  assert.match(js, /\{id:'base2', grupo:'prepagada', name:'Medicina prepagada'/);
  assert.match(js, /\{id:'base3', grupo:'particulares', name:'Particulares'/);
  assert.ok(!/SEED_\w+ = \[[^\]]/.test(js) && !/"sede":/.test(js), 'sin datos');
  // El generador falla si queda un color fijo (así un HTML nuevo de Edwin no cuela colores).
  assert.match(gen, /quedaron colores fijos en el CSS/);
  assert.match(gen, /quedaron colores fijos en el JS/);
});
