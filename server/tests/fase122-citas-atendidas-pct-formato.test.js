// fase122-citas-atendidas-pct-formato.test.js — Fase 122 (mismo hallazgo
// real que fase122-efectividad-agendamiento-pct-formato.test.js, aplicado
// por consistencia/defensa en profundidad -- ATENDIDAS > AGENDAS no se vio
// en ningun archivo real de esta fase, pero es el mismo codigo
// copiado/adaptado con el mismo defecto, y nada impide que algun dia
// aparezca). Mismo patron: _caClasificarCeldaNumerica lee el FORMATO real
// de la celda ('z' contiene "%") en vez de adivinar "<=1 es fraccion" por
// el valor -- cubre correctamente una EFECTIVIDAD CITAS ATENDIDAS > 100%.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  _caCeldaRef,
  _caClasificarCeldaNumerica,
  _caPctDesdeCelda,
  citasAtendidasParseFilas,
} = require('../../public/js/citas-atendidas-logic.js');

const HOY = new Date('2026-10-05T12:00:00Z');

test('_caCeldaRef: con ws["!ref"]="A3:D22" (header fuera de la fila 1), offset correcto', () => {
  const ws = { '!ref': 'A3:D22' };
  assert.equal(_caCeldaRef(ws, 0, 0), 'A3');
  assert.equal(_caCeldaRef(ws, 5, 3), 'D8');
});

test('_caPctDesdeCelda: 1.18 (118%) SIN clasificacion -> se adivina mal como 1.18% (comportamiento de siempre, documentado)', () => {
  assert.equal(_caPctDesdeCelda(1.18), 1.18);
});
test('_caPctDesdeCelda: 1.18 (118%) CON clasificacion "porcentaje" -> 118 (correcto)', () => {
  assert.equal(_caPctDesdeCelda(1.18, 'porcentaje'), 118);
});

const HEADER = ['MES', 'AGENDAS', 'ATENDIDAS', 'EFECTIVIDAD CITAS ATENDIDAS'];
test('citasAtendidasParseFilas end-to-end: ATENDIDAS > AGENDAS (caso extremo) con `ws` -> SIN advertencia cuando el archivo SI coincide con el recalculo', () => {
  const wsRef = { '!ref': 'A3:D22' };
  const addr = _caCeldaRef(wsRef, 1, 3);
  const aoa = [HEADER, ['ENERO', 100, 150, 1.5]];
  const ws = Object.assign({}, wsRef, { [addr]: { t: 'n', v: 1.5, z: '0%' } });
  const res = citasAtendidasParseFilas(aoa, HOY, ws);
  assert.ok(!res.error, JSON.stringify(res));
  assert.equal(res.advertenciasEfectividad.length, 0, JSON.stringify(res.advertenciasEfectividad));
});

test('Caso normal (<=100%) sin cambios con `ws`: 0 advertencias cuando coincide', () => {
  const wsRef = { '!ref': 'A3:D22' };
  const addr = _caCeldaRef(wsRef, 1, 3);
  const aoa = [HEADER, ['ENERO', 158, 148, 0.9367088607594937]];
  const ws = Object.assign({}, wsRef, { [addr]: { t: 'n', v: 0.9367088607594937, z: '0%' } });
  const res = citasAtendidasParseFilas(aoa, HOY, ws);
  assert.equal(res.advertenciasEfectividad.length, 0);
});
