const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const MES = new Date().toISOString().slice(0, 7);
const FECHA = `${MES}-15`;

// Crea un usuario CALIDAD con acceso a la campana indicada y devuelve su token + id.
async function calidadUser(adminToken, campana, sufijo) {
  const user = 'cal_' + sufijo + '_' + Math.random().toString(36).slice(2, 7);
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

const RESP_TODO_SI = Object.fromEntries(
  Array.from({ length: 17 }, (_, i) => [String(i + 1), 'SI'])
);

test('GET /api/calidad/plantillas devuelve las plantillas semilla', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).get('/api/calidad/plantillas').set(auth(t));
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 6);
  const orlant = res.body.find((p) => p.campana === 'ORLANT');
  assert.ok(orlant);
  assert.equal(orlant.items.length, 17);
  assert.equal(orlant.engine, 'standard');
});

test('usuarios semilla de Calidad y Gerencia pueden leer campanas permitidas', async () => {
  const calidad = await tokenFor('crodriguez', 'calidad123');
  const gerencia = await tokenFor('jherrera', 'ger123');

  assert.equal((await request(app).get('/api/monitoreos?campana=ORLANT').set(auth(calidad))).status, 200);
  assert.equal((await request(app).get('/api/monitoreos?campana=ORLANT').set(auth(gerencia))).status, 200);
});

test('POST /api/monitoreos calcula el puntaje en el servidor y es reproducible', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const { token } = await calidadUser(admin, 'ORLANT', 'score');

  const body = {
    campana: 'ORLANT',
    asesor: 'Asesor Uno',
    fecha: FECHA,
    canal: 'LLAMADA',
    answers: RESP_TODO_SI,
  };
  const r1 = await request(app).post('/api/monitoreos').set(auth(token)).send(body);
  assert.equal(r1.status, 201, JSON.stringify(r1.body));
  assert.equal(r1.body.puntaje, 100); // suma de todos los pesos ORLANT = 100
  assert.equal(r1.body.fallos, 0);
  assert.equal(r1.body.clasificacion, '🟢 SOBRESALIENTE');
  assert.equal(r1.body.mes, MES);
  assert.equal(r1.body.evaluadorUserId != null, true);

  const r2 = await request(app).post('/api/monitoreos').set(auth(token)).send(body);
  assert.equal(r2.body.puntaje, r1.body.puntaje);
  assert.equal(r2.body.nivelCritico, r1.body.nivelCritico);
});

test('POST /api/monitoreos: un fallo critico baja el puntaje segun la formula', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const { token } = await calidadUser(admin, 'ORLANT', 'crit');
  const answers = { ...RESP_TODO_SI, 3: 'NO' }; // item 3: critico, peso 7
  const res = await request(app)
    .post('/api/monitoreos')
    .set(auth(token))
    .send({ campana: 'ORLANT', asesor: 'Asesor Dos', fecha: FECHA, answers });
  assert.equal(res.status, 201);
  assert.equal(res.body.puntaje, 80); // 100 - 7 (no suma) + (7 - 20)
  assert.equal(res.body.fallos, 1);
});

test('el cliente NO puede inyectar el puntaje: se ignora y lo recalcula el servidor', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const { token } = await calidadUser(admin, 'ORLANT', 'inj');
  const res = await request(app)
    .post('/api/monitoreos')
    .set(auth(token))
    .send({
      campana: 'ORLANT',
      asesor: 'Asesor Tres',
      fecha: FECHA,
      answers: RESP_TODO_SI,
      puntaje: 5,
      clasificacion: 'FALSO',
    });
  assert.equal(res.status, 201);
  assert.equal(res.body.puntaje, 100);
});

test('acceso por campana: sin campana_ORLANT no puede ver ni escribir sus datos', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const { token } = await calidadUser(admin, null, 'noacc'); // CALIDAD sin ninguna campana

  const get = await request(app).get('/api/monitoreos?campana=ORLANT').set(auth(token));
  assert.equal(get.status, 403);

  const post = await request(app)
    .post('/api/monitoreos')
    .set(auth(token))
    .send({ campana: 'ORLANT', asesor: 'X', fecha: FECHA, answers: RESP_TODO_SI });
  assert.equal(post.status, 403);
});

test('aislamiento entre campanas: acceso a INFONDO no da acceso a ORLANT', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const { token } = await calidadUser(admin, 'INFONDO', 'infondo');
  const get = await request(app).get('/api/monitoreos?campana=ORLANT').set(auth(token));
  assert.equal(get.status, 403);
  const ok = await request(app).get('/api/monitoreos?campana=INFONDO').set(auth(token));
  assert.equal(ok.status, 200);
});

