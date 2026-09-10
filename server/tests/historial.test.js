// historial.test.js — El historial (append-only) registra las acciones sobre
// usuarios con el actor correcto y con las cadenas de accion EXACTAS que espera
// el filtro del frontend (public/index.html #hist-filter / public/js/historial.js).
//
// Contexto: Edwin reportó "el historial no registra la creación de usuarios".
// El backend sí la registra (esto lo prueba este archivo); el bug real estaba en
// el frontend, que no re-cargaba el historial al abrir la pestaña y tenía el
// filtro "Cambios de permisos" con value="PERMISO" cuando el backend escribe
// "PERMISOS". Ambos corregidos en esta rama.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

function newUser(over = {}) {
  return {
    nombre: 'Historial Target',
    user: 'hist_' + Math.random().toString(36).slice(2, 8),
    password: 'ClaveSegura123',
    rol: 'CALIDAD',
    perms: {},
    ...over,
  };
}

async function hist(t) {
  const res = await request(app).get('/api/historial').set(auth(t));
  assert.equal(res.status, 200);
  return res.body;
}

test('crear un usuario deja una fila CREADO en el historial con el actor real', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);

  const before = await hist(admin);
  const payload = newUser();
  const created = await request(app).post('/api/users').set(auth(admin)).send(payload);
  assert.equal(created.status, 201);

  const after = await hist(admin);
  assert.equal(after.length, before.length + 1, 'debe haberse añadido exactamente una fila');

  const row = after.find((h) => h.accion === 'CREADO' && h.username === payload.user);
  assert.ok(row, 'falta la fila CREADO para el usuario recién creado');
  assert.equal(row.nombre, payload.nombre);
  assert.equal(row.rol, 'CALIDAD');
  assert.match(row.actor, /@admin\)$/, 'el actor debe ser el admin maestro');
  assert.match(row.detalle, /CALIDAD/);
});

test('las acciones sobre usuarios usan las cadenas exactas del filtro del frontend', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const created = await request(app).post('/api/users').set(auth(admin)).send(newUser());
  const id = created.body.id;

  await request(app).put(`/api/users/${id}`).set(auth(admin)).send({ nombre: 'Editado' });
  await request(app).put(`/api/users/${id}/perms`).set(auth(admin)).send({ perms: { Calidad: true } });
  await request(app).put(`/api/users/${id}/password`).set(auth(admin)).send({ password: 'OtraClave123' });
  await request(app).put(`/api/users/${id}/active`).set(auth(admin)); // suspender
  await request(app).put(`/api/users/${id}/active`).set(auth(admin)); // reactivar
  await request(app).delete(`/api/users/${id}`).set(auth(admin));

  const rows = await hist(admin);
  const accionesDe = (u) => rows.filter((h) => h.username === u).map((h) => h.accion);
  const acciones = new Set(accionesDe(created.body.user));

  // Estas son las cadenas que el <select id="hist-filter"> debe ofrecer como value.
  for (const esperado of ['CREADO', 'EDITADO', 'PERMISOS', 'PASSWORD', 'SUSPENDIDO', 'ACTIVADO', 'ELIMINADO']) {
    assert.ok(acciones.has(esperado), `falta el evento ${esperado} en el historial (tiene: ${[...acciones].join(', ')})`);
  }
  // Regresión del bug del filtro: el backend NO escribe "PERMISO" en singular.
  assert.ok(!acciones.has('PERMISO'), 'el backend no debe escribir "PERMISO" (el filtro usa "PERMISOS")');
});

test('GET /api/historial exige autenticación', async () => {
  const res = await request(app).get('/api/historial');
  assert.equal(res.status, 401);
});
