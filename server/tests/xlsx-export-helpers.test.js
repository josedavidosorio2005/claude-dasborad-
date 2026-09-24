// xlsx-export-helpers.test.js — cubre public/js/xlsx-export-helpers.js
// (xlsxNombreHojaUnico, xlsxCeldaSegura/xlsxFilasSeguras), corriendo la
// MISMA logica que usa el navegador al exportar a Excel desde
// dashboard-generic.js, calidad.js, trafico.js, trafico-whatsapp.js e
// historial.js.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { xlsxNombreHojaUnico, xlsxCeldaSegura, xlsxFilasSeguras } = require('../../public/js/xlsx-export-helpers.js');

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

// Fase 72 (hallazgo H2): inyeccion de formulas en exportaciones .xlsx.
test('xlsxCeldaSegura: antepone comilla a celdas que empiezan con =, +, -, @ (o tab/CR)', () => {
  assert.equal(xlsxCeldaSegura('=cmd|"/c calc"!A1'), "'=cmd|\"/c calc\"!A1");
  assert.equal(xlsxCeldaSegura('+1+1'), "'+1+1");
  assert.equal(xlsxCeldaSegura('-1+1'), "'-1+1");
  assert.equal(xlsxCeldaSegura('@SUM(A1:A2)'), "'@SUM(A1:A2)");
  assert.equal(xlsxCeldaSegura('\tHOLA'), "'\tHOLA");
});

test('xlsxCeldaSegura: no toca texto normal, numeros, booleanos, null ni undefined', () => {
  assert.equal(xlsxCeldaSegura('Skill ATENCION AL CLIENTE'), 'Skill ATENCION AL CLIENTE');
  assert.equal(xlsxCeldaSegura('Daniel Osorio Vega'), 'Daniel Osorio Vega');
  assert.equal(xlsxCeldaSegura(92.5), 92.5);
  assert.equal(xlsxCeldaSegura(true), true);
  assert.equal(xlsxCeldaSegura(null), null);
  assert.equal(xlsxCeldaSegura(undefined), undefined);
  // Un "-" que es parte de un rango de fechas/nombre, no al INICIO, no se toca.
  assert.equal(xlsxCeldaSegura('2026-09-01 - 2026-09-30'), '2026-09-01 - 2026-09-30');
});

test('xlsxFilasSeguras: sanea cada celda de texto de un array de objetos (formato json_to_sheet)', () => {
  const filas = [
    { skillName: '=HYPERLINK("http://evil")', totalLlamadas: 10 },
    { skillName: 'ATENCION NORMAL', totalLlamadas: 5 },
  ];
  const saneadas = xlsxFilasSeguras(filas);
  assert.equal(saneadas[0].skillName, "'=HYPERLINK(\"http://evil\")");
  assert.equal(saneadas[0].totalLlamadas, 10);
  assert.equal(saneadas[1].skillName, 'ATENCION NORMAL');
  // no muta el original
  assert.equal(filas[0].skillName, '=HYPERLINK("http://evil")');
});

test('xlsxFilasSeguras: sanea cada celda de texto de un array de arrays (formato aoa_to_sheet)', () => {
  const aoa = [
    ['Persona de Calidad / Supervisor', 'Meta Total'],
    ['=1+1', 100],
    ['Juan Perez', 50],
  ];
  const saneada = xlsxFilasSeguras(aoa);
  assert.equal(saneada[1][0], "'=1+1");
  assert.equal(saneada[2][0], 'Juan Perez');
  assert.equal(aoa[1][0], '=1+1'); // no muta el original
});
