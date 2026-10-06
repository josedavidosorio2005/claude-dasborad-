// salida-carga.test.js — POST /api/calidad/salida/carga(/impacto) + GET
// /api/calidad/salida/(opciones|mensual) (Fase 127, ORLANT, pedido
// textual de Edwin). Mismo patron que efectividad-citas-carga.test.js:
// reemplazo por MES, impacto/confirmacion, permisos. Datos de control
// reales del archivo de Edwin (FLUJO_LLAMADAS_Y_WPP_DE_SALIDA_POR_MES.xlsx)
// se usan en una prueba dedicada.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

// [mes, llamadas3p, llamadasGeneral, wpp3p, wppGeneral]
function fila(over) {
  const base = ['2025-04', 100, 200, 50, 80];
  return Object.assign([], base, over);
}

test('POST /calidad/salida/carga: solo quien tiene el permiso Cargar Datos puede subir', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const create = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send({ nombre: 'X', user: 'sal_noadmin_' + Math.random().toString(36).slice(2, 7), password: 'ClaveSal12345', rol: 'CALIDAD', perms: { Calidad: true, campana_ORLANT: true } });
  assert.equal(create.status, 201);
  const token = await tokenFor(create.body.user, 'ClaveSal12345');
  const res = await request(app)
    .post('/api/calidad/salida/carga')
    .set(auth(token))
    .send({ campana: 'ORLANT', filas: [fila()] });
  assert.equal(res.status, 403);
});

test('carga valida: se guarda y GET /mensual trae el mes cargado', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const mes = '2025-05';
  const res = await request(app)
    .post('/api/calidad/salida/carga')
    .set(auth(admin))
    .send({ campana: 'ORLANT', archivoNombre: 'FLUJO_SALIDA_test.xlsx', filas: [fila({ 0: mes, 1: 10, 2: 20, 3: 30, 4: 40 })] });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.insertadas, 1);
  assert.deepEqual(res.body.meses, [mes]);

  const mensual = await request(app).get('/api/calidad/salida/mensual?campana=ORLANT').set(auth(admin));
  assert.equal(mensual.status, 200, JSON.stringify(mensual.body));
  const f = mensual.body.find((r) => r.mes === mes);
  assert.ok(f, 'el mes cargado debe aparecer');
  assert.equal(f.llamadas3p, 10);
  assert.equal(f.llamadasGeneral, 20);
  assert.equal(f.wpp3p, 30);
  assert.equal(f.wppGeneral, 40);
});

test('reemplaza por MES: subir el MISMO archivo 2 veces no duplica (re-subida idempotente)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const mes = '2025-06';
  const payload = { campana: 'ORLANT', archivoNombre: 'FLUJO_SALIDA_dup.xlsx', filas: [fila({ 0: mes })] };
  const uno = await request(app).post('/api/calidad/salida/carga').set(auth(admin)).send(payload);
  assert.equal(uno.status, 201);
  const dos = await request(app).post('/api/calidad/salida/carga').set(auth(admin)).send(payload);
  assert.equal(dos.status, 201);
  assert.equal(dos.body.borradas, 1, 'la segunda carga debe borrar la fila de la primera antes de reinsertar');

  const mensual = await request(app).get('/api/calidad/salida/mensual?campana=ORLANT').set(auth(admin));
  assert.equal(mensual.body.filter((r) => r.mes === mes).length, 1, 'no debe duplicar');
});

test('reemplaza por MES: un archivo de un mes DISTINTO no toca las filas de otro mes', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  await request(app).post('/api/calidad/salida/carga').set(auth(admin)).send({ campana: 'ORLANT', filas: [fila({ 0: '2025-07' })] });
  await request(app).post('/api/calidad/salida/carga').set(auth(admin)).send({ campana: 'ORLANT', filas: [fila({ 0: '2025-08' })] });
  const op = await request(app).get('/api/calidad/salida/opciones?campana=ORLANT').set(auth(admin));
  assert.ok(op.body.meses.includes('2025-07') && op.body.meses.includes('2025-08'));
});

test('un archivo con VARIOS meses reemplaza SOLO esos meses', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/calidad/salida/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [fila({ 0: '2025-09' }), fila({ 0: '2025-10' })],
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual(res.body.meses, ['2025-09', '2025-10']);
  assert.equal(res.body.insertadas, 2);
});

