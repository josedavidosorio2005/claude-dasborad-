// encuesta-monitoreo.js — Fase 331 (PR 4, pedido del supervisor, Mobilize). Boton
// "Monitoreo" en cada pregunta de la pestaña Encuesta del dashboard: las llamadas que
// calificaron mal ESA pregunta con el resultado de su monitoreo (nota, observacion,
// pendiente o resuelta). Una llamada que fallo varias preguntas muestra el mismo
// monitoreo en todas. Separado de la pestaña Calidad del dashboard y SOLO LECTURA.
// Por ahora la cuenta de cliente no lo ve (ni pide la ruta; el servidor tambien le da 403).
// Sin telefonos.
var _encMon = { acceso: {}, ultimo: null };

// true si este usuario ve el boton en esta campaña (lo decide el servidor).
async function encMonCargarAcceso(campana) {
  if (typeof currentUser !== 'undefined' && currentUser && currentUser.rol === 'CLIENTES_DASH') return false;
  if (_encMon.acceso[campana] !== undefined) return _encMon.acceso[campana];
  var ok = false;
  try {
    var r = await apiRequest('GET', '/calidad/encuestas/monitoreo/conteo?campana=' + encodeURIComponent(campana));
    ok = !!(r && r.activa);
  } catch (e) { ok = false; }
  _encMon.acceso[campana] = ok;
  return ok;
}

function encMonBotonHtml(q, i) {
  return '<button type="button" class="btn-sm enc-mon-btn" data-q="' + esc(q.key) + '" data-i="' + esc(i) + '" aria-haspopup="dialog">Monitoreo</button>';
}

document.addEventListener('click', function (ev) {
  var b = ev.target && ev.target.closest ? ev.target.closest('.enc-mon-btn') : null;
  if (!b) return;
  var i = b.getAttribute('data-i');
  var host = document.getElementById('gd-p' + i);
  if (host && host.dataset.campana) encMonAbrir(host.dataset.campana, b.getAttribute('data-q'), b);
});

function _encMonQuery(campana, pregunta) {
  var e = (typeof _encuestaEstado !== 'undefined' && _encuestaEstado[campana]) || {};
  return 'campana=' + encodeURIComponent(campana) + '&estado=todas&pregunta=' + encodeURIComponent(pregunta) +
    (e.desde ? '&desde=' + encodeURIComponent(e.desde) : '') +
    (e.hasta ? '&hasta=' + encodeURIComponent(e.hasta) : '') +
    (e.meses ? '&meses=' + encodeURIComponent(e.meses) : '') +
    (e.skill ? '&skill=' + encodeURIComponent(e.skill) : '') +
    (e.agente ? '&agente=' + encodeURIComponent(e.agente) : '');
}

async function encMonAbrir(campana, pregunta, boton) {
  var ov = document.getElementById('modal-encuesta-monitoreo');
  var cuerpo = document.getElementById('enc-mon-cuerpo');
  var titulo = document.getElementById('modal-encuesta-monitoreo-title');
  if (!ov || !cuerpo) return;
  var q = (ENCUESTA_PREGUNTAS || []).filter(function (x) { return x.key === pregunta; })[0];
  titulo.textContent = 'Monitoreo — Pregunta ' + (q ? q.n : pregunta);
  cuerpo.innerHTML = '<p class="cen-cargando">Cargando…</p>';
  _encMon.boton = boton || null;
  ov.classList.add('show');
  var d;
  try { d = await apiRequest('GET', '/calidad/encuestas/monitoreo?' + _encMonQuery(campana, pregunta)); }
  catch (e) { cuerpo.innerHTML = '<p class="cen-vacio">' + esc(e.message) + '</p>'; return; }
  _encMon.ultimo = d;
  cuerpo.innerHTML = encMonContenidoHtml(d, pregunta);
}

function encMonCerrar() {
  var ov = document.getElementById('modal-encuesta-monitoreo');
  if (ov) ov.classList.remove('show');
  if (_encMon.boton && _encMon.boton.focus) _encMon.boton.focus();
}

function _encMonEstadoHtml(f) {
  if (f.estado === 'resuelta') return '<span class="cen-estado enc-mon-resuelta">Resuelta</span>';
  if (f.bloqueo) return '<span class="cen-estado cen-estado-bloqueada">Pendiente · la están calificando</span>';
  return '<span class="cen-estado enc-mon-pendiente">Pendiente</span>';
}

function encMonContenidoHtml(d, pregunta) {
  var regla = (d.reglas || []).filter(function (r) { return r.pregunta === pregunta; })[0];
  var reglaTxt = regla ? 'Mal calificada: ' + (regla.min === regla.max ? cenValorTexto(pregunta, regla.min) : cenValorTexto(pregunta, regla.min) + ' a ' + cenValorTexto(pregunta, regla.max)) : '';
  var filas = d.filas || [];
  var resueltas = filas.filter(function (f) { return f.estado === 'resuelta'; }).length;
  var html = '<p class="cen-ayuda">' + esc(reglaTxt) + (reglaTxt ? ' · ' : '') + 'mismo periodo y filtros del panel. ' +
    filas.length + (filas.length === 1 ? ' llamada' : ' llamadas') + ': ' + resueltas + ' resuelta' + (resueltas === 1 ? '' : 's') + ', ' + (filas.length - resueltas) + ' pendiente' + (filas.length - resueltas === 1 ? '' : 's') + '.</p>';
  if (!filas.length) return html + '<p class="cen-vacio">Ninguna llamada calificó mal esta pregunta en el periodo.</p>' + _encMonAvisoSinId(d);
  html += '<div class="cen-tabla-wrap"><table class="aurora-rank-table cen-tabla"><thead><tr><th>Fecha y hora</th><th>ID de la llamada</th><th>Agente</th><th>Calificó mal</th><th>Estado</th><th>Nota</th><th>Observación</th></tr></thead><tbody>' +
    filas.map(function (f) {
      var m = f.monitoreo || {};
      return '<tr><td class="enc-mon-fh">' + esc(cenFecha(f.fecha)) + (f.hora ? '<br><span class="cen-nota">' + esc(f.hora) + '</span>' : '') + '</td>' +
        '<td><span class="cen-id"><code>' + esc(f.connId) + '</code><button type="button" class="btn-sm cen-copiar" data-conn="' + esc(f.connId) + '" aria-label="Copiar el ID de la llamada">Copiar</button></span></td>' +
        '<td>' + esc(f.agente ? textoFormatoNombre(f.agente) : '—') + '</td><td><span class="cen-fallas">' + esc(cenFallasTexto(f.fallas)) + '</span></td>' +
        '<td>' + _encMonEstadoHtml(f) + '</td>' +
        '<td class="peak">' + (f.monitoreo ? esc(m.puntaje != null ? m.puntaje : '—') + (m.clasificacion ? ' ' + calEstadoHtml(m.clasificacion) : '') : '—') + '</td>' +
        '<td class="cen-obs">' + esc(f.monitoreo ? (m.observaciones || '—') : '—') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  return html + _encMonAvisoSinId(d);
}

function _encMonAvisoSinId(d) {
  var t = d && d.conteo ? cenAvisoSinId(d.conteo.sinId) : '';
  return t ? '<p class="cen-aviso">' + esc(t) + '</p>' : '';
}
