// fase342-plantilla-principal-automatica.test.js — Fase 342 (decision del usuario, 11/11): quien supervisa
// o hace calidad en una campaña queda habilitado para la plantilla PRINCIPAL de esa campaña aunque tenga
// otras plantillas marcadas. Las marcadas a mano siguen igual; las no principales sin marcar siguen
// bloqueadas; lo que ve cada rol no cambia. Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const auth = require('../auth');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const hoy = new Date().toISOString().slice(0, 10);
const PW = 'Clave#Fase342x';
let admin, prMob, prOrl, segundaMob;
before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  prMob = db.prepare("SELECT id FROM calidad_plantillas WHERE campana = 'MOBILIZE' AND principal = 1").get().id;
  prOrl = db.prepare("SELECT id FROM calidad_plantillas WHERE campana = 'ORLANT' AND principal = 1").get().id;
  segundaMob = Number(db.prepare("INSERT INTO calidad_plantillas (campana, nombre, principal, engine, items, activo, updatedAt) VALUES ('MOBILIZE', 'Mobilize otra (prueba)', 0, 'standard', ?, 1, ?)")
    .run(JSON.stringify([{ n: 1, cat: 'A', label: 'Item 1', weight: 100, critico: false }]), new Date().toISOString()).lastInsertRowid);
});
async function crear(user, rol, perms) {
  const r = await request(app).post('/api/users').set(H(admin)).send({ nombre: 'Persona Ficticia ' + user, user, password: PW, rol, perms });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return tokenFor(user, PW);
}
const body = (extra) => Object.assign({ campana: 'MOBILIZE', asesor: 'Asesor Ficticio', fecha: hoy, canal: 'LLAMADA', answers: { 1: 'SI' } }, extra);
const usables = async (t, camp) => (await request(app).get('/api/calidad/plantillas/todas').set(H(t))).body.filter((p) => p.campana === camp).map((p) => [p.principal, p.usable]);

test('SUPERVISOR que supervisa la campaña, con otra plantilla marcada: la principal de su campaña queda habilitada', async () => {
  const sup = await crear('sup342a', 'SUPERVISOR', { Calidad: true, supervisa_MOBILIZE: true, ['plantilla_' + prOrl]: true });
  assert.equal((await request(app).post('/api/monitoreos').set(H(sup)).send(body())).status, 201);
  assert.deepEqual(await usables(sup, 'MOBILIZE'), [[true, true], [false, false]], 'la otra (no principal, sin marcar) sigue bloqueada');
  assert.equal((await request(app).post('/api/monitoreos').set(H(sup)).send(body({ plantillaId: segundaMob }))).status, 403);
});

test('CALIDAD con la campaña y otra plantilla marcada: igual; la marcada a mano sigue funcionando', async () => {
  const cal = await crear('cal342a', 'CALIDAD', { Calidad: true, campana_MOBILIZE: true, ['plantilla_' + segundaMob]: true });
  assert.deepEqual(await usables(cal, 'MOBILIZE'), [[true, true], [false, true]]);
  assert.equal((await request(app).post('/api/monitoreos').set(H(cal)).send(body())).status, 201);
  assert.equal((await request(app).post('/api/monitoreos').set(H(cal)).send(body({ plantillaId: segundaMob }))).status, 201);
});

test('la regla no da campañas: sin acceso a la campaña, su principal no se habilita; Reportes y asesor no califican', async () => {
  const otra = await crear('cal342b', 'CALIDAD', { Calidad: true, campana_ORLANT: true, ['plantilla_' + prOrl]: true });
  assert.equal((await request(app).post('/api/monitoreos').set(H(otra)).send(body())).status, 403);
  const rep = await crear('rep342a', 'REPORTES', { Calidad: true, campana_MOBILIZE: true });
  assert.equal((await request(app).post('/api/monitoreos').set(H(rep)).send(body())).status, 403);
  // Funcion pura: sin fila de plantilla, la regla de antes.
  const actor = { rol: 'CALIDAD', perms: { campana_MOBILIZE: true, ['plantilla_' + prOrl]: true } };
  assert.equal(auth.canUsePlantilla(actor, prMob), false);
  assert.equal(auth.canUsePlantilla(actor, prMob, { campana: 'MOBILIZE', principal: 1 }), true);
  assert.equal(auth.canUsePlantilla(actor, segundaMob, { campana: 'MOBILIZE', principal: 0 }), false);
});

test('no cambia que monitoreos ve cada rol: CALIDAD sigue viendo solo los suyos', async () => {
  const a = await crear('cal342c', 'CALIDAD', { Calidad: true, campana_MOBILIZE: true, ['plantilla_' + prOrl]: true });
  const b = await crear('cal342d', 'CALIDAD', { Calidad: true, campana_MOBILIZE: true });
  const id = (await request(app).post('/api/monitoreos').set(H(a)).send(body({ observaciones: 'Ficticia 342' }))).body.id;
  const deB = (await request(app).get('/api/monitoreos?campana=MOBILIZE').set(H(b))).body;
  assert.ok(Array.isArray(deB) && !deB.some((m) => m.id === id), 'otro CALIDAD no lo ve (Fase 334)');
});
