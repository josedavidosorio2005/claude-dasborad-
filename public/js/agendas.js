// agendas.js — InConexion Platform (Fase 78, ORLANT). Panel "Citas por
// Especialidad" del dashboard: mismo patron autonomo que trafico.js/
// trafico-whatsapp.js (filtros + graficas propias, con sus propias
// llamadas a la API) pero AQUI el servidor agrega -- este panel nunca
// descarga filas crudas de agendas (~7.500/mes), solo los 2 agregados que
// necesita cada grafica (ver routes/agendas.js).
'use strict';

var _agendasOpciones = {}; // cache por campana: { meses, asesores, sedes, especialidades, examenes, profesionales, entidades, tiposLinea }
var _agendasEstado = {};   // estado de filtros por indice de panel (i): { mes, desde, hasta, asesor, sede, especialidad, examen, profesional, tipoLinea, entidad }
var _agendasCampanaPorPanel = {}; // que campana quedo pintada en cada indice de panel (i) -- alcance actual: solo ORLANT, pero sin fijarlo a mano
// Fase 86 (tema 3): ultimo _gd.mesSel (selector MES de arriba) ya aplicado
// a cada panel (i) -- mientras no cambie, se respeta lo que el usuario
// haya elegido DENTRO de esta pestana (Fase filtro propio); en cuanto
// cambia, este mes manda de nuevo. Ver _agendasSincronizarConMesGlobal.
var _agendasMesSincronizado = {};
var _agendasSinDatosMesGlobal = {}; // panel (i) -> true si _gd.mesSel no tiene datos para esta campana (aviso, no filtro)

