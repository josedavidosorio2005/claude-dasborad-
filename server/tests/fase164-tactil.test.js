// fase164-tactil.test.js — Fase 164 (lote 2, D-12): en el telefono
// (<=768 px) los controles que se tocan miden al menos 44 px de alto
// (botones chicos de los paneles, cabeceras y formularios de admin,
// buscadores, Editar/Eliminar con 8 px entre ellos, ojo de la contrasena,
// migas del Centro y menu lateral). El encabezado del tablero no se toca.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'css', 'styles.css'), 'utf8');

function bloqueFase164() {
  const i = css.indexOf('Fase 164 (D-12)');
  assert.ok(i > 0, 'falta el bloque de la Fase 164 (D-12)');
  const ini = css.indexOf('@media(max-width:768px){', i);
  let n = 0;
  for (let k = ini; k < css.length; k++) {
    if (css[k] === '{') n++;
    else if (css[k] === '}' && --n === 0) return css.slice(ini, k + 1);
  }
  return '';
}

test('controles del telefono con al menos 44 px de alto', () => {
  const b = bloqueFase164();
  const regla = b.match(/([^{}]+)\{min-height:44px;\}/);
  assert.ok(regla, 'regla min-height:44px');
  const sel = regla[1];
  for (const s of ['#gd-panels .btn-sm', '#gd-panels .search-bar input', '.section-header .btn-primary', '.section-header .btn-cancel',
    '.section-header .btn-reset', '.section-header .search-bar input', '.hist-filter-sel', '.modal-btns .btn-primary',
    '.modal-btns .btn-cancel', 'td .btn-edit', 'td .btn-delete', '.sidebar-menu li a']) {
    assert.ok(sel.includes(s), 'falta ' + s);
  }
  assert.match(b, /#gd-panels \.btn-sm\{min-width:44px;\}/);
});

test('Editar y Eliminar separados 8 px (de lado o uno encima del otro)', () => {
  const b = bloqueFase164();
  assert.match(b, /td \.btn-edit,td \.btn-delete\{margin-top:4px;margin-bottom:4px;\}/);
  assert.match(b, /td \.btn-sm \+ \.btn-sm\{margin-left:8px;\}/);
});

test('ojo de la contrasena y migas del Centro de 44 px', () => {
  const b = bloqueFase164();
  assert.match(b, /\.btn-eye\{right:0;min-width:44px;min-height:44px;/);
  assert.match(b, /\.cc-migas a\{display:inline-flex;align-items:center;min-height:44px;\}/);
});

test('el encabezado del tablero no se toca en este bloque', () => {
  const b = bloqueFase164();
  assert.doesNotMatch(b, /aurora-header|#gd-mes-sel|gd-header-acciones|#gd-cerrar-btn|aurora-kpi/);
});
