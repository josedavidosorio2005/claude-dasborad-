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
  // Fase 104 (pedido de InCo): reemplaza a "Agendas por agente" (Fase 94,
  // top 12 + "Otros") -- ranking COMPLETO de asesores, todo calculado en el
  // servidor (ver server/agendas.js: agendasRanking). La respuesta de este
  // endpoint NO es un array como las otras 3 vistas, es
  // {filas, total, variantesConHomonimos} -- ver _agendasDibujar.
  ranking: { titulo: 'Ranking de Asesores', endpoint: '/calidad/agendas/ranking', incluirMes: true },
};
// Top N para la GRAFICA que acompaña la tabla de "Ranking de asesores"
// (Fase 104, pedido explicito: "todos los asesores si son <=25; si hay mas,
// top 25 y la tabla completa abajo"). Solo limita la grafica -- la TABLA
// siempre muestra a todos, nunca esconde a nadie en un "Otros" (a
// diferencia de la vieja "Agendas por agente", Fase 94).
var AGENDAS_RANKING_TOP_N_GRAFICA = 25;
// Columnas de la tabla de ranking, en orden -- usado tanto para pintar el
// encabezado (con su flecha de orden activo) como para saber que campo de
// la fila corresponde a cada click de "ordenar por columna".
var AGENDAS_RANKING_COLUMNAS = [
  { col: 'puesto', label: 'Puesto' },
  { col: 'asesor', label: 'Asesor' },
  { col: 'total', label: 'Total' },
  { col: 'pct', label: '%' },
  { col: 'cantidad3p', label: '3P' },
  { col: 'cantidadGeneral', label: 'General' },
  { col: 'promedioPorDia', label: 'Prom./día' },
  { col: 'variacion', label: 'Variación' },
];
// Estado de la tabla de ranking, por indice de panel `i` (igual que el
// resto de este archivo, solo UN panel 'ranking' esta montado a la vez,
// pero se guarda por `i` por el mismo motivo que el resto del estado aqui).
var _agendasRankingDatos = {};    // i -> {filas, total, variantesConHomonimos} (ULTIMA respuesta del servidor, sin ordenar/filtrar)
var _agendasRankingOrden = {};    // i -> { col, dir: 'asc'|'desc' }
var _agendasRankingBusqueda = {}; // i -> texto de busqueda (nombre de asesor)

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

  if(vista === 'ranking'){
    // "Ranking de asesores" (Fase 104): aviso de mes en curso + buscador +
    // grafica (top 25) + tabla ordenable con TODOS los asesores -- nunca se
    // esconde a nadie en un "Otros" (a diferencia de la vieja "Agendas por
    // agente", Fase 94).
    html += '<div id="agendas-ranking-aviso-'+i+'"></div>';
    html += '<div class="search-bar" style="max-width:260px;margin-bottom:12px"><input type="text" id="agendas-ranking-buscar-'+i+'" placeholder="Buscar asesor…" oninput="_agendasRankingBuscar('+i+', this.value)"></div>';
    html += '<div class="aurora-chart-wrap" style="height:420px"><canvas id="agendas-c-'+i+'"></canvas></div>';
    html += '<div class="table-wrap" style="margin-top:14px"><table class="aurora-table" id="agendas-ranking-tabla-'+i+'"><thead><tr></tr></thead><tbody></tbody></table></div>';
  } else {
    html += '<div class="aurora-chart-wrap" style="height:320px"><canvas id="agendas-c-'+i+'"></canvas></div>';
  }
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

  // Fase 104: la respuesta de 'ranking' es {filas,total,...}, no un array
  // como las otras 3 vistas -- el valor por defecto en caso de error tiene
  // que coincidir con esa forma para que el resto del codigo no reviente.
  var datos = vista === 'ranking' ? { filas: [], total: 0, variantesConHomonimos: 0 } : [];
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
  } else if(vista === 'ranking'){
    // "Ranking de asesores" (Fase 104): `datos` es {filas,total,...} -- se
    // guarda tal cual (sin ordenar/filtrar) y la grafica+tabla se arman en
    // _agendasRankingRenderizar a partir de ese estado (asi "ordenar por
    // columna"/"buscar" redibujan sin volver a pedirle nada al servidor).
    _agendasRankingDatos[i] = datos;
    _agendasRankingOrden[i] = { col: 'puesto', dir: 'asc' };
    _agendasRankingBusqueda[i] = '';
    var buscarEl = document.getElementById('agendas-ranking-buscar-'+i);
    if(buscarEl) buscarEl.value = '';
    _agendasRankingAvisoMesIncompleto(i, filtros, def.incluirMes);
    _agendasRankingRenderizar(i);
  }
}

