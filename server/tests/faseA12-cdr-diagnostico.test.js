// faseA12-cdr-diagnostico.test.js — Fase A12 (19/11): el módulo cdr anota en el Historial SOLO
// conteos de lo que trae cdr_1 (por tipo de interacción, sin asesor, sin tipificación, skill «-»),
// para saber por qué no entran llamadas de salida sin gastar consultas. Ningún valor de las filas
// (asesor, teléfono, tipificación, cliente) aparece en el texto. Datos INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../wolkvox-modulos');

const TEL = '3000000012', ASESORA = 'ASESORA INVENTADA A12', TIP = 'Tipificacion inventada A12', CLIENTE = 'CC-INVENTADA-12';
const fila = (extra) => ({ agent_name: ASESORA, description_cod_act: TIP, skill_name: 'SKILL INVENTADA', telephone: TEL, customer_id: CLIENTE, type_interaction: 'inbound', ...extra });

test('conteo por tipo y por razón de descarte, sin valores de las filas', () => {
  const t = M.conteoCdr([
    fila(),
    fila({ type_interaction: 'Inbound' }),
    fila({ type_interaction: 'outbound_ma', skill_name: '-' }),
    fila({ agent_name: '', description_cod_act: '' }), // abandonada o IVR: sin asesor ni tipificación
    fila({ type_interaction: 'internalcall' }),
    fila({ type_interaction: '' }),
    fila({ type_interaction: 'raro <script>' + TEL }),
  ]);
  assert.equal(t.split(' · ')[0], 'API 7 filas: inbound 3, outbound_ma 1, internalcall 1, vacio 1, otro 1; sin asesor 1, sin tipificación 1 (con COD_ACT 0, con otra descripción 0), skill «-» 1'); // Fase A13 agrega la forma tras « · »; A16, los otros códigos
  for (const x of [TEL, ASESORA, TIP, CLIENTE, 'script']) assert.ok(!t.includes(x), x);
});

test('más de 6 tipos: el resto se suma en «otros»', () => {
  const tipos = ['a_a', 'b_b', 'c_c', 'd_d', 'e_e', 'f_f', 'g_g', 'h_h'];
  const t = M.conteoCdr(tipos.map((x) => fila({ type_interaction: x })));
  assert.match(t, /^API 8 filas: (?:[a-h]_[a-h] 1, ){6}otros 2;/);
});
