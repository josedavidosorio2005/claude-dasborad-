// cargas-logic.test.js — cubre public/js/cargas-logic.js (parseo de la carga
// de datos operativos de dashboards de cliente y, sobre todo, la deteccion
// de formulas de Excel sin valor calculado). Reproduce el bug real reportado
// en la campana ALBERTO LINERO GO: un .xlsx generado por script (nunca
// abierto en Excel/LibreOffice) guarda formulas =COUNTA/=COUNTIF apuntando a
// una hoja de detalle, pero no su resultado — la vista previa mostraba "—"
// en silencio. Corre contra dos .xlsx REALES en fixtures/ (uno con ese bug,
// otro con los valores literales que la plantilla realmente pide). Ver
// server/tests/helpers/xlsx-lite.js para por que se leen a mano en vez de
// con el paquete npm `xlsx`.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { leerHojaXlsxComoAoA, leerHojaXlsxComoCeldas } = require('./helpers/xlsx-lite');
const {
  cargasColPorLabel,
  cargasParseFilaUnica,
  cargasParseMultiFila,
  cargasDetectarFormulaSinValor,
} = require('../../public/js/cargas-logic.js');

const FIXTURE_FORMULAS = path.join(__dirname, 'fixtures', 'carga-formula-sin-valor.xlsx');
const FIXTURE_LITERALES = path.join(__dirname, 'fixtures', 'carga-valores-literales.xlsx');

// Spec equivalente a la seccion "resumen" de ALBERTO LINERO GO
// (server/dashboard-plantillas-cliente.js, plantillaVentas) — la campana
// real donde se reporto el bug.
const SPEC_RESUMEN_VENTAS = {
  filaUnica: true,
  columnas: [
    { key: 'base_asignada', label: 'Base asignada', tipo: 'entero' },
    { key: 'gestionados', label: 'Registros gestionados', tipo: 'entero' },
    { key: 'contactados', label: 'Contactados', tipo: 'entero' },
    { key: 'contactos_efectivos', label: 'Contactos efectivos', tipo: 'entero' },
    { key: 'ventas', label: 'Ventas', tipo: 'entero' },
    { key: 'meta_ventas', label: 'Meta de ventas', tipo: 'entero' },
    { key: 'aht_segundos', label: 'AHT promedio (segundos)', tipo: 'entero' },
  ],
};

test('cargasDetectarFormulaSinValor: detecta la primera formula sin calcular en el .xlsx real con el bug', () => {
  const ws = leerHojaXlsxComoCeldas(FIXTURE_FORMULAS, 'Datos');
  const r = cargasDetectarFormulaSinValor(ws);
  assert.ok(r, 'deberia detectar una celda con formula sin valor');
  assert.equal(r.celda, 'B2'); // "Base asignada" es la primera fila con formula
  assert.equal(r.etiqueta, 'Base asignada');
  assert.match(r.formula, /COUNTA/);
  assert.match(r.mensaje, /formula de Excel/i);
  assert.match(r.mensaje, /Base asignada/);
});

test('cargasDetectarFormulaSinValor: no marca la fila con valor literal (Meta de ventas) ni la ignora al buscar otras', () => {
  const ws = leerHojaXlsxComoCeldas(FIXTURE_FORMULAS, 'Datos');
  // La celda de "Meta de ventas" (B7) es literal: no debe ser la que se reporta.
  const r = cargasDetectarFormulaSinValor(ws);
  assert.notEqual(r.celda, 'B7');
});

test('cargasDetectarFormulaSinValor: null cuando todas las celdas son valores literales (plantilla llenada a mano)', () => {
  const ws = leerHojaXlsxComoCeldas(FIXTURE_LITERALES, 'Datos');
  assert.equal(cargasDetectarFormulaSinValor(ws), null);
});

test('cargasDetectarFormulaSinValor: null / no revienta con worksheet vacio o undefined', () => {
  assert.equal(cargasDetectarFormulaSinValor(undefined), null);
  assert.equal(cargasDetectarFormulaSinValor({}), null);
});

test('cargasParseFilaUnica: el archivo con valores literales SI se parsea correctamente (camino feliz)', () => {
  const aoa = leerHojaXlsxComoAoA(FIXTURE_LITERALES, 'Datos');
  const res = cargasParseFilaUnica(SPEC_RESUMEN_VENTAS, aoa);
  assert.equal(res.error, undefined);
  assert.equal(res.filas.length, 1);
  const fila = res.filas[0];
  assert.equal(fila.base_asignada, 500);
  assert.equal(fila.gestionados, 430);
  assert.equal(fila.contactados, 310);
  assert.equal(fila.contactos_efectivos, 180);
  assert.equal(fila.ventas, 42);
  assert.equal(fila.meta_ventas, 80);
});

test('cargasParseFilaUnica: el archivo con formulas sin calcular produce valores vacios (por eso hace falta el chequeo previo)', () => {
  // Esto documenta el bug tal cual lo veia el usuario antes del fix: sin
  // pasar primero por cargasDetectarFormulaSinValor, el parseo "funciona"
  // pero deja las metricas con formula en blanco -> la vista previa mostraba "—".
  const aoa = leerHojaXlsxComoAoA(FIXTURE_FORMULAS, 'Datos');
  const res = cargasParseFilaUnica(SPEC_RESUMEN_VENTAS, aoa);
  assert.equal(res.error, undefined);
  const fila = res.filas[0];
  // formula sin valor -> celda "vacia" (leerHojaXlsxComoAoA usa null para
  // celdas sin <v>, igual que XLSX.utils.sheet_to_json sin defval; en el
  // navegador cargas.js pasa defval:'' y el resultado visible es "—").
  assert.equal(fila.base_asignada, null);
  assert.equal(fila.meta_ventas, 80); // el unico literal si se lee bien
});

test('cargasColPorLabel: empareja por label o por key, normalizando mayusculas/espacios', () => {
  const col = cargasColPorLabel(SPEC_RESUMEN_VENTAS, '  ventas  ');
  assert.equal(col.key, 'ventas');
  assert.equal(cargasColPorLabel(SPEC_RESUMEN_VENTAS, 'no existe'), null);
});

test('cargasParseMultiFila: descarta filas vacias y columnas que no coinciden con la plantilla', () => {
  const spec = { columnas: [{ key: 'fecha', label: 'Fecha' }, { key: 'ventas', label: 'Ventas' }] };
  const aoa = [
    ['Fecha', 'Ventas', 'Columna extra'],
    ['2026-09-01', 5, 'x'],
    ['', '', ''],
    ['2026-09-02', 3, 'y'],
  ];
  const res = cargasParseMultiFila(spec, aoa);
  assert.equal(res.filas.length, 2);
  assert.equal(res.filas[0].fecha, '2026-09-01');
  assert.equal(res.filas[0].ventas, 5);
  assert.equal(res.filas[0]['Columna extra'], undefined);
});
