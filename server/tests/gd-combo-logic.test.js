// gd-combo-logic.test.js — cubre public/js/gd-combo-logic.js (armado de los
// datasets Chart.js del panel `combo`, barras + linea). Bug real de la Fase
// 75 (verificado con Playwright contra ORLANT/Gestion STA/"Servicios
// Gestionados del Mes"): con 1 sola categoria en el eje X, la barra ocupaba
// casi todo el ancho del panel y tapaba el punto de la linea -- el dato se
// calculaba bien (334/417 = 80.1%, confirmado igual que "STA por Mes"), el
// problema era solo de dibujo. Arreglado en la Fase 76.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  GD_COMBO_BAR_MAX_THICKNESS,
  GD_COMBO_ORDER_BARRA,
  GD_COMBO_ORDER_LINEA,
  gdComboDatasets,
} = require('../../public/js/gd-combo-logic');

test('gdComboDatasets: 1 sola barra + linea -- la barra trae un tope de ancho (maxBarThickness) y la linea un order menor (se dibuja encima)', () => {
  const barras = [{ label: 'Ordenes', data: [417], color: '#123456' }];
  const linea = { label: '% Efectividad', data: [80.1], color: '#e67e22' };
  const ds = gdComboDatasets(barras, linea);

  assert.equal(ds.length, 2);
  const [barDs, lineDs] = ds;
  assert.equal(barDs.type, 'bar');
  assert.equal(barDs.maxBarThickness, GD_COMBO_BAR_MAX_THICKNESS);
  assert.ok(GD_COMBO_BAR_MAX_THICKNESS > 0 && GD_COMBO_BAR_MAX_THICKNESS < 200, 'el tope debe ser un ancho de panel razonable, no gigante');
  assert.equal(lineDs.type, 'line');
  assert.equal(barDs.order, GD_COMBO_ORDER_BARRA);
  assert.equal(lineDs.order, GD_COMBO_ORDER_LINEA);
  assert.ok(lineDs.order < barDs.order, 'la linea debe tener un order MENOR que la barra -- Chart.js dibuja primero (mas abajo) el order mas alto');
  // Punto visible: radio > 0 y borde de contraste, no el pointRadius:4 sin
  // borde de antes (facil de perder contra una barra del mismo color de fondo).
  assert.ok(lineDs.pointRadius >= 4);
  assert.equal(lineDs.pointBorderColor, '#fff');
  assert.ok(lineDs.pointBorderWidth > 0);
});

test('gdComboDatasets: varias barras -- TODAS comparten el mismo order (el orden relativo entre ellas no cambia)', () => {
  const barras = [
    { label: 'Cargadas', data: [100, 200, 150], color: '#111' },
    { label: 'Agendadas', data: [90, 180, 140], color: '#222' },
    { label: 'Facturado', data: [80, 170, 130], color: '#333' },
  ];
  const linea = { label: '% Efectividad', data: [80, 85, 87], color: '#e67e22' };
  const ds = gdComboDatasets(barras, linea);

  assert.equal(ds.length, 4);
  const ordenesBarras = ds.slice(0, 3).map((d) => d.order);
  assert.deepEqual(ordenesBarras, [GD_COMBO_ORDER_BARRA, GD_COMBO_ORDER_BARRA, GD_COMBO_ORDER_BARRA]);
  assert.equal(ds[3].order, GD_COMBO_ORDER_LINEA);
  // El tope de ancho esta ahi, pero con 3 series compartiendo el eje X
  // Chart.js nunca llega a necesitarlo -- no es un cambio de comportamiento
  // visual para este caso (solo un techo que no se toca).
  ds.slice(0, 3).forEach((d) => assert.equal(d.maxBarThickness, GD_COMBO_BAR_MAX_THICKNESS));
});

test('gdComboDatasets: sin linea (p.linea no configurado) -- solo llegan los datasets de barra, comportamiento identico a antes', () => {
  const barras = [{ label: 'Ordenes', data: [10, 20], color: '#123456' }];
  const ds = gdComboDatasets(barras, null);
  assert.equal(ds.length, 1);
  assert.equal(ds[0].type, 'bar');
});

test('gdComboDatasets: sin barras -- no revienta, devuelve solo la linea', () => {
  const linea = { label: '% Efectividad', data: [50], color: '#e67e22' };
  const ds = gdComboDatasets([], linea);
  assert.equal(ds.length, 1);
  assert.equal(ds[0].type, 'line');
});

test('gdComboDatasets: cada dataset de barra conserva label/data/color (mismo dato que antes, solo se le agregan maxBarThickness/order)', () => {
  const barras = [{ label: 'Gestionados', data: [1, 2, 3], color: '#abcdef' }];
  const ds = gdComboDatasets(barras, null);
  assert.equal(ds[0].label, 'Gestionados');
  assert.deepEqual(ds[0].data, [1, 2, 3]);
  assert.equal(ds[0].backgroundColor, '#abcdef');
});
