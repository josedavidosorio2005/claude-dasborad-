// fase353-enlazar-monitoreos.test.js — Fase 353 (reporte de Edwin, 13/11): una asesora veia 0 en
// su Portal Asesor porque sus monitoreos (carga por Excel, sin asesorUserId) tenian su nombre con
// una letra de diferencia. Todo con datos inventados.
//  - El parecido solo SUGIERE: nunca enlaza solo.
//  - La carga por Excel y el calificar enlazan por id cuando el nombre es EXACTO.
//  - «Enlazar monitoreos a usuario» (solo admin): enlaza un grupo al usuario elegido, cambia el
//    nombre al del usuario y deja igual nota, respuestas, fechas y updatedAt; queda en el Historial;
//    se puede deshacer.
//  - La migracion de exactos solo toma coincidencias exactas con UN unico usuario activo.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const { PLANTILLAS } = require('../calidad-plantillas-seed.js');
const enlace = require('../enlace-asesor');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const CAMP = 'MOBILIZE';
const rnd = () => Math.random().toString(36).slice(2, 7);
const todoSi = () => Object.fromEntries(PLANTILLAS.find((p) => p.campana === CAMP).items.map((it) => [String(it.n), 'SI']));

async function crearAsesor(admin, nombre, campana) {
  const user = 'ase353_' + rnd();
  const r = await request(app).post('/api/users').set(auth(admin))
    .send({ nombre, user, password: 'ClaveAsesor1234', rol: 'ASESOR', perms: {}, asesorCampana: campana || CAMP });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { id: r.body.id, user, token: await tokenFor(user, 'ClaveAsesor1234') };
}
async function bulk(admin, filas) {
  const r = await request(app).post('/api/monitoreos/bulk').set(auth(admin)).send({ campana: CAMP, filas });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
}
const fila = (asesor, fecha) => ({ asesor, fecha, canal: 'LLAMADA', idLlamada: 'f353-' + rnd(), answers: todoSi() });

test('el parecido se clasifica pero solo sugiere; con empate no sugiere a nadie', () => {
  assert.equal(enlace.nivelParecido('Ana Villa Prueba', 'ana villa prueba '), 0);
  const u = [{ id: 1, nombre: 'Ana Villa Prueba' }, { id: 2, nombre: 'Bruno Otro Nombre' }];
  assert.deepEqual(enlace.sugerencia('Ana Vila Prueba', u), { userId: 1, nombre: 'Ana Villa Prueba', tipo: '1 letra' });
  assert.equal(enlace.sugerencia('Ána Villa Prueba', u).tipo, 'mayúsculas, tildes o espacios');
  assert.equal(enlace.sugerencia('Prueba Ana Villa', u).tipo, 'orden de los nombres');
  assert.equal(enlace.sugerencia('Carla Distinta Ruiz', u), null);
  assert.equal(enlace.sugerencia('Ana Vila Prueba', u.concat([{ id: 3, nombre: 'Ana Vilma Prueba' }])), null, 'empate de 1 letra: sin sugerencia');
});

test('la carga por Excel enlaza por id el nombre exacto y avisa del parecido sin enlazarlo', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const nombre = 'Asesora Villa ' + rnd();
  const a = await crearAsesor(admin, nombre);
  const parecido = nombre.replace('Villa', 'Vila');

  // Vista previa: solo lee.
  const antes = db.prepare('SELECT COUNT(*) AS n FROM monitoreos').get().n;
  const rev = await request(app).post('/api/monitoreos/revisar-asesores').set(auth(admin)).send({ campana: CAMP, asesores: [nombre, parecido, parecido] });
  assert.equal(rev.status, 200, JSON.stringify(rev.body));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM monitoreos').get().n, antes, 'revisar no escribe');
  assert.equal(rev.body.sinUsuario.length, 1);
  assert.equal(rev.body.sinUsuario[0].asesor, parecido);
  assert.equal(rev.body.sinUsuario[0].filas, 2);
  assert.deepEqual(rev.body.sinUsuario[0].sugerencia, { userId: a.id, nombre, tipo: '1 letra' });

  const r = await bulk(admin, [fila(nombre, '2026-10-02'), fila(parecido, '2026-10-03')]);
  assert.equal(r.insertadas, 2);
  assert.equal(r.sinUsuario.length, 1);
  const exacto = db.prepare('SELECT asesorUserId FROM monitoreos WHERE campana = ? AND asesor = ?').get(CAMP, nombre);
  const casi = db.prepare('SELECT asesorUserId FROM monitoreos WHERE campana = ? AND asesor = ?').get(CAMP, parecido);
  assert.equal(exacto.asesorUserId, a.id, 'exacto: enlazado por id');
  assert.equal(casi.asesorUserId, null, 'parecido: nunca se enlaza solo');
  const mios = await request(app).get('/api/monitoreos/mios').set(auth(a.token));
  assert.equal(mios.body.length, 1, 'la asesora solo ve el exacto');
});

