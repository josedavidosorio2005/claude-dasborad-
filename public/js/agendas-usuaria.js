// agendas-usuaria.js — Fase 259, cambiado en la Fase 265 (pedido de Edwin,
// 05/11, Clinica Aurora): panel "agendas_usuaria_panel" de la pestaña
// "Agendas por usuaria", con 3 vistas (sub-pestañas, `p.vista`):
//   mes          -> Agendas por mes (linea de tiempo por mes de la cita)
//   especialidad -> Agendas por especialidad (columna "especial" del reporte)
//   asesor       -> Agendas por asesor (nombre real por los alias; linea por mes)
// Filtros comunes a las 3 vistas: Sede, Asesor, Fecha de solicitud de la cita
// (fecha_registro) y Fecha de cita (fechacita), ademas de MESES de arriba.
// Datos: GET /calidad/agendas-usuaria/datos (conteos agregados; el nombre real
// ya resuelto con los alias de la campaña).
var _auCache = {};   // por campaña: { filas }
var _auFiltro = {};  // por campaña: { asesoras:[], sede, citaDesde, citaHasta, solicitudDesde, solicitudHasta }

async function _auCargar(camp) {
  if (_auCache[camp]) return _auCache[camp];
  var r = await apiRequest('GET', '/calidad/agendas-usuaria/datos?campana=' + encodeURIComponent(camp));
  _auCache[camp] = { filas: (r && r.filas) || [] };
  return _auCache[camp];
}
async function _auCargarOpciones(camp) {
  var r = await apiRequest('GET', '/calidad/agendas-usuaria/opciones?campana=' + encodeURIComponent(camp));
  return { meses: (r && r.meses) || [] };
}

function _auFiltrosActuales(camp) {
  // Fase 302: + registroDesde/registroHasta, entidad, usuario, especialidad, prof (vista «Agendas»).
  return _auFiltro[camp] || (_auFiltro[camp] = { asesoras: [], sede: '', citaDesde: '', citaHasta: '', solicitudDesde: '', solicitudHasta: '',
    registroDesde: '', registroHasta: '', entidad: '', usuario: '', especialidad: '', prof: '' });
}
function _auFiltroParaLogica(camp) {
  var f = _auFiltrosActuales(camp);
  var meses = (typeof gdMesesTarjetasActual === 'function') ? gdMesesTarjetasActual() : [];
  return { meses: meses, asesoras: f.asesoras, sedes: f.sede ? [f.sede] : null,
    citaDesde: f.citaDesde, citaHasta: f.citaHasta, solicitudDesde: f.solicitudDesde, solicitudHasta: f.solicitudHasta };
}
function _auFecha(etiqueta, desde, hasta, campoDesde, campoHasta, i) {
  return '<fieldset class="au-fechas"><legend>' + esc(etiqueta) + '</legend>' +
    '<label>Desde <input type="date" data-au-campo="' + campoDesde + '" data-i="' + i + '" value="' + esc(desde) + '" aria-label="' + esc(etiqueta) + ' desde"></label>' +
    '<label>Hasta <input type="date" data-au-campo="' + campoHasta + '" data-i="' + i + '" value="' + esc(hasta) + '" aria-label="' + esc(etiqueta) + ' hasta"></label></fieldset>';
}
var _AU_TITULOS = { mes: 'Agendas por mes', especialidad: 'Agendas por especialidad', asesor: 'Agendas por asesor', agendas: 'Agendas' };
function _auMesCorto(m) { return typeof mesNombreLargo === 'function' ? mesNombreLargo(m) : m; }

