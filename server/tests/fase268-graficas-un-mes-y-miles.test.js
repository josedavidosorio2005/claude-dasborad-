// fase268-graficas-un-mes-y-miles.test.js — Fase 268 (revision del 05/11 de
// Aurora y HLM): (a) ejes con el formato de numero de Colombia ("1.000");
// (b) Aurora › Agendas por usuaria con un solo mes: barras, no un punto suelto;
// con 2 o mas meses, lineas con el eje desde 0. Datos inventados.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');

test('Chart.js usa es-CO para los numeros de los ejes (todas las graficas)', () => {
  const src = JS('charts.js');
  assert.match(src, /Chart\.defaults\.locale = 'es-CO';/);
  // El formato que pide ese locale: punto de miles.
  assert.equal(new Intl.NumberFormat('es-CO').format(12087), '12.087');
});

async function pintar(filas, vista) {
  const graficas = [];
  const el = { innerHTML: '', dataset: {} };
  const ctx = {
    console, URLSearchParams, Intl,
    document: { getElementById: (id) => (id === 'gd-p0' ? el : null), addEventListener: () => {} },
    esc: (s) => String(s == null ? '' : s),
    _gd: { cliente: 'CLINICA AURORA', config: { layout: { tabs: [] } } },
    apiRequest: async () => ({ filas }),
    gdMesesTarjetasActual: () => [],
    mesNombreLargo: (m) => m,
    lo: () => ({ responsive: true, maintainAspectRatio: false, plugins: { datalabels: {} } }),
    loBar: () => ({ responsive: true, maintainAspectRatio: false, plugins: { datalabels: {} } }),
    loDatalabelsAuto: () => {},
    SERIE_PRINCIPAL: '#003d4c', PC: ['#1', '#2', '#3'],
    _gdChart: (id, cfg) => graficas.push({ id, cfg }),
    kpiTarjetaHtml: () => '',
  };
  vm.createContext(ctx);
  vm.runInContext(JS('agendas-usuaria-logic.js'), ctx);
  vm.runInContext(JS('agendas-usuaria.js'), ctx);
  await ctx._auRender({ campana: 'CLINICA AURORA', vista }, 0);
  return graficas;
}
const fila = (mes, asesora, n) => ({ mes, fechaCita: mes + '-10', fechaSolicitud: mes + '-01', sede: 'Sede A', usuario: 'INCONEXION', asesora, especialidad: 'GENERAL', n });

test('Agendas por mes: un mes = barra con eje desde 0; dos meses = linea con eje desde 0', async () => {
  let g = await pintar([fila('2026-10', 'Asesora Uno', 1600), fila('2026-10', 'Asesora Dos', 78)], 'mes');
  assert.equal(g.length, 1);
  assert.equal(g[0].cfg.type, 'bar');
  assert.equal(g[0].cfg.options.scales.y.beginAtZero, true);
  assert.deepEqual(Array.from(g[0].cfg.data.datasets[0].data), [1678]);
  g = await pintar([fila('2026-09', 'Asesora Uno', 10), fila('2026-10', 'Asesora Uno', 12)], 'mes');
  assert.equal(g[0].cfg.type, 'line');
  assert.equal(g[0].cfg.options.scales.y.beginAtZero, true);
});

test('Agendas por asesor: un mes = barras horizontales por asesora (de mayor a menor, con %); dos meses = una linea por asesora', async () => {
  let g = await pintar([fila('2026-10', 'Asesora Uno', 30), fila('2026-10', 'Asesora Dos', 70)], 'asesor');
  assert.equal(g.length, 1);
  assert.equal(g[0].cfg.type, 'bar');
  assert.equal(g[0].cfg.options.indexAxis, 'y');
  assert.deepEqual(Array.from(g[0].cfg.data.labels), ['Asesora Dos', 'Asesora Uno']);
  assert.deepEqual(Array.from(g[0].cfg.data.datasets[0].data), [70, 30]);
  assert.equal(g[0].cfg.options.plugins.datalabels.formatter(70, { dataIndex: 0 }), '70 (70 %)');
  g = await pintar([fila('2026-09', 'Asesora Uno', 5), fila('2026-10', 'Asesora Uno', 6), fila('2026-10', 'Asesora Dos', 7)], 'asesor');
  assert.equal(g[0].cfg.type, 'line');
  assert.equal(g[0].cfg.data.datasets.length, 2);
  assert.equal(g[0].cfg.options.scales.y.beginAtZero, true);
});
