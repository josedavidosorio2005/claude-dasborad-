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

function _agendasOptionsHtml(valores, seleccionado){
  return '<option value="">Todos</option>' + (valores||[]).map(function(v){
    return '<option value="'+esc(v)+'"'+(v===seleccionado?' selected':'')+'>'+esc(v)+'</option>';
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

  if(!_agendasEstado[i]) _agendasEstado[i] = {};
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
  html += '<div class="ig" style="min-width:120px;margin-bottom:0"><label>Tipo de linea</label><select id="agendas-f-tipolinea-'+i+'">'+_agendasOptionsHtml(opciones.tiposLinea, estado.tipoLinea)+'</select></div>';
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
    data: { labels: porEsp.map(function(r){ return r.especialidad; }),
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
