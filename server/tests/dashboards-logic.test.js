// dashboards-logic.test.js — cubre public/js/dashboards-logic.js (Fase 83):
// que modulos/clientes/roles arma la interfaz a partir de los permisos
// reales del usuario, sin mostrar tarjetas "Sin acceso". Datos SIEMPRE
// inventados. Pruebas de DOM (que dashboards-core.js/roles-perms.js
// realmente pinten esto) van por Playwright, no aqui -- esta suite cubre
// la logica PURA que decide que se pinta.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dashModulosVisibles, dashClientesVisibles, dashRolesVisibles } = require('../../public/js/dashboards-logic.js');

const MODULOS = [
  { key: 'Calidad', label: 'Calidad' },
  { key: 'Inventario', label: 'Inventario' },
  { key: 'Gerencia', label: 'Gerencia' },
  { key: 'GestionHumana', label: 'Gestion Humana' },
  { key: 'ClientesDash', label: 'Dashboard Clientes' },
];

test('dashModulosVisibles: un rol acotado a un solo modulo (perms.X=true) solo recibe ESE modulo', () => {
  const currentUser = { rol: 'CLIENTES_DASH', perms: { ClientesDash: true } };
  const visibles = dashModulosVisibles(MODULOS, currentUser, false);
  assert.deepEqual(visibles.map((m) => m.key), ['ClientesDash']);
});

test('dashModulosVisibles: un rol con 2 modulos (Calidad + Gerencia) recibe exactamente esos 2, en su orden original', () => {
  const currentUser = { rol: 'GERENCIA', perms: { Calidad: true, Gerencia: true } };
  const visibles = dashModulosVisibles(MODULOS, currentUser, false);
  assert.deepEqual(visibles.map((m) => m.key), ['Calidad', 'Gerencia']);
});

test('dashModulosVisibles: sin ningun permiso -> lista vacia (nunca modulos con "Sin acceso")', () => {
  const currentUser = { rol: 'ASESOR', perms: {} };
  const visibles = dashModulosVisibles(MODULOS, currentUser, false);
  assert.deepEqual(visibles, []);
});

test('dashModulosVisibles: isFullAdmin=true (ADMIN o admin maestro) recibe TODOS los modulos, sin importar perms', () => {
  const currentUser = { rol: 'ADMIN', perms: {} };
  const visibles = dashModulosVisibles(MODULOS, currentUser, true);
  assert.deepEqual(visibles.map((m) => m.key), MODULOS.map((m) => m.key));
  // admin maestro: currentUser===null en la app real, pero la funcion no debe reventar con null.
  const visiblesMaestro = dashModulosVisibles(MODULOS, null, true);
  assert.deepEqual(visiblesMaestro.map((m) => m.key), MODULOS.map((m) => m.key));
});

test('dashModulosVisibles: un modulo "soon" (aun no construido) siempre se ve, tenga o no el permiso', () => {
  const modulosConSoon = MODULOS.concat([{ key: 'Futuro', label: 'Futuro', soon: true }]);
  const currentUser = { rol: 'CLIENTES_DASH', perms: { ClientesDash: true } };
  const visibles = dashModulosVisibles(modulosConSoon, currentUser, false);
  assert.deepEqual(visibles.map((m) => m.key), ['ClientesDash', 'Futuro']);
});

test('dashModulosVisibles: perms[key] truthy-pero-no-true (ej. 1, "si") NO cuenta -- exige === true exacto', () => {
  const currentUser = { rol: 'CLIENTES_DASH', perms: { ClientesDash: 1, Calidad: 'si' } };
  const visibles = dashModulosVisibles(MODULOS, currentUser, false);
  assert.deepEqual(visibles, []);
});

const CLIENTES = ['ORLANT', 'CLINICA AURORA', 'HOSPITAL LA MARIA'];

test('dashClientesVisibles: solo los clientes con perms.cliente_X === true', () => {
  const currentUser = { perms: { 'cliente_ORLANT': true, 'cliente_CLINICA AURORA': false } };
  assert.deepEqual(dashClientesVisibles(CLIENTES, currentUser, false), ['ORLANT']);
});

test('dashClientesVisibles: isFullAdmin ve todos los clientes', () => {
  assert.deepEqual(dashClientesVisibles(CLIENTES, { perms: {} }, true), CLIENTES);
});

test('dashClientesVisibles: sin currentUser (no logueado) -> lista vacia, nunca revienta', () => {
  assert.deepEqual(dashClientesVisibles(CLIENTES, null, false), []);
});

const ROLES = [
  { key: 'ADMIN', label: 'ADMIN' },
  { key: 'AUX_ADMIN', label: 'AUX_ADMIN' },
  { key: 'CALIDAD', label: 'CALIDAD' },
  { key: 'INVENTARIO', label: 'INVENTARIO' },
];

test('dashRolesVisibles: un Auxiliar Admin NUNCA ve ADMIN/AUX_ADMIN, y solo los roles regulares con canAccessRole', () => {
  const puedeAcceder = (key) => key === 'CALIDAD';
  const visibles = dashRolesVisibles(ROLES, false, puedeAcceder);
  assert.deepEqual(visibles.map((r) => r.key), ['CALIDAD']);
});

test('dashRolesVisibles: isFullAdmin ve TODOS los roles, incluidos ADMIN/AUX_ADMIN', () => {
  const visibles = dashRolesVisibles(ROLES, true, () => false);
  assert.deepEqual(visibles.map((r) => r.key), ROLES.map((r) => r.key));
});

test('dashRolesVisibles: sin ningun role_X asignado -> lista vacia', () => {
  assert.deepEqual(dashRolesVisibles(ROLES, false, () => false), []);
});
