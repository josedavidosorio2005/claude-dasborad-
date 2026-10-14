// fase144-a6-mes-sin-datos.test.js — Fase 144 (A6, hallazgo D05 de la Fase
// 143): con el mes elegido sin monitoreos (el mes en curso), en Calidad el
// aviso "Sin datos... Ver <mes>" quedaba encajado en una celda de ~150px de
// la grilla de KPIs (5 renglones) y "Distribucion de clasificacion" /
// "Promedio por asesor" quedaban como canvas vacios, sin texto.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, '..', '..', 'public');
const gd = fs.readFileSync(path.join(PUB, 'js', 'dashboard-generic.js'), 'utf8');
const css = fs.readFileSync(path.join(PUB, 'css', 'styles.css'), 'utf8');

test('_gdAvisoSinDatosMesHtml: clase .gd-aviso-mes con role="status" (sin estilo en linea)', () => {
  const f = gd.slice(gd.indexOf('function _gdAvisoSinDatosMesHtml'), gd.indexOf('function _gdPanelVacioEnCanvas'));
  assert.match(f, /'<div class="gd-aviso-mes" role="status">'\+msg\+'<\/div>'/);
  assert.doesNotMatch(f, /style="text-align:center/);
});

test('CSS: el aviso ocupa todo el ancho dentro de la grilla de KPIs y el panel vacio centra su texto', () => {
  assert.match(css, /\.aurora-kpis > \.gd-aviso-mes\{grid-column:1 \/ -1;flex-basis:100%;\}/);
  assert.match(css, /\.gd-aviso-mes\{text-align:center;color:var\(--c-text-muted\)/);
  assert.match(css, /\.gd-panel-vacio\{display:flex;align-items:center;justify-content:center;height:100%;color:var\(--c-text-muted\)/);
});

test('Calidad sin datos del mes: los paneles de grafica muestran una linea de texto en vez de un canvas vacio', () => {
  const f = gd.slice(gd.indexOf('function _gdRenderCalidad'), gd.indexOf("if(!estado.asesores) estado.asesores"));
  assert.match(f, /_gdPanelVacioEnCanvas\(i, 'Sin monitoreos en ' \+/);
  assert.match(f, /mesNombreLargo\(_gd\.mesSel\)/);
  const helper = gd.slice(gd.indexOf('function _gdPanelVacioEnCanvas'), gd.indexOf('function renderGenericBanner'));
  assert.match(helper, /_gd\.charts\[canvasId\]\.destroy\(\)/, 'destruye el grafico de Chart.js si existia');
  assert.match(helper, /'<div class="gd-panel-vacio">'\+esc\(texto\)\+'<\/div>'/);
});
