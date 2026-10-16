// fase151-permisos-usuarios.test.js — Fase 151: limites de la gestion de
// usuarios (permisos de gestion solo los otorga el admin; nadie toca una
// cuenta ADMIN/AUX_ADMIN sin ser admin; nadie se suspende o borra a si
// mismo), lista de usuarios acotada para quien no administra usuarios,
// cierre de sesion que corta el token usado y cambio obligatorio de una
// contrasena asignada por el administrador. Cada bloqueo nuevo va con su
// contraparte de "sigue pudiendo" (nadie pierde acceso legitimo).
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const PW = 'Clave#Fase151x';
let admin;
const tok = {};
const ids = {};

async function crear(user, rol, perms, extra = {}) {
  const r = await request(app).post('/api/users').set(auth(admin)).send({ nombre: 'Persona ' + user, user, password: PW, rol, perms, ...extra });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  ids[user] = r.body.id;
  return r.body;
}

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  await crear('f151aux', 'AUX_ADMIN', { crearUsuarios: true, editarUsuarios: true, cambiarPassword: true, suspenderUsuarios: true, eliminarUsuarios: true, gestionPermisos: true });
  await crear('f151cal', 'CALIDAD', { Calidad: true, campana_ORLANT: true });
  await crear('f151sup', 'SUPERVISOR', { Calidad: true, campana_ORLANT: true });
  await crear('f151cli', 'CLIENTES_DASH', { ClientesDash: true, cliente_ORLANT: true });
  await crear('f151ase', 'ASESOR', {}, { asesorCampana: 'ORLANT' });
  await crear('f151aseM', 'ASESOR', {}, { asesorCampana: 'MOBILIZE' });
  for (const u of ['f151aux', 'f151cal', 'f151sup', 'f151cli', 'f151ase']) tok[u] = await tokenFor(u, PW);
  ids.psuarez = db.prepare("SELECT id FROM users WHERE user = 'psuarez'").get().id;
});

// ── H-03: permisos de gestion y cuentas de administracion ──

test('AUX_ADMIN no puede crear un usuario con permisos de gestion de usuarios', async () => {
  for (const k of ['crearUsuarios', 'editarUsuarios', 'cambiarPassword', 'suspenderUsuarios', 'eliminarUsuarios', 'gestionPermisos', 'isAdmin']) {
    const r = await request(app).post('/api/users').set(auth(tok.f151aux)).send({ nombre: 'X', user: 'f151x' + k.toLowerCase().slice(0, 8), password: PW, rol: 'SUPERVISOR', perms: { [k]: true } });
    assert.equal(r.status, 403, k);
  }
});

test('AUX_ADMIN sigue creando usuarios con permisos de modulo, campana y cliente', async () => {
  const r = await request(app).post('/api/users').set(auth(tok.f151aux)).send({
    nombre: 'Nuevo', user: 'f151nuevo', password: PW, rol: 'SUPERVISOR',
    perms: { Calidad: true, campana_ORLANT: true, campana_MOBILIZE: true, cliente_ORLANT: true, cargarDatos: true, crearUsuarios: false },
  });
  assert.equal(r.status, 201);
  ids.f151nuevo = r.body.id;
});

test('quien tiene gestionPermisos no puede otorgar ni quitar permisos de gestion (PUT /perms y PUT /users/:id)', async () => {
  const r1 = await request(app).put(`/api/users/${ids.f151cal}/perms`).set(auth(tok.f151aux)).send({ perms: { Calidad: true, campana_ORLANT: true, gestionPermisos: true } });
  assert.equal(r1.status, 403);
  const r2 = await request(app).put(`/api/users/${ids.f151cal}`).set(auth(tok.f151aux)).send({ perms: { Calidad: true, campana_ORLANT: true, eliminarUsuarios: true } });
  assert.equal(r2.status, 403);
  // Pero sigue cambiando permisos de modulo/campana
  const r3 = await request(app).put(`/api/users/${ids.f151cal}/perms`).set(auth(tok.f151aux)).send({ perms: { Calidad: true, campana_ORLANT: true, campana_MOBILIZE: true } });
  assert.equal(r3.status, 200);
  const r4 = await request(app).put(`/api/users/${ids.f151cal}`).set(auth(tok.f151aux)).send({ perms: { Calidad: true, campana_ORLANT: true } });
  assert.equal(r4.status, 200);
});

