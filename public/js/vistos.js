// vistos.js — Fase 357 (C, pedido de Edwin 17/11): pestaña «Vistos» de Calidad (ADMIN, Reportes y
// supervisor; el servidor exige además acceso a la campaña) y registro de cuándo la asesora abre
// su Calidad en el Portal Asesor. Reglas del semáforo en vistos-logic.js.
'use strict';

function vistosPuedeVer(rol, esAdmin) { return !!esAdmin || rol === 'REPORTES' || rol === 'SUPERVISOR'; }

function _visEsc(v) {
  return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function vistosFechaTexto(iso) {
  if (!iso) return 'Nunca';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return 'Nunca';
  try { return d.toLocaleString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  catch (e) { return d.toISOString().slice(0, 16).replace('T', ' '); }
}

function vistosDiasTexto(dias) {
  if (dias === null || dias === undefined) return '';
  if (dias === 0) return 'hoy';
  return dias === 1 ? 'hace 1 día' : 'hace ' + dias + ' días';
}

// Tabla (puro, se prueba en Node). Todo texto escapado.
function vistosTablaHtml(asesores) {
  if (!asesores || !asesores.length) return '<p class="vis-vacio">No hay asesoras activas en esta campaña.</p>';
  var cuenta = { rojo: 0, amarillo: 0, verde: 0, gris: 0 };
  asesores.forEach(function (a) { if (cuenta[a.semaforo] !== undefined) cuenta[a.semaforo]++; });
  var resumen = '<p class="vis-resumen">' + ['rojo', 'amarillo', 'verde', 'gris'].map(function (k) {
    return '<span class="vis-pill vis-' + k + '">' + _visEsc(VISTOS_ESTADOS[k]) + ': ' + cuenta[k] + '</span>';
  }).join(' ') + '</p>';
  return resumen + '<div class="table-wrap"><table class="vis-tabla"><thead><tr>' +
    '<th scope="col">Asesora</th><th scope="col">Última vez que abrió su Calidad</th><th scope="col">Sin ver</th><th scope="col">Monitoreos</th><th scope="col">Estado</th>' +
    '</tr></thead><tbody>' + asesores.map(function (a) {
      var dias = vistosDiasTexto(a.dias);
      return '<tr><td>' + _visEsc(a.nombre) + '</td>' +
        '<td>' + _visEsc(vistosFechaTexto(a.ultimaApertura)) + (dias ? ' <span class="vis-dias">(' + _visEsc(dias) + ')</span>' : '') + '</td>' +
        '<td class="vis-num">' + _visEsc(a.sinVer) + '</td><td class="vis-num">' + _visEsc(a.total) + '</td>' +
        '<td><span class="vis-pill vis-' + _visEsc(a.semaforo) + '">' + _visEsc(VISTOS_ESTADOS[a.semaforo] || a.semaforo) + '</span></td></tr>';
    }).join('') + '</tbody></table></div>';
}

async function renderCalVistos() {
  var cont = document.getElementById('cal-vistos');
  if (!cont) return;
  var campana = (typeof _ccampana !== 'undefined') ? _ccampana : '';
  if (!campana) { cont.innerHTML = '<p class="vis-vacio">Elige una campaña.</p>'; return; }
  cont.innerHTML = '<p class="vis-vacio">Cargando…</p>';
  try {
    var r = await apiRequest('GET', '/calidad/vistos?campana=' + encodeURIComponent(campana));
    if (typeof _ccampana !== 'undefined' && _ccampana !== campana) return; // cambió de campaña mientras cargaba
    cont.innerHTML = vistosTablaHtml(r.asesores);
  } catch (e) {
    cont.innerHTML = '<p class="vis-vacio">' + _visEsc(e.message || 'No se pudo cargar «Vistos»') + '</p>';
  }
}

// Muestra u oculta el botón de la pestaña (lo llama openCalidad).
function vistosActualizarTab() {
  var b = document.getElementById('ctab-btn-vistos');
  if (!b) return;
  var rol = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.rol : null;
  b.style.display = vistosPuedeVer(rol, typeof isFullAdmin === 'function' && isFullAdmin()) ? '' : 'none';
}

// Portal Asesor: cada vez que la asesora abre su Calidad. Nunca en «ver como» (el servidor
// igual lo rechazaría) ni para otros roles.
function vistosRegistrarApertura() {
  if (typeof currentUser === 'undefined' || !currentUser || currentUser.rol !== 'ASESOR') return;
  if (typeof verComoActivo === 'function' && verComoActivo()) return;
  apiRequest('POST', '/monitoreos/mios/abierto', {}).catch(function () { /* no frena el portal */ });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { vistosPuedeVer: vistosPuedeVer, vistosTablaHtml: vistosTablaHtml, vistosFechaTexto: vistosFechaTexto, vistosDiasTexto: vistosDiasTexto };
}
