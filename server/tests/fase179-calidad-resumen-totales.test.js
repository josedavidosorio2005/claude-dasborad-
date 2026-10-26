// fase179-calidad-resumen-totales.test.js — Fase 179: una fila de totales o
// promedio al final de la plantilla del Resumen de calidad no es un asesor
// (antes se contaba como uno mas y duplicaba los monitoreos). SINTETICO.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const CR = require('../../public/js/calidad-resumen-logic.js');

const ENC = ['Nombre del Asesor', '# Monitoreos', 'Prom. Puntaje (%)', 'Clasificación', 'Alerta Críticos', 'Total Fallos Críticos'];

test('filas TOTAL / Promedio general / Gran total se omiten con un aviso; los monitoreos no se duplican', () => {
  const r = CR.calidadResumenParseFilas([ENC,
    ['Asesor Uno', 10, 90, '', '', 0],
    ['Asesor Dos', 5, 80, '', '', 1],
    ['TOTAL', 15, 86.67, '', '', 1],
    ['Promedio general', 15, 86.67, '', '', 1],
    ['  gran   total: ', 15, 86.67, '', '', 1],
    ['Totales', 15, 86.67, '', '', 1],
  ]);
  assert.deepEqual(r.filas.map((f) => f[0]), ['Asesor Uno', 'Asesor Dos']);
  assert.equal(r.monitoreos, 15);
  assert.equal(r.promedio, 86.67);
  assert.ok(r.avisos.includes('4 fila(s) de total o promedio, no son asesores: se omitieron (filas 4, 5, 6, 7).'), JSON.stringify(r.avisos));
});

test('una fila de total con la formula en error tampoco cuenta como "asesor sin calcular"', () => {
  const r = CR.calidadResumenParseFilas([ENC, ['Asesor Uno', 10, 90, '', '', 0], ['TOTAL', '#REF!', '#REF!', '', '', '#REF!']]);
  assert.equal(r.sinCalcular, 0);
  assert.equal(r.filas.length, 1);
});

test('nombres reales que contienen esas palabras siguen siendo asesores', () => {
  for (const n of ['Total', 'TOTAL', 'promedio', 'Promedios generales', 'TOTAL DEL MES']) assert.equal(CR.calidadResumenEsFilaTotal(n), true, n);
  for (const n of ['Totalina Perez', 'Ana Promedio Ruiz', 'Subtotal Gomez', 'Asesor Uno']) assert.equal(CR.calidadResumenEsFilaTotal(n), false, n);
  const r = CR.calidadResumenParseFilas([ENC, ['Totalina Perez', 3, 95, '', '', 0]]);
  assert.deepEqual(r.filas, [['Totalina Perez', 3, 95, 0]]);
});
