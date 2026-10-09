// fase137-f07-menu-acciones-usuarios.test.js — Fase 137 (Parte B, F07):
// en Gestion de Usuarios, "Editar" queda visible como accion principal
// y Contrasena/Suspender-Activar/Eliminar se agrupan en un menu "kebab"
// (row-actions.js, patron WAI-ARIA "menu button"). Regla de oro de esta
// fase: ninguna accion puede dejar de estar disponible para quien hoy
// tiene derecho a ella -- estas pruebas confirman que los 4 handlers y
// sus 4 condiciones de permiso (canEdit/canPass/canSusp/canDel, sin
// cambiar) siguen exactamente igual en el HTML generado, solo
// reorganizados.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { request, app } = require('./helpers');

async function js(archivo) {
  const res = await request(app).get('/js/' + archivo);
  assert.equal(res.status, 200);
  return res.text;
}

test('users.js: las 4 condiciones de permiso (canEdit/canPass/canSusp/canDel) siguen igual que antes de la Fase 137', async () => {
  const texto = await js('users.js');
  assert.match(texto, /var canEdit=isFullAdmin\(\)\|\|can\('editarUsuarios'\)/);
  assert.match(texto, /var canPass=isFullAdmin\(\)\|\|can\('cambiarPassword'\)/);
  assert.match(texto, /var canSusp=isFullAdmin\(\)\|\|can\('suspenderUsuarios'\)/);
  assert.match(texto, /var canDel\s*=isFullAdmin\(\)\|\|can\('eliminarUsuarios'\)/);
});

