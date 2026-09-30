// inasistencia.js — InConexion Platform (Fase 98, ORLANT, pedido URGENTE de
// Edwin; Fase 101: la vista PRINCIPAL pasa a ser "Por mes", total de todas
// las especialidades juntas -- "Por especialidad" deja de ser la principal).
// Inasistencia tiene 3 sub-pestañas ("Por mes", "Por especialidad",
// "Detalle"), cada una su PROPIO panel `inasistencia_panel` (con un `vista`
// distinto) pero las 3 COMPARTEN los mismos filtros: el estado vive por
// CAMPANA (_inasistenciaEstado[campana]), no por indice de panel -- mismo
// patron que Agendamiento (public/js/agendas.js).
//
// "Por mes" (Fase 101) NUNCA filtra por especialidad -- siempre suma TODAS.
// El mes de sus tarjetas sigue al selector "MES" de arriba (_gd.mesSel),
// igual que antes; su grafica compara TODOS los meses con datos, sin
// importar el mes elegido arriba. "Por especialidad" y "Detalle" si tienen
// filtro de especialidad y siguen mostrando el mes elegido arriba;
// "Por especialidad" ademas trae su propio rango (desde/hasta) opcional
// para la linea de tendencia (movida aqui desde la vieja "Por mes").
'use strict';

var _inasistenciaOpciones = {}; // cache por campana: { meses, especialidades }
var _inasistenciaEstado = {};   // filtros compartidos por campana: { mes, especialidad, desde, hasta }
var _inasistenciaCampanaPorPanel = {};
var _inasistenciaVistaPorPanel = {};
var _inasistenciaCache = {}; // invalidado tras cada carga nueva (ver cargas.js) -- hoy sin uso propio, reservado por si se agrega cache de datos.

var _INASISTENCIA_VISTAS = {
  pormes: { titulo: 'Inasistencia por Mes' },
  porespecialidad: { titulo: 'Inasistencia por Especialidad' },
  detalle: { titulo: 'Detalle de Inasistencia' },
};

function _inasistenciaOptionsHtml(valores, seleccionado){
  return '<option value="">Todas</option>' + (valores||[]).map(function(v){
    return '<option value="'+esc(v)+'"'+(v===seleccionado?' selected':'')+'>'+esc(textoFormatoNombre(v))+'</option>';
  }).join('');
}

async function _inasistenciaCargarOpciones(campana){
  if(_inasistenciaOpciones[campana]) return _inasistenciaOpciones[campana];
  var op = { meses:[], especialidades:[] };
  try{ op = await apiRequest('GET','/calidad/inasistencia/opciones?campana='+encodeURIComponent(campana)); }
  catch(e){ /* sin datos o sin acceso -- se queda vacio, el panel muestra "sin datos" */ }
  _inasistenciaOpciones[campana] = op;
  return op;
}

// El Mes de Inasistencia SIEMPRE sigue al selector global (_gd.mesSel) --
// a diferencia de Agendas, no hay override propio dentro del panel. Devuelve
// true si el mes global no tiene datos de Inasistencia para esta campana.
function _inasistenciaSincronizarConMesGlobal(campana, opciones){
  if(!_inasistenciaEstado[campana]) _inasistenciaEstado[campana] = { especialidad:'', desde:'', hasta:'' };
  var mesGlobal = (typeof _gd !== 'undefined') ? _gd.mesSel : '';
  _inasistenciaEstado[campana].mes = mesGlobal;
  return !mesGlobal || (opciones.meses || []).indexOf(mesGlobal) === -1;
}

function _inasistenciaSumar(filas){
  return (filas||[]).reduce(function(a, r){
    a.cancelada += r.cancelada; a.inasistencia += r.inasistencia; a.pendiente += r.pendiente;
    a.atendidas += r.atendidas; a.total += r.total;
    return a;
  }, { cancelada:0, inasistencia:0, pendiente:0, atendidas:0, total:0 });
}

