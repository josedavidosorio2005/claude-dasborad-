// sura-televentas-todos.js — Fase 348, punto F (reunion con Edwin del 12/11). Boton «Quitar todos /
// Agregar todos» en los filtros generales de Televentas SURA (Mes y Resultado de validación), hecho
// DESDE AFUERA: el HTML del supervisor (sura-televentas-app.js/.css, scripts/sura) no se toca.
//
// Los filtros son casillas («chips») y el tablero recalcula con el evento change de cada una; el
// boton marca o desmarca las que falten y dispara ese mismo change, asi el tablero queda igual que
// si alguien las hubiera tocado una por una. El texto del boton sigue al estado: con todas
// marcadas dice «Quitar todos»; si falta alguna, «Agregar todos».
'use strict';

// Grupos con el boton: id del contenedor de casillas y nombre para el lector de pantalla.
var STV_TODOS_GRUPOS = [{ id: 'mf', nombre: 'meses' }, { id: 'vf', nombre: 'resultados de validación' }];

// Logica pura: con N casillas y cuantas estan marcadas, que hace el boton.
function stvTodosEstado(total, marcadas) {
  var t = Math.max(0, Number(total) || 0), m = Math.max(0, Math.min(t, Number(marcadas) || 0));
  var quitar = t > 0 && m === t;
  return { total: t, marcadas: m, accion: quitar ? 'quitar' : 'agregar', texto: quitar ? 'Quitar todos' : 'Agregar todos', visible: t > 1 };
}

var STV_TODOS_CSS = '.stv-todos,.fg .stv-todos{display:inline-flex;align-items:center;align-self:flex-start;justify-self:start;width:auto;flex:0 0 auto;min-height:32px;margin:0 0 6px;padding:4px 12px;font-size:13px;font-weight:600}' +
  '.stv-todos[hidden]{display:none}@media (max-width:768px){.stv-todos{min-height:40px}}';

function stvTodosMontar(root) {
  if (!root || !root.querySelector) return;
  if (!root.querySelector('style[data-todos]')) {
    var st = document.createElement('style');
    st.setAttribute('data-todos', 'plataforma');
    st.textContent = STV_TODOS_CSS;
    root.appendChild(st);
  }
  STV_TODOS_GRUPOS.forEach(function (g) {
    var cont = root.querySelector('#' + g.id);
    if (!cont || cont.getAttribute('data-todos') === '1') return;
    cont.setAttribute('data-todos', '1');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn stv-todos';
    btn.setAttribute('data-todos-de', g.id);
    cont.parentNode.insertBefore(btn, cont);
    var casillas = function () { return Array.prototype.slice.call(cont.querySelectorAll('input[type="checkbox"]')); };
    var pintar = function () {
      var c = casillas();
      var e = stvTodosEstado(c.length, c.filter(function (x) { return x.checked; }).length);
      btn.hidden = !e.visible;
      btn.textContent = e.texto;
      btn.setAttribute('aria-label', e.texto + ' (' + g.nombre + ')');
    };
    btn.addEventListener('click', function () {
      var c = casillas();
      var marcar = stvTodosEstado(c.length, c.filter(function (x) { return x.checked; }).length).accion === 'agregar';
      c.forEach(function (x) {
        if (x.checked === marcar) return;
        x.checked = marcar;
        x.dispatchEvent(new Event('change', { bubbles: true }));
      });
      pintar();
    });
    cont.addEventListener('change', pintar);
    // El tablero vuelve a dibujar las casillas (al cambiar de campaña): el texto se pone al dia.
    if (typeof MutationObserver === 'function') new MutationObserver(pintar).observe(cont, { childList: true });
    pintar();
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { STV_TODOS_GRUPOS: STV_TODOS_GRUPOS, stvTodosEstado: stvTodosEstado, stvTodosMontar: stvTodosMontar };
}
