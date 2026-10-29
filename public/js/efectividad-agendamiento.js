// efectividad-agendamiento.js — Efectividad de Agendamiento de ORLANT
// (Fase 111, pedido textual de Edwin: "el ranking va a ser efectividad por
// agendamiento"). Reemplaza al "Ranking de Asesores" de la Fase 104
// (calculado por CANTIDAD de agendas, vivia dentro de agendas.js) -- ahora
// es su PROPIO panel (`efectividad_agendamiento_panel`), calculado 100% en
// el servidor (puesto, % ponderado del equipo) a partir de la tabla nueva
// `efectividad_agendamiento`.
//
// Sin filtros propios -- el Mes lo pone SOLO el selector global de arriba
// (Fase 207: los meses de MESES), mismo criterio de "aviso + boton Ver <ultimo mes>" que el
// resto de paneles autonomos (Agendas/Inasistencia/Tipificacion/Trafico,
// Fase 86 tema 3). Tabla con TODOS los asesores (nunca un "Otros") +
// buscador; grafica combo (barras Gestiones/Agendas + linea % Efectividad
// en eje secundario, mismo patron que gd-combo-logic.js) con scroll
// horizontal PROPIO si hay muchos asesores (nunca scroll de la pagina).
//
// Fase 213 (pedido de Edwin, solo ORLANT): el servidor manda `fuente:
// 'contactos'` -- "gestiones" son las contestadas del asesor (llamadas +
// WhatsApp del CDR de Tipificacion; Fase 214: ingreso + salida), "OTROS" y los usuarios sin
// asesor van aparte (`aparte`, en una nota). Ver
// efectividadAgendamientoDesdeContactos (server/efectividad-agendamiento.js).
'use strict';

var _eaOpciones = {};     // cache por campana: { meses }
var _eaCampanaPorPanel = {};
var _eaUltimoRanking = {}; // i -> ultima respuesta del servidor (para exportar/redibujar en busqueda)
var _eaBusqueda = {};      // i -> texto de busqueda (nombre de asesor)
var _eaLinea = {};         // Fase 214: campana -> '' (Todos) | 'GENERAL' | '3P' (solo las agendas)
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
      '<div style="text-align:center;color:var(--c-text-muted);padding:24px 8px">Sin datos para el ranking todavía. '+(campana === 'ORLANT' ? 'Sale de las agendas y de la Tipificación cargadas.' : 'Un usuario con permiso de administrador debe subir la hoja EFECTIVIDAD_AGENDAMIENTO desde "Cargar Datos".')+'</div></div>';
    return;
  }

  var html = '<div class="aurora-card">';
  html += '<div class="aurora-card-title">'+esc(titulo)+'</div>';
  html += '<div id="ea-aviso-'+i+'"></div>';
  html += '<div id="ea-tarjetas-wrap-'+i+'"></div>';
  html += '<div id="ea-nota-'+i+'"></div>'; // Fase 213
  html += '<div id="ea-chart-wrap-'+i+'"></div>';
  html += '<div class="search-bar" style="max-width:260px;margin:14px 0 12px"><input type="text" id="ea-buscar-'+i+'" aria-label="Buscar asesor" placeholder="Buscar asesor…" oninput="_eaBuscarInput('+i+', this.value)"></div>';
  html += '<div class="table-wrap"><table class="aurora-table" id="ea-tabla-'+i+'"><thead><tr>' +
    '<th>Puesto</th><th style="text-align:left">Asesor</th><th class="ea-col-contactos" hidden>Ingreso</th><th class="ea-col-contactos" hidden>Salida</th><th id="ea-th-gestiones-'+i+'">Gestiones</th><th>Agendas</th><th>% Efectividad</th>' +
    '</tr></thead><tbody></tbody></table></div>';
  html += '</div>';
  host.innerHTML = html;

  await _eaDibujar(campana, i, opciones);
}

function _eaBuscarInput(i, texto){
  _eaBusqueda[i] = texto;
  _eaRenderizarTabla(i);
}

