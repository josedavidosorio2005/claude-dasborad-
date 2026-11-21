// orlant-sta-dashboard.js — Fase STA (parte 2, usuario 21/11/2026): las gráficas de «Gestión STA»
// dentro del Dashboard de ORLANT, pestaña «Gestión de la base STA» (panel sta_resumen_panel).
// Es lo que ve el CLIENTE de ORLANT (que no tiene la tarjeta «Gestión STA»); también el
// supervisor de ORLANT y los administrativos. Lee GET /api/orlant/sta/resumen, que solo trae
// agregados (ningún número de autorización, paciente ni asesor). Toda la base: no depende de «Meses».
'use strict';

// ── Lógica pura (se prueba en Node) ──
var STA_RES_PARTES = [['gestionado', 'Gestionados'], ['pendiente', 'Pendientes en bandejas'], ['sinAsignar', 'Sin asignar']];

function _staResNum(n) { return Number(n || 0).toLocaleString('es-CO'); }

// Indicadores de arriba, en el mismo orden que la pestaña Gráficas del HTML de Edwin.
function staResumenKpis(r) {
  r = r || {};
  return [
    { k: 'total', l: 'Casos en la base', v: _staResNum(r.total) },
    { k: 'gestionados', l: 'Gestionados', v: _staResNum(r.gestionados) },
    { k: 'agendas', l: 'Agendas (efectivas)', v: _staResNum(r.agendas) },
    { k: 'citas', l: 'Citas agendadas', v: _staResNum(r.citas) },
    { k: 'efectividad', l: 'Efectividad (citas ÷ gestiones)', v: String(r.efectividad || 0).replace('.', ',') + ' %' },
    { k: 'pendientes', l: 'Pendientes en bandejas', v: _staResNum(r.pendientes) },
    { k: 'sinAsignar', l: 'Sin asignar', v: _staResNum(r.sinAsignar) },
  ];
}

// {categoria: {gestionado, pendiente, sinAsignar}} -> filas ordenadas por total (desc); las que
// pasan de `max` se juntan en «Otros».
function staResumenCategorias(mapa, max) {
  max = max || 10;
  var filas = Object.keys(mapa || {}).map(function (k) {
    var x = mapa[k] || {};
    var f = { nombre: k, gestionado: x.gestionado || 0, pendiente: x.pendiente || 0, sinAsignar: x.sinAsignar || 0 };
    f.total = f.gestionado + f.pendiente + f.sinAsignar;
    return f;
  }).sort(function (a, b) { return b.total - a.total || a.nombre.localeCompare(b.nombre, 'es'); });
  if (filas.length > max + 1) {
    var resto = filas.slice(max);
    var otros = { nombre: 'Otros', gestionado: 0, pendiente: 0, sinAsignar: 0, total: 0 };
    resto.forEach(function (f) { otros.gestionado += f.gestionado; otros.pendiente += f.pendiente; otros.sinAsignar += f.sinAsignar; otros.total += f.total; });
    filas = filas.slice(0, max).concat([otros]);
  }
  return filas;
}

function staResumenTipis(porTipi) {
  return Object.keys(porTipi || {}).map(function (k) { return { nombre: k, n: porTipi[k] || 0 }; })
    .sort(function (a, b) { return b.n - a.n || a.nombre.localeCompare(b.nombre, 'es'); });
}

function staResumenDias(porDia) {
  return Object.keys(porDia || {}).sort().map(function (d) { var x = porDia[d] || {}; return { dia: d, gestiones: x.gestiones || 0, citas: x.citas || 0 }; });
}

