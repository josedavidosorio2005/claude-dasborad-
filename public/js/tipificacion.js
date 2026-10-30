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
//     Fase 168: solo en la mitad de LLAMADAS (con las 2 mitades, la de
//     WhatsApp no las lleva: el endpoint es de llamadas).
//
// Fase 168 (pedido de Edwin, ORLANT con los 2 CDR): ORLANT vuelve a las 2
// mitades (Llamadas y WhatsApp lado a lado, apiladas en el celular) con los
// mismos filtros (Mes arriba; Agente, Skill/Cola y Tipo por mitad) y sin la
// tabla de detalle. Los skills de salida se ven como "Llamadas de salida" /
// "WhatsApp de salida" (tipificacionEtiquetaSkill).
'use strict';

var _tipificacionOpciones = {}; // cache por campana::canal: {meses,agentes,skills}
var _tipificacionEstadoCompartido = {}; // por indice de panel (i): {mes, desde, hasta}
var _tipificacionEstadoCanal = {};      // por "i::canal": {agente, skill, tipo}
var _tipificacionCampanaPorPanel = {};
var _tipificacionCanalesPorPanel = {};  // Fase 131: [{canal,titulo,etiquetaSkill}, ...] que este panel realmente usa
var _tipificacionPanelConfig = {};      // Fase 131: opciones crudas del panel, por indice
var _tipificacionClasifPorPanel = {};   // Fase 186: true si el cliente reparte la salida por la clasificacion del asesor
var _tipificacionSentidoPorCampana = {}; // Fase 219: true si el filtro de cada mitad es "Entrada o salida" (ORLANT)
// Fase 86 (tema 3): mismo patron que _agendasMesSincronizado/
// _agendasSinDatosMesGlobal (agendas.js) -- ver ese comentario.
var _tipificacionMesSincronizado = {};
var _tipificacionSinDatosMesGlobal = {};