async function _auRender(p, i) {
  var el = document.getElementById('gd-p' + i); if (!el) return;
  var camp = p.campana || _gd.cliente;
  var vista = p.vista || 'mes';
  el.dataset.campana = camp; el.dataset.vista = vista;
  if (vista === 'agendas') { await _auRenderAgendas(p, i, el, camp); return; } // Fase 302
  var datos;
  try { datos = await _auCargar(camp); } catch (e) { el.innerHTML = '<div class="aurora-card"><div class="gd-aviso-mes" role="status">' + esc(e.message) + '</div></div>'; return; }
  var titulo = p.titulo || _AU_TITULOS[vista] || 'Agendas';
  if (!datos.filas.length) {
    el.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">' + esc(titulo) + '</div><div class="gd-aviso-mes" role="status">Todavía no hay agendas cargadas. Se suben en Cargar Datos › Agendas.</div></div>';
    return;
  }
  var f = _auFiltrosActuales(camp);
  var meses = (typeof gdMesesTarjetasActual === 'function') ? gdMesesTarjetasActual() : [];
  var delMes = auFiltrar(datos.filas, { meses: meses });
  var asesorasDisp = auOpciones(delMes, 'asesora');
  f.asesoras = f.asesoras.filter(function (a) { return asesorasDisp.indexOf(a) !== -1; });
  var arr = auFiltrar(datos.filas, _auFiltroParaLogica(camp));
  var total = auTotal(arr);
  var fmt = function (n) { return Number(n || 0).toLocaleString('es-CO'); };
  var pctTxt = function (v) { return String(v).replace('.', ',') + ' %'; };
  var hayFiltro = f.asesoras.length || f.sede || f.citaDesde || f.citaHasta || f.solicitudDesde || f.solicitudHasta;
  var filtros =
    '<div class="aurora-card au-filtros-card"><div class="au-filtros">' +
      '<details class="au-asesoras"><summary>Asesor: ' + (f.asesoras.length ? f.asesoras.length + ' elegido(s)' : 'Todos') + '</summary>' + (typeof marcarTodoBarraHtml === 'function' ? marcarTodoBarraHtml('au-asesoras-lista-' + i) : '') + '<div class="au-asesoras-lista" id="au-asesoras-lista-' + i + '">' + // Fase 271
        asesorasDisp.map(function (a) { return '<label><input type="checkbox" data-au-asesora data-i="' + i + '" value="' + esc(a) + '"' + (f.asesoras.indexOf(a) !== -1 ? ' checked' : '') + '> ' + esc(a) + '</label>'; }).join('') + '</div></details>' +
      '<div class="au-filtro"><label for="au-f-sede-' + i + '">Sede</label><select id="au-f-sede-' + i + '" data-au-campo="sede" data-i="' + i + '"><option value="">Todas</option>' +
        auOpciones(delMes, 'sede').map(function (v) { return '<option value="' + esc(v) + '"' + (v === f.sede ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('') + '</select></div>' +
      _auFecha('Fecha de solicitud de la cita', f.solicitudDesde, f.solicitudHasta, 'solicitudDesde', 'solicitudHasta', i) +
      _auFecha('Fecha de cita', f.citaDesde, f.citaHasta, 'citaDesde', 'citaHasta', i) +
      (hayFiltro ? '<button type="button" class="btn-cancel au-limpiar" data-au-limpiar data-i="' + i + '">Quitar filtros</button>' : '') +
    '</div></div>';
  var tarjeta = '<div class="aurora-kpis">' + kpiTarjetaHtml({ valor: fmt(total), etiqueta: 'Total agendas', soloTitulo: true }) + '</div>';
  var cuerpo = '';
  if (vista === 'mes') {
    var pm = auPorMes(arr);
    cuerpo = '<div class="aurora-card"><div class="aurora-card-title">' + esc(titulo) + '</div><div class="aurora-chart-wrap" style="height:300px"><canvas id="gd-c' + i + '-au-mes"></canvas></div></div>' +
      '<div class="aurora-card"><div class="au-tabla-cab"><div class="aurora-card-title">' + esc(titulo) + ' (tabla)</div><button type="button" class="btn-sm" onclick="_auExportExcel(' + i + ')">Excel</button></div><div style="overflow-x:auto"><table class="aurora-rank-table au-tabla"><tr><th>Mes</th><th>Agendas</th></tr>' +
        pm.map(function (x) { return '<tr><td>' + esc(_auMesCorto(x.mes)) + '</td><td>' + fmt(x.n) + '</td></tr>'; }).join('') + '<tr class="au-total"><th scope="row">Total</th><td>' + fmt(total) + '</td></tr></table></div></div>';
  } else if (vista === 'especialidad') {
    var pe = auPorEspecialidad(arr);
    cuerpo = '<div class="aurora-card"><div class="aurora-card-title">' + esc(titulo) + '</div><div class="aurora-chart-wrap" style="height:' + Math.max(240, 40 * pe.length + 80) + 'px"><canvas id="gd-c' + i + '-au-esp"></canvas></div></div>' +
      '<div class="aurora-card"><div class="au-tabla-cab"><div class="aurora-card-title">' + esc(titulo) + ' (tabla)</div><button type="button" class="btn-sm" onclick="_auExportExcel(' + i + ')">Excel</button></div><div style="overflow-x:auto"><table class="aurora-rank-table au-tabla"><tr><th>Especialidad</th><th>Agendas</th><th>% del total</th></tr>' +
        pe.map(function (x) { return '<tr><td>' + esc(x.especialidad) + '</td><td>' + fmt(x.n) + '</td><td>' + pctTxt(x.pct) + '</td></tr>'; }).join('') + '<tr class="au-total"><th scope="row">Total</th><td>' + fmt(total) + '</td><td>' + (total ? '100 %' : '0 %') + '</td></tr></table></div></div>';
  } else {
    var pa = auPorAsesor(arr);
    cuerpo = '<div class="aurora-card"><div class="aurora-card-title">' + esc(titulo) + '</div><div class="aurora-chart-wrap" style="height:320px"><canvas id="gd-c' + i + '-au-ase"></canvas></div></div>' +
      '<div class="aurora-card"><div class="au-tabla-cab"><div class="aurora-card-title">' + esc(titulo) + ' (tabla)</div><button type="button" class="btn-sm" onclick="_auExportExcel(' + i + ')">Excel</button></div><div style="overflow-x:auto"><table class="aurora-rank-table au-tabla"><tr><th>Asesor</th>' +
        pa.meses.map(function (m) { return '<th>' + esc(_auMesCorto(m)) + '</th>'; }).join('') + '<th>Total</th><th>% del total</th></tr>' +
        pa.filas.map(function (x) { return '<tr><td>' + esc(x.asesora) + '</td>' + x.serie.map(function (n) { return '<td>' + fmt(n) + '</td>'; }).join('') + '<td>' + fmt(x.total) + '</td><td>' + pctTxt(x.pct) + '</td></tr>'; }).join('') +
        '<tr class="au-total"><th scope="row">Total</th>' + pa.meses.map(function (m, k) { return '<td>' + fmt(pa.filas.reduce(function (s, x) { return s + x.serie[k]; }, 0)) + '</td>'; }).join('') + '<td>' + fmt(total) + '</td><td>' + (total ? '100 %' : '0 %') + '</td></tr></table></div></div>';
  }
  el.innerHTML = filtros + tarjeta + cuerpo;

  var pal = (typeof PC !== 'undefined') ? PC : [];
  if (vista === 'mes') {
    var serie = auPorMes(arr);
    var oL = (typeof lo === 'function') ? lo(null) : { responsive: true, maintainAspectRatio: false, plugins: {} };
    if (typeof loDatalabelsAuto === 'function') loDatalabelsAuto(oL, function (v) { return v === null || v === undefined ? '' : Number(v).toLocaleString('es-CO'); });
    // Fase 268: con un solo mes, una linea es un punto suelto -- se muestra
    // como barra; con 2 o mas meses, linea de tiempo. El eje arranca en 0.
    if (serie.length < 2) {
      var oB1 = (typeof loBar === 'function') ? loBar(null) : { responsive: true, maintainAspectRatio: false, plugins: {} };
      _auEjeDesdeCero(oB1);
      _gdChart('gd-c' + i + '-au-mes', { type: 'bar', data: { labels: serie.map(function (x) { return _auMesCorto(x.mes); }), datasets: [{ label: 'Agendas', data: serie.map(function (x) { return x.n; }), backgroundColor: SERIE_PRINCIPAL, maxBarThickness: 120 }] }, options: oB1 });
    } else {
      _auEjeDesdeCero(oL);
      _gdChart('gd-c' + i + '-au-mes', { type: 'line', data: { labels: serie.map(function (x) { return _auMesCorto(x.mes); }), datasets: [{ label: 'Agendas', data: serie.map(function (x) { return x.n; }), borderColor: SERIE_PRINCIPAL, backgroundColor: SERIE_PRINCIPAL, borderWidth: 2.5, pointRadius: 5, tension: 0.3, fill: false }] }, options: oL });
    }
  } else if (vista === 'especialidad') {
    var esp = auPorEspecialidad(arr);
    var oB = (typeof loBar === 'function') ? loBar(null) : { responsive: true, maintainAspectRatio: false, plugins: {} };
    oB.indexAxis = 'y';
    if (oB.plugins && oB.plugins.datalabels) {
      oB.plugins.datalabels.formatter = function (v, ctx) { return v ? Number(v).toLocaleString('es-CO') + ' (' + String(esp[ctx.dataIndex].pct).replace('.', ',') + ' %)' : ''; };
      oB.plugins.datalabels.anchor = 'end'; oB.plugins.datalabels.align = 'end'; oB.plugins.datalabels.clamp = true;
    }
    oB.layout = Object.assign({}, oB.layout, { padding: { right: 70 } });
    _gdChart('gd-c' + i + '-au-esp', { type: 'bar', data: { labels: esp.map(function (x) { return x.especialidad; }), datasets: [{ label: 'Agendas', data: esp.map(function (x) { return x.n; }), backgroundColor: SERIE_PRINCIPAL }] }, options: oB });
  } else {
    var a = auPorAsesor(arr);
    // Fase 268: con un solo mes, barras horizontales por asesora (total y %),
    // como "por especialidad"; con 2 o mas, una linea por asesora.
    if (a.meses.length < 2) {
      var oH = (typeof loBar === 'function') ? loBar(null) : { responsive: true, maintainAspectRatio: false, plugins: {} };
      oH.indexAxis = 'y';
      if (oH.plugins && oH.plugins.datalabels) {
        oH.plugins.datalabels.formatter = function (v, ctx) { return v ? Number(v).toLocaleString('es-CO') + ' (' + String(a.filas[ctx.dataIndex].pct).replace('.', ',') + ' %)' : ''; };
        oH.plugins.datalabels.anchor = 'end'; oH.plugins.datalabels.align = 'end'; oH.plugins.datalabels.clamp = true;
      }
      oH.layout = Object.assign({}, oH.layout, { padding: { right: 70 } });
      _gdChart('gd-c' + i + '-au-ase', { type: 'bar', data: { labels: a.filas.map(function (x) { return x.asesora; }), datasets: [{ label: 'Agendas', data: a.filas.map(function (x) { return x.total; }), backgroundColor: SERIE_PRINCIPAL }] }, options: oH });
      return;
    }
    var oA = (typeof lo === 'function') ? lo(null) : { responsive: true, maintainAspectRatio: false, plugins: {} };
    _auEjeDesdeCero(oA);
    if (typeof loDatalabelsAuto === 'function') loDatalabelsAuto(oA, function (v) { return v === null || v === undefined ? '' : Number(v).toLocaleString('es-CO'); });
    _gdChart('gd-c' + i + '-au-ase', { type: 'line', data: { labels: a.meses.map(_auMesCorto), datasets: a.filas.map(function (x, k) {
      var c = pal.length ? pal[k % pal.length] : SERIE_PRINCIPAL;
      return { label: x.asesora, data: x.serie, borderColor: c, backgroundColor: c, borderWidth: 2.5, pointRadius: 5, tension: 0.3, fill: false };
    }) }, options: oA });
  }
}

// Fase 268: eje de cantidades desde 0 (sin esto, con valores parecidos el eje
// arranca cerca del minimo y exagera las diferencias).
function _auEjeDesdeCero(o) {
  o.scales = o.scales || {};
  o.scales.y = Object.assign({}, o.scales.y, { beginAtZero: true });
  return o;
}

function _auRepintarTodos() {
  var tab = (_gd.config.layout.tabs || []).find(function (x) { return x.key === _gd.tab; });
  if (tab) renderGenericTab(tab.key);
}
// Filtros: un solo manejador (sin onclick en linea); son comunes a las 3 vistas.
document.addEventListener('change', function (e) {
  var t = e.target;
  if (!t || !t.closest || !t.closest('[id^="gd-p"]')) return;
  var host = t.closest('[id^="gd-p"]');
  var camp = host.dataset.campana;
  if (!camp || !host.dataset.vista) return;
  var f = _auFiltrosActuales(camp);
  if (t.hasAttribute('data-au-asesora')) {
    f.asesoras = Array.prototype.filter.call(host.querySelectorAll('[data-au-asesora]'), function (c) { return c.checked; }).map(function (c) { return c.value; });
  } else if (t.getAttribute('data-au-campo')) {
    f[t.getAttribute('data-au-campo')] = t.value;
  } else return;
  _auRepintarTodos();
});
document.addEventListener('click', function (e) {
  var b = e.target && e.target.closest && e.target.closest('[data-au-limpiar]');
  if (!b) return;
  var host = b.closest('[id^="gd-p"]');
  if (!host || !host.dataset.campana) return;
  delete _auFiltro[host.dataset.campana];
  _auRepintarTodos();
});

// Filas de la vista tal como se ve (mismos filtros), para Excel y Exportar.
function _auFilasExport(i) {
  var host = document.getElementById('gd-p' + i);
  var camp = host ? host.dataset.campana : _gd.cliente;
  var vista = (host && host.dataset.vista) || 'mes';
  if (vista === 'agendas') return _auFilasAgendas(camp).ranking; // Fase 302
  var datos = _auCache[camp];
  if (!datos) return [];
  var arr = auFiltrar(datos.filas, _auFiltroParaLogica(camp));
  if (vista === 'especialidad') return auPorEspecialidad(arr).map(function (x) { return { Especialidad: x.especialidad, Agendas: x.n, '% del total': x.pct }; });
  if (vista === 'asesor') {
    var a = auPorAsesor(arr);
    return a.filas.map(function (x) { var o = { Asesor: x.asesora }; a.meses.forEach(function (m, k) { o[m] = x.serie[k]; }); o.Total = x.total; o['% del total'] = x.pct; return o; });
  }
  return auPorMes(arr).map(function (x) { return { Mes: x.mes, Agendas: x.n }; });
}
function _auExportExcel(i) {
  if (typeof XLSX === 'undefined' || typeof xlsxFilasSeguras !== 'function') { showToast('No se pudo preparar el Excel de forma segura. Recarga la página e inténtalo de nuevo.', 'error'); return; }
  var host = document.getElementById('gd-p' + i);
  var vista = (host && host.dataset.vista) || 'mes';
  if (vista === 'agendas') { // Fase 302: 2 hojas (por mes y el ranking completo)
    var d = _auFilasAgendas(host.dataset.campana);
    if (!d.mes.length && !d.ranking.length) { showToast('No hay datos para exportar con estos filtros.'); return; }
    var wbA = XLSX.utils.book_new();
    if (typeof xlsxAgregarAvisoDemo === 'function') xlsxAgregarAvisoDemo(wbA);
    XLSX.utils.book_append_sheet(wbA, XLSX.utils.json_to_sheet(xlsxFilasSeguras(d.mes)), 'Por mes');
    XLSX.utils.book_append_sheet(wbA, XLSX.utils.json_to_sheet(xlsxFilasSeguras(d.ranking)), 'Ranking');
    XLSX.writeFile(wbA, 'Agendas_' + String(_gd.cliente).replace(/\s+/g, '_') + '.xlsx');
    return;
  }
  var filas = _auFilasExport(i);
  if (!filas.length) { showToast('No hay datos para exportar con estos filtros.'); return; }
  var wb = XLSX.utils.book_new();
  if (typeof xlsxAgregarAvisoDemo === 'function') xlsxAgregarAvisoDemo(wb);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(xlsxFilasSeguras(filas)), (_AU_TITULOS[vista] || 'Agendas').slice(0, 31));
  XLSX.writeFile(wb, 'Agendas_' + vista + '_' + String(_gd.cliente).replace(/\s+/g, '_') + '.xlsx');
}

// ── Fase 302 (10/11): vista «Agendas» (pestaña de una sola vista) ──
// Filtros arriba (fecha de registro, fecha de cita, entidad, usuario que registra,
// especialidad, profesional, sede), botones de base (Todas / Citas asignadas y
// cumplidas / Cancelaciones / Inasistencias) y 2 graficas grandes con botones de
// vista, como la pregunta 1 de la Encuesta (sin cuadro de resumen):
//   1) linea por mes: «Fecha de registro» / «Fecha de cita»;
//   2) ranking: «Usuario que registra» / «Especialidad» / «Profesional» (top 10 + ver mas).
// Solo las filas cargadas con base (auFiltrarAgendas). Logica en agendas-usuaria-logic.js.
var _auAg = {}; // por campaña: { base, g1, g2, verMas }
var AU_TOP = 10;
var AU_G1 = [{ v: 'fechaSolicitud', t: 'Fecha de registro' }, { v: 'fechaCita', t: 'Fecha de cita' }];
var AU_G2 = [{ v: 'usuario', t: 'Usuario que registra' }, { v: 'especialidad', t: 'Especialidad' }, { v: 'prof', t: 'Profesional' }];
function _auEstadoAg(camp) { return _auAg[camp] || (_auAg[camp] = { base: '', g1: 'fechaCita', g2: 'usuario', verMas: false }); }
function _auColorBase(id) {
  var pal = (typeof PC !== 'undefined' && PC.length) ? PC : ['#349db2', '#a92dd2', '#d22d80'];
  var idx = { citas: 4, cancelaciones: 1, inasistencias: 6 }[id];
  return pal[(idx === undefined ? 0 : idx) % pal.length];
}
function _auBotones(grupo, lista, activa, i, etiqueta) {
  return '<div class="gd-subtabs au-ag-botones" aria-label="' + esc(etiqueta) + '">' + lista.map(function (b) {
    var on = b.v === activa;
    return '<button type="button" class="gd-subtab-btn' + (on ? ' on' : '') + '" aria-pressed="' + (on ? 'true' : 'false') + '" data-au-ag="' + grupo + '" data-v="' + esc(b.v) + '" data-i="' + i + '">' + esc(b.t) + '</button>';
  }).join('') + '</div>';
}
function _auSelect(campo, etiqueta, opciones, valor, i) {
  return '<div class="au-filtro"><label for="au-f-' + campo + '-' + i + '">' + esc(etiqueta) + '</label><select id="au-f-' + campo + '-' + i + '" data-au-campo="' + campo + '" data-i="' + i + '"><option value="">Todos</option>' +
    opciones.map(function (v) { return '<option value="' + esc(v) + '"' + (v === valor ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('') + '</select></div>';
}
function _auFiltroAg(camp) {
  var f = _auFiltrosActuales(camp), st = _auEstadoAg(camp);
  var meses = (typeof gdMesesTarjetasActual === 'function') ? gdMesesTarjetasActual() : [];
  return { meses: meses, bases: st.base ? [st.base] : null, citaDesde: f.citaDesde, citaHasta: f.citaHasta,
    registroDesde: f.registroDesde, registroHasta: f.registroHasta, entidad: f.entidad, usuario: f.usuario,
    especialidad: f.especialidad, prof: f.prof, sede: f.sede };
}

async function _auRenderAgendas(p, i, el, camp) {
  var datos;
  try { datos = await _auCargar(camp); } catch (e) { el.innerHTML = '<div class="aurora-card"><div class="gd-aviso-mes" role="status">' + esc(e.message) + '</div></div>'; return; }
  var titulo = p.titulo || 'Agendas';
  var conBase = datos.filas.filter(function (r) { return r.base; });
  if (!conBase.length) {
    var interno = 'Todavía no hay agendas con las 3 bases (' + AU_TIPOS_BASE.map(function (b) { return b.etiqueta; }).join(', ') + '). Súbelas en Cargar datos › ' + esc(camp) + ' › Agendas › Subir.' +
      (datos.filas.length ? ' Lo cargado antes con el reporte de una sola base no se usa en esta vista.' : '');
    el.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">' + esc(titulo) + '</div>' +
      (typeof avisoPendienteHtml === 'function' ? avisoPendienteHtml('Agendas', interno) : '<div class="gd-vacio" role="status">' + interno + '</div>') + '</div>';
    return;
  }
  var f = _auFiltrosActuales(camp), st = _auEstadoAg(camp);
  var fl = _auFiltroAg(camp);
  // Opciones de cada filtro: lo del mes y la base elegidos (sin los demas filtros).
  var paraOpciones = auFiltrarAgendas(datos.filas, { meses: fl.meses, bases: fl.bases });
  ['entidad', 'usuario', 'especialidad', 'prof', 'sede'].forEach(function (d) {
    if (f[d] && auOpcionesAgendas(paraOpciones, d).indexOf(f[d]) === -1) f[d] = '';
  });
  fl = _auFiltroAg(camp);
  var hayFiltro = ['entidad', 'usuario', 'especialidad', 'prof', 'sede', 'citaDesde', 'citaHasta', 'registroDesde', 'registroHasta'].some(function (k) { return f[k]; });
  var bases = [{ v: '', t: 'Todas' }].concat(AU_TIPOS_BASE.map(function (b) { return { v: b.id, t: b.etiqueta }; }));
  var filtros = '<div class="aurora-card au-filtros-card">' +
    '<div class="au-ag-base">' + _auBotones('base', bases, st.base, i, 'Base') + '</div>' +
    '<div class="au-filtros">' +
      _auFecha('Fecha de registro', f.registroDesde, f.registroHasta, 'registroDesde', 'registroHasta', i) +
      _auFecha('Fecha de cita', f.citaDesde, f.citaHasta, 'citaDesde', 'citaHasta', i) +
      _auSelect('entidad', 'Entidad', auOpcionesAgendas(paraOpciones, 'entidad'), f.entidad, i) +
      _auSelect('usuario', 'Usuario que registra', auOpcionesAgendas(paraOpciones, 'usuario'), f.usuario, i) +
      _auSelect('especialidad', 'Especialidad', auOpcionesAgendas(paraOpciones, 'especialidad'), f.especialidad, i) +
      _auSelect('prof', 'Profesional', auOpcionesAgendas(paraOpciones, 'prof'), f.prof, i) +
      _auSelect('sede', 'Sede', auOpcionesAgendas(paraOpciones, 'sede'), f.sede, i) +
      (hayFiltro ? '<button type="button" class="btn-cancel au-limpiar" data-au-limpiar data-i="' + i + '">Quitar filtros</button>' : '') +
      '<button type="button" class="btn-sm au-ag-excel" onclick="_auExportExcel(' + i + ')">Excel</button>' +
    '</div></div>';
  var arr = auFiltrarAgendas(datos.filas, fl);
  var serie = auSerieMensual(arr, st.g1);
  var rk = auRanking(arr, st.g2, st.verMas ? null : AU_TOP);
  var sinFecha = Object.keys(serie.sinFecha).filter(function (b) { return serie.sinFecha[b] > 0; });
  var notaG1 = (st.g1 === 'fechaSolicitud' && sinFecha.length)
    ? '<p class="au-ag-nota">' + esc(sinFecha.map(auEtiquetaBase).join(' y ')) + ' no ' + (sinFecha.length > 1 ? 'traen' : 'trae') + ' fecha de registro: esas citas no suman en esta gráfica.</p>' : '';
  var g1 = gdGraficaHtml('Agendas por mes', '<div class="aurora-chart-wrap" style="height:340px"><canvas id="gd-c' + i + '-au-g1"></canvas></div>' + notaG1,
    { destacado: true, acciones: _auBotones('g1', AU_G1, st.g1, i, 'Agendas por mes según') });
  var etiquetaG2 = AU_DIMENSIONES[st.g2] || 'Agendas';
  var verMas = rk.cantidad > AU_TOP
    ? '<div class="au-ag-vermas"><button type="button" class="btn-sm" data-au-ag="vermas" data-i="' + i + '">' + (st.verMas ? 'Ver menos' : 'Ver más (' + rk.cantidad + ')') + '</button></div>' : '';
  var alto = Math.max(260, 34 * Math.max(rk.items.length, 1) + 90);
  var g2 = gdGraficaHtml('Agendas por ' + etiquetaG2.toLowerCase(), (rk.items.length
      ? '<div class="aurora-chart-wrap" style="height:' + alto + 'px"><canvas id="gd-c' + i + '-au-g2"></canvas></div>'
      : '<div class="gd-vacio" role="status">Sin datos de ' + esc(etiquetaG2.toLowerCase()) + ' con estos filtros.</div>') + verMas,
    { destacado: true, acciones: _auBotones('g2', AU_G2, st.g2, i, 'Agendas según') });
  el.innerHTML = filtros + (arr.length ? g1 + g2 : '<div class="aurora-card"><div class="gd-vacio" role="status">Sin agendas con estos filtros.</div></div>');
  if (!arr.length) return;

  // Grafica 1: una linea por base (y el total con "Todas").
  var fmtN = function (v) { return v === null || v === undefined ? '' : Number(v).toLocaleString('es-CO'); };
  var oL = (typeof lo === 'function') ? lo(null) : { responsive: true, maintainAspectRatio: false, plugins: {} };
  _auEjeDesdeCero(oL);
  if (oL.scales && oL.scales.y) oL.scales.y.grace = '12%';
  if (typeof loDatalabelsAuto === 'function') loDatalabelsAuto(oL, fmtN);
  if (oL.plugins) oL.plugins.legend = { position: 'bottom', labels: { usePointStyle: true, boxWidth: 12, padding: 10, color: (typeof leyendaColorTexto === 'function' ? leyendaColorTexto() : undefined) } };
  oL.layout = { padding: { top: 20, left: 10, right: 30 } };
  var dsL = serie.series.map(function (x) {
    var c = _auColorBase(x.base);
    return { label: x.etiqueta, data: x.data, borderColor: c, backgroundColor: c, pointBackgroundColor: c, borderWidth: 2.5, pointRadius: 5, tension: 0.25, fill: false, datalabels: { color: c } };
  });
  if (!st.base && serie.series.length > 1) {
    dsL.unshift({ label: 'Total', data: serie.total, borderColor: SERIE_PRINCIPAL, backgroundColor: SERIE_PRINCIPAL, pointBackgroundColor: SERIE_PRINCIPAL, borderWidth: 3, pointRadius: 5, tension: 0.25, fill: false, datalabels: { color: SERIE_PRINCIPAL } });
  }
  _gdChart('gd-c' + i + '-au-g1', { type: 'line', data: { labels: serie.meses.map(_auMesCorto), datasets: dsL }, options: oL });

  // Grafica 2: barras horizontales, apiladas por base con "Todas".
  if (!rk.items.length) return;
  var oB = (typeof loBar === 'function') ? loBar(null) : { responsive: true, maintainAspectRatio: false, plugins: {} };
  oB.indexAxis = 'y';
  var basesEnRk = AU_TIPOS_BASE.filter(function (b) { return rk.items.some(function (x) { return x.porBase[b.id]; }); });
  var apilar = !st.base && basesEnRk.length > 1;
  oB.scales = Object.assign({}, oB.scales, { x: Object.assign({}, (oB.scales || {}).x, { stacked: apilar, beginAtZero: true }), y: Object.assign({}, (oB.scales || {}).y, { stacked: apilar }) });
  if (oB.plugins) {
    oB.plugins.legend = apilar ? { position: 'bottom', labels: { boxWidth: 12, padding: 10, color: (typeof leyendaColorTexto === 'function' ? leyendaColorTexto() : undefined) } } : { display: false };
    // El total al final de cada barra (en la ultima serie), no un numero por pedazo.
    oB.plugins.datalabels = Object.assign({}, oB.plugins.datalabels, { anchor: 'end', align: 'end', clamp: true,
      display: function (ctx) { return ctx.datasetIndex === ctx.chart.data.datasets.length - 1; },
      formatter: function (v, ctx) { return fmtN(rk.items[ctx.dataIndex].total); } });
  }
  oB.layout = Object.assign({}, oB.layout, { padding: { right: 60 } });
  // Nombres largos: cortados con «…» en el eje (mas en el celular); completos en el tooltip.
  oB.scales.y.ticks = Object.assign({}, oB.scales.y.ticks, { autoSkip: false, callback: function (v) {
    var t = String(this.getLabelForValue(v) || ''); var max = (this.chart && this.chart.width < 480) ? 14 : 30;
    return t.length > max ? t.slice(0, max - 1) + '…' : t; } });
  var dsB = apilar
    ? basesEnRk.map(function (b) { var c = _auColorBase(b.id); return { label: b.etiqueta, data: rk.items.map(function (x) { return x.porBase[b.id] || 0; }), backgroundColor: c }; })
    : [{ label: 'Agendas', data: rk.items.map(function (x) { return x.total; }), backgroundColor: st.base ? _auColorBase(st.base) : SERIE_PRINCIPAL }];
  _gdChart('gd-c' + i + '-au-g2', { type: 'bar', data: { labels: rk.items.map(function (x) { return x.valor; }), datasets: dsB }, options: oB });
}

// Botones de base / vista de cada grafica / ver mas.
document.addEventListener('click', function (e) {
  var b = e.target && e.target.closest && e.target.closest('[data-au-ag]');
  if (!b) return;
  var host = b.closest('[id^="gd-p"]'); if (!host) return;
  var st = _auEstadoAg(host.dataset.campana);
  var g = b.getAttribute('data-au-ag');
  if (g === 'vermas') st.verMas = !st.verMas;
  else if (g === 'base') st.base = b.getAttribute('data-v') || '';
  else if (g === 'g1') st.g1 = b.getAttribute('data-v');
  else if (g === 'g2') { st.g2 = b.getAttribute('data-v'); st.verMas = false; }
  _auRepintarTodos();
});

// Excel de la vista «Agendas»: por mes (grafica 1) y el ranking completo (grafica 2).
function _auFilasAgendas(camp) {
  var datos = _auCache[camp]; if (!datos) return { mes: [], ranking: [] };
  var st = _auEstadoAg(camp);
  var arr = auFiltrarAgendas(datos.filas, _auFiltroAg(camp));
  var s = auSerieMensual(arr, st.g1);
  var mes = s.meses.map(function (m, k) {
    var o = { Mes: m };
    s.series.forEach(function (x) { o[x.etiqueta] = x.data[k]; });
    o.Total = s.total[k]; return o;
  });
  var dim = AU_DIMENSIONES[st.g2];
  var ranking = auRanking(arr, st.g2, null).items.map(function (x) {
    var o = {}; o[dim] = x.valor;
    AU_TIPOS_BASE.forEach(function (b) { o[b.etiqueta] = x.porBase[b.id] || 0; });
    o.Total = x.total; return o;
  });
  return { mes: mes, ranking: ranking };
}

// ── Fase 301 (09/11): cargar las 3 bases de "Agendas por usuaria" de Aurora ──
// Desde el Centro de cargas (módulo Agendas por usuaria › Subir). Una casilla por
// base (AU_TIPOS_BASE): se puede subir una sola o las 3 juntas. Cada archivo se
// lee por NOMBRE de encabezado (AU_MAPA_ENCABEZADOS), se agrega aquí (ningún dato
// de paciente sale del navegador) y las bases se UNEN en una sola carga, cada
// fila con su base. En el servidor solo se reemplazan las bases que se suben.
// La pestaña se calcula y se muestra igual que antes.
var _auBases = { cliente: '', mes: '' };

function auAbrirCargaBases(cliente, mes) {
  _auBases.cliente = cliente; _auBases.mes = mes || '';
  var casillas = AU_TIPOS_BASE.map(function (b) {
    return '<div class="ig"><label for="au-base-' + b.id + '">' + esc(b.etiqueta) + '</label>' +
      '<input type="file" id="au-base-' + b.id + '" accept=".xls,.xlsx,.csv" data-au-base="' + esc(b.id) + '"></div>';
  }).join('');
  var cuerpo = '<p class="au-bases-ayuda">Sube una base o las tres a la vez. Cada columna se busca por su nombre, en cualquier orden. ' +
    'Solo se reemplazan las bases que subas; las demás del mes se quedan.</p>' + casillas +
    '<div id="au-bases-estado" class="au-bases-estado" role="status" aria-live="polite"></div>';
  _ccDialogo('Agendas — cargar bases' + (mes && typeof centroNombreMes === 'function' ? ' (' + esc(centroNombreMes(mes)) + ')' : ''), cuerpo,
    '<button type="button" class="btn-cancel" onclick="_ccCerrarDialogo()">Cancelar</button>' +
    '<button type="button" class="btn-primary" id="au-bases-guardar" onclick="auGuardarBases()">Revisar y guardar</button>');
}

function _auLeerArchivo(file) {
  return new Promise(function (ok, mal) {
    var fr = new FileReader();
    fr.onload = function () { ok(fr.result); };
    fr.onerror = function () { mal(new Error('No se pudo leer el archivo «' + file.name + '»')); };
    fr.readAsArrayBuffer(file);
  });
}

// La hoja del reporte: la que reconoce TODAS las columnas; si ninguna, la que
// reconoce más (así el error dice exactamente qué falta). Mismas opciones de
// lectura que Cargar Datos (cellNF: fechas como en la carga de siempre).
function auAoaDelLibro(wb) {
  var mejor = null, mejorN = -1;
  for (var k = 0; k < wb.SheetNames.length; k++) {
    var aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[k]], { header: 1, blankrows: false, defval: null });
    var r = auParseFilas(aoa);
    if (!r.error) return aoa;
    var n = AU_MAPA_ENCABEZADOS.length - (r.faltan || []).length;
    if (n > mejorN) { mejorN = n; mejor = aoa; }
  }
  return mejor || [];
}

async function auGuardarBases() {
  var estado = document.getElementById('au-bases-estado');
  var btn = document.getElementById('au-bases-guardar');
  var decir = function (html, error) { if (estado) { estado.innerHTML = html; estado.setAttribute('role', error ? 'alert' : 'status'); estado.classList.toggle('au-bases-error', !!error); } };
  var inputs = Array.prototype.slice.call(document.querySelectorAll('input[data-au-base]'));
  var elegidos = inputs.filter(function (el) { return el.files && el.files[0]; });
  if (!elegidos.length) { decir('Elige al menos un archivo.', true); return; }
  if (btn) btn.disabled = true;
  try {
    decir('Leyendo ' + elegidos.length + ' archivo(s)…');
    var partes = [];
    for (var k = 0; k < elegidos.length; k++) {
      var f = elegidos[k].files[0];
      var wb = XLSX.read(new Uint8Array(await _auLeerArchivo(f)), { type: 'array', sheetStubs: true, cellNF: true });
      partes.push({ base: elegidos[k].dataset.auBase, archivo: f.name, aoa: auAoaDelLibro(wb) });
    }
    // Fase 302: si el nombre del archivo dice otra base, se avisa antes de mezclar.
    var cruzados = partes.filter(function (p) { var b = auBaseDesdeArchivo(p.archivo); return b && b !== p.base; });
    if (cruzados.length) { decir(cruzados.map(function (p) { return '<p>' + esc('«' + p.archivo + '» parece de ' + auEtiquetaBase(auBaseDesdeArchivo(p.archivo)) + ', pero está en la casilla de ' + auEtiquetaBase(p.base) + '.') + '</p>'; }).join(''), true); return; }
    var u = auUnirBases(partes);
    if (u.error) { decir(u.errores.map(function (e) { return '<p>' + esc(e) + '</p>'; }).join(''), true); return; }
    var archivoNombre = partes.map(function (p) { return auEtiquetaBase(p.base) + ': ' + p.archivo; }).join(' | ').slice(0, 200);
    var cuerpo = { campana: _auBases.cliente, archivoNombre: archivoNombre, filas: u.filas };
    var imp = await apiRequest('POST', '/calidad/agendas-usuaria/carga/impacto', cuerpo);
    var resumenBases = Object.keys(u.porBase).map(function (b) { return '• ' + auEtiquetaBase(b) + ' («' + u.porBase[b].archivo + '»): ' + u.porBase[b].citas + ' cita(s)'; });
    var lineas = (imp.meses || []).map(function (m) {
      var que = m.bases ? m.bases.map(auEtiquetaBase).join(', ') : 'el mes completo';
      return '• ' + mesNombreLargo(m.mes) + ': ' + m.citasNuevas + ' cita(s) — reemplaza ' + que + (m.citasExistentes > 0 ? ' (' + m.citasExistentes + ' ya cargada(s))' : ' (nada cargado)');
    });
    var avisos = u.avisos.length ? '\n\nAvisos:\n' + u.avisos.join('\n') : '';
    if (!confirm('Agendas — bases unidas:\n' + resumenBases.join('\n') + '\n\nSe va a guardar:\n' + lineas.join('\n') + avisos + '\n\n¿Continuar?')) { decir('No se guardó nada.'); return; }
    var resp = await apiRequest('POST', '/calidad/agendas-usuaria/carga', cuerpo);
    if (typeof _auCache !== 'undefined') _auCache = {};
    if (typeof showToast === 'function') showToast(resp.citas + ' cita(s) guardadas (' + resp.meses.map(mesNombreLargo).join(', ') + ')');
    _ccCerrarDialogo();
    if (typeof _ccCargar === 'function') _ccCargar();
  } catch (e) {
    decir(esc(e.message || String(e)), true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