test('POST /carga/impacto: cuenta cuantas filas se reemplazarian SIN escribir nada (0 filas a medias)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const mes = '2025-11';
  await request(app).post('/api/calidad/salida/carga').set(auth(admin)).send({ campana: 'ORLANT', filas: [fila({ 0: mes })] });
  const impacto = await request(app).post('/api/calidad/salida/carga/impacto').set(auth(admin)).send({ campana: 'ORLANT', filas: [fila({ 0: mes })] });
  assert.equal(impacto.status, 200, JSON.stringify(impacto.body));
  assert.equal(impacto.body.filasExistentes, 1);
  assert.equal(impacto.body.filasNuevas, 1);

  const mensual = await request(app).get('/api/calidad/salida/mensual?campana=ORLANT').set(auth(admin));
  assert.equal(mensual.body.filter((r) => r.mes === mes).length, 1, '/carga/impacto no debe escribir nada en la base');
});

test('GET /mensual respeta el acceso por campana', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const create = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send({ nombre: 'X', user: 'sal_sincamp_' + Math.random().toString(36).slice(2, 7), password: 'ClaveSal12345', rol: 'CALIDAD', perms: { Calidad: true } });
  const token = await tokenFor(create.body.user, 'ClaveSal12345');
  const res = await request(app).get('/api/calidad/salida/mensual?campana=ORLANT').set(auth(token));
  assert.equal(res.status, 403);
});

test('control real (archivo de Edwin): Ago-26 2.169/4.391/747/2.635, Sep-26 3.530/6.874/1.277/2.720 -- totales 6.560/10.404 llamadas, 3.382/3.997 WhatsApp', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  await request(app).post('/api/calidad/salida/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [
      fila({ 0: '2026-08', 1: 2169, 2: 4391, 3: 747, 4: 2635 }),
      fila({ 0: '2026-09', 1: 3530, 2: 6874, 3: 1277, 4: 2720 }),
    ],
  });
  const mensual = await request(app).get('/api/calidad/salida/mensual?campana=ORLANT').set(auth(admin));
  const ago = mensual.body.find((r) => r.mes === '2026-08');
  const sep = mensual.body.find((r) => r.mes === '2026-09');
  assert.equal(ago.llamadas3p + ago.llamadasGeneral, 6560);
  assert.equal(sep.llamadas3p + sep.llamadasGeneral, 10404);
  assert.equal(ago.wpp3p + ago.wppGeneral, 3382);
  assert.equal(sep.wpp3p + sep.wppGeneral, 3997);
});

test('validacion: numero negativo -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/calidad/salida/carga').set(auth(admin)).send({ campana: 'ORLANT', filas: [fila({ 1: -5 })] });
  assert.equal(res.status, 400);
});

test('validacion: mes con formato invalido -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/calidad/salida/carga').set(auth(admin)).send({ campana: 'ORLANT', filas: [fila({ 0: 'AGOSTO-2025' })] });
  assert.equal(res.status, 400);
});

test('validacion: mes futuro -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const futuro = new Date();
  futuro.setUTCFullYear(futuro.getUTCFullYear() + 5);
  const mesFuturo = futuro.getUTCFullYear() + '-01';
  const res = await request(app).post('/api/calidad/salida/carga').set(auth(admin)).send({ campana: 'ORLANT', filas: [fila({ 0: mesFuturo })] });
  assert.equal(res.status, 400);
});

test('validacion: fila con menos de 5 campos -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/calidad/salida/carga').set(auth(admin)).send({ campana: 'ORLANT', filas: [['2025-04', 100, 200, 50]] });
  assert.equal(res.status, 400);
});

test('campana distinta de ORLANT (ya cubierta por campaignAccess, igual que las demas bases): sin acceso -> 403', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  // El admin maestro tiene acceso a todo -- probamos con un usuario sin
  // ese permiso para confirmar que campaignAccess SI se aplica a esta ruta.
  const create = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send({ nombre: 'X', user: 'sal_otracamp_' + Math.random().toString(36).slice(2, 7), password: 'ClaveSal12345', rol: 'CALIDAD', perms: { Calidad: true, campana_OTRACAMPANA: true } });
  const token = await tokenFor(create.body.user, 'ClaveSal12345');
  const res = await request(app).post('/api/calidad/salida/carga').set(auth(token)).send({ campana: 'ORLANT', filas: [fila()] });
  assert.equal(res.status, 403);
});
