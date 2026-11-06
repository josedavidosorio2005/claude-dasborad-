// marcar-todo.js — Fase 271 (pedido de Edwin, 05/11): "Marcar todo / Ninguno"
// en los selectores con casillas (MESES del tablero, Asesor de Agendas por
// usuaria y las listas del formulario de usuario: clientes, campañas,
// plantillas y modulos de carga). Un solo componente para todos.
//
// marcarTodoBarraHtml(idContenedor): los 2 botones, para poner junto a la
// lista. marcarTodo(idContenedor, on): marca o desmarca todas las casillas
// habilitadas del contenedor y avisa UN solo 'change' (en la ultima que
// cambio): los filtros que reaccionan al cambio leen todas las casillas, asi
// se redibuja una vez y no una por casilla.
'use strict';

function marcarTodoBarraHtml(idContenedor) {
  var id = String(idContenedor).replace(/[^A-Za-z0-9_-]/g, '');
  return '<div class="marcar-todo" role="group" aria-label="Selección rápida">' +
    '<button type="button" class="btn-sm" data-marcar-todo="' + id + '" data-on="1">Marcar todo</button>' +
    '<button type="button" class="btn-sm" data-marcar-todo="' + id + '" data-on="0">Ninguno</button></div>';
}

// Devuelve cuantas casillas cambiaron.
function marcarTodo(idContenedor, on) {
  var c = typeof document !== 'undefined' ? document.getElementById(idContenedor) : null;
  if (!c) return 0;
  var ultima = null;
  var n = 0;
  Array.prototype.forEach.call(c.querySelectorAll('input[type="checkbox"]'), function (b) {
    if (b.disabled || b.checked === !!on) return;
    b.checked = !!on; ultima = b; n++;
  });
  if (ultima && typeof Event === 'function') ultima.dispatchEvent(new Event('change', { bubbles: true }));
  return n;
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-marcar-todo]') : null;
    if (!b) return;
    e.preventDefault();
    marcarTodo(b.getAttribute('data-marcar-todo'), b.getAttribute('data-on') === '1');
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { marcarTodoBarraHtml: marcarTodoBarraHtml, marcarTodo: marcarTodo };
}
