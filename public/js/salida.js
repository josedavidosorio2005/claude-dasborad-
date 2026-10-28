// salida.js — Salida (Llamadas y WhatsApp) de ORLANT (Fase 127, pedido
// textual de Edwin: "las llamadas de salida estan muy bajas, hay que
// revisarlo"). Lee la tabla salida_mensual (totales mensuales del archivo
// FLUJO_LLAMADAS_Y_WPP_DE_SALIDA_POR_MES.xlsx) -- nunca duplica el skill
// LINEA DE SALIDA de Tipificacion de Llamadas (esa es solo verificacion
// cruzada, ver Fase 127 Parte 4).
//
// Pedido explicito de Edwin: "que sea simplemente el mes y la cantidad",
// con porcentaje SI APLICA -- NUNCA se inventa un denominador de entrada/
// gestion (pregunta abierta en docs/pendientes.md). Lo que se muestra: el
// total del mes + variacion vs el mes anterior, y la participacion
// 3P/General DENTRO del total de salida de ese mismo mes (nunca contra un
// total ajeno). 2 graficas de barras agrupadas por mes (3P vs General),
// una para Llamadas y otra para WhatsApp -- con solo 2 meses, una linea de
// tendencia no se lee (Parte 1 de la fase).
//
// Fase 170 (pedido de Edwin): para los meses que tienen CDR, el servidor
// calcula la salida desde Tipificacion (server/salida-cdr.js) y la reparte
// en 3P/General por la linea de cada asesor en ese mes. Lo que no tiene
// linea va a "Sin asignar" (suma al total). Debajo, solo el administrador
// ve la tabla de asesores del mes para asignarles la linea.
//
// Fase 187 (OK de Edwin: una sola clasificacion): si el servidor marca las
// filas con lineaPorCliente, la linea sale de la clasificacion por cliente
// de Tipificacion; lo que no tiene linea es "Sin clasificar" y el
// administrador la cambia con la misma ventana "Clasificación de asesores".
// Mientras no, el administrador ve tambien lo guardado mes a mes (solo lectura).
'use strict';

// Fase 187: "Sin clasificar" con la clasificacion por cliente; "Sin asignar" con la linea por mes.
function _salSinTexto(f){ return f && f.lineaPorCliente ? 'Sin clasificar' : 'Sin asignar'; }

// Total de un canal (3P + General + Sin asignar).
function _salTotal(f, canal){
  return canal === 'llamadas'
    ? (f.llamadas3p || 0) + (f.llamadasGeneral || 0) + (f.llamadasSinAsignar || 0)
    : (f.wpp3p || 0) + (f.wppGeneral || 0) + (f.wppSinAsignar || 0);
}
function _salEsAdmin(){
  return (typeof isMasterAdmin === 'function' && isMasterAdmin()) || (typeof currentUser !== 'undefined' && currentUser && currentUser.rol === 'ADMIN');
}

var _salOpciones = {}; // cache por campana: { meses }

async function _salCargarOpciones(campana){
  if(_salOpciones[campana]) return _salOpciones[campana];
  var op = { meses: [] };
  try{ op = await apiRequest('GET','/calidad/salida/opciones?campana='+encodeURIComponent(campana)); }
  catch(e){ /* sin datos o sin acceso -- el panel muestra "sin datos" */ }
  _salOpciones[campana] = op;
  return op;
}

