// eficacia.js — InConexion Platform (Fase 198, Mobilize). "Eficacia" en la
// sub-pestaña propia "Eficacia" de Flujo de Llamadas (Fase 199; antes dentro
// de One & Done): tarjeta del mes, barras por mes y la nota de como se calcula. Los datos y la
// lista de codigos positivos salen del servidor (server/eficacia.js, unico
// lugar de la lista); el navegador no la repite.
'use strict';

var _eficaciaUltimo = {}; // por indice de panel: respuesta, para exportar

function eficaciaNotaTexto(codigos) {
  return 'Eficacia = llamadas contestadas de ingreso con un código positivo ÷ llamadas contestadas de ingreso del mes (CDR de Tipificación; cada llamada cuenta, sin quitar repetidas). ' +
    'Códigos positivos: ' + (codigos || []).join('; ') + '. Se comparan sin tildes ni mayúsculas, con "_" como espacio.';
}

function _eficaciaPct(v) { return v === null || v === undefined ? '—' : String(v).replace('.', ',') + ' %'; }

async function _eficaciaDibujar(i, campana, desde, hasta) {
  var elKpi = document.getElementById('tv-ef-kpi-' + i);
  var elNota = document.getElementById('tv-ef-nota-' + i);
  var canvas = document.getElementById('tv-canvas-ef-' + i);
  if (!elKpi && !canvas) return;
  var mesLbl = function (m) { return (typeof mesNombreLargo === 'function') ? mesNombreLargo(m) : m; };
  var q = 'campana=' + encodeURIComponent(campana) + (desde ? '&desde=' + encodeURIComponent(desde) : '') + (hasta ? '&hasta=' + encodeURIComponent(hasta) : '');
  var r = null;
  try { r = await apiRequest('GET', '/calidad/tipificacion/eficacia?' + q); }
  catch (e) {
    _eficaciaUltimo[i] = null;
    if (elKpi) elKpi.innerHTML = '';
    if (canvas && canvas.parentNode) canvas.parentNode.innerHTML = '<div role="alert" style="text-align:center;color:var(--c-danger-text);padding:24px 8px">No se pudo cargar la Eficacia. Revisa la conexión y vuelve a aplicar los filtros.</div>';
    return;
  }
  _eficaciaUltimo[i] = r;
  if (elNota) elNota.textContent = r && r.codigos ? eficaciaNotaTexto(r.codigos) : '';
  var meses = (r && r.meses) || [];
  if (!meses.length) {
    if (elKpi) elKpi.innerHTML = '<div class="aurora-kpi enc-ef"><div class="kv">—</div><div class="kl">Eficacia: sin CDR de llamadas en el período</div></div>';
    if (canvas && canvas.parentNode) canvas.parentNode.innerHTML = '<div class="gd-vacio">Sin CDR de llamadas en el período seleccionado. Cuando se cargue en Tipificación, aquí aparecerá la Eficacia por mes.</div>';
    return;
  }
  var mesFin = hasta ? String(hasta).slice(0, 7) : meses[meses.length - 1].periodo;
  var delMes = meses.filter(function (m) { return m.periodo === mesFin; })[0];
  if (elKpi) {
    elKpi.innerHTML = '<div class="aurora-kpi enc-ef"><div class="kv">' + (delMes ? esc(_eficaciaPct(delMes.pct)) : '—') + '</div>' +
      '<div class="kl">Eficacia — ' + esc(mesLbl(mesFin)) + ': ' +
      (delMes ? delMes.positivas.toLocaleString('es-CO') + ' de ' + delMes.contestadas.toLocaleString('es-CO') + ' contestadas de ingreso con código positivo' : 'sin CDR este mes') + '</div></div>';
  }
  // Azul secundario del tablero (nunca morado ni rosado).
  var color = (typeof colorSerie === 'function') ? colorSerie('secundaria') : '#3DA2DB';
  var o = (typeof loBar === 'function') ? loBar() : { responsive: true, maintainAspectRatio: false, plugins: {} };
  o.plugins = o.plugins || {};
  o.plugins.legend = { display: false };
  o.scales = {
    y: { min: 0, max: 100, grid: { color: (typeof CHART_GRID !== 'undefined' ? CHART_GRID : '#f0f4f8') }, ticks: { font: { size: 12 }, callback: function (v) { return v + ' %'; } } },
    x: { grid: { display: false }, ticks: { font: { size: 12 } } },
  };
  o.plugins.tooltip = { callbacks: { label: function (ctx) {
    var m = meses[ctx.dataIndex];
    return _eficaciaPct(m.pct) + ' (' + m.positivas + ' de ' + m.contestadas + ' contestadas de ingreso)';
  } } };
  o.plugins.datalabels = { display: true, anchor: 'end', align: 'end', formatter: function (v) { return _eficaciaPct(v); } };
  if (typeof _gdChart === 'function' && canvas) {
    _gdChart('tv-canvas-ef-' + i, {
      type: 'bar',
      data: { labels: meses.map(function (m) { return mesLbl(m.periodo); }), datasets: [{ label: 'Eficacia', data: meses.map(function (m) { return m.pct; }), backgroundColor: color, borderRadius: 3 }] },
      options: o,
    });
  }
}

// Fase 199: tabla por mes para el Excel/PDF de la sub-pestaña "Eficacia".
function _eficaciaDatosExport(i) {
  var r = _eficaciaUltimo[i];
  return ((r && r.meses) || []).map(function (m) {
    return { Mes: m.periodo, 'Contestadas de ingreso': m.contestadas, 'Con código positivo': m.positivas, '% Eficacia': m.pct };
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { eficaciaNotaTexto: eficaciaNotaTexto };
}
