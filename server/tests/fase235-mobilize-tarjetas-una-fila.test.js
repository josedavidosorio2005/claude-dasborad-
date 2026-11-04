// fase235-mobilize-tarjetas-una-fila.test.js — Fase 235: las 8 tarjetas del
// resumen de Flujo de Llamadas de Mobilize (resumenSoloTitulos) caben en una
// fila desde 1024 px (clase kpis-fila-ancha); ORLANT y el celular no cambian.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS = path.join(__dirname, '..', '..', 'public', 'js');
const { traficoOrdenTarjetas } = require(path.join(JS, 'trafico-logic.js'));

function extraer(src, firma) {
  const ini = src.indexOf(firma);
  return src.slice(ini, src.indexOf('\n}\n', ini) + 2);
}
function dibujar(ctxKpis) {
  const clases = new Set();
  const el = { innerHTML: '', classList: { toggle: (c, on) => (on ? clases.add(c) : clases.delete(c)) } };
  const ctx = { document: { getElementById: () => el }, esc: (s) => String(s == null ? '' : s), traficoOrdenTarjetas, _gdUmbralPara: () => null };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(JS, 'kpi-tarjeta-logic.js'), 'utf8'), ctx);
  vm.runInContext(extraer(fs.readFileSync(path.join(JS, 'trafico.js'), 'utf8'), 'function _traficoDibujarKpis('), ctx);
  ctx._traficoDibujarKpis('tv', 0, { total: 1, contestadas: 1, abandonadas: 0, nivelAtencion: 100, tasaAbandono: 0, nivelServicio: 90 },
    { total: 'Llamadas ingresadas', contestadas: 'Llamadas contestadas', abandonadas: 'Llamadas abandonadas' }, 'X', null, ctxKpis);
  return clases;
}

test('Mobilize (solo títulos): la fila lleva kpis-fila-ancha; ORLANT no', () => {
  assert.ok(dibujar({ soloTitulos: true, eficaciaEnResumen: true }).has('kpis-fila-ancha'));
  assert.ok(!dibujar({}).has('kpis-fila-ancha'));
});

test('CSS: columnas más angostas solo desde 1024 px y solo para esa fila', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'css', 'styles.css'), 'utf8');
  assert.match(css, /@media\(min-width:1024px\)\{#gd-panels \.aurora-kpis\.kpis-fila-ancha\{grid-template-columns:repeat\(auto-fit,minmax\(124px,1fr\)\);\}\}/);
  // 8 tarjetas de 124 px + 7 espacios de 12 px = 1076 px: caben en el panel a 1280 px y a 1440 px
  assert.ok(8 * 124 + 7 * 12 <= 1180);
  // la grilla general de siempre no cambia
  assert.match(css, /\.aurora-kpis\{display:grid;grid-template-columns:repeat\(auto-fill,minmax\(160px,1fr\)\);/);
});
