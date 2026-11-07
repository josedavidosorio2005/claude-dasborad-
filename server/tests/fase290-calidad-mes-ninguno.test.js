// fase290-calidad-mes-ninguno.test.js — Fase 290 (revision del 07/11, hallazgo #13): en
// Calidad › Resultado de los monitoreos, «Ninguno» en el filtro Mes equivale a «Todos»
// (los meses con monitoreos), igual que «Meses» del tablero. Antes dejaba el tablero
// vacio («Sin opciones para los meses elegidos»). Monitoreos INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const C = require('../../public/js/calidad-equipo-logic.js');

const ARR = [
  { fecha: '2026-09-10', puntaje: 80, asesor: 'Asesor Inventado A' },
  { fecha: '2026-10-02', puntaje: 90, asesor: 'Asesor Inventado B' },
  { fecha: '2026-10-20', puntaje: 70, asesor: 'Asesor Inventado A' },
];

test('Mes sin marcar = todos los meses con monitoreos; con meses marcados, solo esos', () => {
  assert.deepEqual(C.ceMesesEfectivos([], ARR), ['2026-09', '2026-10']);
  assert.deepEqual(C.ceMesesEfectivos(null, ARR), ['2026-09', '2026-10']);
  assert.deepEqual(C.ceMesesEfectivos(['2026-10'], ARR), ['2026-10']);
  assert.equal(C.ceMesFiltroDesc([]), 'Todos');
  assert.equal(C.ceMesFiltroDesc(['2026-10']), C.ceMesDesc(['2026-10']));
});

test('con «Ninguno» el resultado es el de todos los meses (no vacio)', () => {
  const ninguno = C.ceResultado(ARR, { meses: C.ceMesesEfectivos([], ARR) });
  const todos = C.ceResultado(ARR, { meses: ['2026-09', '2026-10'] });
  assert.equal(ninguno.total, 3);
  assert.deepEqual(ninguno.kpis, todos.kpis);
  assert.deepEqual(C.ceAsesoresDe(ARR, C.ceMesesEfectivos([], ARR)), ['Asesor Inventado A', 'Asesor Inventado B']);
});

test('el panel usa los meses efectivos (resultado, texto y lista de asesores)', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'calidad-panel.js'), 'utf8');
  assert.match(js, /var mesesEf = ceMesesEfectivos\(st\.meses, arr\);/);
  assert.match(js, /ceResultado\(arr, \{ meses: mesesEf,/);
  assert.match(js, /var mesDesc = ceMesFiltroDesc\(st\.meses\);/);
  assert.match(js, /ceAsesoresDe\(arr, mesesEf\)/);
});
