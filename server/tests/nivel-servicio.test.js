// nivel-servicio.test.js — Modulo de Calidad: nivel de servicio (feedback de
// Edwin, punto 3.2). Formula acordada con el usuario: % de llamadas
// contestadas en <=20 segundos sobre el total, umbral de cumplimiento 80%.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');
const calc = require('../calidad-logic');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const MES = new Date().toISOString().slice(0, 7);

async function calidadUser(adminToken, campana, sufijo) {
  const user = 'ns_' + sufijo + '_' + Math.random().toString(36).slice(2, 7);
  const create = await request(app)
    .post('/api/users')
    .set(auth(adminToken))
    .send({
      nombre: 'Calidad ' + sufijo,
      user,
      password: 'ClaveCalidad123',
      rol: 'CALIDAD',
      perms: campana ? { Calidad: true, ['campana_' + campana]: true } : { Calidad: true },
    });
  assert.equal(create.status, 201, JSON.stringify(create.body));
  const token = await tokenFor(user, 'ClaveCalidad123');
  return { token, id: create.body.id, user };
}

// ── Calculo puro ─────────────────────────────────────────────
test('calidad-logic: nivelServicioPct y umbral de 80%', () => {
  assert.equal(calc.nivelServicioPct(850, 1000), 85);
  assert.equal(calc.nivelServicioPct(600, 1000), 60);
  assert.equal(calc.nivelServicioPct(0, 0), null); // sin llamadas: indefinido, no 0
  assert.equal(calc.nivelServicioCumple(85), true);
  assert.equal(calc.nivelServicioCumple(60), false);
  assert.equal(calc.nivelServicioCumple(80), true); // limite inclusive
  assert.equal(calc.nivelServicioCumple(null), null);
  assert.equal(calc.NIVEL_SERVICIO_UMBRAL, 80);
});

// ── CRUD y permisos ───────────────────────────────────────────
test('nivel de servicio: solo el administrador puede crear/editar/borrar', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const { token } = await calidadUser(admin, 'ORLANT', 'crud');

  const noAdmin = await request(app)
    .post('/api/calidad/nivel-servicio')
    .set(auth(token))
    .send({ campana: 'ORLANT', mes: MES, contestadas20s: 850, llamadasTotales: 1000 });
  assert.equal(noAdmin.status, 403);

  const created = await request(app)
    .post('/api/calidad/nivel-servicio')
    .set(auth(admin))
    .send({ campana: 'ORLANT', mes: MES, contestadas20s: 850, llamadasTotales: 1000 });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.pct, 85);
  assert.equal(created.body.cumple, true);
  assert.equal(created.body.umbral, 80);
  const id = created.body.id;

  const editNoAdmin = await request(app)
    .put(`/api/calidad/nivel-servicio/${id}`)
    .set(auth(token))
    .send({ contestadas20s: 600 });
  assert.equal(editNoAdmin.status, 403);

  const edited = await request(app)
    .put(`/api/calidad/nivel-servicio/${id}`)
    .set(auth(admin))
    .send({ contestadas20s: 600 });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.pct, 60);
  assert.equal(edited.body.cumple, false);

  const delNoAdmin = await request(app).delete(`/api/calidad/nivel-servicio/${id}`).set(auth(token));
  assert.equal(delNoAdmin.status, 403);

  const del = await request(app).delete(`/api/calidad/nivel-servicio/${id}`).set(auth(admin));
  assert.equal(del.status, 200);
});

test('nivel de servicio: POST hace upsert por (campana, mes)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const primero = await request(app)
    .post('/api/calidad/nivel-servicio')
    .set(auth(admin))
    .send({ campana: 'INFONDO', mes: MES, contestadas20s: 500, llamadasTotales: 1000 });
  assert.equal(primero.status, 201);

  const segundo = await request(app)
    .post('/api/calidad/nivel-servicio')
    .set(auth(admin))
    .send({ campana: 'INFONDO', mes: MES, contestadas20s: 900, llamadasTotales: 1000 });
  assert.equal(segundo.status, 200); // update, no create
  assert.equal(segundo.body.id, primero.body.id);
  assert.equal(segundo.body.pct, 90);

  const list = await request(app).get(`/api/calidad/nivel-servicio?campana=INFONDO`).set(auth(admin));
  assert.equal(list.status, 200);
  assert.equal(list.body.filter((r) => r.mes === MES).length, 1);
});

test('nivel de servicio: PUT hacia una (campana, mes) ya existente -> 409, no 500', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const uno = await request(app)
    .post('/api/calidad/nivel-servicio')
    .set(auth(admin))
    .send({ campana: 'ORLANT', mes: MES, contestadas20s: 700, llamadasTotales: 1000 });
  assert.equal(uno.status, 201);

  const otroMes = MES === '2026-01' ? '2026-02' : '2026-01';
  const dos = await request(app)
    .post('/api/calidad/nivel-servicio')
    .set(auth(admin))
    .send({ campana: 'ORLANT', mes: otroMes, contestadas20s: 700, llamadasTotales: 1000 });
  assert.equal(dos.status, 201);

  // Mover el segundo registro para que choque con el (campana, mes) del primero.
  const conflicto = await request(app)
    .put(`/api/calidad/nivel-servicio/${dos.body.id}`)
    .set(auth(admin))
    .send({ mes: MES });
  assert.equal(conflicto.status, 409, JSON.stringify(conflicto.body));

  // El registro original no debe haber quedado alterado por el intento fallido.
  const sigue = await request(app)
    .get(`/api/calidad/nivel-servicio?campana=ORLANT`)
    .set(auth(admin));
  assert.equal(sigue.body.find((r) => r.id === dos.body.id).mes, otroMes);
});

test('nivel de servicio: acceso por campana en GET', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  await request(app)
    .post('/api/calidad/nivel-servicio')
    .set(auth(admin))
    .send({ campana: 'ORLANT', mes: MES, contestadas20s: 700, llamadasTotales: 1000 });
  const { token } = await calidadUser(admin, null, 'noacc'); // sin campana_ORLANT

  const forbidden = await request(app)
    .get('/api/calidad/nivel-servicio?campana=ORLANT')
    .set(auth(token));
  assert.equal(forbidden.status, 403);

  const noCampana = await request(app).get('/api/calidad/nivel-servicio').set(auth(token));
  assert.equal(noCampana.status, 403); // no es admin, no puede listar todo

  const adminList = await request(app).get('/api/calidad/nivel-servicio').set(auth(admin));
  assert.equal(adminList.status, 200);
});

// ── Validacion ─────────────────────────────────────────────
test('nivel de servicio: validacion — contestadas no puede superar el total', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app)
    .post('/api/calidad/nivel-servicio')
    .set(auth(admin))
    .send({ campana: 'ORLANT', mes: MES, contestadas20s: 1200, llamadasTotales: 1000 });
  assert.equal(res.status, 400);
});

test('nivel de servicio: validacion — mes con formato invalido -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app)
    .post('/api/calidad/nivel-servicio')
    .set(auth(admin))
    .send({ campana: 'ORLANT', mes: '2026/09', contestadas20s: 100, llamadasTotales: 200 });
  assert.equal(res.status, 400);
});
