// orlant-tablero.js — Fase N1 (docs/orlant/nuevo-dashboard/plan.md): tablero nuevo de ORLANT,
// aparte del dashboard actual. Menú vertical (Tráfico inbound, Tráfico outbound, Back office,
// Asesores), línea General / 3P / Total, fechas y granularidad, vista gerencial con «Ver más
// indicadores», Excel, PDF y pantalla completa. Datos: /api/orlant/tablero (solo ADMIN; lo que
// ya se carga a mano). Mientras se valida, solo lo ve el administrador.
'use strict';

var OT_SECCIONES = [
  { key: 'inbound', label: 'Tráfico inbound', icon: 'i-phone' },
  { key: 'outbound', label: 'Tráfico outbound', icon: 'i-upload' },
  { key: 'backoffice', label: 'Back office', icon: 'i-file-text' },
  { key: 'asesores', label: 'Asesores', icon: 'i-users' },
  // Fase N6: configuración, no indicadores (solo el administrador, como todo el tablero por ahora).
  { key: 'skills', label: 'Mapa de skills', icon: 'i-sliders-horizontal' },
];
var OT_LINEAS = [{ key: 'total', label: 'Total' }, { key: 'general', label: 'Línea General' }, { key: '3p', label: '3P' }];
var OT_CANALES = [{ key: 'llamadas', label: 'Llamadas' }, { key: 'whatsapp', label: 'WhatsApp' }, { key: 'citas', label: 'Citas' }];
var _ot = { skills: null, skillsCambios: {}, seccion: 'inbound', linea: 'total', canal: 'llamadas', desde: '', hasta: '', gran: 'mes', atajo: 'todo', verMas: false, datos: null, abierto: false };

