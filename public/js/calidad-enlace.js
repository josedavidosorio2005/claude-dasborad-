// calidad-enlace.js — Fase 353 (reporte de Edwin, 13/11). Un monitoreo llega al Portal Asesor
// por el id del usuario ASESOR o, sin id, solo si el nombre es EXACTO. Aqui:
//  1. «Enlazar monitoreos a usuario» (Calidad › Configuración, solo el administrador): los
//     monitoreos sin usuario de la campaña, agrupados por el nombre escrito, con la sugerencia si
//     hay una sola parecida. El administrador elige el usuario y confirma con dos clics: nunca se
//     enlaza por parecido solo. Se puede deshacer justo despues. Todo queda en el Historial.
//  2. Avisos de la vista previa de una carga de Calidad (módulo y Centro de cargas): los nombres
//     que no coinciden exacto con un usuario ASESOR de la campaña.

var _enl = { campana: null, datos: null, ultimo: null };

function _enlMesLbl(m) {
  var p = String(m || '').split('-');
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return p.length === 2 ? (MESES[Number(p[1]) - 1] || p[1]) + ' ' + p[0] : String(m || '');
}

// ── 2. Avisos de carga ──
function calEnlaceTextoNombre(x) {
  var s = '«' + x.asesor + '» (' + x.filas + ' fila' + (x.filas === 1 ? '' : 's') + ')';
  if (x.sugerencia) s += ': ¿es «' + x.sugerencia.nombre + '»? (' + x.sugerencia.tipo + ')';
  return s;
}
function calEnlaceAvisoSinUsuario(lista) {
  if (!lista || !lista.length) return '';
  return lista.length + ' nombre' + (lista.length === 1 ? '' : 's') + ' de asesor no coincide' + (lista.length === 1 ? '' : 'n') +
    ' exacto con un usuario ASESOR de la campaña: esos monitoreos no le llegan a su Portal Asesor hasta enlazarlos ' +
    '(Calidad › Configuración › Enlazar monitoreos a usuario). ' + lista.map(calEnlaceTextoNombre).join(' · ');
}
// Para la vista previa (antes de guardar). Si no se puede revisar, la carga sigue como siempre.
async function calEnlaceAvisosCarga(campana, filas) {
  try {
    var asesores = (filas || []).map(function (f) { return f && f.asesor != null ? String(f.asesor) : ''; });
    var r = await apiRequest('POST', '/monitoreos/revisar-asesores', { campana: campana, asesores: asesores });
    var t = calEnlaceAvisoSinUsuario(r && r.sinUsuario);
    return t ? [t] : [];
  } catch (e) { return []; }
}

// ── 1. Herramienta del administrador ──
async function renderCalEnlace() {
  var host = document.getElementById('cal-enlace');
  var card = document.getElementById('cal-enlace-card');
  if (!host || !card) return;
  var admin = typeof isFullAdmin === 'function' && isFullAdmin();
  card.hidden = !admin;
  if (!admin) return;
  if (_enl.campana !== _ccampana) _enl.ultimo = null;
  _enl.campana = _ccampana;
  host.innerHTML = '<p class="cpl-ayuda">Cargando…</p>';
  try { _enl.datos = await apiRequest('GET', '/calidad/enlace?campana=' + encodeURIComponent(_ccampana)); }
  catch (e) { host.innerHTML = '<p class="cpl-ayuda">' + esc(e.message || 'No se pudo cargar') + '</p>'; return; }
  _enlDibujar();
}

function _enlDibujar(mensaje) {
  var host = document.getElementById('cal-enlace');
  if (!host || !_enl.datos) return;
  var d = _enl.datos, usuarios = d.usuarios || [], pend = d.pendientes || [];
  var html = '<p class="enl-msg" role="status" aria-live="polite">' + (mensaje || '') + '</p>';
  if (_enl.ultimo) {
    html += '<p class="enl-deshacer"><button type="button" class="btn-cancel" onclick="calEnlaceDeshacer(this)">Deshacer el último enlace</button></p>';
  }
  if (!pend.length) {
    html += '<p class="ca-vacio">Todos los monitoreos de ' + esc(_enl.campana) + ' están enlazados a su usuario.</p>';
    host.innerHTML = html; return;
  }
  if (!usuarios.length) html += '<p class="cpl-ayuda">Esta campaña no tiene usuarios ASESOR activos: créalos en Usuarios (rol ASESOR, con esta campaña) para poder enlazar.</p>';
  html += '<ul class="enl-lista">' + pend.map(function (g, i) {
    var meses = Object.keys(g.meses).sort().reverse().map(function (m) { return _enlMesLbl(m) + ': ' + g.meses[m]; }).join(' · ');
    var sug = g.sugerencia;
    var sugHtml = sug
      ? '<p class="enl-sug">' + (sug.tipo === 'igual' ? 'Mismo nombre que «' + esc(sug.nombre) + '» (solo cambian mayúsculas o espacios). Enlázalo para que le llegue seguro a su Portal Asesor.' : 'Sugerencia: «' + esc(sug.nombre) + '» (' + esc(sug.tipo) + ').') +
        ' <button type="button" class="btn-link enl-usar" data-i="' + i + '" onclick="calEnlaceUsarSugerencia(this)">Usar</button></p>'
      : '<p class="enl-sug">Sin usuario parecido.</p>';
    return '<li class="enl-fila">' +
      '<div class="enl-nombre"><b>' + esc(g.asesor) + '</b><span>' + g.total + ' monitoreo' + (g.total === 1 ? '' : 's') + (meses ? ' — ' + esc(meses) : '') + '</span></div>' +
      sugHtml +
      '<div class="enl-accion"><label class="enl-sel"><span class="sr-only">Usuario para «' + esc(g.asesor) + '»</span>' +
        '<select id="enl-u-' + i + '"' + (usuarios.length ? '' : ' disabled') + ' onchange="calEnlaceDesarmar(' + i + ')"><option value="">Elige el usuario…</option>' +
        usuarios.map(function (u) { return '<option value="' + esc(u.id) + '">' + esc(u.nombre) + '</option>'; }).join('') + '</select></label>' +
        '<button type="button" class="btn-primary enl-btn" id="enl-b-' + i + '" data-i="' + i + '" onclick="calEnlaceEnlazar(this)"' + (usuarios.length ? '' : ' disabled') + '>Enlazar</button></div>' +
      '</li>';
  }).join('') + '</ul>';
  host.innerHTML = html;
}

