// fase348-c4-vista-por-campana.test.js — Fase 348, punto C4 (reunion con Edwin del 12/11): al
// cambiar de campaña en el Modulo de Calidad, la vista de la anterior no se arrastra: pagina,
// busqueda y filas por pagina de cada lista, filtro de origen, Pendientes/Resueltas, plantilla del
// Diccionario y scroll (vertical del modulo y horizontal de las tablas). El mes de arriba se queda.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');

test('C4: clReiniciarVista borra el estado de todas las listas', () => {
  const ctx = { document: { addEventListener() {}, querySelector() { return null; } }, setTimeout, clearTimeout, esc: (s) => String(s) };
  vm.createContext(ctx);
  vm.runInContext(PUB('js/calidad-listas-logic.js') + '\n' + PUB('js/calidad-listas.js'), ctx);
  vm.runInContext("clEstado('mon').pagina = 3; clEstado('mon').q = 'x'; clEstado('det').porPagina = 20;", ctx);
  vm.runInContext('clReiniciarVista()', ctx);
  assert.deepEqual(JSON.parse(vm.runInContext("JSON.stringify([clEstado('mon'), clEstado('det')])", ctx)),
    [{ pagina: 1, porPagina: 10, q: '' }, { pagina: 1, porPagina: 10, q: '' }]);
});

test('C4: clReiniciarScroll lleva al inicio el modulo y las tablas', () => {
  const ctx = { document: { addEventListener() {} }, setTimeout, clearTimeout };
  vm.createContext(ctx);
  vm.runInContext(PUB('js/calidad-listas-logic.js') + '\n' + PUB('js/calidad-listas.js'), ctx);
  const tabla = { scrollLeft: 120 }, cen = { scrollLeft: 40 };
  const modal = { scrollTop: 900, querySelectorAll: (sel) => { assert.match(sel, /overflow-x/); assert.match(sel, /\.cen-tabla-wrap/); return [tabla, cen]; } };
  ctx.clReiniciarScroll(modal);
  assert.deepEqual([modal.scrollTop, tabla.scrollLeft, cen.scrollLeft], [0, 0, 0]);
  ctx.clReiniciarScroll(null); // sin modulo, no falla
});

test('C4: onCalCampanaChange reinicia la vista antes de cargar la campaña nueva y el scroll al final', () => {
  const cal = PUB('js/calidad.js');
  const f = cal.slice(cal.indexOf('async function onCalCampanaChange'), cal.indexOf('function calReiniciarVistaListas'));
  assert.ok(f.indexOf('calReiniciarVistaListas()') !== -1 && f.indexOf('calReiniciarVistaListas()') < f.indexOf('loadCalData('), 'antes de cargar');
  assert.ok(f.lastIndexOf("clReiniciarScroll(document.getElementById('calidad-modal'))") > f.indexOf('switchCalTab(_ctab)'), 'el scroll, despues de dibujar');
  const r = cal.slice(cal.indexOf('function calReiniciarVistaListas'));
  assert.match(r, /clReiniciarVista\(\)/);
  assert.match(r, /getElementById\('cal-origen-sel'\); if\(os\) os\.value = ''/);
  assert.match(r, /_cen\.estado = 'pendientes'/);
  assert.match(r, /_ca\.plantillaId = null/);
  assert.doesNotMatch(r.slice(0, r.indexOf('\n}')), /_cmesFiltro/, 'el mes elegido arriba se queda');
});
