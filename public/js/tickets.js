// tickets.js — Fase 356: «Sugerencias / Tickets» (interfaz). Botón en el menú de cuenta de las
// 4 páginas; un diálogo con «Nuevo», «Mis tickets» y, para ADMIN y REPORTES, «Todos». El
// servidor decide todo (server/tickets.js); aquí solo se pinta. Todo texto del servidor se
// escapa (tickets-logic.js) o va por textContent. Sin adjuntos.
'use strict';

var _tk = { campanas: [], gestor: false, borrar: false, tab: 'nuevo', detalle: null, cargado: false, timer: null };
var TK_INTERVALO_CONTADOR_MS = 5 * 60 * 1000;

function _tkEl(id) { return document.getElementById(id); }
function _tkError(msg) {
  var e = _tkEl('tk-error');
  if (!e) return;
  e.textContent = msg || '';
  e.classList.toggle('hidden', !msg);
}

// ── Contador de «Nuevo» (solo ADMIN y REPORTES) ──
function _tkPintarContador(n) {
  var txt = ticketsBadgeTexto(n);
  document.querySelectorAll('[data-tk-badge]').forEach(function (b) {
    b.textContent = b.classList.contains('tk-badge-punto') ? '' : txt;
    b.classList.toggle('hidden', !txt);
  });
  var lbl = ticketsBotonEtiqueta(n);
  document.querySelectorAll('.tk-menu-btn').forEach(function (b) { b.setAttribute('aria-label', lbl); });
  document.querySelectorAll('.navbar-profile-toggle').forEach(function (b) { b.setAttribute('aria-label', Number(n) > 0 ? 'Cuenta (' + lbl.replace('Sugerencias / Tickets ', 'tickets ') + ')' : 'Cuenta'); });
}
async function ticketsActualizarContador() {
  if (!_tk.gestor) { _tkPintarContador(0); return; }
  try { var r = await apiRequest('GET', '/tickets/contador'); _tkPintarContador(r.nuevos); } catch (e) { /* sin contador */ }
}

async function _tkCargarCampanas() {
  var r = await apiRequest('GET', '/tickets/campanas');
  _tk.campanas = r.campanas || [];
  _tk.gestor = !!r.gestor;
  _tk.borrar = !!r.puedeBorrar;
  _tk.cargado = true;
}

// Al entrar (session.js) y al salir (doLogout).
async function ticketsAlEntrar() {
  ticketsAlSalir();
  try { await _tkCargarCampanas(); } catch (e) { return; }
  if (_tk.gestor) {
    ticketsActualizarContador();
    _tk.timer = setInterval(ticketsActualizarContador, TK_INTERVALO_CONTADOR_MS);
  }
}
function ticketsAlSalir() {
  if (_tk.timer) clearInterval(_tk.timer);
  _tk = { campanas: [], gestor: false, borrar: false, tab: 'nuevo', detalle: null, cargado: false, timer: null };
  _tkPintarContador(0);
  var m = _tkEl('modal-tickets');
  if (m && m.classList.contains('show')) closeModal('modal-tickets');
}

// ── Abrir / cerrar ──
async function ticketsAbrir() {
  if (typeof closeNavbarProfile === 'function') closeNavbarProfile();
  _tkError('');
  if (!_tk.cargado) {
    try { await _tkCargarCampanas(); } catch (e) { showToast('No se pudo abrir Sugerencias / Tickets: ' + (e.message || 'error'), 'error'); return; }
  }
  _tkEl('tk-tipo').innerHTML = ticketsOpcionesHtml(TICKETS_TIPOS, 'SUGERENCIA', false);
  _tkEl('tk-campana').innerHTML = '<option value="">Elige la campaña</option>' + ticketsOpcionesHtml(_tk.campanas, null, false);
  _tkEl('tk-aviso').textContent = TICKETS_AVISO_PRIVACIDAD;
  _tkEl('tk-aviso-resp').textContent = TICKETS_AVISO_PRIVACIDAD;
  _tkEl('tk-f-estado').innerHTML = ticketsOpcionesHtml(TICKETS_ESTADOS, null, true);
  _tkEl('tk-f-tipo').innerHTML = ticketsOpcionesHtml(TICKETS_TIPOS, null, true);
  _tkEl('tk-f-campana').innerHTML = ticketsOpcionesHtml(_tk.campanas, null, true);
  _tkEl('tk-det-estado').innerHTML = ticketsOpcionesHtml(TICKETS_ESTADOS, null, false);
  document.querySelector('[data-tk-tab="todos"]').classList.toggle('hidden', !_tk.gestor);
  _tkContadores();
  openModal('modal-tickets');
  _tkMostrarTab(_tk.gestor ? 'todos' : 'nuevo');
}
function ticketsCerrar() {
  closeModal('modal-tickets');
  var b = document.querySelector('.app-page[style*="block"] .tk-menu-btn') || document.querySelector('.tk-menu-btn');
  if (b && b.offsetParent !== null) b.focus();
  ticketsActualizarContador();
}

