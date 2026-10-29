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
// Fase 207: ultima clave de MESES ya aplicada a cada campana -- mientras no
// cambie, se respeta lo que el usuario haya elegido DENTRO de Agendamiento
// (filtro propio); en cuanto cambia, MESES manda de nuevo. Ver
// _agendasSincronizarConMesGlobal.
var _agendasMesSincronizado = {};
var _agendasSinDatosMesGlobal = {}; // campana -> true si los meses de MESES no tienen datos (aviso, no filtro)

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

// Fase 207: sincroniza el estado de la campana con MESES (Todos = todos los
// meses, un mes = ese mes, varios = esos meses sumados, `meses`), salvo que
// MESES no haya cambiado (no pisa un cambio manual DENTRO de Agendamiento).
// Devuelve true si el panel debe mostrar el aviso "sin datos".
function _agendasSincronizarConMesGlobal(campana, opciones){
  if(typeof _gd === 'undefined' || !_gd || !_gd.periodos) return !!_agendasSinDatosMesGlobal[campana];
  var marcados = _gdMeses().slice().sort();
  var clave = marcados.length ? marcados.join(',') : 'todos';
  if(_agendasMesSincronizado[campana] === clave) return !!_agendasSinDatosMesGlobal[campana];
  _agendasMesSincronizado[campana] = clave;
  var conDatos = opciones.meses || [];
  var meses = marcados.filter(function(m){ return conDatos.indexOf(m) !== -1; });
  // Se fija SIEMPRE (incluso sin datos): asi Exportar (_gdExportarAgendas,
  // dashboard-generic.js) pide esos mismos meses y, si vuelve vacio, cae
  // solo en su propio aviso "Sin datos..." -- consistente con la pantalla.
  if(!marcados.length) _agendasEstado[campana] = { mes: '' };
  else if(meses.length === 1) _agendasEstado[campana] = { mes: meses[0] };
  else _agendasEstado[campana] = { mes: '', meses: meses };
  _agendasSinDatosMesGlobal[campana] = marcados.length > 0 && !meses.length;
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

var _agendasPanelPorIndice = {}; // Fase 210: para volver a pintar el panel despues de guardar una lista

async function _agendasRenderPanel(p, i){
  var campana = p.campana;
  _agendasPanelPorIndice[i] = p;
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
      '<div style="text-align:center;color:var(--c-text-muted);padding:24px 8px">Sin agendas cargadas todavia. Un usuario con permiso de administrador debe subir la hoja AGENDAS desde "Cargar Datos".</div>'+_agendasBotonesClasifHtml(campana, i)+'</div>';
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
      _gdAvisoSinDatosMesHtml('Agendas', _gdMeses().slice(-1)[0] || '', ultimoConDatos) + _agendasBotonesClasifHtml(campana, i) + '</div>';
    return;
  }
  var estado = _agendasEstado[campana];

  var html = '<div class="aurora-card">';
  html += '<div class="aurora-card-title">'+esc(titulo)+'</div>';
  html += '<div class="form-row" style="flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:14px">';
  html += '<div class="ig" style="min-width:110px;margin-bottom:0"><label for="agendas-f-mes-'+i+'">Mes</label><select id="agendas-f-mes-'+i+'">' +
    // Fase 207: con varios meses en MESES, la opcion "Meses elegidos (...)".
    (estado.meses && estado.meses.length > 1 ? '<option value="__meses__" selected>Meses elegidos ('+esc(gdMesesTexto(estado.meses, mesNombreLargo))+')</option>' : '') +
    '<option value="">Todos</option>' + (opciones.meses||[]).map(function(m){ return '<option value="'+m+'"'+(m===estado.mes?' selected':'')+'>'+_agendasMesLbl(m)+'</option>'; }).join('') + '</select></div>';
  html += '<div class="ig" style="min-width:130px;margin-bottom:0"><label for="agendas-f-desde-'+i+'">Fecha de solicitud (desde)</label><input type="date" id="agendas-f-desde-'+i+'" value="'+esc(estado.desde||'')+'"></div>';
  html += '<div class="ig" style="min-width:130px;margin-bottom:0"><label for="agendas-f-hasta-'+i+'">Fecha de solicitud (hasta)</label><input type="date" id="agendas-f-hasta-'+i+'" value="'+esc(estado.hasta||'')+'"></div>';
  html += '<div class="ig" style="min-width:140px;margin-bottom:0"><label for="agendas-f-asesor-'+i+'">Agente</label><select id="agendas-f-asesor-'+i+'">'+_agendasOptionsHtml(opciones.asesores, estado.asesor)+'</select></div>';
  html += '<div class="ig" style="min-width:130px;margin-bottom:0"><label for="agendas-f-sede-'+i+'">Sede</label><select id="agendas-f-sede-'+i+'">'+_agendasOptionsHtml(opciones.sedes, estado.sede)+'</select></div>';
  html += '<div class="ig" style="min-width:160px;margin-bottom:0"><label for="agendas-f-especialidad-'+i+'">Especialidad</label><select id="agendas-f-especialidad-'+i+'">'+_agendasOptionsHtml(opciones.especialidades, estado.especialidad)+'</select></div>';
  html += '<div class="ig" style="min-width:170px;margin-bottom:0"><label for="agendas-f-examen-'+i+'">Nombre del examen</label><input list="agendas-dl-examen-'+i+'" id="agendas-f-examen-'+i+'" value="'+esc(estado.examen||'')+'" placeholder="Todos">' +
    '<datalist id="agendas-dl-examen-'+i+'">'+(opciones.examenes||[]).map(function(v){ return '<option value="'+esc(v)+'">'; }).join('')+'</datalist></div>';
  html += '<div class="ig" style="min-width:170px;margin-bottom:0"><label for="agendas-f-profesional-'+i+'">Profesional</label><input list="agendas-dl-prof-'+i+'" id="agendas-f-profesional-'+i+'" value="'+esc(estado.profesional||'')+'" placeholder="Todos">' +
    '<datalist id="agendas-dl-prof-'+i+'">'+(opciones.profesionales||[]).map(function(v){ return '<option value="'+esc(v)+'">'; }).join('')+'</datalist></div>';
  // Fase 212 (pedido de Edwin): "Tipo de línea" es el filtro que mas miran --
  // resaltado, aplica al cambiarlo y, en tablet/celular, no se pliega con los
  // demas (gd-filtros-siempre, ver _gdPlegarFiltros en dashboard-generic.js).
  html += '<div class="ig agendas-filtro-destacado gd-filtros-siempre" style="min-width:120px;margin-bottom:0"><label for="agendas-f-tipolinea-'+i+'">Tipo de línea</label><select id="agendas-f-tipolinea-'+i+'" onchange="_agendasAplicarFiltros('+i+')">'+_agendasOptionsHtml(opciones.tiposLinea, estado.tipoLinea)+'</select></div>';
  html += '<div class="ig" style="min-width:150px;margin-bottom:0"><label for="agendas-f-entidad-'+i+'">Entidad</label><select id="agendas-f-entidad-'+i+'">'+_agendasOptionsHtml(opciones.entidades, estado.entidad)+'</select></div>';
  // Fase 214: el boton no crece (flex:0 0 auto), asi la tarjeta queda pegada a el.
  html += '<div class="ig" style="flex:0 0 auto;margin-bottom:0"><button class="btn-primary" onclick="_agendasAplicarFiltros('+i+')">Aplicar filtros</button></div>';
  // Fase 214 (pedido de Edwin): "Total de agendas" al lado de "Aplicar filtros",
  // cerca de la grafica (arriba se perdia). No es un filtro: en tablet/celular
  // queda visible con los filtros plegados (_gdPlegarFiltros).
  html += '<div class="agendas-total-junto" id="agendas-total-'+i+'" aria-live="polite"></div>';
  html += '</div>';
  html += _agendasBotonesClasifHtml(campana, i); // Fase 210

  html += '<p class="agendas-filtros-aplicados" id="agendas-filtros-txt-'+i+'" aria-live="polite"></p>'; // Fase 212
  html += '<div class="aurora-chart-wrap" style="height:320px"><canvas id="agendas-c-'+i+'"></canvas></div>';
  html += '<div class="gd-vacio-chico" id="agendas-vacio-'+i+'" hidden>Sin agendas con estos filtros.</div>';
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
  var mesElegido = v('agendas-f-mes-'+i);
  var previo = _agendasEstado[_agendasCampanaPorPanel[i]] || {};
  return {
    mes: mesElegido === '__meses__' ? '' : mesElegido,
    meses: mesElegido === '__meses__' ? (previo.meses || []) : undefined, // Fase 207
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
  else if(incluirMes && filtros.meses && filtros.meses.length) params.set('meses', filtros.meses.join(',')); // Fase 207
  if(filtros.desde) params.set('desde', filtros.desde);
  if(filtros.hasta) params.set('hasta', filtros.hasta);
  ['asesor','sede','especialidad','examen','profesional','tipoLinea','entidad'].forEach(function(k){
    if(filtros[k]) params.set(k, filtros[k]);
  });
  return params.toString();
}

// Fase 212: filtros aplicados en texto ("Sede Principal · Línea General"), sin
// el mes (ya lo dice MESES). Va debajo del titulo, en "Ver datos" y en Exportar.
function _agendasFiltrosTexto(filtros){
  var f = filtros || {};
  var partes = [];
  if(f.tipoLinea) partes.push(f.tipoLinea === 'GENERAL' ? 'Línea General' : 'Línea ' + f.tipoLinea);
  ['sede','asesor','especialidad','examen','profesional','entidad'].forEach(function(k){ if(f[k]) partes.push(textoFormatoNombre(f[k])); });
  if(f.desde || f.hasta) partes.push('Solicitud ' + (f.desde || '…') + ' a ' + (f.hasta || '…'));
  return partes.join(' · ');
}

// Fase 213 (pedido de Edwin): tarjeta "Total de agendas" (Fase 214: junto a
// "Aplicar filtros") -- el periodo
// (mes, meses de MESES o todos) y los filtros puestos.
function _agendasPeriodoTexto(filtros){
  var f = filtros || {};
  if(f.mes) return mesNombreLargo(f.mes);
  if(f.meses && f.meses.length) return gdMesesTexto(f.meses, mesNombreLargo);
  return 'Todos los meses';
}
function _agendasTarjetaTotalHtml(total, filtros){
  return '<div class="aurora-kpi gd-kpi agendas-total-kpi"><div class="kv">'+(total === null ? '—' : gdFmtValor(total))+'</div>'+
    '<div class="kl">Total de agendas · '+esc(_agendasPeriodoTexto(filtros))+'</div></div>';
}

// Fase 212 (Edwin: "al elegir General por un momento no salió nada"): cada
// dibujo lleva un numero; si mientras llega la respuesta se pidio otro, la
// respuesta vieja se descarta (nunca pisa a la mas nueva).
var _agendasDibujoN = {};

async function _agendasDibujar(campana, i, opciones, vista){
  vista = vista || 'especialidad';
  var def = _AGENDAS_VISTAS[vista] || _AGENDAS_VISTAS.especialidad;
  var filtros = _agendasLeerFiltros(i, opciones);
  _agendasEstado[campana] = filtros;
  var n = _agendasDibujoN[i] = (_agendasDibujoN[i] || 0) + 1;

  var datos = [];
  try{
    datos = await apiRequest('GET', def.endpoint+'?'+_agendasQueryString(campana, filtros, def.incluirMes)) || datos;
  }catch(e){ showToast(e.message, 'error'); }
  // Fase 213: "Total de agendas" sigue a MESES y a los filtros en las 3 vistas.
  // "Por especialidad" ya trae ese periodo; las otras 2 son series de todos los
  // meses, asi que el total se pide aparte (mismo endpoint, con el mes).
  var total = null;
  if(def.incluirMes) total = datos.reduce(function(a, r){ return a + (r.cantidad || 0); }, 0);
  else {
    try{
      var porEsp = await apiRequest('GET', _AGENDAS_VISTAS.especialidad.endpoint+'?'+_agendasQueryString(campana, filtros, true)) || [];
      total = porEsp.reduce(function(a, r){ return a + (r.cantidad || 0); }, 0);
    }catch(e){ total = null; }
  }
  if(_agendasDibujoN[i] !== n) return;
  var totalEl = document.getElementById('agendas-total-'+i);
  if(totalEl) totalEl.innerHTML = _agendasTarjetaTotalHtml(total, filtros);

  var canvasId = 'agendas-c-'+i;
  var txtFiltros = _agendasFiltrosTexto(filtros);
  var filtrosEl = document.getElementById('agendas-filtros-txt-'+i);
  if(filtrosEl) filtrosEl.textContent = txtFiltros ? 'Filtros: ' + txtFiltros : '';
  var canvasEl = document.getElementById(canvasId);
  if(canvasEl) canvasEl.setAttribute('data-titulo', ((_agendasPanelPorIndice[i] && _agendasPanelPorIndice[i].titulo) || def.titulo) + (txtFiltros ? ' · ' + txtFiltros : ''));
  var vacioEl = document.getElementById('agendas-vacio-'+i);
  if(vacioEl) vacioEl.hidden = datos.length > 0;
  if(vista === 'especialidad'){
    // Fase 152 (B1): barras de comparacion (no tiempo) de mayor a menor.
    datos = datos.slice().sort(function(a,b){ return (b.cantidad||0) - (a.cantidad||0); });
    var o1 = loBar();
    // Fase 164 (lote 2): una sola serie y sin leyenda. Fase 183 (pedido de
    // Edwin): cada barra vuelve a tener su color, sin repetir (paletaColoresSinRepetir).
    o1.plugins.legend = { display:false };
    var coloresEsp = (typeof paletaColoresSinRepetir === 'function') ? paletaColoresSinRepetir(datos.map(function(r){ return r.especialidad; })) : null;
    _gdChart(canvasId, {
      type: 'bar',
      data: { labels: datos.map(function(r){ return textoFormatoNombre(r.especialidad); }),
        datasets: [{ label:'Agendas', data: datos.map(function(r){ return r.cantidad; }), backgroundColor: coloresEsp || (typeof colorSerie==='function' ? colorSerie('principal') : '#0d4a5e'), borderRadius:3 }] },
      options: loDatalabelsAuto(o1),
    });
  } else if(vista === 'mensual'){
    datos = (typeof gdAplicarFiltroMeses === 'function' ? gdAplicarFiltroMeses(datos, function(r){ return r.mes; }) : datos); // Fase 167: filtro "Meses"
    var o2 = loBar();
    _gdChart(canvasId, {
      type: 'bar',
      data: { labels: datos.map(function(r){ return _agendasMesLbl(r.mes); }),
        datasets: [{ label:'Agendas', data: datos.map(function(r){ return r.cantidad; }), backgroundColor: (typeof colorSerie==='function' ? colorSerie('principal') : '#0d4a5e'), borderRadius:3 }] }, // Fase 152 (B1): sin semaforo
      options: loDatalabelsAuto(o2),
    });
  } else if(vista === 'linea'){
    // "Agendas por línea" (Fase 94): una serie para Línea General, otra
    // para 3P, por mes -- desde la columna `tipoLinea` real de la tabla
    // agendas (GET /calidad/agendas/linea), YA NO de la hoja "resumen".
    datos = (typeof gdAplicarFiltroMeses === 'function' ? gdAplicarFiltroMeses(datos, function(r){ return r.mes; }) : datos); // Fase 167: filtro "Meses"
    var meses = datos.map(function(r){ return r.mes; }).filter(function(v,idx,arr){ return arr.indexOf(v)===idx; }).sort();
    var porMesLinea = {};
    datos.forEach(function(r){ porMesLinea[r.mes+'|'+r.tipoLinea] = r.cantidad; });
    var CDl = (typeof colorSerie==='function' ? colorSerie('principal') : '#0d4a5e');
    var CGl = (typeof colorSerie==='function' ? colorSerie('secundaria') : '#0d4a5e'); // Fase 152 (B1): paleta categorica
    var o3 = loBar();
    _gdChart(canvasId, {
      type: 'bar',
      data: { labels: meses.map(_agendasMesLbl),
        datasets: [
          { label:'Línea General', data: meses.map(function(m){ return porMesLinea[m+'|GENERAL'] || 0; }), backgroundColor: CDl, borderRadius:3 },
          Object.assign({ label:'Línea 3P', data: meses.map(function(m){ return porMesLinea[m+'|3P'] || 0; }), backgroundColor: CGl, borderRadius:3 }, (typeof estiloBarraSecundaria==='function' ? estiloBarraSecundaria() : {})),
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

// ── Fase 210 (pedido de Edwin, 28/10, solo ORLANT): Clasificación de usuarios
// y Clasificación de líneas. Una sola ventana (modal-agendas-clasif) con dos
// modos. La lista se edita en memoria (el "+" agrega, cada fila se puede
// cambiar o quitar) y solo se guarda con "Guardar" -- el servidor la cruza al
// consultar, asi que corregirla nunca reescribe las agendas cargadas.
var _AGENDAS_CLIENTES_CLASIFICACION = ['ORLANT'];
var _agClasif = { modo: 'usuarios', campana: '', i: null, lista: [], sinAsesor: [], fueraDeLista: 0 };

function _agendasBotonesClasifHtml(campana, i){
  if(_AGENDAS_CLIENTES_CLASIFICACION.indexOf(campana) === -1 || typeof isFullAdmin !== 'function' || !isFullAdmin()) return '';
  return '<div class="agendas-clasif-botones" style="margin:0 0 12px">' +
    '<button type="button" class="btn-sm" onclick="agendasAbrirClasificacion(\'usuarios\','+i+')">Clasificación de usuarios</button>' +
    '<button type="button" class="btn-sm" onclick="agendasAbrirClasificacion(\'lineas\','+i+')">Clasificación de líneas</button></div>';
}

function _agClasifFormHtml(modo){
  if(modo === 'usuarios'){
    return '<div class="ig"><label for="agendas-clasif-n-usuario">Usuario</label><input id="agendas-clasif-n-usuario" autocomplete="off"></div>' +
      '<div class="ig"><label for="agendas-clasif-n-asesor">Nombre del asesor</label><input id="agendas-clasif-n-asesor" autocomplete="off"></div>' +
      '<div class="ig"><label for="agendas-clasif-n-fecha">Fecha de cambio (si el usuario pasa a otra persona)</label><input type="date" id="agendas-clasif-n-fecha"></div>' +
      '<div class="ig" style="flex:0 0 auto"><button type="submit" class="btn-primary" aria-label="Agregar usuario">+ Agregar</button></div>' +
      '<p class="agendas-clasif-error" id="agendas-clasif-error" role="alert"></p>';
  }
  return '<div class="ig"><label for="agendas-clasif-n-codigo">Código de la entidad</label><input id="agendas-clasif-n-codigo" autocomplete="off"></div>' +
    '<div class="ig"><label for="agendas-clasif-n-linea">Línea</label><select id="agendas-clasif-n-linea"><option value="">Elige…</option><option value="GENERAL">Línea General</option><option value="3P">Línea 3P</option></select></div>' +
    '<div class="ig" style="flex:0 0 auto"><button type="submit" class="btn-primary" aria-label="Agregar código">+ Agregar</button></div>' +
    '<p class="agendas-clasif-error" id="agendas-clasif-error" role="alert"></p>';
}

function _agClasifTablaHtml(){
  var n = function(x){ return (x||0).toLocaleString('es-CO'); };
  if(_agClasif.modo === 'usuarios'){
    var orden = _agClasif.lista.map(function(u, k){ return { u: u, k: k }; }).sort(function(a, b){
      if(a.u.usuario !== b.u.usuario) return a.u.usuario < b.u.usuario ? -1 : 1;
      return (a.u.fechaCambio || '') < (b.u.fechaCambio || '') ? -1 : 1;
    });
    var html = orden.length ? '<div class="gd-tabla-scroll"><table class="aurora-table tipif-clasif-tabla agendas-clasif-tabla"><thead><tr><th class="th-izq">Usuario</th><th class="th-izq">Asesor</th><th>Desde</th><th>Agendas del usuario</th><th><span class="sr-only">Quitar</span></th></tr></thead><tbody>' +
      orden.map(function(o){
        var u = o.u, k = o.k;
        return '<tr data-buscar="'+esc(agendasNormCodigo(u.usuario+' '+u.asesor))+'"><td>'+esc(u.usuario)+'</td>' +
          '<td><input data-k="'+k+'" data-campo="asesor" value="'+esc(u.asesor)+'" aria-label="Asesor del usuario '+esc(u.usuario)+'" onchange="agendasClasifEditar(this)"></td>' +
          '<td><input type="date" data-k="'+k+'" data-campo="fechaCambio" value="'+esc(u.fechaCambio||'')+'" aria-label="Fecha de cambio del usuario '+esc(u.usuario)+' (vacía = siempre)" title="Vacía = siempre ha sido de esta persona" onchange="agendasClasifEditar(this)"></td>' +
          '<td>'+n(u.agendasUsuario)+'</td>' +
          '<td><button type="button" class="btn-cancel" onclick="agendasClasifQuitar('+k+')" aria-label="Quitar el usuario '+esc(u.usuario)+(u.fechaCambio ? ' desde '+esc(u.fechaCambio) : '')+'">✕</button></td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="tipif-linea-nota">La lista está vacía. Agrega los usuarios con el "+" o cárgalos desde Excel.</p>';
    var enLista = {};
    _agClasif.lista.forEach(function(u){ enLista[u.usuario] = true; });
    var sin = _agClasif.sinAsesor.filter(function(s){ return !enLista[s.usuario]; });
    if(sin.length){
      html += '<p class="agendas-clasif-subtitulo">Usuarios de la base sin asesor ('+sin.length+')</p>' +
        '<div class="gd-tabla-scroll"><table class="aurora-table agendas-clasif-tabla"><thead><tr><th class="th-izq">Usuario</th><th>Agendas</th><th><span class="sr-only">Asignar</span></th></tr></thead><tbody>' +
        sin.map(function(s, k){
          return '<tr class="agendas-clasif-sin" data-buscar="'+esc(agendasNormCodigo(s.usuario))+'"><td>'+esc(s.usuario)+'</td><td>'+n(s.agendas)+'</td>' +
            '<td><button type="button" class="btn-sm" data-usuario="'+esc(s.usuario)+'" onclick="agendasClasifAsignar(this.dataset.usuario)" aria-label="Asignar asesor al usuario '+esc(s.usuario)+'">Asignar asesor</button></td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    return html;
  }
  var ordenC = _agClasif.lista.map(function(c, k){ return { c: c, k: k }; }).sort(function(a, b){
    if(a.c.linea !== b.c.linea) return a.c.linea === 'GENERAL' ? -1 : 1;
    return a.c.codigo < b.c.codigo ? -1 : 1;
  });
  var opt = function(v, txt, sel){ return '<option value="'+v+'"'+(v===sel?' selected':'')+'>'+txt+'</option>'; };
  return (ordenC.length ? '<div class="gd-tabla-scroll"><table class="aurora-table tipif-clasif-tabla agendas-clasif-tabla"><thead><tr><th class="th-izq">Código</th><th>Línea</th><th>Agendas</th><th><span class="sr-only">Quitar</span></th></tr></thead><tbody>' +
    ordenC.map(function(o){
      var c = o.c, k = o.k;
      return '<tr data-buscar="'+esc(agendasNormCodigo(c.codigo))+'"><td>'+esc(c.codigo)+'</td>' +
        '<td><select data-k="'+k+'" data-campo="linea" aria-label="Línea del código '+esc(c.codigo)+'" onchange="agendasClasifEditar(this)">'+opt('GENERAL', 'Línea General', c.linea)+opt('3P', 'Línea 3P', c.linea)+'</select></td>' +
        '<td>'+n(c.agendas)+'</td>' +
        '<td><button type="button" class="btn-cancel" onclick="agendasClasifQuitar('+k+')" aria-label="Quitar el código '+esc(c.codigo)+'">✕</button></td></tr>';
    }).join('') + '</tbody></table></div>' : '<p class="tipif-linea-nota">La lista está vacía. Agrega los códigos con el "+" o cárgalos desde Excel.</p>') +
    (_agClasif.fueraDeLista ? '<p class="tipif-linea-nota">'+n(_agClasif.fueraDeLista)+' agenda(s) cargadas tienen un código fuera de la lista o vacío: suman a 3P.</p>' : '');
}

function _agClasifPintar(){
  var cuerpo = document.getElementById('agendas-clasif-cuerpo');
  if(cuerpo) cuerpo.innerHTML = _agClasifTablaHtml();
  agendasClasifBuscar((document.getElementById('agendas-clasif-buscar') || {}).value || '');
}

async function agendasAbrirClasificacion(modo, i){
  var campana = _agendasCampanaPorPanel[i];
  var ov = document.getElementById('modal-agendas-clasif');
  if(!campana || !ov) return;
  _agClasif = { modo: modo, campana: campana, i: i, lista: [], sinAsesor: [], fueraDeLista: 0 };
  var esUsuarios = modo === 'usuarios';
  document.getElementById('modal-agendas-clasif-title').textContent = esUsuarios ? 'Clasificación de usuarios' : 'Clasificación de líneas';
  document.getElementById('agendas-clasif-nota').textContent = esUsuarios
    ? 'Cada usuario del aplicativo (columna A de la base) es de un asesor. Si un usuario pasa a otra persona, agrégalo otra vez con la fecha de cambio: sus agendas desde esa fecha cuentan para la persona nueva y las anteriores siguen siendo de la anterior. Sin fecha = siempre ha sido de esa persona.'
    : 'Cada código de entidad (columna R de la base) suma a la Línea General o a la Línea 3P. Los códigos que no estén en la lista (particulares, que se crean con la cédula) suman a 3P.';
  document.getElementById('agendas-clasif-excel-label').textContent = esUsuarios
    ? 'Cargar desde Excel (USUARIO, NOMBRE, FECHA DE CAMBIO)'
    : 'Cargar desde Excel (columnas 3P y GENERAL)';
  document.getElementById('agendas-clasif-agregar').innerHTML = _agClasifFormHtml(modo);
  document.getElementById('agendas-clasif-avisos').innerHTML = '';
  document.getElementById('agendas-clasif-buscar').value = '';
  var cuerpo = document.getElementById('agendas-clasif-cuerpo');
  cuerpo.innerHTML = '<p class="tipif-linea-nota">Cargando…</p>';
  ov.classList.add('show');
  try{
    var r = await apiRequest('GET', '/calidad/agendas/'+(esUsuarios ? 'usuarios' : 'codigos-entidad')+'?campana='+encodeURIComponent(campana));
    _agClasif.lista = esUsuarios ? (r.usuarios || []) : (r.codigos || []);
    _agClasif.sinAsesor = r.sinAsesor || [];
    _agClasif.fueraDeLista = r.agendasFueraDeLista || 0;
    _agClasifPintar();
  }catch(e){ cuerpo.innerHTML = '<p class="tipif-linea-nota">'+esc(e.message)+'</p>'; }
}

function agendasCerrarClasificacion(){
  var ov = document.getElementById('modal-agendas-clasif');
  if(ov) ov.classList.remove('show');
}

function agendasClasifBuscar(texto){
  var t = agendasNormCodigo(texto);
  document.querySelectorAll('#agendas-clasif-cuerpo tbody tr').forEach(function(tr){
    tr.style.display = !t || (tr.dataset.buscar || '').indexOf(t) > -1 ? '' : 'none';
  });
}

// El "+": un usuario repetido sin fecha de cambio no entra (se pide la fecha).
function agendasClasifAgregar(ev){
  if(ev && ev.preventDefault) ev.preventDefault();
  var val = function(id){ var el = document.getElementById(id); return el ? el.value : ''; };
  var err = document.getElementById('agendas-clasif-error');
  var esUsuarios = _agClasif.modo === 'usuarios';
  var r = esUsuarios
    ? agendasAgregarUsuario(_agClasif.lista, { usuario: val('agendas-clasif-n-usuario'), asesor: val('agendas-clasif-n-asesor'), fechaCambio: val('agendas-clasif-n-fecha') || null })
    : agendasAgregarCodigo(_agClasif.lista, { codigo: val('agendas-clasif-n-codigo'), linea: val('agendas-clasif-n-linea') });
  if(r.error){
    if(err) err.textContent = r.error;
    var foco = document.getElementById(esUsuarios ? (r.repetido ? 'agendas-clasif-n-fecha' : 'agendas-clasif-n-usuario') : 'agendas-clasif-n-codigo');
    if(foco) foco.focus();
    return;
  }
  if(err) err.textContent = '';
  _agClasif.lista = r.lista;
  document.getElementById('agendas-clasif-agregar').querySelectorAll('input, select').forEach(function(el){ el.value = ''; });
  _agClasifPintar();
  showToast(esUsuarios ? 'Usuario agregado a la lista (falta Guardar).' : 'Código agregado a la lista (falta Guardar).');
}

function agendasClasifAsignar(usuario){
  var u = document.getElementById('agendas-clasif-n-usuario');
  var a = document.getElementById('agendas-clasif-n-asesor');
  if(u) u.value = usuario;
  if(a) a.focus();
}

function agendasClasifEditar(el){
  var item = _agClasif.lista[parseInt(el.dataset.k, 10)];
  if(!item) return;
  item[el.dataset.campo] = el.dataset.campo === 'fechaCambio' ? (el.value || null) : el.value;
}

function agendasClasifQuitar(k){
  _agClasif.lista.splice(k, 1);
  _agClasifPintar();
}

// Excel: reemplaza la lista de la ventana (no guarda hasta "Guardar"). Toma la
// hoja AGENTES / CODIGOS si el archivo las trae (USUARIOS CON CAMBIOS ORLANT).
async function agendasClasifExcel(input){
  var file = input && input.files && input.files[0];
  var avisosEl = document.getElementById('agendas-clasif-avisos');
  if(!file || !avisosEl) return;
  var esUsuarios = _agClasif.modo === 'usuarios';
  var r;
  try{
    var wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type:'array' });
    var preferida = esUsuarios ? 'AGENTES' : 'CODIGOS';
    var nombre = wb.SheetNames.filter(function(s){ return agendasNormCodigo(s) === preferida; })[0] || wb.SheetNames[0];
    var filas = XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header:1, blankrows:false, defval:null });
    r = esUsuarios ? agendasLeerUsuariosExcel(filas) : agendasLeerCodigosExcel(filas);
  }catch(e){ r = { error: 'No se pudo leer el archivo: '+e.message }; }
  input.value = '';
  var avisos = [];
  if(r.error) avisos.push(r.error);
  else {
    var nuevos = esUsuarios ? r.usuarios : r.codigos;
    // Se conservan los conteos de agendas que ya se conocian.
    var previos = {};
    _agClasif.lista.forEach(function(x){ previos[esUsuarios ? x.usuario : x.codigo] = esUsuarios ? x.agendasUsuario : x.agendas; });
    nuevos.forEach(function(x){
      var p = previos[esUsuarios ? x.usuario : x.codigo];
      if(p !== undefined){ if(esUsuarios) x.agendasUsuario = p; else x.agendas = p; }
    });
    _agClasif.lista = nuevos;
    avisos.push(esUsuarios
      ? nuevos.length+' registro(s) leídos ('+nuevos.filter(function(u){ return u.fechaCambio; }).length+' con fecha de cambio): reemplazan la lista de abajo (falta Guardar).'
      : nuevos.length+' código(s) leídos ('+nuevos.filter(function(c){ return c.linea === 'GENERAL'; }).length+' General, '+nuevos.filter(function(c){ return c.linea === '3P'; }).length+' 3P): reemplazan la lista de abajo (falta Guardar).');
    avisos = avisos.concat(r.avisos || []);
    _agClasifPintar();
  }
  avisosEl.innerHTML = '<ul class="tipif-clasif-avisos-lista">'+avisos.map(function(a, k){
    return '<li'+(k>0 || r.error ? ' class="tipif-clasif-aviso"' : '')+'>'+esc(a)+'</li>';
  }).join('')+'</ul>';
}

async function agendasClasifGuardar(){
  var campana = _agClasif.campana;
  if(!campana) return;
  var esUsuarios = _agClasif.modo === 'usuarios';
  try{
    var r;
    if(esUsuarios){
      r = await apiRequest('PUT', '/calidad/agendas/usuarios', { campana: campana, usuarios: _agClasif.lista.map(function(u){ return { usuario: u.usuario, asesor: u.asesor, fechaCambio: u.fechaCambio || null }; }) });
      showToast('✓ Clasificación de usuarios guardada: '+r.usuariosDistintos+' usuario(s), '+r.conCambio+' con fecha de cambio.');
    } else {
      r = await apiRequest('PUT', '/calidad/agendas/codigos-entidad', { campana: campana, codigos: _agClasif.lista.map(function(c){ return { codigo: c.codigo, linea: c.linea }; }) });
      showToast('✓ Clasificación de líneas guardada: '+r.general+' código(s) en Línea General, '+r.p3+' en Línea 3P.');
    }
    agendasCerrarClasificacion();
    // El Agente y la linea de cada agenda cambian: se vuelven a pedir las opciones y se repinta.
    delete _agendasOpciones[campana];
    var p = _agendasPanelPorIndice[_agClasif.i];
    if(p) await _agendasRenderPanel(p, _agClasif.i);
  }catch(e){ showToast(e.message, 'error'); }
}

var _agClasifOv = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('modal-agendas-clasif') : null;
if(_agClasifOv && typeof _agClasifOv.addEventListener === 'function') _agClasifOv.addEventListener('click', function(e){ if(e.target === this) agendasCerrarClasificacion(); });
