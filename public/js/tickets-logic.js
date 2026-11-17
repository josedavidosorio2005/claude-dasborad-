// tickets-logic.js — Fase 356: «Sugerencias / Tickets». Lógica pura (sin DOM) de la interfaz:
// textos de tipo y estado, quién gestiona, contador de caracteres, fechas en hora de Colombia
// y el HTML (escapado) de la lista, del detalle y del hilo. Las reglas reales viven en el
// servidor (server/tickets.js); aquí solo se decide qué botones se muestran.
'use strict';

var TICKETS_TEXTO_MAX = 2000;
var TICKETS_TIPOS = [
  { valor: 'SUGERENCIA', etiqueta: 'Sugerencia' },
  { valor: 'PROBLEMA', etiqueta: 'Problema' },
  { valor: 'PREGUNTA', etiqueta: 'Pregunta' },
];
var TICKETS_ESTADOS = [
  { valor: 'NUEVO', etiqueta: 'Nuevo' },
  { valor: 'EN_REVISION', etiqueta: 'En revisión' },
  { valor: 'RESUELTO', etiqueta: 'Resuelto' },
];
var TICKETS_AVISO_PRIVACIDAD = 'No incluyas datos de pacientes ni datos personales.';

function _tkEsc(v) {
  return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function _tkLbl(lista, v) {
  var x = lista.find(function (o) { return o.valor === v; });
  return x ? x.etiqueta : String(v || '');
}
function ticketsTipoLbl(v) { return _tkLbl(TICKETS_TIPOS, v); }
function ticketsEstadoLbl(v) { return _tkLbl(TICKETS_ESTADOS, v); }
function ticketsCampanaLbl(v) { return v === 'GENERAL' ? 'General (plataforma)' : String(v || ''); }

// Solo para mostrar botones: el servidor vuelve a exigir lo mismo.
function ticketsEsGestor(rol, esAdmin) { return !!esAdmin || rol === 'REPORTES'; }
function ticketsPuedeBorrar(esAdmin) { return !!esAdmin; }

// «123 / 2.000»; sobra = true si se pasa (el textarea ya tiene maxlength).
function ticketsContador(texto) {
  var n = String(texto || '').length;
  return { n: n, texto: n.toLocaleString('es-CO') + ' / ' + TICKETS_TEXTO_MAX.toLocaleString('es-CO'), sobra: n > TICKETS_TEXTO_MAX };
}
function ticketsTextoValido(texto) {
  var t = String(texto || '').trim();
  return t.length >= 1 && t.length <= TICKETS_TEXTO_MAX;
}

// Fecha ISO del servidor → «17/11/2026 3:45 p. m.» en hora de Colombia.
function ticketsFecha(iso) {
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  try {
    return d.toLocaleString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch (e) { return d.toISOString().slice(0, 16).replace('T', ' '); }
}

function ticketsBadgeTexto(n) {
  n = Number(n) || 0;
  if (n <= 0) return '';
  return n > 99 ? '99+' : String(n);
}
function ticketsBotonEtiqueta(n) {
  n = Number(n) || 0;
  return n > 0 ? 'Sugerencias / Tickets (' + n + (n === 1 ? ' nuevo)' : ' nuevos)') : 'Sugerencias / Tickets';
}

function _tkEstadoPill(estado) {
  var cls = estado === 'RESUELTO' ? 'tk-estado-resuelto' : (estado === 'EN_REVISION' ? 'tk-estado-revision' : 'tk-estado-nuevo');
  return '<span class="tk-estado ' + cls + '">' + _tkEsc(ticketsEstadoLbl(estado)) + '</span>';
}

// Lista: un botón por ticket (abre el detalle). conAutor: el gestor ve quién lo envió.
function ticketsListaHtml(tickets, conAutor) {
  if (!tickets || !tickets.length) return '<p class="tk-vacio">No hay tickets para mostrar.</p>';
  return '<ul class="tk-lista">' + tickets.map(function (t) {
    var resumen = String(t.descripcion || '');
    if (resumen.length > 140) resumen = resumen.slice(0, 140) + '…';
    return '<li><button type="button" class="tk-item" data-tk-id="' + _tkEsc(t.id) + '">' +
      '<span class="tk-item-cab"><span class="tk-num">#' + _tkEsc(t.id) + '</span> ' +
      '<span class="tk-tipo">' + _tkEsc(ticketsTipoLbl(t.tipo)) + '</span> · ' +
      '<span class="tk-camp">' + _tkEsc(ticketsCampanaLbl(t.campana)) + '</span>' + _tkEstadoPill(t.estado) + '</span>' +
      '<span class="tk-resumen">' + _tkEsc(resumen) + '</span>' +
      '<span class="tk-meta">' + (conAutor ? _tkEsc(t.autorNombre) + ' (' + _tkEsc(t.autorRol) + ') · ' : '') +
      _tkEsc(ticketsFecha(t.createdAt)) + ' · ' + _tkEsc(t.respuestas || 0) + (Number(t.respuestas) === 1 ? ' respuesta' : ' respuestas') + '</span>' +
      '</button></li>';
  }).join('') + '</ul>';
}

// Hilo de respuestas (texto con saltos de línea respetados por CSS, todo escapado).
function ticketsHiloHtml(respuestas) {
  if (!respuestas || !respuestas.length) return '<p class="tk-vacio">Todavía no hay respuestas.</p>';
  return '<ol class="tk-hilo">' + respuestas.map(function (r) {
    return '<li class="tk-msg' + (r.esMia ? ' tk-msg-mio' : '') + '">' +
      '<span class="tk-meta">' + _tkEsc(r.esMia ? 'Tú' : r.autorNombre) + ' (' + _tkEsc(r.autorRol) + ') · ' + _tkEsc(ticketsFecha(r.createdAt)) + '</span>' +
      '<p class="tk-texto">' + _tkEsc(r.texto) + '</p></li>';
  }).join('') + '</ol>';
}

function ticketsOpcionesHtml(lista, seleccion, conTodos) {
  return (conTodos ? '<option value="">Todos</option>' : '') + lista.map(function (o) {
    return '<option value="' + _tkEsc(o.valor) + '"' + (o.valor === seleccion ? ' selected' : '') + '>' + _tkEsc(o.etiqueta) + '</option>';
  }).join('');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TICKETS_TEXTO_MAX: TICKETS_TEXTO_MAX, TICKETS_TIPOS: TICKETS_TIPOS, TICKETS_ESTADOS: TICKETS_ESTADOS, TICKETS_AVISO_PRIVACIDAD: TICKETS_AVISO_PRIVACIDAD,
    ticketsTipoLbl: ticketsTipoLbl, ticketsEstadoLbl: ticketsEstadoLbl, ticketsCampanaLbl: ticketsCampanaLbl,
    ticketsEsGestor: ticketsEsGestor, ticketsPuedeBorrar: ticketsPuedeBorrar,
    ticketsContador: ticketsContador, ticketsTextoValido: ticketsTextoValido, ticketsFecha: ticketsFecha,
    ticketsBadgeTexto: ticketsBadgeTexto, ticketsBotonEtiqueta: ticketsBotonEtiqueta,
    ticketsListaHtml: ticketsListaHtml, ticketsHiloHtml: ticketsHiloHtml, ticketsOpcionesHtml: ticketsOpcionesHtml,
  };
}