test('revisar exige poder evaluar la campaña', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const a = await crearAsesor(admin, 'Asesor Sin Permiso ' + rnd());
  const r = await request(app).post('/api/monitoreos/revisar-asesores').set(auth(a.token)).send({ campana: CAMP, asesores: ['x'] });
  assert.equal(r.status, 403);
});

test('calificar sin id enlaza por nombre exacto', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const nombre = 'Asesor Calificado ' + rnd();
  const a = await crearAsesor(admin, nombre);
  const r = await request(app).post('/api/monitoreos').set(auth(admin))
    .send({ campana: CAMP, asesor: nombre.toUpperCase() + ' ', fecha: '2026-10-05', canal: 'LLAMADA', answers: todoSi() });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.asesorUserId, a.id);
});

test('«Enlazar monitoreos a usuario»: solo admin, cambia el enlace y el nombre, nada más; Historial y deshacer', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const nombre = 'Asesora Mallo ' + rnd();
  const a = await crearAsesor(admin, nombre);
  const otra = await crearAsesor(admin, 'Asesora Otra Campana ' + rnd(), 'ORLANT');
  const escrito = nombre.replace('Mallo', 'Malo');
  await bulk(admin, [fila(escrito, '2026-09-10'), fila(escrito, '2026-09-11'), fila(escrito, '2026-10-01')]);
  const antes = db.prepare('SELECT id, puntaje, answers, fecha, mes, evaluador, updatedAt, createdAt FROM monitoreos WHERE campana = ? AND asesor = ? ORDER BY id').all(CAMP, escrito);
  assert.equal(antes.length, 3);
  const totalCamp = db.prepare('SELECT COUNT(*) AS n, ROUND(AVG(puntaje), 4) AS p FROM monitoreos WHERE campana = ?').get(CAMP);
  assert.equal((await request(app).get('/api/monitoreos/mios').set(auth(a.token))).body.length, 0, 'antes: 0 en el portal');

  // Solo el administrador
  const cal = await request(app).get('/api/calidad/enlace?campana=' + CAMP).set(auth(a.token));
  assert.equal(cal.status, 403);
  assert.equal((await request(app).post('/api/calidad/enlace').set(auth(a.token)).send({ campana: CAMP, asesor: escrito, userId: a.id })).status, 403);

  const lista = await request(app).get('/api/calidad/enlace?campana=' + CAMP).set(auth(admin));
  assert.equal(lista.status, 200);
  const g = lista.body.pendientes.find((x) => x.asesor === escrito);
  assert.ok(g, 'el grupo aparece');
  assert.equal(g.total, 3);
  assert.deepEqual(g.meses, { '2026-09': 2, '2026-10': 1 });
  assert.deepEqual(g.sugerencia, { userId: a.id, nombre, tipo: '1 letra' });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM monitoreos WHERE campana = ? AND asesor = ? AND asesorUserId IS NULL').get(CAMP, escrito).n, 3, 'listar no enlaza nada');

  // Usuario de otra campaña: no
  const mal = await request(app).post('/api/calidad/enlace').set(auth(admin)).send({ campana: CAMP, asesor: escrito, userId: otra.id });
  assert.equal(mal.status, 400);

  const ok = await request(app).post('/api/calidad/enlace').set(auth(admin)).send({ campana: CAMP, asesor: escrito, userId: a.id });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.enlazados, 3);
  const despues = db.prepare(`SELECT id, asesor, asesorUserId, puntaje, answers, fecha, mes, evaluador, updatedAt, createdAt FROM monitoreos WHERE id IN (${antes.map(() => '?').join(',')}) ORDER BY id`).all(...antes.map((m) => m.id));
  despues.forEach((d, i) => {
    assert.equal(d.asesorUserId, a.id);
    assert.equal(d.asesor, nombre, 'el nombre pasa a ser el del usuario');
    for (const k of ['puntaje', 'answers', 'fecha', 'mes', 'evaluador', 'updatedAt', 'createdAt']) assert.equal(d[k], antes[i][k], k + ' no cambia');
  });
  assert.deepEqual(db.prepare('SELECT COUNT(*) AS n, ROUND(AVG(puntaje), 4) AS p FROM monitoreos WHERE campana = ?').get(CAMP), totalCamp, 'conteo y promedio de la campaña iguales');
  assert.equal((await request(app).get('/api/monitoreos/mios').set(auth(a.token))).body.length, 3, 'ahora le llegan los 3');
  const h = db.prepare("SELECT nombre, rol, detalle FROM historial WHERE accion = 'MONITOREOS_ENLAZADOS' ORDER BY id DESC LIMIT 1").get();
  assert.equal(h.nombre, nombre);
  assert.equal(h.rol, CAMP);
  assert.match(h.detalle, /3 monitoreo\(s\) enlazado\(s\)/);
  assert.match(h.detalle, new RegExp('antes decían «' + escrito + '»'));

  // Ya no hay nada sin usuario con ese texto
  assert.equal((await request(app).post('/api/calidad/enlace').set(auth(admin)).send({ campana: CAMP, asesor: escrito, userId: a.id })).status, 404);

  // Deshacer
  const des = await request(app).post('/api/calidad/enlace/revertir').set(auth(admin)).send({ campana: CAMP, asesor: escrito, ids: ok.body.ids });
  assert.equal(des.status, 200, JSON.stringify(des.body));
  const vuelta = db.prepare(`SELECT asesor, asesorUserId, puntaje FROM monitoreos WHERE id IN (${antes.map(() => '?').join(',')})`).all(...antes.map((m) => m.id));
  vuelta.forEach((v) => { assert.equal(v.asesor, escrito); assert.equal(v.asesorUserId, null); });
  assert.ok(db.prepare("SELECT 1 FROM historial WHERE accion = 'MONITOREOS_ENLACE_DESHECHO'").get());
  assert.equal((await request(app).post('/api/calidad/enlace/revertir').set(auth(admin)).send({ campana: CAMP, asesor: escrito, ids: ok.body.ids })).status, 409, 'deshacer dos veces: no');
  assert.equal((await request(app).post('/api/calidad/enlace/revertir').set(auth(a.token)).send({ campana: CAMP, asesor: escrito, ids: ok.body.ids })).status, 403);
});

