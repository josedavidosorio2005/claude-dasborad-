// fase353b-nombres-tildes.test.js — Fase 353b: lower() de SQLite solo baja las letras SIN tilde,
// asi que «JOSÉ MUÑOZ» y «José Muñoz» no se tomaban como el mismo nombre (y un espacio sin quiebre
// tampoco). En produccion dejo 13 monitoreos de 2 asesoras sin llegar a su Portal Asesor. Ahora
// todo compara con nombre_clave() / claveNombre(). Nombres inventados.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const { PLANTILLAS } = require('../calidad-plantillas-seed.js');
const enlace = require('../enlace-asesor');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const CAMP = 'MOBILIZE';
const rnd = () => Math.random().toString(36).slice(2, 6).replace(/[0-9]/g, 'q');
const todoSi = () => Object.fromEntries(PLANTILLAS.find((p) => p.campana === CAMP).items.map((it) => [String(it.n), 'SI']));
const NBSP = ' ', ZW = '​';

async function crearAsesor(admin, nombre) {
  const user = 'ase353b_' + rnd() + rnd();
  const r = await request(app).post('/api/users').set(auth(admin))
    .send({ nombre, user, password: 'ClaveAsesor1234', rol: 'ASESOR', perms: {}, asesorCampana: CAMP });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { id: r.body.id, token: await tokenFor(user, 'ClaveAsesor1234') };
}

test('claveNombre: mayúsculas con tilde y Ñ, espacios especiales; la tilde sigue contando', () => {
  assert.equal(enlace.claveNombre('  JOSÉ' + NBSP + 'MUÑOZ' + ZW + ' '), 'josé muñoz');
  assert.equal(enlace.claveNombre('josé   muñoz'), 'josé muñoz');
  assert.notEqual(enlace.claveNombre('Jose Munoz'), enlace.claveNombre('José Muñoz'), 'con y sin tilde no es exacto');
  assert.equal(db.prepare('SELECT nombre_clave(?) AS k').get('ÁNGELA' + NBSP + 'NÚÑEZ').k, 'ángela núñez', 'la misma regla en SQLite');
});

test('Excel, calificar, portal y migración toman «MUÑOZ» = «Muñoz»', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const base = 'Ñ' + rnd();
  const nombre = 'José Muñoz ' + base.charAt(0) + base.slice(1);
  const enMayus = ('JOSÉ' + NBSP + 'MUÑOZ ' + base.toUpperCase());
  const a = await crearAsesor(admin, nombre);

  // Excel: enlaza por id y no avisa
  const rev = await request(app).post('/api/monitoreos/revisar-asesores').set(auth(admin)).send({ campana: CAMP, asesores: [enMayus] });
  assert.equal(rev.status, 200);
  assert.deepEqual(rev.body.sinUsuario, [], 'no es un nombre sin usuario');
  const b = await request(app).post('/api/monitoreos/bulk').set(auth(admin))
    .send({ campana: CAMP, filas: [{ asesor: enMayus, fecha: '2026-10-08', canal: 'LLAMADA', idLlamada: 'b353-' + rnd(), answers: todoSi() }] });
  assert.equal(b.status, 201, JSON.stringify(b.body));
  assert.deepEqual(b.body.sinUsuario, []);
  assert.equal(db.prepare('SELECT asesorUserId FROM monitoreos WHERE campana = ? AND asesor = ?').get(CAMP, enMayus).asesorUserId, a.id);

  // Calificar sin id
  const c = await request(app).post('/api/monitoreos').set(auth(admin))
    .send({ campana: CAMP, asesor: enMayus, fecha: '2026-10-09', canal: 'LLAMADA', answers: todoSi() });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  assert.equal(c.body.asesorUserId, a.id);

  // Portal: un monitoreo viejo SIN id le llega por nombre (y lo puede marcar como visto)
  const viejo = db.prepare(`INSERT INTO monitoreos (campana, asesor, fecha, mes, canal, evaluador, answers, puntaje, createdAt)
    VALUES (?, ?, '2026-10-10', '2026-10', 'LLAMADA', 'Evaluador Prueba', '{}', 88, '2026-10-10 09:00:00')`).run(CAMP, enMayus).lastInsertRowid;
  const mios = await request(app).get('/api/monitoreos/mios').set(auth(a.token));
  assert.ok(mios.body.some((m) => m.id === viejo), 'el portal lo encuentra por nombre');
  assert.equal(mios.body.length, 3);
  const visto = await request(app).put('/api/monitoreos/' + viejo + '/visto').set(auth(a.token));
  assert.equal(visto.status, 200);

  // Migración: lo enlaza por id sin cambiar el texto
  enlace.enlazarExactos(db);
  const row = db.prepare('SELECT asesor, asesorUserId, puntaje FROM monitoreos WHERE id = ?').get(viejo);
  assert.equal(row.asesorUserId, a.id);
  assert.equal(row.asesor, enMayus);
  assert.equal(row.puntaje, 88);
});

test('con y sin tilde no se enlaza solo: queda como sugerencia', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const sufijo = rnd();
  const a = await crearAsesor(admin, 'Ángela Núñez ' + sufijo);
  const sinTilde = 'Angela Nunez ' + sufijo;
  const b = await request(app).post('/api/monitoreos/bulk').set(auth(admin))
    .send({ campana: CAMP, filas: [{ asesor: sinTilde, fecha: '2026-10-11', canal: 'LLAMADA', idLlamada: 't353-' + rnd(), answers: todoSi() }] });
  assert.equal(b.status, 201);
  assert.equal(b.body.sinUsuario.length, 1);
  assert.deepEqual(b.body.sinUsuario[0].sugerencia, { userId: a.id, nombre: 'Ángela Núñez ' + sufijo, tipo: 'mayúsculas, tildes o espacios' });
  assert.equal(db.prepare('SELECT asesorUserId FROM monitoreos WHERE campana = ? AND asesor = ?').get(CAMP, sinTilde).asesorUserId, null);
});

test('la herramienta ya no dice «Ya le llegan por nombre exacto»', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'calidad-enlace.js'), 'utf8');
  assert.ok(!/Ya le llegan por nombre exacto/.test(js));
  assert.match(js, /Mismo nombre que/);
});
