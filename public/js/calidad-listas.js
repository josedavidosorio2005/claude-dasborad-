// calidad-listas.js — Fase 348 (reunion con Edwin del 12/11, punto C). Paginacion comun de las
// listas largas del Modulo de Calidad: Monitoreos, Detalle por mes y Calidad de encuestas
// (Pendientes y Resueltas). 10 filas por defecto, o 20; el resto de la lista (KPIs, promedios,
// contadores) sigue contando TODAS las filas: solo cambia cuantas se dibujan.
//
// Cada lista tiene un id ('mon', 'det', 'cen-resueltas'...) y una funcion que la vuelve a
// dibujar (clRegistrar). Los botones llevan data-cl-* y se atienden por delegacion.
var _clEstado = {};
var _clPintar = {};

function clEstado(id) {
  if (!_clEstado[id]) _clEstado[id] = { pagina: 1, porPagina: CL_TAMANO_DEFECTO };
  return _clEstado[id];
}
function clRegistrar(id, pintar) { _clPintar[id] = pintar; }

// Corta la lista segun el estado de esa lista. Devuelve { filas, pg }.
function clCortar(id, lista) {
  var e = clEstado(id);
  var pg = clPaginar((lista || []).length, e.pagina, e.porPagina);
  e.pagina = pg.pagina; // si la lista se achico, la pagina vuelve a una que existe
  return { filas: (lista || []).slice(pg.desde, pg.hasta), pg: pg };
}

// Pie de la lista: «11–20 de 53», botones de pagina y «Filas por página».
function clPieHtml(id, pg) {
  if (!pg || !pg.total) return '';
  var ide = esc(id);
  var nav = '';
  if (pg.paginas > 1) {
    var btn = function (pag, texto, etiqueta, desactivado, actual) {
      return '<button type="button" class="cl-pag' + (actual ? ' on' : '') + '" data-cl-id="' + ide + '" data-cl-pag="' + pag + '"' +
        (desactivado ? ' disabled' : '') + (actual ? ' aria-current="page"' : '') + ' aria-label="' + esc(etiqueta) + '">' + texto + '</button>';
    };
    nav = '<div class="cl-pags">' + btn(pg.pagina - 1, '‹', 'Página anterior', pg.pagina === 1, false) +
      clPaginasVisibles(pg.pagina, pg.paginas).map(function (x) {
        return x === '…' ? '<span class="cl-hueco" aria-hidden="true">…</span>' : btn(x, String(x), 'Página ' + x, false, x === pg.pagina);
      }).join('') +
      btn(pg.pagina + 1, '›', 'Página siguiente', pg.pagina === pg.paginas, false) + '</div>';
  }
  var tam = '<label class="cl-tam">Filas por página <select data-cl-id="' + ide + '" data-cl-tam="1">' +
    CL_TAMANOS.map(function (n) { return '<option value="' + n + '"' + (n === pg.porPagina ? ' selected' : '') + '>' + n + '</option>'; }).join('') +
    '</select></label>';
  return '<nav class="cl-pie" aria-label="Páginas de la lista"><span class="cl-rango" aria-live="polite">' + esc(clTextoRango(pg)) + '</span>' + nav + tam + '</nav>';
}

function _clRepintar(id, enfocar) {
  var f = _clPintar[id];
  if (typeof f !== 'function') return;
  f();
  // El foco vuelve al mismo control (el pie se dibuja de nuevo).
  if (enfocar) {
    var el = document.querySelector(enfocar);
    if (el && !el.disabled) el.focus();
    else { var on = document.querySelector('.cl-pag.on[data-cl-id="' + id + '"]'); if (on) on.focus(); }
  }
}

document.addEventListener('click', function (ev) {
  var b = ev.target && ev.target.closest ? ev.target.closest('.cl-pag[data-cl-id]') : null;
  if (!b || b.disabled) return;
  var id = b.getAttribute('data-cl-id');
  clEstado(id).pagina = Number(b.getAttribute('data-cl-pag')) || 1;
  _clRepintar(id, '.cl-pag[data-cl-id="' + id + '"][data-cl-pag="' + b.getAttribute('data-cl-pag') + '"]');
});
document.addEventListener('change', function (ev) {
  var s = ev.target;
  if (!s || !s.matches || !s.matches('select[data-cl-tam]')) return;
  var id = s.getAttribute('data-cl-id');
  var e = clEstado(id);
  e.porPagina = clTamano(s.value);
  e.pagina = 1;
  _clRepintar(id, 'select[data-cl-tam][data-cl-id="' + id + '"]');
});
