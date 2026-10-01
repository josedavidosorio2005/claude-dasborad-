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

test('GET /api/users: rol no privilegiado recibe la lista sin la matriz de permisos', async () => {
  // lrios = AUX_ADMIN sin permisos de gestion de usuarios/permisos.
  const t = await tokenFor('lrios', 'aux123');
  const res = await request(app).get('/api/users').set(auth(t));
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body) && res.body.length > 0);
  // Campos de los selects (asesor / lider) siguen presentes...
  for (const u of res.body) {
    assert.ok(typeof u.id === 'number');
    assert.ok(typeof u.nombre === 'string');
    assert.ok(typeof u.rol === 'string');
    // ...pero `perms` viene vacio para quien no administra usuarios/permisos.
    assert.deepEqual(u.perms, {});
    assert.equal(u.password_hash, undefined);
    assert.equal(u.password, undefined);
  }
});

test('GET /api/users: el admin si recibe la matriz de permisos', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).get('/api/users').set(auth(t));
  assert.equal(res.status, 200);
  // Al menos un usuario semilla tiene permisos poblados (crodriguez -> Calidad).
  assert.ok(res.body.some((u) => u.perms && Object.keys(u.perms).length > 0));
});

// Fase 102 (escalada de privilegios, hallazgo real): un AUX_ADMIN con SOLO el
// permiso puntual `crearUsuarios`/`editarUsuarios` (nunca ADMIN completo) no
// debe poder crear ni convertir a nadie -- ni a si mismo -- en rol ADMIN o
// AUX_ADMIN. Antes de este fix, el servidor solo exigia el permiso puntual y
// aceptaba CUALQUIER valor de `rol` del enum (incluido ADMIN), sin ningun
// chequeo adicional -- el mismo limite que ya existia SOLO en el frontend
// (dashRolesVisibles, "un Auxiliar Admin no puede tocar ADMIN/AUX_ADMIN").
test('AUX_ADMIN con crearUsuarios NO puede crear un usuario con rol ADMIN ni AUX_ADMIN', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const aux = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send(
      newUserPayload({
        user: 'auxcreador_' + Math.random().toString(36).slice(2, 7),
        rol: 'AUX_ADMIN',
        password: 'AuxCreador123',
        perms: { crearUsuarios: true, editarUsuarios: true },
      })
    );
  assert.equal(aux.status, 201);
  const t = await tokenFor(aux.body.user, 'AuxCreador123');

  const intentoAdmin = await request(app).post('/api/users').set(auth(t)).send(newUserPayload({ rol: 'ADMIN', user: 'backdoor_' + Math.random().toString(36).slice(2, 7) }));
  assert.equal(intentoAdmin.status, 403);

  const intentoAux = await request(app).post('/api/users').set(auth(t)).send(newUserPayload({ rol: 'AUX_ADMIN', user: 'backdoor2_' + Math.random().toString(36).slice(2, 7) }));
  assert.equal(intentoAux.status, 403);

  // Tampoco por PUT, ni a otro usuario ni a si mismo.
  const otro = await request(app).post('/api/users').set(auth(admin)).send(newUserPayload({ user: 'victima_' + Math.random().toString(36).slice(2, 7) }));
  const escaladaOtro = await request(app).put(`/api/users/${otro.body.id}`).set(auth(t)).send({ rol: 'ADMIN' });
  assert.equal(escaladaOtro.status, 403);

  const autoEscalada = await request(app).put(`/api/users/${aux.body.id}`).set(auth(t)).send({ rol: 'ADMIN' });
  assert.equal(autoEscalada.status, 403);

  await request(app).delete(`/api/users/${otro.body.id}`).set(auth(admin));
  await request(app).delete(`/api/users/${aux.body.id}`).set(auth(admin));
});

