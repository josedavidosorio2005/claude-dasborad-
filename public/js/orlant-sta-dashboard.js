// orlant-sta-dashboard.js — Fase STA (parte 2, usuario 21/11/2026): las gráficas de «Gestión STA»
// dentro del Dashboard de ORLANT, pestaña «Gestión de la base STA» (panel sta_resumen_panel).
// Desde el 23/11 (pedido de Edwin) el panel monta la visual de «Gráficas» de Edwin (orlant-sta.js,
// staMontarCliente); el resumen de agregados sigue para destapar la pestaña y para «Exportar».
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

// Pedido de Edwin (23/11/2026): la MISMA visual de «Gráficas» del panel de Gestión STA (el código de
// Edwin: agendas por asesor, codificación general, efectividad por asesor, gestiones por día y análisis
// por campos de la base), de solo lectura, con sus filtros. Antes eran gráficas propias más simples.
async function _staResumenRenderPanel(p, i) {
  var host = document.getElementById('gd-p' + i); if (!host) return;
  host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">' + esc(p.titulo || 'Gestión de la base STA') + '</div><div class="loading-state"><span class="spinner" aria-hidden="true"></span>Cargando…</div></div>';
  if (typeof staMontarCliente !== 'function' || typeof staCrearApp !== 'function') {
    host.innerHTML = '<div class="aurora-card"><div class="gd-vacio" role="status">No se pudo abrir la visual de Gestión STA.</div></div>';
    return;
  }
  var cont = document.createElement('div');
  cont.className = 'sta-res-app';
  try {
    host.innerHTML = '';
    host.appendChild(cont);
    await staMontarCliente(cont);
  } catch (e) {
    if (document.getElementById('gd-p' + i)) host.innerHTML = '<div class="aurora-card"><div class="gd-vacio" role="status">No se pudo leer la base STA.</div></div>';
  }
}

async function _gdExportarStaResumen() {
  var r = _staRes.datos;
  if (!r) { try { r = await _staResCargar(); } catch (e) { r = null; } }
  if (!r || !r.total) return [{ titulo: 'Gestión de la base STA', tipo: 'aviso', filas: [], mensaje: 'Todavía no hay casos en la base STA.' }];
  return staResumenFilasExport(r);
}
