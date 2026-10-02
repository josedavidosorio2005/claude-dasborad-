// agendas.js — InConexion Platform (Fase 78, ORLANT; Fase 94 tema B,
// pedido de Edwin; Fase 104, pedido de InCo). Agendamiento tiene 4
// sub-pestañas ("Por especialidad", "Total agendas", "Agendas por línea",
// "Ranking de asesores"), cada una su PROPIO panel `agendas_panel` (con un
// `vista` distinto) pero las 4
// COMPARTEN los mismos filtros: el estado de filtros vive por CAMPANA
// (_agendasEstado[campana]), no por indice de panel -- asi cambiar un
// filtro en una sub-pestaña se respeta al abrir cualquiera de las otras 3
// (y en Exportar, dashboard-generic.js). Los IDs de los controles del DOM
// siguen sufijados por indice de panel `i` (solo UNO de los 4 esta
// montado a la vez, nunca hay colision), pero LEEN/ESCRIBEN el estado
// compartido de su campana.
//
// Mismo patron que trafico.js/trafico-whatsapp.js: este panel nunca
// descarga filas crudas de agendas (~7.500/mes), solo los agregados que
// necesita cada grafica (ver routes/agendas.js).
'use strict';

var _agendasOpciones = {}; // cache por campana: { meses, asesores, sedes, especialidades, examenes, profesionales, entidades, tiposLinea }
var _agendasEstado = {};   // estado de filtros por CAMPANA (compartido entre las 4 sub-pestañas): { mes, desde, hasta, asesor, sede, especialidad, examen, profesional, tipoLinea, entidad }
var _agendasCampanaPorPanel = {}; // que campana quedo pintada en cada indice de panel (i)
// Fase 86 (tema 3): ultimo _gd.mesSel (selector MES de arriba) ya aplicado
// a cada campana -- mientras no cambie, se respeta lo que el usuario haya
// elegido DENTRO de Agendamiento (filtro propio); en cuanto cambia, este
// mes manda de nuevo. Ver _agendasSincronizarConMesGlobal.
var _agendasMesSincronizado = {};
var _agendasSinDatosMesGlobal = {}; // campana -> true si _gd.mesSel no tiene datos para esta campana (aviso, no filtro)

var _AGENDAS_VISTAS = {
  especialidad: { titulo: 'Agendas por Especialidad', endpoint: '/calidad/agendas/especialidad', incluirMes: true },
  mensual: { titulo: 'Total de Agendas por Mes', endpoint: '/calidad/agendas/mensual', incluirMes: false },
  linea: { titulo: 'Agendas por Línea', endpoint: '/calidad/agendas/linea', incluirMes: false },
  // "Ranking de asesores" (Fase 104) sale de aqui en la Fase 111 (pedido
  // textual de Edwin: "el ranking va a ser efectividad por agendamiento")
  // -- ahora es su PROPIO panel (efectividad_agendamiento_panel), ver
  // public/js/efectividad-agendamiento.js. El calculo viejo por CANTIDAD de
  // agendas (agendasRanking, server/agendas.js, GET /calidad/agendas/ranking)
  // se deja intacto -- nadie mas lo usa, pero no hace daño que siga
  // existiendo (queda en el historial de git si algun dia hace falta).
};

// Sincroniza el estado de la campana con el selector MES de arriba
// (_gd.mesSel), salvo que el usuario ya este viendo ese mismo mes global
// (no pisa un cambio manual DENTRO de Agendamiento mientras el mes de
// arriba no se mueva de nuevo). Devuelve true si el panel debe mostrar el
// aviso "sin datos".
function _agendasSincronizarConMesGlobal(campana, opciones){
  var mesGlobal = (typeof _gd !== 'undefined') ? _gd.mesSel : '';
  if(!mesGlobal || _agendasMesSincronizado[campana] === mesGlobal) return !!_agendasSinDatosMesGlobal[campana];
  _agendasMesSincronizado[campana] = mesGlobal;
  // Se fija el mes SIEMPRE (incluso sin datos): asi Exportar (_gdExportarAgendas,
  // dashboard-generic.js) pide ese mismo mes y, si vuelve vacio, cae solo
  // en su propio aviso "Sin datos..." -- el archivo exportado queda
  // consistente con lo que se ve en pantalla, nunca un mes viejo distinto.
  _agendasEstado[campana] = { mes: mesGlobal };
  _agendasSinDatosMesGlobal[campana] = opciones.meses.indexOf(mesGlobal) === -1;
  return _agendasSinDatosMesGlobal[campana];
}