function _otEsc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function otNum(n) { return n === null || n === undefined ? '—' : Math.round(n).toLocaleString('es-CO'); }
function otPct(v) { return v === null || v === undefined ? '—' : (Math.round(v * 1000) / 10).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %'; }
function otSeg(v) { return v === null || v === undefined ? '—' : Math.round(v) + ' s'; }

// Fechas de cada atajo (hoy = fecha local del navegador).
function otRangoAtajo(atajo, hoy) {
  var d = hoy ? new Date(hoy + 'T12:00:00') : new Date();
  var iso = function (x) { return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  var y = d.getFullYear(), m = d.getMonth();
  if (atajo === 'hoy') return { desde: iso(d), hasta: iso(d) };
  if (atajo === 'ayer') { var a = new Date(d); a.setDate(d.getDate() - 1); return { desde: iso(a), hasta: iso(a) }; }
  if (atajo === 'semana') { var l = new Date(d); l.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return { desde: iso(l), hasta: iso(d) }; }
  if (atajo === 'mes') return { desde: iso(new Date(y, m, 1)), hasta: iso(d) };
  if (atajo === 'mes_anterior') return { desde: iso(new Date(y, m - 1, 1)), hasta: iso(new Date(y, m, 0)) };
  if (atajo === 'tres_meses') return { desde: iso(new Date(y, m - 2, 1)), hasta: iso(d) };
  return { desde: '', hasta: '' };
}

// Salida y citas sí traen línea; la entrada (llamadas y WhatsApp) todavía no (fase N2).
function otOutboundLinea(t, linea) {
  if (!t) return { llamadas: 0, whatsapp: 0 };
  if (linea === 'general') return { llamadas: t.llamadasGeneral, whatsapp: t.wppGeneral };
  if (linea === '3p') return { llamadas: t.llamadas3p, whatsapp: t.wpp3p };
  return { llamadas: t.llamadasGeneral + t.llamadas3p + t.llamadasSinAsignar, whatsapp: t.wppGeneral + t.wpp3p + t.wppSinAsignar };
}
function otCitasLinea(o, linea) { return !o ? 0 : linea === 'general' ? o.general : linea === '3p' ? o.p3 : o.total; }
// WhatsApp todavía no se separa por línea (las colas no están en el «Mapa de skills»). Las llamadas sí
// (Fase N2), con el mapa que guarda el administrador.
function otEntradaTieneLinea(linea) { return linea === 'total'; }
var OT_LINEA_CLAVE = { general: 'GENERAL', '3p': '3P' };
var OT_LINEA_NOMBRE = { GENERAL: 'Línea General', '3P': '3P', SIN_DEFINIR: 'Sin definir', NO_CUENTA: 'No cuenta' };
// Variación contra el período anterior con datos: % para cantidades, puntos para porcentajes.
function otVariacion(actual, anterior, tipo) {
  if (actual === null || actual === undefined || anterior === null || anterior === undefined) return '—';
  if (tipo === 'pts') {
    var pts = Math.round((actual - anterior) * 1000) / 10;
    return (pts > 0 ? '+' : pts < 0 ? '−' : '') + Math.abs(pts).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '\u00a0pts';
  }
  if (!anterior) return '—';
  var v = Math.round(((actual - anterior) / anterior) * 1000) / 10;
  return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '\u00a0%';
}
function otMinSeg(v) {
  if (v === null || v === undefined) return '—';
  var t = Math.round(v), m = Math.floor(t / 60), sg = t % 60;
  return m + ':' + String(sg).padStart(2, '0') + '\u00a0min';
}
// Datos de llamadas de la línea elegida: { total, serie }.
function otLlamadasDeLinea(ll, linea) {
  if (linea === 'total' || !ll.porLinea) return { total: ll.total, serie: ll.serie };
  return ll.porLinea[OT_LINEA_CLAVE[linea]] || { total: null, serie: [] };
}
// Avisos de línea de la entrada (Fase N2).
function otAvisosLineaLlamadas(ll, linea) {
  var out = '';
  if (linea !== 'total' && ll.mapaVacio) out += _otAviso('Todavía no hay skills con línea guardada: elige la línea de cada skill en «Mapa de skills». Mientras tanto, solo «Total» tiene cifras.');
  var sd = ll.porLinea && ll.porLinea.SIN_DEFINIR && ll.porLinea.SIN_DEFINIR.total;
  if (linea !== 'total' && !ll.mapaVacio && sd && sd.recibidas > 0) out += _otAviso(otNum(sd.recibidas) + ' llamadas son de skills «Sin definir» y no entran en Línea General ni en 3P (ver «Mapa de skills»).');
  if (ll.noCuenta && ll.noCuenta.recibidas > 0) out += _otAviso(otNum(ll.noCuenta.recibidas) + ' llamadas de ' + ll.noCuenta.skills + (ll.noCuenta.skills === 1 ? ' skill marcado' : ' skills marcados') + ' «No cuenta» quedan fuera de todas las cifras.');
  return out;
}
function otContenidoLlamadas(d, s) {
  var g = s.gran, ll = d.llamadas;
  var sel = otLlamadasDeLinea(ll, s.linea), L = sel.total;
  var avisos = otAvisosLineaLlamadas(ll, s.linea);
  if (!L || (s.linea !== 'total' && ll.mapaVacio)) return { kpis: avisos, detalle: '' };
  var serie = sel.serie || [];
  var filasSerie = serie.map(function (x, i) {
    var ant = i > 0 ? serie[i - 1] : null;
    return [otPeriodoLbl(x.periodo, g), otNum(x.recibidas), ant ? otVariacion(x.recibidas, ant.recibidas) : '—', otNum(x.contestadas), otPct(x.nivelAtencion),
      otPct(x.nivelServicio20s), ant ? otVariacion(x.nivelServicio20s, ant.nivelServicio20s, 'pts') : '—', otPct(x.abandono), otMinSeg(x.tmoSegundos), otSeg(x.asaSegundos)];
  });
  var skills = ll.porSkill.filter(function (x) { return s.linea === 'total' ? x.linea !== 'NO_CUENTA' : x.linea === OT_LINEA_CLAVE[s.linea]; });
  var tip = d.tipificacionEntrada ? (s.linea === 'total' ? d.tipificacionEntrada.total : d.tipificacionEntrada.porLinea[OT_LINEA_CLAVE[s.linea]]) : null;
  return {
    kpis: avisos + _otKpi(otNum(L.recibidas), 'Llamadas recibidas') + _otKpi(otPct(L.nivelServicio20s), 'Nivel de servicio a 20\u00a0s') +
      _otKpi(otPct(L.nivelAtencion), 'Nivel de atención', 'contestadas ÷ recibidas') + _otKpi(otPct(L.abandono), 'Abandono', otNum(L.abandonadas) + ' abandonadas') +
      _otKpi(otMinSeg(L.tmoSegundos), 'TMO', 'tiempo medio de operación'),
    detalle: '<div class="ot-kpis">' + _otKpi(otNum(L.contestadas), 'Contestadas') + _otKpi(otSeg(L.asaSegundos), 'ASA', 'espera promedio de las contestadas') + '</div>' +
      '<h3 class="ot-h3">Por período</h3>' + _otTabla(['Período', 'Recibidas', 'vs. anterior', 'Contestadas', 'Nivel de atención', 'NS 20\u00a0s', 'NS vs. anterior', 'Abandono', 'TMO', 'ASA'], filasSerie) +
      '<h3 class="ot-h3">Participación por skill</h3>' + _otTabla(['Skill', 'Línea', 'Recibidas', 'Contestadas', 'Participación'],
        skills.map(function (x) { return [x.skill, _otEsc(OT_LINEA_NOMBRE[x.linea || 'SIN_DEFINIR']), otNum(x.recibidas), otNum(x.contestadas), otPct(x.participacion)]; })) +
      '<h3 class="ot-h3">Tipificación de la entrada</h3>' + (tip && tip.total ? _otTabla(['Tipificación', 'Llamadas', 'Participación'],
        tip.filas.map(function (x) { return [x.tipificacion, otNum(x.n), otPct(x.participacion)]; })) : _otAviso('Sin tipificación de entrada cargada en este rango (CDR de llamadas).')),
  };
}

function otPeriodoLbl(p, gran) {
  if (gran === 'mes') { var M = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']; return M[Number(p.slice(5, 7)) - 1] + ' ' + p.slice(0, 4); }
  var f = p.slice(8, 10) + '/' + p.slice(5, 7) + '/' + p.slice(0, 4);
  return gran === 'semana' ? 'Semana del ' + f : f;
}

function _otKpi(valor, label, nota) {
  return '<div class="ot-kpi"><div class="ot-kpi-valor">' + valor + '</div><div class="ot-kpi-label">' + _otEsc(label) + '</div>' + (nota ? '<div class="ot-kpi-nota">' + _otEsc(nota) + '</div>' : '') + '</div>';
}
function _otTabla(cab, filas) {
  return '<div class="ot-tabla-wrap"><table class="ot-tabla"><thead><tr>' + cab.map(function (c) { return '<th scope="col">' + _otEsc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    (filas.length ? filas.map(function (f) { return '<tr>' + f.map(function (c, i) { return i ? '<td>' + c + '</td>' : '<th scope="row">' + _otEsc(c) + '</th>'; }).join('') + '</tr>'; }).join('') : '<tr><td colspan="' + cab.length + '">Sin datos en este rango.</td></tr>') +
    '</tbody></table></div>';
}
function _otAviso(t) { return '<p class="ot-aviso">' + _otEsc(t) + '</p>'; }
// Revisión del 23/11 (hallazgo 1): WhatsApp se carga por período (un día o un mes por fila).
function otAvisoPeriodosWpp(w, gran) {
  var out = '';
  if (w && w.parciales > 0) out += _otAviso(w.parciales + (w.parciales === 1 ? ' período de WhatsApp cruza' : ' períodos de WhatsApp cruzan') + ' el borde de las fechas elegidas y no se cuenta' + (w.parciales === 1 ? '' : 'n') + '. Elige fechas que lo cubran completo.');
  if (w && w.fueraDeGrano > 0) out += _otAviso(w.fueraDeGrano + (w.fueraDeGrano === 1 ? ' período de WhatsApp dura' : ' períodos de WhatsApp duran') + ' más de un' + (gran === 'semana' ? 'a semana' : gran === 'mes' ? ' mes' : ' día') + ': ' + (w.fueraDeGrano === 1 ? 'está' : 'están') + ' en el total, pero no en la tabla por período. Míralo con «Ver por: Mes».');
  return out;
}

// { kpis: html, detalle: html } de la vista actual.
function otContenido(d, s) {
  var g = s.gran, sinLinea = !otEntradaTieneLinea(s.linea);
  var avisoLinea = 'WhatsApp todavía no se separa por línea: falta saber qué colas son 3P (fase N3). Elige «Total» para ver las cifras.';
  if (s.seccion === 'inbound' && s.canal === 'llamadas') return otContenidoLlamadas(d, s);
  if (s.seccion === 'inbound' && s.canal === 'whatsapp') {
    var W = d.whatsapp.total;
    if (sinLinea) return { kpis: _otAviso(avisoLinea), detalle: '' };
    return {
      kpis: _otKpi(otNum(W.recibidos), 'WhatsApp recibidos') + _otKpi(otNum(W.contestados), 'Atendidos') + _otKpi(otPct(W.pct0a3), 'Atendidos en 0–3 min', W.conTiempo ? 'de ' + otNum(W.conTiempo) + ' con tiempo' : 'sin tiempos cargados') +
        _otKpi(otPct(W.abandono), 'Abandono', W.abandonados === null ? 'el archivo no trae abandonados' : '') + _otKpi(otSeg(W.asaSegundos), 'ASA', 'espera promedio'),
      detalle: '<h3 class="ot-h3">Tiempo hasta contestar</h3>' + _otTabla(['Rango', 'Conversaciones', '%'], [
        ['0–3 min', otNum(W.rango0a3), otPct(W.conTiempo ? W.rango0a3 / W.conTiempo : null)],
        ['3–5 min', otNum(W.rango3a5), otPct(W.conTiempo ? W.rango3a5 / W.conTiempo : null)],
        ['Más de 5 min', otNum(W.rangoMas5), otPct(W.conTiempo ? W.rangoMas5 / W.conTiempo : null)]]) +
        '<h3 class="ot-h3">Por período</h3>' + _otTabla(['Período', 'Recibidos', 'Atendidos', 'Abandono', '0–3 min'],
        d.whatsapp.serie.map(function (x) { return [otPeriodoLbl(x.periodo, g), otNum(x.recibidos), otNum(x.contestados), otPct(x.abandono), otPct(x.pct0a3)]; })) +
        otAvisoPeriodosWpp(d.whatsapp, g) +
        _otAviso('El TMO de WhatsApp llega con la API (fase N3).'),
    };
  }
  if (s.seccion === 'inbound' && s.canal === 'citas') {
    return {
      kpis: _otKpi(otNum(otCitasLinea(d.citas.total, s.linea)), 'Citas asignadas', 'Agendamiento, por fecha de solicitud') +
        (s.linea === 'total' ? _otKpi(otNum(d.citas.total.general), 'Línea General') + _otKpi(otNum(d.citas.total.p3), '3P') : ''),
      detalle: '<h3 class="ot-h3">Por período</h3>' + _otTabla(['Período', 'Citas', 'Línea General', '3P'],
        d.citas.serie.map(function (x) { return [otPeriodoLbl(x.periodo, g), otNum(otCitasLinea(x, s.linea)), otNum(x.general), otNum(x.p3)]; })) +
        _otAviso('Las citas por canal (llamada, WhatsApp, salida) esperan la definición de Edwin (fase N4).'),
    };
  }
  if (s.seccion === 'outbound') {
    var O = otOutboundLinea(d.outbound.total, s.linea);
    return {
      kpis: _otKpi(otNum(O.llamadas + O.whatsapp), 'Salida realizada', 'llamadas + WhatsApp') + _otKpi(otNum(O.llamadas), 'Llamadas de salida') + _otKpi(otNum(O.whatsapp), 'WhatsApp de salida'),
      detalle: '<h3 class="ot-h3">Por mes</h3>' + _otTabla(['Mes', 'Llamadas', 'WhatsApp', 'Total'],
        d.outbound.meses.map(function (m) { var x = otOutboundLinea(m, s.linea); return [otPeriodoLbl(m.mes, 'mes'), otNum(x.llamadas), otNum(x.whatsapp), otNum(x.llamadas + x.whatsapp)]; })) +
        _otAviso('La salida se carga por mes: la granularidad por día o semana llega con la API. Contactabilidad, intentos por registro y citas de salida: fase N7.'),
    };
  }
  if (s.seccion === 'backoffice') return { kpis: _otAviso('Back office: falta definir con Edwin qué se mide y de qué archivo sale (fase N10).'), detalle: '' };
  return { kpis: _otAviso('Asesores (ocupación, horas logueadas, Talk / ACW, por intervalo): llegan con la API de Wolkvox de ORLANT (fase N8).'), detalle: '' };
}

// Botones de alternar (aria-pressed), en un grupo. Revisión del 23/11 (hallazgo 4): antes la línea
// decía ser pestañas (role="tab") sin panel ni flechas.
function _otBotones(lista, actual, attr) {
  return lista.map(function (x) {
    var on = x.key === actual;
    return '<button type="button" class="ot-seg' + (on ? ' on' : '') + '" ' + attr + '="' + x.key + '" aria-pressed="' + on + '">' + _otEsc(x.label) + '</button>';
  }).join('');
}

function otRender() {
  var host = document.getElementById('ot-host');
  if (!host) return;
  var s = _ot, d = s.datos;
  var nav = '<nav class="ot-nav" aria-label="Secciones del tablero"><ul>' + OT_SECCIONES.map(function (x) {
    return '<li><button type="button" class="ot-nav-btn' + (x.key === s.seccion ? ' on' : '') + '" data-ot-seccion="' + x.key + '"' + (x.key === s.seccion ? ' aria-current="page"' : '') + '>' +
      '<svg class="icono" aria-hidden="true" focusable="false"><use href="img/iconos/lucide.svg#' + x.icon + '"></use></svg><span>' + _otEsc(x.label) + '</span></button></li>';
  }).join('') + '</ul></nav>';
  var atajos = [['todo', 'Todo'], ['hoy', 'Hoy'], ['ayer', 'Ayer'], ['semana', 'Esta semana'], ['mes', 'Este mes'], ['mes_anterior', 'Mes anterior'], ['tres_meses', 'Últimos 3 meses'], ['otro', 'Otras fechas']];
  var filtros = '<div class="ot-filtros" role="group" aria-label="Filtros">' +
    '<label class="ot-campo"><span>Período</span><select id="ot-atajo">' + atajos.map(function (a) { return '<option value="' + a[0] + '"' + (a[0] === s.atajo ? ' selected' : '') + '>' + a[1] + '</option>'; }).join('') + '</select></label>' +
    '<label class="ot-campo"><span>Desde</span><input type="date" id="ot-desde" value="' + _otEsc(s.desde) + '"></label>' +
    '<label class="ot-campo"><span>Hasta</span><input type="date" id="ot-hasta" value="' + _otEsc(s.hasta) + '"></label>' +
    '<label class="ot-campo"><span>Ver por</span><select id="ot-gran">' + [['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes']].map(function (a) { return '<option value="' + a[0] + '"' + (a[0] === s.gran ? ' selected' : '') + '>' + a[1] + '</option>'; }).join('') + '</select></label>' +
    '</div>';
  var lineas = '<div class="ot-lineas" role="group" aria-label="Línea">' + _otBotones(OT_LINEAS, s.linea, 'data-ot-linea') + '</div>';
  var canales = s.seccion === 'inbound' ? '<div class="ot-canales" role="group" aria-label="Canal">' + _otBotones(OT_CANALES, s.canal, 'data-ot-canal') + '</div>' : '';
  var cuerpo;
  if (!d) cuerpo = '<p class="ot-aviso" aria-live="polite">Cargando…</p>';
  else {
    var c = otContenido(d, s);
    cuerpo = '<div class="ot-kpis">' + c.kpis + '</div>' +
      (c.detalle ? '<button type="button" class="ot-vermas" id="ot-vermas" aria-expanded="' + s.verMas + '" aria-controls="ot-detalle">' + (s.verMas ? 'Ver menos indicadores' : 'Ver más indicadores') + '</button>' +
        '<div id="ot-detalle" class="ot-detalle"' + (s.verMas ? '' : ' hidden') + '>' + c.detalle + '</div>' : '');
  }
  var titulo = (OT_SECCIONES.filter(function (x) { return x.key === s.seccion; })[0] || {}).label;
  if (s.seccion === 'skills') {
    host.innerHTML = '<div class="ot-layout">' + nav + '<section class="ot-main" aria-labelledby="ot-h2"><h2 class="ot-h2" id="ot-h2">' + _otEsc(titulo) + '</h2><div class="ot-cuerpo" aria-live="polite">' + otSkillsHtml(s.skills, s.skillsCambios) + '</div></section></div>';
    return;
  }
  host.innerHTML = '<div class="ot-layout">' + nav + '<section class="ot-main" aria-labelledby="ot-h2"><h2 class="ot-h2" id="ot-h2">' + _otEsc(titulo) + '</h2>' + filtros + lineas + canales + '<div class="ot-cuerpo" aria-live="polite">' + cuerpo + '</div></section></div>';
}

// Revisión del 23/11 (hallazgo 3): cada carga lleva un número; una respuesta que llega después de
// otra más nueva (filtros cambiados rápido) se descarta y nunca pisa la vista del rango elegido.
var _otPedido = 0;
async function otCargar() {
  var mio = ++_otPedido;
  _ot.datos = null; otRender();
  var q = '?gran=' + encodeURIComponent(_ot.gran) + (_ot.desde ? '&desde=' + encodeURIComponent(_ot.desde) : '') + (_ot.hasta ? '&hasta=' + encodeURIComponent(_ot.hasta) : '');
  var datos = null, error = null;
  try { datos = await apiRequest('GET', '/orlant/tablero' + q); } catch (e) { error = e; }
  if (mio !== _otPedido) return;
  _ot.datos = datos;
  if (error && typeof showToast === 'function') showToast('No se pudo cargar el tablero: ' + error.message);
  otRender();
}

function _otEventos(host) {
  host.addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.otSeccion) { _ot.seccion = b.dataset.otSeccion; otRender(); if (_ot.seccion === 'skills' && !_ot.skills) otSkillsCargar(); }
    else if (b.id === 'ot-skills-guardar') { otSkillsGuardar(); }
    else if (b.id === 'ot-skills-agregar') { var inp = document.getElementById('ot-skills-nuevo'); otSkillsAgregar(inp ? inp.value : ''); }
    else if (b.dataset.otLinea) { _ot.linea = b.dataset.otLinea; otRender(); }
    else if (b.dataset.otCanal) { _ot.canal = b.dataset.otCanal; otRender(); }
    else if (b.id === 'ot-vermas') { _ot.verMas = !_ot.verMas; try { localStorage.setItem('ot-vermas', _ot.verMas ? '1' : '0'); } catch (e) {} otRender(); }
  });
  host.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.dataset && t.dataset.otSkill !== undefined) { otSkillsCambiar(t.dataset.otSkill, t.value); return; }
    if (t.id === 'ot-atajo') { _ot.atajo = t.value; if (t.value !== 'otro') { var r = otRangoAtajo(t.value); _ot.desde = r.desde; _ot.hasta = r.hasta; } otCargar(); }
    else if (t.id === 'ot-desde' || t.id === 'ot-hasta') { _ot[t.id === 'ot-desde' ? 'desde' : 'hasta'] = t.value; _ot.atajo = 'otro'; otCargar(); }
    else if (t.id === 'ot-gran') { _ot.gran = t.value; otCargar(); }
  });
}

