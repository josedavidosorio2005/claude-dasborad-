// fase164-etiquetas-torta.test.js — Fase 164 (lote 2, visto en produccion a
// 375 px): en las tortas, las porciones de menos del 5 % del total no llevan
// su "%" encima (se montaban unas sobre otras). El dato sigue en la leyenda,
// el tooltip y la tabla. Se ejecuta el codigo real de charts.js.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'charts.js'), 'utf8');
function cargar() {
  const ctx = { CD: '#0d4a5e' };
  const trozo = (desde) => { const i = src.indexOf(desde); assert.ok(i >= 0, desde); return src.slice(i, src.indexOf('\n}\n', i) + 2); };
  const codigo = [
    "var CHART_DL_OSCURO='#0a1e25';",
    trozo('function _loPieDlEleccion('),
    'function _loPieDlColor(ctx){ return _loPieDlEleccion(ctx).color; }',
    'function _loPieDlHalo(ctx){ return _loPieDlEleccion(ctx).halo || \'transparent\'; }',
    'function _loPieDlHaloAncho(ctx){ return _loPieDlEleccion(ctx).halo ? 3 : 0; }',
    trozo('function _loPctDeTotal('),
    trozo('function loDatalabelsAuto('),
    (src.match(/var PIE_ETIQUETA_MIN_PCT = \d+;/) || [''])[0],
    src.indexOf('function loPieMostrarEtiqueta(') >= 0 ? trozo('function loPieMostrarEtiqueta(') : '',
    src.indexOf('function _loPieDlMostrar(') >= 0 ? trozo('function _loPieDlMostrar(') : '',
    trozo('function loPie('),
  ].join('\n');
  vm.runInNewContext(codigo + '\nthis.loPie = loPie; this.loDatalabelsAuto = loDatalabelsAuto;', ctx);
  return ctx;
}
// Torta como la de Tipificacion de ORLANT vista en produccion (11 porciones).
const DATOS = [29, 15, 11, 9, 5, 5, 5, 4, 3, 3, 13];
const mostrar = (display, i) => (typeof display === 'function' ? display({ dataset: { data: DATOS, backgroundColor: [] }, dataIndex: i }) : display);

test('loPie: las porciones de menos del 5 % no llevan etiqueta; las demas van con auto-ocultado', () => {
  const { loPie } = cargar();
  const d = loPie('x').plugins.datalabels.display;
  assert.equal(typeof d, 'function', 'antes era display:true para todas');
  const vistas = DATOS.map((_, i) => mostrar(d, i));
  assert.deepEqual(vistas, DATOS.map((v) => (v / 102 * 100 >= 5 ? 'auto' : false)), "'auto' = el plugin esconde la que choque");
  assert.equal(mostrar(d, 0), 'auto');
  assert.equal(mostrar(d, 8), false, '3 % sin etiqueta');
});

test('loDatalabelsAuto respeta el filtro de la torta y le suma el auto-ocultado', () => {
  const { loPie, loDatalabelsAuto } = cargar();
  const d = loDatalabelsAuto(loPie()).plugins.datalabels.display;
  assert.equal(typeof d, 'function');
  assert.equal(mostrar(d, 0), 'auto');
  assert.equal(mostrar(d, 8), false);
  // En graficas sin filtro propio sigue siendo 'auto' como siempre.
  assert.equal(loDatalabelsAuto({ plugins: { datalabels: { display: true } } }).plugins.datalabels.display, 'auto');
});

test('una torta sin datos no rompe (total 0 = sin etiquetas)', () => {
  const { loPie } = cargar();
  const d = loPie().plugins.datalabels.display;
  assert.equal(d({ dataset: { data: [0, 0] }, dataIndex: 0 }), false);
});
