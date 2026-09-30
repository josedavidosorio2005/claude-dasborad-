// fase95-tema-c-alerta-asesor.test.js — Fase 95, tema C.
//
// Edwin: "cuando ingrese con su usuario y contraseña, le sale la alerta de
// que tiene un monitoreo, y el puede entrar a ver". Mecanismo: contador de
// monitoreos NUEVOS (creados despues del deploy de esta fase) sin ver, y
// un endpoint para marcarlos vistos al abrir el detalle. Los monitoreos
// viejos (incluidos los datos de prueba de Calidad) nunca cuentan.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db, request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');
const { fechaLimitesHoyColombia } = require('../fecha-limites');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const HOY = fechaLimitesHoyColombia();
const RESP_TODO_SI = Object.fromEntries(Array.from({ length: 17 }, (_, i) => [String(i + 1), 'SI']));

async function calidadUser(adminToken, campana, sufijo) {
  const user = 'cal95c_' + sufijo + '_' + Math.random().toString(36).slice(2, 7);
  const create = await request(app)
    .post('/api/users')
    .set(auth(adminToken))
    .send({
      nombre: 'Calidad Fase95C ' + sufijo,
      user,
      password: 'ClaveCalidad123',
      rol: 'CALIDAD',
      perms: { Calidad: true, ['campana_' + campana]: true },
    });
  assert.equal(create.status, 201, JSON.stringify(create.body));
  const token = await tokenFor(user, 'ClaveCalidad123');
  return { token, id: create.body.id };
}

async function asesorUser(adminToken, campana, sufijo) {
  const nombre = 'Asesor Fase95C ' + sufijo + ' ' + Math.random().toString(36).slice(2, 6);
  const user = 'ase95c_' + sufijo + '_' + Math.random().toString(36).slice(2, 7);
  const create = await request(app)
    .post('/api/users')
    .set(auth(adminToken))
    .send({ nombre, user, password: 'ClaveAsesor1234', rol: 'ASESOR', perms: {}, asesorCampana: campana });
  assert.equal(create.status, 201, JSON.stringify(create.body));
  const token = await tokenFor(user, 'ClaveAsesor1234');
  return { token, id: create.body.id, nombre };
}

async function crearMonitoreo(calToken, campana, asesor) {
  const res = await request(app)
    .post('/api/monitoreos')
    .set(auth(calToken))
    .send({ campana, asesor: asesor.nombre, asesorUserId: asesor.id, fecha: HOY, answers: RESP_TODO_SI });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}

test('la migracion monitoreos_visto_por_asesor_v1 agrego la columna y guardo la cota de activacion en app_config', () => {
  const col = db.prepare('PRAGMA table_info(monitoreos)').all().find((c) => c.name === 'vistoPorAsesorAt');
  assert.ok(col, 'la columna vistoPorAsesorAt debe existir');
  const cfg = db.prepare("SELECT valor FROM app_config WHERE clave = 'alertaAsesorDesdeMonitoreoId'").get();
  assert.ok(cfg, 'debe existir la cota de activacion en app_config');
});

test('GET /api/monitoreos/mios/nuevos: 0 si el asesor no tiene ningun monitoreo', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const asesor = await asesorUser(admin, 'ORLANT', 'vacio');
  const res = await request(app).get('/api/monitoreos/mios/nuevos').set(auth(asesor.token));
  assert.equal(res.status, 200);
  assert.equal(res.body.count, 0);
});

test('el contador cuenta bien y marcar como visto lo baja', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const asesor = await asesorUser(admin, 'ORLANT', 'cuenta');
  const { token: calToken } = await calidadUser(admin, 'ORLANT', 'cuenta');

  const m1 = await crearMonitoreo(calToken, 'ORLANT', asesor);
  const m2 = await crearMonitoreo(calToken, 'ORLANT', asesor);

  const antes = await request(app).get('/api/monitoreos/mios/nuevos').set(auth(asesor.token));
  assert.equal(antes.body.count, 2);

  const visto = await request(app).put('/api/monitoreos/' + m1.id + '/visto').set(auth(asesor.token));
  assert.equal(visto.status, 200, JSON.stringify(visto.body));
  assert.ok(visto.body.vistoPorAsesorAt, 'debe quedar marcada la fecha de visto');

  const despues = await request(app).get('/api/monitoreos/mios/nuevos').set(auth(asesor.token));
  assert.equal(despues.body.count, 1, 'baja a 1 tras marcar el primero como visto');

  await request(app).put('/api/monitoreos/' + m2.id + '/visto').set(auth(asesor.token));
  const final = await request(app).get('/api/monitoreos/mios/nuevos').set(auth(asesor.token));
  assert.equal(final.body.count, 0);
});

