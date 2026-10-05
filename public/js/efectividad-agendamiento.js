// efectividad-agendamiento.js — Efectividad de Agendamiento de ORLANT
// (Fase 111, pedido textual de Edwin: "el ranking va a ser efectividad por
// agendamiento"). Reemplaza al "Ranking de Asesores" de la Fase 104
// (calculado por CANTIDAD de agendas, vivia dentro de agendas.js) -- ahora
// es su PROPIO panel (`efectividad_agendamiento_panel`), calculado 100% en
// el servidor (puesto, % ponderado del equipo) a partir de la tabla nueva
// `efectividad_agendamiento`.
//
// Sin filtros propios -- el Mes lo pone SOLO el selector global de arriba
// (_gd.mesSel), mismo criterio de "aviso + boton Ver <ultimo mes>" que el
// resto de paneles autonomos (Agendas/Inasistencia/Tipificacion/Trafico,
// Fase 86 tema 3). Tabla con TODOS los asesores (nunca un "Otros") +
// buscador; grafica combo (barras Gestiones/Agendas + linea % Efectividad
// en eje secundario, mismo patron que gd-combo-logic.js) con scroll
// horizontal PROPIO si hay muchos asesores (nunca scroll de la pagina).
'use strict';

var _eaOpciones = {};     // cache por campana: { meses }
var _eaCampanaPorPanel = {};
var _eaUltimoRanking = {}; // i -> ultima respuesta del servidor (para exportar/redibujar en busqueda)
var _eaBusqueda = {};      // i -> texto de busqueda (nombre de asesor)
var EA_PX_POR_ASESOR = 46; // ancho de cada categoria en la grafica combo (scroll interno si no caben)

async function _eaCargarOpciones(campana){
  if(_eaOpciones[campana]) return _eaOpciones[campana];
  var op = { meses: [] };
  try{ op = await apiRequest('GET','/calidad/efectividad-agendamiento/opciones?campana='+encodeURIComponent(campana)); }
  catch(e){ /* sin datos o sin acceso -- el panel muestra "sin datos" */ }
  _eaOpciones[campana] = op;
  return op;
}

async function _efectividadAgendamientoRenderPanel(p, i){
  var campana = p.campana;
  _eaCampanaPorPanel[i] = campana;
  var host = document.getElementById('gd-p'+i);
  if(!host) return;
  var titulo = p.titulo || 'Ranking de Asesores';
  host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">'+esc(titulo)+'</div>'+
    '<div style="text-align:center;color:var(--c-text-muted);padding:20px 8px">Cargando…</div></div>';

  var opciones = await _eaCargarOpciones(campana);
  if(!opciones.meses || !opciones.meses.length){
    host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">'+esc(titulo)+'</div>'+
      '<div style="text-align:center;color:var(--c-text-muted);padding:24px 8px">Sin Efectividad de agendamiento cargada todavia. Un usuario con permiso de administrador debe subir la hoja EFECTIVIDAD_AGENDAMIENTO desde "Cargar Datos".</div></div>';
    return;
  }

  var html = '<div class="aurora-card">';
  html += '<div class="aurora-card-title">'+esc(titulo)+'</div>';
  html += '<div id="ea-aviso-'+i+'"></div>';
  html += '<div id="ea-tarjetas-wrap-'+i+'"></div>';
  html += '<div id="ea-chart-wrap-'+i+'"></div>';
  html += '<div class="search-bar" style="max-width:260px;margin:14px 0 12px"><input type="text" id="ea-buscar-'+i+'" placeholder="Buscar asesor…" oninput="_eaBuscarInput('+i+', this.value)"></div>';
  html += '<div class="table-wrap"><table class="aurora-table" id="ea-tabla-'+i+'"><thead><tr>' +
    '<th>Puesto</th><th style="text-align:left">Asesor</th><th>Gestiones</th><th>Agendas</th><th>% Efectividad</th>' +
    '</tr></thead><tbody></tbody></table></div>';
  html += '</div>';
  host.innerHTML = html;

  await _eaDibujar(campana, i, opciones);
}

function _eaBuscarInput(i, texto){
  _eaBusqueda[i] = texto;
  _eaRenderizarTabla(i);
}

