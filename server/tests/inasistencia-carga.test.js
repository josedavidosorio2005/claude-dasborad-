// inasistencia-carga.test.js — POST /api/calidad/inasistencia/carga(/impacto)
// + GET /api/calidad/inasistencia/(resumen|especialidad|mensual|opciones)
// (Fase 98, ORLANT, pedido urgente de Edwin). Mismo patron que
// agendas-carga.test.js: reemplazo (aqui por MES, no por rango de fecha),
// impacto/confirmacion, filtros, permisos, % ponderado. Datos SIEMPRE
// inventados.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

// [mes, especialidad, cancelada, inasistencia, pendiente, atendidas, total]
function fila(over) {
  const base = ['2025-04', 'AUDIFONOS', 475, 109, 10, 2270, 2864];
  return Object.assign([], base, over);
}

test('POST /calidad/inasistencia/carga: solo quien tiene el permiso Cargar Datos puede subir', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const create = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send({ nombre: 'X', user: 'inasist_noadmin_' + Math.random().toString(36).slice(2, 7), password: 'ClaveInasist1234', rol: 'CALIDAD', perms: { Calidad: true, campana_ORLANT: true } });
  assert.equal(create.status, 201);
  const token = await tokenFor(create.body.user, 'ClaveInasist1234');
  const res = await request(app)
    .post('/api/calidad/inasistencia/carga')
    .set(auth(token))
    .send({ campana: 'ORLANT', filas: [fila()] });
  assert.equal(res.status, 403);
});

test('carga valida: se guarda y GET /especialidad + /resumen la agregan correctamente (% ponderado)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const especialidad = 'ESP TEST ' + Math.random().toString(36).slice(2, 8);
  const res = await request(app)
    .post('/api/calidad/inasistencia/carga')
    .set(auth(admin))
    .send({
      campana: 'ORLANT',
      archivoNombre: 'INASISTENCIA_test.xlsx',
      filas: [fila({ 0: '2025-05', 1: especialidad, 2: 475, 3: 109, 4: 10, 5: 2270, 6: 2864 })],
    });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.insertadas, 1);
  assert.deepEqual(res.body.meses, ['2025-05']);

  const porEsp = await request(app).get('/api/calidad/inasistencia/especialidad?campana=ORLANT&mes=2025-05').set(auth(admin));
  assert.equal(porEsp.status, 200);
  const fEsp = porEsp.body.find((r) => r.especialidad === especialidad);
  assert.ok(fEsp, 'la especialidad cargada debe aparecer');
  assert.equal(fEsp.total, 2864);

  // % ponderado = (inasistencia+pendiente)/total = (109+10)/2864 = 4.1550...% -> 4.16 con 2 decimales
  // (numero de control real del pedido de Edwin: solo cuadra con 2 decimales, 1 decimal daria 4.2%).
  const resumen = await request(app).get('/api/calidad/inasistencia/resumen?campana=ORLANT&mes=2025-05&especialidad=' + encodeURIComponent(especialidad)).set(auth(admin));
  assert.equal(resumen.status, 200, JSON.stringify(resumen.body));
  assert.equal(resumen.body.total, 2864);
  assert.equal(resumen.body.pct, Math.round(((109 + 10) / 2864) * 10000) / 100);
  assert.equal(resumen.body.pct, 4.16);
});

test('% ponderado NUNCA es el promedio simple de los % por especialidad (numeros de control del archivo real de Edwin)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const campana = 'ORLANT';
  const mes = '2025-06';
  await request(app).post('/api/calidad/inasistencia/carga').set(auth(admin)).send({
    campana,
    filas: [
      [mes, 'AUDIFONOS', 475, 109, 10, 2270, 2864],
      [mes, 'AUDIOLOGIA', 327, 127, 1, 1317, 1772],
      [mes, 'EXAMENES ESPECIALES', 352, 84, 1, 820, 1257],
    ],
  });
  const resumen = await request(app).get(`/api/calidad/inasistencia/resumen?campana=${campana}&mes=${mes}`).set(auth(admin));
  assert.equal(resumen.status, 200, JSON.stringify(resumen.body));
  assert.equal(resumen.body.total, 2864 + 1772 + 1257); // 5893
  assert.equal(resumen.body.cancelada, 475 + 327 + 352); // 1154
  assert.equal(resumen.body.inasistencia, 109 + 127 + 84); // 320
  assert.equal(resumen.body.pendiente, 10 + 1 + 1); // 12
  // Ponderado: (320+12)/5893 = 5.6321...% -> 5.63 (numero de control real del pedido).
  const ponderado = Math.round(((320 + 12) / 5893) * 10000) / 100;
  assert.equal(resumen.body.pct, ponderado);
  assert.equal(resumen.body.pct, 5.63);
  // El promedio simple de 4.16/7.22/6.76 daria ~6.05, DISTINTO del ponderado -- confirma que nunca se usa el promedio.
  const promedioSimple = Math.round(((4.16 + 7.22 + 6.76) / 3) * 100) / 100;
  assert.notEqual(resumen.body.pct, promedioSimple);
});