// Fase 203: el filtro del panel sigue a MESES, no a un mes: un mes marcado
// = ese mes; varios o "Todos" = Desde/Hasta del primero al ultimo con
// tipificacion (las tarjetas de salida suman mes a mes, asi Ago + Oct no
// cuenta septiembre). Un filtro puesto a mano se respeta hasta que MESES cambie.
var _tipificacionMesesTarjetas = {}; // por panel: meses que suman las tarjetas
function _tipificacionSincronizarConMesGlobal(i, mesesCombinados){
  if(typeof _gd === 'undefined' || !_gd || !_gd.periodos) return !!_tipificacionSinDatosMesGlobal[i];
  var marcados = _gdMeses().slice().sort();
  var clave = marcados.length ? marcados.join(',') : 'todos';
  if(_tipificacionMesSincronizado[i] === clave) return !!_tipificacionSinDatosMesGlobal[i];
  _tipificacionMesSincronizado[i] = clave;
  var mesesT = gdMesesTarjetas(marcados, _gd.periodos).filter(function(m){ return mesesCombinados.indexOf(m) !== -1; });
  _tipificacionMesesTarjetas[i] = mesesT;
  var linea = (_tipificacionEstadoCompartido[i]||{}).linea || '';
  // Se fija el filtro SIEMPRE (incluso sin datos): asi Exportar
  // (_gdExportarTipificacion) pide esos mismos meses y, si vuelve vacio,
  // cae solo en su propio aviso por canal -- consistente con lo que se ve.
  if(!mesesT.length){
    _tipificacionEstadoCompartido[i] = { mes: marcados[marcados.length-1] || '', desde:'', hasta:'', linea: linea };
  } else if(mesesT.length === 1){
    _tipificacionEstadoCompartido[i] = { mes: mesesT[0], desde:'', hasta:'', linea: linea, deMeses: true };
  } else {
    var r = gdRangoDeMeses(mesesT);
    _tipificacionEstadoCompartido[i] = { mes: mesesT[mesesT.length-1], desde: r.desde, hasta: r.hasta, linea: linea, deMeses: true };
  }
  _tipificacionSinDatosMesGlobal[i] = !mesesT.length;
  return _tipificacionSinDatosMesGlobal[i];
}
// Tarjetas de salida: con varios meses de MESES (y el filtro sin tocar), un
// pedido por mes y la suma -- nunca los meses del medio que no se marcaron.
async function _tipificacionResumenSalidaMeses(i, campana, compartido, deCanal){
  var mesesT = _tipificacionMesesTarjetas[i] || [];
  if(!compartido.deMeses || mesesT.length < 2){
    return apiRequest('GET','/calidad/tipificacion/resumen-salida?'+_tipificacionQueryStringSalida(campana, compartido, deCanal));
  }
  var partes = await Promise.all(mesesT.map(function(m){
    return apiRequest('GET','/calidad/tipificacion/resumen-salida?'+_tipificacionQueryStringSalida(campana, { mes: m }, deCanal));
  }));
  var suma = Object.assign({}, partes[0] || {});
  ['total', 'conectadas', 'noConectadas', 'totalLlamadas'].forEach(function(c){
    if(suma[c] === undefined) return;
    suma[c] = partes.reduce(function(a, r){ return a + ((r && r[c]) || 0); }, 0);
  });
  return suma;
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
function _tipificacionOptionsHtml(valores, seleccionado, etiqueta){
  var fmt = etiqueta || textoFormatoNombre;
  return '<option value="">Todos</option>' + (valores||[]).map(function(v){
    return '<option value="'+esc(v)+'"'+(v===seleccionado?' selected':'')+'>'+esc(fmt(v))+'</option>';
  }).join('');
}
// Fase 131: Entrante/Saliente -- TYPE_INTERACCION normalizado por el
// parser (tipificacionParseFilas) a exactamente estos 3 valores + vacio.
// Fase 219 (pedido de Edwin, ORLANT): cada registro es de entrada o de salida
// (la regla de las tarjetas, en el servidor: sentido); no hay "Otro".
function _tipificacionSentidoOptionsHtml(seleccionado){
  return [['', 'Todos'], ['entrada', 'Entrada'], ['salida', 'Salida']].map(function(o){
    return '<option value="'+o[0]+'"'+(o[0]===seleccionado?' selected':'')+'>'+o[1]+'</option>';
  }).join('');
}

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

  // Fase 186 (solo ORLANT, lo dice el servidor en /opciones).
  var clasif = canalesAUsar.some(function(c){ return !!(opPorCanal[c.canal] && opPorCanal[c.canal].clasificacionAsesores); });
  _tipificacionClasifPorPanel[i] = clasif;
  _tipificacionSentidoPorCampana[campana] = clasif;

  if(!mesesCombinados.length){
    host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">'+esc(titulo)+'</div>'+
      '<div style="text-align:center;color:var(--c-text-muted);padding:24px 8px">Sin tipificación cargada todavia. Un usuario con permiso de administrador debe subir '+
      (p.soloCanal ? 'el archivo' : 'el CDR de llamadas (HistCDR) y el de WhatsApp (HistChat)')+' desde "Cargar Datos".</div></div>';
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
      _gdAvisoSinDatosMesHtml('Tipificación', _tipificacionEstadoCompartido[i].mes, ultimoConDatosTipif) + '</div>';
    return;
  }
  var estado = _tipificacionEstadoCompartido[i];

  var html = '<div class="aurora-card">';
  html += '<div class="aurora-card-title">'+esc(titulo)+'</div>';
  html += '<div class="form-row" style="flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:14px">';
  html += '<div class="ig" style="min-width:110px;margin-bottom:0"><label for="tipif-f-mes-'+i+'">Mes</label><select id="tipif-f-mes-'+i+'">' +
    mesesCombinados.map(function(m){ return '<option value="'+m+'"'+(m===estado.mes?' selected':'')+'>'+_tipificacionMesLbl(m)+'</option>'; }).join('') + '</select></div>';
  html += '<div class="ig" style="min-width:130px;margin-bottom:0"><label for="tipif-f-desde-'+i+'">Desde</label><input type="date" id="tipif-f-desde-'+i+'" value="'+esc(estado.desde||'')+'"></div>';
  html += '<div class="ig" style="min-width:130px;margin-bottom:0"><label for="tipif-f-hasta-'+i+'">Hasta</label><input type="date" id="tipif-f-hasta-'+i+'" value="'+esc(estado.hasta||'')+'"></div>';
  // Fase 186: "Línea de salida" filtra las 2 mitades (Llamadas y WhatsApp).
  if(clasif){
    // Fase 219: el texto dice que hay entrada y salida; las 3 lineas filtran solo la salida.
    html += '<div class="ig" style="min-width:150px;margin-bottom:0"><label for="tipif-f-linea-'+i+'">Línea (General / 3P)</label><select id="tipif-f-linea-'+i+'">' +
      [['', 'Entrada y salida (todas)'], ['GENERAL', 'Salida General'], ['3P', 'Salida 3P'], ['SIN', 'Salida sin clasificar']].map(function(o){
        return '<option value="'+o[0]+'"'+(o[0]===(estado.linea||'')?' selected':'')+'>'+o[1]+'</option>';
      }).join('') + '</select></div>';
  }
  html += '<div class="ig" style="margin-bottom:0"><button class="btn-primary" onclick="_tipificacionAplicarFiltroCompartido('+i+')">Aplicar filtros</button></div>';
  // Fase 186: solo el administrador clasifica; los usuarios del cliente ven el resultado.
  if(clasif && typeof isFullAdmin === 'function' && isFullAdmin()){
    html += '<div class="ig" style="margin-bottom:0"><button type="button" class="btn-sm" onclick="tipifAbrirClasificacion('+i+')">Clasificación de asesores</button></div>';
  }
  html += '</div>';
  // Fase 219: una sola linea de nota (sin parrafos).
  if(clasif){
    html += '<p class="tipif-linea-nota" role="status">'+(estado.linea
      ? 'Las tortas muestran solo la '+esc(_tipificacionLineaTexto(estado.linea))+'; las tarjetas no cambian.'
      : 'Con una línea (General, 3P o sin clasificar), las tortas muestran solo esa salida.')+'</p>';
  }

  var esMultiCanal = canalesAUsar.length > 1;
  html += esMultiCanal ? '<div class="aurora-grid-2">' : '<div>';
  canalesAUsar.forEach(function(c){
    var op = opPorCanal[c.canal];
    var claveCanal = i+'::'+c.canal;
    if(!_tipificacionEstadoCanal[claveCanal]) _tipificacionEstadoCanal[claveCanal] = { agente:'', skill:'', tipo:'' };
    var estadoCanal = _tipificacionEstadoCanal[claveCanal];
    html += '<div class="aurora-card">';
    if(esMultiCanal) html += '<div class="aurora-card-title">Tipificación de '+esc(c.titulo)+'</div>';
    if(p.mostrarTarjetasSalida && c.canal === 'LLAMADAS'){
      html += '<div class="aurora-kpis" id="tipif-salida-'+i+'-'+c.canal+'" style="margin-bottom:12px"></div>';
    }
    // Fase 185 (pedido de Edwin): con las 2 mitades, "Total WhatsApp" igual que "Total llamadas".
    if(p.mostrarTarjetasSalida && esMultiCanal && c.canal === 'WHATSAPP'){
      html += '<div class="aurora-kpis" id="tipif-total-'+i+'-'+c.canal+'" style="margin-bottom:12px"></div>';
    }
    if(clasif){
      html += '<div class="aurora-kpis tipif-lineas" id="tipif-lineas-'+i+'-'+c.canal+'" style="margin-bottom:6px"></div>' +
        '<p class="tipif-linea-nota" id="tipif-lineas-nota-'+i+'-'+c.canal+'"></p>';
    }
    html += '<div class="form-row" style="flex-wrap:wrap;gap:8px;align-items:flex-end;margin-bottom:8px">';
    html += '<div class="ig" style="min-width:150px;margin-bottom:0"><label for="tipif-f-agente-'+i+'-'+c.canal+'">Agente</label><select id="tipif-f-agente-'+i+'-'+c.canal+'">'+_tipificacionOptionsHtml(op.agentes, estadoCanal.agente)+'</select></div>';
    html += '<div class="ig" style="min-width:170px;margin-bottom:0"><label for="tipif-f-skill-'+i+'-'+c.canal+'">'+esc(c.etiquetaSkill)+'</label><select id="tipif-f-skill-'+i+'-'+c.canal+'">'+_tipificacionOptionsHtml(op.skills, estadoCanal.skill, tipificacionEtiquetaSkill)+'</select></div>';
    if(p.mostrarFiltroTipo){
      // Fase 219: en ORLANT, "Entrada o salida" (regla de las tarjetas) en vez de "Tipo" (TYPE_INTERACTION crudo).
      html += clasif
        ? '<div class="ig" style="min-width:140px;margin-bottom:0"><label for="tipif-f-tipo-'+i+'-'+c.canal+'">Entrada o salida</label><select id="tipif-f-tipo-'+i+'-'+c.canal+'">'+_tipificacionSentidoOptionsHtml(estadoCanal.tipo)+'</select></div>'
        : '<div class="ig" style="min-width:140px;margin-bottom:0"><label for="tipif-f-tipo-'+i+'-'+c.canal+'">Tipo</label><select id="tipif-f-tipo-'+i+'-'+c.canal+'">'+_tipificacionTipoOptionsHtml(estadoCanal.tipo)+'</select></div>';
    }
    html += '<div class="ig" style="margin-bottom:0"><button class="btn-sm" onclick="_tipificacionAplicarFiltroCanal('+i+',\''+c.canal+'\')">Aplicar</button></div>';
    html += '</div>';
    // Fase 141 (pedido de Edwin, reunion 13/10): con tabla, torta a la
    // izquierda y tabla a la derecha (50/50, .tipif-pie-tabla en
    // styles.css); en movil se apilan (torta arriba, tabla abajo). Las dos
    // salen del MISMO resultado de /por-tipo (mismos filtros, mismos totales).
    if(p.mostrarTablaDetalle) html += '<div class="tipif-pie-tabla">';
    html += '<div id="tipif-canal-contenido-'+i+'-'+c.canal+'" class="tipif-pie">' +
      '<div class="aurora-chart-wrap" style="height:340px"><canvas id="tipif-c-'+i+'-'+c.canal+'"></canvas></div></div>';
    if(p.mostrarTablaDetalle){
      html += '<div id="tipif-tabla-'+i+'-'+c.canal+'" class="tipif-tabla"></div></div>';
    }
    html += '</div>';
  });
  html += '</div></div>';

  host.innerHTML = html;
  await _tipificacionDibujarTodos(campana, i, opPorCanal);
}

