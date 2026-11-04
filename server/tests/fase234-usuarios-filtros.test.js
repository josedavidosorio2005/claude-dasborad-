// fase234-usuarios-filtros.test.js — Fase 234: Admin › Usuarios con filtros
// por rol y por campaña/cliente, ademas del buscador (plan de Calidad, sec. 7).
// Usuarios SINTETICOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JSDIR = path.join(__dirname, '..', '..', 'public', 'js');
const F = require(path.join(JSDIR, 'usuarios-filtro-logic.js'));

const USUARIOS = [
  { id: 1, nombre: 'Ana Pérez', user: 'ana', rol: 'CALIDAD', perms: { campana_ORLANT: true, campana_MOBILIZE: true, verDashboard: true } },
  { id: 2, nombre: 'Beto Ruiz', user: 'beto', rol: 'ASESOR', perms: {}, asesorCampana: 'ORLANT' },
  { id: 3, nombre: 'Carla Díaz', user: 'carla', rol: 'CLIENTES_DASH', perms: { cliente_SURA: true, cliente_ORLANT: false } },
  { id: 4, nombre: 'Dora', user: 'dora', rol: 'ADMIN', perms: {} },
  { id: 5, nombre: 'Eva', user: 'eva', rol: 'ASESOR', perms: {}, asesorCampana: 'MOBILIZE' },
];
const ids = (l) => l.map((u) => u.id);

test('campañas de un usuario: campana_X y cliente_X en true, y la del asesor', () => {
  assert.deepEqual(F.usuariosCampanasDe(USUARIOS[0]), ['MOBILIZE', 'ORLANT']);
  assert.deepEqual(F.usuariosCampanasDe(USUARIOS[1]), ['ORLANT']);
  assert.deepEqual(F.usuariosCampanasDe(USUARIOS[2]), ['SURA'], 'cliente_ORLANT en false no cuenta');
  assert.deepEqual(F.usuariosCampanasDe(USUARIOS[3]), []);
});

test('filtrar por rol, por campaña, sin campaña y por texto (sin tildes ni mayúsculas)', () => {
  assert.deepEqual(ids(F.usuariosFiltrar(USUARIOS, { rol: 'ASESOR' })), [2, 5]);
  assert.deepEqual(ids(F.usuariosFiltrar(USUARIOS, { campana: 'ORLANT' })), [1, 2]);
  assert.deepEqual(ids(F.usuariosFiltrar(USUARIOS, { campana: 'ORLANT', rol: 'ASESOR' })), [2]);
  assert.deepEqual(ids(F.usuariosFiltrar(USUARIOS, { campana: F.USUARIOS_SIN_CAMPANA })), [4]);
  assert.deepEqual(ids(F.usuariosFiltrar(USUARIOS, { texto: 'PEREZ' })), [1]);
  assert.deepEqual(ids(F.usuariosFiltrar(USUARIOS, { texto: 'diaz' })), [3]);
  // por el nombre visible del rol
  assert.deepEqual(ids(F.usuariosFiltrar(USUARIOS, { texto: 'cliente' }, (r) => (r === 'CLIENTES_DASH' ? 'CLIENTE' : r))), [3]);
  assert.deepEqual(ids(F.usuariosFiltrar(USUARIOS, {})), [1, 2, 3, 4, 5]);
});

test('opciones de los desplegables: roles y campañas de la lista, más los clientes conocidos', () => {
  const op = F.usuariosOpcionesFiltro(USUARIOS, ['ORLANT', 'HOSPITAL LA MARIA']);
  assert.deepEqual(op.roles, ['ADMIN', 'ASESOR', 'CALIDAD', 'CLIENTES_DASH']);
  assert.deepEqual(op.campanas, ['HOSPITAL LA MARIA', 'MOBILIZE', 'ORLANT', 'SURA']);
});

// renderUsers real (users.js) en un sandbox con un DOM minimo.
function sandbox({ admin = true }) {
  const els = {};
  const el = (id) => (els[id] = els[id] || { id, innerHTML: '', textContent: '', value: '', classList: { add() {}, remove() {} } });
  const ctx = {
    console,
    document: { getElementById: (id) => el(id) },
    users: USUARIOS,
    RL: { CALIDAD: 'CALIDAD', ASESOR: 'ASESOR', CLIENTES_DASH: 'CLIENTE', ADMIN: 'ADMINISTRADOR' },
    CAMPANAS_CALIDAD: ['ORLANT', 'MOBILIZE'],
    CLIENTES_LIST: ['ORLANT', 'MOBILIZE', 'SURA'],
    isFullAdmin: () => admin,
    canAccessRole: (r) => r === 'ASESOR' || r === 'CALIDAD',
    can: () => true,
    esc: (s) => String(s == null ? '' : s),
    calEstadoHtml: (s) => s,
    updateStats: () => {},
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(JSDIR, 'usuarios-filtro-logic.js'), 'utf8'), ctx);
  const src = fs.readFileSync(path.join(JSDIR, 'users.js'), 'utf8');
  vm.runInContext(src.slice(0, src.indexOf('function buildClientCheckboxes')), ctx);
  return { ctx, el };
}

test('la tabla aplica rol + campaña + texto y dice cuántos muestra', () => {
  const { ctx, el } = sandbox({});
  ctx.renderUsers('');
  assert.equal(el('users-conteo').textContent, '5 usuarios');
  assert.match(el('user-filtro-rol').innerHTML, /<option value="CLIENTES_DASH">CLIENTE<\/option>/);
  assert.match(el('user-filtro-campana').innerHTML, /<option value="SURA">SURA<\/option>.*Sin campaña ni cliente/);
  el('user-filtro-rol').value = 'ASESOR';
  el('user-filtro-campana').value = 'MOBILIZE';
  ctx.renderUsers('');
  assert.equal(el('users-conteo').textContent, 'Mostrando 1 de 5 usuarios');
  assert.match(el('users-tbody').innerHTML, /Eva/);
  assert.doesNotMatch(el('users-tbody').innerHTML, /Beto/);
});

test('el auxiliar admin sigue sin ver administradores ni roles a los que no tiene acceso', () => {
  const { ctx, el } = sandbox({ admin: false });
  ctx.renderUsers('');
  assert.equal(el('users-conteo').textContent, '3 usuarios');
  assert.doesNotMatch(el('users-tbody').innerHTML, /Dora|Carla/);
  assert.doesNotMatch(el('user-filtro-rol').innerHTML, /ADMIN|CLIENTES_DASH/);
});

test('index.html: los 2 filtros, el conteo y el script antes de users.js', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  assert.match(html, /<select class="hist-filter-sel" id="user-filtro-rol" aria-label="Filtrar por rol" onchange="filterUsers\(\)">/);
  assert.match(html, /<select class="hist-filter-sel" id="user-filtro-campana" aria-label="Filtrar por campaña o cliente" onchange="filterUsers\(\)">/);
  assert.match(html, /id="users-conteo" role="status"/);
  assert.ok(html.indexOf('js/usuarios-filtro-logic.js') > -1 && html.indexOf('js/usuarios-filtro-logic.js') < html.indexOf('js/users.js'));
});