function _tkMostrarTab(tab) {
  _tk.tab = tab;
  _tk.detalle = null;
  _tkError('');
  document.querySelectorAll('[data-tk-tab]').forEach(function (b) { b.classList.toggle('on', b.dataset.tkTab === tab); });
  _tkEl('tk-panel-nuevo').classList.toggle('hidden', tab !== 'nuevo');
  _tkEl('tk-panel-lista').classList.toggle('hidden', tab === 'nuevo');
  _tkEl('tk-panel-detalle').classList.add('hidden');
  _tkEl('tk-filtros').classList.toggle('hidden', tab !== 'todos');
  // El foco va después de que motion-helpers.js termine de abrir el diálogo (si no, lo pisa).
  if (tab === 'nuevo') setTimeout(function () { var t = _tkEl('tk-tipo'); if (t && t.offsetParent !== null) t.focus(); }, 60);
  else _tkCargarLista();
}

// ── Lista ──
async function _tkCargarLista() {
  var cont = _tkEl('tk-lista');
  cont.innerHTML = '<p class="tk-vacio">Cargando…</p>';
  var q = ['alcance=' + (_tk.tab === 'todos' ? 'todos' : 'mios')];
  if (_tk.tab === 'todos') {
    ['estado', 'tipo', 'campana'].forEach(function (k) { var v = _tkEl('tk-f-' + k).value; if (v) q.push(k + '=' + encodeURIComponent(v)); });
  }
  try {
    var r = await apiRequest('GET', '/tickets?' + q.join('&'));
    cont.innerHTML = ticketsListaHtml(r.tickets, _tk.tab === 'todos');
  } catch (e) {
    cont.innerHTML = '';
    _tkError(e.message || 'No se pudo cargar la lista');
  }
}

// ── Nuevo ──
function _tkContadores() {
  [['tk-desc', 'tk-desc-cont'], ['tk-resp', 'tk-resp-cont']].forEach(function (p) {
    var c = ticketsContador(_tkEl(p[0]).value);
    _tkEl(p[1]).textContent = c.texto + ' caracteres';
  });
}
async function _tkEnviar(ev) {
  ev.preventDefault();
  _tkError('');
  var body = { tipo: _tkEl('tk-tipo').value, campana: _tkEl('tk-campana').value, descripcion: _tkEl('tk-desc').value };
  if (!body.campana) { _tkError('Elige la campaña'); _tkEl('tk-campana').focus(); return; }
  if (!ticketsTextoValido(body.descripcion)) { _tkError('Escribe la descripción (hasta 2.000 caracteres)'); _tkEl('tk-desc').focus(); return; }
  try {
    var r = await withButtonLoading(_tkEl('tk-enviar-btn'), 'Enviando…', function () { return apiRequest('POST', '/tickets', body); });
    _tkEl('tk-desc').value = '';
    _tkContadores();
    showToast('Ticket #' + r.ticket.id + ' enviado', 'ok');
    ticketsActualizarContador();
    _tkMostrarTab('mios');
  } catch (e) {
    _tkError(e.message || 'No se pudo enviar');
  }
}

// ── Detalle ──
async function _tkAbrirDetalle(id) {
  _tkError('');
  try {
    var r = await apiRequest('GET', '/tickets/' + encodeURIComponent(id));
    _tk.detalle = r.ticket;
    _tkPintarDetalle(r.ticket, r.respuestas);
    _tkEl('tk-panel-lista').classList.add('hidden');
    _tkEl('tk-panel-detalle').classList.remove('hidden');
    _tkEl('tk-det-titulo').focus();
  } catch (e) {
    _tkError(e.message || 'No se pudo abrir el ticket');
  }
}
function _tkPintarDetalle(t, respuestas) {
  _tkEl('tk-det-titulo').textContent = 'Ticket #' + t.id + ' · ' + ticketsTipoLbl(t.tipo) + ' · ' + ticketsCampanaLbl(t.campana);
  _tkEl('tk-det-titulo').setAttribute('tabindex', '-1');
  _tkEl('tk-det-meta').textContent = (t.esMio ? 'Enviado por ti' : 'Enviado por ' + t.autorNombre + ' (' + t.autorRol + ')') +
    ' · ' + ticketsFecha(t.createdAt) + ' · Estado: ' + ticketsEstadoLbl(t.estado);
  _tkEl('tk-det-desc').textContent = t.descripcion;
  _tkEl('tk-gestion').classList.toggle('hidden', !_tk.gestor);
  _tkEl('tk-det-estado').value = t.estado;
  _tkEl('tk-hilo').innerHTML = ticketsHiloHtml(respuestas);
  _tkEl('tk-resp').value = '';
  _tkContadores();
  _tkEl('tk-borrar-wrap').classList.toggle('hidden', !_tk.borrar);
  ticketsCancelarBorrar();
}
function ticketsVolver() {
  _tk.detalle = null;
  _tkEl('tk-panel-detalle').classList.add('hidden');
  _tkEl('tk-panel-lista').classList.remove('hidden');
  _tkCargarLista();
}