async function _inasistenciaRenderPanel(p, i){
  var campana = p.campana;
  var vista = p.vista || 'pormes';
  var def = _INASISTENCIA_VISTAS[vista] || _INASISTENCIA_VISTAS.pormes;
  _inasistenciaCampanaPorPanel[i] = campana;
  _inasistenciaVistaPorPanel[i] = vista;
  var host = document.getElementById('gd-p'+i);
  if(!host) return;
  var titulo = p.titulo || def.titulo;
  host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">'+esc(titulo)+'</div>'+
    '<div style="text-align:center;color:var(--c-text-muted);padding:20px 8px">Cargando…</div></div>';

  var opciones = await _inasistenciaCargarOpciones(campana);
  if(!opciones.meses || !opciones.meses.length){
    host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">'+esc(titulo)+'</div>'+
      '<div style="text-align:center;color:var(--c-text-muted);padding:24px 8px">Sin inasistencia cargada todavia. Un usuario con permiso de administrador debe subir la hoja INASISTENCIA desde "Cargar Datos".</div></div>';
    return;
  }

  var sinDatosMes = _inasistenciaSincronizarConMesGlobal(campana, opciones);
  if(vista === 'pormes') await _inasistenciaRenderPorMes(host, campana, i, opciones, titulo, sinDatosMes);
  else if(vista === 'porespecialidad') await _inasistenciaRenderEspecialidad(host, campana, i, opciones, titulo, sinDatosMes);
  else await _inasistenciaRenderDetalle(host, campana, i, opciones, titulo, sinDatosMes);
}

function _inasistenciaTarjetaHtml(titulo, valor, formato, vari){
  var txt = (valor === null || valor === undefined) ? '—' : (formato === 'pct' ? inasistenciaFmtPct(valor) : Math.round(valor).toLocaleString('es-CO'));
  var trendHtml = '';
  if(vari && vari.abs !== undefined){
    var mejorBaja = formato === 'pct'; // % de inasistencia: mas bajo es mejor
    var bueno = vari.plano ? null : (mejorBaja ? vari.baja : vari.sube);
    var tcls = vari.plano ? 'gd-tr-flat' : (bueno ? 'gd-tr-up' : 'gd-tr-down');
    var arrow = vari.plano ? '→' : (vari.sube ? '▲' : '▼');
    var absTxt = formato === 'pct' ? inasistenciaFmtPct(Math.abs(vari.abs)) : Math.round(Math.abs(vari.abs)).toLocaleString('es-CO');
    trendHtml = '<div class="gd-kpi-trend '+tcls+'">'+arrow+' <span>('+(vari.abs>=0?'+':'-')+absTxt+') vs mes anterior</span></div>';
  }
  return '<div class="aurora-kpi gd-kpi"><div class="kv">'+txt+'</div><div class="kl">'+esc(titulo)+'</div>'+trendHtml+'</div>';
}

// ── "Por mes" (Fase 101, vista PRINCIPAL): tarjetas del mes elegido arriba
// -- SIEMPRE todas las especialidades juntas, sin filtro -- mas una sola
// grafica que compara el total de citas contra las inasistencias (incluye
// pendientes) de CADA mes con datos, con el % ponderado en una linea de eje
// secundario. Aviso automatico cuando un mes trae menos especialidades que
// el mes mas completo del rango (ver inasistenciaMesesIncompletos,
// inasistencia-logic.js).
async function _inasistenciaRenderPorMes(host, campana, i, opciones, titulo, sinDatosMes){
  var html = '<div class="aurora-card">';
  html += '<div class="aurora-card-title">'+esc(titulo)+'</div>';
  html += '<div id="inasist-tarjetas-wrap-'+i+'"></div>';
  html += '<div class="aurora-card-title" style="margin-top:10px">Citas vs. inasistencias por mes '+
    '<span class="gd-help" title="Inasistencias (incluye pendientes) = suma de INASISTENCIA + PENDIENTES de TODAS las especialidades, del mes. % de inasistencia = esa suma dividida entre el total de citas del mes, PONDERADO (nunca el promedio simple del % de cada especialidad).">?</span></div>';
  html += '<div class="aurora-chart-wrap" style="height:320px"><canvas id="inasist-c-pormes-'+i+'"></canvas></div>';
  html += '<div id="inasist-aviso-'+i+'"></div>';
  html += '</div>';
  host.innerHTML = html;
  await _inasistenciaDibujarPorMes(campana, i, opciones, sinDatosMes);
}

