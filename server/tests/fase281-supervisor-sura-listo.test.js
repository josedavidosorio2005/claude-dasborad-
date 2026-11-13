// fase281-supervisor-sura-listo.test.js — Fase 281: en el Portal Supervisor, SURA
// salia "PROXIMAMENTE" aunque su tablero propio (Televentas) existe: la lista del
// supervisor (renderSupervisorClientsGrid, session.js) solo miraba los tableros
// genericos (BUILT_CLIENT_DASHBOARDS); el selector de clientes de los demas roles
// (openClientsModal) si miraba el tablero propio. Ahora los dos usan la misma
// regla, dashClienteTieneTablero. Registro y permisos SINTETICOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PUB = path.join(__dirname, '..', '..', 'public', 'js');
const L = require(path.join(PUB, 'dashboards-logic.js'));
const CLIENTES = ['ORLANT', 'MOBILIZE', 'CLINICA AURORA', 'HOSPITAL LA MARIA', 'SURA', 'CLIENTE NUEVO'];
const GENERICOS = ['ORLANT', 'MOBILIZE', 'CLINICA AURORA', 'HOSPITAL LA MARIA'];
const REGISTRO = CLIENTES.map((c) => ({ nombre: c, parametros: { especificos: c === 'SURA' ? ['sura_televentas'] : [] } }));

function fn(archivo, nombre) {
  const s = fs.readFileSync(path.join(PUB, archivo), 'utf8');
  const i = s.indexOf('function ' + nombre + '(');
  return s.slice(i, s.indexOf('\n}\n', i) + 2);
}
// Lo que muestra cada lista: { cliente: 'listo' | 'proximamente' }.
function leer(html) {
  const out = {};
  for (const m of html.matchAll(/<div class="client-card( client-soon)?" data-cliente="([^"]+)"[\s\S]*?<\/div>(<div class="client-soon-label">Proximamente<\/div>)?<\/div>/g)) out[m[2]] = m[1] || m[3] ? 'proximamente' : 'listo';
  return out;
}
function ctxBase(perms) {
  const nodos = {};
  const nodo = (id) => (nodos[id] = nodos[id] || { id, innerHTML: '', classList: { add() {}, remove() {} } });
  const ctx = {
    document: { getElementById: nodo }, esc: (s) => String(s),
    CLIENTES_LIST: CLIENTES, BUILT_CLIENT_DASHBOARDS: GENERICOS, REGISTRO_CLIENTES: REGISTRO,
    currentUser: { rol: 'X', perms }, isFullAdmin: () => false,
    dashClientesVisibles: L.dashClientesVisibles, dashClienteTieneTablero: L.dashClienteTieneTablero,
    clientesParaTarjetas: require('../../public/js/sedes-logic.js').clientesParaTarjetas, // Fase 354
    stvEsTeleventas: (c) => c === 'SURA',
  };
  vm.createContext(ctx);
  return { ctx, nodo };
}
function portalSupervisor(perms) {
  const { ctx, nodo } = ctxBase(perms);
  vm.runInContext(fn('session.js', 'renderSupervisorClientsGrid'), ctx);
  ctx.renderSupervisorClientsGrid();
  return leer(nodo('supervisor-clients-grid').innerHTML);
}
function selectorClientes(perms) {
  const { ctx, nodo } = ctxBase(perms);
  vm.runInContext(fn('dashboards-core.js', 'openClientsModal'), ctx);
  ctx.openClientsModal();
  return leer(nodo('clients-grid').innerHTML);
}
const todos = Object.fromEntries(CLIENTES.map((c) => ['cliente_' + c, true]));

test('regla unica: generico o tablero propio = listo; sin ninguno = Proximamente', () => {
  for (const c of GENERICOS) assert.equal(L.dashClienteTieneTablero(c, GENERICOS, REGISTRO), true, c);
  assert.equal(L.dashClienteTieneTablero('SURA', GENERICOS, REGISTRO), true, 'tablero propio (Televentas)');
  assert.equal(L.dashClienteTieneTablero('CLIENTE NUEVO', GENERICOS, REGISTRO), false);
  assert.equal(L.dashClienteTieneTablero('SURA', GENERICOS, []), false, 'sin registro, solo cuentan los genericos');
});

test('Portal Supervisor: SURA ya no sale «Proximamente» (antes si)', () => {
  const v = portalSupervisor(todos);
  assert.equal(v.SURA, 'listo');
  assert.deepEqual(v, { ORLANT: 'listo', MOBILIZE: 'listo', 'CLINICA AURORA': 'listo', 'HOSPITAL LA MARIA': 'listo', SURA: 'listo', 'CLIENTE NUEVO': 'proximamente' });
});

test('todos los portales dicen lo mismo, con cualquier combinacion de permisos', () => {
  let s = 11; const rnd = (n) => { s = (s * 16807) % 2147483647; return s % n; };
  for (let k = 0; k < 60; k++) {
    const perms = Object.fromEntries(CLIENTES.map((c) => ['cliente_' + c, rnd(2) === 1]));
    const sup = portalSupervisor(perms);
    const sel = selectorClientes(perms);
    assert.deepEqual(sup, sel, JSON.stringify(perms));
    assert.deepEqual(Object.keys(sup).sort(), CLIENTES.filter((c) => perms['cliente_' + c]).sort(), 'solo los clientes con permiso');
  }
});

test('el selector de clientes sigue igual que antes (ya miraba el tablero propio)', () => {
  assert.equal(selectorClientes(todos).SURA, 'listo');
  assert.equal(selectorClientes(todos)['CLIENTE NUEVO'], 'proximamente');
});

test('servidor: un supervisor con acceso a SURA recibe lo necesario para verlo listo (ruta real)', async () => {
  const { app, request, tokenFor, MASTER_PASSWORD } = require('./helpers');
  const auth = (t) => ({ Authorization: 'Bearer ' + t });
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const user = 'sup_sura_' + Math.random().toString(36).slice(2, 7);
  const c = await request(app).post('/api/users').set(auth(admin)).send({ nombre: 'Supervisor Sintético', user, password: 'ClavePrueba1234', rol: 'SUPERVISOR',
    perms: { cliente_SURA: true, cliente_ORLANT: true, campana_ORLANT: true } });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  const tok = await tokenFor(user, 'ClavePrueba1234');
  const r = await request(app).get('/api/dashboard/clientes').set(auth(tok));
  assert.equal(r.status, 200);
  assert.ok(r.body.listaClientes.includes('SURA'));
  assert.ok(!r.body.clientes.includes('SURA'), 'SURA no es un tablero generico');
  assert.equal(L.dashClienteTieneTablero('SURA', r.body.clientes, r.body.registro), true, 'pero su tablero propio viene en el registro');
  assert.equal(r.body.registro.some((x) => x.nombre === 'MOBILIZE'), false, 'solo los clientes a los que tiene acceso');
});
