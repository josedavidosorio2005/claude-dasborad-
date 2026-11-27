// faseINV2-obligatorios-tecnologias.test.js — Fase INV2 (HTML de Edwin, parte 2 del 27/11):
//  1) al registrar y al editar un elemento, TODOS los campos visibles son obligatorios (como su «Todos los campos
//     son obligatorios. Faltan: …»). El precio se pide a los propios (InConexion) y la renta a los de un proveedor.
//     La importación desde Excel no lo exige (deja «datos pendientes»).
//  2) «Nueva tecnología» con «Se asigna a agentes»: Sí = como un portátil; No = componente del inventario. Los tipos
//     de siempre siguen asignándose (menos administrables e inmuebles). No se cambia si el tipo ya tiene elementos.
// Datos INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor } = require('./helpers');
const { completar } = require('./helpers-activos');
const A = require('../activos');

const H = (t) => ({ Authorization: 'Bearer ' + t });
let tk;
const post = (url, b) => request(app).post('/api' + url).set(H(tk)).send(b);
const put = (url, b) => request(app).put('/api' + url).set(H(tk)).send(b);

before(async () => {
  db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
    .run('Persona Inventada INV2', 'inv2_sis', 'SISTEMAS', bcrypt.hashSync('Clave#2026x', 4), '{}', new Date().toISOString());
  tk = await tokenFor('inv2_sis', 'Clave#2026x');
  for (const [l, v] of [['sedes', ['Sede Inventada INV2']], ['operaciones', ['Operación Inventada INV2']], ['proveedores', ['InConexion', 'Proveedor Inventado INV2']]]) {
    assert.equal((await put('/activos/listas/' + l, { valores: v })).status, 200, l);
  }
});

test('registrar: sin un campo no entra, y el error dice cuáles faltan', async () => {
  const r = await post('/activos', { tipo: 'MOUSE', codigo: 'INV2-M0' });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'Todos los campos son obligatorios. Faltan: Marca, Modelo, Serial, Sede y 4 más.');
  const uno = await post('/activos', Object.assign(completar({ tipo: 'MOUSE', codigo: 'INV2-M0' }), { observaciones: '  ' }));
  assert.equal(uno.status, 400);
  assert.equal(uno.body.error, 'Todos los campos son obligatorios. Falta: Observaciones.');
  // Los campos del tipo también (una torre sin RAM no entra), menos los ocultos.
  const sinRam = completar({ tipo: 'TORRE', codigo: 'INV2-T0' }); delete sinRam.datos.ram_gb;
  assert.match((await post('/activos', sinRam)).body.error, /Falta: Memoria RAM \(GB\)\.$/);
  const ok = await post('/activos', completar({ tipo: 'MOUSE', codigo: 'INV2-M1' }));
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
});

test('precio para los propios, renta para los de un proveedor (no los dos)', async () => {
  const propio = completar({ tipo: 'TECLADO', codigo: 'INV2-K1', proveedor: 'InConexion' });
  assert.ok('precio' in propio.datos && !('renta_mensual' in propio.datos));
  assert.equal((await post('/activos', propio)).status, 201);
  const rentado = completar({ tipo: 'TECLADO', codigo: 'INV2-K2', proveedor: 'Proveedor Inventado INV2' });
  assert.ok(!('precio' in rentado.datos) && 'renta_mensual' in rentado.datos);
  assert.equal((await post('/activos', rentado)).status, 201);
  const sinRenta = Object.assign({}, rentado, { codigo: 'INV2-K3', datos: { precio: 10 } });
  assert.match((await post('/activos', sinRenta)).body.error, /Falta: Precio de renta mensual\.$/);
  assert.deepEqual([A.esPropio(''), A.esPropio('InConexión'), A.esPropio('Proveedor Inventado INV2')], [true, true, false]);
});

test('editar también exige todo; la importación no (deja datos pendientes)', async () => {
  const id = (await post('/activos', completar({ tipo: 'DIADEMA', codigo: 'INV2-D1' }))).body.activo.id;
  assert.match((await put('/activos/' + id, { observaciones: 'Solo esto' })).body.error, /^Todos los campos son obligatorios\./);
  const completo = completar({ tipo: 'DIADEMA', codigo: 'x', observaciones: 'Editado con todo' }); delete completo.tipo; delete completo.codigo;
  assert.equal((await put('/activos/' + id, completo)).status, 200);
  const v = A.validar(db, { tipo: 'DIADEMA', codigo: 'INV2-IMP' }, { nuevo: true });
  assert.equal(v.error, undefined, 'validar sin { completo } (importación) no pide todo');
  const src = fs.readFileSync(path.join(__dirname, '..', 'activos.js'), 'utf8');
  assert.match(src, /const v = validar\(db, b, \{ nuevo: true \}\);/, 'importar() sigue sin exigir todo');
  const rutas = fs.readFileSync(path.join(__dirname, '..', 'routes', 'activos.js'), 'utf8');
  assert.equal((rutas.match(/completo: true/g) || []).length, 2, 'registrar y editar');
});

test('«Se asigna a agentes»: los tipos de siempre como hoy; administrables e inmuebles no', () => {
  const t = Object.fromEntries(A.tipos(db, { todos: true }).map((x) => [x.codigo, x.asignable]));
  for (const c of ['TORRE', 'MONITOR', 'TECLADO', 'MOUSE', 'DIADEMA', 'PORTATIL']) assert.equal(t[c], true, c);
  for (const c of ['ADMINISTRABLE', 'SILLA', 'MESA', 'PAPELERA']) assert.equal(t[c], false, c);
});

