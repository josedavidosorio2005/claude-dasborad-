// tipificacion.js — InConexion Platform (Fase 77, ORLANT; Fase 131 Parte 3,
// Mobilize). Panel "Tipificacion" del dashboard: mismo patron autonomo que
// agendas.js (Fase 78) -- el servidor agrega, este panel nunca descarga
// filas crudas (~15.000/mes solo Llamadas en ORLANT). Por defecto, 1 panel
// con 2 mitades (Llamadas izquierda, WhatsApp derecha; apiladas en movil
// via aurora-grid-2) -- Mes y rango de dias son filtros COMPARTIDOS arriba
// de las mitades; Agente y Skill/Cola son independientes por mitad.
//
// Fase 131 (Parte 3, Mobilize -- opciones NUEVAS y OPCIONALES del panel,
// mismo criterio que trafico_combo en la Parte 2: sin pasarlas, ORLANT
// queda EXACTAMENTE igual que siempre):
//   - `soloCanal`: 'LLAMADAS' o 'WHATSAPP' -- un solo canal, tarjeta a todo
//     el ancho (Mobilize no tiene WhatsApp).
//   - `mostrarFiltroTipo`: agrega un desplegable Entrante/Saliente
//     (TYPE_INTERACTION) junto a Agente/Skill.
//   - `mostrarTablaDetalle`: tabla de mayor a menor (codificacion legible,
//     cantidad, %) debajo del pie -- ORLANT sigue SIN tabla (pedido
//     explicito de la Fase 77, "por ahora SOLO el pie").
//   - `mostrarTarjetasSalida`: 3 tarjetas (total/conectadas/no conectadas
//     de las llamadas SALIENTES) -- SIEMPRE sobre salientes, independiente
//     de lo que el filtro Entrante/Saliente de arriba tenga seleccionado.
'use strict';

var _tipificacionOpciones = {}; // cache por campana::canal: {meses,agentes,skills}
var _tipificacionEstadoCompartido = {}; // por indice de panel (i): {mes, desde, hasta}
var _tipificacionEstadoCanal = {};      // por "i::canal": {agente, skill, tipo}
var _tipificacionCampanaPorPanel = {};
var _tipificacionCanalesPorPanel = {};  // Fase 131: [{canal,titulo,etiquetaSkill}, ...] que este panel realmente usa
var _tipificacionPanelConfig = {};      // Fase 131: opciones crudas del panel, por indice
// Fase 86 (tema 3): mismo patron que _agendasMesSincronizado/
// _agendasSinDatosMesGlobal (agendas.js) -- ver ese comentario.
var _tipificacionMesSincronizado = {};
var _tipificacionSinDatosMesGlobal = {};

function _tipificacionSincronizarConMesGlobal(i, mesesCombinados){
  var mesGlobal = (typeof _gd !== 'undefined') ? _gd.mesSel : '';
  if(!mesGlobal || _tipificacionMesSincronizado[i] === mesGlobal) return !!_tipificacionSinDatosMesGlobal[i];
  _tipificacionMesSincronizado[i] = mesGlobal;
  // Se fija el mes SIEMPRE (incluso sin datos): asi Exportar
  // (_gdExportarTipificacion) pide ese mismo mes y, si vuelve vacio, cae
  // solo en su propio aviso por canal -- consistente con lo que se ve.
  _tipificacionEstadoCompartido[i] = { mes: mesGlobal, desde:'', hasta:'' };
  _tipificacionSinDatosMesGlobal[i] = mesesCombinados.indexOf(mesGlobal) === -1;
  return _tipificacionSinDatosMesGlobal[i];
}

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
// Fase 87 (tema C): `value` sigue siendo el nombre ORIGINAL (agente/skill,
// los filtros tienen que seguir funcionando con el dato tal cual llego de
// Wolkvox); solo el texto visible pasa por textoFormatoNombre.
function _tipificacionOptionsHtml(valores, seleccionado){
  return '<option value="">Todos</option>' + (valores||[]).map(function(v){
    return '<option value="'+esc(v)+'"'+(v===seleccionado?' selected':'')+'>'+esc(textoFormatoNombre(v))+'</option>';
  }).join('');
}
// Fase 131: Entrante/Saliente -- TYPE_INTERACCION normalizado por el
// parser (tipificacionParseFilas) a exactamente estos 3 valores + vacio.
function _tipificacionTipoOptionsHtml(seleccionado){
  var opciones = [['', 'Todos'], ['inbound', 'Entrante'], ['outbound_ma', 'Saliente'], ['otro', 'Otro']];
  return opciones.map(function(o){
    return '<option value="'+o[0]+'"'+(o[0]===seleccionado?' selected':'')+'>'+o[1]+'</option>';
  }).join('');
}

