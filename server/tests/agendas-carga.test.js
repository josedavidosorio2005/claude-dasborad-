// agendas-carga.test.js — POST /api/calidad/agendas/carga(/impacto) + GET
// /api/calidad/agendas/(especialidad|mensual|opciones) (Fase 78, ORLANT).
// Mismo patron que trafico-whatsapp-carga.test.js: reemplazo por periodo,
// impacto/confirmacion, filtros, permisos. Datos SIEMPRE inventados.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

// [asesor, sede, examen, especialidad, profesional, fechaSolicitud, tipoLinea, entidad]
function fila(over) {
  const base = ['ASESOR 01', 'SEDE CENTRO', 'AUDIOMETRIA', 'AUDIOLOGIA', 'DR PEREZ', '2025-04-15 10:00:00', 'GENERAL', 'EPS DEMO'];
  return Object.assign([], base, over);
}

test('POST /calidad/agendas/carga: solo quien tiene el permiso Cargar Datos puede subir', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const create = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send({ nombre: 'X', user: 'agendas_noadmin_' + Math.random().toString(36).slice(2, 7), password: 'ClaveAgendas1234', rol: 'CALIDAD', perms: { Calidad: true, campana_ORLANT: true } });
  assert.equal(create.status, 201);
  const token = await tokenFor(create.body.user, 'ClaveAgendas1234');
  const res = await request(app)
    .post('/api/calidad/agendas/carga')
    .set(auth(token))
    .send({ campana: 'ORLANT', filas: [fila()] });
  assert.equal(res.status, 403);
});

test('carga valida: se guarda y GET /especialidad la agrega correctamente', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const especialidad = 'ESP TEST ' + Math.random().toString(36).slice(2, 8);
  const res = await request(app)
    .post('/api/calidad/agendas/carga')
    .set(auth(admin))
    .send({
      campana: 'ORLANT',
      archivoNombre: 'AGENDAS_test.xlsx',
      filas: [
        fila({ 3: especialidad, 5: '2025-04-01 08:00:00' }),
        fila({ 3: especialidad, 5: '2025-04-02 09:00:00' }),
        fila({ 3: especialidad, 5: '2025-04-03 10:00:00' }),
      ],
    });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.insertadas, 3);
  assert.equal(res.body.desde, '2025-04-01 08:00:00');
  assert.equal(res.body.hasta, '2025-04-03 10:00:00');

  const porEsp = await request(app).get('/api/calidad/agendas/especialidad?campana=ORLANT').set(auth(admin));
  assert.equal(porEsp.status, 200);
  const fEsp = porEsp.body.find((r) => r.especialidad === especialidad);
  assert.ok(fEsp, 'la especialidad cargada debe aparecer agregada');
  assert.equal(fEsp.cantidad, 3);
});

test('reemplaza por periodo: subir el MISMO archivo 2 veces no duplica (sigue en el mismo conteo)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const especialidad = 'ESP DUP ' + Math.random().toString(36).slice(2, 8);
  const payload = {
    campana: 'ORLANT',
    archivoNombre: 'AGENDAS_dup.xlsx',
    filas: [
      fila({ 3: especialidad, 5: '2025-05-01 08:00:00' }),
      fila({ 3: especialidad, 5: '2025-05-02 08:00:00' }),
    ],
  };
  const uno = await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send(payload);
  assert.equal(uno.status, 201);
  const dos = await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send(payload);
  assert.equal(dos.status, 201);
  assert.equal(dos.body.borradas, 2, 'la segunda carga debe borrar las 2 filas de la primera antes de reinsertar');

  const porEsp = await request(app).get('/api/calidad/agendas/especialidad?campana=ORLANT&mes=2025-05').set(auth(admin));
  const fEsp = porEsp.body.find((r) => r.especialidad === especialidad);
  assert.equal(fEsp.cantidad, 2, 'no debe duplicar');
});

