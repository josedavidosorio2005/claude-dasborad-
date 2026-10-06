// salida.js — Salida (Llamadas y WhatsApp) de ORLANT (Fase 127, pedido
// textual de Edwin: "las llamadas de salida estan muy bajas, hay que
// revisarlo"). Lee la tabla salida_mensual (totales mensuales del archivo
// FLUJO_LLAMADAS_Y_WPP_DE_SALIDA_POR_MES.xlsx) -- nunca duplica el skill
// LINEA DE SALIDA de Tipificacion de Llamadas (esa es solo verificacion
// cruzada, ver Fase 127 Parte 4).
//
// Pedido explicito de Edwin: "que sea simplemente el mes y la cantidad",
// con porcentaje SI APLICA -- NUNCA se inventa un denominador de entrada/
// gestion (pregunta abierta en docs/pendientes.md). Lo que se muestra: el
// total del mes + variacion vs el mes anterior, y la participacion
// 3P/General DENTRO del total de salida de ese mismo mes (nunca contra un
// total ajeno). 2 graficas de barras agrupadas por mes (3P vs General),
// una para Llamadas y otra para WhatsApp -- con solo 2 meses, una linea de
// tendencia no se lee (Parte 1 de la fase).
'use strict';

var _salOpciones = {}; // cache por campana: { meses }

async function _salCargarOpciones(campana){
  if(_salOpciones[campana]) return _salOpciones[campana];
  var op = { meses: [] };
  try{ op = await apiRequest('GET','/calidad/salida/opciones?campana='+encodeURIComponent(campana)); }
  catch(e){ /* sin datos o sin acceso -- el panel muestra "sin datos" */ }
  _salOpciones[campana] = op;
  return op;
}

async function _salidaRenderPanel(p, i){
  var campana = p.campana;
  var host = document.getElementById('gd-p'+i);
  if(!host) return;
  var titulo = p.titulo || 'Salida (Llamadas y WhatsApp)';
  host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">'+esc(titulo)+'</div>'+
    '<div style="text-align:center;color:var(--c-text-muted);padding:20px 8px">Cargando…</div></div>';

  var opciones = await _salCargarOpciones(campana);
  if(!opciones.meses || !opciones.meses.length){
    host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">'+esc(titulo)+'</div>'+
      '<div style="text-align:center;color:var(--c-text-muted);padding:24px 8px">Sin datos de Salida cargados todavia. Un usuario con permiso de administrador debe subir el archivo de Salida desde "Cargar Datos".</div></div>';
    return;
  }

  var html = '<div class="aurora-card">';
  html += '<div class="aurora-card-title">'+esc(titulo)+'</div>';
  html += '<div id="sal-aviso-'+i+'"></div>';
  html += '<div id="sal-tarjetas-wrap-'+i+'"></div>';
  html += '<div class="aurora-chart-wrap" style="height:280px"><canvas id="sal-llam-'+i+'"></canvas></div>';
  html += '<div class="aurora-chart-wrap" style="height:280px;margin-top:14px"><canvas id="sal-wpp-'+i+'"></canvas></div>';
  html += '<div id="sal-tabla-'+i+'"></div>';
  html += '</div>';
  host.innerHTML = html;

  await _salDibujar(campana, i, opciones);
}

// Variacion vs el mes anterior -- vacio (nunca "0%"/"Infinity%") si no hay
// mes anterior en la base o si ese mes anterior fue 0 (division invalida).
function _salVariacionTxt(actual, anterior){
  if(anterior === null || anterior === undefined || !isFinite(anterior) || anterior === 0) return '';
  var v = (actual - anterior) / anterior * 100;
  var signo = v > 0 ? '+' : '';
  return ' ('+signo+gdFmtValor(Math.round(v*10)/10,'%')+' vs mes anterior)';
}

