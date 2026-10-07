const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');
const { schemas } = require('../validation');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const base = { nombre: 'Valido', user: 'validouser', password: 'ClaveSegura123', rol: 'CALIDAD', perms: {} };

test('user con espacios -> 400', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/users').set(auth(t)).send({ ...base, user: 'con espacio' });
  assert.equal(res.status, 400);
});

test('user con caracteres raros -> 400', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/users').set(auth(t)).send({ ...base, user: 'ju@n!' });
  assert.equal(res.status, 400);
});

test('rol fuera de la lista -> 400', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/users').set(auth(t)).send({ ...base, user: 'roluser', rol: 'SUPERJEFE' });
  assert.equal(res.status, 400);
});

test('password corta (< 8) -> 400 al crear', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/users').set(auth(t)).send({ ...base, user: 'shortpw', password: 'abc12' });
  assert.equal(res.status, 400);
});

test('password corta -> 400 al cambiar contrasena', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const list = await request(app).get('/api/users').set(auth(t));
  const id = list.body[0].id;
  const res = await request(app).put(`/api/users/${id}/password`).set(auth(t)).send({ password: '1234' });
  assert.equal(res.status, 400);
});

test('perms con valor no booleano -> 400', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/users').set(auth(t)).send({ ...base, user: 'permsbad', perms: { Calidad: 'si' } });
  assert.equal(res.status, 400);
});

test('id no numerico -> 400', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).put('/api/users/abc').set(auth(t)).send({ nombre: 'X' });
  assert.equal(res.status, 400);
});

test('JSON malformado -> 400', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app)
    .post('/api/users')
    .set(auth(t))
    .set('Content-Type', 'application/json')
    .send('{ esto no es json');
  assert.equal(res.status, 400);
});

test('payload valido -> 201', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app)
    .post('/api/users')
    .set(auth(t))
    .send({ ...base, user: 'okuser_' + Date.now() });
  assert.equal(res.status, 201);
  await request(app).delete(`/api/users/${res.body.id}`).set(auth(t));
});

// Fase 130 (hallazgo real): el archivo real de Calidad de Edwin trae notas de
// evaluador en prosa -- 4 de 95 filas reales superaron el limite viejo de 200
// caracteres (maximo real encontrado: 235). Se subio el limite a 500 (mismo
// ya usado para "observaciones" en Inventario) en createMonitoreoBody y
// updateMonitoreoBody -- el resto de campos de texto corto de Calidad
// (idLlamada/telefono/codificacion/evaluador) se quedan en 200, el archivo
// real nunca se acerco a ese limite en esos campos.
const monitoreoBase = {
  campana: 'CARTERA INTERNA',
  asesor: 'Asesor de prueba',
  fecha: '2026-09-15',
  answers: { 1: 'SI' },
};

test('createMonitoreoBody: observaciones de 235 caracteres (el maximo real del archivo de Edwin) SI pasa', () => {
  const r = schemas.createMonitoreoBody.safeParse({ ...monitoreoBase, observaciones: 'x'.repeat(235) });
  assert.equal(r.success, true);
});

test('createMonitoreoBody: observaciones de 500 caracteres SI pasa (limite exacto)', () => {
  const r = schemas.createMonitoreoBody.safeParse({ ...monitoreoBase, observaciones: 'x'.repeat(500) });
  assert.equal(r.success, true);
});

test('createMonitoreoBody: observaciones de 501 caracteres NO pasa', () => {
  const r = schemas.createMonitoreoBody.safeParse({ ...monitoreoBase, observaciones: 'x'.repeat(501) });
  assert.equal(r.success, false);
});

test('updateMonitoreoBody: observaciones de 235 caracteres SI pasa', () => {
  const r = schemas.updateMonitoreoBody.safeParse({ observaciones: 'x'.repeat(235) });
  assert.equal(r.success, true);
});

test('updateMonitoreoBody: observaciones de 501 caracteres NO pasa', () => {
  const r = schemas.updateMonitoreoBody.safeParse({ observaciones: 'x'.repeat(501) });
  assert.equal(r.success, false);
});

test('monitoreoBulkBody: una fila con observaciones de 235 caracteres SI pasa (el caso real)', () => {
  const r = schemas.monitoreoBulkBody.safeParse({
    campana: 'CARTERA INTERNA',
    filas: [{ ...monitoreoBase, campana: undefined, observaciones: 'x'.repeat(235) }],
  });
  assert.equal(r.success, true);
});

test('otros campos de texto corto de Calidad (idLlamada/telefono/codificacion) se quedan en 200', () => {
  assert.equal(schemas.createMonitoreoBody.safeParse({ ...monitoreoBase, idLlamada: 'x'.repeat(201) }).success, false);
  assert.equal(schemas.createMonitoreoBody.safeParse({ ...monitoreoBase, telefono: 'x'.repeat(201) }).success, false);
  assert.equal(schemas.createMonitoreoBody.safeParse({ ...monitoreoBase, codificacion: 'x'.repeat(201) }).success, false);
});
