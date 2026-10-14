// fase144-a3-dialogos.test.js — Fase 144 (A3). Hallazgos D04 (P0: el foco
// quedaba DETRAS del dialogo; 31 de 45 Tab recorrian la pagina oculta; al
// cerrar el foco caia en <body>) y D11 (menu Exportar: el foco no entraba,
// 12 Tab para llegar a "Excel", sin aria-haspopup/aria-expanded) de la Fase
// 143. El comportamiento real se verifico en navegador (Playwright + Brave);
// estas pruebas fijan la estructura que lo hace posible.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, '..', '..', 'public');
const leer = (rel) => fs.readFileSync(path.join(PUB, rel), 'utf8');
const OVERLAYS = ['dashcfg-overlay', 'gd-overlay', 'calidad-overlay', 'cargas-overlay', 'detalle-monitoreo-overlay', 'supervisar-lider-overlay'];

test('index.html: los 6 overlays son role="dialog" aria-modal="true" con un titulo real enlazado', () => {
  const html = leer('index.html');
  for (const id of OVERLAYS) {
    const tag = (html.match(new RegExp('<div [^>]*id="' + id + '"[^>]*>')) || [])[0];
    assert.ok(tag, id + ' existe');
    assert.match(tag, /role="dialog"/, id);
    assert.match(tag, /aria-modal="true"/, id);
    const titulo = (tag.match(/aria-labelledby="([^"]+)"/) || [])[1];
    assert.ok(titulo, id + ' tiene aria-labelledby');
    assert.match(html, new RegExp('<h2 id="' + titulo + '"'), id + ' -> el titulo enlazado existe y es un <h2>');
  }
});

test('index.html: el boton Exportar anuncia su menu (aria-haspopup="menu", aria-expanded)', () => {
  const tag = leer('index.html').match(/<button[^>]*id="gd-export-btn"[^>]*>/)[0];
  assert.match(tag, /aria-haspopup="menu"/);
  assert.match(tag, /aria-expanded="false"/);
});

test('motion-helpers.js: al abrir guarda el disparador, deja el fondo inerte y enfoca el dialogo; al cerrar devuelve el foco', () => {
  const src = leer('js/motion-helpers.js');
  const abrir = src.slice(src.indexOf('function motionAbrirModal'), src.indexOf('function motionCerrarModal'));
  assert.match(abrir, /modal\._motionDisparador = activo/);
  assert.match(abrir, /_motionAplicarInert\(\)/);
  assert.match(abrir, /_motionEnfocar\(modal, true\)/);
  const cerrar = src.slice(src.indexOf('function motionCerrarModal'), src.indexOf('var MOTION_MODALES_ESC'));
  assert.ok(cerrar.indexOf('cerrarReal();') < cerrar.indexOf('_motionDevolverFoco(modal)'), 'el foco se devuelve DESPUES del cierre real');
  assert.match(cerrar, /_motionAplicarInert\(\)/);
});

test('motion-helpers.js: inert solo en lo que marca (data-motion-inert), sube hasta <body> (dialogo anidado) y nunca toca #toast', () => {
  const src = leer('js/motion-helpers.js');
  const f = src.slice(src.indexOf('function _motionAplicarInert'), src.indexOf('function _motionEnfocables'));
  assert.match(f, /querySelectorAll\('\[data-motion-inert\]'\)/);
  assert.match(f, /removeAttribute\('inert'\)/);
  assert.match(f, /while \(nodo && nodo !== document\.body/);
  assert.match(f, /h\.id === 'toast'/);
  assert.match(f, /h\.hasAttribute\('inert'\)/, 'no pisa un inert ajeno');
});

test('motion-helpers.js: Tab y Shift+Tab dan la vuelta dentro del dialogo de mas arriba', () => {
  const src = leer('js/motion-helpers.js');
  assert.match(src, /if \(e\.key !== 'Tab'\) return;/);
  assert.match(src, /e\.shiftKey && \(a === primero/);
  assert.match(src, /!e\.shiftKey && a === ultimo/);
});

test('motion-helpers.js sigue cargando en Node con los mismos exports (Fase 136/137 intactas)', () => {
  const m = require('../../public/js/motion-helpers.js');
  for (const k of ['motionExit', 'motionEnter', 'motionAbrirModal', 'motionCerrarModal', 'motionRegistrarPopupInterno', 'motionDesregistrarPopupInterno']) {
    assert.equal(typeof m[k], 'function', k);
  }
});

test('dashboard-generic.js: menu Exportar con role menu/menuitem, dentro de #gd-overlay, aria-expanded y teclado', () => {
  const src = leer('js/dashboard-generic.js');
  const f = src.slice(src.indexOf('function _gdExportCerrar'), src.indexOf('function _gdExportClickAfuera'));
  assert.match(f, /setAttribute\('role', 'menu'\)/);
  assert.equal((f.match(/role="menuitem" tabindex="-1"/g) || []).length, 2);
  assert.match(f, /document\.getElementById\('gd-overlay'\) \|\| document\.body\)\.appendChild\(m\)/);
  assert.match(f, /setAttribute\('aria-expanded', 'true'\)/);
  assert.match(f, /setAttribute\('aria-expanded', 'false'\)/);
  assert.match(f, /primero\.focus\(\)/, 'el foco entra al primer item');
  for (const k of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Tab']) assert.match(f, new RegExp("'" + k + "'"), k);
  assert.match(f, /motionRegistrarPopupInterno\('gd-export-menu'/, 'Escape sigue cerrando SOLO el menu (Fase 137)');
});

test('styles.css: el contenedor de los 6 dialogos NO pierde el anillo de foco (nada de outline:none para ellos)', () => {
  const css = leer('css/styles.css');
  assert.doesNotMatch(css, /#(calidad|detalle-monitoreo|supervisar-lider|cargas|dashcfg|gd)-modal:focus\{outline:none/);
  assert.match(css, /\[tabindex\]:focus-visible/, 'la regla global que lo dibuja sigue existiendo');
});