// Mismo criterio que Inasistencia (aviso de "mes incompleto"): si el filtro
// de Mes esta puesto justo en el mes CALENDARIO en curso, el ranking de ese
// mes todavia puede cambiar (el mes no ha terminado) -- se avisa, nunca se
// bloquea ni se oculta el dato parcial.
function _agendasRankingAvisoMesIncompleto(i, filtros, incluirMes){
  var el = document.getElementById('agendas-ranking-aviso-'+i);
  if(!el) return;
  var mesActual = (typeof fechaLimitesFinDeMesActual === 'function') ? fechaLimitesFinDeMesActual().slice(0,7) : null;
  if(incluirMes && filtros.mes && mesActual && filtros.mes === mesActual){
    el.innerHTML = '<div style="margin-bottom:12px;padding:10px 14px;border-radius:8px;background:var(--c-warning-bg);border:1px solid var(--c-warning);color:var(--c-warning-dark);font-size:0.82rem">'+
      esc(_agendasMesLbl(filtros.mes)+' esta en curso: el ranking de este mes todavia puede cambiar.')+'</div>';
  } else {
    el.innerHTML = '';
  }
}

// Ordena (puesto/asesor/total/%/3P/General/promedio/variacion) + filtra por
// nombre -- SIEMPRE sobre el ULTIMO resultado ya traido del servidor
// (_agendasRankingDatos), nunca pide de nuevo al servidor solo por ordenar
// o buscar. "Sin asesor" (si existe) queda SIEMPRE al final, fuera del
// ordenamiento -- no es un asesor real, no compite por un puesto (igual
// que en el servidor, ver agendasRankingPuro).
function _agendasRankingFilasOrdenadas(i){
  var datos = _agendasRankingDatos[i] || { filas: [] };
  var orden = _agendasRankingOrden[i] || { col: 'puesto', dir: 'asc' };
  var busqueda = (_agendasRankingBusqueda[i]||'').trim().toUpperCase();
  var filtradas = (datos.filas||[]).filter(function(f){
    if(!busqueda) return true;
    var nombre = f.sinAsesor ? 'SIN ASESOR' : String(f.asesor||'').toUpperCase();
    return nombre.indexOf(busqueda) !== -1;
  });
  var normales = filtradas.filter(function(f){ return !f.sinAsesor; });
  var sinAsesor = filtradas.filter(function(f){ return f.sinAsesor; });

  function valorDe(f){
    switch(orden.col){
      case 'asesor': return textoFormatoNombre(f.asesor).toUpperCase();
      case 'total': return f.total;
      case 'pct': return f.pct;
      case 'cantidad3p': return f.cantidad3p;
      case 'cantidadGeneral': return f.cantidadGeneral;
      case 'promedioPorDia': return f.promedioPorDia;
      case 'variacion': return (f.variacion===null||f.variacion===undefined) ? -Infinity : f.variacion;
      case 'puesto': default: return f.puesto;
    }
  }
  normales.sort(function(a,b){
    var va = valorDe(a), vb = valorDe(b);
    var cmp = va<vb ? -1 : (va>vb ? 1 : (a.asesor<b.asesor?-1:(a.asesor>b.asesor?1:0)));
    return orden.dir==='desc' ? -cmp : cmp;
  });
  return normales.concat(sinAsesor);
}

// Click en un encabezado de columna: primera vez ordena por esa columna
// (numericas: mayor primero: texto "Asesor"/"Puesto": orden natural
// ascendente); un segundo click sobre la MISMA columna invierte el sentido.
function _agendasRankingOrdenarPor(i, col){
  var orden = _agendasRankingOrden[i] || { col:'puesto', dir:'asc' };
  if(orden.col === col){
    orden.dir = orden.dir === 'asc' ? 'desc' : 'asc';
  } else {
    orden = { col: col, dir: (col==='asesor' || col==='puesto') ? 'asc' : 'desc' };
  }
  _agendasRankingOrden[i] = orden;
  _agendasRankingRenderizar(i);
}

function _agendasRankingBuscar(i, texto){
  _agendasRankingBusqueda[i] = texto;
  _agendasRankingRenderizar(i);
}

function _agendasRankingRenderizar(i){
  var filas = _agendasRankingFilasOrdenadas(i);
  _agendasRankingDibujarGrafica(i);
  _agendasRankingDibujarTabla(i, filas);
}