test('reemplaza por periodo: un archivo de un rango DISTINTO no toca las filas de otro rango', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const especialidad = 'ESP RANGO ' + Math.random().toString(36).slice(2, 6);
  await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({
    campana: 'ORLANT', filas: [fila({ 3: especialidad, 5: '2025-06-01 08:00:00' })],
  });
  await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({
    campana: 'ORLANT', filas: [fila({ 3: especialidad, 5: '2025-07-01 08:00:00' })],
  });
  const porEsp = await request(app).get('/api/calidad/agendas/especialidad?campana=ORLANT').set(auth(admin));
  const fEsp = porEsp.body.find((r) => r.especialidad === especialidad);
  assert.equal(fEsp.cantidad, 2, 'junio y julio son rangos distintos -- las 2 filas deben seguir existiendo');
});

test('POST /calidad/agendas/carga/impacto: cuenta cuantas filas se reemplazarian SIN escribir nada', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const especialidad = 'ESP IMPACTO ' + Math.random().toString(36).slice(2, 6);
  await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [fila({ 3: especialidad, 5: '2025-08-01 08:00:00' }), fila({ 3: especialidad, 5: '2025-08-02 08:00:00' })],
  });

  const impacto = await request(app).post('/api/calidad/agendas/carga/impacto').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [fila({ 3: especialidad, 5: '2025-08-01 08:00:00' }), fila({ 3: especialidad, 5: '2025-08-03 08:00:00' })],
  });
  assert.equal(impacto.status, 200, JSON.stringify(impacto.body));
  assert.equal(impacto.body.filasExistentes, 2);
  assert.equal(impacto.body.filasNuevas, 2);
  assert.equal(impacto.body.desde, '2025-08-01 08:00:00');
  assert.equal(impacto.body.hasta, '2025-08-03 08:00:00');

  // No debe haber escrito nada.
  const porEsp = await request(app).get('/api/calidad/agendas/especialidad?campana=ORLANT&mes=2025-08').set(auth(admin));
  const fEsp = porEsp.body.find((r) => r.especialidad === especialidad);
  assert.equal(fEsp.cantidad, 2, '/carga/impacto no debe escribir nada en la base');
});

test('filtros: cada filtro (asesor/sede/especialidad/examen/profesional/tipoLinea/entidad) acota el resultado', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const especialidad = 'ESP FILTRO ' + Math.random().toString(36).slice(2, 6);
  await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [
      fila({ 0: 'ASESOR A', 1: 'SEDE UNO', 2: 'EXAMEN X', 3: especialidad, 4: 'DR A', 5: '2025-09-01 08:00:00', 6: '3P', 7: 'ENTIDAD A' }),
      fila({ 0: 'ASESOR B', 1: 'SEDE DOS', 2: 'EXAMEN Y', 3: especialidad, 4: 'DR B', 5: '2025-09-02 08:00:00', 6: 'GENERAL', 7: 'ENTIDAD B' }),
    ],
  });
  const base = '/api/calidad/agendas/especialidad?campana=ORLANT&mes=2025-09&especialidad=' + encodeURIComponent(especialidad);
  async function contar(qs) {
    const r = await request(app).get(base + qs).set(auth(admin));
    const f = r.body.find((x) => x.especialidad === especialidad);
    return f ? f.cantidad : 0;
  }
  assert.equal(await contar(''), 2);
  assert.equal(await contar('&asesor=ASESOR A'), 1);
  assert.equal(await contar('&sede=SEDE DOS'), 1);
  assert.equal(await contar('&examen=EXAMEN X'), 1);
  assert.equal(await contar('&profesional=DR B'), 1);
  assert.equal(await contar('&tipoLinea=3P'), 1);
  assert.equal(await contar('&entidad=ENTIDAD A'), 1);
  assert.equal(await contar('&asesor=ASESOR A&sede=SEDE DOS'), 0, 'filtros combinados son AND, no OR');
});

