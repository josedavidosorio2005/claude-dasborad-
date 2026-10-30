// fase190-tipif-sin-tortas-linea.test.js — Fase 190 (ORLANT, Tipificación):
// salen las dos tortas de abajo, "Llamadas de salida por línea" y "WhatsApp de
// salida por línea". La salida por línea ya se ve con los botones de la
// pestaña "Llamadas y WhatsApp de salida" (Fase 189). Las tarjetas Salida
// General / Salida 3P / Sin clasificar y el filtro "Línea de salida" siguen.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const s = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'tipificacion.js'), 'utf8');

test('sin las tortas "salida por línea": ni canvas ni grafica', () => {
  assert.ok(!s.includes('tipif-lin-c-'), 'no queda el canvas de la torta por linea');
  assert.ok(!s.includes('de salida por línea'), 'no queda el titulo de la torta');
});

test('lo demas sigue: tarjetas por linea, nota, filtro "Línea de salida" y la torta de tipificacion', () => {
  assert.ok(s.includes("id=\"tipif-lineas-'+i+'-'+c.canal+'\""));
  assert.ok(s.includes("id=\"tipif-lineas-nota-'+i+'-'+c.canal+'\""));
  assert.ok(s.includes("<label for=\"tipif-f-linea-'+i+'\">Línea (General / 3P)</label>")); // Fase 219: texto nuevo
  assert.ok(s.includes("'/calidad/tipificacion/salida-por-linea?'"));
  assert.ok(s.includes("<canvas id=\"tipif-c-'+i+'-'+c.canal+'\"></canvas>"));
});
