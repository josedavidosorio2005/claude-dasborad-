// calidad-encuestas.js — Fase 331 (pedido del supervisor, Mobilize). Pestaña
// "Calidad de encuestas" del Modulo de Calidad: llamadas con la encuesta mal
// calificada, pendientes por escuchar (el contador de la pestaña es la alerta,
// solo dentro de la plataforma) y resueltas con su nota y observacion.
//
// Al elegir una fila se toma el bloqueo ("la esta calificando otra persona"
// para los demas), se abre el formulario Calificar de la campaña con el ID de
// la llamada y el asesor (si coincide) y el monitoreo se guarda vinculado a la
// llamada (encuestaConnId). El bloqueo se renueva mientras el formulario siga
// abierto y se libera al guardar o al cancelar. El servidor decide todo
// (acceso, bloqueo, un solo monitoreo por llamada); esto solo lo muestra.
// Fase 344: con el telefono (ANI) de la encuesta, solo si el servidor lo manda (verTelefono:
// CALIDAD, SUPERVISOR, Reportes, administrador). Sin telefono se ve «—» y se califica con el ID.
var _cen = { activa: false, estado: 'pendientes', datos: null, abierta: null, timer: null, campana: null };

function _cenEsc(v) { return esc(v == null ? '' : v); }

// Muestra u oculta la pestaña segun el servidor (403 o campaña sin la funcion
// = oculta) y pinta el contador de pendientes.
async function cenActualizarTab() {
  var btn = document.getElementById('ctab-btn-encuestas');
  if (!btn) return;
  var camp = _ccampana;
  var r = null;
  try { r = camp ? await apiRequest('GET', '/calidad/encuestas/monitoreo/conteo?campana=' + encodeURIComponent(camp)) : null; } catch (e) { r = null; }
  if (camp !== _ccampana) return; // cambio de campaña mientras tanto
  _cen.activa = !!(r && r.activa);
  _cen.activaDe = camp; // Fase 331 (PR 3): el estado es de ESTA campaña
  btn.hidden = !_cen.activa;
  var n = _cen.activa ? (r.pendientes || 0) : 0;
  var badge = document.getElementById('cen-badge');
  if (badge) {
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.hidden = n === 0;
  }
  btn.setAttribute('aria-label', 'Calidad de encuestas' + (n ? ', ' + n + ' pendiente' + (n === 1 ? '' : 's') + ' por escuchar' : ''));
  if (!_cen.activa && _ctab === 'encuestas') switchCalTab(calCanEvaluate() ? 'nuevo' : 'resumen');
  else if (_ctab === 'monitoreos' && typeof renderCalMonitoreosTable === 'function') renderCalMonitoreosTable(); // filtro de origen al dia
}

function cenElegirEstado(estado) {
  _cen.estado = estado === 'resueltas' ? 'resueltas' : 'pendientes';
  cenRender();
}