async function _salidaRenderPanel(p, i){
  var campana = p.campana;
  var host = document.getElementById('gd-p'+i);
  if(!host) return;
  var titulo = p.titulo || 'Llamadas y WhatsApp de salida';
  host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">'+esc(titulo)+'</div>'+
    '<div style="text-align:center;color:var(--c-text-muted);padding:20px 8px">Cargando…</div></div>';

  var opciones = await _salCargarOpciones(campana);
  if(!opciones.meses || !opciones.meses.length){
    host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">'+esc(titulo)+'</div>'+
      '<div class="gd-vacio">Sin datos de Llamadas y WhatsApp de salida cargados todavia. Un usuario con permiso de administrador debe subir el archivo de Llamadas y WhatsApp de salida desde "Cargar Datos".</div></div>';
    return;
  }

  var html = '<div class="aurora-card">';
  html += '<div class="aurora-card-title">'+esc(titulo)+'</div>';
  // Fase 188 (pedido de Edwin): "Línea de cada asesor" arriba (antes al final).
  html += '<div id="sal-asesores-'+i+'"></div>';
  html += '<div id="sal-aviso-'+i+'"></div>';
  html += '<div id="sal-tarjetas-wrap-'+i+'"></div>';
  // Fase 163: cada grafica en su propio cuadro, con su titulo (Fase 165: mas grande).
  // Fase 189 (pedido de Edwin): los botones Total / Línea General / Línea 3P van en la cabecera de cada grafica.
  html += gdGraficaHtml('Llamadas de salida', '<div class="aurora-chart-wrap" style="height:280px"><canvas id="sal-llam-'+i+'" data-titulo="Llamadas de salida"></canvas></div>', { destacado: true, acciones: '<div id="sal-lin-llamadas-'+i+'"></div>' });
  html += gdGraficaHtml('WhatsApp de salida', '<div class="aurora-chart-wrap" style="height:280px"><canvas id="sal-wpp-'+i+'" data-titulo="WhatsApp de salida"></canvas></div>', { destacado: true, acciones: '<div id="sal-lin-wpp-'+i+'"></div>' });
  html += '<div id="sal-tabla-'+i+'"></div>';
  html += '</div>';
  host.innerHTML = html;

  await _salDibujar(campana, i, opciones);
}

// Variacion vs el mes anterior -- vacio (nunca "0%"/"Infinity%") si no hay
// mes anterior en la base o si ese mes anterior fue 0 (division invalida).