test('migración de exactos: solo un único usuario activo con el mismo nombre; nunca parecidos', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const unico = 'Asesor Unico ' + rnd();
  const doble = 'Asesor Doble ' + rnd();
  const a = await crearAsesor(admin, unico);
  await crearAsesor(admin, doble);
  await crearAsesor(admin, doble);
  const ins = db.prepare(`INSERT INTO monitoreos (campana, asesor, fecha, mes, canal, evaluador, answers, puntaje, createdAt)
    VALUES (?, ?, '2026-10-07', '2026-10', 'LLAMADA', 'Evaluador Prueba', '{}', 90, '2026-10-07 10:00:00')`);
  const idExacto = ins.run(CAMP, '  ' + unico.toUpperCase() + ' ').lastInsertRowid;
  const idParecido = ins.run(CAMP, unico.slice(0, -1)).lastInsertRowid;
  const idDoble = ins.run(CAMP, doble).lastInsertRowid;
  const idOtraCamp = ins.run('ORLANT', unico).lastInsertRowid;

  const cuenta = enlace.contarExactos(db).reduce((s, r) => s + r.n, 0);
  const n = enlace.enlazarExactos(db);
  assert.equal(n, cuenta, 'el dry-run cuenta lo mismo que enlaza');
  const g = (id) => db.prepare('SELECT asesor, asesorUserId, puntaje FROM monitoreos WHERE id = ?').get(id);
  assert.equal(g(idExacto).asesorUserId, a.id);
  assert.equal(g(idExacto).asesor, '  ' + unico.toUpperCase() + ' ', 'el texto no cambia');
  assert.equal(g(idParecido).asesorUserId, null, 'parecido: no');
  assert.equal(g(idDoble).asesorUserId, null, 'dos usuarios con ese nombre: no');
  assert.equal(g(idOtraCamp).asesorUserId, null, 'otra campaña: no');
  assert.equal(enlace.enlazarExactos(db), 0, 'idempotente');
});
