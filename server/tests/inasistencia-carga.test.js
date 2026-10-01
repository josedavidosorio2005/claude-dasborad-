// inasistencia-carga.test.js — POST /api/calidad/inasistencia/carga(/impacto)
// + GET /api/calidad/inasistencia/(resumen|especialidad|mensual|opciones)
// (Fase 98, ORLANT, pedido urgente de Edwin; reescrito en la Fase 108,
// pedido textual de InCo: filtros de sede/especialidad/entidad). Mismo
// patron que agendas-carga.test.js: reemplazo (aqui por MES, no por rango
// de fecha), impacto/confirmacion, filtros, permisos, % ponderado. Datos
// SIEMPRE inventados.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

// [mes, sede, especialidad, entidad, cancelada, inasistencia, pendiente, atendidas, total]
function fila(over) {
  const base = ['2025-04', 'SEDE 1', 'AUDIFONOS', 'EPS UNO', 475, 109, 10, 2270, 2864];
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
      filas: [fila({ 0: '2025-05', 2: especialidad, 4: 475, 5: 109, 6: 10, 7: 2270, 8: 2864 })],
    });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.insertadas, 1);
  assert.deepEqual(res.body.meses, ['2025-05']);

  const porEsp = await request(app).get('/api/calidad/inasistencia/especialidad?campana=ORLANT&mes=2025-05').set(auth(admin));
  assert.equal(porEsp.status, 200);
  const fEsp = porEsp.body.find((r) => r.especialidad === especialidad);
  assert.ok(fEsp, 'la especialidad cargada debe aparecer');
  assert.equal(fEsp.total, 2864);

  // % ponderado = (inasistencia+pendiente)/total = (109+10)/2864 = 4.1550...% -> 4.16 con 2 decimales.
  const resumen = await request(app).get('/api/calidad/inasistencia/resumen?campana=ORLANT&mes=2025-05&especialidad=' + encodeURIComponent(especialidad)).set(auth(admin));
  assert.equal(resumen.status, 200, JSON.stringify(resumen.body));
  assert.equal(resumen.body.total, 2864);
  assert.equal(resumen.body.pct, Math.round(((109 + 10) / 2864) * 10000) / 100);
  assert.equal(resumen.body.pct, 4.16);
});

test('% ponderado NUNCA es el promedio simple de los % por especialidad (numeros de control del archivo real)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const campana = 'ORLANT';
  const mes = '2025-06';
  await request(app).post('/api/calidad/inasistencia/carga').set(auth(admin)).send({
    campana,
    filas: [
      fila({ 0: mes, 2: 'AUDIFONOS', 4: 475, 5: 109, 6: 10, 7: 2270, 8: 2864 }),
      fila({ 0: mes, 2: 'AUDIOLOGIA', 4: 327, 5: 127, 6: 1, 7: 1317, 8: 1772 }),
      fila({ 0: mes, 2: 'EXAMENES ESPECIALES', 4: 352, 5: 84, 6: 1, 7: 820, 8: 1257 }),
    ],
  });
  const resumen = await request(app).get(`/api/calidad/inasistencia/resumen?campana=${campana}&mes=${mes}`).set(auth(admin));
  assert.equal(resumen.status, 200, JSON.stringify(resumen.body));
  assert.equal(resumen.body.total, 2864 + 1772 + 1257); // 5893
  const ponderado = Math.round(((320 + 12) / 5893) * 10000) / 100;
  assert.equal(resumen.body.pct, ponderado);
  assert.equal(resumen.body.pct, 5.63);
  const promedioSimple = Math.round(((4.16 + 7.22 + 6.76) / 3) * 100) / 100;
  assert.notEqual(resumen.body.pct, promedioSimple);
});

