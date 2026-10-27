// Fase 201 (todos los clientes): el encabezado del tablero ya no tiene el
// filtro "MES"; solo "MESES" (casillas). Las tarjetas y los paneles que
// trabajaban con un solo mes siguen el ULTIMO mes marcado en MESES; sin
// ninguno marcado, el mes por defecto de siempre (el mas reciente con datos
// principales).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('../../public/js/mes-global-logic.js');

const RAIZ = path.join(__dirname, '..', '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'public', 'index.html'), 'utf8');
const GD = fs.readFileSync(path.join(RAIZ, 'public', 'js', 'dashboard-generic.js'), 'utf8');
function extraer(src, firma) {
  const i = src.indexOf(firma);
  assert.ok(i !== -1, 'falta ' + firma);
  const j = src.indexOf('\n}', i);
  return src.slice(i, j + 2);
}

test('gdMesDeMeses: el último marcado; sin marcados, el de siempre; nunca un mes que no exista', () => {
  const todos = ['2026-10', '2026-09', '2026-08'];
  assert.equal(L.gdMesDeMeses(['2026-08', '2026-09'], '2026-10', todos), '2026-09');
  assert.equal(L.gdMesDeMeses(['2026-09', '2026-08'], '2026-10', todos), '2026-09', 'sin importar el orden en que se marcaron');
  assert.equal(L.gdMesDeMeses([], '2026-10', todos), '2026-10', '"Todos" = el mes por defecto');
  assert.equal(L.gdMesDeMeses(['2025-01'], '2026-10', todos), '2026-10', 'un mes que ya no existe no cuenta');
  assert.equal(L.gdMesDeMeses(null, '', []), '');
});

test('index.html: sin selector MES en el encabezado; MESES dice la regla de las tarjetas', () => {
  assert.ok(!HTML.includes('id="gd-mes-sel"') && !HTML.includes('onGdMesChange'));
  assert.ok(HTML.includes('id="gd-meses-wrap"'));
  assert.match(HTML, /Las tarjetas siguen el último mes marcado; sin ninguno marcado, el mes más reciente con datos\./);
  assert.ok(!/function onGdMesChange\(/.test(GD), 'el manejador del MES se fue');
});

// Entorno minimo para los manejadores del encabezado.
function entorno(mesesSel) {
  const llamadas = [];
  const ctx = {
    _gd: { periodos: ['2026-10', '2026-09', '2026-08'], mesesSel: mesesSel || [], mesDefecto: '2026-10', mesSel: '2026-10', tab: 'flujo' },
    gdMesDeMeses: L.gdMesDeMeses,
    document: { getElementById: () => null, querySelectorAll: () => [] },
  };
  for (const f of ['_gdPintarSubtitulo', '_gdPintarCompararContra', 'renderGenericKpis', 'renderGenericTab', '_gdPintarMeses', '_gdMesesBoton']) ctx[f] = () => llamadas.push(f);
  vm.createContext(ctx);
  // _gdMeses es de una sola linea: se copia tal cual (extraer llegaria hasta la funcion siguiente).
  const meses = GD.match(/function _gdMeses\(\)\{[^\n]*\}/)[0];
  vm.runInContext([meses].concat(['function _gdMesDesdeMeses()', 'function _gdIrAMes(mes)', 'function gdMesesTodos()'].map((f) => extraer(GD, f))).join('\n'), ctx);
  return { ctx, llamadas };
}

test('marcar meses mueve el mes de las tarjetas y repinta tarjetas y pestaña, sin redibujar la lista', () => {
  const { ctx, llamadas } = entorno(['2026-08', '2026-09']);
  ctx._gdMesDesdeMeses();
  assert.equal(ctx._gd.mesSel, '2026-09');
  assert.deepEqual(llamadas, ['_gdPintarSubtitulo', '_gdPintarCompararContra', 'renderGenericKpis', 'renderGenericTab']);
});

test('"Ver todos los meses" vuelve al mes por defecto', () => {
  const { ctx } = entorno(['2026-08']);
  ctx.gdMesesTodos();
  assert.deepEqual([...ctx._gd.mesesSel], []);
  assert.equal(ctx._gd.mesSel, '2026-10');
});

test('"Ver <mes>" del aviso sin datos deja marcado solo ese mes en MESES', () => {
  const { ctx, llamadas } = entorno([]);
  ctx._gdIrAMes('2026-08');
  assert.deepEqual([...ctx._gd.mesesSel], ['2026-08']);
  assert.equal(ctx._gd.mesSel, '2026-08');
  assert.ok(llamadas.includes('_gdPintarMeses'), 'la lista refleja la marca');
});
