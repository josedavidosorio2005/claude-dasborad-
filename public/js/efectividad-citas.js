// efectividad-citas.js — Efectividad de Citas Atendidas de ORLANT (Fase
// 111, pedido textual de InCo). Reemplaza al viejo panel `combo` generico
// que leia citas_para_mes/citas_atendidas de la hoja "resumen" (nunca tuvo
// datos reales) -- ahora lee la tabla `efectividad_citas` (un total real
// por mes, CITAS_ATENDIDAS.xlsx).
//
// Sin filtros propios -- los meses los pone SOLO MESES (Fase 207, igual que
// todas las campañas). UNA tarjeta: % ponderado de los meses de MESES
// (atendidas ÷ agendas sumadas, nunca el promedio simple; antes eran 2: % del
// mes elegido + % ponderado del periodo con datos) + grafica combo (Agendas/Atendidas en barras, %
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
      '<div class="gd-vacio">Sin Efectividad de citas cargada todavia. Un usuario con permiso de administrador debe subir la hoja CITAS_ATENDIDAS desde "Cargar Datos".</div></div>';
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
  var conDatosEc = (opciones && opciones.meses) || [];
  var mesesEc = gdMesesTarjetasActual().filter(function(m){ return conDatosEc.indexOf(m) !== -1; }); // Fase 207
  var mesUnicoEc = mesesEc.length === 1 ? mesesEc[0] : '';
  var avisoEl = document.getElementById('ec-aviso-'+i);
  var tarjetasEl = document.getElementById('ec-tarjetas-wrap-'+i);
  var tablaEl = document.getElementById('ec-tabla-'+i);

  var filas = [];
  try{ filas = await apiRequest('GET','/calidad/efectividad-citas/mensual?campana='+encodeURIComponent(campana)) || []; }
  catch(e){ showToast(e.message, 'error'); }

  if(avisoEl){
    avisoEl.innerHTML = !mesesEc.length
      ? _gdAvisoSinDatosMesHtml('Efectividad de Citas', _gdMeses().slice(-1)[0] || '', conDatosEc.length ? conDatosEc[conDatosEc.length-1] : null, mesNombreLargo)
      : '';
  }

  // Fase 212 (ORLANT): agendas / (llamadas + WhatsApp contestados), ver
  // efectividadCitasDesdeContactos (server/efectividad-citas.js).
  var desdeContactos = filas.length > 0 && filas[0].contactos !== undefined;
  if(tarjetasEl){
    if(!filas.length){
      tarjetasEl.innerHTML = '<div class="gd-vacio-chico">Sin datos.</div>';
    } else {
      // Fase 207: una sola tarjeta, ponderada sobre los meses de MESES (totales sumados).
      var filasEc = filas.filter(function(f){ return mesesEc.indexOf(f.mes) !== -1; });
      var ponderado = citasEfectividadPonderado(filasEc);
      tarjetasEl.innerHTML = '<div class="aurora-kpis">' +
        '<div class="aurora-kpi gd-kpi"><div class="kv">'+(filasEc.length ? citasAtendidasFmtPct(ponderado.pct) : '—')+'</div><div class="kl">% Efectividad '+(desdeContactos ? '' : 'ponderado ')+'· '+esc(gdMesesTarjetasTexto(mesesEc, !_gdMeses().length, mesNombreLargo))+'</div></div>' +
        '</div>' +
        (desdeContactos ? '<p class="tipif-linea-nota">Efectividad = agendas del mes (3P + General) ÷ (llamadas contestadas de Tráfico de Llamadas + WhatsApp contestados de Tráfico de WhatsApp) del mismo mes. Con varios meses, se suman los totales.</p>' : '');
    }
  }

  // Fase 167: filtro "Meses" -- grafica y tabla (Fase 207: tambien la tarjeta).
  var filasMeses = (typeof gdAplicarFiltroMeses === 'function' ? gdAplicarFiltroMeses(filas, function(f){ return f.mes; }) : filas);
  if(desdeContactos) _ecDibujarGraficaContactos(i, filasMeses);
  else _ecDibujarGrafica(i, filasMeses);

  if(tablaEl) tablaEl.innerHTML = desdeContactos ? _ecTablaContactosHtml(filasMeses, mesUnicoEc) : _ecTablaHtml(filasMeses, mesUnicoEc);
}

