// contraste-logic.test.js — cubre public/js/contraste-logic.js (funcion
// real de contraste WCAG, simulacion de daltonismo y distancia perceptual
// CIELAB, Fase 133). Valores de referencia conocidos primero, despues la
// misma funcion se usa para auditar los tokens reales de styles.css/
// charts.js en fase133-wcag-regresion.test.js.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  contrasteRazon,
  contrastePasaAA,
  contrasteSimularCvd,
  contrasteDeltaE,
} = require('../../public/js/contraste-logic.js');

test('contrasteRazon: negro/blanco = 21 (el maximo WCAG), mismo color = 1 (el minimo)', () => {
  assert.equal(contrasteRazon('#000000', '#ffffff'), 21);
  assert.equal(contrasteRazon('#3a7a8c', '#3a7a8c'), 1);
});

test('contrasteRazon: simetrico (no importa el orden de los 2 colores)', () => {
  assert.equal(contrasteRazon('#004150', '#ffffff'), contrasteRazon('#ffffff', '#004150'));
});

test('contrasteRazon: el teal oficial de marca da 11.22:1 contra blanco (mismo numero ya confirmado en la Fase 132)', () => {
  assert.equal(Math.round(contrasteRazon('#004150', '#ffffff') * 100) / 100, 11.22);
});

test('contrastePasaAA: 4.5 para texto normal, 3 para texto grande/componente', () => {
  assert.equal(contrastePasaAA('#767676', '#ffffff'), true); // ~4.54:1
  assert.equal(contrastePasaAA('#949494', '#ffffff'), false); // ~2.8:1, falla ambos umbrales
  assert.equal(contrastePasaAA('#949494', '#ffffff', { grande: true }), true); // pasa el umbral de 3:1
  assert.equal(contrastePasaAA('#949494', '#ffffff', { componente: true }), true);
});

test('contrasteSimularCvd: sin cambios para un tipo desconocido; un color real SI cambia bajo protanopia', () => {
  assert.equal(contrasteSimularCvd('#1f9d55', 'tipo-inventado'), '#1f9d55');
  const simulado = contrasteSimularCvd('#1f9d55', 'protanopia');
  assert.notEqual(simulado, '#1f9d55');
  assert.match(simulado, /^#[0-9a-f]{6}$/);
});

test('contrasteDeltaE: 0 para el mismo color, ~100 (el maximo CIELAB) entre negro y blanco', () => {
  assert.equal(contrasteDeltaE('#2a6a80', '#2a6a80'), 0);
  assert.equal(Math.round(contrasteDeltaE('#000000', '#ffffff')), 100);
});

test('contrasteDeltaE: 2 colores claramente distintos dan una distancia grande; 2 casi iguales, chica', () => {
  assert.ok(contrasteDeltaE('#004150', '#ffd54f') > 50, 'teal vs amarillo deberian ser muy distintos');
  assert.ok(contrasteDeltaE('#1f9d55', '#1f9e56') < 2, '2 verdes casi identicos deberian ser casi indistinguibles');
});
