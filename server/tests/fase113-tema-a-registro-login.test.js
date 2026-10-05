// Fase 113 (tema A): registro de inicios de sesion + "Ultimo ingreso" +
// aviso de seguridad al admin.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, login, tokenFor, MASTER_PASSWORD, SEED, db } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

async function ultimoHist(adminToken) {
  const res = await request(app).get('/api/historial').set(auth(adminToken));
  assert.equal(res.status, 200);
  return res.body[0]; // ORDER BY ts DESC
}

test('login exitoso (usuario normal) queda en el Historial como LOGIN_OK, sin la contrasena', async () => {
  const adminToken = await tokenFor('admin', MASTER_PASSWORD);
  const res = await login('psuarez', SEED.psuarez);
  assert.equal(res.status, 200);

  const h = await ultimoHist(adminToken);
  assert.equal(h.accion, 'LOGIN_OK');
  assert.equal(h.username, 'psuarez');
  assert.ok(h.ip, 'debe guardar una IP');
  assert.ok(h.userAgent, 'debe guardar un navegador resumido');
  assert.ok(h.fecha, 'debe tener fecha y hora');

  const raw = JSON.stringify(h);
  assert.ok(!/admin456/.test(raw), 'la contrasena nunca debe aparecer en el Historial');
  assert.ok(!/password_hash/i.test(raw));
});

test('login fallido (contrasena incorrecta) queda en el Historial con el motivo, pero el mensaje al usuario es generico', async () => {
  const adminToken = await tokenFor('admin', MASTER_PASSWORD);
  const res = await login('psuarez', 'clave-mala-a-proposito');
  assert.equal(res.status, 401);
  assert.equal(res.body.error, 'Usuario o contrasena incorrectos');

  const h = await ultimoHist(adminToken);
  assert.equal(h.accion, 'LOGIN_FALLIDO');
  assert.equal(h.username, 'psuarez');
  assert.equal(h.detalle, 'Contrasena incorrecta');
  assert.ok(!/clave-mala-a-proposito/.test(JSON.stringify(h)), 'la contrasena intentada nunca se guarda');
});

test('login fallido (usuario inexistente) tambien queda registrado, con el nombre intentado', async () => {
  const adminToken = await tokenFor('admin', MASTER_PASSWORD);
  const nombre = 'fantasma_' + Date.now();
  const res = await login(nombre, 'loquesea1234');
  assert.equal(res.status, 401);
  assert.equal(res.body.error, 'Usuario o contrasena incorrectos');

  const h = await ultimoHist(adminToken);
  assert.equal(h.accion, 'LOGIN_FALLIDO');
  assert.equal(h.username, nombre);
  assert.equal(h.detalle, 'Usuario no existe');
});

test('el mensaje de error es IDENTICO para usuario inexistente y para contrasena incorrecta (no se puede distinguir desde afuera)', async () => {
  const r1 = await login('psuarez', 'clave-mala-a-proposito-2');
  const r2 = await login('no_existe_' + Date.now(), 'loquesea1234');
  assert.equal(r1.status, r2.status);
  assert.equal(r1.body.error, r2.body.error);
});

test('login fallido contra una cuenta suspendida queda registrado como "Usuario suspendido"', async () => {
  const adminToken = await tokenFor('admin', MASTER_PASSWORD);
  const list = await request(app).get('/api/users').set(auth(adminToken));
  const target = list.body.find((u) => u.user === 'agomez');
  assert.ok(target);

  await request(app).put(`/api/users/${target.id}/active`).set(auth(adminToken)); // suspende
  const res = await login('agomez', SEED.agomez);
  assert.equal(res.status, 403);

  const h = await ultimoHist(adminToken);
  assert.equal(h.accion, 'LOGIN_FALLIDO');
  assert.equal(h.detalle, 'Usuario suspendido');

  await request(app).put(`/api/users/${target.id}/active`).set(auth(adminToken)); // reactiva
});

test('"Ultimo ingreso" (lastLogin) se actualiza tras un login exitoso y es visible solo para admin completo', async () => {
  const adminToken = await tokenFor('admin', MASTER_PASSWORD);
  const antes = await request(app).get('/api/users').set(auth(adminToken));
  const userAntes = antes.body.find((u) => u.user === 'crodriguez');
  assert.ok(userAntes);

  await login('crodriguez', SEED.crodriguez);

  const despues = await request(app).get('/api/users').set(auth(adminToken));
  const userDespues = despues.body.find((u) => u.user === 'crodriguez');
  assert.ok(userDespues.lastLogin, 'debe quedar un lastLogin tras iniciar sesion');
  assert.notEqual(userDespues.lastLogin, userAntes.lastLogin);

  // AUX_ADMIN sin permisos de administracion (lrios, ver SEED en helpers.js)
  // no debe recibir el campo lastLogin de NADIE, ni siquiera el suyo propio.
  const auxToken = await tokenFor('lrios', SEED.lrios);
  const comoAux = await request(app).get('/api/users').set(auth(auxToken));
  assert.equal(comoAux.status, 200);
  comoAux.body.forEach((u) => assert.equal(u.lastLogin, undefined));
});