async function _salDibujar(campana, i, opciones){
  // Fase 207: los meses de MESES con datos (Todos = todos). mesSel = el
  // ultimo de ellos, solo para el editor de lineas del administrador.
  var conDatosSal = (opciones && opciones.meses) || [];
  var mesesSal = gdMesesTarjetasActual().filter(function(m){ return conDatosSal.indexOf(m) !== -1; });
  var mesSel = mesesSal[mesesSal.length-1] || '';
  var avisoEl = document.getElementById('sal-aviso-'+i);

  var filas = [];
  try{ filas = await apiRequest('GET','/calidad/salida/mensual?campana='+encodeURIComponent(campana)) || []; }
  catch(e){ showToast(e.message, 'error'); }

  if(avisoEl){
    avisoEl.innerHTML = !mesesSal.length
      ? _gdAvisoSinDatosMesHtml('Llamadas y WhatsApp de salida', _gdMeses().slice(-1)[0] || '', conDatosSal.length ? conDatosSal[conDatosSal.length-1] : null, mesNombreLargo)
      : '';
    // Fase 207: el aviso de asesores sin linea, por cada mes de MESES que lo tenga.
    filas.filter(function(f){ return mesesSal.indexOf(f.mes) !== -1 && f.asesoresSinAsignar; }).forEach(function(filaAviso){
      if(filaAviso.lineaPorCliente){
        avisoEl.innerHTML += '<div class="gd-aviso-sin-datos" role="status">' + esc(filaAviso.asesoresSinAsignar + ' asesor(es) con salidas en ' + mesNombreLargo(filaAviso.mes) +
          ' no están clasificados (Línea General o 3P): ' + gdFmtValor(filaAviso.llamadasSinAsignar || 0) + ' llamada(s) y ' + gdFmtValor(filaAviso.wppSinAsignar || 0) +
          ' WhatsApp quedan en "Sin clasificar" (cuentan en el Total).' + (_salEsAdmin() ? ' Clasifícalos arriba, en "Clasificación de asesores".' : '')) + '</div>';
      } else {
        avisoEl.innerHTML += '<div class="gd-aviso-sin-datos" role="status">' + esc(filaAviso.asesoresSinAsignar + ' asesor(es) con salidas en ' + mesNombreLargo(filaAviso.mes) +
          ' no tienen línea (3P o General): ' + gdFmtValor(filaAviso.llamadasSinAsignar || 0) + ' llamada(s) y ' + gdFmtValor(filaAviso.wppSinAsignar || 0) +
          ' WhatsApp quedan en "Sin asignar".' + (_salEsAdmin() ? ' Asígnalos arriba, en "Línea de cada asesor".' : '')) + '</div>';
      }
    });
  }

  // Fase 188/189: botones Total / Línea General / Línea 3P de cada grafica (solo con la clasificacion por cliente).
  _salFilas[i] = { filas: filas, meses: mesesSal };
  var conLineas = filas.some(function(f){ return f.lineaPorCliente; });
  if(!_salLinea[i] || !conLineas) _salLinea[i] = { llamadas: 'TOTAL', wpp: 'TOTAL' };
  ['llamadas', 'wpp'].forEach(function(c){
    var el = document.getElementById('sal-lin-'+c+'-'+i);
    if(el) el.innerHTML = conLineas ? _salBotonesLineaHtml(i, c) : '';
  });
  _salPintar(i);

  // Fase 170: editor de lineas (solo administrador, meses calculados del CDR).
  var asesoresEl = document.getElementById('sal-asesores-'+i);
  var filaMes = filas.filter(function(f){ return f.mes === mesSel; })[0];
  if(asesoresEl && filaMes && filaMes.lineaPorCliente){
    // Fase 187: una sola clasificacion (por cliente), la misma ventana de Tipificacion.
    asesoresEl.innerHTML = _salEsAdmin() ? gdGraficaHtml('Línea de cada asesor',
      '<p class="sal-asesores-ayuda">La línea de cada asesor es una sola para todos los meses, la misma de Tipificación. Los que no tengan línea quedan en "Sin clasificar".</p>' +
      '<div class="modal-btns" style="justify-content:flex-start;margin-top:10px"><button type="button" class="btn-primary" onclick="salAbrirClasificacion(\''+esc(campana)+'\', \''+esc(mesSel)+'\')">Clasificación de asesores</button></div>') : '';
  } else if(asesoresEl){
    if(_salEsAdmin() && filaMes && (filaMes.fuenteLlamadas === 'cdr' || filaMes.fuenteWpp === 'cdr')) await _salCargarEditor(campana, i, mesSel);
    else asesoresEl.innerHTML = '';
  }
}