async function _agendasCargarOpciones(campana){
  if(_agendasOpciones[campana]) return _agendasOpciones[campana];
  var op = { meses:[], asesores:[], sedes:[], especialidades:[], examenes:[], profesionales:[], entidades:[], tiposLinea:['3P','GENERAL'] };
  try{ op = await apiRequest('GET','/calidad/agendas/opciones?campana='+encodeURIComponent(campana)); }
  catch(e){ /* sin datos o sin acceso -- se queda vacio, el panel muestra "sin datos" */ }
  _agendasOpciones[campana] = op;
  return op;
}

var _AGENDAS_MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
function _agendasMesLbl(m){
  var partes = String(m||'').split('-');
  return partes.length===2 ? (_AGENDAS_MESES[parseInt(partes[1],10)-1]+'-'+partes[0].slice(2)) : String(m||'');
}

// Fase 87 (tema C): el `value` sigue siendo el nombre ORIGINAL (los filtros
// tienen que seguir funcionando con el dato tal cual llego del sistema de
// agendamiento); solo el texto visible pasa por textoFormatoNombre.
function _agendasOptionsHtml(valores, seleccionado){
  return '<option value="">Todos</option>' + (valores||[]).map(function(v){
    return '<option value="'+esc(v)+'"'+(v===seleccionado?' selected':'')+'>'+esc(textoFormatoNombre(v))+'</option>';
  }).join('');
}

// `vista` de cada panel montado (i) -- para que _agendasAplicarFiltros
// sepa que endpoint/grafica redibujar sin tener que volver a mirar la
// config del tab.
var _agendasVistaPorPanel = {};

