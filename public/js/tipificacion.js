// tipificacion.js — InConexion Platform (Fase 77, ORLANT). Panel
// "Tipificacion" del dashboard: mismo patron autonomo que agendas.js
// (Fase 78) -- el servidor agrega, este panel nunca descarga filas crudas
// (~15.000/mes solo Llamadas). 1 solo panel con 2 mitades (Llamadas
// izquierda, WhatsApp derecha; apiladas en movil via aurora-grid-2, mismo
// CSS que Agendas) -- Mes y rango de dias son filtros COMPARTIDOS arriba de
// las 2 mitades; Agente y Skill/Cola son independientes por mitad. Por
// ahora SOLO el pie con filtros (sin tabla de detalle, pedido explicito).
'use strict';

var _tipificacionOpciones = {}; // cache por campana::canal: {meses,agentes,skills}
var _tipificacionEstadoCompartido = {}; // por indice de panel (i): {mes, desde, hasta}
var _tipificacionEstadoCanal = {};      // por "i::canal": {agente, skill}
var _tipificacionCampanaPorPanel = {};

var TIPIFICACION_CANALES = [
  { canal: 'LLAMADAS', titulo: 'Llamadas', etiquetaSkill: 'Skill' },
  { canal: 'WHATSAPP', titulo: 'WhatsApp', etiquetaSkill: 'Cola' },
];

async function _tipificacionCargarOpciones(campana, canal){
  var clave = campana + '::' + canal;
  if(_tipificacionOpciones[clave]) return _tipificacionOpciones[clave];
  var op = { meses:[], agentes:[], skills:[] };
  try{ op = await apiRequest('GET','/calidad/tipificacion/opciones?campana='+encodeURIComponent(campana)+'&canal='+canal); }
  catch(e){ /* sin datos o sin acceso -- se queda vacio, la mitad muestra "sin datos" */ }
  _tipificacionOpciones[clave] = op;
  return op;
}

var _TIPIFICACION_MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
function _tipificacionMesLbl(m){
  var partes = String(m||'').split('-');
  return partes.length===2 ? (_TIPIFICACION_MESES[parseInt(partes[1],10)-1]+'-'+partes[0].slice(2)) : String(m||'');
}
function _tipificacionOptionsHtml(valores, seleccionado){
  return '<option value="">Todos</option>' + (valores||[]).map(function(v){
    return '<option value="'+esc(v)+'"'+(v===seleccionado?' selected':'')+'>'+esc(v)+'</option>';
  }).join('');
}