test('el rol CALIDAD que crea un monitoreo no puede editarlo ni borrarlo despues', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const { token } = await calidadUser(admin, 'ORLANT', 'noedit');
  const create = await request(app)
    .post('/api/monitoreos')
    .set(auth(token))
    .send({ campana: 'ORLANT', asesor: 'Asesor Cuatro', fecha: FECHA, answers: RESP_TODO_SI });
  assert.equal(create.status, 201);
  const id = create.body.id;

  const edit = await request(app)
    .put(`/api/monitoreos/${id}`)
    .set(auth(token))
    .send({ asesor: 'Otro' });
  assert.equal(edit.status, 403);

  const del = await request(app).delete(`/api/monitoreos/${id}`).set(auth(token));
  assert.equal(del.status, 403);

  // el admin si puede
  const adminEdit = await request(app)
    .put(`/api/monitoreos/${id}`)
    .set(auth(admin))
    .send({ asesor: 'Corregido' });
  assert.equal(adminEdit.status, 200);
  assert.equal(adminEdit.body.asesor, 'Corregido');
});

test('metas: solo el administrador puede crear/editar/borrar el cronograma', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const { token, id } = await calidadUser(admin, 'ORLANT', 'meta');

  const noAdmin = await request(app)
    .post('/api/metas')
    .set(auth(token))
    .send({ campana: 'ORLANT', mes: MES, liderId: id, metaGrupal: 10, asesores: 2, diasLaborales: 19 });
  assert.equal(noAdmin.status, 403);

  const ok = await request(app)
    .post('/api/metas')
    .set(auth(admin))
    .send({ campana: 'ORLANT', mes: MES, liderId: id, metaGrupal: 10, asesores: 2, diasLaborales: 19 });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.equal(ok.body.metaPorAsesor, 5); // 10 / 2
});

test('cumplimiento: el calculo en servidor refleja los monitoreos del lider', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const { token, id } = await calidadUser(admin, 'ORLANT', 'cumpl');

  await request(app)
    .post('/api/metas')
    .set(auth(admin))
    .send({ campana: 'ORLANT', mes: MES, liderId: id, metaGrupal: 10, asesores: 1, diasLaborales: 20 });

  for (let i = 0; i < 2; i++) {
    const res = await request(app)
      .post('/api/monitoreos')
      .set(auth(token))
      .send({ campana: 'ORLANT', asesor: 'Asesor Cumpl ' + i, fecha: FECHA, answers: RESP_TODO_SI });
    assert.equal(res.status, 201);
  }

  const cumpl = await request(app)
    .get(`/api/metas/cumplimiento?campana=ORLANT&mes=${MES}`)
    .set(auth(admin));
  assert.equal(cumpl.status, 200);
  const mio = cumpl.body.lideres.find((l) => l.liderId === id);
  assert.ok(mio, 'el lider deberia aparecer en cumplimiento');
  assert.equal(mio.realizados, 2);
  assert.equal(mio.meta, 10);
  assert.equal(mio.pct, 20);
});

test('permisos por campana con espacios en el nombre (CLINICA AURORA)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const { id, user } = await calidadUser(admin, null, 'aurora');
  // otorgar acceso a una campana cuyo nombre lleva espacio
  const grant = await request(app)
    .put(`/api/users/${id}/perms`)
    .set(auth(admin))
    .send({ perms: { Calidad: true, 'campana_CLINICA AURORA': true } });
  assert.equal(grant.status, 200, JSON.stringify(grant.body));

  const t2 = await tokenFor(user, 'ClaveCalidad123');
  const list = await request(app)
    .get('/api/monitoreos?' + new URLSearchParams({ campana: 'CLINICA AURORA' }))
    .set(auth(t2));
  assert.equal(list.status, 200);
});

test('validacion: fecha con formato invalido -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const { token } = await calidadUser(admin, 'ORLANT', 'val');
  const res = await request(app)
    .post('/api/monitoreos')
    .set(auth(token))
    .send({ campana: 'ORLANT', asesor: 'X', fecha: '15/07/2026', answers: RESP_TODO_SI });
  assert.equal(res.status, 400);
});

test('persistencia: un monitoreo creado sigue disponible al volver a consultarlo', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const { token } = await calidadUser(admin, 'ORLANT', 'persist');
  const create = await request(app)
    .post('/api/monitoreos')
    .set(auth(token))
    .send({ campana: 'ORLANT', asesor: 'Asesor Persistente', fecha: FECHA, answers: RESP_TODO_SI });
  assert.equal(create.status, 201);

  const list = await request(app).get('/api/monitoreos?campana=ORLANT').set(auth(token));
  assert.equal(list.status, 200);
  assert.ok(list.body.some((m) => m.id === create.body.id && m.asesor === 'Asesor Persistente'));
});
