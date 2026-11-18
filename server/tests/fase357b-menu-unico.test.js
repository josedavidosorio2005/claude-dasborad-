// fase357b-menu-unico.test.js — Fase 357 B (pedido de Edwin, 17/11): los internos entran al mismo
// menú de tarjetas que el cliente, con solo sus módulos, más «Administración» (ADMIN) y
// «Mi portal» (SUPERVISOR).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const L = require('../../public/js/dashboards-logic.js');
const PUB = path.join(__dirname, '..', '..', 'public');
const leer = (r) => fs.readFileSync(path.join(PUB, r), 'utf8');
const keys = (a) => a.map((t) => t.key);

test('pantalla de entrada: tarjetas para todos los internos; Auxiliar Admin a su panel; asesora a su portal', () => {
  assert.equal(L.dashPantallaDeEntrada(null, true), 'tarjetas'); // admin maestro
  for (const r of ['ADMIN', 'SUPERVISOR', 'GERENCIA', 'REPORTES', 'CALIDAD', 'CLIENTES_DASH', 'SISTEMAS', 'INVENTARIO']) assert.equal(L.dashPantallaDeEntrada(r, false), 'tarjetas', r);
  assert.equal(L.dashPantallaDeEntrada('AUX_ADMIN', false), 'admin');
  assert.equal(L.dashPantallaDeEntrada('ASESOR', false), 'asesor');
});

test('tarjetas de entrada: Administración solo ADMIN (y Auxiliar Admin), Mi portal solo SUPERVISOR, Cargar Datos si puede cargar', () => {
  // Fase 358: + «Malla de turnos» para ADMIN, SUPERVISOR y REPORTES.
  assert.deepEqual(keys(L.dashTarjetasEntrada('ADMIN', true, true)), ['admin', 'malla', 'cargar', 'tickets']);
  assert.deepEqual(keys(L.dashTarjetasEntrada('ADMIN', true, false)), ['admin', 'malla', 'tickets']);
  assert.deepEqual(keys(L.dashTarjetasEntrada('SUPERVISOR', false, true)), ['portal', 'malla', 'cargar', 'tickets']);
  assert.deepEqual(keys(L.dashTarjetasEntrada('SUPERVISOR', false, false)), ['portal', 'malla', 'tickets']);
  assert.deepEqual(keys(L.dashTarjetasEntrada('AUX_ADMIN', false, false)), ['admin', 'tickets']);
  assert.deepEqual(keys(L.dashTarjetasEntrada('REPORTES', false, false)), ['malla', 'tickets']);
  for (const r of ['GERENCIA', 'CALIDAD', 'CLIENTES_DASH', 'SISTEMAS']) {
    assert.deepEqual(keys(L.dashTarjetasEntrada(r, false, false)), ['tickets'], r); // Fase 364: Tickets para todos
    assert.ok(!keys(L.dashTarjetasEntrada(r, false, true)).includes('admin'), r);
  }
  const t = L.dashTarjetasEntrada('ADMIN', true, false)[0];
  assert.equal(t.label, 'Administración');
  assert.equal(t.accion, 'enterAdminPanel');
  assert.equal(L.dashTarjetasEntrada('SUPERVISOR', false, false)[0].accion, 'enterSupervisorPage');
});

test('módulos del menú: los mismos de siempre, por permiso (el administrador ve todos)', () => {
  const mods = [{ key: 'Calidad' }, { key: 'ClientesDash' }, { key: 'Gerencia' }, { key: 'Inventario' }];
  assert.deepEqual(L.dashModulosVisibles(mods, null, true).map((m) => m.key), ['Calidad', 'ClientesDash', 'Gerencia', 'Inventario']);
  assert.deepEqual(L.dashModulosVisibles(mods, { perms: { ClientesDash: true, Calidad: true } }, false).map((m) => m.key), ['Calidad', 'ClientesDash']);
});

test('cableado: entrada por dashPantallaDeEntrada, «Inicio» en el panel y en el portal, el maestro sin currentUser', () => {
  const s = leer('js/session.js');
  assert.match(s, /currentUser = null; \/\/ null = admin maestro[\s\S]*?enterUserDashboard\(\); \/\/ Fase 357 \(B\)/);
  assert.match(s, /var pantalla = dashPantallaDeEntrada\(currentUser\.rol, false\);/);
  assert.match(s, /var nombreEntrada = currentUser \? currentUser\.nombre : 'Administrador';/);
  const i = leer('index.html');
  assert.match(i, /id="menu-inicio" role="button" tabindex="0" onclick="enterUserDashboard\(\)"/);
  assert.match(i, /id="supervisor-menu-inicio" role="button" tabindex="0" onclick="enterUserDashboard\(\)"/);
  assert.match(leer('js/dashboards-core.js'), /dashTarjetasEntrada\(rolActual, isFullAdmin\(\), puedeCargar\)/);
});
