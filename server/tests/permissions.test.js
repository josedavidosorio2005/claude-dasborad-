const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

function newUserPayload(over = {}) {
  return {
    nombre: 'Usuario Prueba',
    user: 'uprueba_' + Math.random().toString(36).slice(2, 8),
    password: 'ClaveSegura123',
    rol: 'CALIDAD',
    perms: { Calidad: true },
    ...over,
  };
}

test('AUX_ADMIN sin permisos: 403 al crear/editar/borrar/permisos', async () => {
  const t = await tokenFor('lrios', 'aux123');

  const create = await request(app).post('/api/users').set(auth(t)).send(newUserPayload());
  assert.equal(create.status, 403);

  const edit = await request(app).put('/api/users/2').set(auth(t)).send({ nombre: 'X' });
  assert.equal(edit.status, 403);

  const pass = await request(app).put('/api/users/2/password').set(auth(t)).send({ password: 'OtraClave123' });
  assert.equal(pass.status, 403);

  const active = await request(app).put('/api/users/2/active').set(auth(t));
  assert.equal(active.status, 403);

  const perms = await request(app).put('/api/users/2/perms').set(auth(t)).send({ perms: { Calidad: true } });
  assert.equal(perms.status, 403);

  const del = await request(app).delete('/api/users/2').set(auth(t));
  assert.equal(del.status, 403);
});

test('usuario de rol normal (CALIDAD): 403 en acciones de administracion', async () => {
  const t = await tokenFor('crodriguez', 'calidad123');
  const create = await request(app).post('/api/users').set(auth(t)).send(newUserPayload());
  assert.equal(create.status, 403);
});

test('admin maestro: puede crear, editar, cambiar password, suspender y borrar', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);

  const create = await request(app).post('/api/users').set(auth(t)).send(newUserPayload());
  assert.equal(create.status, 201);
  const id = create.body.id;

  const edit = await request(app).put(`/api/users/${id}`).set(auth(t)).send({ nombre: 'Nombre Editado' });
  assert.equal(edit.status, 200);
  assert.equal(edit.body.nombre, 'Nombre Editado');

  const pass = await request(app).put(`/api/users/${id}/password`).set(auth(t)).send({ password: 'NuevaClave456' });
  assert.equal(pass.status, 200);

  const active = await request(app).put(`/api/users/${id}/active`).set(auth(t));
  assert.equal(active.status, 200);
  assert.equal(active.body.active, false);

  const perms = await request(app).put(`/api/users/${id}/perms`).set(auth(t)).send({ perms: { Calidad: false, Inventario: true } });
  assert.equal(perms.status, 200);

  const del = await request(app).delete(`/api/users/${id}`).set(auth(t));
  assert.equal(del.status, 200);

  const gone = await request(app).get('/api/users').set(auth(t));
  assert.ok(!gone.body.some((u) => u.id === id));
});

test('ADMIN de la tabla (psuarez): puede crear usuarios', async () => {
  const t = await tokenFor('psuarez', 'admin456');
  const create = await request(app).post('/api/users').set(auth(t)).send(newUserPayload());
  assert.equal(create.status, 201);
});

test('AUX_ADMIN con permiso crearUsuarios puede crear pero no borrar', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);

  // crear un AUX_ADMIN con solo el permiso de crear
  const aux = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send(
      newUserPayload({
        user: 'auxparcial_' + Math.random().toString(36).slice(2, 7),
        rol: 'AUX_ADMIN',
        password: 'AuxParcial123',
        perms: {
          crearUsuarios: true,
          editarUsuarios: false,
          cambiarPassword: false,
          suspenderUsuarios: false,
          eliminarUsuarios: false,
          gestionPermisos: false,
        },
      })
    );
  assert.equal(aux.status, 201);
  const auxId = aux.body.id;

  const auxLoginPass = 'AuxParcial123';
  // fijar una contrasena conocida (el create ya la puso, pero por claridad)
  const t = await tokenFor(aux.body.user, auxLoginPass);

  const canCreate = await request(app).post('/api/users').set(auth(t)).send(newUserPayload());
  assert.equal(canCreate.status, 201);

  const cannotDelete = await request(app).delete(`/api/users/${canCreate.body.id}`).set(auth(t));
  assert.equal(cannotDelete.status, 403);

  // limpieza
  await request(app).delete(`/api/users/${auxId}`).set(auth(admin));
  await request(app).delete(`/api/users/${canCreate.body.id}`).set(auth(admin));
});
