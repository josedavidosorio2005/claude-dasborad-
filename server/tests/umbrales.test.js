// umbrales.test.js — cubre GET/POST/PUT/DELETE /api/umbrales (umbrales de
// semaforo, configurables desde el panel sin desplegar). Confirma tanto los
// defaults sembrados como que un cambio de un admin se lee de inmediato por
// cualquier actor autenticado (el mismo request-response cycle demuestra que
// no hace falta redeploy: no hay cache, no hay build, solo una fila en SQLite).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD, SEED } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

test('GET /api/umbrales: trae los 5 umbrales globales sembrados por defecto', async () => {
  const t = await tokenFor('crodriguez', SEED.crodriguez); // no-admin: la lectura es abierta
  const res = await request(app).get('/api/umbrales').set(auth(t));
  assert.equal(res.status, 200);
  const metricas = res.body.map((u) => u.metrica).sort();
  assert.deepEqual(metricas, ['cumplimiento_meta', 'nivel_atencion', 'qa_promedio', 'service_level', 'tasa_abandono']);
  const nivelAtencion = res.body.find((u) => u.metrica === 'nivel_atencion');
  assert.equal(nivelAtencion.campana, '');
  assert.equal(nivelAtencion.verde, 90);
  assert.equal(nivelAtencion.amarillo, 70);
  assert.equal(nivelAtencion.direccion, 'mayor_es_mejor');
});

test('POST /api/umbrales: un no-admin no puede crear/editar umbrales', async () => {
  const t = await tokenFor('crodriguez', SEED.crodriguez);
  const res = await request(app)
    .post('/api/umbrales')
    .set(auth(t))
    .send({ metrica: 'nivel_atencion', campana: 'ORLANT', verde: 95, amarillo: 80, direccion: 'mayor_es_mejor' });
  assert.equal(res.status, 403);
});

test('POST /api/umbrales: el admin crea un override por campana sin tocar el default global', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app)
    .post('/api/umbrales')
    .set(auth(admin))
    .send({ metrica: 'nivel_atencion', campana: 'HOSPITAL LA MARIA', verde: 80, amarillo: 60, direccion: 'mayor_es_mejor' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.campana, 'HOSPITAL LA MARIA');

  // Se lee de inmediato, sin ningun paso intermedio -> "sin desplegar".
  const listado = await request(app).get('/api/umbrales').set(auth(admin));
  const global_ = listado.body.find((u) => u.metrica === 'nivel_atencion' && u.campana === '');
  const override = listado.body.find((u) => u.metrica === 'nivel_atencion' && u.campana === 'HOSPITAL LA MARIA');
  assert.equal(global_.verde, 90); // el default global no se toco
  assert.equal(override.verde, 80); // el override si quedo
});

test('POST /api/umbrales: upsert — volver a mandar la misma (metrica,campana) actualiza, no duplica', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  await request(app)
    .post('/api/umbrales')
    .set(auth(admin))
    .send({ metrica: 'service_level', campana: 'ORLANT', verde: 85, amarillo: 70, direccion: 'mayor_es_mejor' });
  const r2 = await request(app)
    .post('/api/umbrales')
    .set(auth(admin))
    .send({ metrica: 'service_level', campana: 'ORLANT', verde: 88, amarillo: 72, direccion: 'mayor_es_mejor' });
  assert.equal(r2.status, 200); // 200 = actualizo una fila existente, no 201 de creacion

  const listado = await request(app).get('/api/umbrales').set(auth(admin));
  const filas = listado.body.filter((u) => u.metrica === 'service_level' && u.campana === 'ORLANT');
  assert.equal(filas.length, 1);
  assert.equal(filas[0].verde, 88);
});

test('PUT /api/umbrales/:id — el admin edita un umbral existente y el cambio se lee de inmediato', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const before = (await request(app).get('/api/umbrales').set(auth(admin))).body.find(
    (u) => u.metrica === 'tasa_abandono' && u.campana === ''
  );
  const put = await request(app)
    .put('/api/umbrales/' + before.id)
    .set(auth(admin))
    .send({ verde: 4, amarillo: 8 });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  assert.equal(put.body.verde, 4);
  assert.equal(put.body.amarillo, 8);
  assert.equal(put.body.direccion, 'menor_es_mejor'); // lo que no se manda no cambia

  const after = (await request(app).get('/api/umbrales').set(auth(admin))).body.find((u) => u.id === before.id);
  assert.equal(after.verde, 4);
});

test('DELETE /api/umbrales/:id — solo admin, y desaparece de la lectura', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const created = await request(app)
    .post('/api/umbrales')
    .set(auth(admin))
    .send({ metrica: 'metrica_temporal_test', campana: '', verde: 1, amarillo: 0, direccion: 'mayor_es_mejor' });
  assert.equal(created.status, 201);

  const noAdmin = await tokenFor('crodriguez', SEED.crodriguez);
  const bloqueado = await request(app).delete('/api/umbrales/' + created.body.id).set(auth(noAdmin));
  assert.equal(bloqueado.status, 403);

  const del = await request(app).delete('/api/umbrales/' + created.body.id).set(auth(admin));
  assert.equal(del.status, 200);
  const listado = await request(app).get('/api/umbrales').set(auth(admin));
  assert.equal(listado.body.some((u) => u.id === created.body.id), false);
});

test('POST /api/umbrales: direccion invalida se rechaza (no mayor_es_mejor/menor_es_mejor)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app)
    .post('/api/umbrales')
    .set(auth(admin))
    .send({ metrica: 'x', verde: 1, amarillo: 0, direccion: 'de-lado' });
  assert.equal(res.status, 400);
});