// ── Fase 188: Total / Línea General / Línea 3P (Fase 189: un selector por grafica) ──
var _salLinea = {}; // por panel: { llamadas: 'TOTAL'|'GENERAL'|'3P', wpp: ... }
var _salFilas = {}; // por panel: { filas, meses } (lo ultimo traido del servidor; meses = los de MESES)
// Mismo selector de pastillas que las demas graficas del tablero (.gd-subtabs;
// a11y-teclado.js le da role tablist, aria-selected y flechas).
function _salBotonesLineaHtml(i, canal){
  var activa = (_salLinea[i] || {})[canal] || 'TOTAL';
  var nombre = canal === 'llamadas' ? 'llamadas' : 'WhatsApp';
  return '<div class="gd-subtabs sal-lineas" aria-label="Línea de '+nombre+' de salida">' +
    SALIDA_LINEAS_BOTONES.map(function(b){
      return '<button type="button" class="gd-subtab-btn'+(b.clave === activa ?' on':'')+'" data-linea="'+b.clave+'" onclick="salElegirLinea('+i+',\''+canal+'\',\''+b.clave+'\')">'+esc(b.etiqueta)+'</button>';
    }).join('') + '</div>';
}
// Cambia SOLO la metrica de ese canal (su tarjeta, sus barras y su parte de
// la tabla), sin volver a pedir los datos.
function salElegirLinea(i, canal, clave){
  if(!_salLinea[i]) _salLinea[i] = { llamadas: 'TOTAL', wpp: 'TOTAL' };
  _salLinea[i][canal] = clave;
  var el = document.getElementById('sal-lin-'+canal+'-'+i);
  if(el) el.innerHTML = _salBotonesLineaHtml(i, canal);
  _salPintar(i);
}
function _salPintar(i){
  var d = _salFilas[i];
  if(!d) return;
  var filas = d.filas, meses = d.meses || [];
  var mesSel = meses.length === 1 ? meses[0] : ''; // solo para comparar y resaltar
  var lineas = _salLinea[i] || { llamadas: 'TOTAL', wpp: 'TOTAL' };
  var sufijo = function(c){ return lineas[c] === 'TOTAL' ? '' : ' · ' + salidaEtiquetaLinea(lineas[c]); };
  var tarjetasEl = document.getElementById('sal-tarjetas-wrap-'+i);
  var tablaEl = document.getElementById('sal-tabla-'+i);
  if(tarjetasEl){
    // Fase 207: las tarjetas suman los meses de MESES (un mes "Pendiente" deja
    // la suma en Pendiente); el "vs. mes anterior" solo con UN mes marcado.
    var delMeses = filas.filter(function(f){ return meses.indexOf(f.mes) !== -1; });
    if(!delMeses.length){
      tarjetasEl.innerHTML = '<div class="gd-vacio-chico">Sin datos.</div>';
    } else {
      var sumarLinea = function(canal){
        var tot = 0;
        for(var k = 0; k < delMeses.length; k++){
          var v = salidaValorLinea(delMeses[k], canal, lineas[canal]);
          if(v === null || v === undefined) return null;
          tot += v;
        }
        return tot;
      };
      var totalLlam = sumarLinea('llamadas');
      var totalWpp = sumarLinea('wpp');
      var unico = delMeses.length === 1 && mesSel ? delMeses[0] : null;
      var idxU = unico ? filas.indexOf(unico) : -1;
      var anterior = idxU > 0 ? filas[idxU-1] : null;
      // Fase 152 (B8 + B3): solo se compara contra el mes INMEDIATAMENTE
      // anterior y nunca en el mes en curso (rotulo "mes en curso").
      if(anterior && anterior.mes !== gdMesAnterior(unico.mes)) anterior = null;
      var totalLlamAnt = anterior ? salidaValorLinea(anterior, 'llamadas', lineas.llamadas) : null;
      var totalWppAnt = anterior ? salidaValorLinea(anterior, 'wpp', lineas.wpp) : null;
      var hoySal = gdHoyLocal();
      var mesesTarjSal = delMeses.map(function(f){ return f.mes; });
      var enCursoSal = !!unico && gdEsMesEnCurso(unico.mes, hoySal);
      var optsSal = { unidad: 'num', mesEnCurso: enCursoSal, mesAnteriorLbl: unico ? mesNombreLargo(gdMesAnterior(unico.mes)).split(' ')[0].toLowerCase() : '' };
      var rotuloTxt = gdRotuloParcialMeses(mesesTarjSal, hoySal, mesNombreLargo);
      var rotuloSal = rotuloTxt ? '<div class="gd-mes-parcial kpi-fila-completa">'+esc(rotuloTxt)+'</div>' : '';
      var lblSal = unico ? salidaMesLbl(unico.mes) : gdMesesTarjetasTexto(mesesTarjSal, !_gdMeses().length, mesNombreLargo);
      tarjetasEl.innerHTML = '<div class="aurora-kpis">' + rotuloSal +
        kpiTarjetaHtml({ valor: gdFmtValor(totalLlam), etiqueta: 'Llamadas de salida'+sufijo('llamadas')+' · '+lblSal, variacion: unico ? kpiVariacion(totalLlam, totalLlamAnt, optsSal) : null }) +
        kpiTarjetaHtml({ valor: gdFmtValor(totalWpp), etiqueta: 'WhatsApp de salida'+sufijo('wpp')+' · '+lblSal, variacion: unico ? kpiVariacion(totalWpp, totalWppAnt, optsSal) : null }) +
        '</div>';
    }
  }
  // Fase 167: filtro "Meses" -- grafica y tabla (Fase 207: tambien las tarjetas).
  var filasMeses = (typeof gdAplicarFiltroMeses === 'function' ? gdAplicarFiltroMeses(filas, function(f){ return f.mes; }) : filas);
  _salDibujarGrafica('sal-llam-'+i, filasMeses, 'llamadas', 'Llamadas de salida'+sufijo('llamadas'), lineas.llamadas);
  _salDibujarGrafica('sal-wpp-'+i, filasMeses, 'wpp', 'WhatsApp de salida'+sufijo('wpp'), lineas.wpp);
  if(tablaEl) tablaEl.innerHTML = _salTablaHtml(filasMeses, mesSel, lineas);
}

