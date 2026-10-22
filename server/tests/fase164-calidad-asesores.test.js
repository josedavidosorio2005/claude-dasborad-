// fase164-calidad-asesores.test.js — Fase 164, lote 1 (auditoria de diseno),
// D-03: en Calidad, "Promedio de calidad por asesor" tenia alto fijo (230px):
// Chart.js saltaba la mitad de los nombres del eje (autoSkip) y cada barra
// salia de un color distinto, asi que no se sabia de quien era cada barra.
// La verificacion en navegador real (cuantos nombres muestra el eje) esta en
// el PR.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { calDashAltoBarrasAsesores } = require('../../public/js/calidad-dashboard-logic.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'dashboard-generic.js'), 'utf8');
// Solo el bloque de calidad_bar_asesores.
const BLOQUE = SRC.slice(SRC.indexOf("if(p.tipo === 'calidad_bar_asesores'){\n    // Fase 130"), SRC.indexOf('// calidad_pie — clasificacion cualitativa fija'));

test('calDashAltoBarrasAsesores: crece ~28px por asesor y nunca baja de 230px', () => {
  assert.equal(calDashAltoBarrasAsesores(0), 230);
  assert.equal(calDashAltoBarrasAsesores(5), 230);
  assert.equal(calDashAltoBarrasAsesores(9), 312);
  assert.equal(calDashAltoBarrasAsesores(20), 620);
  assert.equal(calDashAltoBarrasAsesores(undefined), 230);
});

test('la grafica por asesor muestra todos los nombres del eje (sin autoSkip)', () => {
  assert.ok(BLOQUE.length > 200, 'se encontro el bloque de calidad_bar_asesores');
  assert.match(BLOQUE, /optsBar\.scales\.y = \{ ticks:\{ font:\{ size:12 \}, autoSkip:false \} \};/);
  assert.match(BLOQUE, /wrapAsesores\.style\.height = calDashAltoBarrasAsesores\(labelsAsesores\.length\) \+ 'px'/);
});

test('un solo color para todas las barras (una sola serie) y sin leyenda', () => {
  assert.match(BLOQUE, /backgroundColor: colorSerie\('principal'\)/);
  assert.doesNotMatch(BLOQUE, /paletaColorPara/);
  assert.match(BLOQUE, /optsBar\.plugins\.legend = \{ display:false \};/);
});

test('guarda: sigue siendo UNA serie con el promedio, nunca el numero de monitoreos (decision de la Fase 130)', () => {
  assert.equal((BLOQUE.match(/datasets:\[/g) || []).length, 1);
  assert.match(BLOQUE, /datasets:\[\{ label:'Promedio', data: valoresAsesores,/);
  assert.match(BLOQUE, /var valoresAsesores = porAsesor\.map\(function\(x\)\{ return x\.promedio; \}\);/);
});