function _tipificacionLeerFiltroCompartido(i){
  function v(id){ var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  return { mes: v('tipif-f-mes-'+i), desde: v('tipif-f-desde-'+i), hasta: v('tipif-f-hasta-'+i), linea: v('tipif-f-linea-'+i) };
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
  // Fase 219: en ORLANT el mismo desplegable manda "sentido" (entrada / salida).
  if(deCanal.tipo) params.set(_tipificacionSentidoPorCampana[campana] ? 'sentido' : 'tipoInteraccion', deCanal.tipo);
  // Fase 186: "Línea de salida" (compartido, solo ORLANT).
  if(compartido.linea) params.set('linea', compartido.linea);
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
  // Fase 183 (pedido de Edwin): en ORLANT una sola tarjeta con el total del mes.
  if(resumen.soloTotal) return '<div class="aurora-kpi"><div class="kv">'+(resumen.totalLlamadas||0).toLocaleString('es-CO')+'</div><div class="kl">Total llamadas</div></div>';
  var pct = resumen.total ? Math.round((resumen.conectadas/resumen.total)*10000)/100 : null;
  return '<div class="aurora-kpi"><div class="kv">'+resumen.total.toLocaleString('es-CO')+'</div><div class="kl">Llamadas de salida</div></div>' +
    '<div class="aurora-kpi"><div class="kv">'+resumen.conectadas.toLocaleString('es-CO')+'</div><div class="kl">Conectadas'+(pct===null?'':' ('+pct+'%)')+'</div></div>' +
    '<div class="aurora-kpi"><div class="kv">'+resumen.noConectadas.toLocaleString('es-CO')+'</div><div class="kl">No conectadas</div></div>';
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
    // Fase 164 (D-04): coma decimal es-CO ("24,92 %"), mismos 2 decimales.
    html += '<tr><td>'+esc(etiqueta)+'</td><td>'+r.cantidad.toLocaleString('es-CO')+'</td><td>'+pct.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })+' %</td></tr>';
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
  if(p.mostrarTarjetasSalida && canal === 'LLAMADAS'){
    var hostSalida = document.getElementById('tipif-salida-'+i+'-'+canal);
    if(hostSalida){
      try{
        var resumenSalida = await _tipificacionResumenSalidaMeses(i, campana, compartido, deCanal); // Fase 203
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
  }catch(e){ showToast(e.message, 'error'); }

  var tablaHost = document.getElementById('tipif-tabla-'+i+'-'+canal);
  // Fase 186: salida por linea (General / 3P / Sin clasificar), sin el filtro de linea.
  var porLinea = _tipificacionClasifPorPanel[i] ? await _tipificacionDibujarLineas(campana, i, canal, compartido, deCanal) : null;
  // Fase 185: total del mes con los mismos filtros de la mitad (sale del mismo /por-tipo que la torta).
  // Fase 186: con el filtro de linea, la torta cambia pero el total del mes no.
  var totalCanal = porLinea ? porLinea.total : (resultado.total||0);
  var hostTotal = document.getElementById('tipif-total-'+i+'-'+canal);
  if(hostTotal) hostTotal.innerHTML = '<div class="aurora-kpi"><div class="kv">'+totalCanal.toLocaleString('es-CO')+'</div><div class="kl">Total WhatsApp</div></div>';
  if(!resultado.total){
    contHost.innerHTML = '<div style="text-align:center;color:var(--c-text-muted);padding:20px 8px">'+(compartido.linea
      ? 'Sin '+esc(_tipificacionLineaTexto(compartido.linea))+' de '+(canal==='WHATSAPP'?'WhatsApp':'llamadas')+' en este período.'
      : 'Sin datos de '+(canal==='WHATSAPP'?'WhatsApp':'Llamadas')+' cargados para este período.')+'</div>';
    if(tablaHost) tablaHost.innerHTML = '';
    return;
  }
  // Si el canvas no esta (la mitad estaba en "sin datos" antes de este
  // refresco), se reconstruye antes de dibujar.
  if(!document.getElementById('tipif-c-'+i+'-'+canal)){
    contHost.innerHTML = '<div class="aurora-chart-wrap" style="height:340px"><canvas id="tipif-c-'+i+'-'+canal+'"></canvas></div>';
  }

  // Fase 205 (pedido de Edwin): la torta muestra todas las tipificaciones que
  // caben legibles en este ancho; si no caben, "Otras" dice en el tooltip
  // cuales entran ahi. "Ver datos" y la tabla de detalle: el listado completo.
  var todas = resultado.todas || resultado.datos;
  var anchoTorta = contHost.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 0);
  var porciones = tipificacionPorcionesTorta(todas, tipificacionMaxPorciones(anchoTorta));
  var leyendaAbajo = anchoTorta < 600;
  var wrapTorta = contHost.querySelector ? contHost.querySelector('.aurora-chart-wrap') : null;
  if(wrapTorta) wrapTorta.style.height = (leyendaAbajo ? 260 + porciones.length * 20 : Math.max(340, porciones.length * 18 + 60)) + 'px';
  var labels = porciones.map(function(r){ return r.esOtras ? r.tipificacion : tipificacionEtiqueta(r.tipificacion); });
  var valores = porciones.map(function(r){ return r.cantidad; });
  // Fase 164 (D-02): sin colores repetidos dentro de la torta (cada
  // tipificacion conserva su color propio salvo choque; "Otras" sigue gris).
  var coloresPropios = paletaColoresSinRepetir(porciones.filter(function(r){ return !r.esOtras; }).map(function(r){ return r.tipificacion; }));
  // Fase 206: con mas de 12 porciones la paleta (12) se repetiria; los
  // repetidos toman los colores extra (PC_EXTRA, charts.js). Los demas no cambian.
  coloresPropios = tipificacionSinRepetirConExtra(coloresPropios, typeof PC_EXTRA !== 'undefined' ? PC_EXTRA : []);
  var k = 0;
  var colores = porciones.map(function(r){ return r.esOtras ? '#9aa0a6' : coloresPropios[k++]; });
  var tituloChart = (canal==='WHATSAPP'?'WhatsApp':'Llamadas')+(compartido.linea ? ' — '+_tipificacionLineaTexto(compartido.linea) : '')+' — '+resultado.total.toLocaleString('es-CO')+' registro(s)';
  var opcTorta = loPie(tituloChart);
  opcTorta.plugins = opcTorta.plugins || {};
  if(leyendaAbajo) opcTorta.plugins.legend = Object.assign({}, opcTorta.plugins.legend, { position: 'bottom' });
  // label: "Nombre: cantidad (%)"; afterLabel (una linea por cada una, Chart.js
  // no las junta): cuales entran en "Otras".
  opcTorta.plugins.tooltip = { callbacks: {
    label: function(ctx){
      var r = porciones[ctx.dataIndex];
      return labels[ctx.dataIndex]+': '+tipificacionCantidadPct(r.cantidad, resultado.total);
    },
    afterLabel: function(ctx){
      var r = porciones[ctx.dataIndex];
      return r && r.esOtras ? tipificacionLineasOtras(r, resultado.total, tipificacionEtiqueta, 15) : '';
    },
  } };

  _gdChart('tipif-c-'+i+'-'+canal, {
    type: 'pie',
    data: { labels: labels, datasets: [{ data: valores, backgroundColor: colores,
      // "Ver datos" (abrirVerDatos): el listado completo, sin "Otras".
      verDatosTodas: { filas: todas.map(function(r){ return { etiqueta: tipificacionEtiqueta(r.tipificacion), cantidad: r.cantidad }; }), total: resultado.total } }] },
    options: opcTorta,
  });

  if(p.mostrarTablaDetalle && tablaHost){
    tablaHost.innerHTML = _tipificacionTablaDetalleHtml(todas, resultado.total);
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

// ── Fase 186 (pedido de Edwin, solo ORLANT): salida por linea del asesor ──
function _tipificacionLineaTexto(linea){
  return linea === 'GENERAL' ? 'salida General' : (linea === '3P' ? 'salida 3P' : 'salida sin clasificar');
}

// Tarjetas "Salida General / Salida 3P / Sin clasificar" de una mitad. Mismos
// filtros de la mitad, nunca el de linea (el reparto se ve completo). Fase 190:
// sin la torta "salida por línea" (se ve con los botones de la pestaña de
// salida). Devuelve el resultado (para el total del canal).
async function _tipificacionDibujarLineas(campana, i, canal, compartido, deCanal){
  var host = document.getElementById('tipif-lineas-'+i+'-'+canal);
  var nota = document.getElementById('tipif-lineas-nota-'+i+'-'+canal);
  var r = null;
  try{ r = await apiRequest('GET','/calidad/tipificacion/salida-por-linea?'+_tipificacionQueryString(campana, canal, Object.assign({}, compartido, { linea:'' }), Object.assign({}, deCanal, { tipo:'' }))); }
  catch(e){ if(host) host.innerHTML = ''; if(nota) nota.textContent = ''; return null; }
  var t = clasifTarjetasSalida(r, canal);
  if(host){
    host.innerHTML = t.tarjetas.map(function(x){
      var activa = compartido.linea === x.clave;
      return '<div class="aurora-kpi'+(activa?' tipif-linea-activa':'')+'"><div class="kv">'+x.valor.toLocaleString('es-CO')+'</div><div class="kl">'+esc(x.etiqueta)+'</div></div>';
    }).join('');
  }
  if(nota) nota.textContent = t.nota + (r.sinClasificar ? ' (General + 3P + Sin clasificar).' : ' (General + 3P).');
  return r;
}

// Ventana "Clasificación de asesores" (solo administrador).
var _tipifClasif = { i: null, campana: '', asesores: [], alGuardar: null };
function _tipifClasifFilasHtml(asesores){
  if(!asesores.length) return '<p class="tipif-linea-nota">No hay asesores en los CDR cargados de este cliente.</p>';
  var opt = function(v, txt, sel){ return '<option value="'+v+'"'+(v===sel?' selected':'')+'>'+txt+'</option>'; };
  return '<div class="gd-tabla-scroll"><table class="aurora-table tipif-clasif-tabla"><thead><tr><th class="th-izq">Asesor</th><th>Línea</th><th>Salida llamadas</th><th>Salida WhatsApp</th></tr></thead><tbody>' +
    asesores.map(function(a){
      var l = a.linea || '';
      // La linea va junto al nombre: en el celular se elige sin deslizar la tabla (igual que Fase 170).
      return '<tr data-nombre="'+esc(clasifNormNombre(a.agente))+'"><td>'+esc(a.agente)+'</td>' +
        '<td><select class="tipif-clasif-linea" data-agente="'+esc(a.agente)+'" aria-label="Línea de '+esc(a.agente)+'">' +
        opt('', 'Sin clasificar', l) + opt('GENERAL', 'Línea General', l) + opt('3P', 'Línea 3P', l) + '</select></td>' +
        '<td>'+(a.salidaLlamadas||0).toLocaleString('es-CO')+'</td><td>'+(a.salidaWpp||0).toLocaleString('es-CO')+'</td></tr>';
    }).join('') + '</tbody></table></div>';
}
async function tipifAbrirClasificacion(i){
  await _tipifAbrirClasif(_tipificacionCampanaPorPanel[i], i, null);
}
// Fase 187: la misma ventana desde la pestaña de salida (una sola clasificacion por cliente).
async function tipifAbrirClasificacionCliente(campana, alGuardar){
  await _tipifAbrirClasif(campana, null, alGuardar);
}
async function _tipifAbrirClasif(campana, i, alGuardar){
  var ov = document.getElementById('modal-clasif-asesores');
  var cuerpo = document.getElementById('tipif-clasif-cuerpo');
  if(!campana || !ov || !cuerpo) return;
  _tipifClasif = { i: i, campana: campana, asesores: [], alGuardar: alGuardar || null };
  document.getElementById('tipif-clasif-avisos').innerHTML = '';
  document.getElementById('tipif-clasif-buscar').value = '';
  cuerpo.innerHTML = '<p class="tipif-linea-nota">Cargando…</p>';
  ov.classList.add('show');
  try{
    var r = await apiRequest('GET','/calidad/tipificacion/clasificacion-asesores?campana='+encodeURIComponent(campana));
    _tipifClasif.asesores = r.asesores || [];
    cuerpo.innerHTML = _tipifClasifFilasHtml(_tipifClasif.asesores);
  }catch(e){ cuerpo.innerHTML = '<p class="tipif-linea-nota">'+esc(e.message)+'</p>'; }
}
function tipifCerrarClasificacion(){
  var ov = document.getElementById('modal-clasif-asesores');
  if(ov) ov.classList.remove('show');
}
function tipifClasifBuscar(texto){
  var t = clasifNormNombre(texto);
  document.querySelectorAll('#tipif-clasif-cuerpo tbody tr').forEach(function(tr){
    tr.style.display = !t || (tr.dataset.nombre || '').indexOf(t) > -1 ? '' : 'none';
  });
}
// Excel (nombre del asesor, línea): llena los selectores, no guarda (falta "Guardar").
async function tipifClasifExcel(input){
  var file = input && input.files && input.files[0];
  var avisosEl = document.getElementById('tipif-clasif-avisos');
  if(!file || !avisosEl) return;
  var r;
  try{
    var wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type:'array' });
    var filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header:1, blankrows:false, defval:null });
    r = clasifLeerExcel(filas, _tipifClasif.asesores.map(function(a){ return a.agente; }));
  }catch(e){ r = { error: 'No se pudo leer el archivo: '+e.message }; }
  input.value = '';
  if(!r.error){
    document.querySelectorAll('#tipif-clasif-cuerpo select.tipif-clasif-linea').forEach(function(s){
      var l = r.asignaciones[s.dataset.agente];
      if(l) s.value = l;
    });
  }
  avisosEl.innerHTML = '<ul class="tipif-clasif-avisos-lista">'+clasifAvisosExcel(r).map(function(a, k){
    return '<li'+(k>0 || r.error ? ' class="tipif-clasif-aviso"' : '')+'>'+esc(a)+'</li>';
  }).join('')+'</ul>';
}
async function tipifClasifGuardar(){
  var campana = _tipifClasif.campana;
  if(!campana) return;
  var asignaciones = Array.prototype.map.call(document.querySelectorAll('#tipif-clasif-cuerpo select.tipif-clasif-linea'), function(s){
    return { agente: s.dataset.agente, linea: s.value || null };
  });
  try{
    var r = await apiRequest('PUT','/calidad/tipificacion/clasificacion-asesores', { campana: campana, asignaciones: asignaciones });
    showToast('✓ Clasificación guardada: '+r.general+' en Línea General, '+r.p3+' en Línea 3P, '+r.sinClasificar+' sin clasificar.');
    tipifCerrarClasificacion();
    if(_tipifClasif.i !== null) await _tipificacionAplicarFiltroCompartido(_tipifClasif.i);
    if(typeof _tipifClasif.alGuardar === 'function') _tipifClasif.alGuardar();
  }catch(e){ showToast(e.message, 'error'); }
}
var _tipifClasifOv = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('modal-clasif-asesores') : null;
if(_tipifClasifOv && typeof _tipifClasifOv.addEventListener === 'function') _tipifClasifOv.addEventListener('click', function(e){ if(e.target === this) tipifCerrarClasificacion(); });
