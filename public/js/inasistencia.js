// inasistencia.js — InConexion Platform (Fase 98, ORLANT, pedido URGENTE de
// Edwin; Fase 101: la vista PRINCIPAL pasa a ser "Por mes"; Fase 106,
// pedido de InCo: "que en Inasistencia solo quede en porcentaje, por mes";
// Fase 108, pedido textual de InCo: "la inasistencia va a ser por mes, que
// se pueda filtrar por sede, especialidad, nombre entidad... con resumen de
// todos los meses... y barra por especialidad, para cada una de ellas, con
// el % de la inasistencia y poder filtrar por el mes").
//
// 2 sub-pestañas (subtabs genéricos, ver dashboard-generic.js), cada una su
// propio panel `inasistencia_panel` (vista 'pormes'/'porespecialidad'),
// COMPARTIENDO el mismo estado de filtros por CAMPANA (_inasistenciaEstado)
// -- mismo patrón que agendas.js: los IDs del DOM van sufijados por índice
// de panel `i`, pero solo UNO de los 2 está montado a la vez (nunca hay
// colisión), y leen/escriben el estado compartido de su campaña.
//
// "Resumen por mes" (pormes): tarjeta con el % PONDERADO de TODO el periodo
// filtrado (Σ(I+P)/Σtotal de TODOS los meses que pasan los filtros, nunca
// el promedio simple de los % de cada mes) + gráfica de barras con el % de
// CADA mes, resaltando con otro color de la paleta categórica el mes
// elegido arriba (_gd.mesSel) -- el filtro de Mes aquí SOLO resalta, nunca
// oculta los demás meses. Con una especialidad elegida, el servidor ya
// filtra a esa única especialidad antes de agregar, así que la gráfica
// termina mostrando el % de esa especialidad en cada mes subido.
//
// "Por especialidad" (porespecialidad): una barra por especialidad, del MES
// elegido arriba (_gd.mesSel, igual que el resto de la plataforma -- no hay
// un selector de mes propio), respetando Sede/Entidad (la Especialidad no
// aplica a esta vista, su filtro ni se muestra aquí: el punto es desglosar
// TODAS). Las especialidades con menos de INASISTENCIA_BASE_BAJA_UMBRAL
// citas en ese mes se mandan al final con un asterisco (ver
// inasistenciaOrdenarBaseBaja, inasistencia-logic.js) -- nunca se muestra
// el conteo real en pantalla (Fase 106: solo porcentaje).
'use strict';

var _inasistenciaOpciones = {}; // cache por campana: { meses, sedes, especialidades, entidades }
var _inasistenciaEstado = {};   // estado de filtros por CAMPANA (compartido entre las 2 sub-pestañas): { mes, sede, especialidad, entidad }
var _inasistenciaCampanaPorPanel = {}; // i -> campana (para _inasistenciaAplicarFiltros)
var _inasistenciaVistaPorPanel = {};   // i -> 'pormes'|'porespecialidad'
var INASISTENCIA_BASE_BAJA_UMBRAL = 30; // ver inasistenciaOrdenarBaseBaja (inasistencia-logic.js) -- mismo numero, documentado alla.

var _INASISTENCIA_VISTAS = {
  pormes: { titulo: 'Inasistencia por Mes' },
  porespecialidad: { titulo: 'Inasistencia por Especialidad' },
};

async function _inasistenciaCargarOpciones(campana){
  if(_inasistenciaOpciones[campana]) return _inasistenciaOpciones[campana];
  var op = { meses:[], sedes:[], especialidades:[], entidades:[] };
  try{ op = await apiRequest('GET','/calidad/inasistencia/opciones?campana='+encodeURIComponent(campana)); }
  catch(e){ /* sin datos o sin acceso -- se queda vacio, el panel muestra "sin datos" */ }
  _inasistenciaOpciones[campana] = op;
  return op;
}

// El Mes SIEMPRE sigue al selector global (_gd.mesSel) -- a diferencia de
// Agendas, nunca pisa sede/especialidad/entidad (esos solo cambian con
// "Aplicar filtros"). Devuelve true si el mes global no tiene datos de
// Inasistencia para esta campana (usado solo por "Por especialidad").
function _inasistenciaSincronizarConMesGlobal(campana, opciones){
  if(!_inasistenciaEstado[campana]) _inasistenciaEstado[campana] = { sede:'', especialidad:'', entidad:'' };
  var mesGlobal = (typeof _gd !== 'undefined') ? _gd.mesSel : '';
  _inasistenciaEstado[campana].mes = mesGlobal;
  return !mesGlobal || (opciones.meses || []).indexOf(mesGlobal) === -1;
}

