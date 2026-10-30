// fase175-tablero-celular.test.js — Fase 175: encabezado del tablero compacto
// hasta 768 px (antes 354 px de 812 a 375 px). Los filtros del encabezado
// (MES, MESES, VISTA, COMPARAR) se pliegan en el boton "Filtros: <mes>"; en
// escritorio no cambia nada (el contenedor es display:contents y el boton no
// se ve). Lee index.html/styles.css como texto (criterio de la Fase 164) y
// prueba las funciones nuevas de dashboard-generic.js con un DOM minimo; la
// verificacion en navegador real (375/768/1440, claro y oscuro, pixel a pixel
// en escritorio) esta en el PR.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PUB = path.join(__dirname, '..', '..', 'public');
const HTML = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
const CSS = fs.readFileSync(path.join(PUB, 'css', 'styles.css'), 'utf8');
const JS = fs.readFileSync(path.join(PUB, 'js', 'dashboard-generic.js'), 'utf8');
const SPRITE = fs.readFileSync(path.join(PUB, 'img', 'iconos', 'lucide.svg'), 'utf8');

// Texto entre una llave de apertura en `desde` y su cierre (llaves balanceadas).
function bloque(txt, desde) {
  let i = txt.indexOf('{', desde) + 1, prof = 1;
  while (prof && i < txt.length) { if (txt[i] === '{') prof++; else if (txt[i] === '}') prof--; i++; }
  return txt.slice(desde, i);
}
const iFase175 = CSS.indexOf('/* Fase 175: encabezado del tablero');
const CSS175 = CSS.slice(iFase175);
const media768 = bloque(CSS175, CSS175.indexOf('@media(max-width:768px)'));
const media480 = bloque(CSS175, CSS175.indexOf('@media(max-width:480px)'));
const fuera = CSS175.slice(0, CSS175.indexOf('@media(max-width:768px)'));

test('HTML: los 4 filtros y la nota van dentro de #gd-filtros-header; el boton lo controla', () => {
  const ini = HTML.indexOf('<div id="gd-filtros-header"');
  assert.ok(ini > 0, 'falta #gd-filtros-header');
  const cont = bloqueDiv(HTML, ini);
  for (const id of ['gd-vista-wrap', 'gd-meses-wrap', 'gd-comp-wrap', 'gd-comp-nota']) assert.ok(cont.includes('id="' + id + '"'), id); // Fase 201: sin MES
  assert.match(HTML, /<button class="aurora-close gd-filtros-header-btn" id="gd-filtros-btn" type="button" aria-expanded="false" aria-controls="gd-filtros-header" onclick="gdFiltrosHeaderToggle\(\)">/);
  assert.match(SPRITE, /<symbol id="i-sliders-horizontal" viewBox="0 0 24 24">/);
  // Actualizar y Exportar: nombre accesible aunque en el telefono solo se vea el icono.
  assert.match(HTML, /id="gd-actualizar-btn" aria-label="Actualizar datos"/);
  assert.match(HTML, /id="gd-export-btn" aria-label="Exportar" aria-haspopup="menu"/);
});

function bloqueDiv(txt, desde) {
  const re = /<\/?div\b/g; re.lastIndex = desde; let prof = 0, m;
  while ((m = re.exec(txt))) { prof += m[0] === '<div' ? 1 : -1; if (!prof) return txt.slice(desde, m.index); }
  return txt.slice(desde);
}

