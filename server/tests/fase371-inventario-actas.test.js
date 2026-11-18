// fase371-inventario-actas.test.js — Fase 371 (pedido de Edwin 18/11, E3): actas de entrega y
// devolución; la firmada va a un S3 PRIVADO (aquí, un S3 falso en memoria). Datos INVENTADOS.
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const tk = {};
const ids = {};
const guardado = new Map();
const llamadas = [];
const s3Falso = { send: async (cmd) => {
  const n = cmd.constructor.name, i = cmd.input;
  llamadas.push({ n, i });
  if (n === 'PutObjectCommand') { guardado.set(i.Key, i.Body); return {}; }
  if (n === 'GetObjectCommand') { const b = guardado.get(i.Key); return { Body: { transformToByteArray: async () => new Uint8Array(b) } }; }
  throw new Error('comando inesperado');
} };
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(200, 32), Buffer.from('\n%%EOF')]).toString('base64');

before(async () => {
  for (const [u, rol] of [['f371_sis', 'SISTEMAS'], ['f371_sup', 'SUPERVISOR']]) {
    db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
      .run('Persona Inventada ' + u, u, rol, bcrypt.hashSync('Clave#2026x', 4), '{}', new Date().toISOString());
  }
  tk.admin = await tokenFor('admin', MASTER_PASSWORD);
  tk.sis = await tokenFor('f371_sis', 'Clave#2026x');
  tk.sup = await tokenFor('f371_sup', 'Clave#2026x');
  const P = (u, b) => request(app).post('/api/activos' + u).set(H(tk.sis)).send(b);
  ids.ag = (await P('/agentes', { nombre: 'Agente Inventado Actas', documento: '7100001' })).body.agente.id;
  ids.otro = (await P('/agentes', { nombre: 'Otro Agente Inventado' })).body.agente.id;
  for (const [tipo, codigo] of [['DIADEMA', 'E3-D1'], ['MOUSE', 'E3-M1'], ['TECLADO', 'E3-K1']]) {
    ids[codigo] = (await P('', { tipo, codigo, marca: 'MarcaInventada' })).body.activo.id;
    assert.equal((await P('/' + ids[codigo] + '/asignar', { agenteId: ids.ag })).status, 200);
  }
  assert.equal((await P('/' + ids['E3-K1'] + '/devolver', { estado: 'malo', motivo: 'Teclas dañadas' })).status, 200);
  app.locals.actasS3Cliente = s3Falso;
});
after(() => { delete app.locals.actasS3Cliente; delete process.env.ACTAS_S3_BUCKET; });

test('candidatos y permisos', async () => {
  assert.equal((await request(app).get('/api/activos/agentes/' + ids.ag + '/actas').set(H(tk.sup))).status, 403);
  const r = (await request(app).get('/api/activos/agentes/' + ids.ag + '/actas').set(H(tk.sis))).body;
  assert.deepEqual(r.entrega.map((x) => x.codigo), ['E3-D1', 'E3-M1']);
  assert.deepEqual(r.devolucion.map((x) => [x.codigo, x.queda, x.motivo]), [['E3-K1', 'malo', 'Teclas dañadas']]);
  assert.equal(r.firmadasActivas, false);
});

test('crear actas: solo elementos que corresponden; número consecutivo; copia fija de los datos', async () => {
  const C = (g, b) => request(app).post('/api/activos/agentes/' + g + '/actas').set(H(tk.sis)).send(b);
  assert.equal((await C(ids.ag, { tipo: 'prestamo', activoIds: [ids['E3-D1']] })).status, 400);
  assert.equal((await C(ids.ag, { tipo: 'entrega', activoIds: [] })).status, 400);
  assert.equal((await C(ids.ag, { tipo: 'entrega', activoIds: [ids['E3-K1']] })).status, 400, 'ya devuelto: no va en entrega');
  assert.equal((await C(ids.otro, { tipo: 'entrega', activoIds: [ids['E3-D1']] })).status, 400, 'de otro agente');
  assert.equal((await C(ids.ag, { tipo: 'devolucion', activoIds: [ids['E3-D1']] })).status, 400, 'sigue asignado: no va en devolución');
  const e = await C(ids.ag, { tipo: 'entrega', activoIds: [ids['E3-D1'], ids['E3-M1']] });
  assert.equal(e.status, 201, JSON.stringify(e.body));
  assert.deepEqual([e.body.acta.tipo, e.body.acta.agente.nombre, e.body.acta.agente.documento, e.body.acta.elementos.map((x) => x.tipo + ' ' + x.codigo)],
    ['entrega', 'Agente Inventado Actas', '7100001', ['Diadema E3-D1', 'Mouse E3-M1']]);
  const d = await C(ids.ag, { tipo: 'devolucion', activoIds: [ids['E3-K1']] });
  assert.equal(d.status, 201);
  assert.equal(d.body.acta.numero, e.body.acta.numero + 1);
  assert.deepEqual([d.body.acta.elementos[0].queda, d.body.acta.elementos[0].motivo], ['Malo', 'Teclas dañadas']);
  ids.acta = e.body.acta.id;
  // Copia fija: cambiar el nombre del agente no cambia el acta ya hecha.
  await request(app).put('/api/activos/agentes/' + ids.ag).set(H(tk.sis)).send({ nombre: 'Agente Inventado Renombrado' });
  assert.equal((await request(app).get('/api/activos/actas/' + ids.acta).set(H(tk.sis))).body.acta.agente.nombre, 'Agente Inventado Actas');
  const h = db.prepare("SELECT detalle FROM historial WHERE accion = 'ACTIVO_ACTA'").all().map((x) => x.detalle).join(' ');
  assert.ok(!/Inventado|7100001/.test(h), 'el Historial general no lleva nombre ni documento');
});

