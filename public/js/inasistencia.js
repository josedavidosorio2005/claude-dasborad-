// inasistencia.js — InConexion Platform (Fase 98, ORLANT, pedido URGENTE de
// Edwin). Inasistencia tiene 3 sub-pestañas ("Por especialidad", "Por mes",
// "Detalle"), cada una su PROPIO panel `inasistencia_panel` (con un `vista`
// distinto) pero las 3 COMPARTEN los mismos filtros: el estado vive por
// CAMPANA (_inasistenciaEstado[campana]), no por indice de panel -- mismo
// patron que Agendamiento (public/js/agendas.js).
//
// A diferencia de Agendamiento, el filtro de Mes de Inasistencia NO tiene un
// <select> propio: siempre sigue al selector "MES" de arriba (_gd.mesSel) --
// "Por especialidad" y "Detalle" muestran ese mes; "Por mes" lo ignora a
// proposito (linea de tendencia, mismo criterio que "Total de Agendas por
// Mes") y en su lugar ofrece un rango (desde/hasta) opcional.
'use strict';

var _inasistenciaOpciones = {}; // cache por campana: { meses, especialidades }
var _inasistenciaEstado = {};   // filtros compartidos por campana: { mes, especialidad, desde, hasta }
var _inasistenciaCampanaPorPanel = {};
var _inasistenciaVistaPorPanel = {};
var _inasistenciaCache = {}; // invalidado tras cada carga nueva (ver cargas.js) -- hoy sin uso propio, reservado por si se agrega cache de datos.

var _INASISTENCIA_VISTAS = {
  especialidad: { titulo: 'Inasistencia por Especialidad' },
  mes: { titulo: 'Inasistencia por Mes' },
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
  var vista = p.vista || 'especialidad';
  var def = _INASISTENCIA_VISTAS[vista] || _INASISTENCIA_VISTAS.especialidad;
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
  if(vista === 'especialidad') await _inasistenciaRenderEspecialidad(host, campana, i, opciones, titulo, sinDatosMes);
  else if(vista === 'mes') await _inasistenciaRenderMes(host, campana, i, opciones, titulo);
  else await _inasistenciaRenderDetalle(host, campana, i, opciones, titulo, sinDatosMes);
}