async function cenRender() {
  var cont = document.getElementById('cen-contenido');
  if (!cont) return;
  var camp = _ccampana;
  cont.innerHTML = '<p class="cen-cargando">Cargando…</p>';
  var d;
  try {
    d = await apiRequest('GET', '/calidad/encuestas/monitoreo?campana=' + encodeURIComponent(camp) + '&estado=' + _cen.estado);
  } catch (e) {
    if (camp === _ccampana) cont.innerHTML = '<p class="cen-vacio">' + _cenEsc(e.message) + '</p>';
    return;
  }
  if (camp !== _ccampana) return;
  _cen.datos = d;
  _cenPintarContador(d.conteo.pendientes);
  var c = d.conteo;
  var botones = [{ v: 'pendientes', t: 'Pendientes', n: c.pendientes }, { v: 'resueltas', t: 'Resueltas', n: c.resueltas }].map(function (b) {
    return '<button type="button" class="gd-subtab-btn' + (_cen.estado === b.v ? ' on' : '') + '" aria-pressed="' + (_cen.estado === b.v) + '" onclick="cenElegirEstado(\'' + b.v + '\')">' + b.t + ' (' + b.n + ')</button>';
  }).join('');
  var sinHora = d.filas.some(function (f) { return !f.hora; });
  var html = '<div class="cen-cab"><div class="cen-filtro" role="group" aria-label="Estado de las llamadas">' + botones + '</div>' +
    (d.puedeCalificar ? '' : '<span class="cen-nota">Solo lectura: calificar es del equipo de Calidad y del supervisor.</span>') + '</div>' +
    '<p class="cen-ayuda">Llamadas con la encuesta mal calificada (' + _cenEsc(_cenReglasTexto(d.reglas)) + '). Una fila por llamada; con el ID de la llamada, la fecha y la hora se ubica la grabación en Wolkvox.</p>';
  if (!d.filas.length) {
    html += '<p class="cen-vacio">' + (_cen.estado === 'pendientes' ? 'No hay llamadas pendientes por escuchar.' : 'Todavía no hay llamadas resueltas.') + '</p>';
  } else {
    html += '<div class="cen-tabla-wrap"><table class="aurora-rank-table cen-tabla"><thead><tr><th>Fecha</th><th>Hora</th><th>ID de la llamada</th>' + (d.verTelefono ? '<th>Teléfono</th>' : '') + '<th>Agente</th><th>Preguntas mal calificadas</th>' +
      (_cen.estado === 'resueltas' ? '<th>Nota</th><th>Observación</th><th>Evaluador</th>' : '<th><span class="sr-only">Acción</span></th>') + '</tr></thead><tbody>' +
      d.filas.map(function (f) { return _cenFilaHtml(f, d.puedeCalificar, !!d.verTelefono); }).join('') + '</tbody></table></div>';
  }
  var avisos = [];
  if (c.sinId) avisos.push(cenAvisoSinId(c.sinId));
  if (d.verTelefono && d.filas.some(function (f) { return !f.telefono; })) avisos.push('Las encuestas cargadas antes de esta versión no tienen teléfono (se ve «—»; se califican igual con el ID): aparece al volver a subir ese mes en Cargar Datos.'); // Fase 344
  if (sinHora) avisos.push('Las encuestas cargadas antes de esta versión no tienen hora: aparece al volver a subir ese mes en Cargar Datos.');
  if (avisos.length) html += '<p class="cen-aviso">' + avisos.map(_cenEsc).join('<br>') + '</p>';
  cont.innerHTML = html;
}

function _cenReglasTexto(reglas) {
  return (reglas || []).map(function (r) {
    var desde = cenValorTexto(r.pregunta, r.min), hasta = cenValorTexto(r.pregunta, r.max);
    return cenPreguntaCorta(r.pregunta) + ' ' + (r.min === r.max ? desde : desde + ' a ' + hasta);
  }).join(', ');
}

function _cenPintarContador(n) {
  var badge = document.getElementById('cen-badge');
  if (!badge) return;
  badge.textContent = n > 99 ? '99+' : String(n);
  badge.hidden = !n;
}

function _cenIdHtml(connId) {
  var v = cenIdVisible(connId); // Fase 336: sin el apostrofo inicial al verlo y al copiarlo
  return '<span class="cen-id"><code>' + _cenEsc(v) + '</code><button type="button" class="btn-sm cen-copiar" data-conn="' + _cenEsc(v) + '" aria-label="Copiar el ID de la llamada">Copiar</button></span>';
}

// Fase 344: telefono con su boton Copiar; «—» si la encuesta se cargo sin ANI.
function _cenTelHtml(tel) {
  if (!tel) return '<span class="cen-sin-tel">—<span class="sr-only"> sin teléfono</span></span>';
  return '<span class="cen-id"><code>' + _cenEsc(tel) + '</code><button type="button" class="btn-sm cen-copiar" data-conn="' + _cenEsc(tel) + '" data-que="tel" aria-label="Copiar el teléfono">Copiar</button></span>';
}

function _cenFilaHtml(f, puedeCalificar, verTel) {
  var celdas = '<td>' + _cenEsc(cenFecha(f.fecha)) + '</td><td>' + _cenEsc(f.hora || '—') + '</td><td>' + _cenIdHtml(f.connId) + '</td>' +
    (verTel ? '<td>' + _cenTelHtml(f.telefono) + '</td>' : '') +
    '<td>' + _cenEsc(f.agente ? textoFormatoNombre(f.agente) : '—') + '</td><td><span class="cen-fallas">' + _cenEsc(cenFallasTexto(f.fallas)) + '</span></td>';
  if (f.estado === 'resuelta') {
    var m = f.monitoreo || {};
    return '<tr>' + celdas + '<td class="peak">' + _cenEsc(m.puntaje != null ? m.puntaje : '—') + (m.clasificacion ? ' ' + calEstadoHtml(m.clasificacion) : '') + '</td>' +
      '<td class="cen-obs">' + _cenEsc(m.observaciones || '—') + '</td><td>' + _cenEsc(m.evaluador || '—') + '</td></tr>';
  }
  var e = cenEstadoFila(f, puedeCalificar);
  var accion = e.tipo === 'calificar'
    ? '<button type="button" class="btn-primary btn-sm cen-abrir" data-conn="' + _cenEsc(f.connId) + '">' + _cenEsc(e.texto) + '</button>'
    : '<span class="cen-estado cen-estado-' + e.tipo + '">' + _cenEsc(e.texto) + '</span>';
  return '<tr>' + celdas + '<td>' + accion + '</td></tr>';
}