// ── Fase 170: linea (3P/General) de cada asesor por mes (solo administrador) ──
var _salEditor = {}; // por panel: { campana, mes }
function _salEditorFilasHtml(asesores){
  if(!asesores.length) return '<p class="sal-asesores-ayuda">No hay asesores con salidas en este mes.</p>';
  var opt = function(v, txt, sel){ return '<option value="'+v+'"'+(v===sel?' selected':'')+'>'+txt+'</option>'; };
  return '<div class="gd-tabla-scroll"><table class="aurora-table"><thead><tr><th class="th-izq">Asesor</th><th>Línea</th><th>Llamadas de salida</th><th>WhatsApp de salida</th></tr></thead><tbody>' +
    asesores.map(function(a){
      var linea = a.linea || '';
      // La linea va junto al nombre: en el celular se elige sin deslizar la tabla.
      return '<tr><td>'+esc(a.agente)+'</td>' +
        '<td><select class="sal-linea" data-agente="'+esc(a.agente)+'" aria-label="Línea de '+esc(a.agente)+'">' +
        opt('', 'Sin asignar', linea) + opt('3P', '3P', linea) + opt('GENERAL', 'General', linea) + '</select></td>' +
        '<td>'+gdFmtValor(a.llamadas)+'</td><td>'+gdFmtValor(a.wpp)+'</td></tr>';
    }).join('') + '</tbody></table></div>';
}
// Fase 187: misma ventana que Tipificacion; al guardar, se redibuja el mes.
function salAbrirClasificacion(campana, mes){
  tipifAbrirClasificacionCliente(campana, function(){ if(typeof _gdIrAMes === 'function') _gdIrAMes(mes); });
}
// Fase 187 (solo lectura): lo guardado mes a mes, antes de pasar a la clasificacion por cliente.
function salInventarioLineasHtml(inv){
  if(!inv || !inv.meses || !inv.meses.length) return '<p class="sal-asesores-ayuda">Líneas guardadas mes a mes: ningún mes tiene líneas guardadas.</p>';
  var html = '<p class="sal-asesores-ayuda"><strong>Líneas guardadas mes a mes</strong> (solo lectura): ' +
    inv.meses.map(function(m){ return esc(mesNombreLargo(m.mes)+': '+m.asesores+' asesor(es) ('+m.p3+' en 3P, '+m.general+' en General)'); }).join('; ') + '.';
  if(inv.conflictos && inv.conflictos.length){
    html += ' Con línea distinta según el mes: ' + inv.conflictos.map(function(c){
      return esc(c.agente+' ('+Object.keys(c.porMes).map(function(mm){ return salidaMesLbl(mm)+' '+c.porMes[mm]; }).join(', ')+')');
    }).join('; ') + '.';
  }
  return html + '</p>';
}
async function _salCargarEditor(campana, i, mes){
  var el = document.getElementById('sal-asesores-'+i);
  if(!el) return;
  _salEditor[i] = { campana: campana, mes: mes };
  var r = null, inv = null;
  try{ r = await apiRequest('GET','/calidad/salida/asesores?campana='+encodeURIComponent(campana)+'&mes='+encodeURIComponent(mes)); }
  catch(e){ el.innerHTML = '<p class="sal-asesores-ayuda">'+esc(e.message)+'</p>'; return; }
  try{ inv = await apiRequest('GET','/calidad/salida/lineas-por-mes?campana='+encodeURIComponent(campana)); }catch(e){ inv = null; }
  el.innerHTML = gdGraficaHtml('Línea de cada asesor — '+esc(mesNombreLargo(mes)),
    '<p class="sal-asesores-ayuda">Solo lo ves tú (administrador). La salida de cada asesor de este mes se suma a la línea que elijas; si no tiene línea, va a "Sin asignar".</p>' +
    '<div id="sal-inventario-'+i+'">'+salInventarioLineasHtml(inv)+'</div>' +
    '<div id="sal-asesores-tabla-'+i+'">'+_salEditorFilasHtml(r.asesores || [])+'</div>' +
    '<div class="modal-btns" style="justify-content:flex-start;gap:10px;flex-wrap:wrap;margin-top:10px">' +
      '<button type="button" class="btn-cancel" onclick="salCopiarMesAnterior('+i+')">Copiar del mes anterior</button>' +
      '<button type="button" class="btn-primary" onclick="salGuardarLineas('+i+')">Guardar líneas</button>' +
    '</div>');
}
// Pone en cada asesor la linea que tenia el mes anterior (no guarda: hay que darle a Guardar).
async function salCopiarMesAnterior(i){
  var ed = _salEditor[i];
  if(!ed) return;
  var anterior = gdMesAnterior(ed.mes);
  try{
    var r = await apiRequest('GET','/calidad/salida/asesores?campana='+encodeURIComponent(ed.campana)+'&mes='+encodeURIComponent(anterior));
    var prev = {};
    (r.asesores || []).forEach(function(a){ if(a.linea) prev[a.agente] = a.linea; });
    var n = 0;
    document.querySelectorAll('#sal-asesores-tabla-'+i+' select.sal-linea').forEach(function(s){
      var l = prev[s.dataset.agente];
      if(l){ s.value = l; n++; }
    });
    showToast(n ? n+' asesor(es) con la línea de '+mesNombreLargo(anterior)+'. Revisa y guarda.' : 'En '+mesNombreLargo(anterior)+' no hay líneas para estos asesores.');
  }catch(e){ showToast(e.message, 'error'); }
}
async function salGuardarLineas(i){
  var ed = _salEditor[i];
  if(!ed) return;
  var asignaciones = Array.prototype.map.call(document.querySelectorAll('#sal-asesores-tabla-'+i+' select.sal-linea'), function(s){
    return { agente: s.dataset.agente, linea: s.value || null };
  });
  try{
    var r = await apiRequest('PUT','/calidad/salida/asesores', { campana: ed.campana, mes: ed.mes, asignaciones: asignaciones });
    showToast('✓ Líneas de '+mesNombreLargo(ed.mes)+' guardadas: '+r.guardadas+' asesor(es) con línea.');
    if(typeof _gdIrAMes === 'function') _gdIrAMes(ed.mes); // redibuja con los totales nuevos
  }catch(e){ showToast(e.message, 'error'); }
}