test('acta firmada: apagada sin bucket; con bucket solo PDF real, cifrado, y se descarga solo con permiso', async () => {
  const F = (b, t) => request(app).post('/api/activos/actas/' + ids.acta + '/firmada').set(H(t || tk.sis)).send(b);
  assert.equal((await F({ pdf: PDF })).status, 503, 'sin ACTAS_S3_BUCKET');
  assert.equal(llamadas.length, 0);
  process.env.ACTAS_S3_BUCKET = 'bucket-inventado-actas';
  assert.equal((await F({ pdf: PDF }, tk.sup)).status, 403);
  assert.equal((await F({ pdf: Buffer.from('<html>no soy pdf</html>' + ' '.repeat(80)).toString('base64') })).status, 400);
  assert.equal((await F({ pdf: 'no-base64!' })).status, 400);
  assert.equal((await request(app).get('/api/activos/actas/' + ids.acta + '/firmada').set(H(tk.sis))).status, 404, 'aún sin firmada');
  const r = await F({ pdf: PDF });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.acta.firmada && r.body.acta.firmada.bytes > 200);
  const put = llamadas.find((x) => x.n === 'PutObjectCommand').i;
  assert.deepEqual([put.Bucket, put.ServerSideEncryption, put.ContentType], ['bucket-inventado-actas', 'AES256', 'application/pdf']);
  assert.match(put.Key, /^actas\/\d{6}-entrega-\d+\.pdf$/);
  assert.ok(!('ACL' in put), 'nunca público');
  assert.equal((await request(app).get('/api/activos/actas/' + ids.acta + '/firmada').set(H(tk.sup))).status, 403);
  const g = await request(app).get('/api/activos/actas/' + ids.acta + '/firmada').set(H(tk.sis)).buffer(true).parse((res, cb) => { const t = []; res.on('data', (c) => t.push(c)); res.on('end', () => cb(null, Buffer.concat(t))); });
  assert.equal(g.status, 200);
  assert.equal(g.headers['content-type'], 'application/pdf');
  assert.match(g.headers['content-disposition'], /attachment; filename="acta-\d+-firmada\.pdf"/);
  assert.equal(g.body.subarray(0, 5).toString(), '%PDF-');
  const lista = (await request(app).get('/api/activos/agentes/' + ids.ag + '/actas').set(H(tk.sis))).body;
  assert.equal(lista.firmadasActivas, true);
  assert.equal(lista.actas.find((a) => a.id === ids.acta).firmada.bytes, r.body.acta.firmada.bytes);
});

test('interfaz: el acta para imprimir escapa los textos y lleva las firmas', () => {
  global.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  try {
    const UI = require(path.join(__dirname, '..', '..', 'public', 'js', 'activos.js'));
    const html = UI.activosActaHtml({ numero: 7, tipo: 'entrega', tipoNombre: 'Entrega', fecha: '2026-11-18T15:00:00.000Z', quien: 'Admin <x>',
      agente: { nombre: '<b>Agente</b>', documento: '123', sede: '', operacion: '' }, elementos: [{ tipo: 'Diadema', codigo: 'D-1', marca: '', modelo: '', serial: '' }] });
    assert.ok(html.includes('&lt;b&gt;Agente&lt;/b&gt;') && !html.includes('<b>Agente'));
    assert.match(html, /Acta de entrega N\.º 7/);
    assert.match(html, /Firma de quien recibe/);
    assert.ok(!/<script/i.test(html), 'sin scripts en la ventana de impresión');
  } finally { delete global.esc; }
});