async function _tipificacionRenderPanel(p, i){
  var campana = p.campana;
  _tipificacionCampanaPorPanel[i] = campana;
  var host = document.getElementById('gd-p'+i);
  if(!host) return;
  var titulo = p.titulo || 'Tipificacion';
  host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">'+esc(titulo)+'</div>'+
    '<div style="text-align:center;color:var(--c-text-muted);padding:20px 8px">Cargando…</div></div>';

  var opLlamadas = await _tipificacionCargarOpciones(campana, 'LLAMADAS');
  var opWhatsapp = await _tipificacionCargarOpciones(campana, 'WHATSAPP');
  var mesesCombinados = (opLlamadas.meses||[]).concat(opWhatsapp.meses||[])
    .filter(function(v,idx,arr){ return arr.indexOf(v)===idx; }).sort();

  if(!mesesCombinados.length){
    host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">'+esc(titulo)+'</div>'+
      '<div style="text-align:center;color:var(--c-text-muted);padding:24px 8px">Sin tipificacion cargada todavia. Un usuario con permiso de administrador debe subir las hojas TIPIFICACION_LLAMADAS/TIPIFICACION_WHATSAPP desde "Cargar Datos".</div></div>';
    return;
  }

  if(!_tipificacionEstadoCompartido[i]){
    // Por defecto, el mes mas reciente con datos (mismo criterio que Trafico).
    _tipificacionEstadoCompartido[i] = { mes: mesesCombinados[mesesCombinados.length-1], desde:'', hasta:'' };
  }
  var estado = _tipificacionEstadoCompartido[i];

  var html = '<div class="aurora-card">';
  html += '<div class="aurora-card-title">'+esc(titulo)+'</div>';
  html += '<div class="form-row" style="flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:14px">';
  html += '<div class="ig" style="min-width:110px;margin-bottom:0"><label>Mes</label><select id="tipif-f-mes-'+i+'">' +
    mesesCombinados.map(function(m){ return '<option value="'+m+'"'+(m===estado.mes?' selected':'')+'>'+_tipificacionMesLbl(m)+'</option>'; }).join('') + '</select></div>';
  html += '<div class="ig" style="min-width:130px;margin-bottom:0"><label>Desde</label><input type="date" id="tipif-f-desde-'+i+'" value="'+esc(estado.desde||'')+'"></div>';
  html += '<div class="ig" style="min-width:130px;margin-bottom:0"><label>Hasta</label><input type="date" id="tipif-f-hasta-'+i+'" value="'+esc(estado.hasta||'')+'"></div>';
  html += '<div class="ig" style="margin-bottom:0"><button class="btn-primary" onclick="_tipificacionAplicarFiltroCompartido('+i+')">Aplicar filtros</button></div>';
  html += '</div>';

  html += '<div class="aurora-grid-2">';
  TIPIFICACION_CANALES.forEach(function(c){
    var op = c.canal==='LLAMADAS' ? opLlamadas : opWhatsapp;
    var claveCanal = i+'::'+c.canal;
    if(!_tipificacionEstadoCanal[claveCanal]) _tipificacionEstadoCanal[claveCanal] = { agente:'', skill:'' };
    var estadoCanal = _tipificacionEstadoCanal[claveCanal];
    html += '<div class="aurora-card"><div class="aurora-card-title">Tipificacion de '+esc(c.titulo)+'</div>';
    html += '<div class="form-row" style="flex-wrap:wrap;gap:8px;align-items:flex-end;margin-bottom:8px">';
    html += '<div class="ig" style="min-width:150px;margin-bottom:0"><label>Agente</label><select id="tipif-f-agente-'+i+'-'+c.canal+'">'+_tipificacionOptionsHtml(op.agentes, estadoCanal.agente)+'</select></div>';
    html += '<div class="ig" style="min-width:170px;margin-bottom:0"><label>'+esc(c.etiquetaSkill)+'</label><select id="tipif-f-skill-'+i+'-'+c.canal+'">'+_tipificacionOptionsHtml(op.skills, estadoCanal.skill)+'</select></div>';
    html += '<div class="ig" style="margin-bottom:0"><button class="btn-sm" onclick="_tipificacionAplicarFiltroCanal('+i+',\''+c.canal+'\')">Aplicar</button></div>';
    html += '</div>';
    html += '<div id="tipif-canal-contenido-'+i+'-'+c.canal+'">' +
      '<div class="aurora-chart-wrap" style="height:340px"><canvas id="tipif-c-'+i+'-'+c.canal+'"></canvas></div></div>';
    html += '</div>';
  });
  html += '</div></div>';

  host.innerHTML = html;
  await _tipificacionDibujarAmbos(campana, i, { opLlamadas: opLlamadas, opWhatsapp: opWhatsapp });
}