test('logout queda registrado en el Historial', async () => {
  const adminToken = await tokenFor('admin', MASTER_PASSWORD);
  const t = await tokenFor('crodriguez', SEED.crodriguez);
  const res = await request(app).post('/api/auth/logout').set(auth(t));
  assert.equal(res.status, 200);
  const h = await ultimoHist(adminToken);
  assert.equal(h.accion, 'LOGOUT');
  assert.equal(h.username, 'crodriguez');
});

test('GET /historial y GET /seguridad/alertas: AUX_ADMIN (sin permisos de admin) recibe 403', async () => {
  const auxToken = await tokenFor('lrios', SEED.lrios);
  const r1 = await request(app).get('/api/historial').set(auth(auxToken));
  assert.equal(r1.status, 403);
  const r2 = await request(app).get('/api/seguridad/alertas').set(auth(auxToken));
  assert.equal(r2.status, 403);
});

test('aviso de seguridad: 10+ intentos fallidos en 24h sobre la misma cuenta dispara fallosMasivos', async () => {
  const adminToken = await tokenFor('admin', MASTER_PASSWORD);
  const userUmbral = 'umbral_test_' + Date.now();
  for (let i = 0; i < 10; i++) {
    const r = await login(userUmbral, 'nope');
    assert.equal(r.status, 401);
  }
  const alertas = await request(app).get('/api/seguridad/alertas').set(auth(adminToken));
  assert.equal(alertas.status, 200);
  const encontrado = alertas.body.fallosMasivos.find((f) => f.username === userUmbral);
  assert.ok(encontrado, 'debe aparecer en fallosMasivos tras 10 intentos fallidos');
  assert.ok(encontrado.intentos >= 10);
});

test('aviso de seguridad: login ADMIN/AUX_ADMIN exitoso desde una IP nueva aparece en ipsNuevasAdmin', async () => {
  const adminToken = await tokenFor('admin', MASTER_PASSWORD);
  // psuarez es ADMIN completo (SEED) -- su primer login de este archivo de
  // pruebas ya cuenta como "IP nueva" (sin base previa, ver seguridad.js).
  await login('psuarez', SEED.psuarez);
  const alertas = await request(app).get('/api/seguridad/alertas').set(auth(adminToken));
  assert.equal(alertas.status, 200);
  const encontrado = alertas.body.ipsNuevasAdmin.find((a) => a.username === 'psuarez');
  assert.ok(encontrado, 'debe aparecer psuarez en ipsNuevasAdmin');
});

test('no hay fuga de hashes/contrasenas en GET /historial tras varios logins', async () => {
  const adminToken = await tokenFor('admin', MASTER_PASSWORD);
  await login('psuarez', 'otra-clave-mala');
  const res = await request(app).get('/api/historial').set(auth(adminToken));
  const raw = res.text || JSON.stringify(res.body);
  assert.ok(!/password_hash/i.test(raw));
  assert.ok(!/\$2[aby]\$\d{2}\$/.test(raw));
  assert.ok(!/otra-clave-mala/.test(raw));
});

// Fase 117 (hallazgo real, detectado por un test flaky en la corrida completa
// de la suite): `ts` es Date.now() -- resolucion de milisegundo. Dos eventos
// insertados en el mismo milisegundo (plausible: el login del admin maestro
// justo antes de otro login, en la misma peticion de prueba) empataban en
// `ORDER BY ts DESC`, y SQLite no promete ningun orden estable entre filas
// empatadas -- GET /historial podia devolver el evento mas viejo primero.
// El fix agrega `id DESC` (AUTOINCREMENT, estrictamente creciente) como
// desempate. Esta prueba fuerza el empate a mano (mismo `ts` en 2 insertos
// directos a la BD) para no depender de que la maquina sea lo bastante
// rapida como para topar con el bug por casualidad.
test('GET /historial desempata eventos con el mismo `ts` por orden de insercion (id), nunca al azar', async () => {
  const adminToken = await tokenFor('admin', MASTER_PASSWORD);
  const tsFijo = Date.now();
  db.prepare(
    `INSERT INTO historial (ts, fecha, accion, nombre, username, rol, actor, detalle)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(tsFijo, '01/01/2026 00:00:00', 'LOGIN_OK', 'Primero', 'primero_117', '-', 'Sistema', '');
  db.prepare(
    `INSERT INTO historial (ts, fecha, accion, nombre, username, rol, actor, detalle)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(tsFijo, '01/01/2026 00:00:00', 'LOGIN_OK', 'Segundo', 'segundo_117', '-', 'Sistema', '');

  const res = await request(app).get('/api/historial').set(auth(adminToken));
  assert.equal(res.status, 200);
  const empatados = res.body.filter((h) => h.ts === tsFijo);
  assert.equal(empatados.length, 2);
  // El segundo insertado (id mayor) debe salir ANTES: es el mas nuevo de los
  // dos, aunque compartan exactamente el mismo `ts`.
  assert.equal(empatados[0].username, 'segundo_117');
  assert.equal(empatados[1].username, 'primero_117');
});