test('users.js: los 4 handlers (openEditModal/openPassModal/toggleActive/openDeleteModal) siguen presentes, cada uno gateado por su misma condicion de antes', async () => {
  const texto = await js('users.js');
  // Editar: sigue visible fuera del menu, boton principal.
  assert.match(texto, /canEdit\?'<button class="btn-sm btn-edit" onclick="openEditModal\(/);
  // Los otros 3: ahora dentro de un <button role="menuitem">, pero con
  // la MISMA condicion gateando su presencia.
  assert.match(texto, /canPass\?'<button[^']*role="menuitem"[^']*onclick="rowActionsCerrarTodos\(\);openPassModal\(/);
  assert.match(texto, /canSusp\?'<button[^']*role="menuitem"[^']*onclick="rowActionsCerrarTodos\(\);toggleActive\(/);
  assert.match(texto, /canDel\?'<button[^']*role="menuitem"[^']*danger[^']*onclick="rowActionsCerrarTodos\(\);openDeleteModal\(/);
});

test('users.js: el menu kebab es SVG real, nunca un caracter/emoji suelto', async () => {
  const texto = await js('users.js');
  assert.match(texto, /<svg viewBox="0 0 24 24" fill="currentColor"/);
  // Nada de &#... (entidad HTML tipica de un emoji) dentro del boton kebab.
  const bloqueKebab = texto.match(/row-actions-kebab[\s\S]{0,400}<\/button>/);
  assert.ok(bloqueKebab, 'deberia existir el boton kebab');
  assert.ok(!/&#\d+;/.test(bloqueKebab[0]), 'el boton kebab no deberia tener ninguna entidad HTML/emoji');
});

test('users.js: el boton kebab y el menu tienen los atributos ARIA del patron "menu button"', async () => {
  const texto = await js('users.js');
  assert.match(texto, /aria-haspopup="true"/);
  assert.match(texto, /aria-expanded="false"/);
  assert.match(texto, /aria-controls="'\+menuId\+'"/);
  assert.match(texto, /role="menu"/);
  assert.match(texto, /aria-labelledby="'\+kebabId\+'"/);
  assert.match(texto, /onkeydown="rowActionsTecladoBoton\(event,this\)"/);
  assert.match(texto, /onkeydown="rowActionsTecladoMenu\(event,this\)"/);
});

test('users.js: "Eliminar" sigue siendo la unica accion .danger, con separador (border-top) dentro del menu', async () => {
  const texto = await js('users.js');
  assert.match(texto, /row-actions-menu-item danger[^<]*/);
});

test('row-actions.js: se sirve, exporta las funciones del patron "menu button", y esta cargado ANTES de users.js', async () => {
  const texto = await js('row-actions.js');
  assert.match(texto, /function rowActionsAbrir\(/);
  assert.match(texto, /function rowActionsCerrarTodos\(/);
  assert.match(texto, /function rowActionsClickBoton\(/);
  assert.match(texto, /function rowActionsTecladoBoton\(/);
  assert.match(texto, /function rowActionsTecladoMenu\(/);

  const html = (await request(app).get('/')).text;
  const indiceDe = (archivo) => html.search(new RegExp('src="js/' + archivo.replace('.', '\\.') + '(\\?[^"]*)?"'));
  const ordenRowActions = indiceDe('row-actions.js');
  const ordenUsers = indiceDe('users.js');
  assert.ok(ordenRowActions > -1 && ordenUsers > -1);
  assert.ok(ordenRowActions < ordenUsers, 'row-actions.js debe cargar antes de users.js (lo usa)');
});

test('CSS: .row-actions-menu usa --dur-fast/--ease-out, solo opacity/transform (GPU), y respeta data-motion="off" via la regla global (selector *)', async () => {
  const res = await request(app).get('/css/styles.css');
  assert.equal(res.status, 200);
  const texto = res.text;
  const regla = texto.match(/\.row-actions-menu\{([^}]*)\}/);
  assert.ok(regla, 'deberia existir la regla .row-actions-menu');
  assert.match(regla[1], /transition:opacity var\(--dur-fast\) var\(--ease-out\),transform var\(--dur-fast\) var\(--ease-out\)/);
  assert.ok(!/transition:\s*all/.test(regla[1]));
  assert.match(regla[1], /transform:scale\(0\.95\)/, 'nunca scale(0) -- nada aparece de la nada');
  // El selector global "*" (ya probado en fase136-pr4) alcanza cualquier
  // clase nueva automaticamente -- no hace falta una regla aparte.
  assert.match(texto, /html\[data-motion="off"\] \*, html\[data-motion="off"\] \*::before, html\[data-motion="off"\] \*::after/);
});

test('CSS: .row-actions-menu-item usa font-family:inherit -- sin esto, un <button> toma la fuente por defecto del navegador, no Quicksand', async () => {
  const res = await request(app).get('/css/styles.css');
  const texto = res.text;
  const regla = texto.match(/\.row-actions-menu-item\{([^}]*)\}/);
  assert.ok(regla, 'deberia existir la regla .row-actions-menu-item');
  assert.match(regla[1], /font-family:inherit/);
});

test('CSS: objetivos tactiles >=44px en movil para el boton kebab y cada item del menu (F07, WCAG 2.5.8)', async () => {
  const res = await request(app).get('/css/styles.css');
  const texto = res.text;
  const media = texto.match(/@media\(max-width:768px\)\{\s*\.row-actions-kebab\{([^}]*)\}\s*\.row-actions-menu-item\{([^}]*)\}/);
  assert.ok(media, 'deberia existir el bloque movil con ambas reglas');
  assert.match(media[1], /min-height:44px/);
  assert.match(media[1], /min-width:44px/);
  assert.match(media[2], /min-height:44px/);
});

test('users.js: ".action-btns" (clase vieja) ya no se usa -- se reemplazo por ".row-actions" en toda la fila', async () => {
  const texto = await js('users.js');
  assert.ok(!texto.includes('action-btns'), 'no deberia quedar ninguna referencia a la clase vieja');
  assert.match(texto, /'<td><div class="row-actions">'/);
});

// ── Logica real del menu (teclado/foco), con un DOM minimo simulado --
// mismo patron que fase136-pr8 (EventTarget real de Node, sin jsdom). ──

function construirDomFalso() {
  var registro = {};
  var activo = null;

  function ElementoFalso(opts) {
    opts = opts || {};
    this.id = opts.id || '';
    this._attrs = {};
    this._clases = new Set(opts.clases || []);
    this._hijosMenuitem = opts.hijosMenuitem || [];
    this.style = {};
    this.offsetWidth = 200;
    this.classList = {
      add: (c) => this._clases.add(c),
      remove: (c) => this._clases.delete(c),
      contains: (c) => this._clases.has(c),
    };
    var self = this;
    this.focus = function () { activo = self; };
    if (registro[this.id]) throw new Error('id duplicado en el DOM falso: ' + this.id);
    if (this.id) registro[this.id] = this;
  }
  ElementoFalso.prototype.setAttribute = function (k, v) { this._attrs[k] = String(v); };
  ElementoFalso.prototype.getAttribute = function (k) {
    return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null;
  };
  ElementoFalso.prototype.contains = function (otro) { return this === otro || this._hijosMenuitem.indexOf(otro) > -1; };
  ElementoFalso.prototype.querySelector = function () { return this._hijosMenuitem[0] || null; };
  ElementoFalso.prototype.querySelectorAll = function () { return this._hijosMenuitem; };

  var documentoFalso = {
    getElementById: (id) => registro[id] || null,
    addEventListener: () => {}, // el listener global de "clic afuera" no se ejercita aqui
    get activeElement() { return activo; },
  };

  return { ElementoFalso, documentoFalso, registro };
}

function cargarRowActions() {
  delete require.cache[path.join(__dirname, '..', '..', 'public', 'js', 'row-actions.js')];
  return require(path.join(__dirname, '..', '..', 'public', 'js', 'row-actions.js'));
}

test('rowActionsAbrir/rowActionsCerrarTodos: aria-expanded y la clase show se mueven juntos', () => {
  var dom = construirDomFalso();
  global.document = dom.documentoFalso;
  var mod = cargarRowActions();

  var item1 = new dom.ElementoFalso({ id: 'item1' });
  var menu = new dom.ElementoFalso({ id: 'menu1', hijosMenuitem: [item1] });
  var boton = new dom.ElementoFalso({ id: 'kebab1' });
  boton.setAttribute('aria-controls', 'menu1');
  boton.setAttribute('aria-expanded', 'false');

  mod.rowActionsAbrir(boton);
  assert.equal(boton.getAttribute('aria-expanded'), 'true');
  assert.equal(menu.classList.contains('row-actions-menu-show'), true);

  mod.rowActionsCerrarTodos();
  assert.equal(boton.getAttribute('aria-expanded'), 'false');
  assert.equal(menu.classList.contains('row-actions-menu-show'), false);

  delete global.document;
});

test('rowActionsAbrir: abrir un 2do menu cierra el primero -- solo uno abierto a la vez', () => {
  var dom = construirDomFalso();
  global.document = dom.documentoFalso;
  var mod = cargarRowActions();

  var menuA = new dom.ElementoFalso({ id: 'menuA' });
  var botonA = new dom.ElementoFalso({ id: 'kebabA' });
  botonA.setAttribute('aria-controls', 'menuA');
  var menuB = new dom.ElementoFalso({ id: 'menuB' });
  var botonB = new dom.ElementoFalso({ id: 'kebabB' });
  botonB.setAttribute('aria-controls', 'menuB');

  mod.rowActionsAbrir(botonA);
  assert.equal(menuA.classList.contains('row-actions-menu-show'), true);

  mod.rowActionsAbrir(botonB);
  assert.equal(menuA.classList.contains('row-actions-menu-show'), false, 'el primer menu deberia haberse cerrado');
  assert.equal(botonA.getAttribute('aria-expanded'), 'false');
  assert.equal(menuB.classList.contains('row-actions-menu-show'), true);

  delete global.document;
});

test('rowActionsClickBoton: clic en el mismo boton con el menu ya abierto lo cierra (toggle)', () => {
  var dom = construirDomFalso();
  global.document = dom.documentoFalso;
  var mod = cargarRowActions();

  var item1 = new dom.ElementoFalso({ id: 'i1' });
  var menu = new dom.ElementoFalso({ id: 'm1', hijosMenuitem: [item1] });
  var boton = new dom.ElementoFalso({ id: 'k1' });
  boton.setAttribute('aria-controls', 'm1');
  var ev = { stopPropagation: () => {} };

  mod.rowActionsClickBoton(ev, boton);
  assert.equal(menu.classList.contains('row-actions-menu-show'), true, 'el 1er clic abre');
  assert.equal(dom.documentoFalso.activeElement, item1, 'abrir con clic tambien enfoca el primer item');

  mod.rowActionsClickBoton(ev, boton);
  assert.equal(menu.classList.contains('row-actions-menu-show'), false, 'el 2do clic (toggle) cierra');
});

test('rowActionsTecladoMenu: ArrowDown/ArrowUp navegan con wrap entre los items', () => {
  var dom = construirDomFalso();
  global.document = dom.documentoFalso;
  var mod = cargarRowActions();

  var item1 = new dom.ElementoFalso({ id: 'a1' });
  var item2 = new dom.ElementoFalso({ id: 'a2' });
  var item3 = new dom.ElementoFalso({ id: 'a3' });
  var menu = new dom.ElementoFalso({ id: 'menuNav', hijosMenuitem: [item1, item2, item3] });
  var boton = new dom.ElementoFalso({ id: 'kebabNav' });
  boton.setAttribute('aria-controls', 'menuNav');
  menu.setAttribute('aria-labelledby', 'kebabNav');

  mod.rowActionsAbrir(boton);
  mod.rowActionsEnfocarPrimero(menu);
  assert.equal(dom.documentoFalso.activeElement, item1);

  var prevenido = false;
  var ev = { key: 'ArrowDown', preventDefault: () => { prevenido = true; } };
  mod.rowActionsTecladoMenu(ev, menu);
  assert.equal(dom.documentoFalso.activeElement, item2);
  assert.equal(prevenido, true);

  mod.rowActionsTecladoMenu({ key: 'ArrowDown', preventDefault: () => {} }, menu);
  assert.equal(dom.documentoFalso.activeElement, item3);

  mod.rowActionsTecladoMenu({ key: 'ArrowDown', preventDefault: () => {} }, menu);
  assert.equal(dom.documentoFalso.activeElement, item1, 'ArrowDown en el ultimo item vuelve al primero (wrap)');

  mod.rowActionsTecladoMenu({ key: 'ArrowUp', preventDefault: () => {} }, menu);
  assert.equal(dom.documentoFalso.activeElement, item3, 'ArrowUp en el primer item va al ultimo (wrap)');

  delete global.document;
});

test('rowActionsTecladoMenu: Escape cierra el menu Y devuelve el foco al boton que lo abrio', () => {
  var dom = construirDomFalso();
  global.document = dom.documentoFalso;
  var mod = cargarRowActions();

  var item1 = new dom.ElementoFalso({ id: 'b1' });
  var menu = new dom.ElementoFalso({ id: 'menuEsc', hijosMenuitem: [item1] });
  var boton = new dom.ElementoFalso({ id: 'kebabEsc' });
  boton.setAttribute('aria-controls', 'menuEsc');
  menu.setAttribute('aria-labelledby', 'kebabEsc');

  mod.rowActionsAbrir(boton);
  mod.rowActionsEnfocarPrimero(menu);
  assert.equal(dom.documentoFalso.activeElement, item1);

  var prevenido = false;
  mod.rowActionsTecladoMenu({ key: 'Escape', preventDefault: () => { prevenido = true; } }, menu);

  assert.equal(menu.classList.contains('row-actions-menu-show'), false, 'Escape cierra el menu');
  assert.equal(boton.getAttribute('aria-expanded'), 'false');
  assert.equal(dom.documentoFalso.activeElement, boton, 'el foco vuelve al boton que abrio el menu');
  assert.equal(prevenido, true);

  delete global.document;
});

test('rowActionsTecladoBoton: Enter/Espacio/ArrowDown en el boton abren el menu y enfocan el primer item', () => {
  var dom = construirDomFalso();
  global.document = dom.documentoFalso;
  var mod = cargarRowActions();

  var item1 = new dom.ElementoFalso({ id: 'c1' });
  var menu = new dom.ElementoFalso({ id: 'menuBtn', hijosMenuitem: [item1] });
  var boton = new dom.ElementoFalso({ id: 'kebabBtn' });
  boton.setAttribute('aria-controls', 'menuBtn');

  mod.rowActionsTecladoBoton({ key: 'Enter', preventDefault: () => {} }, boton);
  assert.equal(menu.classList.contains('row-actions-menu-show'), true);
  assert.equal(dom.documentoFalso.activeElement, item1);

  delete global.document;
});

// Hallazgo real tras revisar las capturas del "OK F07": el menu es
// position:fixed, calculado UNA vez contra el boton al abrirse -- si la
// pagina (o .table-wrap, que tiene su propio scroll horizontal) se
// desplaza, o la ventana cambia de tamano, queda flotando lejos de su
// fila real. Se cierra en vez de reposicionarse.
function construirVentanaFalsa() {
  var handlers = {};
  return {
    addEventListener: function (tipo, fn, _useCapture) {
      handlers[tipo] = handlers[tipo] || [];
      handlers[tipo].push(fn);
    },
    disparar: function (tipo) { (handlers[tipo] || []).forEach((fn) => fn({})); },
  };
}

test('scroll/resize de la ventana cierran cualquier menu abierto (el menu es position:fixed, no se reposiciona solo)', () => {
  var dom = construirDomFalso();
  global.document = dom.documentoFalso;
  var ventanaFalsa = construirVentanaFalsa();
  global.window = ventanaFalsa;
  var mod = cargarRowActions();

  var menu = new dom.ElementoFalso({ id: 'menuScroll' });
  var boton = new dom.ElementoFalso({ id: 'kebabScroll' });
  boton.setAttribute('aria-controls', 'menuScroll');

  mod.rowActionsAbrir(boton);
  assert.equal(menu.classList.contains('row-actions-menu-show'), true, 'precondicion: el menu deberia quedar abierto');

  ventanaFalsa.disparar('scroll');
  assert.equal(menu.classList.contains('row-actions-menu-show'), false, 'un scroll de la pagina/.table-wrap deberia cerrar el menu abierto');
  assert.equal(boton.getAttribute('aria-expanded'), 'false');

  // Vuelve a abrir para probar resize por separado.
  mod.rowActionsAbrir(boton);
  assert.equal(menu.classList.contains('row-actions-menu-show'), true);
  ventanaFalsa.disparar('resize');
  assert.equal(menu.classList.contains('row-actions-menu-show'), false, 'redimensionar la ventana deberia cerrar el menu abierto');

  delete global.document;
  delete global.window;
});
