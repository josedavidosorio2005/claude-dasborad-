// fase356-tickets.test.js — Fase 356: «Sugerencias / Tickets». Datos SINTETICOS.
//  - cualquier usuario con sesión crea (tipo, campaña suya o «General», 1 a 2.000 caracteres);
//  - cada quien ve solo los suyos (ajeno: 404); ADMIN y REPORTES ven todos;
//  - estado: solo ADMIN y REPORTES; responder: ellos y el autor en el suyo;
//  - borrar: solo ADMIN, definitivo, y el Historial no guarda la descripción;
//  - contador de «Nuevo» solo para ADMIN y REPORTES; el autor no edita.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');

const H = (t) => ({ Authorization: 'Bearer ' + t });
function crear(user, rol, perms, extra) {
  db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password, asesorCampana) VALUES (?,?,?,1,?,?,?,0,?)`)
    .run('Persona ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), new Date().toISOString(), (extra && extra.asesorCampana) || null);
  return tokenFor(user, 'Clave#2026x');
}
const tk = {};
before(async () => {
  tk.master = await tokenFor('admin', MASTER_PASSWORD);
  tk.admin = await crear('f356_admin', 'ADMIN', {});
  tk.rep = await crear('f356_rep', 'REPORTES', {});
  tk.cliO = await crear('f356_cli_o', 'CLIENTES_DASH', { ClientesDash: true, cliente_ORLANT: true });
  tk.cliM = await crear('f356_cli_m', 'CLIENTES_DASH', { ClientesDash: true, cliente_MOBILIZE: true });
  tk.sup = await crear('f356_sup', 'SUPERVISOR', { supervisa_ORLANT: true });
  tk.cal = await crear('f356_cal', 'CALIDAD', { campana_ORLANT: true });
  tk.ase = await crear('f356_ase', 'ASESOR', {}, { asesorCampana: 'ORLANT' });
});

const nuevo = (t, body) => request(app).post('/api/tickets').set(H(t)).send(body);

test('crear: cualquier rol con sesión; campaña suya o General; sin sesión 401', async () => {
  for (const k of ['master', 'admin', 'rep', 'cliO', 'cliM', 'sup', 'cal', 'ase']) {
    const r = await nuevo(tk[k], { tipo: 'SUGERENCIA', campana: 'GENERAL', descripcion: 'Idea de ' + k });
    assert.equal(r.status, 201, k + ' ' + JSON.stringify(r.body));
    assert.equal(r.body.ticket.estado, 'NUEVO');
    assert.equal(r.body.ticket.esMio, true);
  }
  assert.equal((await request(app).post('/api/tickets').send({ tipo: 'SUGERENCIA', campana: 'GENERAL', descripcion: 'x' })).status, 401);
  // Campañas: la propia sí, la ajena no.
  assert.equal((await nuevo(tk.cliO, { tipo: 'PROBLEMA', campana: 'ORLANT', descripcion: 'No carga' })).status, 201);
  const ajena = await nuevo(tk.cliO, { tipo: 'PROBLEMA', campana: 'MOBILIZE', descripcion: 'No carga' });
  assert.equal(ajena.status, 400);
  assert.equal((await nuevo(tk.ase, { tipo: 'PREGUNTA', campana: 'ORLANT', descripcion: '¿Cómo veo mi nota?' })).status, 201);
  assert.equal((await nuevo(tk.sup, { tipo: 'PROBLEMA', campana: 'ORLANT', descripcion: 'Falta un dato' })).status, 201);
  assert.equal((await nuevo(tk.cliO, { tipo: 'PROBLEMA', campana: 'NO EXISTE', descripcion: 'x' })).status, 400);
});

test('lista de campañas: General primero y solo las suyas', async () => {
  const r = await request(app).get('/api/tickets/campanas').set(H(tk.cliO));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.campanas[0], { valor: 'GENERAL', etiqueta: 'General (plataforma)' });
  const v = r.body.campanas.map((c) => c.valor);
  assert.ok(v.includes('ORLANT') && !v.includes('MOBILIZE'));
  assert.equal(r.body.gestor, false);
  assert.equal(r.body.puedeBorrar, false);
  const rep = (await request(app).get('/api/tickets/campanas').set(H(tk.rep))).body;
  assert.equal(rep.gestor, true);
  assert.equal(rep.puedeBorrar, false);
  const adm = (await request(app).get('/api/tickets/campanas').set(H(tk.admin))).body;
  assert.equal(adm.puedeBorrar, true);
});

test('validación: tipo, campaña y descripción de 1 a 2.000 caracteres; campos extra rechazados', async () => {
  assert.equal((await nuevo(tk.cliO, { tipo: 'OTRO', campana: 'GENERAL', descripcion: 'x' })).status, 400);
  assert.equal((await nuevo(tk.cliO, { tipo: 'SUGERENCIA', campana: '', descripcion: 'x' })).status, 400);
  assert.equal((await nuevo(tk.cliO, { tipo: 'SUGERENCIA', campana: 'GENERAL', descripcion: '   ' })).status, 400);
  assert.equal((await nuevo(tk.cliO, { tipo: 'SUGERENCIA', campana: 'GENERAL', descripcion: 'a'.repeat(2000) })).status, 201);
  const largo = await nuevo(tk.cliO, { tipo: 'SUGERENCIA', campana: 'GENERAL', descripcion: 'a'.repeat(2001) });
  assert.equal(largo.status, 400);
  assert.match(largo.body.error, /2000/);
  assert.equal((await nuevo(tk.cliO, { tipo: 'SUGERENCIA', campana: 'GENERAL', descripcion: 'x', estado: 'RESUELTO' })).status, 400);
  assert.equal((await nuevo(tk.cliO, { tipo: 'SUGERENCIA', campana: 'GENERAL', descripcion: 'x', adjunto: 'data:image/png;base64,AA' })).status, 400);
});

test('ver: cada quien solo los suyos (ajeno 404); ADMIN y REPORTES todos', async () => {
  const deO = (await nuevo(tk.cliO, { tipo: 'PROBLEMA', campana: 'ORLANT', descripcion: 'Privado de cliO' })).body.ticket;
  const listaM = (await request(app).get('/api/tickets').set(H(tk.cliM))).body.tickets;
  assert.ok(listaM.length > 0 && listaM.every((t) => t.esMio));
  assert.ok(!listaM.some((t) => t.id === deO.id));
  assert.equal((await request(app).get('/api/tickets/' + deO.id).set(H(tk.cliM))).status, 404);
  assert.equal((await request(app).get('/api/tickets/' + deO.id).set(H(tk.sup))).status, 404);
  assert.equal((await request(app).get('/api/tickets?alcance=todos').set(H(tk.cliO))).status, 403);
  assert.equal((await request(app).get('/api/tickets/' + deO.id).set(H(tk.cliO))).status, 200);
  for (const k of ['master', 'admin', 'rep']) {
    const todos = (await request(app).get('/api/tickets?alcance=todos').set(H(tk[k]))).body.tickets;
    assert.ok(todos.some((t) => t.id === deO.id), k);
    assert.equal((await request(app).get('/api/tickets/' + deO.id).set(H(tk[k]))).status, 200, k);
    const mios = (await request(app).get('/api/tickets?alcance=mios').set(H(tk[k]))).body.tickets;
    assert.ok(mios.every((t) => t.esMio), k);
  }
  // Lo que sale al navegador no trae ids ni usuarios internos.
  const uno = (await request(app).get('/api/tickets/' + deO.id).set(H(tk.rep))).body.ticket;
  assert.equal(uno.autorId, undefined);
  assert.equal(uno.autorUser, undefined);
  assert.equal(uno.autorNombre, 'Persona f356_cli_o');
  // Filtros del gestor.
  const filtrados = (await request(app).get('/api/tickets?alcance=todos&tipo=PROBLEMA&campana=ORLANT&estado=NUEVO').set(H(tk.rep))).body.tickets;
  assert.ok(filtrados.length > 0 && filtrados.every((t) => t.tipo === 'PROBLEMA' && t.campana === 'ORLANT' && t.estado === 'NUEVO'));
  assert.equal((await request(app).get('/api/tickets/abc').set(H(tk.admin))).status, 404);
  assert.equal((await request(app).get('/api/tickets/999999').set(H(tk.admin))).status, 404);
});

test('estado: solo ADMIN y REPORTES; el autor no edita ni cancela', async () => {
  const t = (await nuevo(tk.cliO, { tipo: 'PREGUNTA', campana: 'GENERAL', descripcion: '¿Dónde veo octubre?' })).body.ticket;
  const url = '/api/tickets/' + t.id + '/estado';
  assert.equal((await request(app).put(url).set(H(tk.cliO)).send({ estado: 'RESUELTO' })).status, 403);
  assert.equal((await request(app).put(url).set(H(tk.cliM)).send({ estado: 'RESUELTO' })).status, 404);
  assert.equal((await request(app).put(url).set(H(tk.sup)).send({ estado: 'RESUELTO' })).status, 404);
  assert.equal((await request(app).put(url).set(H(tk.rep)).send({ estado: 'CERRADO' })).status, 400);
  const r1 = await request(app).put(url).set(H(tk.rep)).send({ estado: 'EN_REVISION' });
  assert.equal(r1.status, 200);
  assert.equal(r1.body.ticket.estado, 'EN_REVISION');
  assert.equal((await request(app).put(url).set(H(tk.master)).send({ estado: 'RESUELTO' })).body.ticket.estado, 'RESUELTO');
  // No hay ruta para editar la descripción.
  const ed = await request(app).put('/api/tickets/' + t.id).set(H(tk.cliO)).send({ descripcion: 'cambio' });
  assert.ok(ed.status === 404 || ed.status === 405, String(ed.status));
  assert.equal((await request(app).get('/api/tickets/' + t.id).set(H(tk.cliO))).body.ticket.descripcion, '¿Dónde veo octubre?');
});

test('hilo: el gestor y el autor contestan; nadie más', async () => {
  const t = (await nuevo(tk.cliO, { tipo: 'PROBLEMA', campana: 'ORLANT', descripcion: 'Gráfica vacía' })).body.ticket;
  const url = '/api/tickets/' + t.id + '/respuestas';
  assert.equal((await request(app).post(url).set(H(tk.rep)).send({ texto: 'Lo revisamos' })).status, 201);
  assert.equal((await request(app).post(url).set(H(tk.cliO)).send({ texto: 'Gracias' })).status, 201);
  assert.equal((await request(app).post(url).set(H(tk.cliM)).send({ texto: 'Intruso' })).status, 404);
  assert.equal((await request(app).post(url).set(H(tk.sup)).send({ texto: 'Intruso' })).status, 404);
  assert.equal((await request(app).post(url).set(H(tk.admin)).send({ texto: '' })).status, 400);
  assert.equal((await request(app).post(url).set(H(tk.admin)).send({ texto: 'b'.repeat(2001) })).status, 400);
  const d = (await request(app).get('/api/tickets/' + t.id).set(H(tk.cliO))).body;
  assert.deepEqual(d.respuestas.map((r) => [r.texto, r.esMia]), [['Lo revisamos', false], ['Gracias', true]]);
  assert.equal(d.respuestas[0].autorRol, 'REPORTES');
  assert.equal(d.ticket.respuestas, 2);
});

test('contador de «Nuevo»: solo ADMIN y REPORTES', async () => {
  for (const k of ['cliO', 'sup', 'cal', 'ase']) assert.equal((await request(app).get('/api/tickets/contador').set(H(tk[k]))).status, 403, k);
  const n = (await request(app).get('/api/tickets/contador').set(H(tk.rep))).body.nuevos;
  const real = db.prepare("SELECT COUNT(*) AS n FROM tickets WHERE estado = 'NUEVO'").get().n;
  assert.equal(n, real);
  assert.equal((await request(app).get('/api/tickets/contador').set(H(tk.master))).body.nuevos, real);
});

test('borrar: solo ADMIN, definitivo (con respuestas) y el Historial sin la descripción', async () => {
  const t = (await nuevo(tk.cliO, { tipo: 'SUGERENCIA', campana: 'ORLANT', descripcion: 'TEXTO-SECRETO-356' })).body.ticket;
  await request(app).post('/api/tickets/' + t.id + '/respuestas').set(H(tk.rep)).send({ texto: 'RESPUESTA-SECRETA-356' });
  for (const k of ['cliO', 'rep']) assert.equal((await request(app).delete('/api/tickets/' + t.id).set(H(tk[k]))).status, 403, k);
  assert.equal((await request(app).delete('/api/tickets/' + t.id).set(H(tk.cliM))).status, 404);
  assert.equal((await request(app).delete('/api/tickets/' + t.id).set(H(tk.admin))).status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tickets WHERE id = ?').get(t.id).n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tickets_respuestas WHERE ticketId = ?').get(t.id).n, 0);
  assert.equal((await request(app).get('/api/tickets/' + t.id).set(H(tk.admin))).status, 404);
  const h = db.prepare("SELECT * FROM historial WHERE accion = 'TICKET_BORRADO' ORDER BY id DESC").get();
  assert.ok(h, 'falta el registro en Historial');
  assert.match(h.detalle, new RegExp('ticket #' + t.id + ' \\(Sugerencia, ORLANT\\) borrado'));
  assert.match(h.actor, /f356_admin/);
  const todo = JSON.stringify(db.prepare('SELECT * FROM historial').all());
  assert.ok(!todo.includes('TEXTO-SECRETO-356') && !todo.includes('RESPUESTA-SECRETA-356'));
});

test('respuestas sin caché y texto guardado tal cual (se escapa al pintar)', async () => {
  const r = await nuevo(tk.cliO, { tipo: 'SUGERENCIA', campana: 'GENERAL', descripcion: '<img src=x onerror=alert(1)>' });
  assert.equal(r.status, 201);
  assert.equal(r.headers['cache-control'], 'no-store');
  assert.equal(r.body.ticket.descripcion, '<img src=x onerror=alert(1)>');
});