// Fase 207: meses del panel = los de MESES que tienen datos (Todos = todos).
function _eaMesesPanel(opciones){
  var conDatos = (opciones && opciones.meses) || [];
  return gdMesesTarjetasActual().filter(function(m){ return conDatos.indexOf(m) !== -1; });
}
async function _eaDibujar(campana, i, opciones){
  var mesesEa = _eaMesesPanel(opciones);
  var avisoEl = document.getElementById('ea-aviso-'+i);
  var tarjetasEl = document.getElementById('ea-tarjetas-wrap-'+i);
  var chartWrapEl = document.getElementById('ea-chart-wrap-'+i);

  if(!mesesEa.length){
    var ultimoConDatos = opciones.meses.length ? opciones.meses[opciones.meses.length-1] : null;
    if(avisoEl) avisoEl.innerHTML = _gdAvisoSinDatosMesHtml('efectividad', _gdMeses().slice(-1)[0] || '', ultimoConDatos, mesNombreLargo);
    if(tarjetasEl) tarjetasEl.innerHTML = '';
    if(chartWrapEl) chartWrapEl.innerHTML = '';
    _eaUltimoRanking[i] = { filas: [], equipo: { gestiones: 0, agendas: 0, efectividad: 0 } };
    _eaRenderizarTabla(i);
    return;
  }
  if(avisoEl) avisoEl.innerHTML = '';

  var ranking = { filas: [], equipo: { gestiones: 0, agendas: 0, efectividad: 0 } };
  try{ ranking = await apiRequest('GET', _eaRankingUrl(campana, mesesEa)) || ranking; }
  catch(e){ showToast(e.message, 'error'); }
  _eaUltimoRanking[i] = ranking;
  _eaBusqueda[i] = '';
  var buscarEl = document.getElementById('ea-buscar-'+i);
  if(buscarEl) buscarEl.value = '';

  var contactos = ranking.fuente === 'contactos'; // Fase 213
  var thG = document.getElementById('ea-th-gestiones-'+i);
  if(thG) thG.textContent = contactos ? 'Contestadas' : 'Gestiones';
  // Fase 214: ingreso y salida por separado (solo ORLANT).
  Array.prototype.forEach.call(document.querySelectorAll('#ea-tabla-'+i+' .ea-col-contactos'), function(th){ th.hidden = !contactos; });
  var notaEl = document.getElementById('ea-nota-'+i);
  if(notaEl) notaEl.innerHTML = contactos ? _eaNotaContactosHtml(ranking) : '';
  if(tarjetasEl){
    var lblEa = gdMesesTarjetasTexto(mesesEa, !_gdMeses().length, mesNombreLargo); // Fase 207
    tarjetasEl.innerHTML = '<div class="aurora-kpis">' + (contactos ? _eaFiltroLineaHtml(campana, i) : '') +
      '<div class="aurora-kpi gd-kpi"><div class="kv">'+gdFmtValor(ranking.equipo.gestiones)+'</div><div class="kl">'+(contactos ? 'Contestadas (ingreso + salida)' : 'Gestiones')+' · '+esc(lblEa)+'</div></div>' +
      '<div class="aurora-kpi gd-kpi"><div class="kv">'+gdFmtValor(ranking.equipo.agendas)+'</div><div class="kl">'+esc(_eaAgendasTexto(campana, contactos))+' · '+esc(lblEa)+'</div></div>' +
      '<div class="aurora-kpi gd-kpi"><div class="kv">'+efectividadAgendamientoFmtPct(ranking.equipo.efectividad)+'</div><div class="kl">Efectividad del equipo (ponderada)</div></div>' +
      '</div>';
  }

  if(chartWrapEl){
    var anchoMin = Math.max(600, (ranking.filas||[]).length * EA_PX_POR_ASESOR);
    chartWrapEl.innerHTML = '<div style="overflow-x:auto"><div style="min-width:'+anchoMin+'px;height:420px"><canvas id="ea-c-'+i+'"></canvas></div></div>';
  }
  _eaDibujarGrafica(i, ranking.filas||[], contactos);
  _eaRenderizarTabla(i);
}

// Fase 214 (pedido de Edwin): filtro "Todos / 3P / General" de las agendas, al
// lado de las metricas; arranca en Todos. No cambia la Clasificacion de usuarios.
var EA_LINEAS = [['', 'Todos'], ['3P', '3P'], ['GENERAL', 'General']];
function _eaRankingUrl(campana, meses){
  var url = '/calidad/efectividad-agendamiento/ranking?campana='+encodeURIComponent(campana)+'&meses='+encodeURIComponent(meses.join(','));
  return _eaLinea[campana] ? url + '&linea=' + encodeURIComponent(_eaLinea[campana]) : url;
}
function _eaLineaTexto(campana){
  var l = _eaLinea[campana] || '';
  return l === 'GENERAL' ? 'General' : l;
}
function _eaAgendasTexto(campana, contactos){
  return contactos && _eaLinea[campana] ? 'Agendas ' + _eaLineaTexto(campana) : 'Agendas';
}
function _eaFiltroLineaHtml(campana, i){
  var actual = _eaLinea[campana] || '';
  return '<div class="ig agendas-filtro-destacado ea-filtro-linea" style="margin-bottom:0"><label for="ea-f-linea-'+i+'">Agendas</label>'+
    '<select id="ea-f-linea-'+i+'" onchange="_eaCambiarLinea('+i+', this.value)">'+
    EA_LINEAS.map(function(o){ return '<option value="'+o[0]+'"'+(o[0]===actual?' selected':'')+'>'+o[1]+'</option>'; }).join('')+'</select></div>';
}
async function _eaCambiarLinea(i, valor){
  var campana = _eaCampanaPorPanel[i];
  _eaLinea[campana] = valor || '';
  await _eaDibujar(campana, i, _eaOpciones[campana] || { meses: [] });
  var sel = document.getElementById('ea-f-linea-'+i);
  if(sel) sel.focus();
}