async function _salDibujar(campana, i, opciones){
  var mesSel = (typeof _gd !== 'undefined') ? _gd.mesSel : '';
  var avisoEl = document.getElementById('sal-aviso-'+i);
  var tarjetasEl = document.getElementById('sal-tarjetas-wrap-'+i);
  var tablaEl = document.getElementById('sal-tabla-'+i);

  var filas = [];
  try{ filas = await apiRequest('GET','/calidad/salida/mensual?campana='+encodeURIComponent(campana)) || []; }
  catch(e){ showToast(e.message); }

  if(avisoEl){
    avisoEl.innerHTML = (!mesSel || (opciones.meses||[]).indexOf(mesSel) === -1)
      ? _gdAvisoSinDatosMesHtml('Salida', mesSel, opciones.meses.length ? opciones.meses[opciones.meses.length-1] : null, mesNombreLargo)
      : '';
  }

  if(tarjetasEl){
    var idx = filas.map(function(f){ return f.mes; }).indexOf(mesSel);
    var delMes = idx!==-1 ? filas[idx] : null;
    var anterior = idx>0 ? filas[idx-1] : null;
    if(!delMes){
      tarjetasEl.innerHTML = '<div style="text-align:center;color:var(--c-text-muted);padding:16px 8px">Sin datos.</div>';
    } else {
      var totalLlam = delMes.llamadas3p + delMes.llamadasGeneral;
      var totalWpp = delMes.wpp3p + delMes.wppGeneral;
      var totalLlamAnt = anterior ? anterior.llamadas3p + anterior.llamadasGeneral : null;
      var totalWppAnt = anterior ? anterior.wpp3p + anterior.wppGeneral : null;
      tarjetasEl.innerHTML = '<div class="aurora-kpis">' +
        '<div class="aurora-kpi gd-kpi"><div class="kv">'+gdFmtValor(totalLlam)+'</div><div class="kl">Llamadas de salida · '+esc(salidaMesLbl(delMes.mes))+_salVariacionTxt(totalLlam, totalLlamAnt)+'</div></div>' +
        '<div class="aurora-kpi gd-kpi"><div class="kv">'+gdFmtValor(totalWpp)+'</div><div class="kl">WhatsApp de salida · '+esc(salidaMesLbl(delMes.mes))+_salVariacionTxt(totalWpp, totalWppAnt)+'</div></div>' +
        '</div>';
    }
  }

  _salDibujarGrafica('sal-llam-'+i, filas, 'llamadas3p', 'llamadasGeneral', 'Llamadas de salida');
  _salDibujarGrafica('sal-wpp-'+i, filas, 'wpp3p', 'wppGeneral', 'WhatsApp de salida');

  if(tablaEl) tablaEl.innerHTML = _salTablaHtml(filas, mesSel);
}

// Barras agrupadas por mes (3P vs General) -- con solo 2 meses una linea de
// tendencia no se lee (decision de la Parte 1 de la fase), asi que NUNCA se
// usa gdComboDatasets/una linea aqui, a diferencia de Efectividad de
// Agendamiento/Citas (que si tienen varios meses de historia).
function _salDibujarGrafica(canvasId, filas, campo3p, campoGeneral, tituloEje){
  var labels = filas.map(function(f){ return salidaMesLbl(f.mes); });
  var ds = [
    { type:'bar', label:'3P', data: filas.map(function(f){ return f[campo3p]; }), backgroundColor: (typeof CM!=='undefined'?CM:'#1a7a9e'), borderRadius:3, maxBarThickness:60 },
    { type:'bar', label:'General', data: filas.map(function(f){ return f[campoGeneral]; }), backgroundColor: (typeof CD!=='undefined'?CD:'#0d4a5e'), borderRadius:3, maxBarThickness:60 },
  ];
  var o = loFmt(loBar(tituloEje));
  loDatalabelsAuto(o);
  _gdChart(canvasId, { data: { labels: labels, datasets: ds }, options: o });
}

// Tabla de datos debajo de las graficas (mismo patron "Resumen por mes" de
// Inasistencia/Efectividad de Citas): mes alineado bajo cada columna, con
// su PROPIO scroll horizontal. El mes elegido arriba queda en negrita.
// % 3P: participacion DENTRO del total de salida de ESE mismo mes (nunca
// contra entrada/gestion -- Edwin no definio ese denominador).
function _salTablaHtml(filas, mesSel){
  if(!filas.length) return '';
  function celda(tag, txt, mes){
    return '<'+tag+(mes===mesSel?' style="font-weight:800"':'')+'>'+esc(txt)+'</'+tag+'>';
  }
  function pct(parte, total){ return total>0 ? gdFmtValor(Math.round(parte/total*1000)/10,'%') : '—'; }
  function fila(label, valores){
    return '<tr><td>'+esc(label)+'</td>'+filas.map(function(f){ return celda('td', valores(f), f.mes); }).join('')+'</tr>';
  }
  var encabezados = filas.map(function(f){ return celda('th', salidaMesLbl(f.mes), f.mes); }).join('');
  var cuerpo =
    fila('Llamadas 3P', function(f){ return gdFmtValor(f.llamadas3p); }) +
    fila('Llamadas General', function(f){ return gdFmtValor(f.llamadasGeneral); }) +
    fila('Total Llamadas', function(f){ return gdFmtValor(f.llamadas3p+f.llamadasGeneral); }) +
    fila('% 3P (Llamadas)', function(f){ return pct(f.llamadas3p, f.llamadas3p+f.llamadasGeneral); }) +
    fila('WhatsApp 3P', function(f){ return gdFmtValor(f.wpp3p); }) +
    fila('WhatsApp General', function(f){ return gdFmtValor(f.wppGeneral); }) +
    fila('Total WhatsApp', function(f){ return gdFmtValor(f.wpp3p+f.wppGeneral); }) +
    fila('% 3P (WhatsApp)', function(f){ return pct(f.wpp3p, f.wpp3p+f.wppGeneral); });
  return '<div style="overflow-x:auto;margin-top:10px">' +
    '<table class="aurora-rank-table"><thead><tr><th></th>'+encabezados+'</tr></thead>'+
    '<tbody>'+cuerpo+'</tbody></table></div>';
}