// Copiar y abrir por delegacion (sin onclick con el ID dentro del HTML).
document.addEventListener('click', function (ev) {
  var t = ev.target;
  if (!t || !t.closest) return;
  var cp = t.closest('.cen-copiar');
  if (cp) { cenCopiar(cp.getAttribute('data-conn'), cp.getAttribute('data-que')); return; }
  var ab = t.closest('.cen-abrir');
  if (ab) cenAbrir(ab.getAttribute('data-conn'));
});

async function cenCopiar(texto, que) {
  var cosa = que === 'tel' ? 'el teléfono' : 'el ID de la llamada'; // Fase 344
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(texto);
    else throw new Error('sin portapapeles');
    showToast(que === 'tel' ? 'Teléfono copiado' : 'ID de la llamada copiado');
  } catch (e) {
    showToast('No se pudo copiar: selecciona ' + cosa + ' y cópialo a mano', 'error');
  }
}

// Toma el bloqueo y abre el formulario Calificar ya lleno.
async function cenAbrir(connId) {
  if (_cen.abierta && _cen.abierta.connId !== connId) {
    showToast('Ya tienes abierta otra llamada: guárdala o cancélala primero', 'error');
    switchCalTab('nuevo');
    return;
  }
  var r;
  try {
    r = await apiRequest('POST', '/calidad/encuestas/monitoreo/bloqueo', { campana: _ccampana, connId: connId });
  } catch (e) {
    showToast(e.message, 'error');
    if (_ctab === 'encuestas') cenRender();
    return;
  }
  _cen.abierta = r.llamada;
  _cen.campana = _ccampana;
  _cenIniciarRenovacion(r.renovarMs);
  // Formulario limpio (sin salir de una edicion a medias) con la plantilla principal.
  if (typeof cc2Limpiar === 'function') cc2Limpiar();
  if (typeof _calPlantillaElegida !== 'undefined') _calPlantillaElegida[_ccampana] = null;
  if (typeof resetCalForm === 'function') resetCalForm();
  switchCalTab('nuevo');
  if (typeof cc2Sync === 'function') cc2Sync();
  _cenPrellenar(r.llamada);
  _cenPintarBanner();
  var b = document.getElementById('cen-banner');
  if (b && b.scrollIntoView) b.scrollIntoView({ block: 'nearest' });
}

function _cenPrellenar(ll) {
  // Fase 340: un solo formulario (el comun, #cf2).
  var setVal = function (id, v) { var el = document.getElementById(id); if (el) el.value = v; };
  setVal('cc2-f-idLlamada', cenIdVisible(ll.connId)); // Fase 336: como se ve (el vinculo va aparte, con el original)
  if (ll.telefono) setVal('cc2-f-telefono', ll.telefono); // Fase 344: si la plantilla trae el campo
  // Asesor: solo si coincide con un usuario ASESOR de la campaña; si no, lo elige el evaluador.
  var sel = document.getElementById('cc2-f-asesor');
  if (!sel) return;
  var opciones = Array.prototype.map.call(sel.options, function (o) { return { nombre: o.value, opt: o }; }).filter(function (x) { return x.nombre; });
  var hallado = cenBuscarAsesor(ll.agente, opciones);
  if (hallado) {
    sel.value = hallado.nombre;
    if (typeof _cc2AsesorElegido === 'function') _cc2AsesorElegido();
  }
  _cen.asesorEncontrado = !!hallado;
}

