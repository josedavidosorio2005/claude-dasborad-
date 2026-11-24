// faseEQ3-equidad-cliente.test.js — opción «la cuenta cliente de ORLANT ve Equidad profesionales»: apagada por
// defecto, la cambia solo el administrador y sin redesplegar. Datos INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');

const B = '/api/orlant/equidad';
const H = (t) => ({ Authorization: 'Bearer ' + t });
function crear(user, rol, perms) {
  db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
    .run('Prueba ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), new Date().toISOString());
}
const tok = (u) => tokenFor(u, 'Clave#2026x');
let admin, sup, cli, cliOtro;

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  crear('feq3_sup', 'SUPERVISOR', { campana_ORLANT: true, cliente_ORLANT: true });
  crear('feq3_cli', 'CLIENTES_DASH', { ClientesDash: true, cliente_ORLANT: true });
  crear('feq3_cliotro', 'CLIENTES_DASH', { ClientesDash: true, cliente_MOBILIZE: true });
  [sup, cli, cliOtro] = await Promise.all(['feq3_sup', 'feq3_cli', 'feq3_cliotro'].map(tok));
  await request(app).post(B + '/cargas/polizas').set(H(admin)).send({ filas: [{ sede: 'S', esp: 'E', prof: 'DR INVENTADO', fecha: '2031-01-01', ent: 'ENT' }] });
});

test('Apagada por defecto: el cliente de ORLANT no ve la Equidad y el resumen lo dice', async () => {
  assert.equal((await request(app).get(B + '/estado').set(H(cli))).status, 403);
  assert.equal((await request(app).get(B + '/resumen').set(H(admin))).body.visibleCliente, false);
});

test('Solo el administrador la cambia; encendida, la ve el cliente de ORLANT (no el de otro cliente); se vuelve a apagar', async () => {
  for (const t of [sup, cli]) assert.equal((await request(app).put(B + '/opciones').set(H(t)).send({ visibleCliente: true })).status, 403);
  assert.equal((await request(app).put(B + '/opciones').set(H(admin)).send({ visibleCliente: 'si' })).status, 400);
  let r = await request(app).put(B + '/opciones').set(H(admin)).send({ visibleCliente: true });
  assert.deepEqual([r.status, r.body], [200, { visibleCliente: true }]);
  const e = await request(app).get(B + '/estado').set(H(cli));
  assert.equal(e.status, 200);
  assert.equal(e.body.total, 1);
  assert.equal((await request(app).get(B + '/estado').set(H(cliOtro))).status, 403);
  assert.equal((await request(app).post(B + '/cargas/polizas').set(H(cli)).send({ filas: [] })).status, 403, 'ver no es cargar');
  assert.match(db.prepare("SELECT detalle FROM historial WHERE accion = 'EQUIDAD_OPCIONES' ORDER BY ts DESC LIMIT 1").get().detalle, /la cuenta cliente VE/);
  r = await request(app).put(B + '/opciones').set(H(admin)).send({ visibleCliente: false });
  assert.equal(r.body.visibleCliente, false);
  assert.equal((await request(app).get(B + '/estado').set(H(cli))).status, 403);
});

test('«Cargar bases»: la casilla sale solo para el administrador y refleja el estado', () => {
  global.esc = require('../../public/js/esc.js').esc;
  const C = require('../../public/js/centro-equidad.js');
  const r = { grupos: [], entidades: { polizas: [], prepagada: [] }, visibleCliente: false };
  global.isFullAdmin = () => false;
  assert.ok(!C.ccEquidadHtml(r).includes('cc-eq-visible-cliente'));
  global.isFullAdmin = () => true;
  assert.match(C.ccEquidadHtml(r), /<input type="checkbox" id="cc-eq-visible-cliente" onchange="ccEquidadVisibleCliente\(this\)">/);
  assert.match(C.ccEquidadHtml(Object.assign({}, r, { visibleCliente: true })), /id="cc-eq-visible-cliente" checked/);
  delete global.isFullAdmin;
});
