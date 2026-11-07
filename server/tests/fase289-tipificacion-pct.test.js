// fase289-tipificacion-pct.test.js — Fase 289 (revision del 07/11, hallazgo #12): la
// tarjeta «Conectadas» de Tipificacion con el porcentaje en formato colombiano
// («72,97 %»), igual que la tabla, y no «72.97%».
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const T = require('../../public/js/tipificacion-logic.js');

test('tipificacionPctTexto: coma decimal, 2 decimales y espacio antes del %', () => {
  assert.equal(T.tipificacionPctTexto(72.97), '72,97 %');
  assert.equal(T.tipificacionPctTexto(50), '50,00 %');
  assert.equal(T.tipificacionPctTexto(0.5), '0,50 %');
  assert.equal(T.tipificacionPctTexto(null), '');
  assert.equal(T.tipificacionPctTexto(undefined), '');
});

test('la tarjeta «Conectadas» usa el formato colombiano (ya no pct+"%")', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'tipificacion.js'), 'utf8');
  assert.ok(!js.includes("' ('+pct+'%)'"), 'quedo el formato viejo');
  assert.match(js, /Conectadas'\+\(pct===null\?'':' \('\+tipificacionPctTexto\(pct\)\+'\)'\)/);
});