function _inasistenciaOptionsHtml(valores, seleccionado){
  return '<option value="">Todos</option>' + (valores||[]).map(function(v){
    return '<option value="'+esc(v)+'"'+(v===seleccionado?' selected':'')+'>'+esc(textoFormatoNombre(v))+'</option>';
  }).join('');
}

// Fila de filtros compartida por las 2 sub-pestañas -- Especialidad solo se
// muestra en "pormes" (en "porespecialidad" no aplica, el punto de esa
// vista es desglosar TODAS las especialidades del mes, ver cabecera del
// archivo). Entidad usa <input list>+<datalist> (buscador, Fase 108: "la
// entidad con buscador, porque son muchas") -- mismo patrón que
// examen/profesional de agendas.js: si lo que se escribe no calza EXACTO
// con una opción conocida, se trata como "Todos" (_inasistenciaLeerFiltros).
function _inasistenciaFiltrosHtml(i, vista, opciones, estado){
  var html = '<div class="form-row" style="flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:14px">';
  html += '<div class="ig" style="min-width:150px;margin-bottom:0"><label>Sede</label><select id="inasist-f-sede-'+i+'">'+_inasistenciaOptionsHtml(opciones.sedes, estado.sede)+'</select></div>';
  if(vista === 'pormes'){
    html += '<div class="ig" style="min-width:170px;margin-bottom:0"><label>Especialidad</label><select id="inasist-f-especialidad-'+i+'">'+_inasistenciaOptionsHtml(opciones.especialidades, estado.especialidad)+'</select></div>';
  }
  html += '<div class="ig" style="min-width:200px;margin-bottom:0"><label>Entidad</label><input list="inasist-dl-entidad-'+i+'" id="inasist-f-entidad-'+i+'" value="'+esc(estado.entidad||'')+'" placeholder="Todas">' +
    '<datalist id="inasist-dl-entidad-'+i+'">'+(opciones.entidades||[]).map(function(v){ return '<option value="'+esc(v)+'">'; }).join('')+'</datalist></div>';
  html += '<div class="ig" style="margin-bottom:0"><button class="btn-primary" onclick="_inasistenciaAplicarFiltros('+i+')">Aplicar filtros</button></div>';
  html += '</div>';
  return html;
}