async function openOrlantTablero() {
  var overlay = document.getElementById('ot-overlay');
  if (!overlay) return;
  overlay.classList.add('show');
  if (typeof motionAbrirDialogo === 'function') motionAbrirDialogo(overlay);
  document.body.style.overflow = 'hidden';
  _ot.abierto = true;
  try { _ot.verMas = localStorage.getItem('ot-vermas') === '1'; } catch (e) {}
  var host = document.getElementById('ot-host');
  if (!host.dataset.eventos) { _otEventos(host); host.dataset.eventos = '1'; }
  await otCargar();
}
function closeOrlantTablero() {
  _ot.abierto = false;
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
  var overlay = document.getElementById('ot-overlay');
  overlay.classList.remove('show');
  if (typeof motionCerrarDialogo === 'function') motionCerrarDialogo(overlay);
  document.body.style.overflow = '';
}
function otPantallaCompleta() {
  var el = document.getElementById('ot-overlay');
  if (document.fullscreenElement) { document.exitFullscreen().catch(function () {}); return; }
  if (el && el.requestFullscreen) el.requestFullscreen().catch(function () {});
}
// PDF: la vista actual, con «Ver más» abierto, por el diálogo de impresión del navegador.
function otPdf() {
  var antes = _ot.verMas; _ot.verMas = true; otRender();
  document.body.classList.add('ot-imprimiendo');
  var fin = function () { document.body.classList.remove('ot-imprimiendo'); _ot.verMas = antes; otRender(); window.removeEventListener('afterprint', fin); };
  window.addEventListener('afterprint', fin);
  window.print();
}
// Hojas del Excel (también las usa la prueba).
function otHojasExcel(d) {
  var g = d.gran;
  return [
    { nombre: 'Llamadas', filas: d.llamadas.serie.map(function (x) { return { Periodo: otPeriodoLbl(x.periodo, g), Recibidas: x.recibidas, Contestadas: x.contestadas, Abandonadas: x.abandonadas, 'Nivel de atención': otPct(x.nivelAtencion), 'NS 20 s': otPct(x.nivelServicio20s), Abandono: otPct(x.abandono), 'TMO (s)': x.tmoSegundos === null || x.tmoSegundos === undefined ? '' : Math.round(x.tmoSegundos), 'ASA (s)': x.asaSegundos === null || x.asaSegundos === undefined ? '' : Math.round(x.asaSegundos) }; }) },
    { nombre: 'Llamadas por skill', filas: d.llamadas.porSkill.map(function (x) { return { Skill: x.skill, 'Línea': OT_LINEA_NOMBRE[x.linea || 'SIN_DEFINIR'], Recibidas: x.recibidas, Contestadas: x.contestadas, 'Participación': otPct(x.participacion) }; }) },
    { nombre: 'Tipificación entrada', filas: d.tipificacionEntrada ? d.tipificacionEntrada.total.filas.map(function (x) { return { 'Tipificación': x.tipificacion, Llamadas: x.n, 'Participación': otPct(x.participacion) }; }) : [] },
    { nombre: 'WhatsApp', filas: d.whatsapp.serie.map(function (x) { return { Periodo: otPeriodoLbl(x.periodo, g), Recibidos: x.recibidos, Atendidos: x.contestados, Abandono: otPct(x.abandono), '0-3 min': x.rango0a3, '3-5 min': x.rango3a5, 'Más de 5 min': x.rangoMas5, ASA: otSeg(x.asaSegundos) }; }) },
    { nombre: 'Citas', filas: d.citas.serie.map(function (x) { return { Periodo: otPeriodoLbl(x.periodo, g), Citas: x.total, 'Línea General': x.general, '3P': x.p3 }; }) },
    { nombre: 'Salida', filas: d.outbound.meses.map(function (m) { return { Mes: otPeriodoLbl(m.mes, 'mes'), 'Llamadas General': m.llamadasGeneral, 'Llamadas 3P': m.llamadas3p, 'Llamadas sin clasificar': m.llamadasSinAsignar, 'WhatsApp General': m.wppGeneral, 'WhatsApp 3P': m.wpp3p, 'WhatsApp sin clasificar': m.wppSinAsignar }; }) },
  ];
}
function otExcel() {
  if (!_ot.datos || typeof XLSX === 'undefined') return;
  var wb = XLSX.utils.book_new();
  otHojasExcel(_ot.datos).forEach(function (h) { XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(h.filas.length ? h.filas : [{ Aviso: 'Sin datos en este rango' }]), h.nombre); });
  XLSX.writeFile(wb, 'ORLANT_tablero_nuevo.xlsx');
}
function orlantTableroVeTarjeta(esFullAdmin) { return esFullAdmin === true; }

