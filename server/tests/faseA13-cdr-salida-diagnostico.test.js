// faseA13-cdr-salida-diagnostico.test.js — Fase A13 (19/11): el conteo de cdr_1 en el Historial dice,
// por tipo (inbound / salida), cuántas filas llegan sin skill y la FORMA de la fecha (dígitos → 9),
// nunca un valor. Datos INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../wolkvox-modulos');

const fila = (extra) => ({ agent_name: 'ASESORA INVENTADA', description_cod_act: 'TIP INVENTADA', skill_name: 'SKILL INVENTADA', telephone: '3000000013', type_interaction: 'inbound', date: '2026-11-04 10:11:12', ...extra });

test('salida sin skill y forma de la fecha, sin valores', () => {
  const t = M.conteoCdr([
    fila(),
    fila({ type_interaction: 'outbound_ma', skill_name: '' }),
    fila({ type_interaction: 'outbound_ma', skill_name: null, date: '04/11/2026 10:11' }),
    fila({ type_interaction: 'outbound_ma', skill_name: null, date: '04/11/2026 10:12' }),
    fila({ type_interaction: 'internalcall' }),
  ]);
  assert.match(t, / · inbound: sin skill 0, fecha «9999-99-99 99:99:99» 1; outbound_ma: sin skill 3, fecha «99\/99\/9999 99:99» 2 \/ «9999-99-99 99:99:99» 1$/);
  for (const x of ['ASESORA', 'TIP INVENTADA', '3000000013', '2026', '10:11']) assert.ok(!t.includes(x), x);
});

test('sin filas de entrada ni de salida: no agrega nada', () => {
  assert.ok(!M.conteoCdr([fila({ type_interaction: 'internalcall' })]).includes(' · '));
});
