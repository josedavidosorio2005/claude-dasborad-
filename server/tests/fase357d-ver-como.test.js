// fase357d-ver-como.test.js — Fase 357 D (pedido de Edwin, 17/11): «Ver como este usuario».
// Solo ADMIN, nunca hacia otro ADMIN, SOLO LECTURA, 30 minutos, inicio y fin en el Historial.
// Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');

const H = (t) => ({ Authorization: 'Bearer ' + t });
function crear(user, rol, perms, extra) {
  const r = db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password, asesorCampana) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run('Persona ' + user, user, rol, extra && extra.inactivo ? 0 : 1, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), new Date().toISOString(), extra && extra.debeCambiar ? 1 : 0, (extra && extra.asesorCampana) || null);
  return Number(r.lastInsertRowid);
}
const id = {};
let master, admin, cli;

before(async () => {
  master = await tokenFor('admin', MASTER_PASSWORD);
  id.admin = crear('f357d_admin', 'ADMIN', {});
  id.admin2 = crear('f357d_admin2', 'ADMIN', {});
  id.cli = crear('f357d_cli', 'CLIENTES_DASH', { ClientesDash: true, cliente_ORLANT: true });
  id.ase = crear('f357d_ase', 'ASESOR', {}, { asesorCampana: 'ORLANT' });
  id.rep = crear('f357d_rep', 'REPORTES', { Calidad: true, campana_ORLANT: true });
  id.sus = crear('f357d_sus', 'CLIENTES_DASH', {}, { inactivo: true });
  id.nueva = crear('f357d_nueva', 'CLIENTES_DASH', { ClientesDash: true, cliente_ORLANT: true }, { debeCambiar: true });
  admin = await tokenFor('f357d_admin', 'Clave#2026x');
  cli = await tokenFor('f357d_cli', 'Clave#2026x');
});

const verComo = (t, uid) => request(app).post('/api/admin/ver-como/' + uid).set(H(t)).send({});

test('solo ADMIN; nunca hacia otro ADMIN ni una cuenta suspendida', async () => {
  assert.equal((await verComo(cli, id.ase)).status, 403);
  assert.equal((await request(app).post('/api/admin/ver-como/' + id.cli).send({})).status, 401);
  assert.equal((await verComo(admin, id.admin2)).status, 403);
  assert.match((await verComo(master, id.admin)).body.error, /otro administrador/);
  assert.equal((await verComo(admin, id.sus)).status, 400);
  assert.equal((await verComo(admin, 999999)).status, 404);
  assert.equal((await verComo(admin, 'abc')).status, 404);
});

test('token del usuario elegido, 30 minutos, sin contraseña ni hash, y su vista real (GET)', async () => {
  const r = await verComo(admin, id.cli);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.minutos, 30);
  assert.equal(r.body.user.id, id.cli);
  assert.equal(r.body.user.rol, 'CLIENTES_DASH');
  const s = JSON.stringify(r.body);
  assert.ok(!/password|hash|Clave#2026x/i.test(s.replace('debeCambiarPassword', '')), 'ni contraseña ni hash');
  const dec = jwt.decode(r.body.token);
  assert.equal(dec.userId, id.cli);
  assert.equal(dec.soloLectura, true);
  assert.equal(dec.verComo.adminUser, 'f357d_admin');
  assert.ok(Math.abs((dec.exp - dec.iat) - 30 * 60) <= 1, 'dura 30 minutos');
  // Ve lo que ve el cliente: su lista de clientes; no lo del administrador.
  const t = r.body.token;
  assert.equal((await request(app).get('/api/dashboard/clientes').set(H(t))).status, 200);
  assert.equal((await request(app).get('/api/historial').set(H(t))).status, 403);
});

test('SOLO LECTURA: cualquier escritura con el token «ver como» → 403, y no cambia nada', async () => {
  const t = (await verComo(admin, id.cli)).body.token;
  const antes = db.prepare('SELECT COUNT(*) n FROM tickets').get().n;
  const intentos = [
    request(app).post('/api/tickets').set(H(t)).send({ tipo: 'SUGERENCIA', campana: 'GENERAL', descripcion: 'x' }),
    request(app).put('/api/auth/password').set(H(t)).send({ currentPassword: 'a', newPassword: 'bbbbbbbbbbbb' }),
    request(app).post('/api/auth/logout').set(H(t)).send({}),
    request(app).put('/api/users/' + id.cli).set(H(t)).send({ nombre: 'x' }),
    request(app).delete('/api/tickets/1').set(H(t)),
    request(app).post('/api/admin/ver-como/' + id.ase).set(H(t)).send({}),
  ];
  for (const r of await Promise.all(intentos)) {
    assert.equal(r.status, 403, r.req && r.req.path);
    assert.equal(r.body.codigo, 'SOLO_LECTURA_VER_COMO');
  }
  assert.equal(db.prepare('SELECT COUNT(*) n FROM tickets').get().n, antes);
});

test('ver como asesora: marcar un monitoreo como visto también está bloqueado', async () => {
  const t = (await verComo(master, id.ase)).body.token;
  const r = await request(app).put('/api/monitoreos/1/visto').set(H(t)).send({});
  assert.equal(r.status, 403);
  assert.equal((await request(app).get('/api/monitoreos/mios').set(H(t))).status, 200);
});

test('una cuenta con cambio de clave pendiente se puede ver (sin pedir el cambio)', async () => {
  const r = await verComo(admin, id.nueva);
  assert.equal(r.status, 200);
  assert.equal(r.body.user.debeCambiarPassword, false);
  assert.equal((await request(app).get('/api/dashboard/clientes').set(H(r.body.token))).status, 200);
});

test('Historial: inicio y fin (quién, a quién); al terminar el token deja de servir', async () => {
  const r = await verComo(admin, id.rep);
  const t = r.body.token;
  const ini = db.prepare("SELECT * FROM historial WHERE accion = 'VER_COMO_INICIO' ORDER BY id DESC").get();
  assert.equal(ini.username, 'f357d_rep');
  assert.match(ini.actor, /f357d_admin/);
  assert.match(ini.detalle, /solo lectura, 30 minutos/);
  // «fin» solo con un token «ver como».
  assert.equal((await request(app).post('/api/admin/ver-como/fin').set(H(admin)).send({})).status, 400);
  const f = await request(app).post('/api/admin/ver-como/fin').set(H(t)).send({});
  assert.equal(f.status, 200);
  const fin = db.prepare("SELECT * FROM historial WHERE accion = 'VER_COMO_FIN' ORDER BY id DESC").get();
  assert.equal(fin.username, 'f357d_rep');
  assert.match(fin.actor, /f357d_admin/);
  assert.equal((await request(app).get('/api/dashboard/clientes').set(H(t))).status, 401, 'token revocado');
  // El token normal del administrador sigue funcionando y puede escribir.
  assert.equal((await request(app).get('/api/historial').set(H(admin))).status, 200);
});