test('total mensual: ignora el filtro de mes (siempre muestra todos los meses), pero respeta los demas filtros', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const especialidad = 'ESP MENSUAL ' + Math.random().toString(36).slice(2, 6);
  await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [fila({ 0: 'ASESOR MENSUAL', 3: especialidad, 5: '2025-10-01 08:00:00' })],
  });
  await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [fila({ 0: 'ASESOR MENSUAL', 3: especialidad, 5: '2025-11-01 08:00:00' })],
  });

  // Con mes=2025-10 puesto, /especialidad SI lo respeta (solo octubre).
  const porEsp = await request(app).get('/api/calidad/agendas/especialidad?campana=ORLANT&mes=2025-10&asesor=ASESOR MENSUAL&especialidad=' + encodeURIComponent(especialidad)).set(auth(admin));
  assert.equal(porEsp.body.find((r) => r.especialidad === especialidad).cantidad, 1);

  // /mensual con el MISMO mes=2025-10 puesto -- debe traer octubre Y noviembre igual (lo ignora).
  const porMes = await request(app).get('/api/calidad/agendas/mensual?campana=ORLANT&mes=2025-10&asesor=ASESOR MENSUAL').set(auth(admin));
  const octubre = porMes.body.find((r) => r.mes === '2025-10');
  const noviembre = porMes.body.find((r) => r.mes === '2025-11');
  assert.ok(octubre && octubre.cantidad >= 1, 'octubre debe seguir apareciendo');
  assert.ok(noviembre && noviembre.cantidad >= 1, 'noviembre NO debe filtrarse aunque mes=2025-10 este puesto');
});

test('GET /calidad/agendas/opciones: trae valores distintos + meses con datos', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const asesor = 'ASESOR OPCIONES ' + Math.random().toString(36).slice(2, 6);
  await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({
    campana: 'ORLANT', filas: [fila({ 0: asesor, 5: '2025-12-01 08:00:00' })],
  });
  const res = await request(app).get('/api/calidad/agendas/opciones?campana=ORLANT').set(auth(admin));
  assert.equal(res.status, 200);
  assert.ok(res.body.asesores.indexOf(asesor) !== -1);
  assert.ok(res.body.meses.indexOf('2025-12') !== -1);
  assert.deepEqual(res.body.tiposLinea, ['3P', 'GENERAL']);
});

test('GET /calidad/agendas/especialidad respeta el acceso por campana', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const create = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send({ nombre: 'X', user: 'agendas_sincamp_' + Math.random().toString(36).slice(2, 7), password: 'ClaveAgendas1234', rol: 'CALIDAD', perms: { Calidad: true } });
  const token = await tokenFor(create.body.user, 'ClaveAgendas1234');
  const res = await request(app).get('/api/calidad/agendas/especialidad?campana=ORLANT').set(auth(token));
  assert.equal(res.status, 403);
});

test('validacion: TIPO DE LINEA distinto de 3P/GENERAL -> 400 (defensa en el servidor, no solo en el navegador)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({
    campana: 'ORLANT', filas: [fila({ 6: 'OTRA COSA' })],
  });
  assert.equal(res.status, 400);
});

test('validacion: fila con menos de 8 campos -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({
    campana: 'ORLANT', filas: [['ASESOR 01', 'SEDE CENTRO', 'AUDIOMETRIA']],
  });
  assert.equal(res.status, 400);
});

test('validacion: FECHA_SOLICITUD con formato invalido -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({
    campana: 'ORLANT', filas: [fila({ 5: '15/04/2025' })], // sin hora, formato AAAA-MM-DD HH:MM:SS esperado
  });
  assert.equal(res.status, 400);
});

test('privacidad: el valor de entidad que llega ya anonimizado (PARTICULAR / OTRA) se guarda y se lee tal cual -- el servidor nunca lo vuelve a tocar', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const especialidad = 'ESP PRIV ' + Math.random().toString(36).slice(2, 6);
  await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [fila({ 3: especialidad, 5: '2025-04-20 08:00:00', 7: 'PARTICULAR / OTRA' })],
  });
  const res = await request(app).get('/api/calidad/agendas/especialidad?campana=ORLANT&mes=2025-04&especialidad=' + encodeURIComponent(especialidad) + '&entidad=' + encodeURIComponent('PARTICULAR / OTRA')).set(auth(admin));
  assert.equal(res.body.find((r) => r.especialidad === especialidad).cantidad, 1);
});
