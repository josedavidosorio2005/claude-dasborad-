// fase328-calificar-opciones-sura.test.js — Fase 328 (10/11/2026): en Calidad › Calificar (formulario
// comun cc2, motor descuento) un item con mas de dos opciones propias se apila (texto arriba, botones
// debajo en cuadricula) y el numero y el «%» van con espacio duro. La regla de calculo no cambia: se
// comprueba la nota en vivo (cc2Nota) con la matriz de SURA. Los SI/NO y SI/NO/N/A siguen igual.
// Datos SINTETICOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const pub = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');
const C = require('../../public/js/calidad-calificar-logic.js');

// Misma forma que guarda el importador para el motor descuento (v = SI, OP1..OP3).
const op = (n, nombre, ops) => ({ n, label: nombre, opciones: ops.map((o, i) => ({ v: i ? 'OP' + i : 'SI', t: o[0], descuento: o[1] })), weight: Math.max(...ops.map((o) => o[1])) });
const crit = (n, nombre) => ({ n, label: nombre, critico: true, weight: 0 });
const no = (n, nombre, d) => ({ n, label: nombre, descuento: d, weight: d });
const ITEMS = [
  op(1, 'Ítem ficticio uno', [['Cumple ambos', 0], ['Falla A', 9], ['Falla B', 6], ['Falla ambos', 15]]),
  crit(2, 'Crítico ficticio dos'), crit(3, 'Crítico ficticio tres'), crit(4, 'Crítico ficticio cuatro'),
  no(5, 'Ítem ficticio cinco', 28), no(6, 'Ítem ficticio seis', 10), crit(7, 'Crítico ficticio siete'), no(8, 'Ítem ficticio ocho', 30),
  op(9, 'Ítem ficticio nueve', [['Cumple todo', 0], ['Maneja 2', 7], ['Maneja 1', 10], ['Sin manejo', 12]]),
];
const TODO = () => Object.fromEntries(ITEMS.map((it) => [it.n, 'SI']));
const nota = (c) => C.cc2Nota(ITEMS, Object.assign(TODO(), c), 'descuento');

test('nota en vivo: todo cumple 100 %; no críticos descuentan; ítem 1 −9/−6/−15; ítem 9 −7/−10/−12; un crítico en NO = 0 %', () => {
  assert.equal(nota({}), 100);
  assert.equal(nota({ 5: 'NO' }), 72); assert.equal(nota({ 6: 'NO' }), 90); assert.equal(nota({ 8: 'NO' }), 70);
  assert.deepEqual(['OP1', 'OP2', 'OP3'].map((v) => nota({ 1: v })), [91, 94, 85]);
  assert.deepEqual(['OP1', 'OP2', 'OP3'].map((v) => nota({ 9: v })), [93, 90, 88]);
  for (const n of [2, 3, 4, 7]) assert.equal(nota({ [n]: 'NO' }), 0, 'crítico ' + n);
  assert.equal(nota({ 1: 'OP3', 9: 'OP3', 2: 'NO' }), 0);
  assert.equal(C.cc2Faltantes(ITEMS, Object.assign(TODO(), { 1: 'NO' }), 'descuento').length, 1, 'en un ítem con opciones, NO no vale');
  assert.equal(C.cc2Faltantes(ITEMS, {}, 'descuento').length, 9, 'Limpiar = nada calificado');
});

test('front: solo los ítems con más de dos opciones propias se apilan; número y % con espacio duro', () => {
  const src = pub('js/calidad-calificar.js');
  assert.doesNotThrow(() => new vm.Script(src));
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(src.match(/function cc2ItemApilado[^\n]*\n/)[0] + src.match(/function cc2PctJunto[^\n]*\n/)[0], ctx);
  assert.equal(ctx.cc2ItemApilado(ITEMS[0]), true);
  assert.equal(ctx.cc2ItemApilado(ITEMS[1]), false, 'SI/NO sin opciones propias');
  assert.equal(ctx.cc2ItemApilado({ n: 1, label: 'x', weight: 10 }), false, 'SI/NO/N/A (ORLANT, Mobilize, Aurora, HLM) sigue igual');
  assert.equal(ctx.cc2PctJunto(C.cc2SubItem(ITEMS[0], 'descuento')), 'Falla A −9 % · Falla B −6 % · Falla ambos −15 %');
  assert.equal(ctx.cc2PctJunto(C.cc2SubItem({ n: 1, label: 'x', weight: 10 }, 'ponderado')), C.cc2SubItem({ n: 1, label: 'x', weight: 10 }, 'ponderado'), 'otros motores: mismo texto');
  assert.match(src, /'nota\\u00a00\\u00a0%'/);
  assert.match(src, /'<div class="cc2-item' \+ \(cc2ItemApilado\(it\) \? ' cc2-item-op' : ''\) \+ '"/);
  const css = pub('css/styles.css');
  assert.match(css, /\.cc2-item\.cc2-item-op\{grid-template-columns:28px minmax\(0,1fr\);align-items:start\}/);
  assert.match(css, /\.cc2-item\.cc2-item-op \.cc2-seg\{grid-column:1\/-1;[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /@container \(max-width:719px\)\{\.cc2-item\.cc2-item-op \.cc2-seg\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}\}/);
  assert.match(css, /@container \(max-width:419px\)\{\.cc2-item\.cc2-item-op \.cc2-seg\{grid-template-columns:minmax\(0,1fr\)\}\}/);
  assert.match(css, /\.cc2-qbtn\{white-space:nowrap\}/);
});