test('el admin sigue otorgando permisos de gestion', async () => {
  const r = await request(app).put(`/api/users/${ids.f151nuevo}/perms`).set(auth(admin)).send({ perms: { crearUsuarios: true } });
  assert.equal(r.status, 200);
  // y un AUX puede editar a esa persona sin tocar ese permiso (queda igual)
  const r2 = await request(app).put(`/api/users/${ids.f151nuevo}`).set(auth(tok.f151aux)).send({ perms: { crearUsuarios: true, Calidad: true } });
  assert.equal(r2.status, 200);
});

test('un no-admin no puede suspender, eliminar ni cambiar permisos de una cuenta ADMIN', async () => {
  assert.equal((await request(app).put(`/api/users/${ids.psuarez}/active`).set(auth(tok.f151aux))).status, 403);
  assert.equal((await request(app).delete(`/api/users/${ids.psuarez}`).set(auth(tok.f151aux))).status, 403);
  assert.equal((await request(app).put(`/api/users/${ids.psuarez}/perms`).set(auth(tok.f151aux)).send({ perms: { Calidad: true } })).status, 403);
  const row = db.prepare('SELECT active FROM users WHERE id = ?').get(ids.psuarez);
  assert.equal(row.active, 1);
});

test('nadie se suspende ni se elimina a si mismo', async () => {
  assert.equal((await request(app).put(`/api/users/${ids.f151aux}/active`).set(auth(tok.f151aux))).status, 403);
  assert.equal((await request(app).delete(`/api/users/${ids.f151aux}`).set(auth(tok.f151aux))).status, 403);
});

test('AUX_ADMIN sigue suspendiendo, activando y eliminando usuarios comunes', async () => {
  const s = await request(app).put(`/api/users/${ids.f151nuevo}/active`).set(auth(tok.f151aux));
  assert.equal(s.status, 200);
  assert.equal(s.body.active, false);
  assert.equal((await request(app).put(`/api/users/${ids.f151nuevo}/active`).set(auth(tok.f151aux))).body.active, true);
  assert.equal((await request(app).delete(`/api/users/${ids.f151nuevo}`).set(auth(tok.f151aux))).status, 200);
});

test('el admin sigue suspendiendo y reactivando una cuenta ADMIN', async () => {
  assert.equal((await request(app).put(`/api/users/${ids.psuarez}/active`).set(auth(admin))).body.active, false);
  assert.equal((await request(app).put(`/api/users/${ids.psuarez}/active`).set(auth(admin))).body.active, true);
});

// ── H-05: lista de usuarios ──

test('cliente (CLIENTES_DASH): GET /users devuelve solo su propia fila', async () => {
  const r = await request(app).get('/api/users').set(auth(tok.f151cli));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.map((u) => u.id), [ids.f151cli]);
});

test('CALIDAD y SUPERVISOR: ven su fila y los asesores de SUS campanas (lo que usa el formulario de monitoreo), sin usuario ni fecha de los demas', async () => {
  for (const u of ['f151cal', 'f151sup']) {
    const r = await request(app).get('/api/users').set(auth(tok[u]));
    assert.equal(r.status, 200);
    const idsVistos = r.body.map((x) => x.id);
    assert.ok(idsVistos.includes(ids[u]), u + ' se ve a si mismo');
    assert.ok(idsVistos.includes(ids.f151ase), u + ' ve al asesor de ORLANT');
    assert.ok(!idsVistos.includes(ids.f151aseM), u + ' NO ve al asesor de MOBILIZE');
    assert.ok(!idsVistos.includes(ids.psuarez), u + ' NO ve administradores');
    const asesor = r.body.find((x) => x.id === ids.f151ase);
    assert.deepEqual(Object.keys(asesor).sort(), ['active', 'asesorCampana', 'id', 'nombre', 'perms', 'rol']);
    assert.equal(asesor.rol, 'ASESOR');
    assert.equal(asesor.asesorCampana, 'ORLANT');
  }
});

