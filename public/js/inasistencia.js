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
  var op = { meses:[], sedes:[], especialidades:[], entidades:[], mesesFormatoViejo:[] };
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

// "Resumen por mes" (Fase 109, pedido explicito: grafica de LINEA "como un
// grafico de linea de Excel", con una tabla de datos debajo, y 2 tarjetas
// -- la del periodo completo y la del mes elegido arriba, cada una con su
// propia etiqueta de rango para que nunca se confunda una con la otra).
// Aviso automatico por mes: 'parcial' (100% formato viejo, Fase 98-106,
// sin sede/entidad real), 'incompleto' (menos especialidades que el mas
// completo del rango, pero con datos reales) o 'sinDatosFiltro' (el mes
// existe pero el filtro de sede/especialidad/entidad lo dejo sin filas) --
// ver inasistenciaAvisosPorMes, inasistencia-logic.js.
async function _inasistenciaRenderPorMes(host, campana, i, titulo, opciones){
  var estado = _inasistenciaEstado[campana] || {};
  var html = '<div class="aurora-card">';
  html += '<div class="aurora-card-title">'+esc(titulo)+'</div>';
  html += _inasistenciaFiltrosHtml(i, 'pormes', opciones, estado);
  html += '<div id="inasist-tarjetas-wrap-'+i+'"></div>';
  html += '<div class="aurora-card-title" style="margin-top:10px">% de inasistencia por mes '+
    '<span class="gd-help" title="% de inasistencia = (Inasistencias + Pendientes) de TODAS las especialidades que pasen los filtros, dividido entre el total de citas, PONDERADO (nunca el promedio simple de los % de cada mes).">?</span></div>';
  html += '<div class="aurora-chart-wrap" style="height:320px"><canvas id="inasist-c-pormes-'+i+'"></canvas></div>';
  html += '<div id="inasist-tabla-pormes-'+i+'"></div>';
  html += '<div id="inasist-aviso-'+i+'"></div>';
  html += '</div>';
  host.innerHTML = html;
  await _inasistenciaDibujarPorMes(campana, i, opciones);
}

// Texto generico del/los filtro(s) activo(s), para el aviso "Mes no tiene
// datos por <filtro>." (Fase 109) -- nunca se arma a mano en 3 lugares.
function _inasistenciaFiltroActivoTxt(estado){
  var activos = [];
  if(estado.sede) activos.push('sede');
  if(estado.especialidad) activos.push('especialidad');
  if(estado.entidad) activos.push('entidad');
  return activos.length ? activos.join('/') : 'estos filtros';
}

function _inasistenciaAvisoHtml(a, estado){
  var texto;
  if(a.tipo === 'parcial'){
    // Fase 126 (pedido de Edwin, redaccion simple): antes decia "datos
    // parciales (... sin sede ni entidad)" -- "sede ni entidad" es jerga
    // tecnica del archivo, no algo que el cliente necesite entender. El
    // mensaje sigue siendo honesto (el mes SI esta incompleto) pero sin
    // explicar el motivo tecnico.
    texto = inasistenciaMesLbl(a.mes) + ': todavía está incompleto (por ahora solo trae ' + (a.especialidades||[]).map(textoFormatoNombre).join(', ') + ').';
  } else if(a.tipo === 'incompleto'){
    texto = inasistenciaMesLbl(a.mes) + ': solo incluye ' + (a.especialidades||[]).map(textoFormatoNombre).join(', ') + '.';
  } else {
    texto = inasistenciaMesLbl(a.mes) + ' no tiene datos por ' + _inasistenciaFiltroActivoTxt(estado) + '.';
  }
  return '<div style="margin-top:10px;padding:10px 14px;border-radius:8px;background:var(--c-warning-bg);border:1px solid var(--c-warning);color:var(--c-warning-dark);font-size:0.82rem">'+esc(texto)+'</div>';
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
  var mesSel = estado.mes;
  var mesesFormatoViejo = opciones.mesesFormatoViejo || [];
  var esFormatoViejo = {};
  mesesFormatoViejo.forEach(function(m){ esFormatoViejo[m] = true; });

  // 2 tarjetas (Fase 109): % ponderado de TODO el periodo filtrado (con la
  // etiqueta diciendo el RANGO exacto) + % del mes elegido arriba -- nunca
  // se confunden entre si.
  var wrap = document.getElementById('inasist-tarjetas-wrap-'+i);
  if(wrap){
    if(!agregado.length){
      wrap.innerHTML = '<div style="text-align:center;color:var(--c-text-muted);padding:16px 8px">Sin datos con estos filtros.</div>';
    } else {
      var ponderado = inasistenciaPonderadoTotal(agregado);
      var rangoLbl = inasistenciaRangoLbl(agregado);
      var delMes = agregado.filter(function(a){ return a.mes === mesSel; })[0];
      wrap.innerHTML = '<div class="aurora-kpis">' +
        _inasistenciaTarjetaHtml('% de inasistencia · ' + rangoLbl, ponderado.pct) +
        _inasistenciaTarjetaHtml('% de inasistencia · ' + (mesSel ? inasistenciaMesLbl(mesSel) : '—'), delMes ? delMes.pct : null) +
        '</div>';
    }
  }

  _inasistenciaDibujarLineaPorMes('inasist-c-pormes-'+i, agregado, mesSel, esFormatoViejo);

  var tablaEl = document.getElementById('inasist-tabla-pormes-'+i);
  if(tablaEl) tablaEl.innerHTML = _inasistenciaTablaHtml(agregado, mesSel, esFormatoViejo);

  var avisoEl = document.getElementById('inasist-aviso-'+i);
  if(avisoEl){
    var avisos = inasistenciaAvisosPorMes(agregado, opciones.meses || [], mesesFormatoViejo);
    avisoEl.innerHTML = avisos.map(function(a){ return _inasistenciaAvisoHtml(a, estado); }).join('');
  }
}

