// row-actions.js — Fase 137 (Parte B, F07): menu de acciones por fila
// (boton "kebab", patron WAI-ARIA "menu button"). Reutilizable en
// cualquier tabla que amontone varios botones del mismo peso en una
// celda -- el primero en usarlo es Gestion de Usuarios (users.js), sin
// cambiar NINGUN permiso: este archivo solo abre/cierra/navega el menu,
// nunca decide que accion existe para quien (eso lo sigue decidiendo el
// caller, exactamente igual que antes -- el menu solo reorganiza).
//
// Patron: el boton dispara (aria-haspopup="true", aria-expanded),
// aria-controls apunta al id del menu (role="menu", cada accion
// role="menuitem" tabindex="-1" -- el foco se mueve a mano con
// .focus(), nunca con Tab, para que Tab/Escape puedan salir del menu
// limpio). Enter/Espacio/flecha-abajo en el boton abren y enfocan el
// primer item; flechas arriba/abajo navegan (con wrap); Home/End van al
// primero/ultimo; Escape cierra y devuelve el foco al boton que lo
// abrio; clic fuera cierra. Solo un menu abierto a la vez.

var ROW_ACTIONS_ABIERTO = null; // { menu, boton } o null

function rowActionsCerrarTodos() {
  if (!ROW_ACTIONS_ABIERTO) return;
  var m = ROW_ACTIONS_ABIERTO.menu;
  var b = ROW_ACTIONS_ABIERTO.boton;
  m.classList.remove('row-actions-menu-show');
  b.setAttribute('aria-expanded', 'false');
  ROW_ACTIONS_ABIERTO = null;
}

// Posiciona el menu con position:fixed (igual que el patron ya existente
// de _gdExport() en dashboard-generic.js) -- NUNCA position:absolute
// dentro de la fila: .table-wrap tiene overflow-x:auto, y por la regla
// de CSS (si un eje de overflow no es "visible", el otro eje se computa
// como "auto") eso recorta cualquier hijo absolute que se salga de su
// alto, cortando el menu a la mitad. position:fixed escapa de ese
// recorte. Guardado con typeof para que las pruebas (sin layout real)
// no fallen.
function rowActionsPosicionar(boton, menu) {
  if (typeof boton.getBoundingClientRect !== 'function') return;
  var r = boton.getBoundingClientRect();
  var ancho = menu.offsetWidth || 200;
  var anchoVentana = (typeof window !== 'undefined' && window.innerWidth) || 1200;
  var left = Math.max(8, Math.min(r.right - ancho, anchoVentana - ancho - 8));
  menu.style.position = 'fixed';
  menu.style.top = (r.bottom + 4) + 'px';
  menu.style.left = left + 'px';
}

function rowActionsAbrir(boton) {
  rowActionsCerrarTodos();
  var menuId = boton.getAttribute('aria-controls');
  var menu = document.getElementById(menuId);
  if (!menu) return;
  rowActionsPosicionar(boton, menu);
  menu.classList.add('row-actions-menu-show');
  boton.setAttribute('aria-expanded', 'true');
  ROW_ACTIONS_ABIERTO = { menu: menu, boton: boton };
}

function rowActionsEnfocarPrimero(menu) {
  var item = menu.querySelector ? menu.querySelector('[role="menuitem"]') : null;
  if (item && item.focus) item.focus();
}
function rowActionsEnfocarUltimo(menu) {
  var items = menu.querySelectorAll ? menu.querySelectorAll('[role="menuitem"]') : [];
  var last = items[items.length - 1];
  if (last && last.focus) last.focus();
}

// Clic en el boton kebab: si su menu ya esta abierto, actua como cierre
// (toggle); si no, abre (cerrando cualquier otro) y enfoca el primer item
// -- mismo resultado visual que abrirlo con teclado.
function rowActionsClickBoton(e, boton) {
  if (e && e.stopPropagation) e.stopPropagation();
  var yaAbierto = !!(ROW_ACTIONS_ABIERTO && ROW_ACTIONS_ABIERTO.boton === boton);
  if (yaAbierto) { rowActionsCerrarTodos(); return; }
  rowActionsAbrir(boton);
  var menu = document.getElementById(boton.getAttribute('aria-controls'));
  if (menu) rowActionsEnfocarPrimero(menu);
}

