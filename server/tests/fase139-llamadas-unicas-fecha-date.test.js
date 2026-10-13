// fase139-llamadas-unicas-fecha-date.test.js — Fase 139 (hallazgo real en el
// ensayo local de la carga de septiembre de Mobilize). La pantalla de carga
// (cargas.js) lee el Excel con {sheetStubs:true, cellNF:true}; con esas
// opciones SheetJS entrega la DATE del archivo real de Wolkvox como objeto
// `Date`, y llamadasUnicasParseFecha solo sabia leer number/string -- las
// 139 filas reales quedaban "DATE invalida" (0 filas para guardar). Mismo
// bug que ya tuvo Inasistencia (ver inasistencia-logic.js). Datos 100%
// sinteticos.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  llamadasUnicasParseFecha,
  llamadasUnicasParseFilas,
} = require('../../public/js/llamadas-unicas-logic.js');

const HEADER = ['AGENT_NAME', 'DATE', 'TELEPHONE', 'SKILL_NAME'];

test('llamadasUnicasParseFecha acepta un objeto Date (getters LOCALES)', () => {
  assert.equal(llamadasUnicasParseFecha(new Date(2026, 8, 1)), '2026-09-01');
  assert.equal(llamadasUnicasParseFecha(new Date(2026, 8, 30, 23, 59, 59)), '2026-09-30');
  assert.equal(llamadasUnicasParseFecha(new Date(2026, 0, 31, 0, 0, 0)), '2026-01-31');
});

test('llamadasUnicasParseFecha rechaza un Date invalido o fuera de rango', () => {
  assert.equal(llamadasUnicasParseFecha(new Date('no-es-fecha')), null);
  assert.equal(llamadasUnicasParseFecha(new Date(1950, 0, 1)), null);
});

test('number y string siguen igual que antes', () => {
  assert.equal(llamadasUnicasParseFecha(46266), '2026-09-01');
  assert.equal(llamadasUnicasParseFecha('01/09/2026'), '2026-09-01');
  assert.equal(llamadasUnicasParseFecha('2026-09-01'), '2026-09-01');
});

test('filas con DATE como objeto Date se cargan (no quedan "DATE invalida")', () => {
  const res = llamadasUnicasParseFilas([
    HEADER,
    ['Asesor Sintetico', new Date(2026, 8, 1), 3000000001, 'SKILL SAC'],
    ['Asesor Sintetico', new Date(2026, 8, 2), 3000000002, 'Skill Key Account'],
  ]);
  assert.equal(res.avisos.length, 0);
  assert.deepEqual(res.filas, [
    ['Asesor Sintetico', '2026-09-01', 'CONTESTADA', 'SKILL SAC'],
    ['Asesor Sintetico', '2026-09-02', 'CONTESTADA', 'Skill Key Account'],
  ]);
});

test('ida y vuelta con SheetJS y las MISMAS opciones de lectura de cargas.js', () => {
  const XLSX = require('../../public/js/vendor/xlsx-0.20.3.full.min.js');
  const ws = XLSX.utils.aoa_to_sheet([
    HEADER,
    ['Asesor Sintetico', new Date(2026, 8, 1), 3000000001, 'SKILL SAC'],
    ['Asesor Sintetico', new Date(2026, 8, 15), 3000000002, 'Skill Key Account'],
  ], { cellDates: true });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'HistCDR20261001');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellDates: true });
  const leido = XLSX.read(new Uint8Array(buf), { type: 'array', sheetStubs: true, cellNF: true });
  const aoa = XLSX.utils.sheet_to_json(leido.Sheets[leido.SheetNames[0]], { header: 1, blankrows: false, defval: null });
  const res = llamadasUnicasParseFilas(aoa);
  assert.equal(res.avisos.length, 0, 'ninguna fila deberia quedar como DATE invalida');
  assert.deepEqual(res.filas.map((f) => f[1]), ['2026-09-01', '2026-09-15']);
});
