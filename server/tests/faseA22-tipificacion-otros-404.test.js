// faseA22-tipificacion-otros-404.test.js — Fase A22 (19/11, OK del usuario): (1) en cdr_1, la tipificación
// vacía y TIMEOUTACW entran como «Otros_motivos», como en el MOBILIZE real; Eficacia y únicas no cambian.
// (2) un 404 de skill_2 es «sin registros»: el mes de abandonadas no cambia y no es error. Datos INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('./helpers');
const M = require('../wolkvox-modulos');
const T = require('../../public/js/tipificacion-logic.js');

const fila = (extra) => ({ agent_name: 'ASESORA INVENTADA A22', description_cod_act: 'VENTA INVENTADA', skill_name: 'SKILL INVENTADA', skill_id: '7', telephone: '3000000220', type_interaction: 'inbound', date: '2026-10-04 10:11:12', time_min: 1, time_seg: 60, cod_act: '1', hang_up: 'agent', ...extra });

test('vacía, TIMEOUTACW (cualquier mayúscula) → Otros_motivos; las demás no se tocan', () => {
  const p = T.tipificacionParseFilas(M.hojaCdr([
    fila(),
    fila({ description_cod_act: '', telephone: '3000000221' }),
    fila({ description_cod_act: 'TIMEOUTACW', telephone: '3000000222', date: '2026-10-04 11:00:00' }),
    fila({ description_cod_act: ' timeoutAcw ', telephone: '3000000223', date: '2026-10-04 12:00:00' }),
    fila({ description_cod_act: 'Cliente_no_contesta', telephone: '3000000224', type_interaction: 'outbound_ma', skill_name: '' }),
  ]), null, 'LLAMADAS', M.opcionesCdrMobilize());
  assert.equal(p.error, undefined, JSON.stringify(p.avisos));
  assert.deepEqual(p.filas.map((f) => f.tipificacion), ['VENTA INVENTADA', 'Otros_motivos', 'Otros_motivos', 'Otros_motivos', 'Cliente_no_contesta']);
});

test('abandonadas: un 404 de skill_2 = sin registros, el mes no cambia y la corrida es ok', async () => {
  const R = 'MOBILIZE'; // Fase W10: antes la réplica «MOBILIZE PRUEBAS API» (borrada); ahora el destino real
  db.prepare("INSERT INTO llamadas_abandonadas (campana, fecha, skill, archivoNombre, cargadoPorNombre, createdAt) VALUES (?, '2026-11-10', 'X', 'x', 'x', 'x')").run(R);
  const antes = db.prepare('SELECT COUNT(*) n FROM llamadas_abandonadas WHERE campana = ?').get(R).n;
  const urls = [];
  const r = await M.correrModulo('abandonadas', {
    db, destino: 'real', env: { NODE_ENV: 'test', WOLKVOX_MOBILIZE_TOKEN: 'TOKEN-FALSO-A22-0123456789', WOLKVOX_MOBILIZE_SERVIDOR: 'srvfalsoa22' },
    ahora: new Date('2026-12-19T20:00:00Z'), mes: '2026-11', franja: 'a22-1',
    fetchImpl: (u) => { urls.push(u); return Promise.resolve({ status: 404, json: () => Promise.resolve({ code: 404, msg: 'Texto distinto inventado', data: [] }) }); },
  });
  assert.equal(urls.length, 1);
  assert.equal(r.estado, 'ok', r.detalle);
  assert.match(r.detalle, /no trajo abandonadas, sin cambios/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM llamadas_abandonadas WHERE campana = ?').get(R).n, antes);
});

test('otros reportes: un 404 sin «sin registros» sigue siendo error', async () => {
  const r = await M.correrModulo('no_conectadas', {
    db, destino: 'real', env: { NODE_ENV: 'test', WOLKVOX_MOBILIZE_TOKEN: 'TOKEN-FALSO-A22-0123456789', WOLKVOX_MOBILIZE_SERVIDOR: 'srvfalsoa22' },
    ahora: new Date('2026-12-19T20:00:00Z'), mes: '2026-11', franja: 'a22-2',
    fetchImpl: () => Promise.resolve({ status: 404, json: () => Promise.resolve({ code: 404, msg: 'Texto distinto inventado', data: [] }) }),
  });
  assert.equal(r.estado, 'error');
});
