// fase122-efectividad-agendamiento-pct-formato.test.js — Fase 122 (hallazgo
// real contra el archivo EFECTIVIDAD_EN_AGENDAMIENTO_AGOSTO.xlsx de Edwin):
// un asesor con efectividad > 100% (SANTIAGO LONDOÑO RUA, agosto: 1337
// agendas / 1133 gestiones = 118,01%) guarda la celda EFECTIVIDAD como
// 1.180052956751986 con formato REAL de Excel "0%" (confirmado contra el
// archivo real, solo estructura: celda D17, z:"0%", w:"118%"). La regla
// vieja ("<=1 es fraccion, >1 ya es porcentaje") adivinaba mal: 1.18 > 1 se
// tomaba como "ya es porcentaje", dando "1.2%" en vez de "118%", y la
// plataforma avisaba "EFECTIVIDAD no coincide con el recalculo" sobre un
// archivo que en realidad SI coincidia -- InCo esperaba explicitamente "0
// advertencias de EFECTIVIDAD" para este archivo real.
//
// Fix: mismo patron ya establecido en Trafico (traficoClasificarCeldaNumerica,
// Fase 88) -- leer el FORMATO real de la celda (`z` contiene "%") en vez de
// adivinar por el valor. Unica diferencia: esta hoja trae sus 2 primeras
// filas de Excel totalmente vacias y encabezados en la fila 3 (confirmado
// contra el archivo real: ws['!ref'] = "A3:E22"), asi que el calculo de la
// celda real debe sumar ese offset -- una hoja con encabezados en la fila 1
// (offset 0) sigue funcionando igual.
//
// Datos SIEMPRE inventados (nunca el archivo real, que tiene nombres
// reales de asesores).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  _eaCeldaRef,
  _eaClasificarCeldaNumerica,
  _eaPctDesdeCelda,
  efectividadAgendamientoParseFilas,
} = require('../../public/js/efectividad-agendamiento-logic.js');

const HOY = new Date('2026-10-05T12:00:00Z');

// ── _eaCeldaRef: offset de fila desde ws['!ref'] (header NO en fila 1) ──
test('_eaCeldaRef: con ws["!ref"]="A3:E22" (header en fila 3, igual que el archivo real), fila 0 de aoa (header) -> fila 3 de Excel', () => {
  const ws = { '!ref': 'A3:E22' };
  assert.equal(_eaCeldaRef(ws, 0, 0), 'A3');
  assert.equal(_eaCeldaRef(ws, 14, 3), 'D17'); // fila aoa 14 (SANTIAGO, Fase 122) -> Excel D17, confirmado contra el archivo real
});

test('_eaCeldaRef: sin ws o sin "!ref" -> asume header en fila 1 (comportamiento de siempre, ej. hojas con encabezado normal)', () => {
  assert.equal(_eaCeldaRef(null, 1, 0), 'A2');
  assert.equal(_eaCeldaRef({}, 1, 0), 'A2');
});

// ── _eaClasificarCeldaNumerica ───────────────────────────────────────────
test('_eaClasificarCeldaNumerica: celda numerica con formato "%" -> porcentaje', () => {
  const ws = { '!ref': 'A3:E22', D17: { t: 'n', v: 1.18, z: '0%' } };
  assert.equal(_eaClasificarCeldaNumerica(ws, 14, 3), 'porcentaje');
});
test('_eaClasificarCeldaNumerica: celda numerica SIN formato "%" -> numero', () => {
  const ws = { '!ref': 'A3:E22', D17: { t: 'n', v: 50, z: 'General' } };
  assert.equal(_eaClasificarCeldaNumerica(ws, 14, 3), 'numero');
});
test('_eaClasificarCeldaNumerica: sin ws -> null', () => {
  assert.equal(_eaClasificarCeldaNumerica(null, 14, 3), null);
});