// Fase 213: como se calcula, que el total no cuadra exacto con Efectividad de
// Citas, y "OTROS" (y usuarios sin asesor) aparte, con sus agendas.
// Fase 214: contestadas = todo el CDR (ingreso + salida); quien pasa del 100 %
// lleva la marca; los agentes de Wolkvox sin usuario van con "OTROS".
function _eaNotaContactosHtml(ranking){
  var aparte = (ranking.aparte || []).map(function(a){
    return esc(textoFormatoNombre(a.asesor)) + ': ' + (a.sinUsuario ? gdFmtValor(a.gestiones) + ' contestadas, sin usuario de Agendamiento' : gdFmtValor(a.agendas) + ' agendas');
  });
  var marcados = (ranking.filas || []).filter(function(f){ return f.sobreWolkvox; }).length;
  return '<p class="tipif-linea-nota">Efectividad por asesor = agendas del asesor ÷ sus contestadas (llamadas + WhatsApp, de ingreso y de salida, del CDR de Tipificación). '+
    (marcados ? '⚠ = ' + EA_MARCA_WOLKVOX + ' (más del 100 %): en la gráfica su punto queda arriba, con su % real en la cifra. ' : '') +
    'El total del equipo no cuadra exacto con Efectividad de Citas, que usa los reportes de Tráfico: el CDR y el reporte de Wolkvox cuentan distinto.'+
    (ranking.linea ? ' Filtro ' + esc(ranking.linea === 'GENERAL' ? 'General' : ranking.linea) + ': solo cambian las agendas; las contestadas son todas las del asesor (el CDR no trae la línea).' : '') +
    (aparte.length ? ' Fuera del ranking: ' + aparte.join(' · ') + '.' : '') + '</p>';
}

