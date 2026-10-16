// fase144-a4-pestanas-cerrar.test.js — Fase 144 (A4). Hallazgos de la Fase
// 143: D06 (barra de scroll vertical ▲▼ junto a las pestañas del tablero en
// TODOS los tamaños: scrollHeight 39 > clientHeight 37) y D25 ("X Cerrar"
// partido en 2 lineas en Cargar Datos y en el tablero a 768-820 px).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'css', 'styles.css'), 'utf8');

test('.aurora-tabs corta el desborde vertical (overflow-y:hidden) y conserva el scroll horizontal', () => {
  const m = css.match(/\.aurora-tabs\{([^}]*)\}/);
  assert.ok(m, 'existe la regla .aurora-tabs');
  assert.match(m[1], /overflow-x:auto/);
  assert.match(m[1], /overflow-y:hidden/);
});

// Fase 152 (B4, "OK limpieza atab"): solo cambio la transicion; el
// margin-bottom:-2px (alineado con el borde de la barra) se queda.
test('.atab: transicion exacta (sin "all") y su margin-bottom:-2px se queda', () => {
  const m = css.match(/\.atab\{([^}]*)\}/);
  assert.doesNotMatch(m[1], /transition:all/);
  assert.match(m[1], /margin-bottom:-2px/);
});

test('las 2 reglas .aurora-close ("X Cerrar", "Exportar") no parten el texto en 2 lineas', () => {
  const reglas = css.match(/\.aurora-close\{[^}]*\}/g) || [];
  assert.ok(reglas.length >= 2, 'hay al menos 2 reglas .aurora-close');
  for (const r of reglas) assert.match(r, /white-space:nowrap/, r);
});