function calEnlaceUsarSugerencia(btn) {
  var i = Number(btn.dataset.i), g = _enl.datos.pendientes[i];
  var sel = document.getElementById('enl-u-' + i);
  if (g && g.sugerencia && sel) { sel.value = String(g.sugerencia.userId); calEnlaceDesarmar(i); sel.focus(); }
}
function calEnlaceDesarmar(i) {
  var b = document.getElementById('enl-b-' + i);
  if (b) { b.dataset.armado = ''; b.textContent = 'Enlazar'; }
}

async function calEnlaceEnlazar(btn) {
  var i = Number(btn.dataset.i), g = _enl.datos.pendientes[i];
  var sel = document.getElementById('enl-u-' + i);
  var uid = sel ? Number(sel.value) : 0;
  if (!g) return;
  if (!uid) { showToast('Elige el usuario', 'error'); if (sel) sel.focus(); return; }
  var u = (_enl.datos.usuarios || []).find(function (x) { return x.id === uid; });
  if (btn.dataset.armado !== '1') {
    btn.dataset.armado = '1';
    btn.textContent = '¿Enlazar ' + g.total + ' a ' + (u ? u.nombre : 'ese usuario') + '?';
    setTimeout(function () { if (btn.isConnected && btn.dataset.armado === '1') calEnlaceDesarmar(i); }, 6000);
    return;
  }
  btn.disabled = true;
  var r;
  try { r = await apiRequest('POST', '/calidad/enlace', { campana: _enl.campana, asesor: g.asesor, userId: uid }); }
  catch (e) { btn.disabled = false; calEnlaceDesarmar(i); showToast(e.message || 'No se pudo enlazar', 'error'); return; }
  _enl.ultimo = { campana: _enl.campana, asesor: r.antes, ids: r.ids, n: r.enlazados, usuario: r.usuario.nombre };
  try { _enl.datos = await apiRequest('GET', '/calidad/enlace?campana=' + encodeURIComponent(_enl.campana)); } catch (e) {}
  _enlDibujar(esc(r.enlazados + ' monitoreo' + (r.enlazados === 1 ? '' : 's') + ' enlazado' + (r.enlazados === 1 ? '' : 's') + ' a «' + r.usuario.nombre + '». Ya le llega' + (r.enlazados === 1 ? '' : 'n') + ' a su Portal Asesor.'));
  _enlRecargarCalidad();
}

async function calEnlaceDeshacer(btn) {
  var u = _enl.ultimo; if (!u) return;
  if (btn.dataset.armado !== '1') { btn.dataset.armado = '1'; btn.textContent = '¿Deshacer? Vuelven a «' + u.asesor + '»'; return; }
  btn.disabled = true;
  try { await apiRequest('POST', '/calidad/enlace/revertir', { campana: u.campana, asesor: u.asesor, ids: u.ids }); }
  catch (e) { btn.disabled = false; showToast(e.message || 'No se pudo deshacer', 'error'); return; }
  _enl.ultimo = null;
  try { _enl.datos = await apiRequest('GET', '/calidad/enlace?campana=' + encodeURIComponent(u.campana)); } catch (e) {}
  _enlDibujar(esc('Enlace deshecho: ' + u.n + ' monitoreo' + (u.n === 1 ? '' : 's') + ' vuelve' + (u.n === 1 ? '' : 'n') + ' a «' + u.asesor + '», sin usuario.'));
  _enlRecargarCalidad();
}

// El nombre del asesor cambio en esos monitoreos: las listas y resumenes del modulo se recargan.
async function _enlRecargarCalidad() {
  try { if (typeof loadCalData === 'function') await loadCalData(_enl.campana, (typeof _cmesFiltro !== 'undefined' && _cmesFiltro) || undefined); } catch (e) {}
}
