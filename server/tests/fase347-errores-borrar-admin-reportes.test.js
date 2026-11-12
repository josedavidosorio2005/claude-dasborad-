// fase347-errores-borrar-admin-reportes.test.js — Fase 347 (B3, pedido del usuario 12/11):
// en Aurora › Errores, borrar un error queda solo para el administrador y Reportes con acceso
// al cliente (servidor: 403 a los demas; interfaz: el boton Borrar sale solo con puedeBorrar).
// El supervisor sigue registrando y editando. Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const AURORA = 'CLINICA AURORA';
const CLAVE = 'Clave#Fase347b';
let admin, sup, rep, repOtro, cli;

async function cuenta(rol, perms) {
  const user = 'b3_' + Math.random().toString(36).slice(2, 8);
  const r = await request(app).post('/api/users').set(H(admin)).send({ nombre: 'Cuenta Sintética', user, password: CLAVE, rol, perms });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return tokenFor(user, CLAVE);
}
async function nuevoError() {
  const r = await request(app).post('/api/calidad/errores').set(H(sup)).send({ campana: AURORA, mes: '2026-11', asesor: 'Asesora Inventada', observacion: 'Error inventado.' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.id;
}
const borrar = (t, id) => request(app).delete('/api/calidad/errores/' + id).set(H(t));
const datos = async (t) => (await request(app).get('/api/calidad/errores?campana=' + encodeURIComponent(AURORA)).set(H(t))).body;

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  sup = await cuenta('SUPERVISOR', { Calidad: true, ['supervisa_' + AURORA]: true, ['cliente_' + AURORA]: true });
  rep = await cuenta('REPORTES', { Calidad: true, ['campana_' + AURORA]: true });
  repOtro = await cuenta('REPORTES', { Calidad: true, campana_ORLANT: true });
  cli = await cuenta('CLIENTES_DASH', { ClientesDash: true, ['cliente_' + AURORA]: true });
});

test('servidor: el supervisor y el cliente reciben 403 al borrar; admin y Reportes de Aurora borran', async () => {
  const id = await nuevoError();
  const s = await borrar(sup, id);
  assert.equal(s.status, 403); assert.match(s.body.error, /administrador o Reportes/);
  assert.equal((await borrar(cli, id)).status, 403);
  assert.equal((await borrar(repOtro, id)).status, 403, 'Reportes sin acceso a Aurora');
  assert.equal((await borrar(rep, id)).status, 200, 'Reportes de Aurora borra');
  assert.equal((await borrar(admin, await nuevoError())).status, 200, 'el admin borra');
  assert.equal((await borrar(admin, 999999)).status, 404);
});

test('el supervisor sigue registrando y editando; Reportes no registra', async () => {
  const id = await nuevoError();
  assert.equal((await request(app).put('/api/calidad/errores/' + id).set(H(sup)).send({ cantidad: 2 })).status, 200);
  assert.equal((await request(app).post('/api/calidad/errores').set(H(rep)).send({ campana: AURORA, mes: '2026-11', asesor: 'Asesora Inventada' })).status, 403);
});

test('puedeBorrar en la respuesta: admin y Reportes sí; supervisor y cliente no', async () => {
  const a = await datos(admin), s = await datos(sup), r = await datos(rep), c = await datos(cli);
  assert.deepEqual([a.puedeEditar, a.puedeBorrar], [true, true]);
  assert.deepEqual([s.puedeEditar, s.puedeBorrar], [true, false]);
  assert.deepEqual([r.puedeEditar, r.puedeBorrar], [false, true]);
  assert.deepEqual([c.puedeEditar, c.puedeBorrar], [false, false]);
});

test('interfaz: Borrar solo con puedeBorrar; Reportes abre solo «Errores del mes»', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'errores.js'), 'utf8');
  assert.match(js, /\(_errEd\.puedeBorrar \? '<button type="button" class="btn-sm err-borrar"/);
  assert.match(js, /d\.puedeBorrar \? '<button type="button" class="btn-primary err-agregar"[^\n]*>Errores del mes<\/button>'/);
  assert.match(js, /if \(edita\) \{ try \{ _errEd\.asesoras/, 'quien no edita no pide la lista de asesoras');
});