// Filas para «Exportar» (solo agregados).
function staResumenFilasExport(r) {
  var out = [{ titulo: 'Gestión de la base STA · indicadores', tipo: 'tabla', filas: staResumenKpis(r).map(function (k) { return { Indicador: k.l, Valor: k.v }; }) }];
  var cat = function (titulo, mapa) {
    var f = staResumenCategorias(mapa, 1000);
    if (f.length) out.push({ titulo: titulo, tipo: 'tabla', filas: f.map(function (x) { return { Categoria: x.nombre, Gestionados: x.gestionado, Pendientes: x.pendiente, 'Sin asignar': x.sinAsignar, Total: x.total }; }) });
  };
  var t = staResumenTipis(r && r.porTipi);
  if (t.length) out.push({ titulo: 'Gestiones por tipificación', tipo: 'tabla', filas: t.map(function (x) { return { Tipificacion: x.nombre, Gestiones: x.n }; }) });
  var d = staResumenDias(r && r.porDia);
  if (d.length) out.push({ titulo: 'Gestiones y citas por día', tipo: 'tabla', filas: d.map(function (x) { return { Dia: x.dia, Gestiones: x.gestiones, Citas: x.citas }; }) });
  cat('Casos por entidad', r && r.porEntidad);
  cat('Casos por servicio', r && r.porServicio);
  cat('Casos por estado de la base', r && r.porEstado);
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { staResumenKpis: staResumenKpis, staResumenCategorias: staResumenCategorias, staResumenTipis: staResumenTipis, staResumenDias: staResumenDias, staResumenFilasExport: staResumenFilasExport };
}

// ── Navegador ──
var _staRes = { datos: null };

function _staResCargar() {
  return apiRequest('GET', '/orlant/sta/resumen').then(function (r) { _staRes.datos = r; return r; });
}

// Al abrir el tablero: si la base STA tiene casos, se destapa la pestaña (en memoria).
function staResumenDestapar(tabs) {
  return _staResCargar().then(function (r) {
    if (r && r.total > 0) { var t = (tabs || []).find(function (x) { return x.key === 'sta_gestion'; }); if (t) t.oculta = false; }
    return [];
  }).catch(function () { return []; });
}

function _staResCard(titulo, id, alto) {
  return '<div class="aurora-card"><div class="aurora-card-title">' + esc(titulo) + '</div>' +
    '<div class="aurora-chart-wrap" style="height:' + alto + 'px"><canvas id="' + id + '"></canvas></div></div>';
}

function _staResHorizontal(o) {
  o.indexAxis = 'y';
  var x = o.scales.x, y = o.scales.y;
  o.scales.x = { grid: { color: CHART_GRID }, ticks: { font: { size: 12 }, color: CHART_TICK, precision: 0 }, beginAtZero: true };
  o.scales.y = { grid: { display: false }, ticks: { font: { size: 12 }, color: CHART_TICK, autoSkip: false, callback: function (v) { var s = this.getLabelForValue(v); return s && s.length > 28 ? s.slice(0, 27) + '…' : s; } } };
  void x; void y;
  return o;
}

