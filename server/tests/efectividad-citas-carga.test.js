// efectividad-citas-carga.test.js — POST /api/calidad/efectividad-citas/carga(/impacto)
// + GET /api/calidad/efectividad-citas/(opciones|mensual) (Fase 111,
// ORLANT, pedido textual de InCo). Mismo patron que
// efectividad-agendamiento-carga.test.js: reemplazo por MES,
// impacto/confirmacion, permisos. Datos de control dados por Edwin/InCo
// (Ene-26 a Mar-26) se usan en una prueba dedicada.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

// [mes, agendas, atendidas]
function fila(over) {
  const base = ['2025-04', 100, 50];
  return Object.assign([], base, over);
}

test('POST /calidad/efectividad-citas/carga: solo quien tiene el permiso Cargar Datos puede subir', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const create = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send({ nombre: 'X', user: 'ec_noadmin_' + Math.random().toString(36).slice(2, 7), password: 'ClaveEc12345', rol: 'CALIDAD', perms: { Calidad: true, campana_ORLANT: true } });
  assert.equal(create.status, 201);
  const token = await tokenFor(create.body.user, 'ClaveEc12345');
  const res = await request(app)
    .post('/api/calidad/efectividad-citas/carga')
    .set(auth(token))
    .send({ campana: 'ORLANT', filas: [fila()] });
  assert.equal(res.status, 403);
});

test('carga valida: se guarda y GET /mensual trae el mes cargado', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const mes = '2025-05';
  const res = await request(app)
    .post('/api/calidad/efectividad-citas/carga')
    .set(auth(admin))
    .send({ campana: 'ORLANT', archivoNombre: 'CITAS_ATENDIDAS_test.xlsx', filas: [fila({ 0: mes, 1: 200, 2: 150 })] });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.insertadas, 1);
  assert.deepEqual(res.body.meses, [mes]);

  const mensual = await request(app).get('/api/calidad/efectividad-citas/mensual?campana=ORLANT').set(auth(admin));
  assert.equal(mensual.status, 200, JSON.stringify(mensual.body));
  const f = mensual.body.find((r) => r.mes === mes);
  assert.ok(f, 'el mes cargado debe aparecer');
  assert.equal(f.agendas, 200);
  assert.equal(f.atendidas, 150);
});

test('reemplaza por MES: subir el MISMO archivo 2 veces no duplica', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const mes = '2025-06';
  const payload = { campana: 'ORLANT', archivoNombre: 'CITAS_ATENDIDAS_dup.xlsx', filas: [fila({ 0: mes })] };
  const uno = await request(app).post('/api/calidad/efectividad-citas/carga').set(auth(admin)).send(payload);
  assert.equal(uno.status, 201);
  const dos = await request(app).post('/api/calidad/efectividad-citas/carga').set(auth(admin)).send(payload);
  assert.equal(dos.status, 201);
  assert.equal(dos.body.borradas, 1, 'la segunda carga debe borrar la fila de la primera antes de reinsertar');

  const mensual = await request(app).get('/api/calidad/efectividad-citas/mensual?campana=ORLANT').set(auth(admin));
  assert.equal(mensual.body.filter((r) => r.mes === mes).length, 1, 'no debe duplicar');
});

test('reemplaza por MES: un archivo de un mes DISTINTO no toca las filas de otro mes', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  await request(app).post('/api/calidad/efectividad-citas/carga').set(auth(admin)).send({ campana: 'ORLANT', filas: [fila({ 0: '2025-07' })] });
  await request(app).post('/api/calidad/efectividad-citas/carga').set(auth(admin)).send({ campana: 'ORLANT', filas: [fila({ 0: '2025-08' })] });
  const op = await request(app).get('/api/calidad/efectividad-citas/opciones?campana=ORLANT').set(auth(admin));
  assert.ok(op.body.meses.includes('2025-07') && op.body.meses.includes('2025-08'));
});

test('un archivo con VARIOS meses reemplaza SOLO esos meses', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/calidad/efectividad-citas/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [fila({ 0: '2025-09' }), fila({ 0: '2025-10' })],
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual(res.body.meses, ['2025-09', '2025-10']);
  assert.equal(res.body.insertadas, 2);
});