test('ADMIN y AUX_ADMIN (gestion de usuarios) siguen viendo la lista completa', async () => {
  for (const t of [admin, tok.f151aux]) {
    const r = await request(app).get('/api/users').set(auth(t));
    assert.equal(r.status, 200);
    const idsVistos = r.body.map((x) => x.id);
    assert.ok(idsVistos.includes(ids.psuarez) && idsVistos.includes(ids.f151aseM) && idsVistos.includes(ids.f151cli));
    assert.ok(r.body.every((x) => typeof x.user === 'string'));
  }
});

// ── L-01: cierre de sesion ──

test('cerrar sesion corta ese token; otra sesion del mismo usuario sigue abierta', async () => {
  const t1 = await tokenFor('f151sup', PW);
  const t2 = await tokenFor('f151sup', PW);
  assert.equal((await request(app).post('/api/auth/logout').set(auth(t1))).status, 200);
  assert.equal((await request(app).get('/api/users').set(auth(t1))).status, 401);
  assert.equal((await request(app).get('/api/users').set(auth(t2))).status, 200);
});

test('cerrar sesion del admin maestro tambien corta su token', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  assert.equal((await request(app).post('/api/auth/logout').set(auth(t))).status, 200);
  assert.equal((await request(app).get('/api/users').set(auth(t))).status, 401);
  assert.equal((await request(app).get('/api/users').set(auth(admin))).status, 200);
});

// ── L-11: contrasena asignada por el admin -> cambio obligatorio ──

async function loginDirecto(user, password) {
  return request(app).post('/api/auth/login').send({ user, password });
}

test('cuenta nueva: el login avisa el cambio obligatorio y no deja hacer nada mas hasta cambiarla', async () => {
  await crear('f151temp', 'SUPERVISOR', { Calidad: true, campana_ORLANT: true });
  const l = await loginDirecto('f151temp', PW);
  assert.equal(l.status, 200);
  assert.equal(l.body.user.debeCambiarPassword, true);
  const bloqueada = await request(app).get('/api/users').set(auth(l.body.token));
  assert.equal(bloqueada.status, 403);
  assert.equal(bloqueada.body.codigo, 'DEBE_CAMBIAR_PASSWORD');
  const cambio = await request(app).put('/api/auth/password').set(auth(l.body.token)).send({ currentPassword: PW, newPassword: 'Propia#Fase151' });
  assert.equal(cambio.status, 200);
  assert.equal((await request(app).get('/api/users').set(auth(cambio.body.token))).status, 200);
  const l2 = await loginDirecto('f151temp', 'Propia#Fase151');
  assert.equal(l2.body.user.debeCambiarPassword, false);
});

test('reseteo de contrasena por el admin vuelve a pedir el cambio; cerrar sesion sigue permitido', async () => {
  await request(app).put(`/api/users/${ids.f151temp}/password`).set(auth(admin)).send({ password: 'Reseteo#151abc' });
  const l = await loginDirecto('f151temp', 'Reseteo#151abc');
  assert.equal(l.body.user.debeCambiarPassword, true);
  assert.equal((await request(app).post('/api/auth/logout').set(auth(l.body.token))).status, 200);
});

test('las cuentas que ya existian no quedan con cambio obligatorio', async () => {
  const l = await loginDirecto('crodriguez', 'calidad123');
  assert.equal(l.status, 200);
  assert.equal(l.body.user.debeCambiarPassword, false);
});