test('reemplaza por MES: subir el MISMO archivo 2 veces no duplica (sigue en el mismo conteo)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const especialidad = 'ESP DUP ' + Math.random().toString(36).slice(2, 8);
  const payload = {
    campana: 'ORLANT',
    archivoNombre: 'INASISTENCIA_dup.xlsx',
    filas: [fila({ 0: '2025-07', 1: especialidad })],
  };
  const uno = await request(app).post('/api/calidad/inasistencia/carga').set(auth(admin)).send(payload);
  assert.equal(uno.status, 201);
  const dos = await request(app).post('/api/calidad/inasistencia/carga').set(auth(admin)).send(payload);
  assert.equal(dos.status, 201);
  assert.equal(dos.body.borradas, 1, 'la segunda carga debe borrar la fila de la primera antes de reinsertar');

  const porEsp = await request(app).get('/api/calidad/inasistencia/especialidad?campana=ORLANT&mes=2025-07').set(auth(admin));
  const filasEsp = porEsp.body.filter((r) => r.especialidad === especialidad);
  assert.equal(filasEsp.length, 1, 'no debe duplicar');
});

test('reemplaza por MES: un archivo de un mes DISTINTO no toca las filas de otro mes', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const especialidad = 'ESP MES ' + Math.random().toString(36).slice(2, 6);
  await request(app).post('/api/calidad/inasistencia/carga').set(auth(admin)).send({
    campana: 'ORLANT', filas: [fila({ 0: '2025-08', 1: especialidad })],
  });
  await request(app).post('/api/calidad/inasistencia/carga').set(auth(admin)).send({
    campana: 'ORLANT', filas: [fila({ 0: '2025-09', 1: especialidad })],
  });
  const porMes = await request(app).get('/api/calidad/inasistencia/mensual?campana=ORLANT&especialidad=' + encodeURIComponent(especialidad)).set(auth(admin));
  const meses = porMes.body.map((r) => r.mes);
  assert.ok(meses.includes('2025-08') && meses.includes('2025-09'), 'agosto y septiembre son meses distintos -- las 2 filas deben seguir existiendo');
});

test('un archivo con VARIOS meses reemplaza SOLO esos meses (Ago-26/Sep-26 real: 1 mes cerrado + 1 mes parcial)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const especialidad = 'ESP MULTI ' + Math.random().toString(36).slice(2, 6);
  const res = await request(app).post('/api/calidad/inasistencia/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [
      fila({ 0: '2025-10', 1: especialidad }),
      ['2025-10', 'OTRA ESP', 100, 20, 2, 400, 522],
      fila({ 0: '2025-11', 1: especialidad }),
    ],
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual(res.body.meses, ['2025-10', '2025-11']);
  assert.equal(res.body.insertadas, 3);
});

test('POST /calidad/inasistencia/carga/impacto: cuenta cuantas filas se reemplazarian SIN escribir nada', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const especialidad = 'ESP IMPACTO ' + Math.random().toString(36).slice(2, 6);
  await request(app).post('/api/calidad/inasistencia/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [fila({ 0: '2025-12', 1: especialidad }), ['2025-12', 'OTRA', 1, 1, 0, 10, 12]],
  });

  const impacto = await request(app).post('/api/calidad/inasistencia/carga/impacto').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [fila({ 0: '2025-12', 1: especialidad })],
  });
  assert.equal(impacto.status, 200, JSON.stringify(impacto.body));
  assert.equal(impacto.body.filasExistentes, 2);
  assert.equal(impacto.body.filasNuevas, 1);
  assert.deepEqual(impacto.body.meses, ['2025-12']);

  // No debe haber escrito nada -- las 2 filas originales siguen intactas.
  const porEsp = await request(app).get('/api/calidad/inasistencia/especialidad?campana=ORLANT&mes=2025-12').set(auth(admin));
  assert.equal(porEsp.body.length, 2, '/carga/impacto no debe escribir nada en la base');
});