test('tecnología nueva: se asigna por defecto; si no, no se asigna; no cambia con elementos', async () => {
  const sin = await post('/activos/config/tipos', { nombre: 'Cargador inventado', plural: 'Cargadores inventados', campos: [], asignable: false });
  assert.equal(sin.status, 201, JSON.stringify(sin.body));
  assert.equal(sin.body.tipo.asignable, false);
  const con = await post('/activos/config/tipos', { nombre: 'Celular inventado', plural: 'Celulares inventados', campos: [] });
  assert.equal(con.body.tipo.asignable, true, 'por defecto se asigna (tecnología nueva asignable)');
  assert.equal((await post('/activos/config/tipos', { nombre: 'Tablet inventada', plural: 'Tablets inventadas', campos: [], asignable: 'si' })).status, 400);
  const ag = (await post('/activos/agentes', { nombre: 'Agente Inventado INV2', documento: '990001' })).body.agente;
  const cel = (await post('/activos', completar({ tipo: con.body.tipo.codigo, codigo: 'INV2-C1' }))).body.activo;
  assert.equal((await post('/activos/' + cel.id + '/asignar', { agenteId: ag.id })).status, 200, 'el celular se asigna');
  const car = (await post('/activos', completar({ tipo: sin.body.tipo.codigo, codigo: 'INV2-X1' }))).body.activo;
  const r = await post('/activos/' + car.id + '/asignar', { agenteId: ag.id });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /no se asigna a agentes/);
  // Con elementos ya no se cambia; sin elementos sí.
  const cod = sin.body.tipo.codigo;
  assert.match((await put('/activos/config/tipos/' + cod, { nombre: 'Cargador inventado', plural: 'Cargadores inventados', campos: [], asignable: true })).body.error, /no se puede cambiar: ya hay 1 elemento/);
  const vacio = await post('/activos/config/tipos', { nombre: 'Lector inventado', plural: 'Lectores inventados', campos: [], asignable: false });
  const cambio = await put('/activos/config/tipos/' + vacio.body.tipo.codigo, { nombre: 'Lector inventado', plural: 'Lectores inventados', campos: [], asignable: true });
  assert.equal(cambio.status, 200);
  assert.equal(cambio.body.tipo.asignable, true);
  // Sin «asignable» en el cuerpo, editar no lo toca.
  assert.equal((await put('/activos/config/tipos/' + cod, { nombre: 'Cargador inventado', plural: 'Cargadores', campos: [] })).body.tipo.asignable, false);
  assert.match((await put('/activos/config/tipos/ADMINISTRABLE', { nombre: 'Equipo administrable', plural: 'Equipos administrables', campos: A.tipo(db, 'ADMINISTRABLE', { todos: true }).campos, asignable: true })).body.error, /no se asignan/);
  const cfg = (await request(app).get('/api/activos/config').set(H(tk))).body;
  assert.equal(cfg.tiposTodos.find((x) => x.codigo === cod).elementos, 1, 'Ajustes sabe cuántos tiene (bloquea la casilla)');
});

test('interfaz: mismo texto que el servidor, casilla del editor, tarjetas y asignar solo lo asignable', () => {
  global.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const UI = require(path.join(__dirname, '..', '..', 'public', 'js', 'activos.js'));
  for (const f of [['Marca'], ['Marca', 'Serial'], ['a', 'b', 'c', 'd', 'e', 'f']]) assert.equal(UI.activosFaltanTxt(f), A.faltanTexto(f));
  for (const p of ['', 'InConexion', 'inconexión', 'Alcom']) assert.equal(UI.activosEsPropio(p), A.esPropio(p), p);
  const nueva = UI.activosAsignableHtml(null, 'sistemas');
  assert.match(nueva, /<input type="checkbox" id="ac-te-asig" checked aria-describedby/);
  assert.match(UI.activosAsignableHtml({ codigo: 'X', asignable: false, elementos: 2, ambito: 'sistemas' }), /id="ac-te-asig" disabled[^>]*> Se asigna a agentes<\/label>[\s\S]*ya hay elementos/);
  assert.equal(UI.activosAsignableHtml({ codigo: 'ADMINISTRABLE' }, 'sistemas'), '');
  assert.equal(UI.activosAsignableHtml(null, 'inmuebles'), '');
  const tarj = UI.activosRegistrarTarjetasHtml([{ codigo: 'CEL', nombre: 'Celular', asignable: true }, { codigo: 'CAR', nombre: 'Cargador', asignable: false }], {}, []);
  assert.match(tarj, /Celular<\/h4>[\s\S]*?Se asigna a agentes\./);
  assert.match(tarj, /Cargador<\/h4>[\s\S]*?Componente del inventario: no se asigna a agentes\./);
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'activos.js'), 'utf8');
  assert.match(src, /t\.codigo !== 'ADMINISTRABLE' && t\.asignable !== false/, 'asignar desde el agente: solo los que se asignan');
  assert.match(src, /if \(tg && tg\.asignable === false && !a\.agente\) return '';/, 'el elemento de un componente no ofrece asignar');
  assert.match(src, /var faltan = activosRevisarObligatorios\(_acEl\('ac-r-form'\)\);/);
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  assert.match(html, /<select id="ac-r-proveedor" aria-required="true" onchange="activosAjustarPrecioRenta\(\)">/);
  assert.match(html, /Todos los campos son obligatorios\./);
});
