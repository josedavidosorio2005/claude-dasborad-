// fase160-asa-ata-separadas.test.js — Fase 160 (pedido de Edwin): en Flujo de
// Llamadas (Mobilize y ORLANT), la sub-pestaña "ASA y ATA" muestra DOS
// graficas, una debajo de la otra, con los mismos datos y el mismo estilo, y
// "Ver datos" en cada una (con su propio titulo). Fase 163: WhatsApp tambien
// las separa (antes seguia con una sola grafica).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS = path.join(__dirname, '..', '..', 'public', 'js');
function cargar() {
  const graficas = {};
  const ctx = {
    esc: (s) => String(s),
    colorSerie: (k) => (k === 'principal' ? '#111' : '#222'),
    lo: () => ({ responsive: true, maintainAspectRatio: false, plugins: {}, scales: { y: { ticks: {} } } }),
    loDatalabelsAuto: (o) => { o.plugins.datalabels = { display: 'auto' }; },
    // JSON: los arreglos creados dentro del vm son de otro contexto.
    _gdChart: (id, cfg) => { graficas[id] = JSON.parse(JSON.stringify(cfg)); },
    gdGraficaHtml: require('../../public/js/secciones-logic.js').gdGraficaHtml, // Fase 163
    console,
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(JS, 'trafico.js'), 'utf8'), ctx);
  return { ctx, graficas };
}
const AGREGADO = [
  { periodo: '2026-08', asaSegundos: 11, ataSegundos: 30 },
  { periodo: '2026-09', asaSegundos: 9, ataSegundos: 0 },
];

test('Flujo de Llamadas: "ASA y ATA" trae 2 graficas, ASA arriba y ATA abajo, cada una con su titulo', () => {
  const { ctx } = cargar();
  const html = ctx._traficoSubtabContentHTML('tv', 0, 'asaata');
  const asa = html.indexOf('id="tv-canvas-asaata-0"');
  const ata = html.indexOf('id="tv-canvas-ata-0"');
  assert.ok(asa !== -1 && ata !== -1 && asa < ata, 'ASA arriba y ATA abajo');
  assert.match(html, /data-titulo="ASA — tiempo promedio de respuesta"/);
  assert.match(html, /data-titulo="ATA — tiempo promedio de abandono"/);
  assert.equal((html.match(/aurora-chart-wrap/g) || []).length, 2, 'un contenedor por grafica (cada uno con su Ver datos)');
  // Fase 163: cada una en su propio cuadro, con su titulo visible.
  assert.equal((html.match(/<section class="gd-grafica">/g) || []).length, 2, 'un cuadro por grafica');
  assert.match(html, /<h4 class="gd-grafica-titulo">ASA — tiempo promedio de respuesta/);
  assert.match(html, /<h4 class="gd-grafica-titulo">ATA — tiempo promedio de abandono/);
});

test('mismos datos y mismo estilo: una serie por grafica, con los colores de antes', () => {
  const { ctx, graficas } = cargar();
  ctx._traficoDibujarAsaAta('tv', 0, AGREGADO, null, false, true);
  const asa = graficas['tv-canvas-asaata-0'];
  const ata = graficas['tv-canvas-ata-0'];
  assert.ok(asa && ata, 'se dibujan las 2');
  assert.deepEqual(asa.data.datasets.map((d) => d.label), ['ASA']);
  assert.deepEqual(ata.data.datasets.map((d) => d.label), ['ATA']);
  assert.deepEqual(asa.data.datasets[0].data, [11, 9]);
  assert.deepEqual(ata.data.datasets[0].data, [30, 0]);
  assert.deepEqual(asa.data.labels, ['2026-08', '2026-09']);
  assert.equal(asa.data.datasets[0].borderColor, '#111');
  assert.equal(ata.data.datasets[0].borderColor, '#222');
  assert.equal(asa.type, 'line');
  assert.equal(ata.type, 'line');
});

test('Fase 163: WhatsApp tambien separa ASA y ATA en 2 graficas (antes era una sola)', () => {
  const { ctx, graficas } = cargar();
  const html = ctx._traficoSubtabContentHTML('tww', 0, 'asaata');
  assert.equal((html.match(/<canvas/g) || []).length, 2);
  const asa = html.indexOf('id="tww-canvas-asaata-0"');
  const ata = html.indexOf('id="tww-canvas-ata-0"');
  assert.ok(asa !== -1 && ata !== -1 && asa < ata, 'ASA arriba y ATA abajo');
  assert.equal((html.match(/<section class="gd-grafica">/g) || []).length, 2, 'un cuadro por grafica');
  ctx._traficoDibujarAsaAta('tww', 0, AGREGADO, null, false, true);
  assert.deepEqual(graficas['tww-canvas-asaata-0'].data.datasets.map((d) => d.label), ['ASA']);
  assert.deepEqual(graficas['tww-canvas-ata-0'].data.datasets.map((d) => d.label), ['ATA']);
  assert.deepEqual(graficas['tww-canvas-ata-0'].data.datasets[0].data, [30, 0]);
  // Y el panel de WhatsApp las pide separadas.
  const src = fs.readFileSync(path.join(JS, 'trafico-whatsapp.js'), 'utf8');
  assert.match(src, /_traficoDibujarAsaAta\('tww', i, agregadoComb, _traficoWppFmtTiempo, false, true\)/);
});

test('Ver datos usa el titulo propio de cada grafica', () => {
  const src = fs.readFileSync(path.join(JS, 'dashboard-generic.js'), 'utf8');
  assert.match(src, /function _gdTituloGrafica\(el\)\{[\s\S]{0,300}data-titulo/);
});
