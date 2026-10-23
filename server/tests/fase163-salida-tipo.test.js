// fase163-salida-tipo.test.js — Fase 163, punto 4 (reunion con Edwin,
// 21/10): Llamadas de Salida con la plantilla nueva de Edwin: AGENT_NAME,
// DATE (con hora), TELEPHONE, DESCRIPTION_COD_ACT y TIPO ("Conectada" / "No
// conectada", obligatorio). El dia se toma en hora de Colombia, nunca el
// anterior; "-" = "Sin tipificación". Datos SINTETICOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const XLSX = require('../../public/js/vendor/xlsx-0.20.3.full.min.js');
const S = require('../../public/js/llamadas-salida-logic.js');
const U = require('../../public/js/llamadas-unicas-logic.js');

const HEADER = ['AGENT_NAME', 'DATE', 'TELEPHONE', 'DESCRIPTION_COD_ACT', 'TIPO'];

test('reconoce la plantilla de Edwin con TIPO; sin TIPO no carga nada', () => {
  const r = S.llamadasSalidaParseFilas([
    HEADER,
    ['Asesor Uno', '2026-08-05 08:46:00', '3000000001', 'Otros_motivos', 'Conectada'],
    ['Asesor Uno', '2026-08-05 09:10:00', '3000000002', 'No contesta', 'No conectada'],
    ['Asesor Dos', '2026-08-05 10:00:00', '3000000003', 'No contesta', ' NO CONECTADA '],
    ['Asesor Dos', '2026-08-05 10:05:00', '3000000004', 'x', 'Otra cosa'],
  ]);
  assert.deepEqual(r.filas.map((f) => f[2]), ['CONECTADA', 'NO_CONECTADA', 'NO_CONECTADA']);
  // Fase 171: aviso agrupado por motivo.
  assert.deepEqual(r.avisos, ['1 fila(s) con un TIPO que no es "Conectada" ni "No conectada", se omitieron (filas 5).']);
  const sin = S.llamadasSalidaParseFilas([HEADER.slice(0, 4), ['A', '2026-08-05', '1', 'x']]);
  assert.match(sin.error, /Faltan columnas obligatorias: TIPO/);
  assert.equal(sin.filas, undefined);
});

test('DATE con hora: el dia de Colombia, nunca el anterior', () => {
  // Serial de Excel con hora (como viene en el archivo real): 5 de agosto a las 23:59 y a las 00:01.
  const serial = (d, h, m) => 25569 + Date.UTC(2026, 7, d) / 86400000 + (h * 60 + m) / 1440;
  assert.equal(U.llamadasUnicasParseFecha(serial(5, 23, 59)), '2026-08-05');
  assert.equal(U.llamadasUnicasParseFecha(serial(5, 0, 1)), '2026-08-05');
  assert.equal(U.llamadasUnicasParseFecha('2026-08-05 08:46:00'), '2026-08-05');
  assert.equal(U.llamadasUnicasParseFecha('05/08/2026 17:13'), '2026-08-05');
  assert.equal(U.llamadasUnicasParseFecha('05/08/2026 5:13 p. m.'), '2026-08-05');
  // Con zona: 6 de agosto 03:10 UTC = 5 de agosto 22:10 en Colombia.
  assert.equal(U.llamadasUnicasParseFecha('2026-08-06T03:10:00Z'), '2026-08-05');
  assert.equal(U.llamadasUnicasParseFecha('2026-08-05T13:46:00Z'), '2026-08-05');
  // Date nativo (SheetJS con cellDates): se leen sus campos locales.
  assert.equal(U.llamadasUnicasParseFecha(new Date(2026, 7, 5, 23, 59)), '2026-08-05');
});

test('codigo de actividad "-" (o vacio) queda "Sin tipificación"', () => {
  const r = S.llamadasSalidaParseFilas([
    HEADER,
    ['A', '2026-08-05 08:00', '3000000001', '-', 'Conectada'],
    ['A', '2026-08-05 08:00', '3000000002', '', 'Conectada'],
    ['A', '2026-08-05 08:00', '3000000003', 'Link_de_pagos', 'Conectada'],
  ]);
  assert.deepEqual(r.filas.map((f) => f[3]), ['Sin tipificación', 'Sin tipificación', 'Link_de_pagos']);
});

test('la plantilla descargable trae los 5 encabezados y dice de que reporte sale cada tipo', () => {
  const wb = XLSX.read(fs.readFileSync(path.join(__dirname, '..', 'plantillas', 'PLANTILLA_LLAMADAS_SALIDA.xlsx')));
  assert.deepEqual(wb.SheetNames, ['LLAMADAS_SALIDA', 'INSTRUCCIONES']);
  assert.deepEqual(XLSX.utils.sheet_to_json(wb.Sheets.LLAMADAS_SALIDA, { header: 1 })[0], HEADER);
  const ins = XLSX.utils.sheet_to_json(wb.Sheets.INSTRUCCIONES, { header: 1 }).map((r) => r.join(' | ')).join('\n');
  assert.match(ins, /CONECTADAS salen del CDR/);
  assert.match(ins, /NO CONECTADAS del reporte "5\. Detalle de llamadas no conectadas"/);
  assert.match(ins, /TIPO \| Sí \|/);
});