// ── "Por especialidad": tarjetas del mes + 2 graficas ───────────────────
async function _inasistenciaRenderEspecialidad(host, campana, i, opciones, titulo, sinDatosMes){
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
  html += '<div class="aurora-kpis" id="inasist-tarjetas-'+i+'"></div>';
  html += '<div class="aurora-grid-2">';
  html += '<div class="aurora-card"><div class="aurora-card-title">% de inasistencia por especialidad <span class="gd-help" title="(Inasistencia + Pendientes) / Total, por especialidad. Los pendientes cuentan como inasistencia; cancelados van en el denominador.">?</span></div><div class="aurora-chart-wrap" style="height:260px"><canvas id="inasist-c-pct-'+i+'"></canvas></div></div>';
  html += '<div class="aurora-card"><div class="aurora-card-title">Citas por estado y especialidad</div><div class="aurora-chart-wrap" style="height:260px"><canvas id="inasist-c-apilada-'+i+'"></canvas></div></div>';
  html += '</div>';
  html += '<div id="inasist-aviso-'+i+'"></div>';
  html += '</div>';
  host.innerHTML = html;
  await _inasistenciaDibujarEspecialidad(campana, i, opciones);
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

async function _inasistenciaDibujarEspecialidad(campana, i, opciones){
  var estado = _inasistenciaEstado[campana];
  var mes = estado.mes;
  var qs = 'campana='+encodeURIComponent(campana)+'&mes='+encodeURIComponent(mes)+(estado.especialidad?('&especialidad='+encodeURIComponent(estado.especialidad)):'');
  var datos = [];
  try{ datos = await apiRequest('GET','/calidad/inasistencia/especialidad?'+qs) || []; }catch(e){ showToast(e.message); }

  var tot = _inasistenciaSumar(datos);
  var pct = inasistenciaPctPonderado(tot.inasistencia, tot.pendiente, tot.total);

  var mesesOrdenados = opciones.meses; // ya vienen ordenados asc del servidor
  var idxMes = mesesOrdenados.indexOf(mes);
  var mesAnterior = idxMes > 0 ? mesesOrdenados[idxMes-1] : null;
  var totPrev = null, pctPrev = null, datosPrevTodas = null;
  if(mesAnterior){
    var qsPrev = 'campana='+encodeURIComponent(campana)+'&mes='+encodeURIComponent(mesAnterior)+(estado.especialidad?('&especialidad='+encodeURIComponent(estado.especialidad)):'');
    try{
      var filasPrev = await apiRequest('GET','/calidad/inasistencia/especialidad?'+qsPrev) || [];
      totPrev = _inasistenciaSumar(filasPrev);
      pctPrev = inasistenciaPctPonderado(totPrev.inasistencia, totPrev.pendiente, totPrev.total);
      if(!estado.especialidad) datosPrevTodas = filasPrev; // ya trae TODAS las especialidades (sin filtro)
    }catch(e){}
  }

  var tarjetasEl = document.getElementById('inasist-tarjetas-'+i);
  if(tarjetasEl){
    var variTotal = (totPrev !== null) ? _gdVariacion(tot.total, totPrev.total) : null;
    var variAtendidas = (totPrev !== null) ? _gdVariacion(tot.atendidas, totPrev.atendidas) : null;
    var variCanceladas = (totPrev !== null) ? _gdVariacion(tot.cancelada, totPrev.cancelada) : null;
    var variInasist = (totPrev !== null) ? _gdVariacion(tot.inasistencia, totPrev.inasistencia) : null;
    var variPendientes = (totPrev !== null) ? _gdVariacion(tot.pendiente, totPrev.pendiente) : null;
    var variPct = (pctPrev !== null) ? _gdVariacion(pct, pctPrev) : null;
    tarjetasEl.innerHTML =
      _inasistenciaTarjetaHtml('Total de citas', tot.total, 'entero', variTotal) +
      _inasistenciaTarjetaHtml('Atendidas', tot.atendidas, 'entero', variAtendidas) +
      _inasistenciaTarjetaHtml('Canceladas', tot.cancelada, 'entero', variCanceladas) +
      _inasistenciaTarjetaHtml('Inasistencia', tot.inasistencia, 'entero', variInasist) +
      _inasistenciaTarjetaHtml('Pendientes', tot.pendiente, 'entero', variPendientes) +
      _inasistenciaTarjetaHtml('% de inasistencia', pct, 'pct', variPct);
  }

  // Aviso: el mes elegido tiene MENOS especialidades que el mes anterior
  // (ej. Septiembre recien empieza) -- nunca se inventan ceros para las
  // que faltan.
  var avisoEl = document.getElementById('inasist-aviso-'+i);
  if(avisoEl){
    avisoEl.innerHTML = '';
    if(!estado.especialidad && datosPrevTodas){
      var espActuales = {}; datos.forEach(function(r){ espActuales[r.especialidad] = true; });
      var espPrev = {}; datosPrevTodas.forEach(function(r){ espPrev[r.especialidad] = true; });
      var nActuales = Object.keys(espActuales).length, nPrev = Object.keys(espPrev).length;
      if(nActuales < nPrev){
        var nombres = Object.keys(espActuales).map(textoFormatoNombre).sort().join(', ') || 'ninguna especialidad';
        avisoEl.innerHTML = '<div style="margin-top:10px;padding:10px 14px;border-radius:8px;background:var(--c-warning-bg);border:1px solid var(--c-warning);color:var(--c-warning-dark);font-size:0.82rem">'+
          esc(_gdMesLbl(mes)+': solo hay datos de '+nombres+'.')+'</div>';
      }
    }
  }

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

// ── "Por mes": linea, una serie por especialidad + Total ponderado ─────
async function _inasistenciaRenderMes(host, campana, i, opciones, titulo){
  var estado = _inasistenciaEstado[campana];
  var html = '<div class="aurora-card">';
  html += '<div class="aurora-card-title">'+esc(titulo)+'</div>';
  html += '<div class="form-row" style="flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:14px">';
  html += '<div class="ig" style="min-width:170px;margin-bottom:0"><label>Especialidad</label><select id="inasist-f-especialidad-'+i+'">'+_inasistenciaOptionsHtml(opciones.especialidades, estado.especialidad)+'</select></div>';
  html += '<div class="ig" style="min-width:110px;margin-bottom:0"><label>Desde (mes)</label><input type="month" id="inasist-f-desde-'+i+'" value="'+esc(estado.desde||'')+'"></div>';
  html += '<div class="ig" style="min-width:110px;margin-bottom:0"><label>Hasta (mes)</label><input type="month" id="inasist-f-hasta-'+i+'" value="'+esc(estado.hasta||'')+'"></div>';
  html += '<div class="ig" style="margin-bottom:0"><button class="btn-primary" onclick="_inasistenciaAplicarFiltros('+i+')">Aplicar filtros</button></div>';
  html += '</div>';
  html += '<div class="aurora-chart-wrap" style="height:320px"><canvas id="inasist-c-mes-'+i+'"></canvas></div>';
  html += '</div>';
  host.innerHTML = html;
  await _inasistenciaDibujarMes(campana, i, opciones);
}

async function _inasistenciaDibujarMes(campana, i, opciones){
  var estado = _inasistenciaEstado[campana];
  var qs = 'campana='+encodeURIComponent(campana)+(estado.especialidad?('&especialidad='+encodeURIComponent(estado.especialidad)):'')+(estado.desde?('&desde='+estado.desde):'')+(estado.hasta?('&hasta='+estado.hasta):'');
  var datos = [];
  try{ datos = await apiRequest('GET','/calidad/inasistencia/mensual?'+qs) || []; }catch(e){ showToast(e.message); }

  var meses = datos.map(function(r){ return r.mes; }).filter(function(v,idx,arr){ return arr.indexOf(v)===idx; }).sort();
  var especialidades = estado.especialidad ? [estado.especialidad] :
    datos.map(function(r){ return r.especialidad; }).filter(function(v,idx,arr){ return arr.indexOf(v)===idx; }).sort();

  var porMesEsp = {}; // 'mes|especialidad' -> fila
  var totalesPorMes = {}; // mes -> {inasistencia,pendiente,total}
  datos.forEach(function(r){
    porMesEsp[r.mes+'|'+r.especialidad] = r;
    if(!totalesPorMes[r.mes]) totalesPorMes[r.mes] = { inasistencia:0, pendiente:0, total:0 };
    totalesPorMes[r.mes].inasistencia += r.inasistencia;
    totalesPorMes[r.mes].pendiente += r.pendiente;
    totalesPorMes[r.mes].total += r.total;
  });

  var datasets = especialidades.map(function(esp){
    return {
      label: textoFormatoNombre(esp),
      data: meses.map(function(m){ var r = porMesEsp[m+'|'+esp]; return r ? (inasistenciaPctPonderado(r.inasistencia, r.pendiente, r.total) || 0) : null; }),
      borderColor: paletaColorPara(esp), backgroundColor: paletaColorPara(esp), fill: false, tension: 0.15,
    };
  });
  // "Total" ponderado (todas las especialidades) -- solo tiene sentido
  // cuando no hay un filtro de especialidad puesto (si ya filtro a una
  // sola, el Total coincidiria exacto con su unica serie, ruido de mas).
  if(!estado.especialidad){
    datasets.push({
      label: 'Total', borderColor: (typeof CD!=='undefined'?CD:'#0d4a5e'), backgroundColor: (typeof CD!=='undefined'?CD:'#0d4a5e'),
      borderWidth: 3, borderDash: [6,3], fill: false, tension: 0.15,
      data: meses.map(function(m){ var t = totalesPorMes[m]; return t ? (inasistenciaPctPonderado(t.inasistencia, t.pendiente, t.total) || 0) : null; }),
    });
  }

  var o = loPct(null);
  _gdChart('inasist-c-mes-'+i, {
    type: 'line',
    data: { labels: meses.map(inasistenciaMesLbl), datasets: datasets },
    options: loDatalabelsAuto(o),
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
function _inasistenciaLeerFiltros(i, vista){
  function v(id){ var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  var out = { especialidad: v('inasist-f-especialidad-'+i) };
  if(vista === 'mes'){
    out.desde = v('inasist-f-desde-'+i);
    out.hasta = v('inasist-f-hasta-'+i);
  }
  return out;
}

async function _inasistenciaAplicarFiltros(i){
  var campana = _inasistenciaCampanaPorPanel[i];
  if(!campana) return;
  var vista = _inasistenciaVistaPorPanel[i] || 'especialidad';
  var leidos = _inasistenciaLeerFiltros(i, vista);
  _inasistenciaEstado[campana] = Object.assign({}, _inasistenciaEstado[campana], leidos);
  var opciones = _inasistenciaOpciones[campana] || { meses: [], especialidades: [] };
  if(vista === 'especialidad') await _inasistenciaDibujarEspecialidad(campana, i, opciones);
  else if(vista === 'mes') await _inasistenciaDibujarMes(campana, i, opciones);
  else await _inasistenciaDibujarDetalle(campana, i);
}
