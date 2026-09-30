// fase95-tema-a-fecha-evaluador-automaticos.test.js — Fase 95, tema A.
//
// Edwin: la fecha del monitoreo "que se coloque automatica, que la persona
// no pueda elegir", y el evaluador "si yo ingrese con un usuario, deberia
// dejarmelo aca, que no se pueda modificar". Ademas, el asesor ahora se
// guarda tambien por id (asesorUserId) para que /monitoreos/mios no
// dependa solo del nombre (colisiona si dos asesores se llaman igual).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db, request, app, tokenFor, MASTER_PASSWORD, SEED } = require('./helpers');
const { fechaLimitesHoyColombia } = require('../fecha-limites');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const MES = new Date().toISOString().slice(0, 7);
const RESP_TODO_SI = Object.fromEntries(Array.from({ length: 17 }, (_, i) => [String(i + 1), 'SI']));
const HOY = fechaLimitesHoyColombia();

async function calidadUser(adminToken, campana, sufijo) {
  const user = 'cal95_' + sufijo + '_' + Math.random().toString(36).slice(2, 7);
  const nombre = 'Calidad Fase95 ' + sufijo;
  const create = await request(app)
    .post('/api/users')
    .set(auth(adminToken))
    .send({
      nombre,
      user,
      password: 'ClaveCalidad123',
      rol: 'CALIDAD',
      perms: { Calidad: true, ['campana_' + campana]: true },
    });
  assert.equal(create.status, 201, JSON.stringify(create.body));
  const token = await tokenFor(user, 'ClaveCalidad123');
  return { token, id: create.body.id, nombre, user };
}

async function asesorUser(adminToken, campana, nombre, sufijo) {
  const user = 'ase95_' + sufijo + '_' + Math.random().toString(36).slice(2, 7);
  const create = await request(app)
    .post('/api/users')
    .set(auth(adminToken))
    .send({ nombre, user, password: 'ClaveAsesor1234', rol: 'ASESOR', perms: {}, asesorCampana: campana });
  assert.equal(create.status, 201, JSON.stringify(create.body));
  const token = await tokenFor(user, 'ClaveAsesor1234');
  return { token, id: create.body.id, user };
}

test('POST /api/monitoreos: la fecha que manda el navegador se ignora, queda hoy (Colombia)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const { token } = await calidadUser(admin, 'ORLANT', 'fecha1');
  const otraFecha = MES === HOY.slice(0, 7) ? `${MES}-01` : `${MES}-15`;
  const res = await request(app)
    .post('/api/monitoreos')
    .set(auth(token))
    .send({ campana: 'ORLANT', asesor: 'Alguien', fecha: otraFecha, answers: RESP_TODO_SI });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.fecha, HOY, 'debe quedar hoy en Colombia, ignorando lo que mando el navegador');
});

test('POST /api/monitoreos: un administrador completo (rol ADMIN) SI puede fijar otra fecha (correccion)', async () => {
  const admin = await tokenFor('psuarez', SEED.psuarez); // ADMIN por rol, no master admin
  const fechaCorreccion = '2026-01-15';
  const res = await request(app)
    .post('/api/monitoreos')
    .set(auth(admin))
    .send({ campana: 'ORLANT', asesor: 'Alguien', fecha: fechaCorreccion, answers: RESP_TODO_SI });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.fecha, fechaCorreccion);
  assert.equal(res.body.mes, '2026-01');
});

test('POST /api/monitoreos: el evaluador que manda el navegador se ignora, queda el usuario de la sesion', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const { token, nombre } = await calidadUser(admin, 'ORLANT', 'eval1');
  const res = await request(app)
    .post('/api/monitoreos')
    .set(auth(token))
    .send({
      campana: 'ORLANT',
      asesor: 'Alguien',
      fecha: HOY,
      evaluador: 'Nombre Inventado Por El Cliente',
      answers: RESP_TODO_SI,
    });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.evaluador, nombre);
  assert.equal(res.body.evaluadorUserId != null, true);
});

test('PUT /api/monitoreos/:id: el evaluador original NUNCA cambia al editar, ni con un administrador', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const { token, nombre } = await calidadUser(admin, 'ORLANT', 'eval2');
  const create = await request(app)
    .post('/api/monitoreos')
    .set(auth(token))
    .send({ campana: 'ORLANT', asesor: 'Alguien', fecha: HOY, answers: RESP_TODO_SI });
  assert.equal(create.status, 201);
  const originalEvaluadorUserId = create.body.evaluadorUserId;

  const edit = await request(app)
    .put('/api/monitoreos/' + create.body.id)
    .set(auth(admin))
    .send({ evaluador: 'Otro Evaluador Cualquiera', observaciones: 'editado' });
  assert.equal(edit.status, 200, JSON.stringify(edit.body));
  assert.equal(edit.body.evaluador, nombre, 'el evaluador visible no cambia al editar');
  assert.equal(edit.body.evaluadorUserId, originalEvaluadorUserId);
});

