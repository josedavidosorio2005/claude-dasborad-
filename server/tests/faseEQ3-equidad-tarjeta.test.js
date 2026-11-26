// faseEQ3-equidad-tarjeta.test.js — pedido de Edwin (reunión 26/11/2026): tarjeta «Equidad profesionales» en el
// menú principal, igual que «Gestión STA»; al hacer clic abre la vista de siempre (por mes, con sus 3 pestañas) en
// su propia pantalla. No cambia la carga ni los datos; la pestaña del Dashboard de ORLANT sigue igual. Sin datos reales.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const PUB = path.join(__dirname, '..', '..', 'public');
const leer = (f) => fs.readFileSync(path.join(PUB, f), 'utf8');
const E = require('../../public/js/orlant-equidad.js');
let admin;
before(async () => { admin = await tokenFor('admin', MASTER_PASSWORD); });

test('la tarjeta: título «Equidad profesionales», abre openOrlantEquidad', () => {
  assert.equal(E.EQ_TARJETA.label, 'Equidad profesionales');
  assert.equal(E.EQ_TARJETA.key, 'equidad');
  assert.equal(E.EQ_TARJETA.accion, 'openOrlantEquidad');
});

test('quién podría verla antes de preguntar al servidor: admin, gerencia y quien tiene ORLANT; nadie más', () => {
  assert.equal(E.eqPodriaVerTarjeta(null, true), true);
  assert.equal(E.eqPodriaVerTarjeta({ rol: 'GERENCIA', perms: {} }, false), true);
  for (const k of ['campana_ORLANT', 'cliente_ORLANT', 'supervisa_ORLANT']) assert.equal(E.eqPodriaVerTarjeta({ rol: 'SUPERVISOR', perms: { [k]: true } }, false), true, k);
  assert.equal(E.eqPodriaVerTarjeta({ rol: 'CLIENTES_DASH', perms: { cliente_ORLANT: true } }, false), true, 'el servidor decide (opción del cliente)');
  assert.equal(E.eqPodriaVerTarjeta({ rol: 'SUPERVISOR', perms: { campana_MOBILIZE: true } }, false), false);
  assert.equal(E.eqPodriaVerTarjeta({ rol: 'ASESOR', asesorCampana: 'ORLANT', perms: {} }, false), false);
  assert.equal(E.eqPodriaVerTarjeta(null, false), false);
});

test('la pantalla existe (diálogo con título y Cerrar), se cierra con Escape y el menú la pinta', () => {
  const html = leer('index.html');
  assert.match(html, /<div role="dialog" aria-modal="true" aria-labelledby="eq-title" id="eq-overlay">/);
  assert.match(html, /<h2 id="eq-title">Equidad profesionales<\/h2>/);
  assert.match(html, /onclick="closeOrlantEquidad\(\)">X Cerrar<\/button>/);
  assert.match(html, /<div id="eq-host"><\/div>/);
  assert.ok(html.indexOf('js/orlant-equidad-app.js') !== -1 && html.indexOf('js/orlant-equidad.js') !== -1);
  const mh = leer('js/motion-helpers.js');
  const esc = mh.slice(mh.indexOf('var MOTION_MODALES_ESC = {'), mh.indexOf('};', mh.indexOf('var MOTION_MODALES_ESC = {')));
  assert.match(esc, /'eq-overlay': function \(\) \{ if \(typeof closeOrlantEquidad === 'function'\) closeOrlantEquidad\(\); \}/, 'Escape la cierra (pantalla completa, como el tablero)');
  assert.match(leer('js/cerrar-ventanas.js'), /'eq-overlay': 'closeOrlantEquidad'/, 'se cierra al cerrar sesión o al entrar/salir de «ver como»');
  assert.match(leer('js/dashboards-core.js'), /eqPintarTarjeta\(grid, tarjetaEntrada, currentUser, isFullAdmin\(\)\)/);
  const css = leer('css/styles.css');
  assert.match(css, /#eq-overlay\{display:none;position:fixed;inset:0;/);
  assert.match(css, /#eq-overlay\.show\{display:block;\}/);
});

test('la vista es la misma de la pestaña (EQ_MARKUP + eqCrearApp con /orlant/equidad/estado); la pestaña no cambia', () => {
  const js = leer('js/orlant-equidad.js');
  const abrir = js.slice(js.indexOf('async function openOrlantEquidad'), js.indexOf('function closeOrlantEquidad'));
  assert.match(abrir, /_eqOv\.root\.innerHTML = _eqHojaCss\(\) \+ EQ_MARKUP;/);
  assert.match(abrir, /eqCrearApp\(_eqOv\.root, \{ estado: _eqCargarEstado \}\)/);
  assert.match(js, /apiRequest\('GET', '\/orlant\/equidad\/estado'\)/);
  assert.match(js, /if\(p\.tipo === 'equidad_panel'\)|async function _equidadRenderPanel/);
});

test('el servidor sigue igual: el administrador lee el estado; sin sesión, 401', async () => {
  const r = await request(app).get('/api/orlant/equidad/estado').set({ Authorization: 'Bearer ' + admin });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.grupos.map((g) => g.id), ['polizas', 'prepagada', 'particulares']);
  assert.equal((await request(app).get('/api/orlant/equidad/estado')).status, 401);
});
