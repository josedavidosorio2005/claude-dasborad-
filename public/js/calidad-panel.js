// calidad-panel.js — Fase 256 (plan de Calidad B5) y Fase 274 (pedido de
// Edwin, 06/11). Panel "calidad_monitoreos_panel" de la pestaña Calidad del
// dashboard (Mobilize, Aurora y HLM): "Resultado de los monitoreos" igual que
// la vista "Resultados del equipo" del HTML de Edwin (Calidad InConexion.html),
// con lo que se califica en la plataforma:
//  - filtros Mes y Asesor (varios, con Marcar todo / Ninguno) y los botones
//    Detalle por mes, Resumen por asesor y Diccionario;
//  - 4 tarjetas, Calificacion definitiva por asesor (linea con la banda de
//    umbrales 70 y 90), por mes, la torta por clasificacion, Resultado por
//    asesor, Items mas afectados (todos los de la plantilla) y la nota al pie;
//  - debajo, Llamadas con fallas (clic = detalle de cada monitoreo).
// Los calculos estan en calidad-equipo-logic.js (comparados con el HTML en
// fase274-calidad-como-html.test.js). Sigue a MESES: los meses marcados ahi
// son los del filtro Mes (_gdMeses); con MESES en "Todos", el mes por defecto del HTML
// (el actual si tiene monitoreos; si no, el ultimo que tenga). Sale de CAL_DB
// (el telefono nunca llega al cliente, Fase 151). Los nombres de asesor solo
// si el registro lo permite (asesorVisibleCliente) o si quien mira es interno;
// si no, sin filtro de asesor ni vistas por asesor. Sin monitoreos: no se dibuja.

