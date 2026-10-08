// efectividad-citas.js — Efectividad de Citas Atendidas de ORLANT (Fase
// 111, pedido textual de InCo). Reemplaza al viejo panel `combo` generico
// que leia citas_para_mes/citas_atendidas de la hoja "resumen" (nunca tuvo
// datos reales) -- ahora lee la tabla `efectividad_citas` (un total real
// por mes, CITAS_ATENDIDAS.xlsx).
//
// Sin filtros propios -- el Mes lo pone SOLO el selector global de arriba
// (_gd.mesSel), mismo criterio que Efectividad de Agendamiento. 2
// tarjetas (% del mes elegido + % ponderado del periodo CON datos, nunca
// el promedio simple) + grafica combo (Agendas/Atendidas en barras, %
// Efectividad en linea, eje secundario) + tabla de datos debajo (mismo
// patron que "Resumen por mes" de Inasistencia, Fase 109) + aviso "sin
// datos" con boton al ultimo mes con datos.
'use strict';

var _ecOpciones = {}; // cache por campana: { meses }
var _ecCampanaPorPanel = {};

async function _ecCargarOpciones(campana){
  if(_ecOpciones[campana]) return _ecOpciones[campana];
  var op = { meses: [] };
  try{ op = await apiRequest('GET','/calidad/efectividad-citas/opciones?campana='+encodeURIComponent(campana)); }
  catch(e){ /* sin datos o sin acceso -- el panel muestra "sin datos" */ }
  _ecOpciones[campana] = op;
  return op;
}

async function _efectividadCitasRenderPanel(p, i){
  var campana = p.campana;
  _ecCampanaPorPanel[i] = campana;
  var host = document.getElementById('gd-p'+i);
  if(!host) return;
  var titulo = p.titulo || 'Efectividad de Citas';
  host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">'+esc(titulo)+'</div>'+
    '<div style="text-align:center;color:var(--c-text-muted);padding:20px 8px">Cargando…</div></div>';

  var opciones = await _ecCargarOpciones(campana);
  if(!opciones.meses || !opciones.meses.length){
    host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">'+esc(titulo)+'</div>'+
      '<div style="text-align:center;color:var(--c-text-muted);padding:24px 8px">Sin Efectividad de citas cargada todavia. Un usuario con permiso de administrador debe subir la hoja CITAS_ATENDIDAS desde "Cargar Datos".</div></div>';
    return;
  }

  var html = '<div class="aurora-card">';
  html += '<div class="aurora-card-title">'+esc(titulo)+'</div>';
  html += '<div id="ec-aviso-'+i+'"></div>';
  html += '<div id="ec-tarjetas-wrap-'+i+'"></div>';
  html += '<div class="aurora-chart-wrap" style="height:320px"><canvas id="ec-c-'+i+'"></canvas></div>';
  html += '<div id="ec-tabla-'+i+'"></div>';
  html += '</div>';
  host.innerHTML = html;

  await _ecDibujar(campana, i, opciones);
}

async function _ecDibujar(campana, i, opciones){
  var mesSel = (typeof _gd !== 'undefined') ? _gd.mesSel : '';
  var avisoEl = document.getElementById('ec-aviso-'+i);
  var tarjetasEl = document.getElementById('ec-tarjetas-wrap-'+i);
  var tablaEl = document.getElementById('ec-tabla-'+i);

  var filas = [];
  try{ filas = await apiRequest('GET','/calidad/efectividad-citas/mensual?campana='+encodeURIComponent(campana)) || []; }
  catch(e){ showToast(e.message); }

  if(avisoEl){
    avisoEl.innerHTML = (!mesSel || (opciones.meses||[]).indexOf(mesSel) === -1)
      ? _gdAvisoSinDatosMesHtml('Efectividad de Citas', mesSel, opciones.meses.length ? opciones.meses[opciones.meses.length-1] : null, mesNombreLargo)
      : '';
  }

  if(tarjetasEl){
    if(!filas.length){
      tarjetasEl.innerHTML = '<div style="text-align:center;color:var(--c-text-muted);padding:16px 8px">Sin datos.</div>';
    } else {
      var ponderado = citasAtendidasPonderado(filas);
      var rangoLbl = citasAtendidasRangoLbl(filas);
      var delMes = filas.filter(function(f){ return f.mes === mesSel; })[0];
      var pctMes = delMes ? (delMes.agendas > 0 ? delMes.atendidas/delMes.agendas : null) : null;
      tarjetasEl.innerHTML = '<div class="aurora-kpis">' +
        '<div class="aurora-kpi gd-kpi"><div class="kv">'+(mesSel ? citasAtendidasFmtPct(pctMes) : '—')+'</div><div class="kl">% Efectividad · '+(mesSel ? esc(citasAtendidasMesLbl(mesSel)) : '—')+'</div></div>' +
        '<div class="aurora-kpi gd-kpi"><div class="kv">'+citasAtendidasFmtPct(ponderado.pct)+'</div><div class="kl">% Efectividad ponderado · '+esc(rangoLbl)+'</div></div>' +
        '</div>';
    }
  }

  _ecDibujarGrafica(i, filas);

  if(tablaEl) tablaEl.innerHTML = _ecTablaHtml(filas, mesSel);
}

