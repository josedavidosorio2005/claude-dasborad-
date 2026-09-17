// xlsx-export-helpers.test.js — cubre public/js/xlsx-export-helpers.js
// (xlsxNombreHojaUnico), corriendo la MISMA logica que usa el navegador al
// exportar a Excel desde dashboard-generic.js y calidad.js.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { xlsxNombreHojaUnico } = require('../../public/js/xlsx-export-helpers.js');

test('xlsxNombreHojaUnico: nombre simple, sin colision, se devuelve tal cual', () => {
  const usados = {};
  assert.equal(xlsxNombreHojaUnico('ORLANT', usados), 'ORLANT');
  assert.deepEqual(usados, { ORLANT: true });
});

test('xlsxNombreHojaUnico: quita los caracteres que Excel prohibe en un nombre de hoja', () => {
  const usados = {};
  assert.equal(xlsxNombreHojaUnico('A/B\\C?D*E[F]G:H', usados), 'A B C D E F G H');
});

test('xlsxNombreHojaUnico: trunca a 31 caracteres (limite real de Excel)', () => {
  const usados = {};
  const largo = 'Un nombre de panel muy pero muy largo que se pasa del limite';
  const resultado = xlsxNombreHojaUnico(largo, usados);
  assert.ok(resultado.length <= 31, 'no debe superar 31 caracteres: ' + resultado.length);
  assert.equal(resultado, largo.slice(0, 31));
});

test('xlsxNombreHojaUnico: nombre vacio o solo espacios/invalidos -> "Hoja" (desambiguado si se repite)', () => {
  const usados = {};
  assert.equal(xlsxNombreHojaUnico('', usados), 'Hoja');
  assert.equal(xlsxNombreHojaUnico('   ', usados), 'Hoja_2');
  assert.equal(xlsxNombreHojaUnico(undefined, usados), 'Hoja_3');
});

test('xlsxNombreHojaUnico: dos hojas con el mismo nombre no colisionan', () => {
  const usados = {};
  const a = xlsxNombreHojaUnico('Panel', usados);
  const b = xlsxNombreHojaUnico('Panel', usados);
  const c = xlsxNombreHojaUnico('Panel', usados);
  assert.equal(a, 'Panel');
  assert.notEqual(a, b);
  assert.notEqual(b, c);
  assert.notEqual(a, c);
  assert.ok(b.length <= 31 && c.length <= 31);
});

test('xlsxNombreHojaUnico: la colision tambien respeta el limite de 31 caracteres', () => {
  const usados = {};
  const largo = 'Nombre de panel exactamente al limite de treinta y uno';
  const a = xlsxNombreHojaUnico(largo, usados); // se trunca a 31
  const b = xlsxNombreHojaUnico(largo, usados); // colisiona con "a" -> necesita sufijo
  assert.equal(a.length, 31);
  assert.ok(b.length <= 31, 'la version desambiguada tambien debe caber en 31: ' + b);
  assert.notEqual(a, b);
});

test('xlsxNombreHojaUnico: llamar 3 veces con el mismo objeto `usados` desambigua entre TODAS las llamadas previas, no solo la ultima', () => {
  const usados = {};
  const nombres = ['Resumen', 'Resumen', 'Resumen', 'Resumen'];
  const resultados = nombres.map((n) => xlsxNombreHojaUnico(n, usados));
  const unicos = new Set(resultados);
  assert.equal(unicos.size, resultados.length, 'los 4 nombres devueltos deben ser todos distintos: ' + resultados.join(', '));
});