async function _eaDibujar(campana, i, opciones){
  var mesSel = (typeof _gd !== 'undefined') ? _gd.mesSel : '';
  var avisoEl = document.getElementById('ea-aviso-'+i);
  var tarjetasEl = document.getElementById('ea-tarjetas-wrap-'+i);
  var chartWrapEl = document.getElementById('ea-chart-wrap-'+i);

  if(!mesSel || (opciones.meses||[]).indexOf(mesSel) === -1){
    var ultimoConDatos = opciones.meses.length ? opciones.meses[opciones.meses.length-1] : null;
    if(avisoEl) avisoEl.innerHTML = _gdAvisoSinDatosMesHtml('efectividad', mesSel, ultimoConDatos, mesNombreLargo);
    if(tarjetasEl) tarjetasEl.innerHTML = '';
    if(chartWrapEl) chartWrapEl.innerHTML = '';
    _eaUltimoRanking[i] = { filas: [], equipo: { gestiones: 0, agendas: 0, efectividad: 0 } };
    _eaRenderizarTabla(i);
    return;
  }
  if(avisoEl) avisoEl.innerHTML = '';

  var ranking = { filas: [], equipo: { gestiones: 0, agendas: 0, efectividad: 0 } };
  try{ ranking = await apiRequest('GET', '/calidad/efectividad-agendamiento/ranking?campana='+encodeURIComponent(campana)+'&mes='+encodeURIComponent(mesSel)) || ranking; }
  catch(e){ showToast(e.message); }
  _eaUltimoRanking[i] = ranking;
  _eaBusqueda[i] = '';
  var buscarEl = document.getElementById('ea-buscar-'+i);
  if(buscarEl) buscarEl.value = '';

  if(tarjetasEl){
    tarjetasEl.innerHTML = '<div class="aurora-kpis">' +
      '<div class="aurora-kpi gd-kpi"><div class="kv">'+gdFmtValor(ranking.equipo.gestiones)+'</div><div class="kl">Gestiones del mes</div></div>' +
      '<div class="aurora-kpi gd-kpi"><div class="kv">'+gdFmtValor(ranking.equipo.agendas)+'</div><div class="kl">Agendas del mes</div></div>' +
      '<div class="aurora-kpi gd-kpi"><div class="kv">'+efectividadAgendamientoFmtPct(ranking.equipo.efectividad)+'</div><div class="kl">Efectividad del equipo (ponderada)</div></div>' +
      '</div>';
  }

  if(chartWrapEl){
    var anchoMin = Math.max(600, (ranking.filas||[]).length * EA_PX_POR_ASESOR);
    chartWrapEl.innerHTML = '<div style="overflow-x:auto"><div style="min-width:'+anchoMin+'px;height:420px"><canvas id="ea-c-'+i+'"></canvas></div></div>';
  }
  _eaDibujarGrafica(i, ranking.filas||[]);
  _eaRenderizarTabla(i);
}

// Grafica combo (gd-combo-logic.js, mismo patron que los paneles `combo`
// del dashboard generico): columnas Gestiones/Agendas por asesor, linea %
// Efectividad en el eje secundario -- SIEMPRE en el orden del ranking
// (puesto), nunca el orden de busqueda/filtro de la tabla de abajo.
function _eaDibujarGrafica(i, filas){
  var canvasId = 'ea-c-'+i;
  var labels = filas.map(function(f){ return textoFormatoNombre(f.asesor); });
  var barras = [
    { label: 'Gestiones', data: filas.map(function(f){ return f.gestiones; }), color: (typeof CM!=='undefined'?CM:'#1a7a9e') },
    { label: 'Agendas', data: filas.map(function(f){ return f.agendas; }), color: (typeof CD!=='undefined'?CD:'#0d4a5e') },
  ];
  var linea = { label: '% Efectividad', data: filas.map(function(f){ return f.efectividad*100; }), color: (typeof CO!=='undefined'?CO:'#e67e22') };
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
    y: { position:'left', grid:{color:(typeof CHART_GRID!=='undefined'?CHART_GRID:'#f0f4f8')}, ticks:{font:{size:8}} },
    y2: { position:'right', grid:{display:false}, ticks:{font:{size:8}, callback:function(v){ return gdFmtValor(v,'%'); }} },
    x: { grid:{display:false}, ticks:{font:{size:7}} },
  };
  o.plugins.datalabels = { display:true, align:'end', anchor:'end', font:{size:7,weight:'bold'}, color:(typeof CD!=='undefined'?CD:'#0d4a5e'),
    formatter:function(v,ctx){ return ctx.dataset.type==='line' ? (v!=null?gdFmtValor(v,'%'):'') : v; } };
  loDatalabelsAuto(o);
  _gdChart(canvasId, { data: { labels: labels, datasets: ds }, options: o });
}

// Tabla: TODOS los asesores, en el orden ya calculado por el servidor
// (puesto) -- el buscador solo FILTRA por nombre, nunca reordena.
function _eaRenderizarTabla(i){
  var ranking = _eaUltimoRanking[i] || { filas: [] };
  var busqueda = (_eaBusqueda[i]||'').trim().toUpperCase();
  var filas = (ranking.filas||[]).filter(function(f){
    return !busqueda || String(f.asesor||'').toUpperCase().indexOf(busqueda) !== -1;
  });
  var tabla = document.getElementById('ea-tabla-'+i);
  if(!tabla) return;
  var tbody = tabla.querySelector('tbody');
  if(!tbody) return;
  if(!filas.length){
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--c-text-muted);padding:18px">Sin asesores para este filtro.</td></tr>';
    return;
  }
  var paleta = (typeof PC !== 'undefined') ? PC : ['#0d4a5e'];
  tbody.innerHTML = filas.map(function(f){
    var colorTop = (f.puesto && f.puesto<=3) ? paleta[f.puesto-1] : null;
    var estiloFila = colorTop ? ' style="box-shadow:inset 4px 0 0 '+colorTop+'"' : '';
    return '<tr'+estiloFila+'>'+
      '<td>'+f.puesto+'</td>'+
      '<td style="text-align:left">'+esc(textoFormatoNombre(f.asesor))+'</td>'+
      '<td>'+gdFmtValor(f.gestiones)+'</td>'+
      '<td>'+gdFmtValor(f.agendas)+'</td>'+
      '<td>'+efectividadAgendamientoFmtPct(f.efectividad)+'</td>'+
    '</tr>';
  }).join('');
}