function _tipificacionLeerFiltroCompartido(i){
  function v(id){ var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  return { mes: v('tipif-f-mes-'+i), desde: v('tipif-f-desde-'+i), hasta: v('tipif-f-hasta-'+i) };
}
function _tipificacionLeerFiltroCanal(i, canal){
  function v(id){ var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  return { agente: v('tipif-f-agente-'+i+'-'+canal), skill: v('tipif-f-skill-'+i+'-'+canal) };
}

function _tipificacionQueryString(campana, canal, compartido, deCanal){
  var params = new URLSearchParams();
  params.set('campana', campana);
  params.set('canal', canal);
  // El rango de dias, si viene, manda sobre el mes (mismo criterio que
  // Trafico/Agendas: un rango explicito es una eleccion mas fina que "todo
  // el mes"). Si no hay rango, se manda el mes.
  if(compartido.desde || compartido.hasta){
    if(compartido.desde) params.set('desde', compartido.desde);
    if(compartido.hasta) params.set('hasta', compartido.hasta);
  } else if(compartido.mes){
    params.set('mes', compartido.mes);
  }
  if(deCanal.agente) params.set('agente', deCanal.agente);
  if(deCanal.skill) params.set('skill', deCanal.skill);
  return params.toString();
}

// Dibuja UNA mitad (Llamadas o WhatsApp) -- separado de la otra para que
// "Aplicar" de un lado nunca tenga que re-pedir el otro lado.
async function _tipificacionDibujarCanal(campana, i, canal, opciones){
  var claveCanal = i+'::'+canal;
  var deCanal = _tipificacionLeerFiltroCanal(i, canal);
  _tipificacionEstadoCanal[claveCanal] = deCanal;
  var compartido = _tipificacionEstadoCompartido[i];
  var contHost = document.getElementById('tipif-canal-contenido-'+i+'-'+canal);
  if(!contHost) return;

  if(!opciones.meses || !opciones.meses.length){
    contHost.innerHTML = '<div style="text-align:center;color:var(--c-text-muted);padding:20px 8px">Sin datos de '+
      (canal==='WHATSAPP'?'WhatsApp':'Llamadas')+' cargados para este período.</div>';
    return;
  }

  var resultado = { datos: [], total: 0 };
  try{
    resultado = await apiRequest('GET','/calidad/tipificacion/por-tipo?'+_tipificacionQueryString(campana, canal, compartido, deCanal)) || { datos:[], total:0 };
  }catch(e){ showToast(e.message); }

  if(!resultado.total){
    contHost.innerHTML = '<div style="text-align:center;color:var(--c-text-muted);padding:20px 8px">Sin datos de '+
      (canal==='WHATSAPP'?'WhatsApp':'Llamadas')+' cargados para este período.</div>';
    return;
  }
  // Si el canvas no esta (la mitad estaba en "sin datos" antes de este
  // refresco), se reconstruye antes de dibujar.
  if(!document.getElementById('tipif-c-'+i+'-'+canal)){
    contHost.innerHTML = '<div class="aurora-chart-wrap" style="height:340px"><canvas id="tipif-c-'+i+'-'+canal+'"></canvas></div>';
  }

  var labels = resultado.datos.map(function(r){ return tipificacionEtiqueta(r.tipificacion); });
  var valores = resultado.datos.map(function(r){ return r.cantidad; });
  var colores = resultado.datos.map(function(r){ return r.esOtras ? '#9aa0a6' : paletaColorPara(r.tipificacion); });
  var tituloChart = (canal==='WHATSAPP'?'WhatsApp':'Llamadas')+' — '+resultado.total.toLocaleString('es-CO')+' registro(s)';

  _gdChart('tipif-c-'+i+'-'+canal, {
    type: 'pie',
    data: { labels: labels, datasets: [{ data: valores, backgroundColor: colores }] },
    options: loPie(tituloChart),
  });
}

async function _tipificacionDibujarAmbos(campana, i, opciones){
  await _tipificacionDibujarCanal(campana, i, 'LLAMADAS', opciones.opLlamadas);
  await _tipificacionDibujarCanal(campana, i, 'WHATSAPP', opciones.opWhatsapp);
}

// "Aplicar filtros" de arriba (Mes/rango, compartidos) redibuja las 2 mitades.
async function _tipificacionAplicarFiltroCompartido(i){
  var campana = _tipificacionCampanaPorPanel[i];
  if(!campana) return;
  _tipificacionEstadoCompartido[i] = _tipificacionLeerFiltroCompartido(i);
  var claveL = campana+'::LLAMADAS', claveW = campana+'::WHATSAPP';
  await _tipificacionDibujarAmbos(campana, i, { opLlamadas: _tipificacionOpciones[claveL]||{}, opWhatsapp: _tipificacionOpciones[claveW]||{} });
}

// "Aplicar" de una sola mitad (Agente/Skill, independiente) redibuja SOLO esa mitad.
async function _tipificacionAplicarFiltroCanal(i, canal){
  var campana = _tipificacionCampanaPorPanel[i];
  if(!campana) return;
  var opciones = _tipificacionOpciones[campana+'::'+canal] || {};
  await _tipificacionDibujarCanal(campana, i, canal, opciones);
}
