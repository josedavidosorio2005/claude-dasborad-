// faseA10-eficacia-replica.test.js — Fase A10 (18/11/2026): la réplica interna «MOBILIZE PRUEBAS API»
// usa los códigos positivos de Eficacia de MOBILIZE (parametros.replicaDe); una campaña normal sin
// lista sigue sin Eficacia. Y los reportes candidatos están en la lista cerrada de «Probar». Datos INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('./helpers');
const E = require('../eficacia');
const R = require('../clientes-registro');

const REPLICA = 'MOBILIZE PRUEBAS API';

test('replicaDe: solo campañas internas con replicaDe', () => {
  assert.equal(R.replicaDe(db, REPLICA), 'MOBILIZE');
  assert.equal(R.replicaDe(db, 'MOBILIZE'), null);
  assert.equal(R.replicaDe(db, 'ORLANT'), null);
  assert.equal(R.replicaDe(db, ''), null);
});

test('Eficacia de la réplica con los códigos de MOBILIZE', () => {
  const ins = db.prepare(`INSERT INTO tipificaciones (campana, canal, agente, fecha, tipificacion, skill, createdAt) VALUES (?, 'LLAMADAS', 'Asesora Inventada', ?, ?, ?, ?)`);
  const ahora = new Date().toISOString();
  ins.run(REPLICA, '2026-11-04', E.EFICACIA_CODIGOS_POSITIVOS.MOBILIZE[0], 'SKILL SAC', ahora);
  ins.run(REPLICA, '2026-11-04', 'Consulta general inventada', 'SKILL SAC', ahora);
  ins.run(REPLICA, '2026-11-04', E.EFICACIA_CODIGOS_POSITIVOS.MOBILIZE[0], 'LLAMADAS DE SALIDA', ahora); // la salida no cuenta
  const r = E.eficaciaPorMes(db, { campana: REPLICA, desde: '2026-11-04', hasta: '2026-11-04' });
  assert.deepEqual(r.codigos, E.EFICACIA_CODIGOS_POSITIVOS.MOBILIZE);
  assert.deepEqual([r.meses[0].contestadas, r.meses[0].positivas, r.meses[0].pct], [2, 1, 50]);
  assert.equal(E.eficaciaPorMes(db, { campana: 'ORLANT' }).codigos, null, 'una campaña sin lista sigue sin Eficacia');
});

test('los reportes candidatos están en la lista cerrada de «Probar»', () => {
  const { REPORTES } = require('../wolkvox');
  for (const k of ['skill_9', 'cdr_2', 'cdr_3', 'chat_13', 'diagram_1', 'ivr_1', 'diagram_5', 'cdr_5', 'chat_1']) assert.ok(REPORTES[k], k);
});
