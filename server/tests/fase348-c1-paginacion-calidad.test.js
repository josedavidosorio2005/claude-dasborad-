// fase348-c1-paginacion-calidad.test.js — Fase 348, punto C1 (reunion con Edwin del 12/11): las
// listas del Modulo de Calidad (Monitoreos, Detalle por mes, Calidad de encuestas) muestran 10 filas
// por defecto, con opcion de 20, y paginacion. Logica pura + cableado en las tres listas.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const L = require('../../public/js/calidad-listas-logic.js');

const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');

test('C1: 10 por defecto, 20 como opcion; cualquier otro valor vuelve a 10', () => {
  assert.deepEqual(L.CL_TAMANOS, [10, 20]);
  assert.equal(L.clTamano(undefined), 10);
  assert.equal(L.clTamano('20'), 20);
  assert.equal(L.clTamano(50), 10);
  assert.equal(L.clTamano(-1), 10);
});

test('C1: clPaginar corta bien y nunca deja una pagina que no existe', () => {
  assert.deepEqual(L.clPaginar(53, 1, 10), { total: 53, porPagina: 10, paginas: 6, pagina: 1, desde: 0, hasta: 10 });
  assert.deepEqual(L.clPaginar(53, 6, 10), { total: 53, porPagina: 10, paginas: 6, pagina: 6, desde: 50, hasta: 53 });
  assert.equal(L.clPaginar(53, 99, 10).pagina, 6); // la lista se achico: ultima pagina
  assert.equal(L.clPaginar(53, 4, 20).pagina, 3);
  assert.equal(L.clPaginar(53, 0, 10).pagina, 1);
  assert.deepEqual(L.clPaginar(0, 3, 10), { total: 0, porPagina: 10, paginas: 1, pagina: 1, desde: 0, hasta: 0 });
  assert.equal(L.clTextoRango(L.clPaginar(53, 2, 10)), '11–20 de 53');
  assert.equal(L.clTextoRango(L.clPaginar(0, 1, 10)), '0 de 0');
});

test('C1: botones de pagina con huecos', () => {
  assert.deepEqual(L.clPaginasVisibles(1, 1), [1]);
  assert.deepEqual(L.clPaginasVisibles(1, 4), [1, 2, 3, 4]);
  assert.deepEqual(L.clPaginasVisibles(6, 12), [1, '…', 5, 6, 7, '…', 12]);
  assert.deepEqual(L.clPaginasVisibles(1, 12), [1, 2, '…', 12]);
  assert.deepEqual(L.clPaginasVisibles(12, 12), [1, '…', 11, 12]);
});

test('C1: las tres listas usan la paginacion comun y los KPIs siguen con todas las filas', () => {
  const html = PUB('index.html');
  assert.ok(html.indexOf('js/calidad-listas-logic.js') < html.indexOf('js/calidad.js"'), 'la logica carga antes que calidad.js');
  assert.ok(html.indexOf('js/calidad-listas.js') < html.indexOf('js/calidad.js"'));
  assert.match(html, /id="cal-monitoreos-pie"/);
  const cal = PUB('js/calidad.js');
  assert.match(cal, /clCortar\('mon', arr\)/);
  assert.match(cal, /corte\.filas\.forEach/);
  const ana = PUB('js/calidad-analisis.js');
  assert.match(ana, /clCortar\('det', lista\)/);
  assert.match(ana, /caKpis\(lista\)/, 'los KPIs del Detalle cuentan toda la lista');
  const cen = PUB('js/calidad-encuestas.js');
  assert.match(cen, /clCortar\(idLista, filasVis\)/); // Fase 348 (C2): ya con la busqueda aplicada
  assert.match(cen, /clRegistrar\('cen-resueltas', _cenPintarLista\)/);
  const ui = PUB('js/calidad-listas.js');
  assert.match(ui, /Filas por página/);
  assert.match(ui, /aria-current="page"/);
});