async function _tipificacionRenderPanel(p, i){
  var campana = p.campana;
  _tipificacionCampanaPorPanel[i] = campana;
  _tipificacionPanelConfig[i] = p;
  var canalesAUsar = p.soloCanal ? TIPIFICACION_CANALES.filter(function(c){ return c.canal === p.soloCanal; }) : TIPIFICACION_CANALES;
  _tipificacionCanalesPorPanel[i] = canalesAUsar;
  var host = document.getElementById('gd-p'+i);
  if(!host) return;
  var titulo = p.titulo || 'Tipificación';
  host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">'+esc(titulo)+'</div>'+
    '<div style="text-align:center;color:var(--c-text-muted);padding:20px 8px">Cargando…</div></div>';

  var opPorCanal = {};
  for(var ci=0; ci<canalesAUsar.length; ci++){
    opPorCanal[canalesAUsar[ci].canal] = await _tipificacionCargarOpciones(campana, canalesAUsar[ci].canal);
  }
  var mesesCombinados = canalesAUsar.reduce(function(acc, c){ return acc.concat(opPorCanal[c.canal].meses||[]); }, [])
    .filter(function(v,idx,arr){ return arr.indexOf(v)===idx; }).sort();

  if(!mesesCombinados.length){
    host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">'+esc(titulo)+'</div>'+
      '<div style="text-align:center;color:var(--c-text-muted);padding:24px 8px">Sin tipificación cargada todavia. Un usuario con permiso de administrador debe subir '+
      (p.soloCanal ? 'el archivo' : 'las hojas TIPIFICACION_LLAMADAS/TIPIFICACION_WHATSAPP')+' desde "Cargar Datos".</div></div>';
    return;
  }

  if(!_tipificacionEstadoCompartido[i]){
    // Por defecto, el mes mas reciente con datos (mismo criterio que
    // Trafico) -- pero nunca posterior al mes actual (Fase 86, tema 2: una
    // fila vieja con fecha futura ya en la base no debe arrastrar el
    // default a un mes que en realidad todavia no llego).
    var mesActualTipif = (typeof fechaLimitesFinDeMesActual === 'function') ? fechaLimitesFinDeMesActual().slice(0, 7) : null;
    var mesesValidosTipif = mesActualTipif ? mesesCombinados.filter(function(m){ return m <= mesActualTipif; }) : mesesCombinados;
    if(!mesesValidosTipif.length) mesesValidosTipif = mesesCombinados;
    _tipificacionEstadoCompartido[i] = { mes: mesesValidosTipif[mesesValidosTipif.length-1], desde:'', hasta:'' };
  }
  // Fase 86 (tema 3): el selector MES de arriba manda sobre el filtro
  // compartido de este panel, salvo que el usuario ya haya elegido este
  // mismo mes global antes -- ver _tipificacionSincronizarConMesGlobal.
  if(_tipificacionSincronizarConMesGlobal(i, mesesCombinados)){
    var ultimoConDatosTipif = mesesCombinados[mesesCombinados.length-1];
    host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">'+esc(titulo)+'</div>'+
      _gdAvisoSinDatosMesHtml('Tipificación', _gd.mesSel, ultimoConDatosTipif) + '</div>';
    return;
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

  var esMultiCanal = canalesAUsar.length > 1;
  html += esMultiCanal ? '<div class="aurora-grid-2">' : '<div>';
  canalesAUsar.forEach(function(c){
    var op = opPorCanal[c.canal];
    var claveCanal = i+'::'+c.canal;
    if(!_tipificacionEstadoCanal[claveCanal]) _tipificacionEstadoCanal[claveCanal] = { agente:'', skill:'', tipo:'' };
    var estadoCanal = _tipificacionEstadoCanal[claveCanal];
    html += '<div class="aurora-card">';
    if(esMultiCanal) html += '<div class="aurora-card-title">Tipificación de '+esc(c.titulo)+'</div>';
    if(p.mostrarTarjetasSalida){
      html += '<div class="aurora-kpis" id="tipif-salida-'+i+'-'+c.canal+'" style="margin-bottom:12px"></div>';
    }
    html += '<div class="form-row" style="flex-wrap:wrap;gap:8px;align-items:flex-end;margin-bottom:8px">';
    html += '<div class="ig" style="min-width:150px;margin-bottom:0"><label>Agente</label><select id="tipif-f-agente-'+i+'-'+c.canal+'">'+_tipificacionOptionsHtml(op.agentes, estadoCanal.agente)+'</select></div>';
    html += '<div class="ig" style="min-width:170px;margin-bottom:0"><label>'+esc(c.etiquetaSkill)+'</label><select id="tipif-f-skill-'+i+'-'+c.canal+'">'+_tipificacionOptionsHtml(op.skills, estadoCanal.skill)+'</select></div>';
    if(p.mostrarFiltroTipo){
      html += '<div class="ig" style="min-width:140px;margin-bottom:0"><label>Tipo</label><select id="tipif-f-tipo-'+i+'-'+c.canal+'">'+_tipificacionTipoOptionsHtml(estadoCanal.tipo)+'</select></div>';
    }
    html += '<div class="ig" style="margin-bottom:0"><button class="btn-sm" onclick="_tipificacionAplicarFiltroCanal('+i+',\''+c.canal+'\')">Aplicar</button></div>';
    html += '</div>';
    html += '<div id="tipif-canal-contenido-'+i+'-'+c.canal+'">' +
      '<div class="aurora-chart-wrap" style="height:340px"><canvas id="tipif-c-'+i+'-'+c.canal+'"></canvas></div></div>';
    if(p.mostrarTablaDetalle){
      html += '<div id="tipif-tabla-'+i+'-'+c.canal+'" style="margin-top:10px"></div>';
    }
    html += '</div>';
  });
  html += '</div></div>';

  host.innerHTML = html;
  await _tipificacionDibujarTodos(campana, i, opPorCanal);
}

function _tipificacionLeerFiltroCompartido(i){
  function v(id){ var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  return { mes: v('tipif-f-mes-'+i), desde: v('tipif-f-desde-'+i), hasta: v('tipif-f-hasta-'+i) };
}
function _tipificacionLeerFiltroCanal(i, canal){
  function v(id){ var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  return { agente: v('tipif-f-agente-'+i+'-'+canal), skill: v('tipif-f-skill-'+i+'-'+canal), tipo: v('tipif-f-tipo-'+i+'-'+canal) };
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
  // Fase 131 (Mobilize): filtro Entrante/Saliente -- ORLANT nunca lo pasa
  // (su mitad no tiene el desplegable "Tipo"), sin cambio alguno.
  if(deCanal.tipo) params.set('tipoInteraccion', deCanal.tipo);
  return params.toString();
}

// Fase 131 (Mobilize): querystring de las tarjetas de SALIDA -- MISMOS
// filtros de mes/rango/agente/skill, pero SIN tipoInteraccion (la tarjeta
// es siempre sobre salientes, sin importar que diga el filtro "Tipo" de
// arriba) y sin canal (el endpoint ya asume LLAMADAS).
function _tipificacionQueryStringSalida(campana, compartido, deCanal){
  var params = new URLSearchParams();
  params.set('campana', campana);
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

function _tipificacionTarjetasSalidaHtml(resumen){
  var pct = resumen.total ? Math.round((resumen.conectadas/resumen.total)*10000)/100 : null;
  return '<div class="aurora-kpi"><div class="kv">'+resumen.total.toLocaleString('es-CO')+'</div><div class="kl">Llamadas de salida</div></div>' +
    '<div class="aurora-kpi kpi-green"><div class="kv">'+resumen.conectadas.toLocaleString('es-CO')+'</div><div class="kl">Conectadas'+(pct===null?'':' ('+pct+'%)')+'</div></div>' +
    '<div class="aurora-kpi kpi-red"><div class="kv">'+resumen.noConectadas.toLocaleString('es-CO')+'</div><div class="kl">No conectadas</div></div>';
}

// Fase 131 (Mobilize): tabla de mayor a menor (codificacion legible sin
// "_", cantidad, %) -- mismo patron visual que efectividad-agendamiento.js
// (table-wrap + aurora-table). "Otras (N tipificaciones)" (si aparece)
// nunca se etiqueta con tipificacionEtiqueta (ya viene legible).
function _tipificacionTablaDetalleHtml(datos, total){
  var filas = (datos || []).slice().sort(function(a,b){ return b.cantidad - a.cantidad; });
  var html = '<div class="table-wrap"><table class="aurora-table"><thead><tr><th style="text-align:left">Codificación</th><th>Cantidad</th><th>%</th></tr></thead><tbody>';
  filas.forEach(function(r){
    var pct = total ? Math.round((r.cantidad/total)*10000)/100 : 0;
    var etiqueta = r.esOtras ? r.tipificacion : tipificacionEtiqueta(r.tipificacion);
    html += '<tr><td>'+esc(etiqueta)+'</td><td>'+r.cantidad.toLocaleString('es-CO')+'</td><td>'+pct.toFixed(2)+'%</td></tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

// Dibuja UNA mitad (Llamadas o WhatsApp) -- separado de la otra para que
// "Aplicar" de un lado nunca tenga que re-pedir el otro lado.
async function _tipificacionDibujarCanal(campana, i, canal, opciones){
  var claveCanal = i+'::'+canal;
  var deCanal = _tipificacionLeerFiltroCanal(i, canal);
  _tipificacionEstadoCanal[claveCanal] = deCanal;
  var compartido = _tipificacionEstadoCompartido[i];
  var p = _tipificacionPanelConfig[i] || {};
  var contHost = document.getElementById('tipif-canal-contenido-'+i+'-'+canal);
  if(!contHost) return;

  // Fase 131: tarjetas de SALIDA se calculan ANTES del "sin datos" de abajo
  // (dependen solo de que haya datos del canal, no de que el pie tenga
  // algo que mostrar con los filtros actuales de Tipo).
  if(p.mostrarTarjetasSalida){
    var hostSalida = document.getElementById('tipif-salida-'+i+'-'+canal);
    if(hostSalida){
      try{
        var resumenSalida = await apiRequest('GET','/calidad/tipificacion/resumen-salida?'+_tipificacionQueryStringSalida(campana, compartido, deCanal));
        hostSalida.innerHTML = _tipificacionTarjetasSalidaHtml(resumenSalida);
      }catch(e){ hostSalida.innerHTML = ''; }
    }
  }

  if(!opciones.meses || !opciones.meses.length){
    contHost.innerHTML = '<div style="text-align:center;color:var(--c-text-muted);padding:20px 8px">Sin datos de '+
      (canal==='WHATSAPP'?'WhatsApp':'Llamadas')+' cargados para este período.</div>';
    var tablaHostVacio = document.getElementById('tipif-tabla-'+i+'-'+canal);
    if(tablaHostVacio) tablaHostVacio.innerHTML = '';
    return;
  }

  var resultado = { datos: [], total: 0 };
  try{
    resultado = await apiRequest('GET','/calidad/tipificacion/por-tipo?'+_tipificacionQueryString(campana, canal, compartido, deCanal)) || { datos:[], total:0 };
  }catch(e){ showToast(e.message); }

  var tablaHost = document.getElementById('tipif-tabla-'+i+'-'+canal);
  if(!resultado.total){
    contHost.innerHTML = '<div style="text-align:center;color:var(--c-text-muted);padding:20px 8px">Sin datos de '+
      (canal==='WHATSAPP'?'WhatsApp':'Llamadas')+' cargados para este período.</div>';
    if(tablaHost) tablaHost.innerHTML = '';
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

  if(p.mostrarTablaDetalle && tablaHost){
    tablaHost.innerHTML = _tipificacionTablaDetalleHtml(resultado.datos, resultado.total);
  }
}

async function _tipificacionDibujarTodos(campana, i, opPorCanal){
  var canalesAUsar = _tipificacionCanalesPorPanel[i] || TIPIFICACION_CANALES;
  for(var ci=0; ci<canalesAUsar.length; ci++){
    await _tipificacionDibujarCanal(campana, i, canalesAUsar[ci].canal, opPorCanal[canalesAUsar[ci].canal]);
  }
}

// "Aplicar filtros" de arriba (Mes/rango, compartidos) redibuja todas las mitades en uso.
async function _tipificacionAplicarFiltroCompartido(i){
  var campana = _tipificacionCampanaPorPanel[i];
  if(!campana) return;
  _tipificacionEstadoCompartido[i] = _tipificacionLeerFiltroCompartido(i);
  var canalesAUsar = _tipificacionCanalesPorPanel[i] || TIPIFICACION_CANALES;
  var opPorCanal = {};
  canalesAUsar.forEach(function(c){ opPorCanal[c.canal] = _tipificacionOpciones[campana+'::'+c.canal] || {}; });
  await _tipificacionDibujarTodos(campana, i, opPorCanal);
}

// "Aplicar" de una sola mitad (Agente/Skill/Tipo, independiente) redibuja SOLO esa mitad.
async function _tipificacionAplicarFiltroCanal(i, canal){
  var campana = _tipificacionCampanaPorPanel[i];
  if(!campana) return;
  var opciones = _tipificacionOpciones[campana+'::'+canal] || {};
  await _tipificacionDibujarCanal(campana, i, canal, opciones);
}
