// fase173-centro-hora-carga.test.js — Fase 173: en produccion el servidor
// corre en UTC y nowStr() guarda "dd/mm/aaaa hh:mm:ss" en UTC. El Centro de
// cargas leia ese texto como hora de Colombia (+5 h) y mostraba la hora de
// carga 5 horas despues de la real (una carga de las 14:13 salia a las 19:13).
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const CC = require('../centro-cargas');
const { centroFechaCorta } = require('../../public/js/centro-cargas-logic.js');

const TZ_ANTES = process.env.TZ;
after(() => { if (TZ_ANTES === undefined) delete process.env.TZ; else process.env.TZ = TZ_ANTES; });

function nowStrEn(tz, instante) {
  process.env.TZ = tz;
  const d = new Date(instante);
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

test('servidor en UTC (produccion): una carga de las 14:13 de Colombia se muestra a las 14:13', () => {
  const real = Date.parse('2026-10-23T19:13:09Z'); // 14:13:09 en Colombia
  const guardado = nowStrEn('UTC', real);
  assert.equal(guardado, '23/10/2026 19:13:09');
  assert.equal(CC.instanteCarga(guardado), real);
  assert.equal(centroFechaCorta(new Date(CC.instanteCarga(guardado)).toISOString()), '23/10/2026 14:13');
});

test('servidor en Colombia (equipo local): tambien da la hora real', () => {
  const real = Date.parse('2026-10-23T19:13:09Z');
  const guardado = nowStrEn('America/Bogota', real);
  assert.equal(guardado, '23/10/2026 14:13:09');
  assert.equal(CC.instanteCarga(guardado), real);
  assert.equal(centroFechaCorta(new Date(CC.instanteCarga(guardado)).toISOString()), '23/10/2026 14:13');
});

test('el ISO en UTC no cambia', () => {
  process.env.TZ = 'UTC';
  assert.equal(CC.instanteCarga('2026-10-16T13:13:37.000Z'), Date.parse('2026-10-16T13:13:37Z'));
});
