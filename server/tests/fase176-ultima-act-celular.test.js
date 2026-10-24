// fase176-ultima-act-celular.test.js — Fase 176: a 375 px "Ultima
// actualizacion" usaba 2 lineas (y el subtitulo de Mobilize, "mes en curso,
// parcial — MOBILIZE", otras 2): el encabezado quedaba en 166-180 px en
// produccion. En el telefono (<=480 px) la fecha va corta ("Act. 24/10
// 08:30"), el subtitulo sin " — CLIENTE" y el espacio de "Cerrar" solo en
// las filas del logo y el titulo. Escritorio y tablet sin cambios (la
// comparacion pixel a pixel esta en el PR).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PUB = path.join(__dirname, '..', '..', 'public');
const CSS = fs.readFileSync(path.join(PUB, 'css', 'styles.css'), 'utf8');
const JS = fs.readFileSync(path.join(PUB, 'js', 'dashboard-generic.js'), 'utf8');

function bloque(txt, desde) {
  let i = txt.indexOf('{', desde) + 1, prof = 1;
  while (prof && i < txt.length) { if (txt[i] === '{') prof++; else if (txt[i] === '}') prof--; i++; }
  return txt.slice(desde, i);
}
const CSS176 = CSS.slice(CSS.indexOf('/* Fase 176:'));
const fuera = CSS176.slice(0, CSS176.indexOf('@media'));
const m480 = bloque(CSS176, CSS176.indexOf('@media(max-width:480px)'));

test('gdUltimaActTexto: largo para escritorio, "dd/mm hh:mm" para el telefono', () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(bloque(JS, JS.indexOf('function gdUltimaActTexto(')), ctx);
  assert.equal(ctx.gdUltimaActTexto('24/10/2026 08:30:59', false), 'Última actualización: 24/10/2026 08:30');
  assert.equal(ctx.gdUltimaActTexto('24/10/2026 08:30:59', true), '24/10 08:30');
  assert.equal(ctx.gdUltimaActTexto('formato raro', true), 'formato raro', 'si no reconoce el formato, no inventa');
});

test('el encabezado arma las 2 versiones con esc() y el cliente del subtitulo en su propio span', () => {
  assert.match(JS, /elUa\.innerHTML = '<span class="gd-ua-largo">' \+ esc\(gdUltimaActTexto\(fechaUa, false\)\) \+ '<\/span>' \+/);
  assert.match(JS, /'<span class="gd-ua-corto"><abbr title="Última actualización">Act\.<\/abbr> ' \+ esc\(gdUltimaActTexto\(fechaUa, true\)\) \+ '<\/span>'/);
  assert.match(JS, /sub\.innerHTML = esc\('Informe ' \+ \(rotuloParcial \|\| mesLbl\)\) \+ '<span class="gd-sub-cliente"> — ' \+ esc\(_gd\.cliente\) \+ '<\/span>';/);
});

test('fuera del telefono solo se oculta la version corta; en <=480 px se cambian', () => {
  assert.equal(fuera.replace(/\/\*[\s\S]*?\*\//g, '').trim(), '.gd-ua-corto{display:none;}\n.gd-ua-corto abbr{text-decoration:none;}');
  assert.match(m480, /#gd-modal \.gd-ua-largo,#gd-modal \.gd-sub-cliente\{display:none;\}/);
  assert.match(m480, /#gd-modal \.gd-ua-corto\{display:inline;\}/);
  // El espacio de "Cerrar" pasa del bloque entero al logo y el titulo.
  assert.match(m480, /#gd-modal \.aurora-header > div:first-child > div:first-child\{padding-right:0;\}/);
  assert.match(m480, /#gd-modal \.gd-cliente-logo,#gd-modal \.aurora-header h2\{margin-right:96px;\}/);
  assert.match(m480, /#gd-modal #gd-cerrar-btn\{top:6px;\}/);
  // Va despues del bloque de la Fase 175 (gana la cascada).
  assert.ok(CSS.indexOf('/* Fase 176:') > CSS.indexOf('/* Fase 175: encabezado del tablero'));
});
