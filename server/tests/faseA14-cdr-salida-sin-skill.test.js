// faseA14-cdr-salida-sin-skill.test.js — Fase A14 (19/11): la salida de cdr_1 llega sin skill; se completa
// con «-» (como el export manual) y entra como «Llamadas de salida». Una de entrada sin skill se sigue
// omitiendo. Datos INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../wolkvox-modulos');
const T = require('../../public/js/tipificacion-logic.js');

const fila = (extra) => ({ agent_name: 'ASESORA INVENTADA', description_cod_act: 'VENTA INVENTADA', skill_name: 'SKILL INVENTADA', skill_id: '7', telephone: '3000000014', type_interaction: 'inbound', date: '2026-11-04 10:11:12', time_min: 1, time_seg: 60, cod_act: '1', hang_up: 'agent', ...extra });

test('salida sin skill → «Llamadas de salida»; entrada sin skill → omitida', () => {
  const p = T.tipificacionParseFilas(M.hojaCdr([
    fila(),
    fila({ type_interaction: 'outbound_ma', skill_name: '', skill_id: null, date: '2026-11-04 11:00:00' }),
    fila({ type_interaction: 'outbound_ma', skill_name: null, skill_id: '', date: '2026-11-04 11:05:00' }),
    fila({ type_interaction: 'inbound', skill_name: '', date: '2026-11-04 12:00:00' }),
  ]), null, 'LLAMADAS', M.opcionesCdrMobilize());
  assert.equal(p.error, undefined, JSON.stringify(p.avisos));
  assert.equal(p.salida, 2);
  assert.deepEqual(p.filas.map((f) => [f.tipoInteraccion, f.skill]), [['inbound', 'SKILL INVENTADA'], ['outbound_ma', 'LLAMADAS DE SALIDA'], ['outbound_ma', 'LLAMADAS DE SALIDA']]);
});

test('una salida que sí trae skill no se toca', () => {
  const h = M.hojaCdr([fila({ type_interaction: 'outbound_ma', skill_name: 'OTRA SKILL' })]);
  assert.equal(h[1][h[0].indexOf('SKILL_NAME')], 'OTRA SKILL');
});
