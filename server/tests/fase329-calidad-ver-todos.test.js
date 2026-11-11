// fase329-calidad-ver-todos.test.js — Fase 329 (10/11/2026, reporte del supervisor): todo usuario con
// acceso a Calidad de una campaña ve TODOS los monitoreos de esa campaña, sin importar quien los
// califico (antes el rol CALIDAD solo veia los suyos). El asesor sigue viendo solo los suyos en
// /monitoreos/mios y el cliente sigue sin evaluador ni observaciones. Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const PW = 'Clave#Fase329x';
const hoy = new Date().toISOString().slice(0, 10);
let admin, evA, evB, evOtra, sup, asesor, asesorOtro, cliente;

async function crear(user, rol, perms, extra) {
  const r = await request(app).post('/api/users').set(H(admin)).send(Object.assign({ nombre: 'Persona Ficticia ' + user, user, password: PW, rol, perms }, extra));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { id: r.body.id, nombre: 'Persona Ficticia ' + user, token: await tokenFor(user, PW) };
}
const mon = (tok, campana, asesorNombre, asesorUserId) => request(app).post('/api/monitoreos').set(H(tok)).send({ campana, asesor: asesorNombre, asesorUserId, fecha: hoy, canal: 'LLAMADA', answers: { 1: 'SI' }, observaciones: 'Observación ficticia 329' });
const ids = async (tok, campana, mes) => { const r = await request(app).get('/api/monitoreos?campana=' + encodeURIComponent(campana) + (mes ? '&mes=' + mes : '')).set(H(tok)); return { status: r.status, ids: (r.body || []).map ? r.body.map((m) => m.id) : [], body: r.body }; };

let mA, mB, mSup, mOtra;
before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  evA = await crear('ev329a', 'CALIDAD', { Calidad: true, campana_MOBILIZE: true });
  evB = await crear('ev329b', 'CALIDAD', { Calidad: true, campana_MOBILIZE: true });
  evOtra = await crear('ev329o', 'CALIDAD', { Calidad: true, campana_ORLANT: true });
  sup = await crear('sup329', 'SUPERVISOR', { campana_MOBILIZE: true, cliente_MOBILIZE: true });
  asesor = await crear('as329', 'ASESOR', {}, { asesorCampana: 'MOBILIZE' });
  asesorOtro = await crear('as329b', 'ASESOR', {}, { asesorCampana: 'MOBILIZE' });
  cliente = await crear('cli329', 'CLIENTES_DASH', { ClientesDash: true, cliente_MOBILIZE: true });
  mA = (await mon(evA.token, 'MOBILIZE', asesor.nombre, asesor.id)).body;
  mB = (await mon(evB.token, 'MOBILIZE', asesorOtro.nombre, asesorOtro.id)).body;
  mSup = (await mon(sup.token, 'MOBILIZE', asesor.nombre, asesor.id)).body;
  mOtra = (await mon(evOtra.token, 'ORLANT', 'Asesor Ficticio Otra Campaña')).body;
  for (const m of [mA, mB, mSup, mOtra]) assert.ok(m && m.id, JSON.stringify(m));
});

// Fase 334 (pedido de Edwin): esta regla de la Fase 329 se reemplazo. El rol CALIDAD vuelve a
// ver solo lo suyo; el supervisor recibe el consolidado sin ?vista=propios (dashboard) y solo lo
// suyo con el (Modulo de Calidad). Detalle por rol en fase334-calidad-cada-quien.test.js.
test('Fase 334: el evaluador A ya no ve los de B ni los del supervisor; el supervisor sigue con el consolidado del dashboard', async () => {
  const a = await ids(evA.token, 'MOBILIZE');
  assert.equal(a.status, 200);
  assert.deepEqual(a.ids, [mA.id]);
  assert.deepEqual((await ids(evB.token, 'MOBILIZE')).ids, [mB.id]);
  const s = await ids(sup.token, 'MOBILIZE');
  for (const m of [mA, mB, mSup]) assert.ok(s.ids.includes(m.id), 'el supervisor, sin vista=propios, todo (dashboard)');
  assert.ok(!s.ids.includes(mOtra.id), 'nunca uno de otra campaña');
});

test('sin acceso a otra campaña: 403 (no ve los de ORLANT ni los de MOBILIZE quien solo tiene ORLANT)', async () => {
  assert.equal((await ids(evA.token, 'ORLANT')).status, 403);
  assert.equal((await ids(evOtra.token, 'MOBILIZE')).status, 403);
  const o = await ids(evOtra.token, 'ORLANT');
  assert.equal(o.status, 200); assert.ok(o.ids.includes(mOtra.id));
});

test('el asesor solo ve los suyos en /monitoreos/mios y no puede pedir la lista de la campaña', async () => {
  const mios = (await request(app).get('/api/monitoreos/mios').set(H(asesor.token))).body.map((m) => m.id);
  assert.ok(mios.includes(mA.id) && mios.includes(mSup.id), 'los suyos, de cualquier evaluador');
  assert.ok(!mios.includes(mB.id), 'nunca el de otro asesor');
  assert.equal((await ids(asesor.token, 'MOBILIZE')).status, 403);
});

test('el cliente recibe los monitoreos sin evaluador ni observaciones', async () => {
  const r = await ids(cliente.token, 'MOBILIZE');
  assert.equal(r.status, 200);
  assert.ok(r.ids.includes(mA.id) && r.ids.includes(mB.id));
  for (const m of r.body) { assert.equal('evaluador' in m, false); assert.equal('evaluadorUserId' in m, false); assert.equal('observaciones' in m, false); }
});

test('editar sigue siendo solo de quien puede: el evaluador A no edita el monitoreo de B', async () => {
  const antes = db.prepare('SELECT puntaje, observaciones FROM monitoreos WHERE id = ?').get(mB.id);
  const r = await request(app).put('/api/monitoreos/' + mB.id).set(H(evA.token)).send({ campana: 'MOBILIZE', asesor: asesorOtro.nombre, fecha: hoy, canal: 'LLAMADA', answers: { 1: 'NO' }, observaciones: 'Cambio ficticio' });
  assert.equal(r.status, 403);
  assert.deepEqual(db.prepare('SELECT puntaje, observaciones FROM monitoreos WHERE id = ?').get(mB.id), antes);
});