test('escritorio sin cambios: contenedor display:contents, boton Filtros e icono de Exportar ocultos', () => {
  assert.match(fuera, /\.gd-filtros-header\{display:contents;\}/);
  assert.match(fuera, /#gd-modal \.gd-filtros-header-btn,#gd-modal \.gd-icono-movil\{display:none;\}/);
  // Ninguna otra regla nueva fuera de los @media.
  assert.equal(fuera.replace(/\/\*[\s\S]*?\*\//g, '').trim().split('\n').filter((l) => l.trim()).length, 2);
});

test('<=768 px: filtros plegados, una fila de botones con solo iconos, Cerrar arriba a la derecha', () => {
  assert.match(media768, /#gd-modal \.gd-filtros-header\{display:none;\}/);
  assert.match(media768, /#gd-modal \.gd-filtros-header\.gd-filtros-abierto\{display:grid;[^}]*order:3;\}/);
  assert.match(media768, /#gd-modal \.gd-header-acciones\{flex:1 1 100%;flex-wrap:nowrap;/);
  assert.match(media768, /#gd-modal \.gd-header-acciones \.gd-btn-txt\{display:none;\}/);
  assert.match(media768, /#gd-modal \.gd-header-acciones \.aurora-close\.hidden\{display:none;\}/);
  assert.match(media768, /#gd-modal #gd-cerrar-btn\{position:absolute;/);
  // Fase 218: 18px sigue siendo el alto por defecto; el cliente puede traer el suyo (ORLANT, 22px).
  assert.match(media768, /#gd-modal \.gd-cliente-logo\{height:var\(--gd-logo-alto-movil,18px\);/);
  assert.match(media768, /#gd-modal \.gd-filtros-header select\{min-height:44px;/);
  // Sin colores nuevos (sistema de diseno): solo tokens y el blanco translucido ya usado por .aurora-close.
  assert.doesNotMatch(CSS175, /#[0-9a-f]{3,6}\b/i);
  assert.doesNotMatch(CSS175.replace(/rgba\(255,255,255,0\.28\)/g, ''), /rgba?\(/);
});

test('<=480 px: el boton muestra el mes corto, sin el prefijo "Filtros:"', () => {
  assert.match(media480, /#gd-modal \.gd-filtros-prefijo,#gd-modal \.gd-filtros-largo\{display:none;\}/);
  assert.match(media480, /#gd-modal \.gd-filtros-corto\{display:inline;\}/);
  assert.match(media768, /#gd-modal \.gd-filtros-corto\{display:none;\}/);
});

// ── Comportamiento, con un DOM minimo ─────────────────────────────────────
function fn(nombre) {
  const i = JS.indexOf('function ' + nombre + '(');
  assert.ok(i >= 0, 'falta ' + nombre);
  return bloque(JS, i);
}
function el(id, extra) {
  const clases = new Set(), attrs = {};
  return Object.assign({
    id, innerHTML: '', offsetParent: {},
    classList: { contains: (c) => clases.has(c), toggle: (c, on) => { if (on === undefined ? !clases.has(c) : on) clases.add(c); else clases.delete(c); } },
    setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: (k) => attrs[k],
    focus() { ctx.foco = id; }, querySelectorAll: () => [],
  }, extra);
}
let ctx;
function entorno({ mesSel = '2026-09', mesesSel = [], periodos = ['2026-10', '2026-09'] } = {}) {
  // Fase 201: el primer control visible es MESES (su <summary>).
  const mes = el('gd-meses-btn');
  const cont = el('gd-filtros-header', { querySelectorAll: () => [mes] });
  const els = { 'gd-filtros-header': cont, 'gd-filtros-btn': el('gd-filtros-btn'), 'gd-filtros-btn-txt': el('gd-filtros-btn-txt'), 'gd-meses-btn': mes };
  ctx = {
    foco: null, _gd: { mesSel, mesesSel, periodos },
    document: { getElementById: (id) => els[id] || null },
    mesNombreLargo: (p) => ({ '2026-09': 'Septiembre 2026', '2026-10': 'Octubre 2026' })[p],
    esc: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'),
  };
  vm.createContext(ctx);
  // Fase 203: el texto sale de los meses de MESES (mes-global-logic.js).
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'mes-global-logic.js'), 'utf8'), ctx);
  vm.runInContext(['_gdMeses', 'gdFiltrosHeaderToggle', '_gdFiltrosHeaderTexto'].map(fn).join('\n'), ctx);
  return els;
}

test('gdFiltrosHeaderToggle: abre y cierra, sincroniza aria-expanded y lleva el foco a MESES al abrir', () => {
  const e = entorno();
  ctx.gdFiltrosHeaderToggle();
  assert.equal(e['gd-filtros-header'].classList.contains('gd-filtros-abierto'), true);
  assert.equal(e['gd-filtros-btn'].getAttribute('aria-expanded'), 'true');
  assert.equal(ctx.foco, 'gd-meses-btn', 'el panel va antes del boton en el DOM: el foco entra al abrir');
  ctx.gdFiltrosHeaderToggle();
  assert.equal(e['gd-filtros-btn'].getAttribute('aria-expanded'), 'false');
  ctx.foco = null;
  ctx.gdFiltrosHeaderToggle(false); // cierre por codigo (al cerrar el tablero): no mueve el foco
  assert.equal(ctx.foco, null);
});

// Fase 203: el boton dice los meses de MESES, no un mes.
test('_gdFiltrosHeaderTexto: los meses de MESES (largo y corto), "Todos" y nombre accesible', () => {
  const e = entorno({ mesesSel: ['2026-09', '2026-10'] });
  ctx._gdFiltrosHeaderTexto();
  assert.equal(e['gd-filtros-btn-txt'].innerHTML,
    '<span class="gd-filtros-prefijo">Filtros: </span><span class="gd-filtros-largo">Sep 2026, Oct 2026</span><span class="gd-filtros-corto">Sep 2026, Oct 2026</span>');
  assert.equal(e['gd-filtros-btn'].getAttribute('aria-label'), 'Filtros: Sep 2026, Oct 2026');
  const uno = entorno({ mesesSel: ['2026-09'] });
  ctx._gdFiltrosHeaderTexto();
  assert.match(uno['gd-filtros-btn-txt'].innerHTML, /<span class="gd-filtros-largo">Septiembre 2026<\/span><span class="gd-filtros-corto">Sep 2026<\/span>/);
  const todos = entorno({ mesesSel: [] });
  ctx._gdFiltrosHeaderTexto();
  assert.equal(todos['gd-filtros-btn'].getAttribute('aria-label'), 'Filtros: Todos los meses (Sep 2026 – Oct 2026)');
  assert.match(todos['gd-filtros-btn-txt'].innerHTML, /<span class="gd-filtros-corto">Todos<\/span>/);
  const sinDatos = entorno({ periodos: [] });
  ctx._gdFiltrosHeaderTexto();
  assert.equal(sinDatos['gd-filtros-btn'].getAttribute('aria-label'), 'Filtros');
});

test('JS: el texto se actualiza con el mes (renderGenericHeader, MESES); Esc no cierra el tablero; cerrar lo pliega', () => {
  assert.match(fn('renderGenericHeader'), /^function renderGenericHeader\(\)\{\n  _gdFiltrosHeaderTexto\(\);/);
  assert.match(fn('_gdMesesBoton'), /_gdFiltrosHeaderTexto\(\);/);
  assert.match(fn('closeGenericDashboard'), /gdFiltrosHeaderToggle\(false\);/);
  const i = JS.indexOf("cont.addEventListener('keydown'");
  const esc = JS.slice(i, JS.indexOf('});', i));
  assert.match(esc, /e\.stopPropagation\(\);/, 'el Esc del panel no debe llegar a motion-helpers.js (cerraria el tablero)');
});
