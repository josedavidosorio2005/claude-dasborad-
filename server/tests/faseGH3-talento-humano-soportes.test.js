// faseGH3-talento-humano-soportes.test.js — Fase GH3 (docs/gestion-humana/plan.md): los soportes
// adjuntos de «Talento humano» van a un bucket S3 PRIVADO (como las actas firmadas), apagado sin
// GH_SOPORTES_S3_BUCKET. S3 FALSO en memoria y archivos SINTÉTICOS.
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const GA = require('../gh-archivos');
const { ghCrearArchivos, GH_AVISO_BARRA } = require('../../public/gestion-humana/talento-humano-api.js');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const tk = {};
const guardado = new Map();
const llamadas = [];
const s3Falso = { send: async (cmd) => {
  const n = cmd.constructor.name, i = cmd.input;
  llamadas.push({ n, i });
  if (n === 'PutObjectCommand') { guardado.set(i.Key, i.Body); return {}; }
  if (n === 'GetObjectCommand') { const b = guardado.get(i.Key); return { Body: { transformToByteArray: async () => new Uint8Array(b) } }; }
  throw new Error('comando inesperado: ' + n);
} };
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(300, 32), Buffer.from('\n%%EOF')]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100, 1)]);
const subirA = (t, b) => request(app).post('/api/gh/archivos').set(H(t)).send(b);

before(async () => {
  delete process.env.GH_ROL_ACTIVO;
  delete process.env.GH_SOPORTES_S3_BUCKET;
  app.locals.ghS3Cliente = s3Falso;
  tk.admin = await tokenFor('admin', MASTER_PASSWORD);
  for (const [u, rol] of [['gh3_gh', 'GESTION_HUMANA'], ['gh3_ger', 'GERENCIA']]) {
    db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
      .run('Persona Inventada ' + u, u, rol, bcrypt.hashSync('Clave#2026x', 4), '{}', new Date().toISOString());
  }
  tk.gh = await tokenFor('gh3_gh', 'Clave#2026x');
  tk.ger = await tokenFor('gh3_ger', 'Clave#2026x');
});
after(() => { delete app.locals.ghS3Cliente; delete process.env.GH_SOPORTES_S3_BUCKET; delete process.env.GH_ROL_ACTIVO; });

test('apagado (sin GH_SOPORTES_S3_BUCKET): subir responde 503, el estado lo dice y no llama a S3', async () => {
  assert.ok(require('../secrets').SSM_KEYS.includes('GH_SOPORTES_S3_BUCKET'));
  const r = await subirA(tk.admin, { id: 'f1', empId: 'e1', nombre: 'incapacidad.pdf', base64: PDF.toString('base64') });
  assert.equal(r.status, 503);
  assert.equal((await request(app).get('/api/gh/estado').set(H(tk.admin))).body.soportesActivos, false);
  assert.equal(llamadas.length, 0);
});

