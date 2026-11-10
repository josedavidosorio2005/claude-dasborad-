// fase326-sura-ventas-por-mes.test.js — Fase 326 (10/11/2026, pedido de Edwin): en el tablero
// Televentas de SURA (Cumplimiento) el titulo de la grafica es «Ventas por mes», sin «agendas»
// ni parentesis. Solo el texto: el calculo y la vista «Producción por mes» no cambian.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const leer = (f) => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');

test('Televentas SURA: «Ventas por mes» en el titulo inicial y al cambiar la medida; «Producción por mes» igual', () => {
  const app = leer('public/js/sura-televentas-app.js');
  assert.doesNotThrow(() => new vm.Script(app));
  assert.ok(!app.includes('Agendas (ventas)'), 'ya no dice «Agendas (ventas)»');
  assert.match(app, /<h2 id=\\"g4t\\" style=\\"margin:0\\">Ventas por mes<\/h2>/);
  assert.match(app, /\$\("g4t"\)\.textContent=\(med==="p"\?"Producción":"Ventas"\)\+" por mes";/);
});

test('el generador lleva el cambio (no se pierde al regenerar desde el HTML de Edwin)', () => {
  const g = leer('scripts/sura/generar-televentas.js');
  assert.match(g, /M\('>Agendas \(ventas\) por mes<\/h2>', '>Ventas por mes<\/h2>'\);/);
  assert.match(g, /X\('"Agendas \(ventas\)"\)\+" por mes"', '"Ventas"\)\+" por mes"', 1\);/);
});