// Lee los controles YA puestos en el DOM. Entidad (datalist, texto libre)
// solo se aplica si calza EXACTO con una opcion conocida -- si el usuario
// escribe algo que no existe, se trata como "Todos" (ningun filtro raro
// llega al servidor). Especialidad se conserva tal cual estaba si el
// control no existe en esta vista (porespecialidad no lo muestra).
function _inasistenciaLeerFiltros(i, vista, opciones, previo){
  function v(id){ var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  var entidad = v('inasist-f-entidad-'+i);
  var especialidadEl = document.getElementById('inasist-f-especialidad-'+i);
  return {
    sede: v('inasist-f-sede-'+i),
    especialidad: especialidadEl ? especialidadEl.value.trim() : (previo.especialidad || ''),
    entidad: (opciones.entidades||[]).indexOf(entidad)!==-1 ? entidad : '',
  };
}

async function _inasistenciaAplicarFiltros(i){
  var campana = _inasistenciaCampanaPorPanel[i];
  if(!campana) return;
  var opciones = _inasistenciaOpciones[campana] || {};
  var vista = _inasistenciaVistaPorPanel[i] || 'pormes';
  var estado = _inasistenciaEstado[campana] || {};
  var filtros = _inasistenciaLeerFiltros(i, vista, opciones, estado);
  _inasistenciaEstado[campana] = Object.assign({}, estado, filtros);
  if(vista === 'pormes') await _inasistenciaDibujarPorMes(campana, i, opciones);
  else await _inasistenciaDibujarPorEspecialidad(campana, i, opciones);
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
  _inasistenciaSincronizarConMesGlobal(campana, opciones);

  if(vista === 'porespecialidad') await _inasistenciaRenderPorEspecialidad(host, campana, i, titulo, opciones);
  else await _inasistenciaRenderPorMes(host, campana, i, titulo, opciones);
}

function _inasistenciaTarjetaHtml(titulo, valor){
  var txt = (valor === null || valor === undefined) ? '—' : inasistenciaFmtPct(valor);
  return '<div class="aurora-kpi gd-kpi"><div class="kv">'+txt+'</div><div class="kl">'+esc(titulo)+'</div></div>';
}

// "Resumen por mes": tarjeta con el % ponderado de TODO el periodo filtrado
// + grafica de barras con el % de cada mes con datos (resalta el mes
// elegido arriba). Aviso automatico cuando un mes trae menos
// especialidades que el mes mas completo del rango (ver
// inasistenciaMesesIncompletos, inasistencia-logic.js).
async function _inasistenciaRenderPorMes(host, campana, i, titulo, opciones){
  var estado = _inasistenciaEstado[campana] || {};
  var html = '<div class="aurora-card">';
  html += '<div class="aurora-card-title">'+esc(titulo)+'</div>';
  html += _inasistenciaFiltrosHtml(i, 'pormes', opciones, estado);
  html += '<div id="inasist-tarjetas-wrap-'+i+'"></div>';
  html += '<div class="aurora-card-title" style="margin-top:10px">% de inasistencia por mes '+
    '<span class="gd-help" title="% de inasistencia = (Inasistencias + Pendientes) de TODAS las especialidades que pasen los filtros, dividido entre el total de citas, PONDERADO (nunca el promedio simple de los % de cada mes).">?</span></div>';
  html += '<div class="aurora-chart-wrap" style="height:320px"><canvas id="inasist-c-pormes-'+i+'"></canvas></div>';
  html += '<div id="inasist-aviso-'+i+'"></div>';
  html += '</div>';
  host.innerHTML = html;
  await _inasistenciaDibujarPorMes(campana, i, opciones);
}

async function _inasistenciaDibujarPorMes(campana, i, opciones){
  var estado = _inasistenciaEstado[campana] || {};
  var params = new URLSearchParams();
  params.set('campana', campana);
  if(estado.sede) params.set('sede', estado.sede);
  if(estado.especialidad) params.set('especialidad', estado.especialidad);
  if(estado.entidad) params.set('entidad', estado.entidad);
  var datos = [];
  try{ datos = await apiRequest('GET','/calidad/inasistencia/mensual?'+params.toString()) || []; }catch(e){ showToast(e.message); }
  var agregado = inasistenciaAgregarPorMes(datos);

  // Tarjeta: % ponderado de TODO el periodo que pasa los filtros (Fase 108
  // -- ya no el % de un solo mes con variacion vs el anterior, Fase 106).
  var wrap = document.getElementById('inasist-tarjetas-wrap-'+i);
  if(wrap){
    var ponderado = inasistenciaPonderadoTotal(agregado);
    wrap.innerHTML = agregado.length
      ? '<div class="aurora-kpis">' + _inasistenciaTarjetaHtml('% de inasistencia (periodo filtrado)', ponderado.pct) + '</div>'
      : '<div style="text-align:center;color:var(--c-text-muted);padding:16px 8px">Sin datos con estos filtros.</div>';
  }

  var labels = agregado.map(function(a){ return inasistenciaMesLbl(a.mes); });
  var mesSel = estado.mes;
  // CD vs CP (nunca el semaforo -- no hay meta definida para inasistencia):
  // se distinguen bien en los 2 temas (Fase 106, CD/CM se veian casi
  // iguales en oscuro).
  var colorSel = (typeof CD!=='undefined'?CD:'#0d4a5e');
  var colorResto = (typeof CP!=='undefined'?CP:'#8e44ad');
  var colores = agregado.map(function(a){ return a.mes === mesSel ? colorSel : colorResto; });

  var o = loPct(null);
  _gdChart('inasist-c-pormes-'+i, {
    type: 'bar',
    data: { labels: labels, datasets: [{ label: '% de inasistencia', data: agregado.map(function(a){ return a.pct; }), backgroundColor: colores, borderRadius: 3 }] },
    options: o,
  });

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

// "Por especialidad": una barra por especialidad del MES elegido arriba
// (_gd.mesSel), respetando Sede/Entidad. Las de base baja (<
// INASISTENCIA_BASE_BAJA_UMBRAL citas en ese mes) se mandan al final con
// asterisco (inasistenciaOrdenarBaseBaja) -- nunca se expone el conteo.
async function _inasistenciaRenderPorEspecialidad(host, campana, i, titulo, opciones){
  var estado = _inasistenciaEstado[campana] || {};
  var html = '<div class="aurora-card">';
  html += '<div class="aurora-card-title">'+esc(titulo)+'</div>';
  html += _inasistenciaFiltrosHtml(i, 'porespecialidad', opciones, estado);
  html += '<div id="inasist-esp-aviso-'+i+'"></div>';
  html += '<div class="aurora-card-title" style="margin-top:10px">% de inasistencia por especialidad '+
    '<span class="gd-help" title="% de inasistencia = (Inasistencias + Pendientes) de esa especialidad en el mes elegido arriba, dividido entre su total de citas. Las especialidades con muy pocas citas en el mes (marcadas con *) se muestran al final: su % puede no ser representativo.">?</span></div>';
  html += '<div class="aurora-chart-wrap" style="height:380px"><canvas id="inasist-c-porespecialidad-'+i+'"></canvas></div>';
  html += '<div id="inasist-esp-nota-'+i+'"></div>';
  html += '</div>';
  host.innerHTML = html;
  await _inasistenciaDibujarPorEspecialidad(campana, i, opciones);
}

async function _inasistenciaDibujarPorEspecialidad(campana, i, opciones){
  var estado = _inasistenciaEstado[campana] || {};
  var avisoEl = document.getElementById('inasist-esp-aviso-'+i);
  var mesGlobal = estado.mes;
  if(!mesGlobal || (opciones.meses||[]).indexOf(mesGlobal) === -1){
    var ultimoConDatos = opciones.meses.length ? opciones.meses[opciones.meses.length-1] : null;
    if(avisoEl) avisoEl.innerHTML = _gdAvisoSinDatosMesHtml('Inasistencia', mesGlobal, ultimoConDatos);
    _gdChart('inasist-c-porespecialidad-'+i, { type:'bar', data:{ labels:[], datasets:[] }, options: loPct(null) });
    var notaElVacio = document.getElementById('inasist-esp-nota-'+i);
    if(notaElVacio) notaElVacio.innerHTML = '';
    return;
  }
  if(avisoEl) avisoEl.innerHTML = '';

  var params = new URLSearchParams();
  params.set('campana', campana);
  params.set('mes', mesGlobal);
  if(estado.sede) params.set('sede', estado.sede);
  if(estado.entidad) params.set('entidad', estado.entidad);
  var filas = [];
  try{ filas = await apiRequest('GET','/calidad/inasistencia/especialidad?'+params.toString()) || []; }catch(e){ showToast(e.message); }

  var conPct = filas.map(function(f){
    return { especialidad: f.especialidad, pct: inasistenciaPctPonderado(f.inasistencia, f.pendiente, f.total), total: f.total };
  });
  var ordenadas = inasistenciaOrdenarBaseBaja(conPct, INASISTENCIA_BASE_BAJA_UMBRAL);

  var labels = ordenadas.map(function(f){ return textoFormatoNombre(f.especialidad) + (f.baseBaja ? ' *' : ''); });
  var colores = ordenadas.map(function(f){ return paletaColorPara(f.especialidad); });
  var o = loPct(null);
  _gdChart('inasist-c-porespecialidad-'+i, {
    type: 'bar',
    data: { labels: labels, datasets: [{ label: '% de inasistencia', data: ordenadas.map(function(f){ return f.pct; }), backgroundColor: colores, borderRadius: 3 }] },
    options: o,
  });

  var notaEl = document.getElementById('inasist-esp-nota-'+i);
  if(notaEl){
    notaEl.innerHTML = ordenadas.some(function(f){ return f.baseBaja; })
      ? '<div style="margin-top:10px;padding:10px 14px;border-radius:8px;background:var(--c-warning-bg);border:1px solid var(--c-warning);color:var(--c-warning-dark);font-size:0.82rem">'+
        '* Base baja: menos de '+INASISTENCIA_BASE_BAJA_UMBRAL+' citas en '+esc(inasistenciaMesLbl(mesGlobal))+' -- el porcentaje puede no ser representativo.</div>'
      : '';
  }
}