test('encendido: sube a S3 privado (cifrado, clave sin el nombre del archivo), lo devuelve y lo borra', async () => {
  process.env.GH_SOPORTES_S3_BUCKET = 'bucket-de-prueba';
  assert.equal((await request(app).get('/api/gh/estado').set(H(tk.admin))).body.soportesActivos, true);
  const r = await subirA(tk.admin, { id: 'soporte_1', empId: 'emp-9', nombre: 'Incapacidad Persona Inventada.pdf', base64: PDF.toString('base64') });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.deepEqual({ id: r.body.id, empId: r.body.empId, name: r.body.name, type: r.body.type, size: r.body.size },
    { id: 'soporte_1', empId: 'emp-9', name: 'Incapacidad Persona Inventada.pdf', type: 'application/pdf', size: PDF.length });
  const put = llamadas.find((l) => l.n === 'PutObjectCommand');
  assert.equal(put.i.Bucket, 'bucket-de-prueba');
  assert.equal(put.i.ServerSideEncryption, 'AES256');
  assert.match(put.i.Key, /^talento-humano\/soportes\/soporte_1-\d+\.pdf$/);
  assert.ok(!/Inventada/.test(put.i.Key), 'la clave en S3 no lleva el nombre del archivo');
  // subir otra vez el mismo id (p. ej. al restaurar una copia) no lo duplica
  const otra = await subirA(tk.admin, { id: 'soporte_1', base64: PDF.toString('base64') });
  assert.equal(otra.status, 200);
  assert.equal(llamadas.filter((l) => l.n === 'PutObjectCommand').length, 1);
  const g = await request(app).get('/api/gh/archivos/soporte_1').set(H(tk.admin));
  assert.equal(g.status, 200);
  assert.ok(Buffer.from(g.body.base64, 'base64').equals(PDF));
  assert.equal(g.headers['cache-control'], 'no-store');
  // bitácora: subido y borrado, sin el nombre ni el contenido
  assert.equal((await request(app).delete('/api/gh/archivos/soporte_1').set(H(tk.admin))).body.borrado, true);
  assert.equal((await request(app).get('/api/gh/archivos/soporte_1').set(H(tk.admin))).status, 404);
  assert.equal((await request(app).delete('/api/gh/archivos/soporte_1').set(H(tk.admin))).body.borrado, false);
  assert.equal((await subirA(tk.admin, { id: 'soporte_1', base64: PDF.toString('base64') })).status, 409, 'un id borrado no revive');
  const bit = (await request(app).get('/api/gh/bitacora').set(H(tk.admin))).body;
  const txt = JSON.stringify(bit);
  assert.ok(bit.some((b) => b.clave === 'soporte:subido') && bit.some((b) => b.clave === 'soporte:borrado'));
  assert.ok(!/Inventada|PDF-1/.test(txt), 'la bitácora no lleva nombre ni contenido');
});

test('validación: tipo por el contenido (no por la extensión), tope de 8 MB, ids', async () => {
  process.env.GH_SOPORTES_S3_BUCKET = 'bucket-de-prueba';
  const malo = await subirA(tk.admin, { id: 'f_exe', nombre: 'foto.png', base64: Buffer.from('MZ esto no es una imagen ni un pdf').toString('base64') });
  assert.equal(malo.status, 400);
  const png = await subirA(tk.admin, { id: 'f_png', nombre: 'foto.pdf', base64: PNG.toString('base64') });
  assert.equal(png.status, 201);
  assert.equal(png.body.type, 'image/png', 'el tipo sale del contenido');
  assert.equal((await subirA(tk.admin, { id: '../x', base64: PDF.toString('base64') })).status, 400);
  assert.equal((await subirA(tk.admin, { id: 'f2', base64: 'no es base64!!' })).status, 400);
  assert.equal((await request(app).get('/api/gh/archivos/..%2Fx').set(H(tk.admin))).status, 400);
  const grande = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(GA.MAX_BYTES, 32)]);
  const r = await subirA(tk.admin, { id: 'f_grande', base64: grande.toString('base64') });
  assert.ok([400, 413].includes(r.status), 'más de 8 MB no entra: ' + r.status);
  assert.equal(GA.limpiarNombre('a/b\\c<d>.pdf'), 'a b c d .pdf');
});

test('permisos: como Talento humano (admin siempre; GESTION_HUMANA solo con GH_ROL_ACTIVO=1)', async () => {
  process.env.GH_SOPORTES_S3_BUCKET = 'bucket-de-prueba';
  const b = { id: 'f_gh', base64: PDF.toString('base64') };
  assert.equal((await subirA(tk.gh, b)).status, 403);
  assert.equal((await request(app).get('/api/gh/archivos/f_png').set(H(tk.gh))).status, 403);
  assert.equal((await request(app).delete('/api/gh/archivos/f_png').set(H(tk.gh))).status, 403);
  process.env.GH_ROL_ACTIVO = '1';
  assert.equal((await subirA(tk.gh, b)).status, 201);
  assert.equal((await request(app).get('/api/gh/archivos/f_png').set(H(tk.gh))).status, 200);
  assert.equal((await subirA(tk.ger, { id: 'f_ger', base64: PDF.toString('base64') })).status, 403);
  assert.equal((await request(app).get('/api/gh/archivos/f_png').set(H(tk.ger))).status, 403);
  assert.equal((await request(app).get('/api/gh/archivos/f_png')).status, 401);
  delete process.env.GH_ROL_ACTIVO;
});