async function _agendasRenderPanel(p, i){
  var campana = p.campana;
  var vista = p.vista || 'especialidad';
  var def = _AGENDAS_VISTAS[vista] || _AGENDAS_VISTAS.especialidad;
  _agendasCampanaPorPanel[i] = campana;
  _agendasVistaPorPanel[i] = vista;
  var host = document.getElementById('gd-p'+i);
  if(!host) return;
  var titulo = p.titulo || def.titulo;
  host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">'+esc(titulo)+'</div>'+
    '<div style="text-align:center;color:var(--c-text-muted);padding:20px 8px">Cargando…</div></div>';

  var opciones = await _agendasCargarOpciones(campana);
  if(!opciones.meses || !opciones.meses.length){
    host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">'+esc(titulo)+'</div>'+
      '<div style="text-align:center;color:var(--c-text-muted);padding:24px 8px">Sin agendas cargadas todavia. Un usuario con permiso de administrador debe subir la hoja AGENDAS desde "Cargar Datos".</div></div>';
    return;
  }

  // Fase 79 (hallazgo real: con solo un mes viejo cargado -- ej. abril 2025
  // -- y el selector global de mes en otro periodo -- ej. Ago-26 --, un
  // admin que abre esta pestana por primera vez veia "Todos" en el filtro
  // de Mes, que SI trae datos (agrega todo el historico), pero nada dejaba
  // claro en que mes estaba parado ese total. Por defecto ahora se
  // selecciona el mes MAS RECIENTE con datos (mismo criterio que
  // Tipificacion, Fase 77) -- una eleccion explicita del usuario en el
  // desplegable (incluida "Todos") sigue mandando despues de la primera vez.
  if(!_agendasEstado[campana]){
    // Fase 86 (tema 2): el mes por defecto (el mas reciente CON DATOS,
    // Fase 79) nunca pasa del mes actual -- una fila vieja con fecha
    // futura ya en la base (carga anterior a este fix) nunca debe
    // arrastrar el default a un mes que en realidad todavia no llego.
    var mesActualAgendas = (typeof fechaLimitesFinDeMesActual === 'function') ? fechaLimitesFinDeMesActual().slice(0, 7) : null;
    var mesesValidos = mesActualAgendas ? opciones.meses.filter(function(m){ return m <= mesActualAgendas; }) : opciones.meses;
    if(!mesesValidos.length) mesesValidos = opciones.meses;
    _agendasEstado[campana] = { mes: mesesValidos[mesesValidos.length-1] };
  }
  // Fase 86 (tema 3): el selector MES de arriba manda sobre el filtro
  // propio de Agendamiento, salvo que el usuario ya haya elegido este
  // mismo mes global antes (ver _agendasSincronizarConMesGlobal) -- si el
  // mes de arriba no tiene agendas para esta campana, se muestra un aviso
  // con boton al ultimo mes con datos, en vez de un panel en blanco.
  if(_agendasSincronizarConMesGlobal(campana, opciones)){
    var ultimoConDatos = opciones.meses[opciones.meses.length-1];
    host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">'+esc(titulo)+'</div>'+
      _gdAvisoSinDatosMesHtml('Agendas', _gd.mesSel, ultimoConDatos) + '</div>';
    return;
  }
  var estado = _agendasEstado[campana];

  var html = '<div class="aurora-card">';
  html += '<div class="aurora-card-title">'+esc(titulo)+'</div>';
  html += '<div class="form-row" style="flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:14px">';
  html += '<div class="ig" style="min-width:110px;margin-bottom:0"><label>Mes</label><select id="agendas-f-mes-'+i+'">' +
    '<option value="">Todos</option>' + (opciones.meses||[]).map(function(m){ return '<option value="'+m+'"'+(m===estado.mes?' selected':'')+'>'+_agendasMesLbl(m)+'</option>'; }).join('') + '</select></div>';
  html += '<div class="ig" style="min-width:130px;margin-bottom:0"><label>Fecha de solicitud (desde)</label><input type="date" id="agendas-f-desde-'+i+'" value="'+esc(estado.desde||'')+'"></div>';
  html += '<div class="ig" style="min-width:130px;margin-bottom:0"><label>Fecha de solicitud (hasta)</label><input type="date" id="agendas-f-hasta-'+i+'" value="'+esc(estado.hasta||'')+'"></div>';
  html += '<div class="ig" style="min-width:140px;margin-bottom:0"><label>Agente</label><select id="agendas-f-asesor-'+i+'">'+_agendasOptionsHtml(opciones.asesores, estado.asesor)+'</select></div>';
  html += '<div class="ig" style="min-width:130px;margin-bottom:0"><label>Sede</label><select id="agendas-f-sede-'+i+'">'+_agendasOptionsHtml(opciones.sedes, estado.sede)+'</select></div>';
  html += '<div class="ig" style="min-width:160px;margin-bottom:0"><label>Especialidad</label><select id="agendas-f-especialidad-'+i+'">'+_agendasOptionsHtml(opciones.especialidades, estado.especialidad)+'</select></div>';
  html += '<div class="ig" style="min-width:170px;margin-bottom:0"><label>Nombre del examen</label><input list="agendas-dl-examen-'+i+'" id="agendas-f-examen-'+i+'" value="'+esc(estado.examen||'')+'" placeholder="Todos">' +
    '<datalist id="agendas-dl-examen-'+i+'">'+(opciones.examenes||[]).map(function(v){ return '<option value="'+esc(v)+'">'; }).join('')+'</datalist></div>';
  html += '<div class="ig" style="min-width:170px;margin-bottom:0"><label>Profesional</label><input list="agendas-dl-prof-'+i+'" id="agendas-f-profesional-'+i+'" value="'+esc(estado.profesional||'')+'" placeholder="Todos">' +
    '<datalist id="agendas-dl-prof-'+i+'">'+(opciones.profesionales||[]).map(function(v){ return '<option value="'+esc(v)+'">'; }).join('')+'</datalist></div>';
  html += '<div class="ig" style="min-width:120px;margin-bottom:0"><label>Tipo de línea</label><select id="agendas-f-tipolinea-'+i+'">'+_agendasOptionsHtml(opciones.tiposLinea, estado.tipoLinea)+'</select></div>';
  html += '<div class="ig" style="min-width:150px;margin-bottom:0"><label>Entidad</label><select id="agendas-f-entidad-'+i+'">'+_agendasOptionsHtml(opciones.entidades, estado.entidad)+'</select></div>';
  html += '<div class="ig" style="margin-bottom:0"><button class="btn-primary" onclick="_agendasAplicarFiltros('+i+')">Aplicar filtros</button></div>';
  html += '</div>';

  html += '<div class="aurora-chart-wrap" style="height:320px"><canvas id="agendas-c-'+i+'"></canvas></div>';
  html += '</div>';

  host.innerHTML = html;
  await _agendasDibujar(campana, i, opciones, vista);
}