test('PUT /api/monitoreos/:id: la fecha solo cambia si edita un administrador completo', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const reportes = 'rep95_' + Math.random().toString(36).slice(2, 7);
  const createRep = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send({
      nombre: 'Reportes Fase95',
      user: reportes,
      password: 'ClaveReportes12',
      rol: 'REPORTES',
      perms: { ['campana_ORLANT']: true },
    });
  assert.equal(createRep.status, 201, JSON.stringify(createRep.body));
  const reportesToken = await tokenFor(reportes, 'ClaveReportes12');

  const { token } = await calidadUser(admin, 'ORLANT', 'fecha2');
  const create = await request(app)
    .post('/api/monitoreos')
    .set(auth(token))
    .send({ campana: 'ORLANT', asesor: 'Alguien', fecha: HOY, answers: RESP_TODO_SI });
  assert.equal(create.status, 201);

  // REPORTES (no admin) intenta cambiar la fecha: se ignora, queda igual.
  const editReportes = await request(app)
    .put('/api/monitoreos/' + create.body.id)
    .set(auth(reportesToken))
    .send({ fecha: '2020-01-01' });
  assert.equal(editReportes.status, 200, JSON.stringify(editReportes.body));
  assert.equal(editReportes.body.fecha, HOY, 'REPORTES no puede cambiar la fecha');

  // Un administrador completo si puede.
  const editAdmin = await request(app)
    .put('/api/monitoreos/' + create.body.id)
    .set(auth(admin))
    .send({ fecha: '2020-01-01' });
  assert.equal(editAdmin.status, 200, JSON.stringify(editAdmin.body));
  assert.equal(editAdmin.body.fecha, '2020-01-01');
});

test('GET /api/monitoreos/mios: dos asesores con el MISMO nombre no se ven los monitoreos entre si (aislamiento por id)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const nombreCompartido = 'Asesor Duplicado Fase95 ' + Math.random().toString(36).slice(2, 6);
  const asesor1 = await asesorUser(admin, 'ORLANT', nombreCompartido, 'a1');
  const asesor2 = await asesorUser(admin, 'ORLANT', nombreCompartido, 'a2');
  const { token: calToken } = await calidadUser(admin, 'ORLANT', 'aisla');

  const create = await request(app)
    .post('/api/monitoreos')
    .set(auth(calToken))
    .send({
      campana: 'ORLANT',
      asesor: nombreCompartido,
      asesorUserId: asesor1.id,
      fecha: HOY,
      answers: RESP_TODO_SI,
    });
  assert.equal(create.status, 201, JSON.stringify(create.body));
  assert.equal(create.body.asesorUserId, asesor1.id);

  const mios1 = await request(app).get('/api/monitoreos/mios').set(auth(asesor1.token));
  assert.equal(mios1.status, 200);
  assert.equal(mios1.body.length, 1, 'el asesor1 (el elegido en el desplegable) SI ve su monitoreo');
  assert.equal(mios1.body[0].id, create.body.id);

  const mios2 = await request(app).get('/api/monitoreos/mios').set(auth(asesor2.token));
  assert.equal(mios2.status, 200);
  assert.equal(mios2.body.length, 0, 'el asesor2 (mismo nombre, otro usuario) NO ve el monitoreo del asesor1');
});

test('GET /api/monitoreos/mios: un monitoreo viejo sin asesorUserId sigue resolviendose por nombre', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const nombre = 'Asesor Viejo Fase95 ' + Math.random().toString(36).slice(2, 6);
  const asesor = await asesorUser(admin, 'ORLANT', nombre, 'viejo');

  db.prepare(
    `INSERT INTO monitoreos (campana, asesor, fecha, mes, canal, evaluador, answers, puntaje, createdAt)
     VALUES ('ORLANT', ?, ?, ?, 'LLAMADA', 'EVALUADOR X', ?, 88, '01/01/2026 10:00:00')`
  ).run(nombre, HOY, HOY.slice(0, 7), JSON.stringify({ 1: 'SI' }));

  const mios = await request(app).get('/api/monitoreos/mios').set(auth(asesor.token));
  assert.equal(mios.status, 200);
  assert.equal(mios.body.length, 1, 'fila vieja (asesorUserId NULL) sigue resolviendose por nombre');
  assert.equal(mios.body[0].puntaje, 88);
});

test('POST /api/monitoreos: un asesorUserId cuyo nombre real no coincide con el campo "asesor" no se guarda (queda null, no se confia ciegamente en el id que manda el cliente)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const asesorOrlant = await asesorUser(admin, 'ORLANT', 'Asesor Real Fase95 ' + Math.random().toString(36).slice(2, 6), 'real');
  const { token: calToken } = await calidadUser(admin, 'ORLANT', 'noconfiar');

  const res = await request(app)
    .post('/api/monitoreos')
    .set(auth(calToken))
    .send({
      campana: 'ORLANT',
      asesor: 'Un Nombre Que No Coincide Con El Usuario',
      asesorUserId: asesorOrlant.id, // id real, pero el nombre del body no coincide
      fecha: HOY,
      answers: RESP_TODO_SI,
    });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.asesorUserId, null);
});
