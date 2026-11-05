// agendas-usuaria.js — Fase 259 (pedido de Edwin, reunion 05/11, Clinica
// Aurora): panel "agendas_usuaria_panel" de la pestaña "Agendas por
// usuaria". Lee los conteos agregados (GET /calidad/agendas-usuaria/datos,
// el nombre real de cada asesora ya resuelto con sus alias) y pinta:
// filtros (Asesora, Sede, Canal, Tipo de cita, Tipo de paciente; el mes es
// MESES de arriba), tarjetas, barras por asesora apiladas por canal, la tabla
// por asesora (con Excel) y la grafica por dia de confirmacion.
var _auCache = {};   // por campaña: { filas }
var _auFiltro = {};  // por campaña: { asesoras:[], sede, canal, tipoCita, tipoPaciente }
// Paleta categorica (PC de charts.js, cambia con el tema), nunca los colores del semaforo.
function _auColorCanal(k) { var pal = (typeof PC !== 'undefined') ? PC : []; return pal.length ? pal[Math.max(0, AU_CANALES.indexOf(k)) % pal.length] : undefined; }

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

function _auFiltrosActuales(camp) { return _auFiltro[camp] || (_auFiltro[camp] = { asesoras: [], sede: '', canal: '', tipoCita: '', tipoPaciente: '' }); }
function _auSelect(id, etiqueta, valores, actual, i, campo) {
  return '<div class="au-filtro"><label for="' + id + '">' + esc(etiqueta) + '</label><select id="' + id + '" data-au-campo="' + campo + '" data-i="' + i + '">' +
    '<option value="">Todos</option>' + valores.map(function (v) { return '<option value="' + esc(v) + '"' + (v === actual ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('') + '</select></div>';
}

async function _auRender(p, i) {
  var el = document.getElementById('gd-p' + i); if (!el) return;
  var camp = p.campana || _gd.cliente;
  el.dataset.campana = camp;
  var datos;
  try { datos = await _auCargar(camp); } catch (e) { el.innerHTML = '<div class="aurora-card"><div class="gd-aviso-mes" role="status">' + esc(e.message) + '</div></div>'; return; }
  if (!datos.filas.length) {
    el.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">' + esc(p.titulo || 'Agendas por usuaria') + '</div><div class="gd-aviso-mes" role="status">Todavía no hay agendas cargadas. Se suben en Cargar Datos › Agendas por usuaria (reporte de citas de la clínica).</div></div>';
    return;
  }
  var meses = (typeof gdMesesTarjetasActual === 'function') ? gdMesesTarjetasActual() : [];
  var delMes = auFiltrar(datos.filas, { meses: meses });
  var f = _auFiltrosActuales(camp);
  var asesorasDisp = auOpciones(delMes, 'asesora');
  f.asesoras = f.asesoras.filter(function (a) { return asesorasDisp.indexOf(a) !== -1; });
  var filtro = { meses: meses, asesoras: f.asesoras, sedes: f.sede ? [f.sede] : null, canales: f.canal ? [f.canal] : null,
    tiposCita: f.tipoCita ? [f.tipoCita] : null, tiposPaciente: f.tipoPaciente ? [f.tipoPaciente] : null };
  var arr = auFiltrar(datos.filas, filtro);
  var t = auTarjetas(arr);
  var tabla = auPorAsesora(arr);
  var hayCreadas = datos.filas.some(function (r) { return r.rol === 'crea'; });
  var pct = function (n) { return String(auPct(n, t.total)).replace('.', ',') + ' %'; };
  var fmt = function (n) { return Number(n || 0).toLocaleString('es-CO'); };
  var listaAsesoras = '<details class="au-asesoras"><summary>Asesora: ' + (f.asesoras.length ? f.asesoras.length + ' elegida(s)' : 'Todas') + '</summary><div class="au-asesoras-lista">' +
    asesorasDisp.map(function (a) { return '<label><input type="checkbox" data-au-asesora data-i="' + i + '" value="' + esc(a) + '"' + (f.asesoras.indexOf(a) !== -1 ? ' checked' : '') + '> ' + esc(a) + '</label>'; }).join('') + '</div></details>';
  var cabTabla = '<tr><th>Asesora</th><th>Total</th><th>Llamada</th><th>WhatsApp</th><th>No contesta</th><th>Otro</th><th>% del total</th>' + (hayCreadas ? '<th>Creadas</th>' : '') + '</tr>';
  var filaHtml = function (x, esTotal) {
    var tag = esTotal ? 'th' : 'td';
    return '<tr' + (esTotal ? ' class="au-total"' : '') + '><' + tag + (esTotal ? ' scope="row"' : '') + '>' + esc(x.asesora) + '</' + tag + '><td>' + fmt(x.total) + '</td><td>' + fmt(x.Llamada) + '</td><td>' + fmt(x.WhatsApp) + '</td><td>' + fmt(x['No contesta']) + '</td><td>' + fmt(x.Otro) + '</td><td>' + String(x.pct).replace('.', ',') + ' %</td>' + (hayCreadas ? '<td>' + fmt(x.creadas) + '</td>' : '') + '</tr>';
  };
  el.innerHTML =
    '<div class="aurora-card au-filtros-card"><div class="au-filtros">' + listaAsesoras +
      _auSelect('au-f-sede-' + i, 'Sede', auOpciones(delMes, 'sede'), f.sede, i, 'sede') +
      _auSelect('au-f-canal-' + i, 'Canal', AU_CANALES, f.canal, i, 'canal') +
      _auSelect('au-f-tipo-' + i, 'Tipo de cita', AU_TIPOS_CITA, f.tipoCita, i, 'tipoCita') +
      _auSelect('au-f-pac-' + i, 'Tipo de paciente', auOpciones(delMes, 'tipoPaciente'), f.tipoPaciente, i, 'tipoPaciente') +
    '</div></div>' +
    '<div class="aurora-kpis">' +
      kpiTarjetaHtml({ valor: fmt(t.total), etiqueta: 'Total agendas confirmadas', soloTitulo: true }) +
      kpiTarjetaHtml({ valor: fmt(t.llamada), etiqueta: 'Confirmadas por llamada · ' + pct(t.llamada), soloTitulo: true }) +
      kpiTarjetaHtml({ valor: fmt(t.whatsapp), etiqueta: 'Confirmadas por WhatsApp · ' + pct(t.whatsapp), soloTitulo: true }) +
      kpiTarjetaHtml({ valor: fmt(t.noContesta), etiqueta: 'No contesta · ' + pct(t.noContesta), soloTitulo: true }) +
      (hayCreadas ? kpiTarjetaHtml({ valor: fmt(t.creadas), etiqueta: 'Citas creadas por InConexion', soloTitulo: true }) : '') +
    '</div>' +
    '<div class="aurora-card"><div class="aurora-card-title">Agendas por asesora</div>' +
      '<div class="aurora-chart-wrap" style="height:' + Math.max(220, 46 * tabla.filas.length + 80) + 'px"><canvas id="gd-c' + i + '-au-bar"></canvas></div></div>' +
    '<div class="aurora-card"><div class="au-tabla-cab"><div class="aurora-card-title">Agendas por asesora (tabla)</div><button type="button" class="btn-sm" onclick="_auExportExcel(' + i + ')">Excel</button></div>' +
      '<div style="overflow-x:auto"><table class="aurora-rank-table au-tabla">' + cabTabla + tabla.filas.map(function (x) { return filaHtml(x, false); }).join('') + filaHtml(tabla.total, true) + '</table></div></div>' +
    '<div class="aurora-card"><div class="aurora-card-title">Agendas confirmadas por día' + (f.asesoras.length ? ' · ' + esc(f.asesoras.join(', ')) : '') + '</div>' +
      '<div class="aurora-chart-wrap" style="height:240px"><canvas id="gd-c' + i + '-au-dia"></canvas></div></div>';

  // Barras horizontales apiladas por canal; la etiqueta de cada asesora lleva su total y su %.
  var etiquetas = tabla.filas.map(function (x) { return x.asesora + ' — ' + fmt(x.total) + ' (' + String(x.pct).replace('.', ',') + ' %)'; });
  var oBar = loBar(null);
  oBar.indexAxis = 'y';
  oBar.scales = { x: { stacked: true, beginAtZero: true }, y: { stacked: true } };
  if (oBar.plugins && oBar.plugins.datalabels) {
    oBar.plugins.datalabels.align = 'center'; oBar.plugins.datalabels.anchor = 'center';
    oBar.plugins.datalabels.formatter = function (v) { return v ? Number(v).toLocaleString('es-CO') : ''; };
    oBar.plugins.datalabels.display = function (ctx) { return (ctx.dataset.data[ctx.dataIndex] || 0) >= Math.max(1, t.total * 0.02); };
  }
  _gdChart('gd-c' + i + '-au-bar', { type: 'bar', data: { labels: etiquetas, datasets: AU_CANALES.map(function (c) {
    return { label: c, data: tabla.filas.map(function (x) { return x[c]; }), backgroundColor: _auColorCanal(c), stack: 'canal' };
  }) }, options: oBar });

  var dias = auPorDia(arr);
  var oDia = loBar(null);
  _gdChart('gd-c' + i + '-au-dia', { type: 'bar', data: { labels: dias.map(function (d) { return d.dia; }), datasets: [{ label: 'Confirmadas', data: dias.map(function (d) { return d.n; }), backgroundColor: SERIE_PRINCIPAL }] }, options: oDia });
}

// Filtros: un solo manejador para el panel (sin onclick en linea en los selects).
document.addEventListener('change', function (e) {
  var t = e.target;
  if (!t || !t.closest || !t.closest('[id^="gd-p"]')) return;
  var host = t.closest('[id^="gd-p"]');
  var camp = host.dataset.campana;
  if (!camp) return;
  var f = _auFiltrosActuales(camp);
  if (t.hasAttribute('data-au-asesora')) {
    f.asesoras = Array.prototype.filter.call(host.querySelectorAll('[data-au-asesora]'), function (c) { return c.checked; }).map(function (c) { return c.value; });
  } else if (t.getAttribute('data-au-campo')) {
    f[t.getAttribute('data-au-campo')] = t.value;
  } else return;
  var i = Number(t.getAttribute('data-i'));
  var tab = (_gd.config.layout.tabs || []).find(function (x) { return x.key === _gd.tab; });
  var p = tab && (tab.panels || [])[i];
  if (p) _auRender(p, i);
});

// Filas de la tabla tal como se ven (mismos filtros), para Excel y Exportar.
function _auFilasExport(i) {
  var host = document.getElementById('gd-p' + i);
  var camp = host ? host.dataset.campana : _gd.cliente;
  var datos = _auCache[camp];
  if (!datos) return [];
  var f = _auFiltrosActuales(camp);
  var meses = (typeof gdMesesTarjetasActual === 'function') ? gdMesesTarjetasActual() : [];
  var arr = auFiltrar(datos.filas, { meses: meses, asesoras: f.asesoras, sedes: f.sede ? [f.sede] : null, canales: f.canal ? [f.canal] : null,
    tiposCita: f.tipoCita ? [f.tipoCita] : null, tiposPaciente: f.tipoPaciente ? [f.tipoPaciente] : null });
  var t = auPorAsesora(arr);
  return t.filas.concat([t.total]).map(function (x) {
    return { Asesora: x.asesora, Total: x.total, Llamada: x.Llamada, WhatsApp: x.WhatsApp, 'No contesta': x['No contesta'], Otro: x.Otro, '% del total': x.pct, Creadas: x.creadas };
  });
}
function _auExportExcel(i) {
  if (typeof XLSX === 'undefined' || typeof xlsxFilasSeguras !== 'function') { showToast('No se pudo preparar el Excel de forma segura. Recarga la página e inténtalo de nuevo.', 'error'); return; }
  var filas = _auFilasExport(i);
  if (!filas.length) { showToast('No hay datos para exportar con estos filtros.'); return; }
  var wb = XLSX.utils.book_new();
  if (typeof xlsxAgregarAvisoDemo === 'function') xlsxAgregarAvisoDemo(wb);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(xlsxFilasSeguras(filas)), 'Agendas por asesora');
  XLSX.writeFile(wb, 'Agendas_por_usuaria_' + String(_gd.cliente).replace(/\s+/g, '_') + '.xlsx');
}