// Sincroniza el panel `i` con el selector MES de arriba (_gd.mesSel), salvo
// que el usuario ya este viendo ese mismo mes global (no pisa un cambio
// manual DENTRO de la pestana mientras el mes de arriba no se mueva de
// nuevo). Devuelve true si el panel debe mostrar el aviso "sin datos".
function _agendasSincronizarConMesGlobal(i, opciones){
  var mesGlobal = (typeof _gd !== 'undefined') ? _gd.mesSel : '';
  if(!mesGlobal || _agendasMesSincronizado[i] === mesGlobal) return !!_agendasSinDatosMesGlobal[i];
  _agendasMesSincronizado[i] = mesGlobal;
  // Se fija el mes SIEMPRE (incluso sin datos): asi Exportar (_gdExportarAgendas,
  // dashboard-generic.js) pide ese mismo mes y, si vuelve vacio, cae solo
  // en su propio aviso "Sin datos..." -- el archivo exportado queda
  // consistente con lo que se ve en pantalla, nunca un mes viejo distinto.
  _agendasEstado[i] = { mes: mesGlobal };
  _agendasSinDatosMesGlobal[i] = opciones.meses.indexOf(mesGlobal) === -1;
  return _agendasSinDatosMesGlobal[i];
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

async function _agendasRenderPanel(p, i){
  var campana = p.campana;
  _agendasCampanaPorPanel[i] = campana;
  var host = document.getElementById('gd-p'+i);
  if(!host) return;
  var titulo = p.titulo || 'Citas por Especialidad';
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
  if(!_agendasEstado[i]){
    // Fase 86 (tema 2): el mes por defecto (el mas reciente CON DATOS,
    // Fase 79) nunca pasa del mes actual -- una fila vieja con fecha
    // futura ya en la base (carga anterior a este fix) nunca debe
    // arrastrar el default a un mes que en realidad todavia no llego.
    var mesActualAgendas = (typeof fechaLimitesFinDeMesActual === 'function') ? fechaLimitesFinDeMesActual().slice(0, 7) : null;
    var mesesValidos = mesActualAgendas ? opciones.meses.filter(function(m){ return m <= mesActualAgendas; }) : opciones.meses;
    if(!mesesValidos.length) mesesValidos = opciones.meses;
    _agendasEstado[i] = { mes: mesesValidos[mesesValidos.length-1] };
  }
  // Fase 86 (tema 3): el selector MES de arriba manda sobre el filtro
  // propio de este panel, salvo que el usuario ya haya elegido este mismo
  // mes global antes (ver _agendasSincronizarConMesGlobal) -- si el mes de
  // arriba no tiene agendas para esta campana, se muestra un aviso con
  // boton al ultimo mes con datos, en vez de un panel en blanco.
  if(_agendasSincronizarConMesGlobal(i, opciones)){
    var ultimoConDatos = opciones.meses[opciones.meses.length-1];
    host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">'+esc(titulo)+'</div>'+
      _gdAvisoSinDatosMesHtml('Agendas', _gd.mesSel, ultimoConDatos) + '</div>';
    return;
  }
  var estado = _agendasEstado[i];

  var html = '<div class="aurora-card">';
  html += '<div class="aurora-card-title">'+esc(titulo)+'</div>';
  html += '<div class="form-row" style="flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:14px">';
  html += '<div class="ig" style="min-width:110px;margin-bottom:0"><label>Mes</label><select id="agendas-f-mes-'+i+'">' +
    '<option value="">Todos</option>' + (opciones.meses||[]).map(function(m){ return '<option value="'+m+'"'+(m===estado.mes?' selected':'')+'>'+_agendasMesLbl(m)+'</option>'; }).join('') + '</select></div>';
  html += '<div class="ig" style="min-width:130px;margin-bottom:0"><label>Desde</label><input type="date" id="agendas-f-desde-'+i+'" value="'+esc(estado.desde||'')+'"></div>';
  html += '<div class="ig" style="min-width:130px;margin-bottom:0"><label>Hasta</label><input type="date" id="agendas-f-hasta-'+i+'" value="'+esc(estado.hasta||'')+'"></div>';
  html += '<div class="ig" style="min-width:140px;margin-bottom:0"><label>Asesor</label><select id="agendas-f-asesor-'+i+'">'+_agendasOptionsHtml(opciones.asesores, estado.asesor)+'</select></div>';
  html += '<div class="ig" style="min-width:130px;margin-bottom:0"><label>Sede</label><select id="agendas-f-sede-'+i+'">'+_agendasOptionsHtml(opciones.sedes, estado.sede)+'</select></div>';
  html += '<div class="ig" style="min-width:160px;margin-bottom:0"><label>Especialidad</label><select id="agendas-f-especialidad-'+i+'">'+_agendasOptionsHtml(opciones.especialidades, estado.especialidad)+'</select></div>';
  html += '<div class="ig" style="min-width:170px;margin-bottom:0"><label>Examen</label><input list="agendas-dl-examen-'+i+'" id="agendas-f-examen-'+i+'" value="'+esc(estado.examen||'')+'" placeholder="Todos">' +
    '<datalist id="agendas-dl-examen-'+i+'">'+(opciones.examenes||[]).map(function(v){ return '<option value="'+esc(v)+'">'; }).join('')+'</datalist></div>';
  html += '<div class="ig" style="min-width:170px;margin-bottom:0"><label>Profesional</label><input list="agendas-dl-prof-'+i+'" id="agendas-f-profesional-'+i+'" value="'+esc(estado.profesional||'')+'" placeholder="Todos">' +
    '<datalist id="agendas-dl-prof-'+i+'">'+(opciones.profesionales||[]).map(function(v){ return '<option value="'+esc(v)+'">'; }).join('')+'</datalist></div>';
  html += '<div class="ig" style="min-width:120px;margin-bottom:0"><label>Tipo de Línea</label><select id="agendas-f-tipolinea-'+i+'">'+_agendasOptionsHtml(opciones.tiposLinea, estado.tipoLinea)+'</select></div>';
  html += '<div class="ig" style="min-width:150px;margin-bottom:0"><label>Entidad</label><select id="agendas-f-entidad-'+i+'">'+_agendasOptionsHtml(opciones.entidades, estado.entidad)+'</select></div>';
  html += '<div class="ig" style="margin-bottom:0"><button class="btn-primary" onclick="_agendasAplicarFiltros('+i+')">Aplicar filtros</button></div>';
  html += '</div>';

  html += '<div class="aurora-grid-2">';
  html += '<div class="aurora-card"><div class="aurora-card-title">Agendas por Especialidad</div>'+
    '<div class="aurora-chart-wrap" style="height:320px"><canvas id="agendas-c-esp-'+i+'"></canvas></div></div>';
  html += '<div class="aurora-card"><div class="aurora-card-title">Total de Agendas por Mes</div>'+
    '<div class="aurora-chart-wrap" style="height:320px"><canvas id="agendas-c-mes-'+i+'"></canvas></div></div>';
  html += '</div></div>';

  host.innerHTML = html;
  await _agendasDibujar(campana, i, opciones);
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

async function _agendasDibujar(campana, i, opciones){
  var filtros = _agendasLeerFiltros(i, opciones);
  _agendasEstado[i] = filtros;

  var porEsp = [], porMes = [];
  try{
    porEsp = await apiRequest('GET','/calidad/agendas/especialidad?'+_agendasQueryString(campana, filtros, true)) || [];
  }catch(e){ showToast(e.message); }
  try{
    // "menos el de mes" (pedido de Edwin): esta grafica SIEMPRE muestra
    // todos los meses con datos, respeta los demas filtros.
    porMes = await apiRequest('GET','/calidad/agendas/mensual?'+_agendasQueryString(campana, filtros, false)) || [];
  }catch(e){ showToast(e.message); }

  // Ya viene ordenado desc por el servidor (mayor a menor, pedido de Edwin) —
  // se respeta ese orden tal cual llega.
  var o1 = loBar();
  _gdChart('agendas-c-esp-'+i, {
    type: 'bar',
    data: { labels: porEsp.map(function(r){ return textoFormatoNombre(r.especialidad); }),
      // Fase 87 (tema C): el color se sigue derivando del valor ORIGINAL
      // (paletaColorPara hashea el texto) para que no cambie de color si el
      // formato de texto cambia -- solo la etiqueta visible se formatea.
      datasets: [{ label:'Agendas', data: porEsp.map(function(r){ return r.cantidad; }), backgroundColor: porEsp.map(function(r){ return paletaColorPara(r.especialidad); }), borderRadius:3 }] },
    options: loDatalabelsAuto(o1),
  });

  var o2 = loBar();
  _gdChart('agendas-c-mes-'+i, {
    type: 'bar',
    data: { labels: porMes.map(function(r){ return _agendasMesLbl(r.mes); }),
      datasets: [{ label:'Agendas', data: porMes.map(function(r){ return r.cantidad; }), backgroundColor: (typeof CO!=='undefined'?CO:'#2a9d8f'), borderRadius:3 }] },
    options: loDatalabelsAuto(o2),
  });
}

async function _agendasAplicarFiltros(i){
  var campana = _agendasCampanaPorPanel[i];
  if(!campana) return;
  var opciones = _agendasOpciones[campana] || {};
  await _agendasDibujar(campana, i, opciones);
}