test('PUT /monitoreos/:id/visto es idempotente: no pisa la fecha original si se llama dos veces', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const asesor = await asesorUser(admin, 'ORLANT', 'idem');
  const { token: calToken } = await calidadUser(admin, 'ORLANT', 'idem');
  const m = await crearMonitoreo(calToken, 'ORLANT', asesor);

  const r1 = await request(app).put('/api/monitoreos/' + m.id + '/visto').set(auth(asesor.token));
  assert.equal(r1.status, 200);
  const t1 = r1.body.vistoPorAsesorAt;

  await new Promise((r) => setTimeout(r, 1100)); // nowStr() tiene resolucion de segundos
  const r2 = await request(app).put('/api/monitoreos/' + m.id + '/visto').set(auth(asesor.token));
  assert.equal(r2.status, 200);
  assert.equal(r2.body.vistoPorAsesorAt, t1, 'la segunda llamada no cambia la fecha ya marcada');
});

test('un asesor NO puede marcar como visto el monitoreo de otro asesor (403)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const asesor1 = await asesorUser(admin, 'ORLANT', 'dueno');
  const asesor2 = await asesorUser(admin, 'ORLANT', 'intruso');
  const { token: calToken } = await calidadUser(admin, 'ORLANT', 'permiso');
  const m = await crearMonitoreo(calToken, 'ORLANT', asesor1);

  const res = await request(app).put('/api/monitoreos/' + m.id + '/visto').set(auth(asesor2.token));
  assert.equal(res.status, 403);

  // Y su contador no se ve afectado (nunca fue suyo).
  const nuevos = await request(app).get('/api/monitoreos/mios/nuevos').set(auth(asesor2.token));
  assert.equal(nuevos.body.count, 0);
});

test('GET /monitoreos/mios/nuevos: monitoreos con id anterior a la cota de activacion NUNCA cuentan (datos viejos, incluidos los de prueba)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const asesor = await asesorUser(admin, 'ORLANT', 'viejo');
  const { token: calToken } = await calidadUser(admin, 'ORLANT', 'viejo');
  const m = await crearMonitoreo(calToken, 'ORLANT', asesor);

  const original = db
    .prepare("SELECT valor FROM app_config WHERE clave = 'alertaAsesorDesdeMonitoreoId'")
    .get().valor;
  // Simula el escenario real: este monitoreo ya existia ANTES del deploy
  // de esta fase (id <= la cota de activacion) -- como pasaria con los
  // datos de prueba de Calidad (Asesor 01-05) ya sembrados en produccion.
  db.prepare("UPDATE app_config SET valor = ? WHERE clave = 'alertaAsesorDesdeMonitoreoId'").run(String(m.id));
  try {
    const nuevos = await request(app).get('/api/monitoreos/mios/nuevos').set(auth(asesor.token));
    assert.equal(nuevos.status, 200);
    assert.equal(nuevos.body.count, 0, 'un monitoreo "viejo" (id <= cota) nunca dispara la alerta');
  } finally {
    db.prepare("UPDATE app_config SET valor = ? WHERE clave = 'alertaAsesorDesdeMonitoreoId'").run(original);
  }
});

test('PUT /monitoreos/:id/visto: 404 si el monitoreo no existe', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const asesor = await asesorUser(admin, 'ORLANT', 'notfound');
  const res = await request(app).put('/api/monitoreos/999999999/visto').set(auth(asesor.token));
  assert.equal(res.status, 404);
});

test('Historial: marcar un monitoreo como visto queda registrado', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const asesor = await asesorUser(admin, 'ORLANT', 'historial');
  const { token: calToken } = await calidadUser(admin, 'ORLANT', 'historial');
  const m = await crearMonitoreo(calToken, 'ORLANT', asesor);

  await request(app).put('/api/monitoreos/' + m.id + '/visto').set(auth(asesor.token));
  const evento = db
    .prepare("SELECT * FROM historial WHERE accion = 'MONITOREO_VISTO' AND nombre = ?")
    .get(asesor.nombre);
  assert.ok(evento, 'debe quedar un evento MONITOREO_VISTO en el historial');
});
