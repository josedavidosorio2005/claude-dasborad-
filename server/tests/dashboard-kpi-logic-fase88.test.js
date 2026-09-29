// dashboard-kpi-logic-fase88.test.js — Fase 88 (hallazgo real del barrido).
//
// _gdDatosKpis (public/js/dashboard-generic.js, boton "Exportar") calculaba
// "% Meta" con `meta ? Math.round((cur / meta) * 1000) / 10 : ''` -- SIN
// chequear `cur`. Con `cur` null (sin dato del periodo elegido) pero
// `meta` configurada (ej. KPI "Ventas" de TELEVENTAS SURA/INFONDO/etc.),
// `null / meta` da 0 en JS, asi que el archivo exportado mostraba
// "% Meta: 0" -- como si la meta estuviera 0% cumplida en vez de "sin
// dato". La tarjeta en pantalla (_gdKpiCardHtml) SI tenia el guard
// correcto (`cur !== null && cur !== undefined`), asi que pantalla y
// export mostraban cosas distintas para el mismo KPI.
//
// Fix: gdPorcentajeMeta(cur, meta) (dashboard-kpi-logic.js, doble modo,
// sin DOM) es ahora la UNICA implementacion -- la usan tanto la tarjeta
// como el export.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { gdPorcentajeMeta } = require('../../public/js/dashboard-kpi-logic.js');

test('gdPorcentajeMeta: cur null y meta configurada -> null (nunca 0) -- el hallazgo real del barrido', () => {
  assert.equal(gdPorcentajeMeta(null, 100), null);
  assert.equal(gdPorcentajeMeta(undefined, 100), null);
});

test('gdPorcentajeMeta: caso normal -- redondeado a 1 decimal', () => {
  assert.equal(gdPorcentajeMeta(87, 100), 87);
  assert.equal(gdPorcentajeMeta(123, 456), 27);
  assert.equal(gdPorcentajeMeta(1, 3), 33.3);
});

test('gdPorcentajeMeta: sin meta (null/undefined/0) -> null, incluso con cur valido', () => {
  assert.equal(gdPorcentajeMeta(50, null), null);
  assert.equal(gdPorcentajeMeta(50, undefined), null);
  assert.equal(gdPorcentajeMeta(50, 0), null, 'meta 0 nunca debe dividir (evita Infinity)');
});

test('gdPorcentajeMeta: cur 0 (dato real, cero interacciones) SI calcula -- 0 es un dato, no "sin dato"', () => {
  assert.equal(gdPorcentajeMeta(0, 100), 0);
});
