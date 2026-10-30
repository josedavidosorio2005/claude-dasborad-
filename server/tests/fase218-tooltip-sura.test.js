// fase218-tooltip-sura.test.js — Fase 218: el recuadro emergente (tooltip) del
// tablero de SURA. Antes tomaba el ancho del tablero (regla .wrap>* de la Fase
// 215: 1180 px) y se salia de la pantalla; despues, en pantallas angostas, se
// encogia si la pasada anterior lo dejo pegado al borde. Guardas sobre el CSS
// y el JS generados y sobre el generador (que no se pierda al regenerar).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const css = fs.readFileSync(path.join(RAIZ, 'public', 'css', 'sura-televentas-app.css'), 'utf8');
const app = fs.readFileSync(path.join(RAIZ, 'public', 'js', 'sura-televentas-app.js'), 'utf8');
const gen = fs.readFileSync(path.join(RAIZ, 'scripts', 'sura', 'generar-televentas.js'), 'utf8');

test('el tooltip tiene su propio ancho (max-content, tope 420 px y el ancho de la pantalla), no el del tablero', () => {
  const m = css.match(/\.wrap>\.mtip\{([^}]*)\}/);
  assert.ok(m, 'falta la regla .wrap>.mtip');
  assert.match(m[1], /width:max-content/);
  assert.match(m[1], /max-width:min\(420px,calc\(100vw - 16px\)\)/);
  assert.match(m[1], /max-height:calc\(100vh - 16px\)/);
  assert.ok(gen.includes('.wrap>.mtip{width:max-content;'), 'el generador repite la regla');
});

test('todas las posiciones del tooltip pasan por tipPos (dentro de la pantalla, 8 px de margen)', () => {
  assert.match(app, /const tipPos=\(m,x,y\)=>\{x=Math\.max\(8,Math\.min\(x,innerWidth-m\.offsetWidth-8\)\);y=Math\.max\(8,Math\.min\(y,innerHeight-m\.offsetHeight-8\)\);/);
  assert.equal((app.match(/tipPos\(m,[xX],[yY]\)/g) || []).length, 9);
  assert.equal(app.split('style.left=').length - 1, 1, 'solo tipPos escribe la posicion');
  assert.ok(gen.includes("'tipPos(m,x,y)', 8") && gen.includes("'tipPos(m,X,Y)', 1"), 'el generador hace los mismos reemplazos');
});
