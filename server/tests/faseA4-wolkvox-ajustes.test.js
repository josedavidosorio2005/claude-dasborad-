// faseA4-wolkvox-ajustes.test.js — Fase A4 (18/11, decisiones del usuario): la consulta automatica
// descarta las filas con 0 llamadas (sin excluir skills por nombre) y guarda el nivel de servicio a
// 10 s y 30 s (la pestaña de Flujo sigue mostrando solo 20 s). Wolkvox FALSO, datos INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { db } = require('./helpers');
const auto = require('../wolkvox-auto');
const ing = require('../wolkvox-ingesta');

const R = auto.CAMPANA;
const ENV = { NODE_ENV: 'test', WOLKVOX_MOBILIZE_TOKEN: 'TOKEN-FALSO-A4-no-es-real-0123456789', WOLKVOX_MOBILIZE_SERVIDOR: 'servidorfalsoa4' };
const ok = (cuerpo) => Promise.resolve({ status: 200, json: () => Promise.resolve(cuerpo) });
const filasMes = (mes) => db.prepare('SELECT fecha, skillName, totalLlamadas, serviceLevel10secPct, serviceLevel20secPct, serviceLevel30secPct FROM calidad_nivel_servicio_diario WHERE campana = ? AND substr(fecha,1,7) = ? ORDER BY fecha, skillName').all(R, mes);

test('filas con 0 llamadas se descartan; una skill que empieza a recibir llamadas aparece sola', async () => {
  // 5/11 07:30 Colombia: pide 1 a 4. La skill «QUIETA» solo tiene llamadas el dia 3.
  const ahora = new Date('2026-11-05T12:30:00Z');
  const fetchImpl = (url) => {
    const dia = new URL(url).searchParams.get('date_ini').slice(0, 8);
    return ok({ code: 200, msg: '3 records were found', data: [
      { skill_name: 'SKILL INVENTADA ACTIVA', inbound_calls: '6', answer_calls: '5', abandon_calls: '1', service_level_10seg: '50.0 %', service_level_20seg: '66.7 %', service_level_30seg: '83,3 %' },
      { skill_name: 'SKILL INVENTADA QUIETA', inbound_calls: dia === '20261103' ? '2' : '0', answer_calls: dia === '20261103' ? '2' : '0', abandon_calls: '0', service_level_20seg: '0 %' },
      { skill_name: 'SKILL INVENTADA SIEMPRE CERO', inbound_calls: '0', answer_calls: '0', abandon_calls: '0' },
    ] });
  };
  const r = await auto.correrUnaVez({ db, env: ENV, ahora, fetchImpl, franja: 'a4-1' });
  assert.equal(r.estado, 'ok', r.detalle);
  assert.equal(r.meses[0].filas, 5); // 4 dias de ACTIVA + 1 de QUIETA
  assert.equal(r.meses[0].sinLlamadas, 7); // 3 de QUIETA + 4 de SIEMPRE CERO
  assert.match(r.detalle, /7 filas sin llamadas descartadas/);
  const filas = filasMes('2026-11');
  assert.ok(!filas.some((f) => f.totalLlamadas === 0));
  assert.deepEqual(filas.filter((f) => f.skillName === 'SKILL INVENTADA QUIETA').map((f) => f.fecha), ['2026-11-03']);
  assert.ok(!filas.some((f) => f.skillName === 'SKILL INVENTADA SIEMPRE CERO'));
  // Nivel de servicio 10 s y 30 s guardados.
  const a = filas.find((f) => f.skillName === 'SKILL INVENTADA ACTIVA');
  assert.deepEqual([a.serviceLevel10secPct, a.serviceLevel20secPct, a.serviceLevel30secPct], [50, 66.7, 83.3]);
});

test('un mes con todas las filas en cero no se reemplaza', async () => {
  const antes = filasMes('2026-11');
  const fetchImpl = () => ok({ code: 200, msg: '1 records were found', data: [{ skill_name: 'SKILL INVENTADA SIEMPRE CERO', inbound_calls: '0', answer_calls: '0' }] });
  const r = await auto.correrUnaVez({ db, env: ENV, ahora: new Date('2026-11-05T12:30:00Z'), fetchImpl, franja: 'a4-2' });
  assert.equal(r.meses[0].estado, 'sin_filas');
  assert.match(r.detalle, /Wolkvox no trajo filas con llamadas \(4 en cero\), mes sin cambios/);
  assert.deepEqual(filasMes('2026-11'), antes);
});

test('validacion comun (B1 y A1): acepta 10 s y 30 s y rechaza mas de 100 %', () => {
  const base = { fecha: '2026-10-01', skillName: 'X', totalLlamadas: 2, contestadas: 1 };
  const v = ing.validarCuerpo({ reporte: 'flujo', mes: '2026-10', filas: [{ ...base, serviceLevel10secPct: 10, serviceLevel30secPct: 90 }] });
  assert.deepEqual([v.filas[0].serviceLevel10secPct, v.filas[0].serviceLevel30secPct], [10, 90]);
  assert.ok(ing.validarCuerpo({ reporte: 'flujo', mes: '2026-10', filas: [{ ...base, serviceLevel30secPct: 101 }] }).error);
});

test('la pestaña de Flujo de llamadas sigue mostrando solo el nivel de servicio a 20 s', () => {
  // El codigo de la pestaña (sin comentarios) nunca pinta los campos de 10 s ni de 30 s.
  const js = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'trafico.js'), 'utf8');
  const codigo = js.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|[^:'"])\/\/.*$/, '$1')).join('\n');
  assert.ok(!/serviceLevel10secPct|serviceLevel30secPct/.test(codigo));
  assert.match(codigo, /serviceLevel20secPct/);
});