function _cmpVeAsesores(campana) {
  var interno = typeof currentUser === 'undefined' || !currentUser || currentUser.rol !== 'CLIENTES_DASH';
  return interno || (typeof LISTAS_REGISTRO !== 'undefined' && (LISTAS_REGISTRO.asesorVisibleCliente || []).indexOf(campana) !== -1);
}
var _cmpEstado = {};   // por campaña: plantilla elegida
var _cmpVerTodas = {}; // por campaña: mostrar todas las llamadas con fallas
var _cmpFiltro = {};   // por campaña: { meses, asesores (null = todos), clave (MESES aplicado) }
var _cmpCtx = {};      // por campaña: ultimo { p, i, arr, pl, ve } dibujado (filtros y dialogos)
function _cmpMostrarTodas(camp) { _cmpVerTodas[camp] = true; _cmpRepintar(camp); }
function _cmpElegir(camp, v) { _cmpEstado[camp] = Number(v) || null; _cmpRepintar(camp); }
function _cmpRepintar(camp, abierto) {
  var c = _cmpCtx[camp]; if (!c) return;
  _cmpRender(c.p, c.i);
  if (abierto) { // el filtro que se estaba usando sigue abierto (como en el HTML)
    var d = document.getElementById(abierto);
    if (d) { d.open = true; var q = d.querySelector('input[type="search"]'); if (q && _cmpFiltro[camp] && _cmpFiltro[camp].q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
  }
}
function _cmpHoyMes() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }

// Filtro con casillas (Mes o Asesor), en un <details> como el de MESES.
function _cmpPickHtml(id, etiqueta, valor, opciones, conBuscar, q) {
  return '<details class="cmp-pick" id="' + id + '"><summary><span class="cmp-pick-k">' + esc(etiqueta) + '</span> <span class="cmp-pick-v">' + esc(valor) + '</span></summary>' +
    '<div class="cmp-pick-p">' +
      (conBuscar ? '<input type="search" class="cmp-pick-q" placeholder="Buscar asesor" aria-label="Buscar asesor" value="' + esc(q || '') + '" data-cmp-q>' : '') +
      (typeof marcarTodoBarraHtml === 'function' ? marcarTodoBarraHtml(id + '-l') : '') +
      '<div class="cmp-pick-l" id="' + id + '-l">' + (opciones.length ? opciones.map(function (o) {
        return '<label' + (o.oculto ? ' hidden' : '') + '><input type="checkbox" value="' + esc(o.v) + '"' + (o.on ? ' checked' : '') + '> <span>' + esc(o.l) + (o.sub ? ' <small>' + esc(o.sub) + '</small>' : '') + '</span></label>';
      }).join('') : '<p class="ca-vacio">Sin opciones para los meses elegidos.</p>') + '</div></div></details>';
}

function _cmpRender(p, i) {
  var el = document.getElementById('gd-p' + i); if (!el) return;
  var camp = p.campana;
  var todosCamp = (typeof CAL_DB !== 'undefined' && CAL_DB[camp] && CAL_DB[camp].monitoreos) || [];
  if (!todosCamp.length) { el.innerHTML = ''; el.style.display = 'none'; return; }
  el.style.display = '';
  var pls = (typeof CAL_PLANTILLAS_TODAS !== 'undefined' ? CAL_PLANTILLAS_TODAS : []);
  var conteo = {};
  todosCamp.forEach(function (m) { var q = caPlantillaDe(m, pls); if (q) conteo[q.id] = (conteo[q.id] || 0) + 1; });
  var lista = pls.filter(function (q) { return q.campana === camp && conteo[q.id]; });
  var pl = lista.find(function (q) { return q.id === _cmpEstado[camp]; }) || lista.slice().sort(function (a, b) { return conteo[b.id] - conteo[a.id]; })[0] || null;
  var arr = pl ? todosCamp.filter(function (m) { var q = caPlantillaDe(m, pls); return q && q.id === pl.id; }) : todosCamp;
  var ve = _cmpVeAsesores(camp);
  _cmpCtx[camp] = { p: p, i: i, arr: arr, pl: pl, ve: ve };

  // Meses: los de MESES; con "Todos", el mes por defecto del HTML. Al cambiar MESES se vuelve a tomar.
  var hoy = _cmpHoyMes();
  // Solo los meses MARCADOS en MESES (_gdMeses; gdMesesTarjetasActual() devuelve todos con "Todos").
  var marcados = (typeof _gdMeses === 'function') ? _gdMeses().slice().sort() : [];
  var clave = marcados.join(',') || 'todos';
  var st = _cmpFiltro[camp];
  if (!st || st.clave !== clave) st = _cmpFiltro[camp] = { clave: clave, meses: marcados.length ? marcados : [ceMesPorDefecto(arr, hoy)], asesores: null, q: '' };
  var asesores = ve ? st.asesores : null;
  // Fase 290: Mes en "Ninguno" = Todos (los meses con monitoreos), igual que «Meses».
  var mesesEf = ceMesesEfectivos(st.meses, arr);
  var v = ceResultado(arr, { meses: mesesEf, asesores: asesores, plantilla: pl });
  var mesDesc = ceMesFiltroDesc(st.meses);
  var titulo = '<div class="aurora-card-title">Resultado de los monitoreos</div>';

  // Filtros y botones.
  var conDatos = ceMesesConDatos(arr);
  var opMeses = conDatos.concat([hoy], st.meses).filter(function (m, k, a) { return a.indexOf(m) === k; }).sort().reverse().map(function (m) {
    return { v: m, l: ceMesLabel(m), on: st.meses.indexOf(m) !== -1, sub: conDatos.indexOf(m) === -1 ? 'sin monitoreos' : '' };
  });
  var pickMes = _cmpPickHtml('cmp-mes-' + i, 'Mes', mesDesc, opMeses, false);
  var pickAs = '';
  if (ve) {
    var disp = ceAsesoresDe(arr, mesesEf);
    (st.asesores || []).forEach(function (a) { if (disp.indexOf(a) === -1) disp.push(a); });
    disp.sort();
    var qq = String(st.q || '').toLowerCase();
    var asDesc = st.asesores === null ? 'Todos' : !st.asesores.length ? 'Ninguno' : st.asesores.length === 1 ? textoFormatoNombre(st.asesores[0]) : st.asesores.length + ' asesores';
    pickAs = _cmpPickHtml('cmp-as-' + i, 'Asesor', asDesc, disp.map(function (a) {
      return { v: a, l: textoFormatoNombre(a), on: st.asesores === null || st.asesores.indexOf(a) !== -1, oculto: qq && String(a).toLowerCase().indexOf(qq) === -1 };
    }), true, st.q);
  }
  var selector = lista.length > 1 ? '<label class="ca-filtro">Plantilla <select onchange="_cmpElegir(\'' + esc(camp) + '\', this.value)">' + lista.map(function (q) {
    return '<option value="' + q.id + '"' + (pl && q.id === pl.id ? ' selected' : '') + '>' + esc(q.nombre) + '</option>';
  }).join('') + '</select></label>' : '';
  var cs = esc(camp);
  var botones = '<div class="cmp-botones">' +
    '<button type="button" class="btn-primary cmp-btn" data-camp="' + cs + '" onclick="_cmpDetalleMes(this.dataset.camp)">Detalle por mes</button>' +
    (ve ? '<button type="button" class="btn-cancel cmp-btn" data-camp="' + cs + '" onclick="_cmpResumenAsesor(this.dataset.camp)">Resumen por asesor</button>' : '') +
    (pl ? '<button type="button" class="btn-cancel cmp-btn" onclick="_cmpDiccionario(\'' + cs + '\',' + pl.id + ')">Diccionario</button>' : '') + '</div>';

  var k = v.kpis;
  var kpis = '<div class="ca-kpis cmp-kpis">' +
    '<div class="ca-kpi"><b>' + k.total + '</b><span>Monitoreos calificados</span></div>' +
    '<div class="ca-kpi"><b class="cc2-c-' + (k.promedio === null ? 'na' : k.clase.k) + '">' + cePct(k.promedio) + '</b><span>Promedio general</span></div>' +
    '<div class="ca-kpi"><b>' + k.critico + '</b><span>' + esc(k.criticoLabel) + '</span></div>' +
    '<div class="ca-kpi"><b>' + k.asesores + '</b><span>Asesores evaluados</span></div></div>';

  var vacio = function (t) { return '<p class="ca-vacio cmp-vacio">' + t + '</p>'; };
  var lineaAs = !ve ? '' : '<div class="aurora-card"><div class="aurora-card-title">Calificación definitiva por asesor · ' + esc(mesDesc) + '</div>' +
    (v.lineaAsesor.length ? '<div class="aurora-chart-wrap cmp-chart-as"><canvas id="cmp-c-as-' + i + '"></canvas></div>' + _cmpBandaHtml() : vacio('Sin monitoreos calificados en el periodo seleccionado.')) + '</div>';
  var porMes = '<div class="aurora-card"><div class="aurora-card-title">Calificación definitiva por mes</div>' +
    '<p class="cpl-ayuda">' + esc(st.asesores !== null && ve ? 'Calificación definitiva de ' + (st.asesores.length === 1 ? textoFormatoNombre(st.asesores[0]) : st.asesores.length + ' asesores') + ' en cada mes seleccionado' : 'Calificación definitiva del equipo en cada mes seleccionado') + '</p>' +
    (v.porMes.length ? '<div class="aurora-chart-wrap cmp-chart"><canvas id="cmp-c-mes-' + i + '"></canvas></div>' : vacio('Sin monitoreos calificados.')) + '</div>';
  var torta = '<div class="aurora-card"><div class="aurora-card-title">Monitoreos por clasificación</div>' +
    (v.total ? '<p class="cpl-ayuda">' + v.total + ' monitoreo' + (v.total === 1 ? '' : 's') + ' calificado' + (v.total === 1 ? '' : 's') + ' · ' + esc(mesDesc) + '</p>' +
      '<div class="cmp-torta"><div class="aurora-chart-wrap cmp-chart-pie"><canvas id="cmp-c-pie-' + i + '"></canvas></div><div class="cmp-pie-leg">' + v.torta.map(function (c) {
        return '<div><i class="cmp-dot cmp-dot-' + c.k + '" aria-hidden="true"></i><span>' + esc(c.t) + '<small>' + esc(c.rango) + '</small></span><b>' + c.n + ' · ' + cePct(c.pct) + '</b></div>';
      }).join('') + '</div></div>' : vacio('Sin monitoreos calificados en el periodo seleccionado.')) + '</div>';
  var tabla = !ve ? '' : '<div class="aurora-card"><div class="aurora-card-title">Resultado por asesor · ' + esc(mesDesc) + '</div><div style="overflow-x:auto"><table class="aurora-rank-table cmp-tabla"><tr><th>#</th><th>Asesor</th><th>Monit.</th><th>Calif. definitiva</th><th>Clasificación</th><th>' + esc(v.columnaFinal) + '</th></tr>' +
    (v.porAsesor.length ? v.porAsesor.map(function (a, n) {
      return '<tr><td>' + (n + 1) + '</td><td><b>' + esc(textoFormatoNombre(a.name)) + '</b></td><td>' + a.cnt + '</td><td>' + cePct(a.avg) + '</td><td>' + _caPill(a.clase) + '</td><td>' + a.final + '</td></tr>';
    }).join('') : '<tr><td colspan="6" class="ca-vacio">No hay monitoreos completos en el periodo seleccionado. Los asesores aparecen aquí cuando se registra su primer monitoreo del mes.</td></tr>') + '</table></div></div>';
  var items = '<div class="aurora-card"><div class="aurora-card-title">Ítems más afectados</div>' + (v.total && pl ? '<div class="ca-barras">' + v.items.map(function (x) {
    var cuerpo = '<span class="ca-bar-txt">' + esc(x.it.n + '. ' + x.it.label) + (x.it.critico ? ' ⚠' : '') + '</span><span class="ca-bar"><span class="' + (x.it.critico ? 'cmp-fill-c' : 'cmp-fill') + '" style="width:' + x.pct + '%"></span></span><span class="ca-bar-n">' + x.c + ' · ' + cePct(x.pct) + '</span>';
    if (!ve || !x.c) return '<div class="ca-bar-fila">' + cuerpo + '</div>';
    return '<details class="ca-bar-fila"><summary>' + cuerpo + '</summary><ul>' + x.asesores.map(function (a) { return '<li>' + esc(textoFormatoNombre(a.asesor)) + ' <span>(' + a.veces + ')</span></li>'; }).join('') + '</ul></details>';
  }).join('') + '</div>' : vacio('Sin datos en el rango seleccionado.')) + '</div>';
  var nota = '<p class="cpl-ayuda cmp-nota">Solo aparecen los asesores con monitoreos en el mes seleccionado: si un asesor no se monitorea en un mes, sale de la vista y de los promedios de ese mes, y vuelve a aparecer cuando se le registre un monitoreo. Solo se cuentan monitoreos con todos los ítems calificados. Escala: 0–69% Crítico · 70–89% No crítico · 90–100% Sobresaliente.</p>';

  // Llamadas con fallas: las del periodo y asesores elegidos.
  var fallas = v.monitoreos.filter(function (m) { return _caTieneNo(m); }).sort(function (a, b) { return String(b.fecha || '').localeCompare(String(a.fecha || '')) || b.id - a.id; });
  var CMP_LIMITE = 50;
  var verTodas = !!_cmpVerTodas[camp];
  var filasFallas = (verTodas ? fallas : fallas.slice(0, CMP_LIMITE)).map(function (m) {
    var c = caClase(Number(m.puntaje));
    return '<tr class="ca-click" tabindex="0" role="button" aria-label="Ver el detalle del monitoreo del ' + esc(m.fecha || '') + '" onclick="_cmpVer(\'' + cs + '\',' + m.id + ')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();_cmpVer(\'' + cs + '\',' + m.id + ')}">' +
      '<td>' + esc(m.fecha || '-') + '</td>' + (ve ? '<td><b>' + esc(textoFormatoNombre(m.asesor)) + '</b></td>' : '') + '<td>' + esc(m.idLlamada || '-') + '</td>' +
      '<td><span class="cc2-pill cc2-' + c.k + '">' + _caPct(m.puntaje) + '</span></td><td class="ca-mot">' + esc((m.extras && m.extras.motivo) || _cmpMotivo(m, pl)) + '</td></tr>';
  }).join('');
  var llamadas = '<div class="aurora-card"><div class="aurora-card-title">Llamadas con fallas (' + fallas.length + ')</div>' +
    (fallas.length ? '<p class="cpl-ayuda">Haz clic en una llamada para ver su detalle.</p><div style="overflow-x:auto"><table class="aurora-rank-table"><tr><th>Fecha</th>' + (ve ? '<th>Asesor</th>' : '') + '<th>ID llamada</th><th>Nota</th><th>Motivo de afectación</th></tr>' + filasFallas + '</table></div>' +
        (fallas.length > CMP_LIMITE && !verTodas ? '<button type="button" class="btn-cancel cmp-dicc" data-camp="' + cs + '" onclick="_cmpMostrarTodas(this.dataset.camp)">Ver todas (' + fallas.length + ')</button>' : '')
      : '<p class="ca-vacio">Ninguna llamada con fallas en el periodo seleccionado.</p>') + '</div>';

  el.innerHTML =
    '<div class="aurora-card cmp-cab" data-cmp-camp="' + cs + '">' + titulo +
      '<p class="cpl-ayuda">Asesores vigentes: solo aparecen quienes tienen monitoreos en los meses seleccionados.</p>' +
      '<div class="cmp-filtros">' + selector + pickMes + pickAs + botones + '</div>' + kpis + '</div>' +
    lineaAs +
    '<div class="cmp-duo">' + porMes + torta + '</div>' +
    '<div class="cmp-duo">' + tabla + items + '</div>' + nota + llamadas;
  _cmpGraficas(v, i, ve);
}

// Banda de umbrales debajo de la linea por asesor (como las lineas punteadas del HTML).
function _cmpBandaHtml() {
  return '<div class="cmp-banda" aria-hidden="true"><span><i class="cmp-dot cmp-dot-ok"></i>90% Sobresaliente</span><span><i class="cmp-dot cmp-dot-warn"></i>70–89% No crítico</span><span><i class="cmp-dot cmp-dot-bad"></i>&lt;70% Crítico</span></div>';
}
// Linea de % (0 a 110, marcas cada 20) con las referencias de 70 y 90 punteadas.
function _cmpLinea(canvasId, cats, vals, cnts) {
  if (typeof _gdChart !== 'function' || typeof lo !== 'function') return;
  var o = lo(null, 40);
  o.plugins.legend = { display: false };
  // % sobre cada punto solo si cabe (al menos 38 px por punto); si no, en el tooltip.
  o.plugins.datalabels.display = function (ctx) { return ctx.datasetIndex === 0 && ctx.chart.width / Math.max(1, cats.length) >= 38; };
  o.plugins.datalabels.formatter = function (x) { return cePct(x); };
  o.plugins.tooltip = { filter: function (it) { return it.datasetIndex === 0; }, callbacks: { label: function (ctx) {
    var x = ctx.parsed.y; return cePct(x) + ' · ' + ceClase(x).t + ' · ' + cnts[ctx.dataIndex] + ' monitoreo' + (cnts[ctx.dataIndex] === 1 ? '' : 's');
  } } };
  o.layout = { padding: { top: 22, right: 28, left: 6 } }; // etiqueta del primer y del ultimo punto sin cortarse
  o.plugins.datalabels.clamp = true;
  o.scales.x.ticks.autoSkip = false; // todos los nombres, como el HTML (inclinados si no caben)
  o.scales.x.offset = true; // cada punto en el centro de su espacio, como el HTML (X = (i + 0,5) / n)
  o.scales.y.min = 0; o.scales.y.max = 110;
  o.scales.y.ticks.stepSize = 20;
  o.scales.y.ticks.callback = function (x) { return x <= 100 ? x + '%' : ''; };
  var ref = function (valor, color) { return { data: cats.map(function () { return valor; }), borderColor: color, borderWidth: 1, borderDash: [2, 4], pointRadius: 0, pointHoverRadius: 0, fill: false }; };
  _gdChart(canvasId, { type: 'line', data: { labels: cats, datasets: [
    { label: 'Calificación definitiva', data: vals.map(function (x) { return Math.round(x * 10) / 10; }), borderColor: CM, backgroundColor: CM, borderWidth: 2.5, tension: 0, pointRadius: 4.5, pointBackgroundColor: CHART_DL_BG, pointBorderWidth: 2 },
    ref(90, CG), ref(70, CR)] }, options: o });
}
function _cmpGraficas(v, i, ve) {
  if (ve && v.lineaAsesor.length) _cmpLinea('cmp-c-as-' + i, v.lineaAsesor.map(function (a) { return textoFormatoNombre(a.name); }), v.lineaAsesor.map(function (a) { return a.avg; }), v.lineaAsesor.map(function (a) { return a.cnt; }));
  if (v.porMes.length) _cmpLinea('cmp-c-mes-' + i, v.porMes.map(function (x) { return x.label; }), v.porMes.map(function (x) { return x.avg; }), v.porMes.map(function (x) { return x.monitoreos; }));
  if (v.total && typeof _gdChart === 'function' && typeof loPie === 'function') {
    var o = loPie(null);
    o.plugins.legend = { display: false };
    _gdChart('cmp-c-pie-' + i, { type: 'pie', data: { labels: v.torta.map(function (c) { return c.t + ' (' + c.rango + ')'; }), datasets: [{ data: v.torta.map(function (c) { return c.n; }), backgroundColor: [CG, CO, CR], borderColor: CHART_DL_BG, borderWidth: 2 }] }, options: o });
  }
}

// Cambios en los filtros (un solo manejador, sin onclick por casilla).
document.addEventListener('change', function (e) {
  var cb = e.target; if (!cb || cb.type !== 'checkbox' || !cb.closest) return;
  var pick = cb.closest('.cmp-pick'); if (!pick) return;
  var cab = pick.closest('[data-cmp-camp]'); if (!cab) return;
  var camp = cab.getAttribute('data-cmp-camp'), st = _cmpFiltro[camp]; if (!st) return;
  var marcadas = Array.prototype.filter.call(pick.querySelectorAll('.cmp-pick-l input[type="checkbox"]'), function (x) { return x.checked; }).map(function (x) { return x.value; });
  if (pick.id.indexOf('cmp-mes-') === 0) { st.meses = marcadas.sort(); }
  else {
    var todas = pick.querySelectorAll('.cmp-pick-l input[type="checkbox"]').length;
    st.asesores = marcadas.length === todas ? null : marcadas;
  }
  _cmpRepintar(camp, pick.id);
});
// Buscador del filtro Asesor: solo oculta opciones (no cambia la seleccion).
document.addEventListener('input', function (e) {
  var q = e.target; if (!q || !q.hasAttribute || !q.hasAttribute('data-cmp-q')) return;
  var cab = q.closest('[data-cmp-camp]'); if (!cab) return;
  var st = _cmpFiltro[cab.getAttribute('data-cmp-camp')]; if (st) st.q = q.value;
  var t = q.value.trim().toLowerCase();
  Array.prototype.forEach.call(q.closest('.cmp-pick').querySelectorAll('.cmp-pick-l label'), function (l) { l.hidden = !!t && l.textContent.toLowerCase().indexOf(t) === -1; });
});
// Un filtro abierto se cierra al hacer clic afuera.
document.addEventListener('click', function (e) {
  // Un boton que el repintado ya saco del documento (Marcar todo / Ninguno) no cuenta como clic afuera.
  if (!e.target || !e.target.isConnected) return;
  Array.prototype.forEach.call(document.querySelectorAll('.cmp-pick[open]'), function (d) { if (!d.contains(e.target)) d.open = false; });
});

// "Detalle por mes" y "Resumen por asesor" del HTML, en el dialogo del panel.
var _cmpDlg = { mes: null, q: '', camp: null, vista: null };
function _cmpMesSelect(meses, actual, onchange) {
  return '<label class="ca-filtro">Mes <select onchange="' + onchange + '(this.value)">' + meses.map(function (m) {
    return '<option value="' + esc(m) + '"' + (m === actual ? ' selected' : '') + '>' + esc(ceMesLabel(m)) + '</option>';
  }).join('') + '<option value="all"' + (actual === 'all' ? ' selected' : '') + '>Todos los meses</option></select></label>';
}
function _cmpDetalleMes(camp, mes, texto) {
  var c = _cmpCtx[camp]; if (!c) return;
  var meses = ceMesesDetalle(c.arr);
  var hoy = _cmpHoyMes();
  _cmpDlg = { camp: camp, vista: 'detalle', q: texto !== undefined ? texto : '', mes: mes || (meses.indexOf(hoy) !== -1 ? hoy : (meses[0] || 'all')) };
  _cmpAbrir('Detalle por mes', '<div id="cmp-dlg-cuerpo"></div>');
  _cmpPintarDetalle();
}
function _cmpPintarDetalle(enfocarBuscar) {
  var c = _cmpCtx[_cmpDlg.camp]; var host = document.getElementById('cmp-dlg-cuerpo'); if (!c || !host) return;
  var d = ceDetalleMes(c.arr, _cmpDlg.mes, c.ve ? _cmpDlg.q : '');
  var cs = esc(_cmpDlg.camp);
  host.innerHTML = '<div class="ca-filtros">' + _cmpMesSelect(ceMesesDetalle(c.arr), _cmpDlg.mes, '_cmpDetalleCambiaMes') +
      (c.ve ? '<label class="ca-filtro">Asesor <input type="search" id="cmp-dlg-q" placeholder="Buscar por nombre del asesor" value="' + esc(_cmpDlg.q) + '" oninput="_cmpDlg.q=this.value;_cmpPintarDetalle(true)"></label>' : '') + '</div>' +
    '<div class="ca-kpis"><div class="ca-kpi"><b>' + d.total + '</b><span>Monitoreos</span></div>' +
      '<div class="ca-kpi"><b class="cc2-c-' + (d.promedio === null ? 'na' : d.clase.k) + '">' + cePct(d.promedio) + '</b><span>Calificación definitiva</span></div>' +
      '<div class="ca-kpi"><b>' + esc(d.promedio === null ? '—' : d.clase.t) + '</b><span>Clasificación</span></div>' +
      '<div class="ca-kpi"><b>' + d.incompletos + '</b><span>Incompletos</span></div></div>' +
    '<p class="cpl-ayuda">Monitoreos · ' + esc(ceMesLabel(_cmpDlg.mes)) + (_cmpDlg.q && c.ve ? ' · ' + esc(_cmpDlg.q.trim()) : '') + '. Toca un monitoreo para ver la plantilla completa.</p>' +
    '<div style="overflow-x:auto"><table class="aurora-rank-table"><tr><th>Fecha</th>' + (c.ve ? '<th>Asesor</th>' : '') + '<th>ID llamada</th><th>Código gestión</th><th>Evaluador</th><th>Calificación</th><th>Motivo de afectación</th></tr>' +
      (d.lista.length ? d.lista.map(function (m) {
        var k = ceClase(m.puntaje === null || m.puntaje === undefined ? null : Number(m.puntaje));
        return '<tr class="ca-click" tabindex="0" role="button" onclick="_cmpVer(\'' + cs + '\',' + m.id + ')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();_cmpVer(\'' + cs + '\',' + m.id + ')}">' +
          '<td>' + esc(m.fecha || '-') + '</td>' + (c.ve ? '<td><b>' + esc(textoFormatoNombre(m.asesor)) + '</b></td>' : '') + '<td>' + esc(m.idLlamada || '-') + '</td><td>' + esc(m.codificacion || '-') + '</td><td>' + esc(m.evaluador || '-') + '</td>' +
          '<td><span class="cc2-pill cc2-' + k.k + '">' + (m.puntaje === null || m.puntaje === undefined ? 'Incompleto' : cePct(Number(m.puntaje))) + '</span></td><td class="ca-mot">' + esc((m.extras && m.extras.motivo) || _cmpMotivo(m, c.pl) || (m.puntaje === null || m.puntaje === undefined ? '' : 'Sin afectaciones')) + '</td></tr>';
      }).join('') : '<tr><td colspan="7" class="ca-vacio">' + (_cmpDlg.q ? 'Ningún monitoreo de ese asesor en este mes.' : 'Sin monitoreos en este mes.') + '</td></tr>') + '</table></div>';
  if (enfocarBuscar) { var q = document.getElementById('cmp-dlg-q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
}
function _cmpDetalleCambiaMes(v) { _cmpDlg.mes = v; _cmpPintarDetalle(); }
function _cmpResumenAsesor(camp) {
  var c = _cmpCtx[camp]; if (!c || !c.ve) return;
  var meses = ceMesesConDatos(c.arr);
  var hoy = _cmpHoyMes();
  _cmpDlg = { camp: camp, vista: 'resumen', q: '', mes: meses.indexOf(hoy) !== -1 ? hoy : (meses[0] || 'all') };
  _cmpAbrir('Resumen por asesor' + (c.pl ? ' · ' + c.pl.nombre : ''), '<div id="cmp-dlg-cuerpo"></div>');
  _cmpPintarResumen();
}
function _cmpPintarResumen(enfocarBuscar) {
  var c = _cmpCtx[_cmpDlg.camp]; var host = document.getElementById('cmp-dlg-cuerpo'); if (!c || !host) return;
  var filas = ceResumenAsesores(c.arr, _cmpDlg.mes, _cmpDlg.q, c.pl && c.pl.items);
  host.innerHTML = '<div class="ca-filtros">' + _cmpMesSelect(ceMesesConDatos(c.arr), _cmpDlg.mes, '_cmpResumenCambiaMes') +
      '<label class="ca-filtro">Asesor <input type="search" id="cmp-dlg-q" placeholder="Buscar asesor" value="' + esc(_cmpDlg.q) + '" oninput="_cmpDlg.q=this.value;_cmpPintarResumen(true)"></label></div>' +
    '<p class="cpl-ayuda">' + filas.length + ' asesor' + (filas.length === 1 ? '' : 'es') + ' · ' + esc(ceMesLabel(_cmpDlg.mes)) + '</p>' +
    '<div style="overflow-x:auto"><table class="aurora-rank-table"><tr><th>#</th><th>Nombre del asesor</th><th># Monitoreos</th><th>Prom. puntaje</th><th>Clasificación</th><th>Alerta críticos</th><th>Total fallos críticos</th></tr>' +
      (filas.length ? filas.map(function (a, n) {
        return '<tr class="ca-click" tabindex="0" role="button" data-a="' + esc(a.name) + '" onclick="_cmpDeResumenADetalle(this.dataset.a)" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();_cmpDeResumenADetalle(this.dataset.a)}">' +
          '<td>' + (n + 1) + '</td><td><b>' + esc(textoFormatoNombre(a.name)) + '</b></td><td>' + a.cnt + '</td><td>' + cePct(a.avg) + '</td><td>' + _caPill(a.clase) + '</td><td>' + _caPill(a.alerta) + '</td><td>' + a.fallos + '</td></tr>';
      }).join('') : '<tr><td colspan="7" class="ca-vacio">' + (_cmpDlg.q ? 'Ningún asesor coincide con la búsqueda.' : 'Sin monitoreos completos en este periodo.') + '</td></tr>') + '</table></div>' +
    '<p class="cpl-ayuda">Se calcula automáticamente con los monitoreos completos de la plantilla. Alerta críticos: 0 fallos = sin fallos · 1 = alerta · 2 o más = crítico frecuente. Toca un asesor para ver sus monitoreos.</p>';
  if (enfocarBuscar) { var q = document.getElementById('cmp-dlg-q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
}
function _cmpResumenCambiaMes(v) { _cmpDlg.mes = v; _cmpPintarResumen(); }
function _cmpDeResumenADetalle(nombre) { var camp = _cmpDlg.camp, mes = _cmpDlg.mes; _cmpDetalleMes(camp, mes, nombre); }

// Motivo para monitoreos viejos (sin extras): los items en NO de su plantilla.
function _cmpMotivo(m, pl) {
  var items = (pl && pl.items) || [];
  return items.filter(function (it) { return (m.answers || {})[it.n] === 'NO'; }).map(function (it) { return it.n + '. ' + it.label; }).join(' · ');
}

// Dialogo propio dentro del tablero (#gd-overlay deja inerte todo lo de afuera).
function _cmpDialogo() {
  var ov = document.getElementById('cmp-ov');
  if (!ov) {
    ov = document.createElement('div');
    ov.className = 'cc2-ov'; ov.id = 'cmp-ov'; ov.hidden = true;
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'cmp-ov-t');
    ov.innerHTML = '<div class="cc2-dlg ca-dlg-ancho"><h3 id="cmp-ov-t"></h3><div id="cmp-ov-b"></div><div class="modal-btns"><button type="button" class="btn-primary" onclick="_cmpCerrar()">Cerrar</button></div></div>';
    ov.addEventListener('click', function (e) { if (e.target === ov) _cmpCerrar(); });
  }
  var host = document.getElementById('gd-overlay') || document.body;
  if (ov.parentNode !== host) host.appendChild(ov);
  return ov;
}
var _cmpFoco = null;
function _cmpAbrir(titulo, html) {
  var ov = _cmpDialogo();
  if (ov.hidden) _cmpFoco = document.activeElement; // dentro del dialogo (Detalle por mes -> monitoreo) se conserva el de afuera
  document.getElementById('cmp-ov-t').textContent = titulo;
  document.getElementById('cmp-ov-b').innerHTML = html;
  ov.hidden = false;
  ov.querySelector('.modal-btns button').focus();
}
var _cmpVolverA = null; // Fase 274: detalle abierto desde "Detalle por mes" -> al cerrar, se vuelve a la lista
function _cmpCerrar() {
  if (_cmpVolverA) { var v = _cmpVolverA; _cmpVolverA = null; _cmpDetalleMes(v.camp, v.mes, v.q); return; }
  var ov = document.getElementById('cmp-ov'); if (ov) ov.hidden = true;
  if (_cmpFoco && _cmpFoco.focus) _cmpFoco.focus();
}
document.addEventListener('keydown', function (e) {
  var ov = document.getElementById('cmp-ov');
  if (e.key === 'Escape' && ov && !ov.hidden) { e.stopPropagation(); _cmpCerrar(); }
}, true);
function _cmpVer(camp, id) {
  var m = ((CAL_DB[camp] || {}).monitoreos || []).find(function (x) { return x.id === id; });
  if (!m) return;
  var pls = (typeof CAL_PLANTILLAS_TODAS !== 'undefined' ? CAL_PLANTILLAS_TODAS : []);
  var copia = Object.assign({}, m);
  if (!_cmpVeAsesores(camp)) copia.asesor = '';
  var ov = document.getElementById('cmp-ov');
  _cmpVolverA = (ov && !ov.hidden && _cmpDlg.vista === 'detalle' && document.getElementById('cmp-dlg-cuerpo')) ? { camp: _cmpDlg.camp, mes: _cmpDlg.mes, q: _cmpDlg.q } : null;
  _cmpAbrir('Detalle del monitoreo · ' + (m.fecha || ''), caDetalleHtml(copia, caPlantillaDe(m, pls)));
}
// Fase 279 (pedido de Edwin, 06/11): el Diccionario es el de la plantilla con la
// que se califica HOY (la principal y activa de la campaña), aunque los
// monitoreos del periodo se hayan hecho con una anterior; sin principal, la de
// los monitoreos. Antes abria la de los monitoreos (en Mobilize, la vieja de 10
// items en vez de la de 14).
function cmpPlantillaDiccionario(camp, plId, pls) {
  var lista = pls || [];
  return lista.find(function (q) { return q.campana === camp && q.principal && q.activo !== false; }) ||
    lista.find(function (q) { return q.id === plId; }) || null;
}
// Diccionario como el del HTML de Edwin (buildDict, modelo "weighted"): las 4
// reglas, una tarjeta por item EN ORDEN (sin agrupar por categoria) con su peso
// en la etiqueta, la categoria debajo, la descripcion y el impacto en la nota.
// Una plantilla de descuento (motor sura) sigue con el diccionario de siempre.
function cmpDiccionarioHtml(p) {
  if (!p) return '<p class="ca-vacio">Esta campaña no tiene plantilla.</p>';
  if (p.motor === 'sura' && typeof caDiccionarioHtml === 'function') return caDiccionarioHtml(p);
  // Fase 322: motor descuento (SURA): reglas e impacto por respuesta (cada opción con su %).
  if ((p.engine || p.motor) === 'descuento' && typeof caDiccionarioHtml === 'function') return caDiccionarioHtml(Object.assign({}, p, { engine: 'descuento' }));
  var items = (p.items || []).slice().sort(function (a, b) { return a.n - b.n; });
  var crit = items.filter(function (it) { return it.critico; }).length;
  var reglas = '<div class="ca-reglas cmp-reglas">' +
    '<span><b>' + items.length + ' ítems</b> · ' + crit + ' críticos · los pesos suman 100%</span>' +
    '<span><span class="cc2-pill cc2-bad">⚠ Crítico</span> NO resta 20 pts</span>' +
    '<span>SI o N/A suman el peso del ítem · NO en no crítico pierde su peso</span>' +
    '<span>1 crítico fallado = Alerta · 2 o más = Crítico absoluto</span></div>';
  return reglas + '<div class="cmp-dicc-lista">' + items.map(function (it) {
    var w = Number(it.weight) || 0;
    var etiqueta = it.critico
      ? '<span class="cc2-pill cc2-bad">⚠ Crítico · peso ' + esc(w) + '% · NO = −20 pts</span>'
      : '<span class="cc2-pill">Peso ' + esc(w) + '% · NO = −' + esc(w) + ' pts</span>';
    var na = it.admiteNA === false ? 'No aplica' : '+' + w;
    return '<article class="ca-dcard cmp-dcard"><div><h5><span class="cc2-num">' + esc(it.n) + '</span> ' + esc(it.label) + ' ' + etiqueta + '</h5>' +
      (it.cat ? '<p class="cmp-dcat">' + esc(it.cat) + '</p>' : '') +
      (it.descripcion ? '<p>' + esc(it.descripcion) + '</p>' : '<p class="ca-vacio">Sin descripción.</p>') +
      (it.vinetas && it.vinetas.length ? '<ul>' + it.vinetas.map(function (v) { return '<li>' + esc(v) + '</li>'; }).join('') + '</ul>' : '') + '</div>' +
      '<div class="ca-imp"><span class="cc2-tag">Impacto en nota</span><div><span>SI</span><span>+' + esc(w) + '</span></div><div><span>N/A</span><span>' + esc(na) + '</span></div>' +
      '<div><span>NO</span><span>' + esc(it.critico ? String(w - 20) : '0') + '</span></div></div></article>';
  }).join('') + '</div>';
}
function _cmpDiccionario(camp, plId) {
  var pls = (typeof CAL_PLANTILLAS_TODAS !== 'undefined' ? CAL_PLANTILLAS_TODAS : []);
  var pl = cmpPlantillaDiccionario(camp, plId, pls);
  if (pl) _cmpAbrir('Diccionario de criterios · ' + pl.nombre, cmpDiccionarioHtml(pl));
}