async function _inasistenciaDibujarPorMes(campana, i, opciones, sinDatosMes){
  var qs = 'campana='+encodeURIComponent(campana);
  var datos = [];
  try{ datos = await apiRequest('GET','/calidad/inasistencia/mensual?'+qs) || []; }catch(e){ showToast(e.message); }
  var agregado = inasistenciaAgregarPorMes(datos);

  // Tarjetas del mes elegido arriba (aviso en su lugar si ese mes no tiene
  // datos -- la grafica de abajo sigue mostrando todos los meses igual).
  var wrap = document.getElementById('inasist-tarjetas-wrap-'+i);
  if(wrap){
    if(sinDatosMes){
      var ultimoConDatos = agregado.length ? agregado[agregado.length-1].mes : null;
      wrap.innerHTML = _gdAvisoSinDatosMesHtml('Inasistencia', _gd.mesSel, ultimoConDatos);
    } else {
      var mes = (_inasistenciaEstado[campana] || {}).mes;
      var idxMes = agregado.map(function(a){ return a.mes; }).indexOf(mes);
      var actual = idxMes !== -1 ? agregado[idxMes] : null;
      var anterior = idxMes > 0 ? agregado[idxMes-1] : null;
      if(actual){
        var variTotal = anterior ? _gdVariacion(actual.total, anterior.total) : null;
        var variAtendidas = anterior ? _gdVariacion(actual.atendidas, anterior.atendidas) : null;
        var variCanceladas = anterior ? _gdVariacion(actual.cancelada, anterior.cancelada) : null;
        var variInasist = anterior ? _gdVariacion(actual.inasistencia, anterior.inasistencia) : null;
        var variPendientes = anterior ? _gdVariacion(actual.pendiente, anterior.pendiente) : null;
        var variPct = anterior ? _gdVariacion(actual.pct, anterior.pct) : null;
        wrap.innerHTML = '<div class="aurora-kpis">' +
          _inasistenciaTarjetaHtml('Total de citas', actual.total, 'entero', variTotal) +
          _inasistenciaTarjetaHtml('Atendidas', actual.atendidas, 'entero', variAtendidas) +
          _inasistenciaTarjetaHtml('Canceladas', actual.cancelada, 'entero', variCanceladas) +
          _inasistenciaTarjetaHtml('Inasistencia', actual.inasistencia, 'entero', variInasist) +
          _inasistenciaTarjetaHtml('Pendientes', actual.pendiente, 'entero', variPendientes) +
          _inasistenciaTarjetaHtml('% de inasistencia', actual.pct, 'pct', variPct) +
          '</div>';
      } else {
        wrap.innerHTML = '';
      }
    }
  }

  var labels = agregado.map(function(a){ return inasistenciaMesLbl(a.mes); });
  var barras = [
    { label: 'Total de citas', data: agregado.map(function(a){ return a.total; }), color: (typeof CM!=='undefined'?CM:'#1a7a9e') },
    { label: 'Inasistencias (incluye pendientes)', data: agregado.map(function(a){ return a.inasistenciaPendiente; }), color: (typeof CR!=='undefined'?CR:'#e74c3c') },
  ];
  var linea = { label: '% de inasistencia', data: agregado.map(function(a){ return a.pct; }), color: (typeof CD!=='undefined'?CD:'#0d4a5e') };
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
    y: { position:'left', grid:{color:(typeof CHART_GRID!=='undefined'?CHART_GRID:'#f0f4f8')}, ticks:{font:{size:8}, callback:function(v){ return gdFmtValor(v); }} },
    y2: { position:'right', grid:{display:false}, ticks:{font:{size:8}, callback:function(v){ return gdFmtValor(v,'%'); }} },
    x: { grid:{display:false}, ticks:{font:{size:8}} },
  };
  o.plugins.datalabels = {
    display: true, align:'end', anchor:'end', font:{size:7,weight:'bold'}, color:(typeof CD!=='undefined'?CD:'#0d4a5e'),
    formatter: function(v, ctx){ if(v===null||v===undefined) return ''; return ctx.dataset.type==='line' ? gdFmtValor(v,'%') : gdFmtValor(v); },
  };
  loDatalabelsAuto(o);
  _gdChart('inasist-c-pormes-'+i, { data: { labels: labels, datasets: ds }, options: o });

  // Aviso: meses con menos especialidades que el mes mas completo del rango
  // -- nunca se comparan como si fueran el mes completo.
  var avisoEl = document.getElementById('inasist-aviso-'+i);
  if(avisoEl){
    var incompletos = inasistenciaMesesIncompletos(agregado);
    avisoEl.innerHTML = incompletos.map(function(m){
      var nombres = m.especialidades.map(textoFormatoNombre).join(', ');
      return '<div style="margin-top:10px;padding:10px 14px;border-radius:8px;background:var(--c-warning-bg);border:1px solid var(--c-warning);color:var(--c-warning-dark);font-size:0.82rem">'+
        esc(inasistenciaMesLbl(m.mes)+': solo incluye '+nombres+'.')+'</div>';
    }).join('');
  }
}