// ── _eaPctDesdeCelda: el HALLAZGO REAL, con y sin clasificacion ─────────
test('HALLAZGO REAL: 1.18 (118%, SANTIAGO) SIN clasificacion -> se adivina mal como 1.2% (comportamiento de ANTES de este fix, documentado a proposito)', () => {
  assert.equal(_eaPctDesdeCelda(1.180052956751986), 1.2);
});
test('FIX: 1.18 (118%) CON clasificacion "porcentaje" -> 118 (correcto, cubre > 100%)', () => {
  assert.equal(_eaPctDesdeCelda(1.180052956751986, 'porcentaje'), 118);
});
test('0.9736 (97.36%) CON clasificacion "porcentaje" -> 97.4 (redondeo a 1 decimal, caso normal <=100%)', () => {
  assert.equal(_eaPctDesdeCelda(0.9736, 'porcentaje'), 97.4);
});
test('50 CON clasificacion "numero" (celda sin formato %, valor ya en escala 0-100) -> 50, nunca x100', () => {
  assert.equal(_eaPctDesdeCelda(50, 'numero'), 50);
});

// ── Integracion: efectividadAgendamientoParseFilas con `ws` ──────────────
const HEADER = ['NOMBRE DE AGENTE', 'CANTIDAD DE GESTIONES', 'AGENDAS', 'EFECTIVIDAD', 'MES'];
function wsConEfectividad(filaAoa0based, valorCrudo) {
  return { '!ref': 'A3:E22', [_eaCeldaRef({ '!ref': 'A3:E22' }, filaAoa0based, 3)]: { t: 'n', v: valorCrudo, z: '0%' } };
}

test('FIX end-to-end: asesor con agendas > gestiones (efectividad > 100%) y `ws` -> SIN advertencia (el archivo SI coincide con el recalculo)', () => {
  // Fila aoa 1 (la unica fila de datos aqui): Excel row = 3+1 = 4.
  const aoa = [HEADER, ['ASESOR DEMO UNO', 1133, 1337, 1.180052956751986, 'AGOSTO']];
  const ws = wsConEfectividad(1, 1.180052956751986);
  const res = efectividadAgendamientoParseFilas(aoa, HOY, ws);
  assert.ok(!res.error, JSON.stringify(res));
  assert.equal(res.filas.length, 1);
  assert.equal(res.advertenciasEfectividad.length, 0, JSON.stringify(res.advertenciasEfectividad));
});

test('SIN `ws` (comportamiento de siempre): la MISMA fila SI genera advertencia (hallazgo real documentado, nunca se corrige sin `ws`)', () => {
  const aoa = [HEADER, ['ASESOR DEMO UNO', 1133, 1337, 1.180052956751986, 'AGOSTO']];
  const res = efectividadAgendamientoParseFilas(aoa, HOY); // sin ws
  assert.ok(!res.error, JSON.stringify(res));
  assert.equal(res.advertenciasEfectividad.length, 1);
});

test('Caso normal (<=100%) sigue funcionando igual CON `ws`: 0 advertencias cuando el archivo coincide con el recalculo', () => {
  const aoa = [HEADER, ['ASESOR DEMO DOS', 1000, 400, 0.4, 'AGOSTO']];
  const ws = wsConEfectividad(1, 0.4);
  const res = efectividadAgendamientoParseFilas(aoa, HOY, ws);
  assert.equal(res.advertenciasEfectividad.length, 0);
});

test('Caso normal (<=100%) con un archivo que SI difiere del recalculo -- la advertencia real sigue funcionando con `ws`', () => {
  const aoa = [HEADER, ['ASESOR DEMO TRES', 1000, 400, 0.5, 'AGOSTO']]; // archivo dice 50%, recalculo da 40%
  const ws = wsConEfectividad(1, 0.5);
  const res = efectividadAgendamientoParseFilas(aoa, HOY, ws);
  assert.equal(res.advertenciasEfectividad.length, 1);
  assert.match(res.advertenciasEfectividad[0], /50%.*no coincide con el recalculo \(40%\)/);
});
