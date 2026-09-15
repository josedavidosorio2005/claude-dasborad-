// calidad-carga-masiva-logic.test.js — cubre public/js/calidad-carga-masiva-logic.js
// (parseo de la hoja "Monitoreos" de la carga masiva de Calidad), corriendo la
// MISMA logica que usa el navegador contra un fixture REAL de 3 hojas
// (server/tests/fixtures/cartera-fixture.xlsx — datos claramente de prueba,
// nunca datos reales de la campana). Ver server/tests/helpers/xlsx-lite.js
// para por que se lee el .xlsx a mano en vez de con un paquete de npm.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { leerHojaXlsxComoAoA } = require('./helpers/xlsx-lite');
const {
  cmColIndexMap,
  cmParseFecha,
  cmParseRespuesta,
  cmParseRows,
} = require('../../public/js/calidad-carga-masiva-logic.js');
const { PLANTILLAS } = require('../calidad-plantillas-seed.js');

const FIXTURE = path.join(__dirname, 'fixtures', 'cartera-fixture.xlsx');
const ITEMS_CARTERA = PLANTILLAS.find((p) => p.campana === 'CARTERA INTERNA').items;

test('cmParseFecha: formatos aceptados y rechazados', () => {
  assert.equal(cmParseFecha('2026-09-01'), '2026-09-01');
  assert.equal(cmParseFecha(new Date(Date.UTC(2026, 8, 1))), '2026-09-01');
  assert.equal(cmParseFecha('fecha-invalida'), null);
  assert.equal(cmParseFecha(''), null);
});

test('cmParseRespuesta: normaliza variantes de SI/NO/N-A', () => {
  assert.equal(cmParseRespuesta('si'), 'SI');
  assert.equal(cmParseRespuesta('SÍ'), 'SI');
  assert.equal(cmParseRespuesta('no'), 'NO');
  assert.equal(cmParseRespuesta('n/a'), 'N/A');
  assert.equal(cmParseRespuesta('NA'), 'N/A');
  assert.equal(cmParseRespuesta(''), '');
  assert.equal(cmParseRespuesta('algo-raro'), '');
});

test('cmColIndexMap: reconoce columnas fijas y de items por etiqueta, no por posicion', () => {
  const aoa = leerHojaXlsxComoAoA(FIXTURE, 'Monitoreos');
  const map = cmColIndexMap(aoa[0], ITEMS_CARTERA);
  assert.equal(map.fijas.asesor, 0);
  assert.equal(map.fijas.fecha, 1);
  assert.equal(Object.keys(map.items).length, 14); // los 14 items de Cartera
});

test('cmParseRows: fixture de 3 hojas de Cartera — filas validas, invalidas descartadas con aviso', () => {
  const aoa = leerHojaXlsxComoAoA(FIXTURE, 'Monitoreos');
  const res = cmParseRows(aoa, ITEMS_CARTERA);
  assert.equal(res.error, undefined, JSON.stringify(res));
  // El fixture trae 5 filas de datos: 3 validas, 1 sin asesor y 1 con fecha
  // invalida (deben descartarse con aviso, no romper el resto de la carga).
  assert.equal(res.filas.length, 3);
  assert.equal(res.avisos.length, 2);
  assert.match(res.avisos[0], /asesor.*vacio/i);
  assert.match(res.avisos[1], /fecha.*invalida/i);

  const f1 = res.filas.find((f) => f.idLlamada === 'ID-TEST-001');
  assert.equal(f1.asesor, 'Asesor Prueba Uno');
  assert.equal(f1.fecha, '2026-09-01');
  assert.equal(f1.canal, 'LLAMADA');
  assert.equal(Object.keys(f1.answers).length, 14);
  assert.equal(f1.answers[1], 'SI');

  const f2 = res.filas.find((f) => f.idLlamada === 'ID-TEST-002');
  assert.equal(f2.answers[6], 'NO'); // item critico "Objeciones" fallado a proposito

  const f3 = res.filas.find((f) => f.idLlamada === 'ID-TEST-003');
  assert.equal(f3.canal, 'WPP');
  assert.equal(f3.answers[2], 'N/A');
});

test('cmParseRows: hoja vacia o sin columnas obligatorias -> error legible', () => {
  assert.match(cmParseRows([], ITEMS_CARTERA).error, /vacia/i);
  const sinAsesor = [['FECHA', 'CANAL'], ['2026-09-01', 'LLAMADA']];
  assert.match(cmParseRows(sinAsesor, ITEMS_CARTERA).error, /ASESOR/);
});