// ── "Por especialidad": filtro de especialidad + 2 graficas del mes
// elegido arriba, mas la linea de tendencia de % por especialidad a lo
// largo de los meses (Fase 101: movida aqui desde la vieja "Por mes") ─────
async function _inasistenciaRenderEspecialidad(host, campana, i, opciones, titulo, sinDatosMes){
  var estado = _inasistenciaEstado[campana];
  var html = '<div class="aurora-card">';
  html += '<div class="aurora-card-title">'+esc(titulo)+'</div>';
  html += '<div class="form-row" style="flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:14px">';
  html += '<div class="ig" style="min-width:170px;margin-bottom:0"><label>Especialidad</label><select id="inasist-f-especialidad-'+i+'">'+_inasistenciaOptionsHtml(opciones.especialidades, estado.especialidad)+'</select></div>';
  html += '<div class="ig" style="min-width:110px;margin-bottom:0"><label>Desde (mes)</label><input type="month" id="inasist-f-desde-'+i+'" value="'+esc(estado.desde||'')+'"></div>';
  html += '<div class="ig" style="min-width:110px;margin-bottom:0"><label>Hasta (mes)</label><input type="month" id="inasist-f-hasta-'+i+'" value="'+esc(estado.hasta||'')+'"></div>';
  html += '<div class="ig" style="margin-bottom:0"><button class="btn-primary" onclick="_inasistenciaAplicarFiltros('+i+')">Aplicar filtros</button></div>';
  html += '</div>';
  html += '<div id="inasist-porespecialidad-mesactual-'+i+'"></div>';
  html += '<div class="aurora-card-title" style="margin-top:10px">% de inasistencia por especialidad, a lo largo de los meses</div>';
  html += '<div class="aurora-chart-wrap" style="height:300px"><canvas id="inasist-c-mes-'+i+'"></canvas></div>';
  html += '</div>';
  host.innerHTML = html;
  await _inasistenciaDibujarEspecialidad(campana, i, opciones, sinDatosMes);
}