// ── Fase N6 (23/11/2026): mapa de skills a línea, editable mientras Edwin confirma ──
// Solo cuenta lo que se guarda; la «propuesta» (regla del nombre: termina en 3P o GENERAL) es una
// ayuda y nunca se aplica sola. Un skill sin guardar queda «Sin definir».
var OT_LINEA_OPC = [['', 'Sin definir'], ['GENERAL', 'Línea General'], ['3P', '3P'], ['NO_CUENTA', 'No cuenta (salida, pruebas u otra)']];
function otLineaLbl(v) { var o = OT_LINEA_OPC.filter(function (x) { return x[0] === (v || ''); })[0]; return o ? o[1] : 'Sin definir'; }
// Línea efectiva de un skill en pantalla: el cambio sin guardar, o lo guardado.
function otSkillLinea(sk, cambios) { return Object.prototype.hasOwnProperty.call(cambios || {}, sk.skill) ? cambios[sk.skill] : sk.linea; }
function otSkillsHtml(m, cambios) {
  if (!m) return '<p class="ot-aviso">Cargando…</p>';
  cambios = cambios || {};
  var pendientes = Object.keys(cambios).length;
  var sinDefinir = m.skills.filter(function (sk) { return !otSkillLinea(sk, cambios); }).length;
  var filas = m.skills.map(function (sk, i) {
    var actual = otSkillLinea(sk, cambios) || '';
    var id = 'ot-sk-' + i;
    var opc = OT_LINEA_OPC.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === actual ? ' selected' : '') + '>' + _otEsc(o[1]) + '</option>'; }).join('');
    var usos = (sk.diasManual ? sk.diasManual + ' días (carga manual)' : '') + (sk.diasManual && sk.diasApi ? ' · ' : '') + (sk.diasApi ? sk.diasApi + ' días (réplica API)' : '');
    return '<tr' + (Object.prototype.hasOwnProperty.call(cambios, sk.skill) ? ' class="ot-sk-cambiado"' : '') + '><th scope="row"><label for="' + id + '">' + _otEsc(sk.skill) + '</label></th>' +
      '<td data-et="Propuesta">' + _otEsc(sk.propuesta ? otLineaLbl(sk.propuesta) : 'no sé') + '</td>' +
      '<td class="ot-sk-linea"><select id="' + id + '" data-ot-skill="' + _otEsc(sk.skill) + '">' + opc + '</select></td>' +
      '<td data-et="Dónde aparece">' + _otEsc(usos || 'agregado a mano') + '</td></tr>';
  }).join('');
  return '<p class="ot-aviso">Elige la línea de cada skill. Solo cuenta lo que guardes; la propuesta sale del nombre (termina en «3P» o «GENERAL») y es solo una ayuda. ' +
      sinDefinir + ' de ' + m.skills.length + ' sin definir.</p>' +
    '<div class="ot-tabla-wrap"><table class="ot-tabla ot-tabla-skills"><thead><tr><th scope="col">Skill</th><th scope="col">Propuesta</th><th scope="col">Línea</th><th scope="col">Dónde aparece</th></tr></thead><tbody>' +
      (filas || '<tr><td colspan="4">Todavía no hay skills. Agrega uno abajo.</td></tr>') + '</tbody></table></div>' +
    '<div class="ot-skills-agregar"><label class="ot-campo"><span>Agregar un skill por nombre (tal como sale en Wolkvox)</span><input type="text" id="ot-skills-nuevo" maxlength="120" autocomplete="off"></label>' +
      '<button type="button" class="ot-seg" id="ot-skills-agregar">Agregar</button></div>' +
    '<p class="ot-kpi-nota">Un skill agregado se guarda cuando le eliges una línea.</p>' +
    '<div class="ot-skills-acciones"><button type="button" class="ot-vermas" id="ot-skills-guardar"' + (pendientes ? '' : ' disabled') + '>Guardar ' + (pendientes ? pendientes + (pendientes === 1 ? ' cambio' : ' cambios') : '(sin cambios)') + '</button></div>';
}
// Cambiar la línea de un skill en pantalla (sin guardar). Volver al valor guardado quita el cambio.
function otSkillsCambiar(skill, valor) {
  var sk = (_ot.skills && _ot.skills.skills || []).filter(function (x) { return x.skill === skill; })[0];
  var v = valor || null;
  if (sk && (sk.linea || null) === v) delete _ot.skillsCambios[skill]; else _ot.skillsCambios[skill] = v;
  otRender();
}
// Agrega un skill escrito a mano (para los que todavía no llegan en ninguna carga). Sin guardar.
function otSkillsAgregar(nombre) {
  var t = String(nombre || '').trim().replace(/\s+/g, ' ');
  if (!t || t.length > 120 || !_ot.skills) return false;
  if (_ot.skills.skills.some(function (x) { return x.skill.toUpperCase() === t.toUpperCase(); })) { if (typeof showToast === 'function') showToast('Ese skill ya está en la lista'); return false; }
  _ot.skills.skills.push({ skill: t, linea: null, propuesta: /\s3P$/i.test(t) ? '3P' : /\sGENERAL$/i.test(t) ? 'GENERAL' : null, diasManual: 0, diasApi: 0 });
  // Sin línea elegida: se guarda cuando el administrador le elige una (nunca se aplica la propuesta sola).
  otRender();
  return true;
}
async function otSkillsCargar() {
  try { _ot.skills = await apiRequest('GET', '/orlant/skills-linea'); _ot.skillsCambios = {}; }
  catch (e) { if (typeof showToast === 'function') showToast('No se pudo cargar el mapa de skills: ' + e.message); }
  otRender();
}
async function otSkillsGuardar() {
  var cambios = Object.keys(_ot.skillsCambios).map(function (k) { return { skill: k, linea: _ot.skillsCambios[k] }; });
  if (!cambios.length) return;
  try {
    var r = await apiRequest('PUT', '/orlant/skills-linea', { cambios: cambios });
    _ot.skills = { campana: r.campana, replicas: r.replicas, lineas: r.lineas, skills: r.skills };
    _ot.skillsCambios = {};
    if (typeof showToast === 'function') showToast('Mapa de skills guardado');
  } catch (e) { if (typeof showToast === 'function') showToast('No se pudo guardar: ' + e.message); }
  otRender();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { otContenidoLlamadas: otContenidoLlamadas, otVariacion: otVariacion, otMinSeg: otMinSeg, otLlamadasDeLinea: otLlamadasDeLinea, otAvisosLineaLlamadas: otAvisosLineaLlamadas, otSkillsHtml: otSkillsHtml, otSkillsCambiar: otSkillsCambiar, otSkillsAgregar: otSkillsAgregar, otSkillLinea: otSkillLinea, otCargar: otCargar, otRender: otRender, _otEstado: function () { return _ot; }, otAvisoPeriodosWpp: otAvisoPeriodosWpp, otContenido: otContenido, otRangoAtajo: otRangoAtajo, otOutboundLinea: otOutboundLinea, otCitasLinea: otCitasLinea, otHojasExcel: otHojasExcel, otPeriodoLbl: otPeriodoLbl, orlantTableroVeTarjeta: orlantTableroVeTarjeta, OT_SECCIONES: OT_SECCIONES };
}
