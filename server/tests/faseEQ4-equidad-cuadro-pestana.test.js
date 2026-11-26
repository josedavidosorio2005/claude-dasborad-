// faseEQ4-equidad-cuadro-pestana.test.js — pedido de Edwin (26/11/2026, aclarado por el usuario): SIN tarjeta en el
// menú principal; en la pestaña «Equidad profesionales» del Dashboard de ORLANT, un CUADRO con ese título que al hacer
// clic abre la vista de siempre (por mes, con sus 3 pestañas) en su pantalla. No cambia la carga ni los datos.
// + De paso (usuario, 26/11): a 375 px los botones de la ventana de Wolkvox caben (2 columnas). Sin datos reales.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const PUB = path.join(__dirname, '..', '..', 'public');
const leer = (f) => fs.readFileSync(path.join(PUB, f), 'utf8');
global.esc = require('../../public/js/esc.js').esc;
const E = require('../../public/js/orlant-equidad.js');
let admin;
before(async () => { admin = await tokenFor('admin', MASTER_PASSWORD); });

test('el cuadro: un botón con el título «Equidad profesionales» que abre la vista; dice las bases y cuántas citas hay', () => {
  const h = E.equidadCuadroHtml({ total: 1234, meses: ['2026-10', '2026-11'], grupos: [{ nombre: 'Pólizas' }, { nombre: 'Medicina prepagada' }, { nombre: 'Particulares' }] });
  assert.match(h, /^<button type="button" class="aurora-card eq-cuadro" onclick="openOrlantEquidad\(\)"/);
  assert.match(h, /<span class="aurora-card-title eq-cuadro-titulo">Equidad profesionales<\/span>/);
  assert.match(h, /Citas por profesional, por mes: Pólizas, Medicina prepagada, Particulares/);
  assert.match(h, /1\.234 citas cargadas · 2 meses/);
  assert.match(h, /Abrir →/);
  assert.match(E.equidadCuadroHtml(null), /Todavía no hay citas cargadas/, 'sin datos también se pinta (y abre el aviso de la vista)');
  assert.match(E.equidadCuadroHtml({ total: 1, meses: ['2026-11'], grupos: [{ nombre: '<b>x</b>' }] }), /&lt;b&gt;x&lt;\/b&gt;/, 'nombres escapados');
});

test('la pestaña pinta el cuadro (no la vista adentro) y la vista se abre en su pantalla con la misma app', () => {
  const js = leer('js/orlant-equidad.js');
  const panel = js.slice(js.indexOf('async function _equidadRenderPanel'), js.indexOf('// «Exportar»'));
  assert.match(panel, /host\.innerHTML = equidadCuadroHtml\(datos\);/);
  assert.ok(!/attachShadow/.test(panel), 'la pestaña ya no monta la vista adentro');
  const abrir = js.slice(js.indexOf('async function openOrlantEquidad'), js.indexOf('function closeOrlantEquidad'));
  assert.match(abrir, /_eqOv\.root\.innerHTML = _eqHojaCss\(\) \+ EQ_MARKUP;/);
  assert.match(abrir, /eqCrearApp\(_eqOv\.root, \{ estado: _eqCargarEstado \}\)/);
  assert.match(js, /apiRequest\('GET', '\/orlant\/equidad\/estado'\)/, 'la misma ruta de siempre');
  // Al cerrar encima del Dashboard, el fondo sigue sin scroll.
  assert.match(js, /document\.body\.style\.overflow = tablero && tablero\.classList\.contains\('show'\) \? 'hidden' : '';/);
});

test('sin tarjeta en el menú principal', () => {
  assert.ok(!/eqPintarTarjeta|EQ_TARJETA/.test(leer('js/dashboards-core.js') + leer('js/orlant-equidad.js')));
});

test('la pantalla sigue: diálogo con título y Cerrar, Escape y «cerrar todo» la cierran; estilos del cuadro', () => {
  const html = leer('index.html');
  assert.match(html, /<div role="dialog" aria-modal="true" aria-labelledby="eq-title" id="eq-overlay">/);
  assert.match(html, /<h2 id="eq-title">Equidad profesionales<\/h2>/);
  assert.ok(html.indexOf('id="eq-overlay"') > html.indexOf('id="gd-overlay"'), 'va después del Dashboard: se abre encima');
  assert.match(leer('js/motion-helpers.js'), /'eq-overlay': function \(\) \{ if \(typeof closeOrlantEquidad === 'function'\) closeOrlantEquidad\(\); \}/);
  assert.match(leer('js/cerrar-ventanas.js'), /'eq-overlay': 'closeOrlantEquidad'/);
  const css = leer('css/styles.css');
  assert.match(css, /\.eq-cuadro\{display:flex;[^}]*cursor:pointer;[^}]*min-height:44px\}/);
  assert.match(css, /\.eq-cuadro:focus-visible\{outline:2px solid var\(--c-focus\)/);
});

test('ventana de Wolkvox a 375 px: los botones van en 2 columnas que caben, en el orden de siempre', () => {
  const css = leer('css/styles.css');
  assert.match(css, /@media \(max-width:480px\)\{#modal-wolkvox \.modal-btns\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\);gap:8px\}#modal-wolkvox \.modal-btns button\{width:100%;min-height:44px;margin:0\}\}/);
  assert.ok(!/#wv-probar-btn\{order/.test(css), 'sin cambiar el orden del teclado');
});

test('el servidor sigue igual: el administrador lee el estado; sin sesión, 401', async () => {
  const r = await request(app).get('/api/orlant/equidad/estado').set({ Authorization: 'Bearer ' + admin });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.grupos.map((g) => g.id), ['polizas', 'prepagada', 'particulares']);
  assert.equal((await request(app).get('/api/orlant/equidad/estado')).status, 401);
});