async function ticketsResponder() {
  if (!_tk.detalle) return;
  _tkError('');
  var texto = _tkEl('tk-resp').value;
  if (!ticketsTextoValido(texto)) { _tkError('Escribe la respuesta (hasta 2.000 caracteres)'); _tkEl('tk-resp').focus(); return; }
  try {
    var r = await withButtonLoading(_tkEl('tk-resp-btn'), 'Enviando…', function () {
      return apiRequest('POST', '/tickets/' + _tk.detalle.id + '/respuestas', { texto: texto });
    });
    _tkEl('tk-hilo').innerHTML = ticketsHiloHtml(r.respuestas);
    _tkEl('tk-resp').value = '';
    _tkContadores();
    showToast('Respuesta enviada', 'ok');
  } catch (e) {
    _tkError(e.message || 'No se pudo enviar la respuesta');
  }
}

async function ticketsGuardarEstado() {
  if (!_tk.detalle || !_tk.gestor) return;
  _tkError('');
  try {
    var r = await withButtonLoading(_tkEl('tk-estado-btn'), 'Guardando…', function () {
      return apiRequest('PUT', '/tickets/' + _tk.detalle.id + '/estado', { estado: _tkEl('tk-det-estado').value });
    });
    _tk.detalle = r.ticket;
    _tkEl('tk-det-meta').textContent = (r.ticket.esMio ? 'Enviado por ti' : 'Enviado por ' + r.ticket.autorNombre + ' (' + r.ticket.autorRol + ')') +
      ' · ' + ticketsFecha(r.ticket.createdAt) + ' · Estado: ' + ticketsEstadoLbl(r.ticket.estado);
    showToast('Estado: ' + ticketsEstadoLbl(r.ticket.estado), 'ok');
    ticketsActualizarContador();
  } catch (e) {
    _tkError(e.message || 'No se pudo cambiar el estado');
  }
}

function ticketsPedirBorrar() {
  _tkEl('tk-borrar-btn').classList.add('hidden');
  _tkEl('tk-confirmar').classList.remove('hidden');
  _tkEl('tk-borrar-si').focus();
}
function ticketsCancelarBorrar() {
  _tkEl('tk-borrar-btn').classList.remove('hidden');
  _tkEl('tk-confirmar').classList.add('hidden');
}
async function ticketsBorrar() {
  if (!_tk.detalle || !_tk.borrar) return;
  var id = _tk.detalle.id;
  try {
    await withButtonLoading(_tkEl('tk-borrar-si'), 'Borrando…', function () { return apiRequest('DELETE', '/tickets/' + id); });
    showToast('Ticket #' + id + ' borrado', 'ok');
    ticketsActualizarContador();
    ticketsVolver();
  } catch (e) {
    _tkError(e.message || 'No se pudo borrar');
  }
}

// ── Eventos ──
(function () {
  if (typeof document === 'undefined') return;
  document.addEventListener('click', function (e) {
    var tab = e.target.closest && e.target.closest('[data-tk-tab]');
    if (tab) { _tkMostrarTab(tab.dataset.tkTab); return; }
    var item = e.target.closest && e.target.closest('.tk-item[data-tk-id]');
    if (item) { _tkAbrirDetalle(item.dataset.tkId); return; }
    var m = _tkEl('modal-tickets');
    if (m && e.target === m) ticketsCerrar();
  });
  var f = _tkEl('tk-form');
  if (f) f.addEventListener('submit', _tkEnviar);
  ['tk-desc', 'tk-resp'].forEach(function (id) { var el = _tkEl(id); if (el) el.addEventListener('input', _tkContadores); });
  // Al corregir el campo, el aviso de error se va (si no, «Elige la campaña» quedaba a la vista).
  ['tk-campana', 'tk-desc', 'tk-resp'].forEach(function (id) {
    var el = _tkEl(id);
    if (el) el.addEventListener(id === 'tk-campana' ? 'change' : 'input', function () { _tkError(''); });
  });
  ['tk-f-estado', 'tk-f-tipo', 'tk-f-campana'].forEach(function (id) { var el = _tkEl(id); if (el) el.addEventListener('change', _tkCargarLista); });
})();
