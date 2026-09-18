const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  gdFiltrarFilasCategorias,
  gdFiltrarFilasRangoFechas,
  gdValoresDistintos,
  gdSerieSeleccionada,
  gdAnioDeMes,
  gdCargasDelAnio,
  gdValorFiltroUnico,
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

const SERIES = [
  { label: 'Linea General', fuente: { campo: 'salida_general' } },
  { label: 'Linea 3P', fuente: { campo: 'salida_3p' } },
];

test('gdSerieSeleccionada: con label valido, devuelve esa serie', () => {
  assert.equal(gdSerieSeleccionada(SERIES, 'Linea 3P'), SERIES[1]);
});

test('gdSerieSeleccionada: sin label, o label que ya no existe, cae a la primera', () => {
  assert.equal(gdSerieSeleccionada(SERIES, null), SERIES[0]);
  assert.equal(gdSerieSeleccionada(SERIES, 'Linea Fantasma'), SERIES[0]);
});

test('gdSerieSeleccionada: sin series, devuelve null (nunca revienta)', () => {
  assert.equal(gdSerieSeleccionada([], 'Linea General'), null);
  assert.equal(gdSerieSeleccionada(null, 'Linea General'), null);
});

test('gdAnioDeMes: extrae el año de "YYYY-MM"; null-safe', () => {
  assert.equal(gdAnioDeMes('2026-07'), '2026');
  assert.equal(gdAnioDeMes(''), null);
  assert.equal(gdAnioDeMes(null), null);
  assert.equal(gdAnioDeMes(undefined), null);
});

const CARGAS = [
  { periodo: '2025-12', filas: [] },
  { periodo: '2026-01', filas: [] },
  { periodo: '2026-07', filas: [] },
];

test('gdCargasDelAnio: deja solo las cargas del año pedido', () => {
  assert.deepEqual(gdCargasDelAnio(CARGAS, '2026').map((c) => c.periodo), ['2026-01', '2026-07']);
});

test('gdCargasDelAnio: sin año, ninguna carga (nunca "todas" por accidente)', () => {
  assert.deepEqual(gdCargasDelAnio(CARGAS, null), []);
  assert.deepEqual(gdCargasDelAnio(CARGAS, ''), []);
});

test('gdCargasDelAnio: array vacio o null no rompe', () => {
  assert.deepEqual(gdCargasDelAnio([], '2026'), []);
  assert.deepEqual(gdCargasDelAnio(null, '2026'), []);
});

test('gdValorFiltroUnico: sin valor previo, cae al primer disponible', () => {
  assert.equal(gdValorFiltroUnico(['3P', 'GENERAL'], null), '3P');
  assert.equal(gdValorFiltroUnico(['3P', 'GENERAL'], undefined), '3P');
  assert.equal(gdValorFiltroUnico(['3P', 'GENERAL'], ''), '3P');
});

test('gdValorFiltroUnico: con valor previo valido, lo conserva', () => {
  assert.equal(gdValorFiltroUnico(['3P', 'GENERAL'], 'GENERAL'), 'GENERAL');
});

test('gdValorFiltroUnico: valor previo que ya no esta disponible, cae al primero (nunca "sin filtro")', () => {
  assert.equal(gdValorFiltroUnico(['3P', 'GENERAL'], 'SEDE33'), '3P');
});

test('gdValorFiltroUnico: sin disponibles, null (nunca revienta)', () => {
  assert.equal(gdValorFiltroUnico([], 'GENERAL'), null);
  assert.equal(gdValorFiltroUnico(null, 'GENERAL'), null);
});

// ── Caso real del bug (2026-09-18): el pie de Tipificacion de ORLANT
// combinaba 3P + General por defecto, y ambas lineas comparten nombres de
// categoria -> cada una aparecia DUPLICADA en la leyenda del pastel. Prueba
// que el filtro de "una sola linea a la vez" (gdValoresDistintos +
// gdValorFiltroUnico + gdFiltrarFilasCategorias, la misma composicion que
// usa dashboard-generic.js) deja exactamente una fila por categoria — nunca
// dos categorias con el mismo nombre.
const FILAS_TIPIF_DUPLICADAS = [
  { linea: '3P', tipificacion: 'Agendamiento', cantidad: 31 },
  { linea: '3P', tipificacion: 'Informacion general', cantidad: 20 },
  { linea: '3P', tipificacion: 'Cancelacion', cantidad: 8 },
  { linea: 'GENERAL', tipificacion: 'Agendamiento', cantidad: 24 },
  { linea: 'GENERAL', tipificacion: 'Informacion general', cantidad: 15 },
  { linea: 'GENERAL', tipificacion: 'Reprogramacion', cantidad: 13 },
];

test('filtro de linea unica en Tipificacion: nunca deja categorias duplicadas en el resultado', () => {
  const disponibles = gdValoresDistintos(FILAS_TIPIF_DUPLICADAS, 'linea');
  assert.deepEqual(disponibles, ['3P', 'GENERAL']);

  const lineaPorDefecto = gdValorFiltroUnico(disponibles, null);
  const filtradas = gdFiltrarFilasCategorias(FILAS_TIPIF_DUPLICADAS, 'linea', [lineaPorDefecto]);

  const nombres = filtradas.map((f) => f.tipificacion);
  const nombresUnicos = Array.from(new Set(nombres));
  assert.equal(nombres.length, nombresUnicos.length, 'ninguna categoria debe repetirse tras filtrar por una sola linea');
  assert.deepEqual(nombres.sort(), ['Agendamiento', 'Cancelacion', 'Informacion general'].sort());

  // Cambiar a la otra linea tambien queda sin duplicados, con SUS propias
  // categorias (Reprogramacion, que 3P no tiene).
  const filtradasGeneral = gdFiltrarFilasCategorias(FILAS_TIPIF_DUPLICADAS, 'linea', ['GENERAL']);
  const nombresGeneral = filtradasGeneral.map((f) => f.tipificacion);
  assert.equal(nombresGeneral.length, new Set(nombresGeneral).size);
  assert.ok(nombresGeneral.includes('Reprogramacion'));
});
