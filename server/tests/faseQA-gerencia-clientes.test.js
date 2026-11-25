// faseQA-gerencia-clientes.test.js — Pedido de Edwin (25/11/2026), usuario de Jairo (GERENCIA): debe ver solo
// Clientes (dashboards), Tickets y Gerencia, con todos los clientes. Antes, el formulario no ofrecía «Acceso a
// clientes» a GERENCIA (sin cliente_*, el menú «Dashboard Clientes» quedaba vacío), el rol forzaba Calidad y
// le daba el módulo operativo de Gestión STA. Ahora:
//   - GERENCIA elige sus clientes (casillas «Acceso a clientes»), sin Calidad a la fuerza ni campaña obligatoria;
//   - GERENCIA ya no gestiona el STA; con ORLANT lo ve dentro del Dashboard del cliente (solo lectura).
// Usuarios INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor } = require('./helpers');

const JS = path.join(__dirname, '..', '..', 'public', 'js');
const H = (t) => ({ Authorization: 'Bearer ' + t });
let gerOrlant, gerSin;
function crear(user, rol, perms) {
  db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
    .run('Prueba ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), new Date().toISOString());
}
before(async () => {
  crear('gqa_ger_orl', 'GERENCIA', { ClientesDash: true, Gerencia: true, Calidad: false, cliente_ORLANT: true, cliente_MOBILIZE: true });
  crear('gqa_ger_sin', 'GERENCIA', { ClientesDash: true, Gerencia: true, Calidad: false });
  [gerOrlant, gerSin] = await Promise.all(['gqa_ger_orl', 'gqa_ger_sin'].map((u) => tokenFor(u, 'Clave#2026x')));
});

function sandbox() {
  const sb = {
    DASH_MODULES: [{ key: 'Calidad' }, { key: 'Gerencia' }, { key: 'ClientesDash' }],
    ROLE_DEFAULT: { GERENCIA: 'Gerencia', CLIENTES_DASH: 'ClientesDash' },
    CLIENTES_LIST: ['ORLANT', 'MOBILIZE', 'SURA'], CAMPANAS_CALIDAD: ['ORLANT', 'MOBILIZE'], ADMIN_ACTIONS: [], REGULAR_ROLES: [],
  };
  sb.window = sb; sb.addEventListener = () => {};
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(JS, 'state.js'), 'utf8'), sb);
  return sb;
}

test('permisos por defecto: GERENCIA ya no recibe Calidad a la fuerza y lleva sus clientes marcados', () => {
  const sb = sandbox();
  const p = JSON.parse(JSON.stringify(sb.buildPerms('GERENCIA', { ORLANT: true, MOBILIZE: true, SURA: true }, null)));
  assert.equal(p.Calidad, false);
  assert.equal(p.Gerencia, true, 'su módulo por defecto');
  assert.deepEqual([p.cliente_ORLANT, p.cliente_MOBILIZE, p.cliente_SURA], [true, true, true]);
  const u = { rol: 'GERENCIA', perms: { Calidad: false, Gerencia: true, ClientesDash: true } };
  sb.ensurePerms(u);
  assert.equal(u.perms.Calidad, false, 'al leer el usuario tampoco se fuerza');
  assert.equal(u.perms.cliente_SURA, false, 'cliente sin marcar = false');
});

test('formulario: «Acceso a clientes» para GERENCIA (crear, editar y al cambiar de rol); campaña ya no obligatoria', () => {
  const u = fs.readFileSync(path.join(JS, 'users.js'), 'utf8');
  assert.match(u, /if \(u\.rol==='CLIENTES_DASH' \|\| u\.rol==='GERENCIA'\)\{ \/\/ 25\/11: GERENCIA también elige clientes\n    buildClientCheckboxes\(u\.perms\);/);
  assert.match(u, /var show=\(rol==='CLIENTES_DASH' \|\| rol==='GERENCIA'\);/);
  assert.match(u, /var clientChecks=\(rol==='CLIENTES_DASH'\|\|rol==='GERENCIA'\)\?getClientChecks\(\):null;/);
  assert.match(u, /if\(rol==='CLIENTES_DASH' \|\| rol==='GERENCIA'\)\{ \/\/ 25\/11\n      var cc=getClientChecks\(\);/);
  assert.match(u, /if\(\(rol==='CALIDAD'\|\|rol==='REPORTES'\) && !algunoMarcado\(getCampaignChecks\(\)\)\)/);
  assert.match(u, /'✅ Clientes: '\+cli\.join\(', '\)/);
});

test('Gestión STA: GERENCIA no ve la tarjeta ni gestiona; con ORLANT ve las gráficas del Dashboard (solo lectura)', async () => {
  const { staVeTarjeta } = require('../../public/js/orlant-sta.js');
  assert.equal(staVeTarjeta({ rol: 'GERENCIA', perms: { cliente_ORLANT: true } }, false), false);
  const B = '/api/orlant/sta';
  assert.equal((await request(app).get(B + '/estado').set(H(gerOrlant))).status, 403, 'vista de supervisor');
  assert.equal((await request(app).post(B + '/cargas').set(H(gerOrlant)).send({ archivo: 'x.xlsx', columnas: ['Numero Autorizacion'], filas: [{ 'Numero Autorizacion': 'X1' }] })).status, 403);
  assert.equal((await request(app).post(B + '/estados').set(H(gerOrlant)).send({ archivo: 'x.xlsx', filas: [{ numero: 'X1', estado: 'Anulada' }] })).status, 403);
  const v = await request(app).get(B + '/estado?vista=cliente').set(H(gerOrlant));
  assert.equal(v.status, 200); assert.equal(v.body.vista, 'cliente');
  assert.equal((await request(app).get(B + '/resumen').set(H(gerOrlant))).status, 200);
  // Sin ORLANT, ni las gráficas.
  assert.equal((await request(app).get(B + '/estado?vista=cliente').set(H(gerSin))).status, 403);
  assert.equal((await request(app).get(B + '/resumen').set(H(gerSin))).status, 403);
});

test('GERENCIA sigue viendo su módulo Gerencia y los tickets (no es una cuenta de cliente)', async () => {
  assert.equal((await request(app).get('/api/gerencia/kpis').set(H(gerOrlant))).status, 200);
  const L = require('../../public/js/dashboards-logic.js');
  assert.ok(L.dashTarjetasEntrada('GERENCIA', false, false, false).some((t) => t.key === 'tickets'));
  const core = fs.readFileSync(path.join(JS, 'dashboards-core.js'), 'utf8');
  assert.match(core, /var sinTickets = rolActual==='CLIENTES_DASH' && /, 'solo la cuenta de cliente de ORLANT pierde Tickets');
});
