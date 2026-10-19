// fase154-registro-por-acceso.test.js — Fase 154: GET /dashboard/clientes
// (listas y registro de clientes) solo muestra los clientes a los que la
// persona tiene acceso. La lista completa la ve el administrador y quien
// gestiona usuarios (la necesita para asignar clientes), igual que GET /users.
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, db, request, cleanup } = require('./helpers');
const { signToken } = require('../auth');
const clientesRegistro = require('../clientes-registro');

after(cleanup);

function tokenDe(user, rol, perms) {
  db.prepare(
    "INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt) VALUES (?, ?, ?, 1, 'x', ?, '2026-10-19')"
  ).run('Persona ' + user, user, rol, JSON.stringify(perms));
  const row = db.prepare('SELECT * FROM users WHERE user = ?').get(user);
  return signToken({ isMasterAdmin: false, userId: row.id, rol: row.rol, tokenVersion: row.token_version });
}

async function clientesDe(token) {
  const res = await request(app).get('/api/dashboard/clientes').set('Authorization', 'Bearer ' + token);
  assert.equal(res.status, 200);
  return {
    clientes: res.body.clientes,
    listaClientes: res.body.listaClientes,
    campanasCalidad: res.body.campanasCalidad,
    registro: res.body.registro.map((c) => c.nombre),
  };
}

const SOLO_ORLANT = { clientes: ['ORLANT'], listaClientes: ['ORLANT'], campanasCalidad: ['ORLANT'], registro: ['ORLANT'] };
// Todos: lo que tenga el registro (no una lista fija).
const todos = () => ({
  clientes: db.prepare('SELECT cliente FROM dashboards_config WHERE activo = 1 ORDER BY cliente').all().map((r) => r.cliente),
  listaClientes: clientesRegistro.listaClientes(db),
  campanasCalidad: clientesRegistro.campanasCalidad(db),
  registro: clientesRegistro.registroParaNavegador(db).map((c) => c.nombre),
});

test('el usuario de un cliente solo ve su cliente (nunca el registro de otros)', async () => {
  const t = tokenDe('f154cli', 'CLIENTES_DASH', { Dashboards: true, cliente_ORLANT: true });
  assert.deepEqual(await clientesDe(t), SOLO_ORLANT);
});

test('Calidad o Reportes con una campana: solo esa', async () => {
  assert.deepEqual(await clientesDe(tokenDe('f154cal', 'CALIDAD', { campana_ORLANT: true })), SOLO_ORLANT);
  assert.deepEqual(await clientesDe(tokenDe('f154rep', 'REPORTES', { cargarDatos: true, campana_ORLANT: true })), SOLO_ORLANT);
});

test('sin ningun cliente: listas vacias', async () => {
  const vacio = { clientes: [], listaClientes: [], campanasCalidad: [], registro: [] };
  assert.deepEqual(await clientesDe(tokenDe('f154inv', 'INVENTARIO', { Inventario: true })), vacio);
});

test('el administrador y quien gestiona usuarios ven todos', async () => {
  assert.ok(todos().registro.length >= 2, 'el registro de prueba tiene varios clientes');
  assert.deepEqual(await clientesDe(signToken({ isMasterAdmin: true, rol: 'ADMIN' })), todos());
  assert.deepEqual(await clientesDe(tokenDe('f154aux', 'AUX_ADMIN', { editarUsuarios: true })), todos());
  assert.deepEqual(await clientesDe(tokenDe('f154aux2', 'AUX_ADMIN', { gestionPermisos: true })), todos());
});