test('S3 falla: 502 sin detalles y sin guardar la fila', async () => {
  process.env.GH_SOPORTES_S3_BUCKET = 'bucket-de-prueba';
  const antes = app.locals.ghS3Cliente;
  app.locals.ghS3Cliente = { send: async () => { const e = new Error('AccessDenied detalle interno'); e.name = 'AccessDenied'; throw e; } };
  const r = await subirA(tk.admin, { id: 'f_falla', base64: PDF.toString('base64') });
  app.locals.ghS3Cliente = antes;
  assert.equal(r.status, 502);
  assert.ok(!/detalle interno/.test(JSON.stringify(r.body)));
  assert.equal(db.prepare("SELECT COUNT(*) n FROM gh_archivos WHERE id = 'f_falla'").get().n, 0);
});

test('navegador: ghArchivos usa el servidor si está encendido y el navegador si no (o si el servidor no lo tiene)', async () => {
  const local = new Map();
  const IDB_LOCAL = { put: async (o) => { local.set(o.id, o); }, get: async (id) => local.get(id), del: async (id) => { local.delete(id); } };
  const pedidos = [];
  const servidor = new Map();
  const api = async (m, p, body) => {
    pedidos.push(m + ' ' + p);
    const id = decodeURIComponent(p.split('/').pop());
    if (m === 'POST') { servidor.set(body.id, body); return { id: body.id }; }
    if (m === 'GET') { const x = servidor.get(id); if (!x) { const e = new Error('no'); e.status = 404; throw e; } return { id, empId: x.empId, name: x.nombre, type: 'application/pdf', size: 3, base64: x.base64 }; }
    if (m === 'DELETE') { servidor.delete(id); return { borrado: true }; }
    throw new Error(m);
  };
  const conv = { aBase64: async (b) => Buffer.from(b).toString('base64'), deBase64: (s) => Buffer.from(s, 'base64') };
  // apagado: todo en el navegador, nada al servidor
  const off = ghCrearArchivos(Object.assign({ api, local: IDB_LOCAL, activo: false }, conv));
  await off.put({ id: 'viejo', empId: 'e1', name: 'v.pdf', type: 'application/pdf', size: 3, blob: Buffer.from('abc') });
  assert.equal((await off.get('viejo')).name, 'v.pdf');
  assert.equal(pedidos.length, 0);
  // encendido: sube y trae del servidor; lo guardado antes en el navegador se sigue encontrando
  const on = ghCrearArchivos(Object.assign({ api, local: IDB_LOCAL, activo: true }, conv));
  await on.put({ id: 'nuevo', empId: 'e1', name: 'n.pdf', type: 'application/pdf', size: 3, blob: Buffer.from('xyz') });
  assert.ok(!local.has('nuevo'), 'encendido no lo deja en el navegador');
  assert.equal(servidor.get('nuevo').base64, Buffer.from('xyz').toString('base64'));
  const n = await on.get('nuevo');
  assert.equal(n.name, 'n.pdf');
  assert.equal(Buffer.from(n.blob).toString(), 'xyz');
  assert.equal((await on.get('viejo')).name, 'v.pdf', 'respaldo: el soporte guardado antes en este navegador');
  await on.del('nuevo');
  await on.del('viejo');
  assert.ok(!servidor.has('nuevo') && !local.has('viejo'));
  assert.equal(GH_AVISO_BARRA.activos, '', 'pedido de Edwin 24/11: sin «Se guarda en la plataforma…»');
  assert.ok(GH_AVISO_BARRA.apagados);
});

test('generado: el IDB de la app pasa por ghArchivos y el pie ya no dice «solo en este navegador»', () => {
  const app_ = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'gestion-humana', 'talento-humano-app.js'), 'utf8');
  const pag = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'gestion-humana', 'talento-humano.html'), 'utf8');
  assert.equal(app_.split('const IDB=ghArchivos(IDB_LOCAL);').length - 1, 1);
  assert.equal(app_.split('const IDB_LOCAL={db:null,').length - 1, 1);
  assert.ok(!/const IDB=\{/.test(app_));
  assert.ok(!/en este equipo/.test(app_));
  assert.ok(!/solo en este navegador/.test(pag + app_));
  const idx = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  assert.match(idx, /id="th-aviso" hidden><\/p>/);
  assert.ok(!/Se guarda en la plataforma/.test(idx), 'pedido de Edwin 24/11');
});