test('POST /carga/impacto: cuenta cuantas filas se reemplazarian SIN escribir nada', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const mes = '2025-11';
  await request(app).post('/api/calidad/efectividad-citas/carga').set(auth(admin)).send({ campana: 'ORLANT', filas: [fila({ 0: mes })] });
  const impacto = await request(app).post('/api/calidad/efectividad-citas/carga/impacto').set(auth(admin)).send({ campana: 'ORLANT', filas: [fila({ 0: mes })] });
  assert.equal(impacto.status, 200, JSON.stringify(impacto.body));
  assert.equal(impacto.body.filasExistentes, 1);
  assert.equal(impacto.body.filasNuevas, 1);

  const mensual = await request(app).get('/api/calidad/efectividad-citas/mensual?campana=ORLANT').set(auth(admin));
  assert.equal(mensual.body.filter((r) => r.mes === mes).length, 1, '/carga/impacto no debe escribir nada en la base');
});

test('GET /mensual respeta el acceso por campana', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const create = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send({ nombre: 'X', user: 'ec_sincamp_' + Math.random().toString(36).slice(2, 7), password: 'ClaveEc12345', rol: 'CALIDAD', perms: { Calidad: true } });
  const token = await tokenFor(create.body.user, 'ClaveEc12345');
  const res = await request(app).get('/api/calidad/efectividad-citas/mensual?campana=ORLANT').set(auth(token));
  assert.equal(res.status, 403);
});

test('control real (dado por Edwin/InCo): Ene-26 158/148, Feb-26 625/527, Mar-26 325/278 -- % recalculado 93,67/84,32/85,54, periodo 86,01 %', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  await request(app).post('/api/calidad/efectividad-citas/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [
      fila({ 0: '2026-01', 1: 158, 2: 148 }),
      fila({ 0: '2026-02', 1: 625, 2: 527 }),
      fila({ 0: '2026-03', 1: 325, 2: 278 }),
    ],
  });
  const mensual = await request(app).get('/api/calidad/efectividad-citas/mensual?campana=ORLANT').set(auth(admin));
  const ene = mensual.body.find((r) => r.mes === '2026-01');
  const feb = mensual.body.find((r) => r.mes === '2026-02');
  const mar = mensual.body.find((r) => r.mes === '2026-03');
  assert.equal(Math.round((ene.atendidas / ene.agendas) * 10000) / 100, 93.67);
  assert.equal(Math.round((feb.atendidas / feb.agendas) * 10000) / 100, 84.32);
  assert.equal(Math.round((mar.atendidas / mar.agendas) * 10000) / 100, 85.54);
  const sumaAgendas = ene.agendas + feb.agendas + mar.agendas;
  const sumaAtendidas = ene.atendidas + feb.atendidas + mar.atendidas;
  assert.equal(sumaAgendas, 1108);
  assert.equal(sumaAtendidas, 953);
  assert.equal(Math.round((sumaAtendidas / sumaAgendas) * 10000) / 100, 86.01);
});

test('validacion: numero negativo -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/calidad/efectividad-citas/carga').set(auth(admin)).send({ campana: 'ORLANT', filas: [fila({ 1: -5 })] });
  assert.equal(res.status, 400);
});

test('validacion: mes con formato invalido -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/calidad/efectividad-citas/carga').set(auth(admin)).send({ campana: 'ORLANT', filas: [fila({ 0: 'ENERO-2025' })] });
  assert.equal(res.status, 400);
});

test('validacion: mes futuro -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const futuro = new Date();
  futuro.setUTCFullYear(futuro.getUTCFullYear() + 5);
  const mesFuturo = futuro.getUTCFullYear() + '-01';
  const res = await request(app).post('/api/calidad/efectividad-citas/carga').set(auth(admin)).send({ campana: 'ORLANT', filas: [fila({ 0: mesFuturo })] });
  assert.equal(res.status, 400);
});

test('validacion: fila con menos de 3 campos -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/calidad/efectividad-citas/carga').set(auth(admin)).send({ campana: 'ORLANT', filas: [['2025-04', 100]] });
  assert.equal(res.status, 400);
});