test('GET /calidad/inasistencia/opciones: trae meses y especialidades con datos', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const especialidad = 'ESP OPCIONES ' + Math.random().toString(36).slice(2, 6);
  await request(app).post('/api/calidad/inasistencia/carga').set(auth(admin)).send({
    campana: 'ORLANT', filas: [fila({ 0: '2024-01', 1: especialidad })],
  });
  const res = await request(app).get('/api/calidad/inasistencia/opciones?campana=ORLANT').set(auth(admin));
  assert.equal(res.status, 200);
  assert.ok(res.body.especialidades.indexOf(especialidad) !== -1);
  assert.ok(res.body.meses.indexOf('2024-01') !== -1);
});

test('GET /calidad/inasistencia/mensual: ignora el filtro implicito de un solo mes (trae TODOS los meses con datos), respeta especialidad y rango', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const especialidad = 'ESP RANGO ' + Math.random().toString(36).slice(2, 6);
  await request(app).post('/api/calidad/inasistencia/carga').set(auth(admin)).send({
    campana: 'ORLANT', filas: [fila({ 0: '2024-02', 1: especialidad })],
  });
  await request(app).post('/api/calidad/inasistencia/carga').set(auth(admin)).send({
    campana: 'ORLANT', filas: [fila({ 0: '2024-03', 1: especialidad })],
  });
  const sinRango = await request(app).get('/api/calidad/inasistencia/mensual?campana=ORLANT&especialidad=' + encodeURIComponent(especialidad)).set(auth(admin));
  const mesesSinRango = sinRango.body.map((r) => r.mes);
  assert.ok(mesesSinRango.includes('2024-02') && mesesSinRango.includes('2024-03'));

  const conRango = await request(app).get('/api/calidad/inasistencia/mensual?campana=ORLANT&especialidad=' + encodeURIComponent(especialidad) + '&desde=2024-03&hasta=2024-03').set(auth(admin));
  const mesesConRango = conRango.body.map((r) => r.mes);
  assert.deepEqual(mesesConRango, ['2024-03'], 'el rango desde/hasta SI acota /mensual');
});

test('GET /calidad/inasistencia/especialidad respeta el acceso por campana', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const create = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send({ nombre: 'X', user: 'inasist_sincamp_' + Math.random().toString(36).slice(2, 7), password: 'ClaveInasist1234', rol: 'CALIDAD', perms: { Calidad: true } });
  const token = await tokenFor(create.body.user, 'ClaveInasist1234');
  const res = await request(app).get('/api/calidad/inasistencia/especialidad?campana=ORLANT&mes=2025-04').set(auth(token));
  assert.equal(res.status, 403);
});

test('validacion: numero negativo -> 400 (defensa en el servidor, no solo en el navegador)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/calidad/inasistencia/carga').set(auth(admin)).send({
    campana: 'ORLANT', filas: [fila({ 2: -5 })],
  });
  assert.equal(res.status, 400);
});

test('validacion: mes con formato invalido -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/calidad/inasistencia/carga').set(auth(admin)).send({
    campana: 'ORLANT', filas: [fila({ 0: 'AGOSTO-2025' })],
  });
  assert.equal(res.status, 400);
});

test('validacion: mes futuro -> 400 (defensa en el servidor, misma regla que Agendas/Tipificacion)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const futuro = new Date();
  futuro.setUTCFullYear(futuro.getUTCFullYear() + 5);
  const mesFuturo = futuro.getUTCFullYear() + '-01';
  const res = await request(app).post('/api/calidad/inasistencia/carga').set(auth(admin)).send({
    campana: 'ORLANT', filas: [fila({ 0: mesFuturo })],
  });
  assert.equal(res.status, 400);
});

test('validacion: fila con menos de 7 campos -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/calidad/inasistencia/carga').set(auth(admin)).send({
    campana: 'ORLANT', filas: [['2025-04', 'AUDIFONOS', 475]],
  });
  assert.equal(res.status, 400);
});