// Nadie cambia su propio rol via PUT /users/:id -- ni siquiera un ADMIN
// completo (evita un auto-bloqueo o un cambio sin revision de otra persona).
test('nadie puede cambiar su propio rol, ni siendo ADMIN', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const otroAdmin = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send(newUserPayload({ user: 'admin2_' + Math.random().toString(36).slice(2, 7), rol: 'ADMIN', password: 'OtroAdmin123' }));
  assert.equal(otroAdmin.status, 201);
  const t = await tokenFor(otroAdmin.body.user, 'OtroAdmin123');

  const autoRol = await request(app).put(`/api/users/${otroAdmin.body.id}`).set(auth(t)).send({ rol: 'CALIDAD' });
  assert.equal(autoRol.status, 403);

  // Pero SI puede editar otros campos de si mismo (nombre), y editar el rol de OTRO usuario.
  const autoNombre = await request(app).put(`/api/users/${otroAdmin.body.id}`).set(auth(t)).send({ nombre: 'Nombre Propio Editado' });
  assert.equal(autoNombre.status, 200);

  const otro = await request(app).post('/api/users').set(auth(admin)).send(newUserPayload({ user: 'terceroparaadmin_' + Math.random().toString(36).slice(2, 7) }));
  const editaOtro = await request(app).put(`/api/users/${otro.body.id}`).set(auth(t)).send({ rol: 'SUPERVISOR' });
  assert.equal(editaOtro.status, 200);

  await request(app).delete(`/api/users/${otro.body.id}`).set(auth(admin));
  await request(app).delete(`/api/users/${otroAdmin.body.id}`).set(auth(admin));
});

// Fase 102 (escalada de privilegios, hallazgo real): PUT /users/:id/password
// solo exigia el permiso puntual `cambiarPassword` (asignable a CUALQUIER rol,
// igual que crearUsuarios/editarUsuarios), sin el mismo limite de
// `puedeAsignarRol` que ya protege crear/editar. Un AUX_ADMIN con SOLO ese
// permiso podia resetear la contrasena de un ADMIN o AUX_ADMIN ya existente e
// iniciar sesion como esa cuenta -- el mismo vector de escalada que el PUT de
// rol, pero por la puerta de la contrasena.
test('AUX_ADMIN con cambiarPassword NO puede resetear la contrasena de un ADMIN/AUX_ADMIN existente', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);

  const victimaAdmin = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send(newUserPayload({ user: 'victimaadmin_' + Math.random().toString(36).slice(2, 7), rol: 'ADMIN', password: 'ClaveOriginal123' }));
  assert.equal(victimaAdmin.status, 201);

  const auxResetter = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send(
      newUserPayload({
        user: 'auxresetter_' + Math.random().toString(36).slice(2, 7),
        rol: 'AUX_ADMIN',
        password: 'AuxResetter123',
        perms: { cambiarPassword: true },
      })
    );
  assert.equal(auxResetter.status, 201);
  const t = await tokenFor(auxResetter.body.user, 'AuxResetter123');

  const intento = await request(app).put(`/api/users/${victimaAdmin.body.id}/password`).set(auth(t)).send({ password: 'PasswordRobada123' });
  assert.equal(intento.status, 403);

  // La contrasena original sigue sirviendo -- no se toco.
  const siguenFuncionando = await tokenFor(victimaAdmin.body.user, 'ClaveOriginal123');
  assert.ok(siguenFuncionando);

  // El mismo AUX_ADMIN SI puede cambiar la password de un usuario normal.
  const victimaNormal = await request(app).post('/api/users').set(auth(admin)).send(newUserPayload({ user: 'victimanormal_' + Math.random().toString(36).slice(2, 7) }));
  const okNormal = await request(app).put(`/api/users/${victimaNormal.body.id}/password`).set(auth(t)).send({ password: 'NuevaClaveNormal123' });
  assert.equal(okNormal.status, 200);

  await request(app).delete(`/api/users/${victimaNormal.body.id}`).set(auth(admin));
  await request(app).delete(`/api/users/${auxResetter.body.id}`).set(auth(admin));
  await request(app).delete(`/api/users/${victimaAdmin.body.id}`).set(auth(admin));
});