test('reemplaza por MES: subir el MISMO archivo 2 veces no duplica (sigue en el mismo conteo)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const especialidad = 'ESP DUP ' + Math.random().toString(36).slice(2, 8);
  const payload = {
    campana: 'ORLANT',
    archivoNombre: 'INASISTENCIA_dup.xlsx',
    filas: [fila({ 0: '2025-07', 2: especialidad })],
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
    campana: 'ORLANT', filas: [fila({ 0: '2025-08', 2: especialidad })],
  });
  await request(app).post('/api/calidad/inasistencia/carga').set(auth(admin)).send({
    campana: 'ORLANT', filas: [fila({ 0: '2025-09', 2: especialidad })],
  });
  const porMes = await request(app).get('/api/calidad/inasistencia/mensual?campana=ORLANT&especialidad=' + encodeURIComponent(especialidad)).set(auth(admin));
  const meses = porMes.body.map((r) => r.mes);
  assert.ok(meses.includes('2025-08') && meses.includes('2025-09'), 'agosto y septiembre son meses distintos -- las 2 filas deben seguir existiendo');
});

test('un archivo con VARIOS meses reemplaza SOLO esos meses', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const especialidad = 'ESP MULTI ' + Math.random().toString(36).slice(2, 6);
  const res = await request(app).post('/api/calidad/inasistencia/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [
      fila({ 0: '2025-10', 2: especialidad }),
      fila({ 0: '2025-10', 2: 'OTRA ESP', 4: 100, 5: 20, 6: 2, 7: 400, 8: 522 }),
      fila({ 0: '2025-11', 2: especialidad }),
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
    filas: [fila({ 0: '2025-12', 2: especialidad }), fila({ 0: '2025-12', 2: 'OTRA', 4: 1, 5: 1, 6: 0, 7: 10, 8: 12 })],
  });

  const impacto = await request(app).post('/api/calidad/inasistencia/carga/impacto').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [fila({ 0: '2025-12', 2: especialidad })],
  });
  assert.equal(impacto.status, 200, JSON.stringify(impacto.body));
  assert.equal(impacto.body.filasExistentes, 2);
  assert.equal(impacto.body.filasNuevas, 1);
  assert.deepEqual(impacto.body.meses, ['2025-12']);

  const porEsp = await request(app).get('/api/calidad/inasistencia/especialidad?campana=ORLANT&mes=2025-12').set(auth(admin));
  assert.equal(porEsp.body.length, 2, '/carga/impacto no debe escribir nada en la base');
});

test('GET /calidad/inasistencia/opciones: trae meses, sedes, especialidades y entidades con datos', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const especialidad = 'ESP OPCIONES ' + Math.random().toString(36).slice(2, 6);
  const sede = 'SEDE OPCIONES ' + Math.random().toString(36).slice(2, 6);
  const entidad = 'ENTIDAD OPCIONES ' + Math.random().toString(36).slice(2, 6);
  await request(app).post('/api/calidad/inasistencia/carga').set(auth(admin)).send({
    campana: 'ORLANT', filas: [fila({ 0: '2024-01', 1: sede, 2: especialidad, 3: entidad })],
  });
  const res = await request(app).get('/api/calidad/inasistencia/opciones?campana=ORLANT').set(auth(admin));
  assert.equal(res.status, 200);
  assert.ok(res.body.especialidades.indexOf(especialidad) !== -1);
  assert.ok(res.body.sedes.indexOf(sede) !== -1);
  assert.ok(res.body.entidades.indexOf(entidad) !== -1);
  assert.ok(res.body.meses.indexOf('2024-01') !== -1);
});