function rowActionsTecladoBoton(e, boton) {
  var k = e.key;
  if (k === 'Enter' || k === ' ' || k === 'Spacebar' || k === 'ArrowDown' || k === 'Down') {
    if (e.preventDefault) e.preventDefault();
    rowActionsAbrir(boton);
    var menu = document.getElementById(boton.getAttribute('aria-controls'));
    if (menu) rowActionsEnfocarPrimero(menu);
  } else if (k === 'Escape' || k === 'Esc') {
    rowActionsCerrarTodos();
  }
}

// Teclado DENTRO del menu ya abierto -- boton se resuelve por
// aria-labelledby (el menu apunta de vuelta al boton que lo controla),
// para no tener que pasarlo aparte desde cada fila en el HTML.
function rowActionsTecladoMenu(e, menu) {
  var boton = document.getElementById(menu.getAttribute('aria-labelledby'));
  var items = Array.prototype.slice.call(menu.querySelectorAll('[role="menuitem"]'));
  var idx = items.indexOf(document.activeElement);
  var k = e.key;
  if (k === 'ArrowDown' || k === 'Down') {
    if (e.preventDefault) e.preventDefault();
    var next = items[(idx + 1 + items.length) % items.length];
    if (next) next.focus();
  } else if (k === 'ArrowUp' || k === 'Up') {
    if (e.preventDefault) e.preventDefault();
    var prev = items[(idx - 1 + items.length) % items.length];
    if (prev) prev.focus();
  } else if (k === 'Home') {
    if (e.preventDefault) e.preventDefault();
    rowActionsEnfocarPrimero(menu);
  } else if (k === 'End') {
    if (e.preventDefault) e.preventDefault();
    rowActionsEnfocarUltimo(menu);
  } else if (k === 'Escape' || k === 'Esc') {
    if (e.preventDefault) e.preventDefault();
    rowActionsCerrarTodos();
    if (boton && boton.focus) boton.focus();
  } else if (k === 'Tab') {
    // Tab sale del menu -- se cierra solo, sin interceptar el foco (el
    // navegador sigue su recorrido normal de tabulacion).
    rowActionsCerrarTodos();
  }
}

// Clic en cualquier parte del documento: si cae fuera del menu abierto y
// de su boton, cierra. Un solo listener global (no uno por fila) --
// hacer clic en un item del menu lo cierra por su PROPIO onclick
// (rowActionsCerrarTodos() antes de la accion real, ver users.js), no
// por este listener (el target cae DENTRO del menu).
if (typeof document !== 'undefined') {
  document.addEventListener('click', function (e) {
    if (!ROW_ACTIONS_ABIERTO) return;
    var m = ROW_ACTIONS_ABIERTO.menu, b = ROW_ACTIONS_ABIERTO.boton;
    if (m.contains(e.target) || b.contains(e.target)) return;
    rowActionsCerrarTodos();
  });
}

// Doble modo: global en el navegador, require() en Node para pruebas.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    rowActionsAbrir: rowActionsAbrir,
    rowActionsCerrarTodos: rowActionsCerrarTodos,
    rowActionsClickBoton: rowActionsClickBoton,
    rowActionsTecladoBoton: rowActionsTecladoBoton,
    rowActionsTecladoMenu: rowActionsTecladoMenu,
    rowActionsEnfocarPrimero: rowActionsEnfocarPrimero,
    rowActionsEnfocarUltimo: rowActionsEnfocarUltimo,
    _reset: function () { ROW_ACTIONS_ABIERTO = null; },
    _estado: function () { return ROW_ACTIONS_ABIERTO; },
  };
}
