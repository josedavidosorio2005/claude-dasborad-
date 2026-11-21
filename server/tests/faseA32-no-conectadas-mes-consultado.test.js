// faseA32-no-conectadas-mes-consultado.test.js — Fase A32 (usuario, 21/11/2026): en «Llamadas Únicas y de
// Salida», un mes en el que la consulta de no conectadas (cdr_5) terminó bien pero no dejó filas (Wolkvox sin
// llamadas, o solo de la cuenta de pruebas 12319) vale 0, no «Pendiente». Un mes con CDR que nunca se
// consultó ni se cargó sigue diciendo Pendiente. Wolkvox FALSO; datos INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('./helpers');
const M = require('../wolkvox-modulos');
const LS = require('../llamadas-salida');

const ENV = { NODE_ENV: 'test', WOLKVOX_MOBILIZE_TOKEN: 'TOKEN-FALSO-A32-no-es-real-0123456789', WOLKVOX_MOBILIZE_SERVIDOR: 'servidorfalsoa32' };
const C = 'CAMPANA INVENTADA A32';
const R = 'MOBILIZE PRUEBAS API';
const nc = (date, id) => ({ agent_id: id || '3001', agent_name: id === '12319' ? 'CUENTA PRUEBA INVENTADA' : 'ASESORA INVENTADA A32', date, result: 'NO ANSWER', ring_time: '30', telephone: '3000000320', type_interaction: 'outbound_ma' });
const falso = (data) => () => Promise.resolve({ status: 200, json: () => Promise.resolve({ code: 200, msg: data.length + ' records were found', data }) });
function salidaCdr(campana, fecha) {
  db.prepare("INSERT INTO tipificaciones (campana, canal, agente, fecha, hora, duracionMin, tipificacion, skill, archivoNombre, cargadoPorNombre, createdAt) VALUES (?, 'LLAMADAS', 'ASESORA INVENTADA A32', ?, '09:00', 1, 'X', '-', 'x', 'x', ?)").run(campana, fecha, new Date().toISOString());
}
const mes = (campana, m) => LS.llamadasSalidaPorMes(db, { campana }).find((x) => x.periodo === m);

test('mes con CDR y sin no conectadas: Pendiente; marcado como consultado: 0 (y «Todos» suma)', () => {
  salidaCdr(C, '2026-07-10'); salidaCdr(C, '2026-07-11');
  salidaCdr(C, '2026-08-10');
  db.prepare("INSERT INTO llamadas_no_conectadas (campana, fecha, agente, archivoNombre, cargadoPorNombre, createdAt) VALUES (?, '2026-08-12', 'A', 'x', 'x', 'x')").run(C);
  assert.equal(mes(C, '2026-07').noConectadas, null);
  assert.equal(LS.llamadasSalidaResumen(db, { campana: C }).noConectadasPendiente, true);
  LS.marcarNoConectadasConsultado(db, { campana: C, mes: '2026-07', filas: 0, archivoNombre: 'API Wolkvox (cdr_5)' });
  assert.deepEqual([mes(C, '2026-07').conectadas, mes(C, '2026-07').noConectadas, mes(C, '2026-07').total], [2, 0, 2]);
  assert.deepEqual(LS.llamadasSalidaResumen(db, { campana: C }), { conectadas: 3, noConectadas: 1, total: 4, noConectadasPendiente: false });
  assert.deepEqual([mes(C, '2026-08').noConectadas, mes(C, '2026-08').total], [1, 2], 'agosto igual');
  // Con un rango de fechas solo cuentan las marcas de esos meses; otra campaña no se ve afectada.
  assert.equal(LS.llamadasSalidaResumen(db, { campana: C, desde: '2026-08-01', hasta: '2026-08-31' }).total, 2);
  assert.equal(LS.mesesNoConectadasConsultados(db, { campana: 'OTRA INVENTADA A32' }).length, 0);
  assert.throws(() => LS.marcarNoConectadasConsultado(db, { campana: C, mes: '2026-7', filas: 0 }), /mes inválido/);
});

test('corrida de cdr_5: solo cuenta de pruebas -> mes consultado con 0; con llamadas -> filas y marca; sin datos -> 0', async () => {
  const AHORA = new Date('2026-11-21T12:05:00Z');
  // julio en la réplica con «Ejecutar ahora» (mes pasado): Wolkvox trae solo la cuenta de pruebas
  salidaCdr(R, '2026-07-15');
  let r = await M.correrModulo('no_conectadas', { db, env: ENV, ahora: AHORA, mes: '2026-07', fetchImpl: falso([nc('2026-07-15 09:00:00', '12319'), nc('2026-07-16 09:00:00', '12319')]), franja: 'a32-1' });
  assert.equal(r.estado, 'ok', r.detalle);
  assert.match(r.detalle, /solo filas de la cuenta de prueba/);
  assert.deepEqual([mes(R, '2026-07').noConectadas, mes(R, '2026-07').total], [0, 1]);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM llamadas_no_conectadas WHERE campana = ? AND substr(fecha,1,7) = '2026-07'").get(R).n, 0, 'nada de la cuenta de pruebas');
  // noviembre con llamadas: guarda y marca con su cantidad
  r = await M.correrModulo('no_conectadas', { db, env: ENV, ahora: AHORA, fetchImpl: falso([nc('2026-11-02 08:00:00'), nc('2026-11-03 08:00:00'), nc('2026-11-03 09:00:00', '12319')]), franja: 'a32-2' });
  assert.equal(r.estado, 'ok', r.detalle);
  assert.equal(db.prepare("SELECT filas FROM llamadas_no_conectadas_meses WHERE campana = ? AND mes = '2026-11'").get(R).filas, 2);
  assert.equal(mes(R, '2026-11').noConectadas, 2);
  // un mes sin ninguna llamada en Wolkvox
  r = await M.correrModulo('no_conectadas', { db, env: ENV, ahora: AHORA, mes: '2026-09', fetchImpl: falso([]), franja: 'a32-3' });
  assert.match(r.detalle, /mes consultado: 0/);
  assert.equal(db.prepare("SELECT filas FROM llamadas_no_conectadas_meses WHERE campana = ? AND mes = '2026-09'").get(R).filas, 0);
});

test('una consulta que falla no marca el mes (sigue Pendiente)', async () => {
  const roto = () => Promise.resolve({ status: 200, json: () => Promise.resolve({ code: 200, msg: 'x', data: 'no-es-lista' }) });
  const r = await M.correrModulo('no_conectadas', { db, env: ENV, ahora: new Date('2026-11-21T12:05:00Z'), mes: '2026-06', fetchImpl: roto, franja: 'a32-4' });
  assert.notEqual(r.estado, 'ok');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM llamadas_no_conectadas_meses WHERE campana = ? AND mes = '2026-06'").get(R).n, 0);
});
