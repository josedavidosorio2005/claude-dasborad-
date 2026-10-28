// fase205-tipificacion-listado-completo.test.js — Fase 205 (pedido de Edwin):
// Tipificacion con el listado completo. "Ver datos", la tabla de detalle y el
// Excel muestran todas las tipificaciones, una por fila, sin "Otras"; la
// torta muestra todas las que caben legibles segun el ancho y, si agrupa,
// "Otras" dice en el tooltip cuales entran ahi. Datos SINTETICOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const L = require('../../public/js/tipificacion-logic.js');
const { agruparTop10YOtras } = require('../tipificaciones');

const JS = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');
// 25 tipificaciones sinteticas: COD_01 = 25, COD_02 = 24, ... COD_25 = 1 (total 325).
const TODAS = Array.from({ length: 25 }, (_, k) => ({ tipificacion: 'COD_' + String(k + 1).padStart(2, '0'), cantidad: 25 - k }));
const TOTAL = TODAS.reduce((a, r) => a + r.cantidad, 0);

test('servidor: /por-tipo trae `todas` (listado completo, de mayor a menor) y "Otras" dice cuales incluye', () => {
  const r = agruparTop10YOtras(TODAS.slice().reverse());
  assert.equal(r.total, TOTAL);
  assert.equal(r.todas.length, 25);
  assert.deepEqual(r.todas.slice(0, 2), [{ tipificacion: 'COD_01', cantidad: 25 }, { tipificacion: 'COD_02', cantidad: 24 }]);
  const otras = r.datos.find((d) => d.esOtras);
  assert.equal(otras.distintas, 15);
  assert.equal(otras.incluye.length, 15);
  assert.equal(otras.incluye[0].tipificacion, 'COD_11');
  assert.equal(otras.incluye.reduce((a, x) => a + x.cantidad, 0), otras.cantidad);
});

test('cuantas porciones caben: 20 en escritorio, 14 en tableta, 10 en el celular (leyenda abajo)', () => {
  assert.equal(L.tipificacionMaxPorciones(1300), 20);
  assert.equal(L.tipificacionMaxPorciones(700), 14);
  assert.equal(L.tipificacionMaxPorciones(340), 10);
});

test('torta: todas si caben; si no, las mas grandes + "Otras" con su lista; nunca "Otras" de una sola', () => {
  const pocas = L.tipificacionPorcionesTorta(TODAS.slice(0, 12), 14);
  assert.equal(pocas.length, 12);
  assert.ok(!pocas.some((p) => p.esOtras));
  const p20 = L.tipificacionPorcionesTorta(TODAS, 20);
  assert.equal(p20.length, 20);
  const otras = p20[19];
  assert.equal(otras.esOtras, true);
  assert.equal(otras.tipificacion, 'Otras (6 tipificaciones)');
  assert.deepEqual(otras.incluye.map((x) => x.tipificacion), ['COD_20', 'COD_21', 'COD_22', 'COD_23', 'COD_24', 'COD_25']);
  assert.equal(p20.reduce((a, x) => a + x.cantidad, 0), TOTAL, 'la torta suma el total');
  assert.equal(L.tipificacionPorcionesTorta(TODAS.slice(0, 9), 8).length, 8, '9 en 8 porciones: 7 + Otras (2)');
  assert.equal(L.tipificacionPorcionesTorta(TODAS.slice(0, 8), 8).filter((x) => x.esOtras).length, 0, 'exactamente las que caben: sin Otras');
});

test('tooltip de "Otras": cuales son, con cantidad y %; si son muchas, tope y "ver Ver datos"', () => {
  const otras = L.tipificacionPorcionesTorta(TODAS, 8)[7]; // 18 tipificaciones en Otras
  const lineas = L.tipificacionLineasOtras(otras, TOTAL, (x) => x.replace('COD_', 'Código '), 15);
  assert.equal(lineas.length, 16);
  assert.equal(lineas[0], '· Código 08: 18 (5,54 %)');
  assert.equal(lineas[15], '… y 3 más (ver «Ver datos»)');
  assert.equal(L.tipificacionCantidadPct(1234, 10000), '1.234 (12,34 %)');
});

test('vista: la torta agrupa en el navegador por ancho; tooltip con la lista; tabla y Ver datos con `todas`', () => {
  const t = JS('tipificacion.js');
  assert.match(t, /var todas = resultado\.todas \|\| resultado\.datos;/);
  assert.match(t, /var porciones = tipificacionPorcionesTorta\(todas, tipificacionMaxPorciones\(anchoTorta\)\);/);
  // afterLabel: una linea por tipificacion de "Otras" (label solo junta texto).
  assert.match(t, /return r && r\.esOtras \? tipificacionLineasOtras\(r, resultado\.total, tipificacionEtiqueta, 15\) : '';/);
  assert.match(t, /verDatosTodas: \{ filas: todas\.map\(/);
  assert.match(t, /tablaHost\.innerHTML = _tipificacionTablaDetalleHtml\(todas, resultado\.total\);/);
  assert.match(t, /if\(leyendaAbajo\) opcTorta\.plugins\.legend = Object\.assign\(\{\}, opcTorta\.plugins\.legend, \{ position: 'bottom' \}\);/);
  const dg = JS('dashboard-generic.js');
  assert.match(dg, /var completo = \(tipo === 'pie' \|\| tipo === 'doughnut'\) && chart\.data\.datasets\[0\] && chart\.data\.datasets\[0\]\.verDatosTodas;/);
  assert.match(dg, /filas: \(resultado\.todas \|\| resultado\.datos\)\.map\(function\(r\)\{ return \{ Tipificacion:/, 'Excel con el listado completo');
});
