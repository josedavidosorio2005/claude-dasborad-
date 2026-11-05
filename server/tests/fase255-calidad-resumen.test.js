// fase255-calidad-resumen.test.js — Fase 255 (plan de Calidad B4): Resumen por
// asesor, items mas afectados, Detalle por mes y Diccionario (logica pura del
// navegador, compartida con la pestaña Calidad y Mis resultados). Datos SINTETICOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../../public/js/calidad-analisis-logic.js');

const ITEMS = [
  { n: 1, cat: 'Apertura', label: 'Saluda', weight: 30, critico: false },
  { n: 2, cat: 'Normativo', label: 'Valida', weight: 40, critico: true },
  { n: 3, cat: 'Cierre', label: 'Despide', weight: 30, critico: false, admiteNA: false },
];
const PL = [{ id: 10, campana: 'MOBILIZE', principal: true, items: ITEMS }, { id: 11, campana: 'MOBILIZE', principal: false, items: ITEMS }, { id: 1, campana: 'ORLANT', principal: true, items: [] }];
const M = [
  { id: 1, campana: 'MOBILIZE', plantillaId: 10, asesor: 'Ana Uno', fecha: '2026-10-03', puntaje: 100, fallos: 0, answers: { 1: 'SI', 2: 'SI', 3: 'SI' } },
  { id: 2, campana: 'MOBILIZE', plantillaId: 10, asesor: 'ana uno ', fecha: '2026-11-02', puntaje: 50, fallos: 1, answers: { 1: 'NO', 2: 'NO', 3: 'SI' } },
  { id: 3, campana: 'MOBILIZE', plantillaId: 10, asesor: 'Beto Dos', fecha: '2026-11-04', puntaje: 70, fallos: 0, answers: { 1: 'SI', 2: 'SI', 3: 'NO' } },
  { id: 4, campana: 'MOBILIZE', plantillaId: 10, asesor: 'Beto Dos', fecha: '2026-11-05', puntaje: 40, fallos: 2, answers: { 1: 'NO', 2: 'NO', 3: 'SI' } },
];

test('plantilla del monitoreo: por id o, si es viejo (NULL), la principal de su campaña', () => {
  assert.equal(A.caPlantillaDe({ plantillaId: 11, campana: 'MOBILIZE' }, PL).id, 11);
  assert.equal(A.caPlantillaDe({ plantillaId: null, campana: 'ORLANT' }, PL).id, 1);
  assert.equal(A.caPlantillaDe({ plantillaId: 99, campana: 'MOBILIZE' }, PL), null);
});

test('KPIs y resumen por asesor (nombres sin distinguir mayusculas/espacios; alerta del resumen)', () => {
  const k = A.caKpis(M);
  assert.deepEqual([k.total, k.promedio, k.criticosAbsolutos, k.asesores, k.clase.k], [4, 65, 1, 2, 'bad']);
  assert.deepEqual(A.caKpis([]), { total: 0, promedio: null, clase: { k: 'na', t: 'Sin datos' }, criticosAbsolutos: 0, asesores: 0 });
  const r = A.caResumenAsesores(M);
  assert.deepEqual(r.map((x) => [x.asesor, x.monitoreos, x.promedio, x.fallos, x.alerta.t, x.mejor, x.peor]),
    [['Ana Uno', 2, 75, 1, 'Alerta', 100, 50], ['Beto Dos', 2, 55, 2, 'Crítico frecuente', 70, 40]]);
  assert.equal(A.caAlertaResumen(0).t, 'Sin fallos críticos');
  assert.deepEqual([A.caClase(69.9).t, A.caClase(70).t, A.caClase(90).t], ['Crítico', 'No crítico', 'Sobresaliente']);
});

test('items mas afectados con los asesores que los fallaron', () => {
  const a = A.caItemsAfectados(M, ITEMS);
  assert.deepEqual(a.map((x) => [x.it.n, x.fallos, x.pct]), [[1, 2, 50], [2, 2, 50], [3, 1, 25]]);
  assert.deepEqual(a[0].asesores, [{ asesor: 'ana uno', veces: 1 }, { asesor: 'Beto Dos', veces: 1 }], 'empate: orden alfabetico');
});

test('por mes, por clasificacion y filtro del detalle (mes + texto, mas nuevo primero)', () => {
  assert.deepEqual(A.caPorMes(M).map((x) => [x.mes, x.monitoreos, x.promedio]), [['2026-10', 1, 100], ['2026-11', 3, 53.3]]);
  assert.deepEqual(A.caPorClasificacion(M), { ok: 1, warn: 1, bad: 2 });
  assert.deepEqual(A.caFiltrar(M, '2026-11', '').map((m) => m.id), [4, 3, 2]);
  assert.deepEqual(A.caFiltrar(M, '', 'BETO').map((m) => m.id), [4, 3]);
  assert.deepEqual(A.caFiltrar(M, '2026-10', 'beto'), []);
});

test('diccionario: reglas e impacto de cada respuesta', () => {
  assert.equal(A.caReglasDiccionario({ items: ITEMS })[0], '3 ítems · 1 críticos · los pesos suman 100');
  assert.deepEqual(A.caImpacto(ITEMS[1]), [['SI', '+40'], ['N/A', '+40'], ['NO', '20']]);
  assert.deepEqual(A.caImpacto(ITEMS[2]), [['SI', '+30'], ['N/A', 'No aplica'], ['NO', '0']]);
});