function _cenPintarBanner() {
  var b = document.getElementById('cen-banner');
  if (!b) return;
  var ll = _cen.abierta;
  if (!ll || _cen.campana !== _ccampana) { b.hidden = true; b.innerHTML = ''; return; }
  b.hidden = false;
  b.innerHTML =
    '<div class="cen-banner-txt"><strong>Calificando una llamada de Calidad de encuestas</strong>' +
      '<dl class="cen-datos"><div><dt>ID de la llamada</dt><dd>' + _cenIdHtml(ll.connId) + '</dd></div>' +
      ('telefono' in ll ? '<div><dt>Teléfono</dt><dd>' + _cenTelHtml(ll.telefono) + '</dd></div>' : '') + // Fase 344
      '<div><dt>Fecha</dt><dd>' + _cenEsc(cenFecha(ll.fecha)) + '</dd></div>' +
      '<div><dt>Hora</dt><dd>' + _cenEsc(ll.hora || '—') + '</dd></div>' +
      '<div><dt>Agente</dt><dd>' + _cenEsc(ll.agente ? textoFormatoNombre(ll.agente) : '—') + '</dd></div>' +
      '<div><dt>Calificó mal</dt><dd>' + _cenEsc(cenFallasTexto(ll.fallas)) + '</dd></div></dl>' +
      (_cen.asesorEncontrado ? '' : '<p class="cen-nota">El agente de Wolkvox no coincide con un asesor de la plataforma: elígelo en la lista.</p>') +
      '<p class="cen-nota">Nadie más puede abrirla mientras la tengas abierta. Busca la grabación en Wolkvox, califica y guarda.</p></div>' +
    '<button type="button" class="btn-cancel" onclick="cenCancelar()">Cancelar</button>';
}

function _cenIniciarRenovacion(ms) {
  _cenPararRenovacion();
  var cada = Math.max(30000, Number(ms) || 120000);
  _cen.timer = setInterval(async function () {
    if (!_cen.abierta) { _cenPararRenovacion(); return; }
    try {
      await apiRequest('POST', '/calidad/encuestas/monitoreo/bloqueo', { campana: _cen.campana, connId: _cen.abierta.connId });
    } catch (e) {
      showToast(e.message, 'error');
      if (e.status === 409 || e.status === 404) _cenSalir();
    }
  }, cada);
}
function _cenPararRenovacion() { if (_cen.timer) clearInterval(_cen.timer); _cen.timer = null; }

function _cenSalir() {
  _cenPararRenovacion();
  _cen.abierta = null;
  _cen.campana = null;
  _cen.asesorEncontrado = false;
  _cenPintarBanner();
}

// Cancelar: libera el bloqueo (para los demas) y vuelve a la lista.
async function cenCancelar(sinVolver) {
  var ll = _cen.abierta, camp = _cen.campana;
  _cenSalir();
  if (ll) { try { await apiRequest('POST', '/calidad/encuestas/monitoreo/liberar', { campana: camp, connId: ll.connId }); } catch (e) { /* vence solo a los 15 min */ } }
  if (sinVolver) return;
  if (typeof cc2Limpiar === 'function') cc2Limpiar();
  if (typeof resetCalForm === 'function') resetCalForm();
  switchCalTab('encuestas');
  cenActualizarTab();
}

// Lo que agregan los formularios de Calificar al guardar uno NUEVO.
function cenCampoGuardar() {
  return _cen.abierta && _cen.campana === _ccampana ? { encuestaConnId: _cen.abierta.connId } : {};
}
function cenModoActivo() { return !!(_cen.abierta && _cen.campana === _ccampana); }

// Despues de guardar el monitoreo de la llamada: el servidor ya libero el bloqueo.
function cenDespuesDeGuardar() {
  _cenSalir();
  switchCalTab('encuestas');
  cenActualizarTab();
}

// Al cerrar el modulo o cambiar de campaña con una llamada abierta: se libera.
function cenAlSalirDelModulo() { if (_cen.abierta) cenCancelar(true); }

// Fase 331 (PR 3): filtro por origen de la lista de Monitoreos (Calidad › Monitoreos).
// Solo cambia lo que se LISTA: las tarjetas, el resumen y los promedios no cambian
// (que los de encuesta salgan del promedio lo decide el supervisor).
function cenPrepararFiltroOrigen(lista) {
  var cont = document.getElementById('cal-origen-fil');
  var sel = document.getElementById('cal-origen-sel');
  if (!cont || !sel) return null;
  var mostrar = !!((_cen.activa && _cen.activaDe === _ccampana) || (lista || []).some(function (m) { return cenOrigenDe(m) === 'encuesta'; }));
  cont.hidden = !mostrar;
  if (!mostrar) { sel.value = ''; return { lista: lista, origen: '' }; }
  var nota = document.getElementById('cal-origen-nota');
  if (nota) nota.textContent = cenNotaOrigen(lista);
  return { lista: cenFiltrarPorOrigen(lista, sel.value), origen: sel.value };
}