async function _inasistenciaDibujarEspecialidad(campana, i, opciones, sinDatosMes){
  var estado = _inasistenciaEstado[campana];
  var contMesActual = document.getElementById('inasist-porespecialidad-mesactual-'+i);

  if(contMesActual){
    if(sinDatosMes){
      var ultimoConDatos = opciones.meses[opciones.meses.length-1];
      contMesActual.innerHTML = _gdAvisoSinDatosMesHtml('Inasistencia', _gd.mesSel, ultimoConDatos);
    } else {
      contMesActual.innerHTML =
        '<div class="aurora-grid-2">' +
        '<div class="aurora-card"><div class="aurora-card-title">% de inasistencia por especialidad <span class="gd-help" title="(Inasistencia + Pendientes) / Total, por especialidad. Los pendientes cuentan como inasistencia; cancelados van en el denominador.">?</span></div><div class="aurora-chart-wrap" style="height:260px"><canvas id="inasist-c-pct-'+i+'"></canvas></div></div>' +
        '<div class="aurora-card"><div class="aurora-card-title">Citas por estado y especialidad</div><div class="aurora-chart-wrap" style="height:260px"><canvas id="inasist-c-apilada-'+i+'"></canvas></div></div>' +
        '</div>';

      var mes = estado.mes;
      var qs = 'campana='+encodeURIComponent(campana)+'&mes='+encodeURIComponent(mes)+(estado.especialidad?('&especialidad='+encodeURIComponent(estado.especialidad)):'');
      var datos = [];
      try{ datos = await apiRequest('GET','/calidad/inasistencia/especialidad?'+qs) || []; }catch(e){ showToast(e.message); }

      var o1 = loPct(null);
      o1.plugins.datalabels.align = 'end';
      _gdChart('inasist-c-pct-'+i, {
        type: 'bar',
        data: { labels: datos.map(function(r){ return textoFormatoNombre(r.especialidad); }),
          datasets: [{ label: '% Inasistencia', data: datos.map(function(r){ return inasistenciaPctPonderado(r.inasistencia, r.pendiente, r.total) || 0; }),
            backgroundColor: datos.map(function(r){ return paletaColorPara(r.especialidad); }), borderRadius: 3 }] },
        options: loDatalabelsAuto(o1),
      });

      var o2 = loBar(null);
      o2.scales.x = Object.assign({}, o2.scales.x, { stacked: true });
      o2.scales.y = Object.assign({}, o2.scales.y, { stacked: true });
      _gdChart('inasist-c-apilada-'+i, {
        type: 'bar',
        data: { labels: datos.map(function(r){ return textoFormatoNombre(r.especialidad); }),
          datasets: [
            { label: 'Atendidas', data: datos.map(function(r){ return r.atendidas; }), backgroundColor: CG, borderRadius: 2 },
            { label: 'Canceladas', data: datos.map(function(r){ return r.cancelada; }), backgroundColor: CM, borderRadius: 2 },
            { label: 'Inasistencia', data: datos.map(function(r){ return r.inasistencia; }), backgroundColor: CR, borderRadius: 2 },
            { label: 'Pendientes', data: datos.map(function(r){ return r.pendiente; }), backgroundColor: CO, borderRadius: 2 },
          ] },
        options: loDatalabelsAuto(o2),
      });
    }
  }

  // Linea de tendencia por especialidad (independiente del mes global --
  // usa el rango desde/hasta propio de este panel, igual que antes).
  var qsTrend = 'campana='+encodeURIComponent(campana)+(estado.especialidad?('&especialidad='+encodeURIComponent(estado.especialidad)):'')+(estado.desde?('&desde='+estado.desde):'')+(estado.hasta?('&hasta='+estado.hasta):'');
  var datosTrend = [];
  try{ datosTrend = await apiRequest('GET','/calidad/inasistencia/mensual?'+qsTrend) || []; }catch(e){ showToast(e.message); }

  var mesesT = datosTrend.map(function(r){ return r.mes; }).filter(function(v,idx,arr){ return arr.indexOf(v)===idx; }).sort();
  var especialidadesT = estado.especialidad ? [estado.especialidad] :
    datosTrend.map(function(r){ return r.especialidad; }).filter(function(v,idx,arr){ return arr.indexOf(v)===idx; }).sort();

  var porMesEsp = {};
  var totalesPorMes = {};
  datosTrend.forEach(function(r){
    porMesEsp[r.mes+'|'+r.especialidad] = r;
    if(!totalesPorMes[r.mes]) totalesPorMes[r.mes] = { inasistencia:0, pendiente:0, total:0 };
    totalesPorMes[r.mes].inasistencia += r.inasistencia;
    totalesPorMes[r.mes].pendiente += r.pendiente;
    totalesPorMes[r.mes].total += r.total;
  });

  var datasetsT = especialidadesT.map(function(esp){
    return {
      label: textoFormatoNombre(esp),
      data: mesesT.map(function(m){ var r = porMesEsp[m+'|'+esp]; return r ? (inasistenciaPctPonderado(r.inasistencia, r.pendiente, r.total) || 0) : null; }),
      borderColor: paletaColorPara(esp), backgroundColor: paletaColorPara(esp), fill: false, tension: 0.15,
    };
  });
  // "Total" ponderado (todas las especialidades) -- solo tiene sentido
  // cuando no hay un filtro de especialidad puesto (si ya filtro a una
  // sola, el Total coincidiria exacto con su unica serie, ruido de mas).
  if(!estado.especialidad){
    datasetsT.push({
      label: 'Total', borderColor: (typeof CD!=='undefined'?CD:'#0d4a5e'), backgroundColor: (typeof CD!=='undefined'?CD:'#0d4a5e'),
      borderWidth: 3, borderDash: [6,3], fill: false, tension: 0.15,
      data: mesesT.map(function(m){ var t = totalesPorMes[m]; return t ? (inasistenciaPctPonderado(t.inasistencia, t.pendiente, t.total) || 0) : null; }),
    });
  }

  var oT = loPct(null);
  _gdChart('inasist-c-mes-'+i, {
    type: 'line',
    data: { labels: mesesT.map(inasistenciaMesLbl), datasets: datasetsT },
    options: loDatalabelsAuto(oT),
  });
}

