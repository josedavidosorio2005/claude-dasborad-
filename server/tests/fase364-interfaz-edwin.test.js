// fase364-interfaz-edwin.test.js — Fase 364 (pedidos de Edwin, reunión 18/11, bloque B):
//  B1 menú de tarjetas en 3 o 4 columnas en escritorio;
//  B2 «Sugerencias / Tickets» como tarjeta (fuera de la barra superior) con tipos editables por ADMIN;
//  B3 ventanas de módulo en pantalla completa, que solo se cierran con su botón «Cerrar».
// Datos INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');

const PUB = path.join(__dirname, '..', '..', 'public');
const INDEX = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
const CSS = fs.readFileSync(path.join(PUB, 'css', 'styles.css'), 'utf8');
const H = (t) => ({ Authorization: 'Bearer ' + t });
const tk = {};
before(async () => {
  db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password, asesorCampana) VALUES ('Persona Inventada 364', 'f364_ase', 'ASESOR', 1, ?, '{}', ?, 0, 'ORLANT')`)
    .run(bcrypt.hashSync('Clave#2026x', 4), new Date().toISOString());
  tk.admin = await tokenFor('admin', MASTER_PASSWORD);
  tk.ase = await tokenFor('f364_ase', 'Clave#2026x');
});

test('B2: tipos de ticket — cualquiera ve los activos; solo ADMIN crea, renombra y desactiva (Historial)', async () => {
  const r = await request(app).get('/api/tickets/tipos').set(H(tk.ase));
  assert.deepEqual(r.body.tipos.map((t) => t.codigo), ['SUGERENCIA', 'PROBLEMA', 'PREGUNTA']);
  assert.equal(r.body.puedeEditar, false);
  assert.equal((await request(app).post('/api/tickets/tipos').set(H(tk.ase)).send({ nombre: 'Acceso inventado' })).status, 403);
  const c = await request(app).post('/api/tickets/tipos').set(H(tk.admin)).send({ nombre: 'Solicitud de acceso' });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  assert.equal(c.body.tipo.codigo, 'SOLICITUD_DE_ACCESO');
  assert.equal((await request(app).post('/api/tickets/tipos').set(H(tk.admin)).send({ nombre: 'solicitud de acceso' })).status, 409);
  assert.equal((await request(app).post('/api/tickets/tipos').set(H(tk.admin)).send({ nombre: 'x' })).status, 400);
  assert.ok(db.prepare("SELECT 1 FROM historial WHERE accion = 'TICKET_TIPO_CREADO'").get());
  const e = await request(app).put('/api/tickets/tipos/SOLICITUD_DE_ACCESO').set(H(tk.admin)).send({ nombre: 'Accesos y claves' });
  assert.equal(e.status, 200);
  assert.equal(e.body.nombre, 'Accesos y claves');
  assert.equal((await request(app).put('/api/tickets/tipos/NO_EXISTE').set(H(tk.admin)).send({ activo: false })).status, 404);
});

test('B2: un ticket con un tipo nuevo guarda su código (sin tocar la columna vieja) y sale con su nombre; un tipo inactivo no se puede elegir', async () => {
  const t = await request(app).post('/api/tickets').set(H(tk.ase)).send({ tipo: 'SOLICITUD_DE_ACCESO', campana: 'GENERAL', descripcion: 'Texto inventado 364' });
  assert.equal(t.status, 201, JSON.stringify(t.body));
  assert.equal(t.body.ticket.tipo, 'SOLICITUD_DE_ACCESO');
  assert.equal(t.body.ticket.tipoNombre, 'Accesos y claves');
  const fila = db.prepare('SELECT tipo, tipoCodigo FROM tickets WHERE id = ?').get(t.body.ticket.id);
  assert.deepEqual(fila, { tipo: 'SUGERENCIA', tipoCodigo: 'SOLICITUD_DE_ACCESO' });
  const l = await request(app).get('/api/tickets?tipo=SOLICITUD_DE_ACCESO&alcance=todos').set(H(tk.admin));
  assert.ok(l.body.tickets.some((x) => x.id === t.body.ticket.id && x.tipoNombre === 'Accesos y claves'));
  // Desactivar: ya no se ofrece ni se acepta; el ticket viejo conserva el nombre.
  assert.equal((await request(app).put('/api/tickets/tipos/SOLICITUD_DE_ACCESO').set(H(tk.admin)).send({ activo: false })).status, 200);
  assert.ok(!(await request(app).get('/api/tickets/tipos').set(H(tk.ase))).body.tipos.some((x) => x.codigo === 'SOLICITUD_DE_ACCESO'));
  assert.equal((await request(app).post('/api/tickets').set(H(tk.ase)).send({ tipo: 'SOLICITUD_DE_ACCESO', campana: 'GENERAL', descripcion: 'Otro texto' })).status, 400);
  assert.equal((await request(app).get('/api/tickets/' + t.body.ticket.id).set(H(tk.ase))).body.ticket.tipoNombre, 'Accesos y claves');
  // Un ticket de los 3 de siempre sigue igual.
  const v = await request(app).post('/api/tickets').set(H(tk.ase)).send({ tipo: 'PROBLEMA', campana: 'GENERAL', descripcion: 'Problema inventado' });
  assert.deepEqual(db.prepare('SELECT tipo, tipoCodigo FROM tickets WHERE id = ?').get(v.body.ticket.id), { tipo: 'PROBLEMA', tipoCodigo: 'PROBLEMA' });
  // Siempre queda al menos un tipo activo.
  for (const c of ['SUGERENCIA', 'PROBLEMA']) await request(app).put('/api/tickets/tipos/' + c).set(H(tk.admin)).send({ activo: false });
  assert.equal((await request(app).put('/api/tickets/tipos/PREGUNTA').set(H(tk.admin)).send({ activo: false })).status, 400);
  for (const c of ['SUGERENCIA', 'PROBLEMA']) await request(app).put('/api/tickets/tipos/' + c).set(H(tk.admin)).send({ activo: true });
});

test('B2: la tarjeta del menú y los menús laterales abren Tickets; ya no está en la barra superior', () => {
  const L = require('../../public/js/dashboards-logic.js');
  for (const rol of ['ADMIN', 'SUPERVISOR', 'GERENCIA', 'REPORTES', 'CALIDAD', 'CLIENTES_DASH', 'SISTEMAS']) {
    const t = L.dashTarjetasEntrada(rol, rol === 'ADMIN', false);
    assert.equal(t[t.length - 1].key, 'tickets', rol);
    assert.equal(t[t.length - 1].accion, 'ticketsAbrir');
  }
  assert.ok(!/navbar-help-link tk-menu-btn/.test(INDEX));
  assert.match(INDEX, /id="asesor-menu-tickets"/);
  assert.match(INDEX, /id="supervisor-menu-tickets"/);
  assert.match(INDEX, /data-tk-tab="tipos"/);
});

test('B1: en escritorio la cuadrícula de tarjetas tiene 3 columnas (y 4 en pantallas anchas); en el celular, una', () => {
  assert.match(CSS, /@media\(min-width:900px\)\{\s*\.dash-grid\{max-width:1200px;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(CSS, /@media\(min-width:1280px\)\{\.dash-grid\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\);\}\}/);
  assert.match(CSS, /@media\(max-width:520px\)\{\.dash-grid\{grid-template-columns:1fr;\}\}/);
});

test('B3: las ventanas de módulo existen, tienen su botón de cerrar, van en pantalla completa y Escape/clic afuera no las cierran', () => {
  const MH = require('../../public/js/motion-helpers.js');
  assert.ok(MH.VENTANAS_MODULO.length >= 12);
  for (const id of MH.VENTANAS_MODULO) {
    const i = INDEX.indexOf('id="' + id + '"');
    assert.ok(i > 0, id);
    const bloque = INDEX.slice(i, i + 8000);
    assert.ok(/<button[^>]*aria-label="Cerrar[^"]*"[^>]*>/.test(bloque) || bloque.includes('>X Cerrar</button>'), id + ': sin botón de cerrar');
    assert.ok(CSS.includes('#' + id), id + ': sin pantalla completa');
    assert.equal(MH.esVentanaModulo(id), true);
  }
  assert.equal(MH.esVentanaModulo('modal-user'), false, 'los diálogos chicos siguen cerrando con Escape');
  // Al salir de sesión y con «Ver como» se siguen cerrando todas.
  const CV = require('../../public/js/cerrar-ventanas.js');
  for (const id of MH.VENTANAS_MODULO) assert.ok(/-overlay$/.test(id) || id.startsWith('modal-'), id);
  assert.match(CV.CERRAR_VENTANAS_SELECTOR || '', /modal-overlay\.show/);
});
