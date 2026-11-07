// fase293-sura-agentes-movil.test.js — Fase 293 (revision del 07/11, hallazgo #10): en
// SURA › Agentes a 375 px, las tarjetas de agente (.agrid > .ac, minimo 300 px) median mas
// que el panel (297 px en produccion) y el panel se desplazaba 3-18 px de lado. Ahora la
// columna minima es min(300px, 100%). La regla va en el CSS y en el generador
// (scripts/sura/generar-televentas.js) para que una regeneracion no la pierda.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const REGLA = '.agrid{grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr))}';

test('el CSS de SURA trae la regla y queda DESPUES de la .agrid original (la pisa)', () => {
  const css = fs.readFileSync(path.join(RAIZ, 'public', 'css', 'sura-televentas-app.css'), 'utf8');
  const original = css.indexOf('.agrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}');
  const nueva = css.indexOf(REGLA);
  assert.ok(original !== -1, 'la regla original de Edwin sigue');
  assert.ok(nueva > original, 'la nueva va despues');
});

test('el generador produce la misma regla al final del bloque layout', () => {
  const g = fs.readFileSync(path.join(RAIZ, 'scripts', 'sura', 'generar-televentas.js'), 'utf8');
  assert.ok(g.includes(".stv-cargando{padding:40px 16px;text-align:center;color:var(--mut)}\n/* Fase 293"), 'en el mismo lugar que el CSS');
  assert.ok(g.includes(REGLA + '\n`;'));
});