test('filtros de Sede/Especialidad/Entidad cambian el % (mismo mes, un filtro de sede distinto deja afuera la otra sede)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const mes = '2025-04';
  const sedeA = 'SEDE FILTRO A ' + Math.random().toString(36).slice(2, 6);
  const sedeB = 'SEDE FILTRO B ' + Math.random().toString(36).slice(2, 6);
  const especialidad = 'ESP FILTRO ' + Math.random().toString(36).slice(2, 6);
  await request(app).post('/api/calidad/inasistencia/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [
      fila({ 0: mes, 1: sedeA, 2: especialidad, 4: 0, 5: 10, 6: 0, 7: 90, 8: 100 }), // 10%
      fila({ 0: mes, 1: sedeB, 2: especialidad, 4: 0, 5: 50, 6: 0, 7: 50, 8: 100 }), // 50%
    ],
  });
  const soloA = await request(app).get(`/api/calidad/inasistencia/resumen?campana=ORLANT&mes=${mes}&sede=${encodeURIComponent(sedeA)}&especialidad=${encodeURIComponent(especialidad)}`).set(auth(admin));
  assert.equal(soloA.body.pct, 10);
  const soloB = await request(app).get(`/api/calidad/inasistencia/resumen?campana=ORLANT&mes=${mes}&sede=${encodeURIComponent(sedeB)}&especialidad=${encodeURIComponent(especialidad)}`).set(auth(admin));
  assert.equal(soloB.body.pct, 50);
  const ambas = await request(app).get(`/api/calidad/inasistencia/resumen?campana=ORLANT&mes=${mes}&especialidad=${encodeURIComponent(especialidad)}`).set(auth(admin));
  assert.equal(ambas.body.pct, 30); // (10+50)/(100+100) ponderado
});

test('GET /calidad/inasistencia/especialidad respeta sede/entidad y agrupa por especialidad (GROUP BY, nunca una fila por entidad)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const mes = '2025-04';
  const especialidad = 'ESP GROUPBY ' + Math.random().toString(36).slice(2, 6);
  const entidadX = 'ENTIDAD X ' + Math.random().toString(36).slice(2, 6);
  const entidadY = 'ENTIDAD Y ' + Math.random().toString(36).slice(2, 6);
  await request(app).post('/api/calidad/inasistencia/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [
      fila({ 0: mes, 2: especialidad, 3: entidadX, 4: 0, 5: 5, 6: 0, 7: 45, 8: 50 }),
      fila({ 0: mes, 2: especialidad, 3: entidadY, 4: 0, 5: 5, 6: 0, 7: 45, 8: 50 }),
    ],
  });
  const res = await request(app).get(`/api/calidad/inasistencia/especialidad?campana=ORLANT&mes=${mes}`).set(auth(admin));
  const filas = res.body.filter((r) => r.especialidad === especialidad);
  assert.equal(filas.length, 1, 'una sola fila por especialidad, sin importar cuantas entidades la compongan');
  assert.equal(filas[0].total, 100);

  const soloX = await request(app).get(`/api/calidad/inasistencia/especialidad?campana=ORLANT&mes=${mes}&entidad=${encodeURIComponent(entidadX)}`).set(auth(admin));
  const filaX = soloX.body.find((r) => r.especialidad === especialidad);
  assert.equal(filaX.total, 50);
});

test('GET /calidad/inasistencia/mensual: ignora el filtro implicito de un solo mes (trae TODOS los meses con datos), respeta especialidad y rango', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const especialidad = 'ESP RANGO ' + Math.random().toString(36).slice(2, 6);
  await request(app).post('/api/calidad/inasistencia/carga').set(auth(admin)).send({
    campana: 'ORLANT', filas: [fila({ 0: '2024-02', 2: especialidad })],
  });
  await request(app).post('/api/calidad/inasistencia/carga').set(auth(admin)).send({
    campana: 'ORLANT', filas: [fila({ 0: '2024-03', 2: especialidad })],
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
    campana: 'ORLANT', filas: [fila({ 4: -5 })],
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

test('validacion: sede/entidad vacias -> 400 (el navegador siempre manda "SIN SEDE"/"SIN ENTIDAD", nunca vacio)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/calidad/inasistencia/carga').set(auth(admin)).send({
    campana: 'ORLANT', filas: [fila({ 1: '' })],
  });
  assert.equal(res.status, 400);
});

test('validacion: fila con menos de 9 campos -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/calidad/inasistencia/carga').set(auth(admin)).send({
    campana: 'ORLANT', filas: [['2025-04', 'SEDE 1', 'AUDIFONOS', 'EPS UNO', 475]],
  });
  assert.equal(res.status, 400);
});