// Grafica de LINEA de "Resumen por mes" (Fase 109, pedido explicito: "como
// un grafico de linea de Excel"): una sola serie ("% de inasistencia",
// nunca "Series1" -- Chart.js toma la leyenda del `label` del dataset),
// etiqueta de valor SIEMPRE visible con 2 decimales y coma
// (inasistenciaFmtPct -- nunca el formato de 1 decimal de loPct/
// gdFmtValor), eje Y desde 0% con lineas guia suaves (CHART_GRID, mismo
// token que el resto de graficas). El mes elegido arriba se resalta
// (punto mas grande, mismo color CD que ya se usaba para resaltar barras);
// un mes 100% formato viejo (esFormatoViejo, ver inasistenciaOpciones)
// se dibuja con el punto HUECO (pointBackgroundColor:'transparent') y el
// tramo que LLEGA a el punteado (segment.borderDash, Chart.js v4 -- se
// evalua por el INDICE FINAL de cada segmento, p1DataIndex).
function _inasistenciaDibujarLineaPorMes(canvasId, agregado, mesSel, esFormatoViejo){
  var colorSel = (typeof CD!=='undefined'?CD:'#0d4a5e');
  var colorLinea = (typeof CM!=='undefined'?CM:'#1a7a9e');
  var labels = agregado.map(function(a){ return inasistenciaMesLbl(a.mes); });
  var valores = agregado.map(function(a){ return a.pct; });

  var o = lo(null);
  o.plugins.legend.display = true;
  o.plugins.datalabels.formatter = function(v){ return v===null||v===undefined?'':inasistenciaFmtPct(v); };
  o.scales.y.min = 0;
  o.scales.y.ticks.callback = function(v){ return gdFmtValor(v,'%'); };

  _gdChart(canvasId, {
    type: 'line',
    data: { labels: labels, datasets: [{
      label: '% de inasistencia',
      data: valores,
      borderColor: colorLinea,
      backgroundColor: colorLinea,
      borderWidth: 2.5,
      tension: 0, // recto, como un grafico de linea de Excel (nunca curvado)
      fill: false,
      pointRadius: agregado.map(function(a){ return a.mes===mesSel ? 7 : 4; }),
      pointHoverRadius: agregado.map(function(a){ return a.mes===mesSel ? 9 : 6; }),
      pointBackgroundColor: agregado.map(function(a){ return esFormatoViejo[a.mes] ? 'transparent' : (a.mes===mesSel ? colorSel : colorLinea); }),
      pointBorderColor: agregado.map(function(a){ return a.mes===mesSel ? colorSel : colorLinea; }),
      pointBorderWidth: agregado.map(function(a){ return esFormatoViejo[a.mes] ? 2 : 1; }),
      segment: {
        borderDash: function(ctx){
          var mesFin = agregado[ctx.p1DataIndex] ? agregado[ctx.p1DataIndex].mes : null;
          return (mesFin && esFormatoViejo[mesFin]) ? [6,4] : undefined;
        },
      },
    }] },
    options: o,
  });
}

// Tabla de datos debajo de la grafica (Fase 109, pedido explicito: "como
// la 'tabla de datos' de Excel"): mes y valor alineados bajo cada punto,
// con su PROPIO scroll horizontal (overflow-x:auto) para que en movil
// nunca sea la pagina completa la que se desplace. El mes elegido arriba
// queda en negrita (misma columna que el punto resaltado); un mes de
// formato viejo lleva un asterisco en el encabezado que remite al aviso
// de abajo (_inasistenciaAvisoHtml, tipo 'parcial').
function _inasistenciaTablaHtml(agregado, mesSel, esFormatoViejo){
  if(!agregado.length) return '';
  function celda(tag, txt, mes){
    return '<'+tag+(mes===mesSel?' style="font-weight:800"':'')+'>'+esc(txt)+'</'+tag+'>';
  }
  var encabezados = agregado.map(function(a){ return celda('th', inasistenciaMesLbl(a.mes) + (esFormatoViejo[a.mes]?' *':''), a.mes); }).join('');
  var filaPct = agregado.map(function(a){ return celda('td', inasistenciaFmtPct(a.pct), a.mes); }).join('');
  var filaTotal = agregado.map(function(a){ return celda('td', gdFmtValor(a.total), a.mes); }).join('');
  return '<div style="overflow-x:auto;margin-top:10px">' +
    '<table class="aurora-rank-table"><thead><tr><th></th>'+encabezados+'</tr></thead>'+
    '<tbody><tr><td>% de inasistencia</td>'+filaPct+'</tr>'+
    '<tr><td>Total de citas</td>'+filaTotal+'</tr></tbody></table></div>';
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
