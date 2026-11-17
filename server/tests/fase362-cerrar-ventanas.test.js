// fase362-cerrar-ventanas.test.js — Fase 362: al cerrar sesión y al entrar o salir de «ver como» se
// cierra toda ventana abierta (antes la de Calidad quedaba abierta para la persona siguiente).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');
const { cerrarVentanasAbiertas, CERRAR_VENTANAS_SELECTOR, CERRAR_VENTANAS_FUNCIONES } = require('../../public/js/cerrar-ventanas.js');

// DOM mínimo: elementos con id, clases y un querySelectorAll que entiende el selector de la función.
function dom(ventanas) {
  const els = ventanas.map(([id, clases]) => {
    const set = new Set(clases);
    return { id, classList: { contains: (c) => set.has(c), remove: (c) => set.delete(c), add: (c) => set.add(c) }, set };
  });
  const coincide = (el) => el.set.has('show') && (el.set.has('modal-overlay') || el.set.has('clients-modal-overlay') || /-overlay$/.test(el.id));
  return { els, doc: { body: { style: { overflow: 'hidden' } }, querySelectorAll: (sel) => { assert.equal(sel, CERRAR_VENTANAS_SELECTOR); return els.filter(coincide); } } };
}

test('cierra Calidad con su función (libera lo suyo) y quita «show» aunque la función tenga animación', () => {
  const { els, doc } = dom([['calidad-overlay', ['show']], ['modal-user', ['modal-overlay', 'show']], ['gd-overlay', []], ['menu-x', ['show']]]);
  const llamadas = [];
  const n = cerrarVentanasAbiertas(doc, { closeCalidad: () => llamadas.push('calidad') /* animada: no quita show */ });
  assert.equal(n, 2);
  assert.deepEqual(llamadas, ['calidad']);
  assert.ok(!els[0].set.has('show'), 'Calidad cerrada');
  assert.ok(!els[1].set.has('show'), 'diálogo genérico cerrado');
  assert.ok(els[3].set.has('show'), 'lo que no es ventana no se toca');
  assert.equal(doc.body.style.overflow, '');
});

test('si la función de cierre falla, la ventana igual se cierra; las cerradas no llaman a su función', () => {
  const { els, doc } = dom([['stv-overlay', ['show']], ['inventario-overlay', []]]);
  const llamadas = [];
  cerrarVentanasAbiertas(doc, { closeSuraTeleventas: () => { throw new Error('x'); }, closeInventario: () => llamadas.push('inv') });
  assert.ok(!els[0].set.has('show'));
  assert.deepEqual(llamadas, [], 'no se llama a cerrar una ventana que no estaba abierta');
});

test('cada ventana de index.html la cubre el selector, y cada función de cierre existe', () => {
  const html = PUB('index.html');
  const ids = [...html.matchAll(/<div ([^>]*)id="([a-z0-9-]+)"/g)].filter(([, attrs, id]) => /class="(clients-)?modal-overlay"/.test(attrs) || /-overlay$/.test(id)).map((m) => m[2]);
  assert.ok(ids.includes('calidad-overlay') && ids.includes('modal-user') && ids.includes('stv-overlay'));
  const js = fs.readdirSync(path.join(__dirname, '..', '..', 'public', 'js')).filter((f) => f.endsWith('.js')).map((f) => PUB('js/' + f)).join('\n');
  for (const [id, fn] of Object.entries(CERRAR_VENTANAS_FUNCIONES)) {
    assert.ok(ids.includes(id), 'existe la ventana ' + id);
    assert.ok(new RegExp('function ' + fn + '\\s*\\(').test(js), 'existe ' + fn);
  }
});

test('doLogout (antes de borrar el token) y la limpieza de «ver como» la llaman; se carga antes de session.js', () => {
  const ses = PUB('js/session.js');
  const logout = ses.slice(ses.indexOf('function doLogout'), ses.indexOf('\n}', ses.indexOf('function doLogout')));
  assert.ok(logout.includes('cerrarVentanasAbiertas()'));
  assert.ok(logout.indexOf('cerrarVentanasAbiertas()') < logout.indexOf('authToken=null'), 'antes de borrar el token');
  const vc = PUB('js/ver-como.js');
  const limpiar = vc.slice(vc.indexOf('function _verComoLimpiarPantalla'), vc.indexOf('\n}', vc.indexOf('function _verComoLimpiarPantalla')));
  assert.ok(limpiar.includes('cerrarVentanasAbiertas()'));
  const html = PUB('index.html');
  assert.ok(html.indexOf('js/cerrar-ventanas.js') > 0 && html.indexOf('js/cerrar-ventanas.js') < html.indexOf('js/session.js'));
});
