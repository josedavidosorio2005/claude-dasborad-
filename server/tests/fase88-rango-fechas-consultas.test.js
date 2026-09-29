// fase88-rango-fechas-consultas.test.js — Fase 88, tema "rango de fechas".
//
// tipificacionesWhereClausulas (tipificaciones.js) y agendasWhereClausulas
// (agendas.js) filtraban el mes con `substr(columna,1,7) = @mes` -- nunca
// aprovechaba la parte de fecha del indice compuesto (confirmado con
// EXPLAIN QUERY PLAN en el barrido de la Fase 88), y ese costo crece con
// TODO el historico acumulado de esa campana, no con el mes visualizado.
// El fix reemplaza eso por un rango directo sobre la MISMA columna
// (`fecha >= @mesDesde AND fecha <= @mesHasta`), que SI puede usar el
// indice. Esta prueba no mide velocidad (eso se confirma aparte con
// EXPLAIN QUERY PLAN/tiempos, ver PROGRESS.md) -- prueba que el RESULTADO
// es identico al de antes, sobre todo en los bordes del mes: en Agendas
// `fechaSolicitud` guarda tambien hora ('AAAA-MM-DD HH:MM:SS'), que es
// justo el caso donde un rango mal armado pierde filas del ultimo dia.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

// Tipificaciones: [agente, fecha, hora, duracionMin, tipificacion, skill]
function filaTipif(over) {
  const base = ['ASESOR RANGO', '2025-04-15', '18:06:08', 3, 'AGENDADA_InConexion', 'LLAMADAS DE SALIDA'];
  return Object.assign([], base, over);
}

// Agendas: [asesor, sede, examen, especialidad, profesional, fechaSolicitud, tipoLinea, entidad]
function filaAgenda(over) {
  const base = ['ASESOR RANGO', 'SEDE CENTRO', 'AUDIOMETRIA', 'AUDIOLOGIA', 'DR PEREZ', '2025-04-15 10:00:00', 'GENERAL', 'EPS DEMO'];
  return Object.assign([], base, over);
}

test('Tipificacion: el filtro "mes" incluye el primer y el ultimo dia del mes exactos, y excluye el dia justo antes/despues', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const tip = 'TEST BORDE MES ' + Math.random().toString(36).slice(2, 8);
  await request(app).post('/api/calidad/tipificacion/carga').set(auth(admin)).send({
    campana: 'ORLANT', canal: 'LLAMADAS',
    filas: [
      filaTipif({ 1: '2025-01-31', 4: tip }), // dia anterior al mes -> NO debe contar
      filaTipif({ 1: '2025-02-01', 4: tip }), // primer dia del mes -> SI
      filaTipif({ 1: '2025-02-28', 4: tip }), // ultimo dia del mes -> SI
      filaTipif({ 1: '2025-03-01', 4: tip }), // dia siguiente al mes -> NO debe contar
    ],
  });
  const porTipo = await request(app).get('/api/calidad/tipificacion/por-tipo?campana=ORLANT&canal=LLAMADAS&mes=2025-02').set(auth(admin));
  const f = porTipo.body.datos.find((r) => r.tipificacion === tip);
  assert.ok(f, 'debe aparecer la tipificacion de prueba');
  assert.equal(f.cantidad, 2, 'solo las 2 filas DENTRO de febrero (01 y 28), nunca las de enero/marzo');
});

test('Tipificacion: mes de 31 dias (no trunca ni se queda corto en el ultimo dia)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const tip = 'TEST MES31 ' + Math.random().toString(36).slice(2, 8);
  await request(app).post('/api/calidad/tipificacion/carga').set(auth(admin)).send({
    campana: 'ORLANT', canal: 'LLAMADAS',
    filas: [filaTipif({ 1: '2025-01-01', 4: tip }), filaTipif({ 1: '2025-01-31', 4: tip }), filaTipif({ 1: '2025-02-01', 4: tip })],
  });
  const porTipo = await request(app).get('/api/calidad/tipificacion/por-tipo?campana=ORLANT&canal=LLAMADAS&mes=2025-01').set(auth(admin));
  const f = porTipo.body.datos.find((r) => r.tipificacion === tip);
  assert.equal(f.cantidad, 2, 'enero tiene 31 dias -- el 31 debe contar, el 1 de febrero no');
});

test('Agendas: el filtro "mes" incluye una fila del ULTIMO dia a las 23:59:59 (fechaSolicitud tiene hora) y excluye el primer segundo del mes siguiente', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const especialidad = 'ESP BORDE MES ' + Math.random().toString(36).slice(2, 8);
  await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [
      filaAgenda({ 3: especialidad, 5: '2025-04-30 00:00:00' }), // dentro del mes -> SI
      filaAgenda({ 3: especialidad, 5: '2025-04-30 23:59:59' }), // ULTIMO segundo del mes -> SI (el caso que rompe con un rango mal armado)
      filaAgenda({ 3: especialidad, 5: '2025-05-01 00:00:00' }), // primer segundo del mes siguiente -> NO
    ],
  });
  const porEsp = await request(app).get('/api/calidad/agendas/especialidad?campana=ORLANT&mes=2025-04').set(auth(admin));
  const f = porEsp.body.find((r) => r.especialidad === especialidad);
  assert.ok(f, 'debe aparecer la especialidad de prueba');
  assert.equal(f.cantidad, 2, 'las 2 filas de abril (incluida 23:59:59), nunca la de mayo');
});

test('Agendas: el filtro "mes" excluye el ULTIMO segundo del mes ANTERIOR (23:59:59 del dia previo)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const especialidad = 'ESP BORDE PREV ' + Math.random().toString(36).slice(2, 8);
  await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [
      filaAgenda({ 3: especialidad, 5: '2025-06-30 23:59:59' }), // mes anterior, ultimo segundo -> NO
      filaAgenda({ 3: especialidad, 5: '2025-07-01 00:00:00' }), // primer segundo del mes -> SI
    ],
  });
  const porEsp = await request(app).get('/api/calidad/agendas/especialidad?campana=ORLANT&mes=2025-07').set(auth(admin));
  const f = porEsp.body.find((r) => r.especialidad === especialidad);
  assert.ok(f);
  assert.equal(f.cantidad, 1, 'solo la fila de julio, nunca la de junio 23:59:59');
});

test('Agendas: los filtros "desde"/"hasta" (fecha sin hora) siguen incluyendo TODA la hora del dia limite, en los dos extremos', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const especialidad = 'ESP DESDE HASTA ' + Math.random().toString(36).slice(2, 8);
  await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [
      filaAgenda({ 3: especialidad, 5: '2025-08-10 00:00:01' }), // justo dentro del limite "desde"
      filaAgenda({ 3: especialidad, 5: '2025-08-20 23:59:59' }), // justo dentro del limite "hasta"
      filaAgenda({ 3: especialidad, 5: '2025-08-09 23:59:59' }), // un segundo antes de "desde" -> fuera
      filaAgenda({ 3: especialidad, 5: '2025-08-21 00:00:00' }), // un segundo despues de "hasta" -> fuera
    ],
  });
  const porEsp = await request(app).get('/api/calidad/agendas/especialidad?campana=ORLANT&desde=2025-08-10&hasta=2025-08-20').set(auth(admin));
  const f = porEsp.body.find((r) => r.especialidad === especialidad);
  assert.ok(f);
  assert.equal(f.cantidad, 2, 'solo las 2 filas dentro de [10..20], con cualquier hora en los bordes');
});