// Lee los controles YA puestos en el DOM. examen/profesional (datalist,
// texto libre) solo se aplican si calzan EXACTO con una opcion conocida --
// si el usuario escribe algo que no existe, se trata como "Todos" (ningun
// filtro raro llega al servidor).
function _agendasLeerFiltros(i, opciones){
  function v(id){ var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  var examen = v('agendas-f-examen-'+i);
  var profesional = v('agendas-f-profesional-'+i);
  return {
    mes: v('agendas-f-mes-'+i),
    desde: v('agendas-f-desde-'+i),
    hasta: v('agendas-f-hasta-'+i),
    asesor: v('agendas-f-asesor-'+i),
    sede: v('agendas-f-sede-'+i),
    especialidad: v('agendas-f-especialidad-'+i),
    examen: (opciones.examenes||[]).indexOf(examen)!==-1 ? examen : '',
    profesional: (opciones.profesionales||[]).indexOf(profesional)!==-1 ? profesional : '',
    tipoLinea: v('agendas-f-tipolinea-'+i),
    entidad: v('agendas-f-entidad-'+i),
  };
}

function _agendasQueryString(campana, filtros, incluirMes){
  var params = new URLSearchParams();
  params.set('campana', campana);
  if(incluirMes && filtros.mes) params.set('mes', filtros.mes);
  if(filtros.desde) params.set('desde', filtros.desde);
  if(filtros.hasta) params.set('hasta', filtros.hasta);
  ['asesor','sede','especialidad','examen','profesional','tipoLinea','entidad'].forEach(function(k){
    if(filtros[k]) params.set(k, filtros[k]);
  });
  return params.toString();
}

async function _agendasDibujar(campana, i, opciones, vista){
  vista = vista || 'especialidad';
  var def = _AGENDAS_VISTAS[vista] || _AGENDAS_VISTAS.especialidad;
  var filtros = _agendasLeerFiltros(i, opciones);
  _agendasEstado[campana] = filtros;

  var datos = [];
  try{
    datos = await apiRequest('GET', def.endpoint+'?'+_agendasQueryString(campana, filtros, def.incluirMes)) || datos;
  }catch(e){ showToast(e.message); }

  var canvasId = 'agendas-c-'+i;
  if(vista === 'especialidad'){
    var o1 = loBar();
    _gdChart(canvasId, {
      type: 'bar',
      data: { labels: datos.map(function(r){ return textoFormatoNombre(r.especialidad); }),
        // Fase 87 (tema C): el color se sigue derivando del valor ORIGINAL
        // (paletaColorPara hashea el texto) para que no cambie de color si
        // el formato de texto cambia -- solo la etiqueta visible se formatea.
        datasets: [{ label:'Agendas', data: datos.map(function(r){ return r.cantidad; }), backgroundColor: datos.map(function(r){ return paletaColorPara(r.especialidad); }), borderRadius:3 }] },
      options: loDatalabelsAuto(o1),
    });
  } else if(vista === 'mensual'){
    var o2 = loBar();
    _gdChart(canvasId, {
      type: 'bar',
      data: { labels: datos.map(function(r){ return _agendasMesLbl(r.mes); }),
        datasets: [{ label:'Agendas', data: datos.map(function(r){ return r.cantidad; }), backgroundColor: (typeof CO!=='undefined'?CO:'#2a9d8f'), borderRadius:3 }] },
      options: loDatalabelsAuto(o2),
    });
  } else if(vista === 'linea'){
    // "Agendas por línea" (Fase 94): una serie para Línea General, otra
    // para 3P, por mes -- desde la columna `tipoLinea` real de la tabla
    // agendas (GET /calidad/agendas/linea), YA NO de la hoja "resumen".
    var meses = datos.map(function(r){ return r.mes; }).filter(function(v,idx,arr){ return arr.indexOf(v)===idx; }).sort();
    var porMesLinea = {};
    datos.forEach(function(r){ porMesLinea[r.mes+'|'+r.tipoLinea] = r.cantidad; });
    var CDl = (typeof CD!=='undefined') ? CD : '#0d4a5e';
    var CGl = (typeof CG!=='undefined') ? CG : '#27ae60';
    var o3 = loBar();
    _gdChart(canvasId, {
      type: 'bar',
      data: { labels: meses.map(_agendasMesLbl),
        datasets: [
          { label:'Línea General', data: meses.map(function(m){ return porMesLinea[m+'|GENERAL'] || 0; }), backgroundColor: CDl, borderRadius:3 },
          { label:'Línea 3P', data: meses.map(function(m){ return porMesLinea[m+'|3P'] || 0; }), backgroundColor: CGl, borderRadius:3 },
        ] },
      options: loDatalabelsAuto(o3),
    });
  }
}

async function _agendasAplicarFiltros(i){
  var campana = _agendasCampanaPorPanel[i];
  if(!campana) return;
  var opciones = _agendasOpciones[campana] || {};
  var vista = _agendasVistaPorPanel[i] || 'especialidad';
  await _agendasDibujar(campana, i, opciones, vista);
}
