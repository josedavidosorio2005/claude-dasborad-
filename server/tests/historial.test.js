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
const { request, app, tokenFor, MASTER_PASSWORD, SEED } = require('./helpers');

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

test('GET /api/historial: solo admin (maestro o rol ADMIN) lo ve; el resto recibe 403', async () => {
  // Regresión: antes esta ruta solo exigía un JWT válido (requireAuth), sin
  // ningún chequeo de rol/permiso, así que cualquier autenticado -incluido un
  // CALIDAD o un AUX_ADMIN sin permisos de administración- podía leer el log
  // de auditoría completo. Debe quedar igual de restringida que la pestaña
  // del frontend (session.js: solo isMaster || rol==='ADMIN').
  const master = await tokenFor('admin', MASTER_PASSWORD);
  await hist(master); // el admin maestro sigue viéndolo sin cambios (200)

  const adminRol = await tokenFor('psuarez', SEED.psuarez);
  await hist(adminRol); // un usuario con rol ADMIN (no maestro) también lo ve

  const calidad = await tokenFor('crodriguez', SEED.crodriguez);
  const resCalidad = await request(app).get('/api/historial').set(auth(calidad));
  assert.equal(resCalidad.status, 403, 'CALIDAD no debe poder leer el historial');

  const auxAdmin = await tokenFor('lrios', SEED.lrios);
  const resAux = await request(app).get('/api/historial').set(auth(auxAdmin));
  assert.equal(resAux.status, 403, 'AUX_ADMIN sin permisos de administración no debe poder leer el historial');
});