// Barras agrupadas por mes (3P vs General) -- con solo 2 meses una linea de
// tendencia no se lee (decision de la Parte 1 de la fase), asi que NUNCA se
// usa gdComboDatasets/una linea aqui, a diferencia de Efectividad de
// Agendamiento/Citas (que si tienen varios meses de historia).
function _salDibujarGrafica(canvasId, filas, canal, tituloEje, linea){
  var labels = filas.map(function(f){ return salidaMesLbl(f.mes); });
  // Fase 183 (pedido de Edwin): una sola serie con toda la salida del mes
  // (3P y General ya tienen su propia grafica); antes 3P/General/Sin asignar.
  var ds = [
    { type:'bar', label: tituloEje, data: filas.map(function(f){ return salidaValorLinea(f, canal, linea || 'TOTAL'); }), backgroundColor: (typeof CM!=='undefined'?CM:'#1a7a9e'), borderRadius:3, maxBarThickness:60 },
  ];
  var o = loFmt(loBar(tituloEje));
  loDatalabelsAuto(o);
  _gdChart(canvasId, { data: { labels: labels, datasets: ds }, options: o });
}

// Tabla de datos debajo de las graficas (mismo patron "Resumen por mes" de
// Inasistencia/Efectividad de Citas): mes alineado bajo cada columna, con
// su PROPIO scroll horizontal. El mes elegido arriba queda en negrita.
// % 3P: participacion DENTRO del total de salida de ESE mismo mes (nunca
// contra entrada/gestion -- Edwin no definio ese denominador).
function _salTablaHtml(filas, mesSel, lineas){
  if(!filas.length) return '';
  lineas = lineas || { llamadas: 'TOTAL', wpp: 'TOTAL' };
  function celda(tag, txt, mes){
    return '<'+tag+(mes===mesSel?' style="font-weight:700"':'')+'>'+esc(txt)+'</'+tag+'>';
  }
  function pct(parte, total){ return total>0 ? gdFmtValor(Math.round(parte/total*1000)/10,'%') : '—'; }
  function fila(label, valores){
    return '<tr><td>'+esc(label)+'</td>'+filas.map(function(f){ return celda('td', valores(f), f.mes); }).join('')+'</tr>';
  }
  var encabezados = filas.map(function(f){ return celda('th', salidaMesLbl(f.mes), f.mes); }).join('');
  var sinTxt = _salSinTexto(filas[0]).toLowerCase();
  var fuente = function(v){ return v === 'cdr' ? 'CDR' : (v === 'archivo' ? 'Archivo mensual' : '—'); };
  // Parte de un canal. Total: 3P, General, Sin asignar/clasificar (solo si algun
  // mes lo tiene), Total, % 3P (sobre el total del mes) y Fuente. Fase 188: con
  // una linea, su cantidad, el % del Total y la Fuente.
  function parte(c){
    var canal = c === 'llamadas' ? 'Llamadas' : 'WhatsApp';
    var pre = c === 'llamadas' ? 'llamadas' : 'wpp';
    var fuenteDe = function(f){ return fuente(c === 'llamadas' ? f.fuenteLlamadas : f.fuenteWpp); };
    var linea = lineas[c] || 'TOTAL';
    if(linea !== 'TOTAL'){
      return fila(canal+' · '+salidaEtiquetaLinea(linea), function(f){ return gdFmtValor(salidaValorLinea(f, c, linea)); }) +
        fila('% del Total ('+canal+')', function(f){ return pct(salidaValorLinea(f, c, linea), salidaValorLinea(f, c, 'TOTAL')); }) +
        fila('Fuente ('+canal+')', fuenteDe);
    }
    var haySin = filas.some(function(f){ return f[pre+'SinAsignar']; });
    return fila(canal+' 3P', function(f){ return gdFmtValor(f[pre+'3p']); }) +
      fila(canal+' General', function(f){ return gdFmtValor(f[pre+'General']); }) +
      (haySin ? fila(canal+' '+sinTxt, function(f){ return gdFmtValor(f[pre+'SinAsignar'] || 0); }) : '') +
      fila('Total '+canal, function(f){ return gdFmtValor(_salTotal(f, c)); }) +
      fila('% 3P ('+canal+')', function(f){ return pct(f[pre+'3p'], _salTotal(f, c)); }) +
      fila('Fuente ('+canal+')', fuenteDe);
  }
  return '<div class="gd-tabla-scroll gd-tabla-mt">' +
    '<table class="aurora-rank-table"><thead><tr><th></th>'+encabezados+'</tr></thead>'+
    '<tbody>'+parte('llamadas')+parte('wpp')+'</tbody></table></div>';
}