// ── Fase 109: reemplazo de un mes "formato viejo" (SIN DATO) por el formato nuevo ──
test('Fase 109: subir un mes en formato NUEVO reemplaza por completo las filas viejas "SIN DATO" de ese mismo mes, sin dejar mezcla', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const mes = '2026-09';
  const especialidadVieja = 'EXAMENES ESPECIALES FASE109 ' + Math.random().toString(36).slice(2, 6);
  const especialidadNueva = 'AUDIOLOGIA FASE109 ' + Math.random().toString(36).slice(2, 6);

  // 1) Carga vieja: sede/entidad = 'SIN DATO' (formato Fase 98-106).
  await request(app).post('/api/calidad/inasistencia/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [fila({ 0: mes, 1: 'SIN DATO', 2: especialidadVieja, 3: 'SIN DATO', 4: 452, 5: 94, 6: 2, 7: 935, 8: 1483 })],
  });
  const opcionesAntes = await request(app).get('/api/calidad/inasistencia/opciones?campana=ORLANT').set(auth(admin));
  assert.ok(opcionesAntes.body.mesesFormatoViejo.includes(mes), 'el mes debe quedar marcado como formato viejo tras la carga vieja');

  // 2) Carga nueva para el MISMO mes: sede/entidad reales (formato Fase 108+).
  const res = await request(app).post('/api/calidad/inasistencia/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [fila({ 0: mes, 1: 'SEDE PRINCIPAL', 2: especialidadNueva, 3: 'EPS REAL', 4: 10, 5: 20, 6: 5, 7: 65, 8: 100 })],
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.borradas, 1, 'debe borrar la UNICA fila vieja de ese mes antes de insertar la nueva');

  // 3) La especialidad VIEJA ya no debe aparecer, ni el mes debe seguir marcado como formato viejo.
  const porEsp = await request(app).get(`/api/calidad/inasistencia/especialidad?campana=ORLANT&mes=${mes}`).set(auth(admin));
  assert.ok(!porEsp.body.some((r) => r.especialidad === especialidadVieja), 'la especialidad del formato viejo no debe quedar mezclada');
  const filaNueva = porEsp.body.find((r) => r.especialidad === especialidadNueva);
  assert.ok(filaNueva, 'la especialidad nueva debe estar presente');
  assert.equal(filaNueva.total, 100, 'el total debe ser SOLO el de la carga nueva, sin sumar la vieja (1483)');

  const opcionesDespues = await request(app).get('/api/calidad/inasistencia/opciones?campana=ORLANT').set(auth(admin));
  assert.ok(!opcionesDespues.body.mesesFormatoViejo.includes(mes), 'el mes ya no debe estar marcado como formato viejo (tiene sede/entidad reales ahora)');
  assert.ok(opcionesDespues.body.sedes.includes('SEDE PRINCIPAL'));
  assert.ok(opcionesDespues.body.entidades.includes('EPS REAL'));
});

test('GET /calidad/inasistencia/opciones: mesesFormatoViejo nunca incluye un mes con AL MENOS una fila de sede real', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const mes = '2024-05';
  const especialidad = 'ESP MIXTO ' + Math.random().toString(36).slice(2, 6);
  await request(app).post('/api/calidad/inasistencia/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [
      fila({ 0: mes, 1: 'SIN DATO', 2: especialidad, 3: 'SIN DATO' }),
      fila({ 0: mes, 1: 'SEDE PRINCIPAL', 2: especialidad, 3: 'EPS OTRA' }),
    ],
  });
  const opciones = await request(app).get('/api/calidad/inasistencia/opciones?campana=ORLANT').set(auth(admin));
  assert.ok(!opciones.body.mesesFormatoViejo.includes(mes), 'con al menos 1 fila de sede real, el mes NO es 100% formato viejo');
});