// Grafica combo (gd-combo-logic.js, mismo patron que los paneles `combo`
// del dashboard generico): columnas Gestiones/Agendas por asesor, linea %
// Efectividad en el eje secundario -- SIEMPRE en el orden del ranking
// (puesto), nunca el orden de busqueda/filtro de la tabla de abajo.
function _eaDibujarGrafica(i, filas, contactos){
  var canvasId = 'ea-c-'+i;
  var labels = filas.map(function(f){ return textoFormatoNombre(f.asesor); });
  var barras = [
    { label: contactos ? 'Contestadas (ingreso + salida)' : 'Gestiones', data: filas.map(function(f){ return f.gestiones; }), color: contactos && typeof colorSerie==='function' ? colorSerie('principal') : (typeof CM!=='undefined'?CM:'#1a7a9e') },
    { label: 'Agendas', data: filas.map(function(f){ return f.agendas; }), color: contactos && typeof colorSerie==='function' ? colorSerie('secundaria') : (typeof CD!=='undefined'?CD:'#0d4a5e') },
  ];
  var techo = contactos ? eaTechoPct(filas) : null; // Fase 214
  var linea = { label: '% Efectividad', data: filas.map(function(f){ return f.efectividad === null ? null : (contactos ? eaPctEnEscala(f, techo) : f.efectividad*100); }), color: (typeof colorSerie==='function' ? colorSerie('linea') : '#0d4a5e') } // Fase 152 (B1): paleta categorica, no semaforo;
  var ds = gdComboDatasets(barras, linea);
  if(contactos && typeof estiloBarraSecundaria === 'function') Object.assign(ds[1], estiloBarraSecundaria()); // Fase 213
  // Fase 152 (B9): "agendas de gestiones" en el tooltip y en Ver datos.
  ds.forEach(function(d){ if(d.type === 'line') d.fraccion = { num: filas.map(function(f){ return f.agendas; }), den: filas.map(function(f){ return f.gestiones; }) }; });
  var o = loBar();
  o.plugins.legend.labels = Object.assign({}, o.plugins.legend.labels, {
    generateLabels: function(chart){
      return chart.data.datasets.map(function(dset, idx){
        var color = dset.type === 'line' ? dset.borderColor : dset.backgroundColor;
        return { text: dset.label, fontColor: leyendaColorTexto(), fillStyle: color, strokeStyle: color, lineWidth: dset.type==='line' ? 2 : 0, hidden: !chart.isDatasetVisible(idx), datasetIndex: idx };
      });
    }
  });
  o.scales = {
    // Fase 214: ejes con el color del tema (antes el #666 de Chart.js, oscuro en tema oscuro).
    y: { position:'left', grid:{color:(typeof CHART_GRID!=='undefined'?CHART_GRID:'#f0f4f8')}, ticks:{font:{size:12}, color:_eaTick()} },
    y2: { position:'right', grid:{display:false}, ticks:{font:{size:12}, color:_eaTick(), callback:function(v){ return gdFmtValor(v,'%'); }} },
    x: { grid:{display:false}, ticks:{font:{size:12}, color:_eaTick()} },
  };
  o.plugins.datalabels = { display:true, align:'end', anchor:'end', font:{size:12,weight:'bold'}, color:(typeof CD!=='undefined'?CD:'#0d4a5e'),
    formatter:function(v,ctx){ return ctx.dataset.type==='line' ? (v!=null?gdFmtValor(v,'%'):'') : v; } };
  // Fase 213: cifras legibles en los 2 temas (mismo criterio que Efectividad de
  // Citas, v1.100.1). Con muchos asesores, solo las del %.
  if(contactos){
    o.plugins.datalabels.color = (typeof colorSerie==='function' ? colorSerie('principal') : '#004150');
    o.plugins.datalabels.backgroundColor = (typeof CHART_DL_BG!=='undefined' ? CHART_DL_BG : 'rgba(255,255,255,0.75)');
    o.plugins.datalabels.borderRadius = 3;
    o.plugins.datalabels.display = function(ctx){ return ctx.dataset.type === 'line'; };
    o.scales.y.grace = '8%';
    // Fase 214: el eje del % no pasa del techo (eaTechoPct); los marcados (⚠)
    // quedan arriba y muestran su % real en la cifra, el tooltip y Ver datos.
    o.scales.y2.min = 0;
    o.scales.y2.max = techo;
    o.layout = Object.assign({}, o.layout, { padding: Object.assign({}, (o.layout && o.layout.padding) || {}, { top: 28 }) });
    var pctReal = function(k){ var f = filas[k]; return f && f.efectividad !== null ? gdFmtValor(f.efectividad*100,'%') : ''; };
    o.plugins.datalabels.formatter = function(v, ctx){
      if(ctx.dataset.type !== 'line') return v;
      var f = filas[ctx.dataIndex];
      return f && f.sobreWolkvox ? '⚠ ' + pctReal(ctx.dataIndex) : (v!=null?gdFmtValor(v,'%'):'');
    };
    o.plugins.tooltip = o.plugins.tooltip || {};
    o.plugins.tooltip.callbacks = Object.assign({}, o.plugins.tooltip.callbacks, { label: function(ctx){
      if(ctx.dataset.type !== 'line') return (ctx.dataset.label ? ctx.dataset.label + ': ' : '') + gdFmtValor(ctx.raw);
      var f = filas[ctx.dataIndex];
      return '% Efectividad: ' + pctReal(ctx.dataIndex) + (f && f.sobreWolkvox ? ' ⚠ ' + EA_MARCA_WOLKVOX : '');
    } });
  }
  loDatalabelsAuto(o);
  _gdChart(canvasId, { data: { labels: labels, datasets: ds }, options: o });
}

function _eaTick(){ return typeof CHART_TICK!=='undefined' ? CHART_TICK : '#4f6f7d'; }

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
    tbody.innerHTML = '<tr><td colspan="'+(ranking.fuente === 'contactos' ? 7 : 5)+'" style="text-align:center;color:var(--c-text-muted);padding:18px">Sin asesores para este filtro.</td></tr>';
    return;
  }
  var paleta = (typeof PC !== 'undefined') ? PC : ['#0d4a5e'];
  tbody.innerHTML = filas.map(function(f){
    var colorTop = (f.puesto && f.puesto<=3) ? paleta[f.puesto-1] : null;
    var estiloFila = colorTop ? ' style="box-shadow:inset 4px 0 0 '+colorTop+'"' : '';
    return '<tr'+estiloFila+'>'+
      '<td>'+f.puesto+'</td>'+
      '<td style="text-align:left">'+esc(textoFormatoNombre(f.asesor))+'</td>'+
      (ranking.fuente === 'contactos' ? '<td>'+gdFmtValor(f.ingreso)+'</td><td>'+gdFmtValor(f.salida)+'</td>' : '')+ // Fase 214
      '<td>'+gdFmtValor(f.gestiones)+'</td>'+
      '<td>'+gdFmtValor(f.agendas)+'</td>'+
      '<td>'+efectividadAgendamientoFmtPct(f.efectividad)+(f.sobreWolkvox ? ' <span class="ea-marca-wolkvox">⚠ '+EA_MARCA_WOLKVOX+'</span>' : '')+'</td>'+
    '</tr>';
  }).join('');
}
