// faseAU3-aurora-cdr-por-semanas.test.js — Fase AU3 (26/11/2026): el cdr_1 del mes completo de la réplica de Aurora
// pasó los 30 s (octubre). En Aurora el mes se pide por semanas (7 días por consulta: 5 en un mes de 31 días), se junta
// en memoria y se escribe UNA vez; si una semana falla, el mes queda sin cambios. MOBILIZE y ORLANT siguen con una
// consulta por mes. Wolkvox FALSO, token y datos INVENTADOS. Nunca el Aurora real.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('./helpers');
const M = require('../wolkvox-modulos');
const D = require('../wolkvox-destinos');
const auto = require('../wolkvox-auto');
const AG = require('../wolkvox-agentes');

const R = 'CLINICA AURORA PRUEBAS API';
const AU = 'CLINICA AURORA';
const ENV = { NODE_ENV: 'test', WOLKVOX_AURORA_TOKEN: 'TOKEN-FALSO-AU3-no-es-real', WOLKVOX_AURORA_SERVIDOR: 'servidorfalsoau3' };
const UNO = 'AGENTE INVENTADO AU3';
const ok = (cuerpo) => Promise.resolve({ status: 200, json: () => Promise.resolve(cuerpo) });
const n = (sql, ...a) => db.prepare(sql).get(...a).n;
const dia = (s) => s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);

// Wolkvox falso: cdr_1 devuelve UNA llamada en el primer día del tramo pedido; `fallaEn` = número de consulta que responde 500.
function falso(fallaEn) {
  const f = { tramos: [] };
  f.fetch = (url) => {
    const u = new URL(url);
    if (u.searchParams.get('api') !== 'cdr_1') return ok({ code: 200, msg: '0 records were found', data: [] });
    const desde = dia(u.searchParams.get('date_ini')), hasta = dia(u.searchParams.get('date_end'));
    f.tramos.push([desde, hasta]);
    if (fallaEn === f.tramos.length) return Promise.resolve({ status: 500, json: () => Promise.resolve({ code: 500, msg: 'error inventado' }) });
    return ok({ code: 200, msg: '1 records were found', data: [{ agent_id: '1', agent_name: UNO, description_cod_act: 'CITA INVENTADA', skill_name: 'LINEA DE ENTRADA', skill_id: '4009', telephone: '3000000000', customer_id: 'PACIENTE INVENTADO', comment: 'NOTA INVENTADA', type_interaction: 'inbound', date: desde + ' 10:00:00', time_min: 1, time_seg: 60, cod_act: '1', hang_up: 'agent' }] });
  };
  return f;
}
const correr = (f, mes, destino) => M.correrModulo('cdr', { db, env: ENV, ahora: new Date('2026-11-26T20:00:00Z'), mes, fetchImpl: f.fetch, logEvent: () => {}, destino: destino || 'aurora_replica' });
const llamadas = (mes) => n("SELECT COUNT(*) n FROM tipificaciones WHERE campana = ? AND canal = 'LLAMADAS' AND substr(fecha, 1, 7) = ?", R, mes);

auto.asegurarTablas(db);
AG.guardar(db, R, { incluidos: [], agregar: [UNO] }, 'prueba');

test('tramos: semanas seguidas, sin huecos ni repetidos; sin tamaño, el mes completo; consultas por mes', () => {
  const dias = Array.from({ length: 31 }, (_, i) => '2026-10-' + String(i + 1).padStart(2, '0'));
  const t = M.tramosCdr(dias, 7);
  assert.deepEqual(t.map((x) => [x[0], x[x.length - 1]]), [['2026-10-01', '2026-10-07'], ['2026-10-08', '2026-10-14'], ['2026-10-15', '2026-10-21'], ['2026-10-22', '2026-10-28'], ['2026-10-29', '2026-10-31']]);
  assert.deepEqual([].concat(...t), dias);
  assert.deepEqual(M.tramosCdr(dias), [dias]);
  assert.equal(D.DESTINOS.aurora_replica.cdrDiasPorConsulta, 7);
  assert.equal(M.consultasCdrPorMes(D.DESTINOS.aurora_replica), 5);
  for (const k of ['replica', 'real', 'orlant_replica']) assert.equal(M.consultasCdrPorMes(D.DESTINOS[k]), 1, k);
});

test('Aurora, octubre: 5 consultas de una semana; las llamadas de todas las semanas se escriben juntas', async () => {
  const f = falso();
  const r = await correr(f, '2026-10');
  assert.equal(r.estado, 'ok', r.detalle);
  assert.equal(r.consultas, 5);
  assert.deepEqual(f.tramos, [['2026-10-01', '2026-10-07'], ['2026-10-08', '2026-10-14'], ['2026-10-15', '2026-10-21'], ['2026-10-22', '2026-10-28'], ['2026-10-29', '2026-10-31']]);
  assert.equal(llamadas('2026-10'), 5, 'una llamada por semana');
  const txt = JSON.stringify(db.prepare('SELECT * FROM tipificaciones WHERE campana = ?').all(R));
  for (const x of ['3000000000', 'PACIENTE INVENTADO', 'NOTA INVENTADA']) assert.ok(!txt.includes(x), x);
});

test('si una semana falla, el mes queda como estaba (todo o nada) y no se pide el resto', async () => {
  const antes = llamadas('2026-10');
  const f = falso(3);
  const r = await correr(f, '2026-10');
  assert.equal(r.estado, 'error');
  assert.equal(f.tramos.length, 3, 'sin reintentos ni más semanas tras la falla');
  assert.equal(llamadas('2026-10'), antes);
  assert.match(r.detalle, /sin cambios, sin reintento/);
});

test('febrero (28 días): 4 consultas; nunca el Aurora real', async () => {
  const f = falso();
  const r = await correr(f, '2026-02');
  assert.equal(r.consultas, 4);
  assert.deepEqual(f.tramos.at(-1), ['2026-02-22', '2026-02-28']);
  assert.equal(n('SELECT COUNT(*) n FROM tipificaciones WHERE campana = ?', AU), 0);
});
