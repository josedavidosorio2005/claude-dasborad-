// faseA16-cdr-sin-tipificacion.test.js — Fase A16 (19/11): una llamada de cdr_1 que llega SIN tipificación
// se completa con «-» (marcador del export manual, «Sin tipificación») y ya no se pierde en Eficacia ni en
// únicas. El conteo del Historial dice, sin valores, si esas filas traen otro código. Datos INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../wolkvox-modulos');
const T = require('../../public/js/tipificacion-logic.js');

const fila = (extra) => ({ agent_name: 'ASESORA INVENTADA', description_cod_act: 'VENTA INVENTADA', skill_name: 'SKILL INVENTADA', skill_id: '7', telephone: '3000000016', type_interaction: 'inbound', date: '2026-11-04 10:11:12', time_min: 1, time_seg: 60, cod_act: '1', hang_up: 'agent', ...extra });

test('entrada sin tipificación → se carga como «-» (Sin tipificación)', () => {
  const p = T.tipificacionParseFilas(M.hojaCdr([
    fila(),
    fila({ description_cod_act: '', telephone: '3000000017', date: '2026-11-04 11:00:00' }),
    fila({ description_cod_act: null, telephone: '3000000018', date: '2026-11-04 12:00:00' }),
  ]), null, 'LLAMADAS', M.opcionesCdrMobilize());
  assert.equal(p.error, undefined, JSON.stringify(p.avisos));
  assert.equal(p.filas.length, 3);
  assert.deepEqual(p.filas.map((f) => f.tipificacion), ['VENTA INVENTADA', '-', '-']);
  assert.equal(T.tipificacionEtiqueta('-'), 'Sin tipificación');
});

test('una tipificación que sí viene no se toca', () => {
  const h = M.hojaCdr([fila({ description_cod_act: 'OTRA INVENTADA' })]);
  assert.equal(h[1][h[0].indexOf('DESCRIPTION_COD_ACT')], 'OTRA INVENTADA');
});

test('el conteo dice si las filas sin tipificación traen otro código, sin mostrar valores', () => {
  const c = M.conteoCdr([fila(), fila({ description_cod_act: '', cod_act: '77', description_cod_act_2: 'SECRETO INVENTADO' }), fila({ description_cod_act: '', cod_act: '' })]);
  assert.match(c, /sin tipificación 2 \(con COD_ACT 1, con otra descripción 1\)/);
  assert.doesNotMatch(c, /SECRETO|77/);
});
