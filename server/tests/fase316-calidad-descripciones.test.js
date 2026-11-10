// fase316-calidad-descripciones.test.js — Fase 316 (10/11/2026): editar SOLO la
// descripcion de los items de una plantilla de Calidad existente (pedido del
// supervisor para el Diccionario de ORLANT). Textos SINTETICOS (no los del supervisor).
// Comprueba que pesos, criticos, orden, categorias, nombres, campos, version, id y
// monitoreos guardados (respuestas y nota) quedan exactamente igual.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const hoy = new Date().toISOString().slice(0, 10);
let admin, supOrl, idOrlant;
function crear(user, rol, perms) {
  db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
    .run('Persona ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), new Date().toISOString());
  return tokenFor(user, 'Clave#2026x');
}
const fila = (id) => db.prepare('SELECT * FROM calidad_plantillas WHERE id = ?').get(id);
before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  supOrl = await crear('f316_sup', 'SUPERVISOR', { campana_ORLANT: true });
  idOrlant = db.prepare("SELECT id FROM calidad_plantillas WHERE campana = 'ORLANT' AND principal = 1").get().id;
  const m = await request(app).post('/api/monitoreos').set(H(admin)).send({ campana: 'ORLANT', asesor: 'Asesor Ficticio', fecha: hoy, canal: 'LLAMADA', answers: { 1: 'SI', 3: 'NO', 6: 'SI' } });
  assert.equal(m.status, 201, JSON.stringify(m.body));
});

test('solo cambia la descripcion: id, version, pesos, criticos, orden, categorias, campos y monitoreos iguales', async () => {
  const antes = fila(idOrlant);
  const monAntes = db.prepare('SELECT * FROM monitoreos WHERE campana = ? ORDER BY id').all('ORLANT');
  const itemsAntes = JSON.parse(antes.items);
  const desc = itemsAntes.map((it) => ({ n: it.n, descripcion: 'Descripción ficticia del ítem ' + it.n + '.' }));
  const r = await request(app).put('/api/calidad/plantillas/' + idOrlant + '/descripciones').set(H(admin)).send({ descripciones: desc });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.cambiadas, itemsAntes.length);
  const despues = fila(idOrlant);
  const itemsDespues = JSON.parse(despues.items);
  assert.deepEqual(itemsDespues.map((it) => { const c = { ...it }; delete c.descripcion; return c; }), itemsAntes.map((it) => { const c = { ...it }; delete c.descripcion; return c; }), 'todo lo demas de cada item, igual y en el mismo orden');
  itemsDespues.forEach((it) => assert.equal(it.descripcion, 'Descripción ficticia del ítem ' + it.n + '.'));
  for (const k of ['id', 'campana', 'nombre', 'principal', 'engine', 'activo', 'campos', 'version', 'completoObligatorio', 'familiaId']) assert.deepEqual(despues[k], antes[k], k);
  assert.deepEqual(db.prepare('SELECT * FROM monitoreos WHERE campana = ? ORDER BY id').all('ORLANT'), monAntes, 'monitoreos (respuestas y nota) intactos');
  // El Diccionario las recibe por la API de siempre.
  const todas = await request(app).get('/api/calidad/plantillas/todas').set(H(supOrl));
  const p = todas.body.find((x) => x.id === idOrlant);
  assert.equal(p.items.filter((it) => it.descripcion).length, itemsAntes.length);
  // Repetir lo mismo no cambia nada; texto vacio quita la descripcion de ese item.
  assert.equal((await request(app).put('/api/calidad/plantillas/' + idOrlant + '/descripciones').set(H(admin)).send({ descripciones: desc })).body.cambiadas, 0);
  const q = await request(app).put('/api/calidad/plantillas/' + idOrlant + '/descripciones').set(H(admin)).send({ descripciones: [{ n: 2, descripcion: '' }] });
  assert.equal(q.body.cambiadas, 1);
  assert.equal(JSON.parse(fila(idOrlant).items).find((it) => it.n === 2).descripcion, undefined);
});

test('item que no existe, campos de mas o texto muy largo -> 400 sin guardar; no admin -> 403; plantilla inexistente -> 404', async () => {
  const antes = fila(idOrlant).items;
  const put = (t, body, id) => request(app).put('/api/calidad/plantillas/' + (id || idOrlant) + '/descripciones').set(H(t)).send(body);
  const r = await put(admin, { descripciones: [{ n: 1, descripcion: 'x' }, { n: 99, descripcion: 'y' }] });
  assert.equal(r.status, 400); assert.match(r.body.error, /99/);
  assert.equal((await put(admin, { descripciones: [{ n: 1, descripcion: 'x', weight: 50 }] })).status, 400, 'no se puede colar un peso');
  assert.equal((await put(admin, { descripciones: [{ n: 1, descripcion: 'x'.repeat(1001) }] })).status, 400);
  assert.equal(fila(idOrlant).items, antes, 'nada guardado');
  assert.equal((await put(supOrl, { descripciones: [{ n: 1, descripcion: 'x' }] })).status, 403);
  assert.equal((await put(admin, { descripciones: [{ n: 1, descripcion: 'x' }] }, 999999)).status, 404);
});

test('front: boton «Descripciones» por plantilla y editor que solo manda {n, descripcion}', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'calidad-plantillas.js'), 'utf8');
  assert.match(src, /onclick="calPlantillaDescripciones\(' \+ p\.id \+ '\)">Descripciones<\/button>/);
  assert.match(src, /return \{ n: Number\(t\.getAttribute\('data-cpl-n'\)\), descripcion: t\.value\.trim\(\) \};/);
  assert.match(src, /apiRequest\('PUT', '\/calidad\/plantillas\/' \+ id \+ '\/descripciones'/);
});
