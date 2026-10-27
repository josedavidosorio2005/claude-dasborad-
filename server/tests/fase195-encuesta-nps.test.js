// fase195-encuesta-nps.test.js — Fase 195 (Mobilize, Encuesta): boton "NPS" en
// la pregunta 1. % sobre las que contestaron la pregunta 1 (no el total) y NPS
// = % promotores (9-10) - % detractores (0-6). Datos SINTETICOS con la forma
// de octubre (28 contestaron: 12 dieron 10).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const L = require('../../public/js/encuesta-logic.js');

const V = (m) => Array.from({ length: 11 }, (_, v) => ({ valor: v, cantidad: m[v] || 0 }));

test('NPS de octubre: base = 28 que contestaron; 10 -> 12 / 28 = 42,9 %; NPS 21,4', () => {
  const n = L.encuestaNps({ respondieron: 28, valores: V({ 0: 4, 1: 3, 4: 1, 5: 2, 8: 2, 9: 4, 10: 12 }) });
  assert.equal(n.respondieron, 28);
  assert.equal(n.porcentajes[10].pct, 42.9);
  assert.deepEqual([n.promotores, n.pasivos, n.detractores], [16, 2, 10]);
  assert.deepEqual([n.pctPromotores, n.pctDetractores, n.nps], [57.1, 35.7, 21.4]);
});

test('sin respuestas: sin porcentajes ni NPS inventados', () => {
  const n = L.encuestaNps({ valores: V({}) });
  assert.equal(n.nps, null);
  assert.ok(n.porcentajes.every((x) => x.pct === null));
});

test('panel: botones Cantidad | NPS solo en la pregunta 1, con la nota del calculo', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'encuesta.js'), 'utf8');
  assert.ok(s.includes("q.key === 'q1'") && s.includes('_encuestaBotonesQ1Html(i)'));
  assert.ok(s.includes("[{ v: 'cantidad', t: 'Cantidad' }, { v: 'nps', t: 'NPS' }]"));
  assert.match(L.ENCUESTA_NPS_NOTA, /promotores \(9 y 10\).*detractores \(0 a 6\).*contestaron la pregunta 1/);
});
