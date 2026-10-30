// total-trafico.js — Fase 219 (pedido de Edwin, 30/10, ORLANT): pestaña
// "Total tráfico" (panel `total_trafico_panel`). Suma la entrada (Trafico de
// Llamadas y de WhatsApp) y la salida (llamadas y WhatsApp de salida) por mes,
// desde GET /calidad/total-trafico/mensual (server/total-trafico.js).
// Mismo estilo que Efectividad de Citas: tarjetas con numero grande y
// descripcion corta, y una grafica con 2 barras por mes. Sin filtros propios:
// los meses los pone MESES (Fase 207). Cada salida cuenta como contestada
// (decision de Edwin); la contactabilidad de la salida queda pendiente.
'use strict';

var _ttCampanaPorPanel = {};

async function _totalTraficoRenderPanel(p, i){
  var campana = p.campana;
  _ttCampanaPorPanel[i] = campana;
  var host = document.getElementById('gd-p'+i);
  if(!host) return;
  var titulo = p.titulo || 'Total tráfico';
  host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">'+esc(titulo)+'</div>'+
    '<div style="text-align:center;color:var(--c-text-muted);padding:20px 8px">Cargando…</div></div>';

  var filas = [];
  try{ filas = await apiRequest('GET','/calidad/total-trafico/mensual?campana='+encodeURIComponent(campana)) || []; }
  catch(e){ showToast(e.message, 'error'); }
  if(!filas.length){
    host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">'+esc(titulo)+'</div>'+
      '<div class="gd-vacio">Sin tráfico cargado todavía (Tráfico de Llamadas, Tráfico de WhatsApp o Llamadas y WhatsApp de salida).</div></div>';
    return;
  }

  var conDatos = filas.map(function(f){ return f.mes; });
  var mesesTt = gdMesesTarjetasActual().filter(function(m){ return conDatos.indexOf(m) !== -1; }); // Fase 207
  var html = '<div class="aurora-card">';
  html += '<div class="aurora-card-title">'+esc(titulo)+'</div>';
  if(!mesesTt.length){
    html += _gdAvisoSinDatosMesHtml('Total tráfico', _gdMeses().slice(-1)[0] || '', conDatos[conDatos.length-1], mesNombreLargo);
  }
  var delMeses = filas.filter(function(f){ return mesesTt.indexOf(f.mes) !== -1; });
  var s = totalTraficoSumaFilas(delMeses);
  var lbl = esc(gdMesesTarjetasTexto(mesesTt, !_gdMeses().length, mesNombreLargo));
  var kpi = function(valor, etiqueta){ return '<div class="aurora-kpi gd-kpi"><div class="kv">'+valor+'</div><div class="kl">'+etiqueta+'</div></div>'; };
  html += '<div class="aurora-kpis">' +
    kpi(delMeses.length ? gdFmtValor(s.ingresados) : '—', 'Total ingresados · llamadas y WhatsApp, de entrada y de salida · '+lbl) +
    kpi(delMeses.length ? gdFmtValor(s.contestados) : '—', 'Total contestados · incluye todas las salidas · '+lbl) +
    kpi(delMeses.length && s.nivelAtencion !== null ? gdFmtValor(s.nivelAtencion*100, '%') : '—', 'Nivel de atención total · contestados ÷ ingresados · '+lbl) +
    '</div>';
  html += '<div class="aurora-chart-wrap" style="height:320px"><canvas id="tt-c-'+i+'"></canvas></div>';
  html += '</div>';
  host.innerHTML = html;

  var filasMeses = (typeof gdAplicarFiltroMeses === 'function' ? gdAplicarFiltroMeses(filas, function(f){ return f.mes; }) : filas);
  _ttDibujarGrafica(i, filasMeses);
}

// Totales sumados de varios meses (nunca el promedio de los %).
function totalTraficoSumaFilas(filas){
  var ing = 0, con = 0;
  (filas || []).forEach(function(f){ ing += f.ingresados || 0; con += f.contestados || 0; });
  return { ingresados: ing, contestados: con, nivelAtencion: ing > 0 ? con / ing : null };
}

// 2 barras por mes: Total llamadas + WhatsApp (ingresados) y Total contestados.
function _ttDibujarGrafica(i, filas){
  var ds = [
    { label: 'Total llamadas + WhatsApp', data: filas.map(function(f){ return f.ingresados; }), backgroundColor: (typeof colorSerie==='function' ? colorSerie('principal') : '#004150'), borderRadius: 4 },
    { label: 'Total contestados', data: filas.map(function(f){ return f.contestados; }), backgroundColor: (typeof colorSerie==='function' ? colorSerie('secundaria') : '#3DA2DB'), borderRadius: 4 },
  ];
  // La barra azul lleva su borde en claro (estiloBarraSecundaria, 3:1), igual que Efectividad de Citas.
  if(typeof estiloBarraSecundaria === 'function') Object.assign(ds[1], estiloBarraSecundaria());
  var o = loBar();
  o.scales = {
    y: { beginAtZero:true, grid:{color:(typeof CHART_GRID!=='undefined'?CHART_GRID:'#f0f4f8')}, ticks:{font:{size:12}, callback:function(v){ return gdFmtValor(v); }} },
    x: { grid:{display:false}, ticks:{font:{size:12}} },
  };
  o.plugins.datalabels = { align:'end', anchor:'end', font:{size:12,weight:'bold'},
    color: (typeof colorSerie==='function' ? colorSerie('principal') : '#004150'),
    backgroundColor: (typeof CHART_DL_BG!=='undefined' ? CHART_DL_BG : 'rgba(255,255,255,0.75)'), borderRadius:3, padding:{ top:1, bottom:1, left:3, right:3 },
    display: function(ctx){ return !ctx.chart || ctx.chart.width > 480; },
    formatter: function(v){ return gdFmtValor(v); } };
  loDatalabelsAuto(o);
  _gdChart('tt-c-'+i, { type: 'bar', data: { labels: filas.map(function(f){ return citasAtendidasMesLbl(f.mes); }), datasets: ds }, options: o });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { totalTraficoSumaFilas: totalTraficoSumaFilas };
}