// Fase 212 / 213 (pedido de Edwin): por mes, barras de contestadas (llamadas +
// WhatsApp) y de agendas, y una linea del % de efectividad (eje derecho).
// Mismo patron combo que _ecDibujarGrafica (formula de archivo).
function _ecDibujarGraficaContactos(i, filas){
  var canvasId = 'ec-c-'+i;
  var fr = filas.map(citasEfectividadFraccion);
  var barras = [
    { label: 'Contestadas (llamadas + WhatsApp)', data: filas.map(function(f){ return f.contactos; }), color: (typeof colorSerie==='function' ? colorSerie('principal') : '#004150') },
    { label: 'Agendas', data: filas.map(function(f){ return f.agendas; }), color: (typeof colorSerie==='function' ? colorSerie('secundaria') : '#3DA2DB') },
  ];
  var linea = { label: '% Efectividad', data: fr.map(function(x){ return x.pct === null ? null : x.pct*100; }), color: (typeof colorSerie==='function' ? colorSerie('linea') : '#0d4a5e') };
  var ds = gdComboDatasets(barras, linea);
  // Fase 213: la barra azul lleva su borde en claro (estiloBarraSecundaria, 3:1).
  if(typeof estiloBarraSecundaria === 'function') Object.assign(ds[1], estiloBarraSecundaria());
  // "agendas de contestados" en el tooltip y en Ver datos (Fase 152, B9).
  ds.forEach(function(d){ if(d.type === 'line') d.fraccion = { num: fr.map(function(x){ return x.num; }), den: fr.map(function(x){ return x.den; }) }; });
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
    y: { position:'left', beginAtZero:true, grid:{color:(typeof CHART_GRID!=='undefined'?CHART_GRID:'#f0f4f8')}, ticks:{font:{size:12}} },
    y2: { position:'right', beginAtZero:true, grid:{display:false}, ticks:{font:{size:12}, callback:function(v){ return gdFmtValor(v,'%'); }} },
    x: { grid:{display:false}, ticks:{font:{size:12}} },
  };
  // Fase 213: cifras legibles en los 2 temas (texto de serie principal sobre el
  // fondo de etiqueta del tema) y, en pantallas angostas, solo las del %.
  o.plugins.datalabels = { align:'end', anchor:'end', font:{size:12,weight:'bold'},
    color: (typeof colorSerie==='function' ? colorSerie('principal') : '#004150'),
    backgroundColor: (typeof CHART_DL_BG!=='undefined' ? CHART_DL_BG : 'rgba(255,255,255,0.75)'), borderRadius:3, padding:{ top:1, bottom:1, left:3, right:3 },
    display: function(ctx){ return ctx.dataset.type === 'line' || !ctx.chart || ctx.chart.width > 480; },
    formatter:function(v,ctx){ return ctx.dataset.type==='line' ? (v!=null ? citasAtendidasFmtPct(v/100) : '') : gdFmtValor(v); } };
  loDatalabelsAuto(o);
  _gdChart(canvasId, { data: { labels: filas.map(function(f){ return citasAtendidasMesLbl(f.mes); }), datasets: ds }, options: o });
}

function _ecTablaContactosHtml(filas, mesSel){
  if(!filas.length) return '';
  function celda(tag, txt, mes){
    return '<'+tag+(mes===mesSel?' style="font-weight:700"':'')+'>'+esc(txt)+'</'+tag+'>';
  }
  function fila(nombre, fn){ return '<tr><td>'+esc(nombre)+'</td>'+filas.map(function(f){ return celda('td', fn(f), f.mes); }).join('')+'</tr>'; }
  return '<div class="gd-tabla-scroll gd-tabla-mt">' +
    '<table class="aurora-rank-table"><thead><tr><th></th>'+filas.map(function(f){ return celda('th', citasAtendidasMesLbl(f.mes), f.mes); }).join('')+'</tr></thead><tbody>' +
    fila('% Efectividad', function(f){ return citasAtendidasFmtPct(citasEfectividadFraccion(f).pct); }) +
    fila('Agendas (3P + General)', function(f){ return gdFmtValor(f.agendas); }) +
    fila('Llamadas contestadas', function(f){ return gdFmtValor(f.llamadasContestadas); }) +
    fila('WhatsApp contestados', function(f){ return gdFmtValor(f.whatsappContestados); }) +
    fila('Total contestados', function(f){ return gdFmtValor(f.contactos); }) +
    '</tbody></table></div>';
}

function _ecDibujarGrafica(i, filas){
  var canvasId = 'ec-c-'+i;
  var labels = filas.map(function(f){ return citasAtendidasMesLbl(f.mes); });
  var barras = [
    { label: 'Agendas', data: filas.map(function(f){ return f.agendas; }), color: (typeof CM!=='undefined'?CM:'#1a7a9e') },
    { label: 'Atendidas', data: filas.map(function(f){ return f.atendidas; }), color: (typeof CD!=='undefined'?CD:'#0d4a5e') },
  ];
  var linea = { label: '% Efectividad', data: filas.map(function(f){ return f.agendas > 0 ? (f.atendidas/f.agendas*100) : null; }), color: (typeof colorSerie==='function' ? colorSerie('linea') : '#0d4a5e') } // Fase 152 (B1): paleta categorica, no semaforo;
  var ds = gdComboDatasets(barras, linea);
  // Fase 152 (B9): "atendidas de agendas" en el tooltip y en Ver datos.
  ds.forEach(function(d){ if(d.type === 'line') d.fraccion = { num: filas.map(function(f){ return f.atendidas; }), den: filas.map(function(f){ return f.agendas; }) }; });
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
    return '<'+tag+(mes===mesSel?' style="font-weight:700"':'')+'>'+esc(txt)+'</'+tag+'>';
  }
  var encabezados = filas.map(function(f){ return celda('th', citasAtendidasMesLbl(f.mes), f.mes); }).join('');
  var filaPct = filas.map(function(f){ return celda('td', citasAtendidasFmtPct(f.agendas>0?f.atendidas/f.agendas:null), f.mes); }).join('');
  var filaAgendas = filas.map(function(f){ return celda('td', gdFmtValor(f.agendas), f.mes); }).join('');
  var filaAtendidas = filas.map(function(f){ return celda('td', gdFmtValor(f.atendidas), f.mes); }).join('');
  return '<div class="gd-tabla-scroll gd-tabla-mt">' +
    '<table class="aurora-rank-table"><thead><tr><th></th>'+encabezados+'</tr></thead>'+
    '<tbody><tr><td>% Efectividad</td>'+filaPct+'</tr>'+
    '<tr><td>Agendas</td>'+filaAgendas+'</tr>'+
    '<tr><td>Atendidas</td>'+filaAtendidas+'</tr></tbody></table></div>';
}