// La grafica es la "foto" del ranking completo (top 25 por puesto, SIEMPRE
// en orden de puesto) -- independiente del orden/busqueda que se este
// aplicando a la tabla de abajo, para que siga siendo una referencia fija
// de "quienes van primero" mientras se explora la tabla. Puesto 1/2/3
// resaltados con los primeros 3 colores de la paleta categorica (PC) --
// por POSICION de puesto, no por hash del nombre (paletaColorPara), para
// que el color de "1er puesto" sea reconocible de un mes a otro aunque
// cambie quien lo ocupa.
function _agendasRankingDibujarGrafica(i){
  var datos = _agendasRankingDatos[i] || { filas: [] };
  var reales = (datos.filas||[]).filter(function(f){ return !f.sinAsesor; });
  var paraGrafica = reales.slice(0, AGENDAS_RANKING_TOP_N_GRAFICA);
  var canvasId = 'agendas-c-'+i;
  var o = loBar();
  o.indexAxis = 'y';
  o.scales.x = { ticks: { font: { size: 7 } } };
  o.scales.y = { ticks: { font: { size: 7 } } };
  var paleta = (typeof PC !== 'undefined') ? PC : ['#0d4a5e'];
  _gdChart(canvasId, {
    type: 'bar',
    data: { labels: paraGrafica.map(function(r){ return textoFormatoNombre(r.asesor); }),
      datasets: [{ label:'Agendas', data: paraGrafica.map(function(r){ return r.total; }),
        backgroundColor: paraGrafica.map(function(r){ return (r.puesto && r.puesto<=3) ? paleta[r.puesto-1] : paletaColorPara(r.asesor); }), borderRadius:3 }] },
    options: loDatalabelsAuto(o),
  });
}

function _agendasRankingDibujarTabla(i, filas){
  var tabla = document.getElementById('agendas-ranking-tabla-'+i);
  if(!tabla) return;
  var orden = _agendasRankingOrden[i] || { col:'puesto', dir:'asc' };
  var thead = tabla.querySelector('thead tr');
  if(thead){
    thead.innerHTML = AGENDAS_RANKING_COLUMNAS.map(function(c){
      var activo = orden.col === c.col;
      var flecha = activo ? (orden.dir==='asc' ? ' ▲' : ' ▼') : '';
      return '<th style="cursor:pointer;user-select:none;white-space:nowrap" onclick="_agendasRankingOrdenarPor('+i+',\''+c.col+'\')" title="Ordenar por '+esc(c.label)+'">'+esc(c.label)+flecha+'</th>';
    }).join('');
  }
  var tbody = tabla.querySelector('tbody');
  if(!tbody) return;
  if(!filas.length){
    tbody.innerHTML = '<tr><td colspan="'+AGENDAS_RANKING_COLUMNAS.length+'" style="text-align:center;color:var(--c-text-muted);padding:18px">Sin asesores para este filtro.</td></tr>';
    return;
  }
  var paleta = (typeof PC !== 'undefined') ? PC : ['#0d4a5e'];
  tbody.innerHTML = filas.map(function(f){
    var colorTop = (!f.sinAsesor && f.puesto && f.puesto<=3) ? paleta[f.puesto-1] : null;
    var variacionHtml = '—';
    if(f.variacion !== null && f.variacion !== undefined){
      var signo = f.variacion > 0 ? '▲' : (f.variacion < 0 ? '▼' : '—');
      var color = f.variacion > 0 ? 'var(--c-success)' : (f.variacion < 0 ? 'var(--c-danger)' : 'var(--c-text-muted)');
      variacionHtml = '<span style="color:'+color+'">'+signo+' '+Math.abs(f.variacion)+'</span>';
    }
    var estiloFila = colorTop ? ' style="box-shadow:inset 4px 0 0 '+colorTop+'"' : '';
    return '<tr'+estiloFila+'>'+
      '<td>'+(f.sinAsesor ? '—' : f.puesto)+'</td>'+
      '<td style="text-align:left">'+esc(f.sinAsesor ? 'Sin asesor' : textoFormatoNombre(f.asesor))+'</td>'+
      '<td>'+f.total+'</td>'+
      '<td>'+f.pct.toFixed(2)+'%</td>'+
      '<td>'+f.cantidad3p+'</td>'+
      '<td>'+f.cantidadGeneral+'</td>'+
      '<td>'+f.promedioPorDia.toFixed(2)+'</td>'+
      '<td>'+variacionHtml+'</td>'+
    '</tr>';
  }).join('');
}

async function _agendasAplicarFiltros(i){
  var campana = _agendasCampanaPorPanel[i];
  if(!campana) return;
  var opciones = _agendasOpciones[campana] || {};
  var vista = _agendasVistaPorPanel[i] || 'especialidad';
  await _agendasDibujar(campana, i, opciones, vista);
}
