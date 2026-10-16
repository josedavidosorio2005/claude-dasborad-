// fase152-cierre-coma-decimal.test.js — Fase 152 (cierre): coma decimal
// es-CO en los porcentajes de Gerencia, Metas y la vista previa de carga de
// Trafico (los que quedaban con punto despues de B4).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PUB = path.join(__dirname, '..', '..', 'public');
const leer = (r) => fs.readFileSync(path.join(PUB, r), 'utf8');

function cargar(nombre) {
  const src = leer('js/charts.js');
  const i = src.indexOf('function ' + nombre + '(');
  const ctx = {};
  vm.runInNewContext(src.slice(i, src.indexOf('\n}\n', i) + 2) + '\nthis.f = ' + nombre + ';', ctx);
  return ctx.f;
}

test('gdFmtPctEs: coma decimal, hasta 2 decimales, espacio antes del %', () => {
  const f = cargar('gdFmtPctEs');
  assert.equal(f(12.345), '12,35 %');
  assert.equal(f(95.1), '95,1 %');
  assert.equal(f(80), '80 %');
  assert.equal(f('7.5'), '7,5 %');
  assert.equal(f(null), '');
  assert.equal(f(''), '');
});

test('Gerencia, Metas y la vista previa de Trafico ya no arman "%" con punto', () => {
  for (const archivo of ['gerencia.js', 'metas.js']) {
    assert.doesNotMatch(leer('js/' + archivo), /\+ ?'%'/, archivo);
  }
  const traf = leer('js/trafico.js');
  const prev = traf.slice(traf.indexOf('function _renderPreviewTrafico'), traf.indexOf('\n}\n', traf.indexOf('function _renderPreviewTrafico')));
  assert.match(prev, /gdFmtPctEs\(f\.nivelAtencionPct\)/);
  assert.equal((leer('js/gerencia.js').match(/gdFmtPctEs\(/g) || []).length, 6);
  assert.equal((leer('js/metas.js').match(/gdFmtPctEs\(/g) || []).length, 4);
});
