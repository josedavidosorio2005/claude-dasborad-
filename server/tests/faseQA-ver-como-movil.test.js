// faseQA-ver-como-movil.test.js — Auditoría 24/11: la franja de «Ver como» medía 178 px de alto a
// 375 px (5 líneas). En ≤600 px pasa a una barra de lado a lado con el botón «Volver» (el resto del
// nombre sigue para el lector de pantalla), sin colores nuevos.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '../../public/css/styles.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../../public/index.html'), 'utf8');

function bloqueMovil() {
  const i = css.indexOf('.ver-como-banner{left:0;right:0;bottom:0');
  assert.ok(i > 0, 'falta la regla móvil de la franja');
  const ini = css.lastIndexOf('@media (max-width:600px){', i);
  const fin = css.indexOf('\n}\n', i);
  return css.slice(ini, fin);
}

test('en ≤600 px la franja es una barra de lado a lado, sin envolver el botón', () => {
  const b = bloqueMovil();
  assert.match(b, /\.ver-como-banner\{[^}]*flex-wrap:nowrap/);
  assert.match(b, /\.ver-como-banner\{[^}]*font-size:var\(--fs-note\)/);
  assert.match(b, /\.ver-como-volver\{[^}]*min-width:44px/);
  assert.match(b, /html\.ver-como-activo body\{padding-bottom:64px\}/);
});

test('el botón sigue llamándose «Volver a mi sesión» (texto oculto solo a la vista en el celular)', () => {
  assert.match(html, />Volver<span class="ver-como-volver-mas"> a mi sesión<\/span><\/button>/);
  assert.match(bloqueMovil(), /\.ver-como-volver-mas\{position:absolute;width:1px;height:1px[^}]*clip:rect\(0 0 0 0\)/);
  // fuera del celular el texto completo se ve: la regla que lo oculta solo vive en el bloque móvil
  assert.equal(css.split('.ver-como-volver-mas{').length - 1, 1);
});

test('sin colores nuevos: solo tokens de estado (aviso)', () => {
  const b = bloqueMovil();
  assert.doesNotMatch(b, /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsl/);
  assert.doesNotMatch(b, /transition|animation/);
});

test('la regla móvil va antes del bloque de tema claro de la Fase 348 (que queda al final)', () => {
  const i = css.indexOf('.ver-como-banner{left:0;right:0;bottom:0');
  const ultimo348 = css.lastIndexOf('Fase 348');
  assert.ok(i < ultimo348);
});