async function _staResumenRenderPanel(p, i) {
  var host = document.getElementById('gd-p' + i); if (!host) return;
  host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">' + esc(p.titulo || 'Gestión de la base STA') + '</div><div class="loading-state"><span class="spinner" aria-hidden="true"></span>Cargando…</div></div>';
  var r = null;
  try { r = await _staResCargar(); } catch (e) { r = null; }
  if (!document.getElementById('gd-p' + i)) return;
  if (!r) { host.innerHTML = '<div class="aurora-card"><div class="gd-vacio" role="status">No se pudo leer la base STA.</div></div>'; return; }
  var kpis = staResumenKpis(r).map(function (k) { return '<div class="aurora-kpi"><div class="kv">' + esc(k.v) + '</div><div class="kl">' + esc(k.l) + '</div></div>'; }).join('');
  var cab = '<div class="aurora-card sta-res-cab"><div class="aurora-card-title">' + esc(p.titulo || 'Gestión de la base STA') + '</div>' +
    '<p class="sta-res-nota">Toda la base STA cargada (no depende de «Meses»). ' +
    (r.efectivas && r.efectivas.length ? 'Tipificaciones efectivas: ' + esc(r.efectivas.join(', ')) + '.' : 'No hay tipificaciones marcadas como efectivas.') + '</p>' +
    '<div class="aurora-kpis">' + kpis + '</div></div>';
  if (!r.total) { host.innerHTML = cab + '<div class="aurora-card"><div class="gd-vacio" role="status">Todavía no hay casos en la base STA.</div></div>'; return; }
  var tipis = staResumenTipis(r.porTipi), dias = staResumenDias(r.porDia);
  var ent = staResumenCategorias(r.porEntidad, 10), serv = staResumenCategorias(r.porServicio, 10), est = staResumenCategorias(r.porEstado, 10);
  var altoH = function (n) { return Math.max(180, 50 + n * 30); };
  host.innerHTML = cab + '<div class="aurora-grid-2 sta-res-grid">' +
    _staResCard('Avance de la base', 'sta-res-avance-' + i, 260) +
    _staResCard('Gestiones y citas por día', 'sta-res-dias-' + i, 260) +
    _staResCard('Gestiones por tipificación', 'sta-res-tipis-' + i, altoH(tipis.length || 1)) +
    _staResCard('Casos por estado de la base', 'sta-res-estado-' + i, altoH(est.length)) +
    _staResCard('Casos por entidad', 'sta-res-entidad-' + i, altoH(ent.length)) +
    _staResCard('Casos por servicio', 'sta-res-servicio-' + i, altoH(serv.length)) +
    '</div>';
  if (typeof _gdChart !== 'function' || typeof lo !== 'function') return;
  var colores = [PC[0], PC[1], PC[2]];
  // 1. Avance (dona)
  var oD = typeof loPie === 'function' ? loPie() : lo();
  _gdChart('sta-res-avance-' + i, { type: 'doughnut', data: { labels: STA_RES_PARTES.map(function (x) { return x[1]; }),
    datasets: [{ data: [r.gestionados, r.pendientes, r.sinAsignar], backgroundColor: colores }] }, options: typeof loDatalabelsAuto === 'function' ? loDatalabelsAuto(oD) : oD });
  // 2. Por día (líneas)
  var oL = lo(null, 50);
  oL.scales.y.beginAtZero = true; oL.scales.y.ticks.precision = 0;
  var dm = function (s) { return s.slice(8, 10) + '/' + s.slice(5, 7); };
  _gdChart('sta-res-dias-' + i, { type: 'line', data: { labels: dias.map(function (d) { return dm(d.dia); }), datasets: [
    { label: 'Gestiones', data: dias.map(function (d) { return d.gestiones; }), borderColor: PC[0], backgroundColor: PC[0], borderWidth: 2.5, tension: 0, pointRadius: 4, pointBackgroundColor: CHART_DL_BG, pointBorderWidth: 2 },
    { label: 'Citas', data: dias.map(function (d) { return d.citas; }), borderColor: PC[3] || PC[1], backgroundColor: PC[3] || PC[1], borderWidth: 2.5, tension: 0, pointRadius: 4, pointBackgroundColor: CHART_DL_BG, pointBorderWidth: 2 },
  ] }, options: oL });
  // 3. Tipificaciones (barras horizontales)
  var oT = _staResHorizontal(lo());
  oT.plugins.legend = { display: false };
  oT.plugins.datalabels.align = 'end'; oT.plugins.datalabels.anchor = 'end';
  oT.layout = { padding: { right: 36 } };
  _gdChart('sta-res-tipis-' + i, { type: 'bar', data: { labels: tipis.map(function (t) { return t.nombre; }),
    datasets: [{ label: 'Gestiones', data: tipis.map(function (t) { return t.n; }), backgroundColor: PC[0], borderRadius: 4 }] }, options: oT });
  // 4–6. Por estado, entidad y servicio (barras apiladas: gestionados, pendientes, sin asignar)
  var apiladas = function (id, filas) {
    var o = _staResHorizontal(lo());
    o.scales.x.stacked = true; o.scales.y.stacked = true;
    o.plugins.datalabels.align = 'center'; o.plugins.datalabels.anchor = 'center';
    o.plugins.datalabels.formatter = function (v) { return v ? v : ''; };
    _gdChart(id, { type: 'bar', data: { labels: filas.map(function (f) { return f.nombre || '(vacío)'; }),
      datasets: STA_RES_PARTES.map(function (x, k) { return { label: x[1], data: filas.map(function (f) { return f[x[0]]; }), backgroundColor: colores[k], borderRadius: 2 }; }) }, options: o });
  };
  apiladas('sta-res-estado-' + i, est);
  apiladas('sta-res-entidad-' + i, ent);
  apiladas('sta-res-servicio-' + i, serv);
}

async function _gdExportarStaResumen() {
  var r = _staRes.datos;
  if (!r) { try { r = await _staResCargar(); } catch (e) { r = null; } }
  if (!r || !r.total) return [{ titulo: 'Gestión de la base STA', tipo: 'aviso', filas: [], mensaje: 'Todavía no hay casos en la base STA.' }];
  return staResumenFilasExport(r);
}
