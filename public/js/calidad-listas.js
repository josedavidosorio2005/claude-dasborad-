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
  if (!_clEstado[id]) _clEstado[id] = { pagina: 1, porPagina: CL_TAMANO_DEFECTO, q: '' };
  return _clEstado[id];
}

// Fase 348 (C2): el telefono se busca solo si el servidor lo mando (lo decide puedeVerTelefono) y el
// rol es de los que califican: las dos cosas.
function clBuscaTelefono(lista) {
  var rolOk = clPuedeBuscarTelefono(typeof currentUser !== 'undefined' ? currentUser : null, typeof isFullAdmin === 'function' && isFullAdmin());
  return rolOk && (lista || []).some(function (x) { return x && Object.prototype.hasOwnProperty.call(x, 'telefono'); });
}
// Filtra la lista con la busqueda de esa lista. extraer = clCamposMonitoreo / clCamposEncuesta.
function clBuscar(id, lista, extraer, conTelefono) {
  return clFiltrar(lista, clEstado(id).q, extraer, { telefono: !!conTelefono });
}
function clBuscadorHtml(id, conTelefono) {
  var ide = esc(id);
  var ayuda = 'ID, asesor o fecha (DD/MM)' + (conTelefono ? ' o teléfono' : '');
  return '<label class="ca-filtro cl-buscar">Buscar <input type="search" data-cl-id="' + ide + '" data-cl-q="1" value="' + esc(clEstado(id).q) +
    '" placeholder="' + esc(ayuda) + '" aria-label="Buscar por ' + esc(ayuda) + '" autocomplete="off"></label>';
}
// Pone el buscador en su lugar sin cambiarlo mientras alguien escribe en el.
function clPonerBuscador(host, id, conTelefono) {
  if (!host) return;
  var actual = host.querySelector('input[data-cl-q]');
  if (actual && document.activeElement === actual) return;
  host.innerHTML = clBuscadorHtml(id, conTelefono) + clBotonPantallaHtml(); // Fase 348 (C5)
}
function clSinResultadosTexto(id) {
  return clEstado(id).q ? 'Nada coincide con «' + clEstado(id).q.trim() + '».' : '';
}
function clRegistrar(id, pintar) { _clPintar[id] = pintar; }

// Fase 348 (C4): al cambiar de campaña ninguna lista se queda con la pagina, la busqueda ni las
// filas por pagina de la campaña anterior.
function clReiniciarVista() {
  Object.keys(_clEstado).forEach(function (k) { delete _clEstado[k]; });
  if (typeof _clQTimer !== 'undefined') clearTimeout(_clQTimer);
}
// El scroll del modulo y el horizontal de cada tabla vuelven al inicio.
function clReiniciarScroll(contenedor) {
  if (!contenedor) return;
  contenedor.scrollTop = 0;
  Array.prototype.forEach.call(contenedor.querySelectorAll('[style*="overflow-x"], .cen-tabla-wrap'), function (w) { w.scrollLeft = 0; });
}

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
// Al escribir: pagina 1 y se repinta (con una pausa corta); el foco y el cursor vuelven al buscador.
var _clQTimer = null;
document.addEventListener('input', function (ev) {
  var inp = ev.target;
  if (!inp || !inp.matches || !inp.matches('input[data-cl-q]')) return;
  var id = inp.getAttribute('data-cl-id');
  var e = clEstado(id);
  e.q = inp.value;
  e.pagina = 1;
  clearTimeout(_clQTimer);
  _clQTimer = setTimeout(function () {
    var sel = 'input[data-cl-q][data-cl-id="' + id + '"]';
    var antes = document.querySelector(sel);
    var pos = antes ? antes.selectionStart : null;
    _clRepintar(id, null);
    var q = document.querySelector(sel);
    if (q) { q.focus(); if (pos !== null) { try { q.setSelectionRange(pos, pos); } catch (x) { /* type=search */ } } }
  }, 200);
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

// ---- Fase 348 (C5): ver la lista en pantalla completa ----
// La tarjeta de la lista (.aurora-card) pasa a ocupar toda la ventana. #calidad-modal tiene
// transform (animacion de entrada), que encerraria al position:fixed: mientras dure, se le quita
// (cl-con-pantalla). Los dialogos del modulo (Cambiar fecha, detalle) siguen por encima. Escape,
// el mismo boton o cerrar el modulo la devuelven a su lugar.
var _clPantalla = null;
function clBotonPantallaHtml() {
  var on = !!_clPantalla;
  return '<button type="button" class="btn-cancel cl-pantalla-btn" data-cl-pantalla="1" aria-pressed="' + on + '"' +
    (on ? ' title="También con Esc"' : '') + '>' + (on ? 'Salir de pantalla completa' : 'Pantalla completa') + '</button>';
}
function _clPintarBotonesPantalla() {
  var on = !!_clPantalla;
  Array.prototype.forEach.call(document.querySelectorAll('[data-cl-pantalla]'), function (b) {
    b.setAttribute('aria-pressed', String(on));
    b.textContent = on ? 'Salir de pantalla completa' : 'Pantalla completa';
    if (on) b.title = 'También con Esc'; else b.removeAttribute('title');
  });
}
function clEntrarPantalla(card) {
  if (!card) return;
  if (_clPantalla && _clPantalla !== card) clSalirPantalla();
  _clPantalla = card;
  card.classList.add('cl-pantalla');
  var modal = card.closest('#calidad-modal');
  if (modal) modal.classList.add('cl-con-pantalla');
  card.scrollTop = 0;
  _clPintarBotonesPantalla();
}
function clSalirPantalla() {
  var card = _clPantalla;
  if (!card) return;
  _clPantalla = null;
  card.classList.remove('cl-pantalla');
  var modal = card.closest('#calidad-modal');
  if (modal) modal.classList.remove('cl-con-pantalla');
  _clPintarBotonesPantalla();
  var b = card.querySelector('[data-cl-pantalla]');
  if (b) { b.focus(); if (b.scrollIntoView) b.scrollIntoView({ block: 'nearest' }); }
}
document.addEventListener('click', function (ev) {
  var b = ev.target && ev.target.closest ? ev.target.closest('[data-cl-pantalla]') : null;
  if (!b) return;
  var card = b.closest('.aurora-card');
  if (_clPantalla && _clPantalla === card) clSalirPantalla();
  else { clEntrarPantalla(card); b.focus(); }
});
// Escape sale de la pantalla completa (sin cerrar el modulo), salvo que haya un dialogo abierto encima.
document.addEventListener('keydown', function (ev) {
  if (ev.key !== 'Escape' || !_clPantalla) return;
  if (document.querySelector('#calidad-overlay .cc2-ov:not([hidden])')) return; // (los dialogos del modulo viven en #calidad-overlay)
  ev.stopPropagation();
  ev.preventDefault();
  clSalirPantalla();
}, true);
