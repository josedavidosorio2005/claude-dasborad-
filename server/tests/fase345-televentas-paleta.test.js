// fase345-televentas-paleta.test.js — Fase 345 (PR 2): Televentas SURA con la paleta de la
// plataforma, aplicada DESDE AFUERA (sura-televentas-paleta-logic.js), sin tocar el tablero que sale
// del HTML del supervisor. Los estados (barra de avance g/y/r, lotes A/B/C) no cambian.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const L = require('../../public/js/sura-televentas-paleta-logic.js');
const PAL = require('./helpers-paleta');

const RAIZ = path.join(__dirname, '..', '..');
const PUB = (f) => fs.readFileSync(path.join(RAIZ, 'public', f), 'utf8');
const APP = PUB('js/sura-televentas-app.js');
const CSS = L.stvPaletaCss();

test('cada color de serie del tablero tiene su serie de la plataforma, y todos existen en paleta.css', () => {
  const pal = APP.match(/const PAL=\[([^\]]+)\]/)[1].split(',').map((s) => s.replace(/"/g, '').trim().toLowerCase());
  assert.deepEqual(pal.map((h) => L.STV_SERIE_POR_HEX[h]), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'PAL en el orden de la paleta');
  for (const n of Object.values(L.STV_SERIE_POR_HEX).concat(Object.values(L.STV_ACENTO_POR_HEX))) assert.ok(PAL.claro.tokens['serie-' + n] && PAL.oscuro.tokens['serie-' + n], 'serie-' + n);
  for (const n of Object.values(L.STV_TEXTO_POR_HEX)) assert.ok(PAL.claro.tokens['serie-texto-' + n], 'serie-texto-' + n);
  // Los acentos decorativos usan solo los 6 tonos base (nunca una variante oscura).
  assert.ok(Object.values(L.STV_ACENTO_POR_HEX).every((n) => n >= 1 && n <= 6));
  // Ninguna grafica de «Meta vs. produccion» repite color.
  const meta = ['#e5833b', '#8b5cf6', '#3b82f6', '#12a37f'].map((h) => L.STV_SERIE_POR_HEX[h]);
  assert.equal(new Set(meta).size, 4);
});

test('la capa cambia rellenos, trazos, leyendas, barras, acentos y textos de la grafica por la paleta', () => {
  assert.match(CSS, /\[fill="#1f6feb" i\]\{fill:var\(--serie-1\)\}/);
  assert.match(CSS, /\[stroke="#3b82f6" i\]\{stroke:var\(--serie-4\)\}/);
  assert.match(CSS, /\.lg i\[style\*="background:#12a37f" i\]\{background:var\(--serie-2\)!important\}/);
  assert.match(CSS, /i\[style\*="background:#c9a227" i\]\{background:var\(--serie-6\)!important\}/);
  assert.match(CSS, /\[style\*="--fc:#2aa6c9" i\]\{--fc:var\(--serie-4\)!important\}/);
  assert.match(CSS, /\[style\*="fill:#e5833b" i\]\{fill:var\(--serie-texto-3\)!important\}/);
  assert.match(CSS, /:host\{--ac:var\(--btn-primario-bg\)!important;/, 'fondo con letra blanca = teal de marca');
  assert.match(CSS, /\.seg \.btn\.on,\.fx \.seg \.btn\.on\{background:var\(--btn-primario-bg\)!important/);
});

test('los ESTADOS no cambian: barra de avance g/y/r y lotes A/B/C de #ialotes', () => {
  const reglas = CSS.split('\n');
  for (const h of L.STV_ESTADO_HEX) {
    // Solo se cambian las leyendas (.lg) y las barras con borde redondeado de 4 px; la barra de avance no.
    assert.ok(!reglas.some((r) => r.startsWith('i[style*="background:' + h + '" i]{')), 'la barra de avance ' + h + ' queda igual');
  }
  assert.match(APP, /background:\$\{cl==="g"\?"#12a37f":cl==="y"\?"#e0a800":"#d64545"\}/, 'la barra de estado sigue con su verde/amarillo/rojo');
  for (const h of ['#12a37f', '#e0a800', '#d64545']) assert.ok(CSS.includes('#ialotes .sbox[style*="--mc:' + h + '" i]{--mc:' + h + '!important}'));
});

test('desde afuera: sura-televentas.js agrega la capa DESPUES de la hoja del tablero; el tablero no se toco', () => {
  const host = PUB('js/sura-televentas.js');
  assert.match(host, /'<style data-paleta="plataforma">' \+ stvPaletaCss\(\) \+ '<\/style>'/);
  assert.match(host, /href="css\/sura-televentas-app\.css' \+ v \+ '">' \+ paleta;/);
  const html = PUB('index.html');
  const i = (s) => html.indexOf('<script src="js/' + s + '"></script>');
  assert.ok(i('sura-televentas-paleta-logic.js') !== -1 && i('sura-televentas-paleta-logic.js') < i('sura-televentas.js'));
  let cambios = null;
  try { cambios = execSync('git diff --name-only origin/main -- public/js/sura-televentas-app.js public/css/sura-televentas-app.css scripts/sura', { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { /* sin git: se omite */ }
  if (cambios !== null) assert.equal(cambios.trim(), '', 'el tablero del supervisor y su generador no cambian');
});