function _ecDibujarGrafica(i, filas){
  var canvasId = 'ec-c-'+i;
  var labels = filas.map(function(f){ return citasAtendidasMesLbl(f.mes); });
  var barras = [
    { label: 'Agendas', data: filas.map(function(f){ return f.agendas; }), color: (typeof CM!=='undefined'?CM:'#1a7a9e') },
    { label: 'Atendidas', data: filas.map(function(f){ return f.atendidas; }), color: (typeof CD!=='undefined'?CD:'#0d4a5e') },
  ];
  var linea = { label: '% Efectividad', data: filas.map(function(f){ return f.agendas > 0 ? (f.atendidas/f.agendas*100) : null; }), color: (typeof CO!=='undefined'?CO:'#e67e22') };
  var ds = gdComboDatasets(barras, linea);
  var o = loBar();
  o.plugins.legend.labels = Object.assign({}, o.plugins.legend.labels, {
    generateLabels: function(chart){
      return chart.data.datasets.map(function(dset, idx){
        var color = dset.type === 'line' ? dset.borderColor : dset.backgroundColor;
        return { text: dset.label, fillStyle: color, strokeStyle: color, lineWidth: dset.type==='line' ? 2 : 0, hidden: !chart.isDatasetVisible(idx), datasetIndex: idx };
      });
    }
  });
  o.scales = {
    y: { position:'left', grid:{color:(typeof CHART_GRID!=='undefined'?CHART_GRID:'#f0f4f8')}, ticks:{font:{size:12}} },
    y2: { position:'right', grid:{display:false}, ticks:{font:{size:12}, callback:function(v){ return gdFmtValor(v,'%'); }} },
    x: { grid:{display:false}, ticks:{font:{size:12}} },
  };
  o.plugins.datalabels = { display:true, align:'end', anchor:'end', font:{size:12,weight:'bold'}, color:(typeof CD!=='undefined'?CD:'#0d4a5e'),
    formatter:function(v,ctx){ return ctx.dataset.type==='line' ? (v!=null?gdFmtValor(v,'%'):'') : v; } };
  loDatalabelsAuto(o);
  _gdChart(canvasId, { data: { labels: labels, datasets: ds }, options: o });
}

// Tabla de datos debajo de la grafica (mismo patron que "Resumen por mes"
// de Inasistencia, Fase 109): mes y valor alineados bajo cada punto, con
// su PROPIO scroll horizontal. El mes elegido arriba queda en negrita.
function _ecTablaHtml(filas, mesSel){
  if(!filas.length) return '';
  function celda(tag, txt, mes){
    return '<'+tag+(mes===mesSel?' style="font-weight:800"':'')+'>'+esc(txt)+'</'+tag+'>';
  }
  var encabezados = filas.map(function(f){ return celda('th', citasAtendidasMesLbl(f.mes), f.mes); }).join('');
  var filaPct = filas.map(function(f){ return celda('td', citasAtendidasFmtPct(f.agendas>0?f.atendidas/f.agendas:null), f.mes); }).join('');
  var filaAgendas = filas.map(function(f){ return celda('td', gdFmtValor(f.agendas), f.mes); }).join('');
  var filaAtendidas = filas.map(function(f){ return celda('td', gdFmtValor(f.atendidas), f.mes); }).join('');
  return '<div style="overflow-x:auto;margin-top:10px">' +
    '<table class="aurora-rank-table"><thead><tr><th></th>'+encabezados+'</tr></thead>'+
    '<tbody><tr><td>% Efectividad</td>'+filaPct+'</tr>'+
    '<tr><td>Agendas</td>'+filaAgendas+'</tr>'+
    '<tr><td>Atendidas</td>'+filaAtendidas+'</tr></tbody></table></div>';
}