// ── "Detalle": tabla cruda del mes + fila de total ──────────────────────
async function _inasistenciaRenderDetalle(host, campana, i, opciones, titulo, sinDatosMes){
  if(sinDatosMes){
    var ultimoConDatos = opciones.meses[opciones.meses.length-1];
    host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">'+esc(titulo)+'</div>'+
      _gdAvisoSinDatosMesHtml('Inasistencia', _gd.mesSel, ultimoConDatos) + '</div>';
    return;
  }
  var estado = _inasistenciaEstado[campana];
  var html = '<div class="aurora-card">';
  html += '<div class="aurora-card-title">'+esc(titulo)+'</div>';
  html += '<div class="form-row" style="flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:14px">';
  html += '<div class="ig" style="min-width:170px;margin-bottom:0"><label>Especialidad</label><select id="inasist-f-especialidad-'+i+'">'+_inasistenciaOptionsHtml(opciones.especialidades, estado.especialidad)+'</select></div>';
  html += '<div class="ig" style="margin-bottom:0"><button class="btn-primary" onclick="_inasistenciaAplicarFiltros('+i+')">Aplicar filtros</button></div>';
  html += '</div>';
  html += '<div style="overflow-x:auto"><table class="aurora-rank-table" id="inasist-tabla-'+i+'"></table></div>';
  html += '</div>';
  host.innerHTML = html;
  await _inasistenciaDibujarDetalle(campana, i);
}

