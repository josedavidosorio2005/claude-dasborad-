const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  gdFiltrarFilasCategorias,
  gdFiltrarFilasRangoFechas,
  gdValoresDistintos,
} = require('../../public/js/gd-filtro-logic');

const FILAS_TIPIF = [
  { tipificacion: 'Interesado', cantidad: 10 },
  { tipificacion: 'No contesta', cantidad: 5 },
  { tipificacion: 'Objecion precio', cantidad: 3 },
];

test('gdFiltrarFilasCategorias: sin incluidas, no filtra nada (comportamiento identico a antes del cambio)', () => {
  assert.deepEqual(gdFiltrarFilasCategorias(FILAS_TIPIF, 'tipificacion', null), FILAS_TIPIF);
  assert.deepEqual(gdFiltrarFilasCategorias(FILAS_TIPIF, 'tipificacion', []), FILAS_TIPIF);
});

test('gdFiltrarFilasCategorias: con incluidas, deja solo esas categorias', () => {
  const r = gdFiltrarFilasCategorias(FILAS_TIPIF, 'tipificacion', ['Interesado', 'Objecion precio']);
  assert.deepEqual(r.map((x) => x.tipificacion), ['Interesado', 'Objecion precio']);
});

test('gdFiltrarFilasCategorias: coincide sin importar mayusculas/espacios', () => {
  const r = gdFiltrarFilasCategorias(FILAS_TIPIF, 'tipificacion', ['  interesado  ']);
  assert.deepEqual(r.map((x) => x.tipificacion), ['Interesado']);
});

test('gdFiltrarFilasCategorias: array vacio de filas no rompe', () => {
  assert.deepEqual(gdFiltrarFilasCategorias([], 'tipificacion', ['x']), []);
  assert.deepEqual(gdFiltrarFilasCategorias(null, 'tipificacion', ['x']), []);
});

const FILAS_DIA = [
  { fecha: '2026-06-01', llamadas: 10 },
  { fecha: '2026-06-15', llamadas: 20 },
  { fecha: '2026-06-30', llamadas: 30 },
];

test('gdFiltrarFilasRangoFechas: sin desde/hasta, no filtra nada', () => {
  assert.deepEqual(gdFiltrarFilasRangoFechas(FILAS_DIA, null, null), FILAS_DIA);
});

test('gdFiltrarFilasRangoFechas: desde y hasta acotan el rango (inclusive)', () => {
  const r = gdFiltrarFilasRangoFechas(FILAS_DIA, '2026-06-10', '2026-06-20');
  assert.deepEqual(r.map((x) => x.fecha), ['2026-06-15']);
});

test('gdFiltrarFilasRangoFechas: solo desde, o solo hasta', () => {
  assert.deepEqual(gdFiltrarFilasRangoFechas(FILAS_DIA, '2026-06-16', null).map((x) => x.fecha), ['2026-06-30']);
  assert.deepEqual(gdFiltrarFilasRangoFechas(FILAS_DIA, null, '2026-06-14').map((x) => x.fecha), ['2026-06-01']);
});

test('gdValoresDistintos: lista sin duplicados, en orden de aparicion', () => {
  const filas = [{ a: 'X' }, { a: 'Y' }, { a: 'X' }, { a: 'Z' }, { a: null }, { a: '' }];
  assert.deepEqual(gdValoresDistintos(filas, 'a'), ['X', 'Y', 'Z']);
});

test('gdValoresDistintos: normaliza mayusculas/espacios al deduplicar pero conserva la primera forma vista', () => {
  const filas = [{ a: 'Objecion Precio' }, { a: '  objecion precio  ' }, { a: 'No contesta' }];
  assert.deepEqual(gdValoresDistintos(filas, 'a'), ['Objecion Precio', 'No contesta']);
});
