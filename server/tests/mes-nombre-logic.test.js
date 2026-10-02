// mes-nombre-logic.test.js — Fase 111 (ORLANT, 2 bases nuevas de Edwin sin
// columna AÑO, solo el nombre del mes). Logica PURA de public/js/
// mes-nombre-logic.js: mismo criterio de "año mas reciente en que el mes
// no es futuro (hora Colombia)" que ya existia para Inasistencia antes de
// la Fase 108 (recuperado de `git show f1e1147`, nunca reescrito a mano).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MES_NOMBRE_A_NUM, mesNombreAAAAMM } = require('../../public/js/mes-nombre-logic.js');

// "Hoy" fijo para que las pruebas no dependan de la fecha real del sistema
// -- 2026-10-01 UTC es 2026-09-30 20:00 Colombia (UTC-5), asi que el "hoy
// Colombia" sigue siendo 30/09/2026 para esta fecha de prueba.
const HOY = new Date('2026-10-01T12:00:00Z');

test('MES_NOMBRE_A_NUM: tiene los 12 meses, SEPTIEMBRE y SETIEMBRE apuntan a "09"', () => {
  assert.equal(Object.keys(MES_NOMBRE_A_NUM).length, 13); // 12 meses + alias SETIEMBRE
  assert.equal(MES_NOMBRE_A_NUM.SEPTIEMBRE, '09');
  assert.equal(MES_NOMBRE_A_NUM.SETIEMBRE, '09');
  assert.equal(MES_NOMBRE_A_NUM.ENERO, '01');
  assert.equal(MES_NOMBRE_A_NUM.DICIEMBRE, '12');
});

test('mesNombreAAAAMM: nombre de mes sin año, mes YA PASO este año -> año actual', () => {
  assert.equal(mesNombreAAAAMM('SEPTIEMBRE', null, HOY), '2026-09');
  assert.equal(mesNombreAAAAMM('ENERO', null, HOY), '2026-01');
  assert.equal(mesNombreAAAAMM('enero', null, HOY), '2026-01'); // minusculas, igual
});

test('mesNombreAAAAMM: nombre de mes sin año, mes TODAVIA NO LLEGA este año -> año anterior (nunca futuro)', () => {
  assert.equal(mesNombreAAAAMM('DICIEMBRE', null, HOY), '2025-12');
  assert.equal(mesNombreAAAAMM('NOVIEMBRE', null, HOY), '2025-11');
});

test('mesNombreAAAAMM: con año explicito, se usa tal cual (nunca se infiere)', () => {
  assert.equal(mesNombreAAAAMM('SEPTIEMBRE', '2024', HOY), '2024-09');
  assert.equal(mesNombreAAAAMM('DICIEMBRE', 2030, HOY), '2030-12');
});

test('mesNombreAAAAMM: ya viene como "AAAA-MM" o "AAAA-MM-DD" -> se devuelve tal cual (recortado)', () => {
  assert.equal(mesNombreAAAAMM('2026-09', null, HOY), '2026-09');
  assert.equal(mesNombreAAAAMM('2026-09-15', null, HOY), '2026-09');
});

test('mesNombreAAAAMM: serial de Excel (numero o texto numerico) -> "AAAA-MM"', () => {
  // 46280 = 15/09/2026 (serial de Excel, sin hora)
  assert.equal(mesNombreAAAAMM(46280, null, HOY), '2026-09');
  assert.equal(mesNombreAAAAMM('46280', null, HOY), '2026-09');
});

test('mesNombreAAAAMM: mes no reconocido, vacio o null -> null', () => {
  assert.equal(mesNombreAAAAMM('NOMES', null, HOY), null);
  assert.equal(mesNombreAAAAMM('', null, HOY), null);
  assert.equal(mesNombreAAAAMM(null, null, HOY), null);
  assert.equal(mesNombreAAAAMM(undefined, null, HOY), null);
});