async function _inasistenciaDibujarDetalle(campana, i){
  var estado = _inasistenciaEstado[campana];
  var mes = estado.mes;
  var qs = 'campana='+encodeURIComponent(campana)+'&mes='+encodeURIComponent(mes)+(estado.especialidad?('&especialidad='+encodeURIComponent(estado.especialidad)):'');
  var datos = [];
  try{ datos = await apiRequest('GET','/calidad/inasistencia/especialidad?'+qs) || []; }catch(e){ showToast(e.message); }

  var tabla = document.getElementById('inasist-tabla-'+i);
  if(!tabla) return;
  if(!datos.length){
    tabla.innerHTML = '<tr><td style="text-align:center;color:var(--c-text-muted)">Sin datos de Inasistencia para el mes/filtros actuales.</td></tr>';
    return;
  }
  var mesLbl = inasistenciaMesLbl(mes);
  var filasHtml = datos.map(function(r){
    var pct = inasistenciaPctPonderado(r.inasistencia, r.pendiente, r.total);
    return '<tr><td>'+esc(mesLbl)+'</td><td>'+esc(textoFormatoNombre(r.especialidad))+'</td>'+
      '<td>'+r.cancelada.toLocaleString('es-CO')+'</td><td>'+r.inasistencia.toLocaleString('es-CO')+'</td>'+
      '<td>'+r.pendiente.toLocaleString('es-CO')+'</td><td>'+r.atendidas.toLocaleString('es-CO')+'</td>'+
      '<td>'+r.total.toLocaleString('es-CO')+'</td><td>'+(r.inasistencia+r.pendiente).toLocaleString('es-CO')+'</td>'+
      '<td>'+esc(inasistenciaFmtPct(pct))+'</td></tr>';
  }).join('');
  var tot = _inasistenciaSumar(datos);
  var pctTot = inasistenciaPctPonderado(tot.inasistencia, tot.pendiente, tot.total);
  var filaTotal = '<tr style="font-weight:600"><td>'+esc(mesLbl)+'</td><td>Total</td>'+
    '<td>'+tot.cancelada.toLocaleString('es-CO')+'</td><td>'+tot.inasistencia.toLocaleString('es-CO')+'</td>'+
    '<td>'+tot.pendiente.toLocaleString('es-CO')+'</td><td>'+tot.atendidas.toLocaleString('es-CO')+'</td>'+
    '<td>'+tot.total.toLocaleString('es-CO')+'</td><td>'+(tot.inasistencia+tot.pendiente).toLocaleString('es-CO')+'</td>'+
    '<td>'+esc(inasistenciaFmtPct(pctTot))+'</td></tr>';

  tabla.innerHTML = '<tr><th>Mes</th><th>Especialidad</th><th>Canceladas</th><th>Inasistencia</th><th>Pendientes</th><th>Atendidas</th><th>Total</th><th>Inasistencia + Pendientes</th><th>% Inasistencia</th></tr>' + filasHtml + filaTotal;
}

// ── Filtros compartidos (leer del DOM + redibujar la vista activa) ──────
// "pormes" no tiene formulario de filtros (Fase 101: sin filtro de
// especialidad, siempre todas juntas) -- nunca se llama para esa vista.
function _inasistenciaLeerFiltros(i, vista){
  function v(id){ var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  var out = { especialidad: v('inasist-f-especialidad-'+i) };
  if(vista === 'porespecialidad'){
    out.desde = v('inasist-f-desde-'+i);
    out.hasta = v('inasist-f-hasta-'+i);
  }
  return out;
}

async function _inasistenciaAplicarFiltros(i){
  var campana = _inasistenciaCampanaPorPanel[i];
  if(!campana) return;
  var vista = _inasistenciaVistaPorPanel[i] || 'porespecialidad';
  var leidos = _inasistenciaLeerFiltros(i, vista);
  _inasistenciaEstado[campana] = Object.assign({}, _inasistenciaEstado[campana], leidos);
  var opciones = _inasistenciaOpciones[campana] || { meses: [], especialidades: [] };
  if(vista === 'porespecialidad'){
    var sinDatosMes = _inasistenciaSincronizarConMesGlobal(campana, opciones);
    await _inasistenciaDibujarEspecialidad(campana, i, opciones, sinDatosMes);
  } else if(vista === 'detalle'){
    await _inasistenciaDibujarDetalle(campana, i);
  }
}
