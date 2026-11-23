// faseTK-ruta-adjunto.test.js — pedido 7 de Edwin (reunión 23/11/2026): en Tickets, «Ruta de ingreso»
// (texto opcional) y 1 adjunto opcional, imagen (PNG/JPG) o PDF de hasta 3 MB, como en el Inventario de
// sistemas. Archivos SINTETICOS (bytes armados aquí, nunca archivos reales).
//  - el tipo sale del contenido (firma), no de la extensión: un .png que es HTML se rechaza;
//  - más de 3 MB, base64 inválido o dos adjuntos: 400;
//  - descargar: autor y gestor sí; otro usuario 404 (igual que ver el ticket); siempre como descarga,
//    con su tipo real, nosniff y sandbox;
//  - la lista solo dice que hay adjunto (nunca el contenido); borrar el ticket borra el adjunto.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor } = require('./helpers');

const H = (t) => ({ Authorization: 'Bearer ' + t });
function crear(user, rol, perms, extra) {
  db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password, asesorCampana) VALUES (?,?,?,1,?,?,?,0,?)`)
    .run('Persona ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), new Date().toISOString(), (extra && extra.asesorCampana) || null);
  return tokenFor(user, 'Clave#2026x');
}
const tk = {};
before(async () => {
  tk.admin = await crear('ftk_admin', 'ADMIN', {});
  tk.rep = await crear('ftk_rep', 'REPORTES', {});
  tk.ase = await crear('ftk_ase', 'ASESOR', {}, { asesorCampana: 'MOBILIZE' });
  tk.ase2 = await crear('ftk_ase2', 'ASESOR', {}, { asesorCampana: 'MOBILIZE' });
});

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 7)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 3)]);
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(200, 32)]);
const b64 = (b) => b.toString('base64');
const base = { tipo: 'PROBLEMA', campana: 'GENERAL', descripcion: 'No carga la pestaña' };
const nuevo = (t, extra) => request(app).post('/api/tickets').set(H(t)).send(Object.assign({}, base, extra));

test('ruta de ingreso: opcional, se guarda limpia y sale en el detalle; más de 200 caracteres 400', async () => {
  const sin = await nuevo(tk.ase, {});
  assert.equal(sin.status, 201);
  assert.equal(sin.body.ticket.rutaIngreso, null);
  assert.equal(sin.body.ticket.adjunto, null);
  const con = await nuevo(tk.ase, { rutaIngreso: '  Dashboard › MOBILIZE › Flujo  ' });
  assert.equal(con.status, 201);
  assert.equal(con.body.ticket.rutaIngreso, 'Dashboard › MOBILIZE › Flujo');
  const det = await request(app).get('/api/tickets/' + con.body.ticket.id).set(H(tk.admin));
  assert.equal(det.body.ticket.rutaIngreso, 'Dashboard › MOBILIZE › Flujo');
  assert.equal((await nuevo(tk.ase, { rutaIngreso: 'x'.repeat(201) })).status, 400);
  assert.equal((await nuevo(tk.ase, { rutaIngreso: 5 })).status, 400);
  assert.equal((await nuevo(tk.ase, { rutaIngreso: '   ' })).body.ticket.rutaIngreso, null);
});

test('adjunto: PNG, JPG y PDF reales sí; el tipo sale del contenido y el nombre se limpia', async () => {
  for (const [buf, tipo, ext] of [[PNG, 'image/png', 'png'], [JPG, 'image/jpeg', 'jpg'], [PDF, 'application/pdf', 'pdf']]) {
    const r = await nuevo(tk.ase, { adjunto: { nombre: '../../captura <b>error</b>.' + ext, datos: b64(buf) } });
    assert.equal(r.status, 201, tipo + ' ' + JSON.stringify(r.body));
    assert.equal(r.body.ticket.adjunto.tipo, tipo);
    assert.equal(r.body.ticket.adjunto.bytes, buf.length);
    assert.doesNotMatch(r.body.ticket.adjunto.nombre, /[<>/\\]/);
    assert.ok(r.body.ticket.adjunto.nombre.endsWith('.' + ext));
  }
  // Un PDF con nombre .png queda como PDF (manda el contenido).
  const cruzado = await nuevo(tk.ase, { adjunto: { nombre: 'foto.png', datos: b64(PDF) } });
  assert.equal(cruzado.body.ticket.adjunto.tipo, 'application/pdf');
  assert.equal(cruzado.body.ticket.adjunto.nombre, 'foto.pdf');
});

test('adjunto inválido: HTML disfrazado, vacío, base64 roto, más de 3 MB, forma rara → 400 y no se crea nada', async () => {
  const antes = db.prepare('SELECT COUNT(*) n FROM tickets').get().n;
  const malos = [
    { nombre: 'x.png', datos: b64(Buffer.from('<html><script>alert(1)</script></html>')) },
    { nombre: 'x.png', datos: b64(Buffer.from('GIF89a' + 'x'.repeat(100))) },
    { nombre: 'x.pdf', datos: '' },
    { nombre: 'x.pdf', datos: 'no es base64 !!' },
    { nombre: 'x.pdf', datos: b64(Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(3 * 1024 * 1024, 1)])) },
    { nombre: 'x.pdf', datos: b64(PDF), extra: 1 },
    'data:image/png;base64,' + b64(PNG),
    [{ nombre: 'a.png', datos: b64(PNG) }, { nombre: 'b.png', datos: b64(PNG) }],
  ];
  for (const adjunto of malos) {
    const r = await nuevo(tk.ase, { adjunto });
    assert.equal(r.status, 400, JSON.stringify(adjunto).slice(0, 60) + ' → ' + r.status);
  }
  assert.equal(db.prepare('SELECT COUNT(*) n FROM tickets').get().n, antes);
});

test('descargar: autor y gestores sí (como descarga, tipo real, nosniff, sandbox); otro usuario 404', async () => {
  const t = (await nuevo(tk.ase, { adjunto: { nombre: 'pantallazo.png', datos: b64(PNG) } })).body.ticket;
  for (const k of ['ase', 'admin', 'rep']) {
    const r = await request(app).get('/api/tickets/' + t.id + '/adjunto').set(H(tk[k])).buffer(true).parse((res, cb) => { const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); });
    assert.equal(r.status, 200, k);
    assert.equal(r.headers['content-type'], 'image/png');
    assert.match(r.headers['content-disposition'], /^attachment;/);
    assert.equal(r.headers['x-content-type-options'], 'nosniff');
    assert.match(r.headers['content-security-policy'], /sandbox/);
    assert.equal(r.headers['cache-control'], 'no-store');
    assert.ok(Buffer.compare(r.body, PNG) === 0, k + ': mismos bytes');
  }
  assert.equal((await request(app).get('/api/tickets/' + t.id + '/adjunto').set(H(tk.ase2))).status, 404);
  assert.equal((await request(app).get('/api/tickets/' + t.id + '/adjunto')).status, 401);
  const sinAdj = (await nuevo(tk.ase, {})).body.ticket;
  assert.equal((await request(app).get('/api/tickets/' + sinAdj.id + '/adjunto').set(H(tk.ase))).status, 404);
  assert.equal((await request(app).get('/api/tickets/abc/adjunto').set(H(tk.admin))).status, 404);
});

test('la lista solo dice que hay adjunto; borrar el ticket borra el adjunto', async () => {
  const t = (await nuevo(tk.ase, { adjunto: { nombre: 'informe.pdf', datos: b64(PDF) } })).body.ticket;
  const lista = (await request(app).get('/api/tickets?alcance=mios').set(H(tk.ase))).body.tickets;
  const fila = lista.find((x) => x.id === t.id);
  assert.deepEqual(fila.adjunto, { tipo: 'application/pdf' });
  assert.ok(!JSON.stringify(lista).includes(b64(PDF).slice(0, 40)));
  assert.equal((await request(app).delete('/api/tickets/' + t.id).set(H(tk.admin))).status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM tickets_adjuntos WHERE ticketId = ?').get(t.id).n, 0);
});

test('un ticket con adjunto de casi 3 MB cabe en el límite del cuerpo (no 413)', async () => {
  const grande = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(3 * 1024 * 1024 - 20, 1)]);
  const r = await nuevo(tk.ase, { adjunto: { nombre: 'grande.pdf', datos: b64(grande) } });
  assert.equal(r.status, 201, String(r.status));
  assert.equal(r.body.ticket.adjunto.bytes, grande.length);
});

test('interfaz: campos opcionales, accept de imagen/PDF, aviso temprano y todo por textContent', () => {
  const PUB = path.join(__dirname, '..', '..', 'public');
  const index = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  assert.match(index, /<input type="text" id="tk-ruta" maxlength="200"/);
  assert.match(index, /<input type="file" id="tk-adjunto" accept="image\/png,image\/jpeg,application\/pdf/);
  assert.match(index, /id="tk-det-ruta"/);
  assert.match(index, /onclick="ticketsDescargarAdjunto\(\)"/);
  const L = require(path.join(PUB, 'js', 'tickets-logic.js'));
  assert.equal(L.ticketsAdjuntoError({ name: 'a.png', type: 'image/png', size: 10 }), '');
  assert.equal(L.ticketsAdjuntoError({ name: 'a.pdf', type: 'application/pdf', size: 3 * 1024 * 1024 }), '');
  assert.match(L.ticketsAdjuntoError({ name: 'a.pdf', type: 'application/pdf', size: 3 * 1024 * 1024 + 1 }), /3 MB/);
  assert.match(L.ticketsAdjuntoError({ name: 'a.docx', type: 'application/msword', size: 10 }), /PNG o JPG/);
  assert.match(L.ticketsAdjuntoError({ name: 'a.png', type: 'image/png', size: 0 }), /vacío/);
  assert.equal(L.ticketsTamano(500), '500 B');
  assert.equal(L.ticketsTamano(2048), '2 KB');
  assert.equal(L.ticketsTamano(1.5 * 1024 * 1024), '1,5 MB');
  assert.match(L.ticketsListaHtml([{ id: 1, tipo: 'PROBLEMA', campana: 'GENERAL', descripcion: 'x', estado: 'NUEVO', createdAt: '2026-11-23T10:00:00Z', respuestas: 0, adjunto: { tipo: 'image/png' } }], false), /con adjunto/);
  const ui = fs.readFileSync(path.join(PUB, 'js', 'tickets.js'), 'utf8');
  assert.match(ui, /_tkEl\('tk-det-ruta'\)\.textContent = /);
  assert.match(ui, /_tkEl\('tk-det-adj-nombre'\)\.textContent = /);
  assert.doesNotMatch(ui, /tk-det-(ruta|adj-nombre)'\)\.innerHTML/);
});

test('tope: 20 adjuntos por persona en 24 horas (429); sin adjunto sigue pudiendo; otra persona no se afecta', async () => {
  const t = await crear('ftk_tope', 'ASESOR', {}, { asesorCampana: 'MOBILIZE' });
  for (let i = 0; i < 20; i++) assert.equal((await nuevo(t, { adjunto: { nombre: 'a.png', datos: b64(PNG) } })).status, 201, 'adjunto ' + (i + 1));
  const r = await nuevo(t, { adjunto: { nombre: 'a.png', datos: b64(PNG) } });
  assert.equal(r.status, 429);
  assert.match(r.body.error, /20 adjuntos/);
  assert.equal((await nuevo(t, {})).status, 201);
  assert.equal((await nuevo(tk.ase2, { adjunto: { nombre: 'a.png', datos: b64(PNG) } })).status, 201);
});

test('el nombre raro del adjunto no rompe el encabezado de descarga', async () => {
  const t = (await nuevo(tk.ase2, { adjunto: { nombre: "it's (mi) *captura*\r\nX-Malo: 1.png", datos: b64(PNG) } })).body.ticket;
  const r = await request(app).get('/api/tickets/' + t.id + '/adjunto').set(H(tk.ase2));
  assert.equal(r.status, 200);
  assert.equal(r.headers['x-malo'], undefined);
  assert.match(r.headers['content-disposition'], /^attachment; filename="ticket-\d+-adjunto\.png"; filename\*=UTF-8''[A-Za-z0-9%._~-]+$/);
});
