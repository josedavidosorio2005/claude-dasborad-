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
'use strict';

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
  html += '<div id="sal-aviso-'+i+'"></div>';
  html += '<div id="sal-tarjetas-wrap-'+i+'"></div>';
  // Fase 163: cada grafica en su propio cuadro, con su titulo (Fase 165: mas grande).
  html += gdGraficaHtml('Llamadas de salida', '<div class="aurora-chart-wrap" style="height:280px"><canvas id="sal-llam-'+i+'" data-titulo="Llamadas de salida"></canvas></div>', { destacado: true });
  html += gdGraficaHtml('WhatsApp de salida', '<div class="aurora-chart-wrap" style="height:280px"><canvas id="sal-wpp-'+i+'" data-titulo="WhatsApp de salida"></canvas></div>', { destacado: true });
  html += '<div id="sal-tabla-'+i+'"></div>';
  html += '<div id="sal-asesores-'+i+'"></div>';
  html += '</div>';
  host.innerHTML = html;

  await _salDibujar(campana, i, opciones);
}

// Variacion vs el mes anterior -- vacio (nunca "0%"/"Infinity%") si no hay
// mes anterior en la base o si ese mes anterior fue 0 (division invalida).

async function _salDibujar(campana, i, opciones){
  var mesSel = (typeof _gd !== 'undefined') ? _gd.mesSel : '';
  var avisoEl = document.getElementById('sal-aviso-'+i);
  var tarjetasEl = document.getElementById('sal-tarjetas-wrap-'+i);
  var tablaEl = document.getElementById('sal-tabla-'+i);

  var filas = [];
  try{ filas = await apiRequest('GET','/calidad/salida/mensual?campana='+encodeURIComponent(campana)) || []; }
  catch(e){ showToast(e.message, 'error'); }

  if(avisoEl){
    avisoEl.innerHTML = (!mesSel || (opciones.meses||[]).indexOf(mesSel) === -1)
      ? _gdAvisoSinDatosMesHtml('Llamadas y WhatsApp de salida', mesSel, opciones.meses.length ? opciones.meses[opciones.meses.length-1] : null, mesNombreLargo)
      : '';
    var filaAviso = filas.filter(function(f){ return f.mes === mesSel; })[0];
    if(filaAviso && filaAviso.asesoresSinAsignar){
      avisoEl.innerHTML += '<div class="gd-aviso-sin-datos" role="status">' + esc(filaAviso.asesoresSinAsignar + ' asesor(es) con salidas en ' + mesNombreLargo(mesSel) +
        ' no tienen línea (3P o General): ' + gdFmtValor(filaAviso.llamadasSinAsignar || 0) + ' llamada(s) y ' + gdFmtValor(filaAviso.wppSinAsignar || 0) +
        ' WhatsApp quedan en "Sin asignar".' + (_salEsAdmin() ? ' Asígnalos abajo, en "Línea de cada asesor".' : '')) + '</div>';
    }
  }

  if(tarjetasEl){
    var idx = filas.map(function(f){ return f.mes; }).indexOf(mesSel);
    var delMes = idx!==-1 ? filas[idx] : null;
    var anterior = idx>0 ? filas[idx-1] : null;
    if(!delMes){
      tarjetasEl.innerHTML = '<div class="gd-vacio-chico">Sin datos.</div>';
    } else {
      var totalLlam = _salTotal(delMes, 'llamadas');
      var totalWpp = _salTotal(delMes, 'wpp');
      // Fase 152 (B8 + B3): solo se compara contra el mes INMEDIATAMENTE
      // anterior (antes tomaba la fila anterior aunque faltara un mes en
      // medio) y nunca en el mes en curso (Salida se guarda como totales
      // mensuales: no hay dia de corte, el rotulo dice "mes en curso").
      if(anterior && anterior.mes !== gdMesAnterior(delMes.mes)) anterior = null;
      var totalLlamAnt = anterior ? _salTotal(anterior, 'llamadas') : null;
      var totalWppAnt = anterior ? _salTotal(anterior, 'wpp') : null;
      var hoySal = gdHoyLocal();
      var enCursoSal = gdEsMesEnCurso(delMes.mes, hoySal);
      var optsSal = { unidad: 'num', mesEnCurso: enCursoSal, mesAnteriorLbl: mesNombreLargo(gdMesAnterior(delMes.mes)).split(' ')[0].toLowerCase() };
      var rotuloSal = enCursoSal ? '<div class="gd-mes-parcial kpi-fila-completa">'+esc(gdRotuloMesParcial(delMes.mes, hoySal, null, mesNombreLargo))+'</div>' : '';
      tarjetasEl.innerHTML = '<div class="aurora-kpis">' + rotuloSal +
        kpiTarjetaHtml({ valor: gdFmtValor(totalLlam), etiqueta: 'Llamadas de salida · '+salidaMesLbl(delMes.mes), variacion: kpiVariacion(totalLlam, totalLlamAnt, optsSal) }) +
        kpiTarjetaHtml({ valor: gdFmtValor(totalWpp), etiqueta: 'WhatsApp de salida · '+salidaMesLbl(delMes.mes), variacion: kpiVariacion(totalWpp, totalWppAnt, optsSal) }) +
        '</div>';
    }
  }

  // Fase 167: filtro "Meses" -- grafica y tabla; las tarjetas siguen el MES de arriba.
  var filasMeses = (typeof gdAplicarFiltroMeses === 'function' ? gdAplicarFiltroMeses(filas, function(f){ return f.mes; }) : filas);
  _salDibujarGrafica('sal-llam-'+i, filasMeses, 'llamadas3p', 'llamadasGeneral', 'Llamadas de salida');
  _salDibujarGrafica('sal-wpp-'+i, filasMeses, 'wpp3p', 'wppGeneral', 'WhatsApp de salida');

  if(tablaEl) tablaEl.innerHTML = _salTablaHtml(filasMeses, mesSel);

  // Fase 170: editor de lineas (solo administrador, meses calculados del CDR).
  var asesoresEl = document.getElementById('sal-asesores-'+i);
  var filaMes = filas.filter(function(f){ return f.mes === mesSel; })[0];
  if(asesoresEl){
    if(_salEsAdmin() && filaMes && (filaMes.fuenteLlamadas === 'cdr' || filaMes.fuenteWpp === 'cdr')) await _salCargarEditor(campana, i, mesSel);
    else asesoresEl.innerHTML = '';
  }
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
async function _salCargarEditor(campana, i, mes){
  var el = document.getElementById('sal-asesores-'+i);
  if(!el) return;
  _salEditor[i] = { campana: campana, mes: mes };
  var r = null;
  try{ r = await apiRequest('GET','/calidad/salida/asesores?campana='+encodeURIComponent(campana)+'&mes='+encodeURIComponent(mes)); }
  catch(e){ el.innerHTML = '<p class="sal-asesores-ayuda">'+esc(e.message)+'</p>'; return; }
  el.innerHTML = gdGraficaHtml('Línea de cada asesor — '+esc(mesNombreLargo(mes)),
    '<p class="sal-asesores-ayuda">Solo lo ves tú (administrador). La salida de cada asesor de este mes se suma a la línea que elijas; si no tiene línea, va a "Sin asignar".</p>' +
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
function _salDibujarGrafica(canvasId, filas, campo3p, campoGeneral, tituloEje){
  var labels = filas.map(function(f){ return salidaMesLbl(f.mes); });
  var ds = [
    { type:'bar', label:'3P', data: filas.map(function(f){ return f[campo3p]; }), backgroundColor: (typeof CM!=='undefined'?CM:'#1a7a9e'), borderRadius:3, maxBarThickness:60 },
    { type:'bar', label:'General', data: filas.map(function(f){ return f[campoGeneral]; }), backgroundColor: (typeof CD!=='undefined'?CD:'#0d4a5e'), borderRadius:3, maxBarThickness:60 },
  ];
  // Fase 170: "Sin asignar" (asesores sin linea ese mes), solo si hay.
  var campoSin = campo3p === 'llamadas3p' ? 'llamadasSinAsignar' : 'wppSinAsignar';
  if(filas.some(function(f){ return f[campoSin]; })){
    ds.push({ type:'bar', label:'Sin asignar', data: filas.map(function(f){ return f[campoSin] || 0; }), backgroundColor: '#9aa0a6', borderRadius:3, maxBarThickness:60 });
  }
  var o = loFmt(loBar(tituloEje));
  loDatalabelsAuto(o);
  _gdChart(canvasId, { data: { labels: labels, datasets: ds }, options: o });
}

// Tabla de datos debajo de las graficas (mismo patron "Resumen por mes" de
// Inasistencia/Efectividad de Citas): mes alineado bajo cada columna, con
// su PROPIO scroll horizontal. El mes elegido arriba queda en negrita.
// % 3P: participacion DENTRO del total de salida de ESE mismo mes (nunca
// contra entrada/gestion -- Edwin no definio ese denominador).
function _salTablaHtml(filas, mesSel){
  if(!filas.length) return '';
  function celda(tag, txt, mes){
    return '<'+tag+(mes===mesSel?' style="font-weight:700"':'')+'>'+esc(txt)+'</'+tag+'>';
  }
  function pct(parte, total){ return total>0 ? gdFmtValor(Math.round(parte/total*1000)/10,'%') : '—'; }
  function fila(label, valores){
    return '<tr><td>'+esc(label)+'</td>'+filas.map(function(f){ return celda('td', valores(f), f.mes); }).join('')+'</tr>';
  }
  var encabezados = filas.map(function(f){ return celda('th', salidaMesLbl(f.mes), f.mes); }).join('');
  // Fase 170: "Sin asignar" solo si algun mes lo tiene; % 3P sobre el total del mes.
  var hayLlamSin = filas.some(function(f){ return f.llamadasSinAsignar; });
  var hayWppSin = filas.some(function(f){ return f.wppSinAsignar; });
  var fuente = function(v){ return v === 'cdr' ? 'CDR' : (v === 'archivo' ? 'Archivo mensual' : '—'); };
  var cuerpo =
    fila('Llamadas 3P', function(f){ return gdFmtValor(f.llamadas3p); }) +
    fila('Llamadas General', function(f){ return gdFmtValor(f.llamadasGeneral); }) +
    (hayLlamSin ? fila('Llamadas sin asignar', function(f){ return gdFmtValor(f.llamadasSinAsignar || 0); }) : '') +
    fila('Total Llamadas', function(f){ return gdFmtValor(_salTotal(f, 'llamadas')); }) +
    fila('% 3P (Llamadas)', function(f){ return pct(f.llamadas3p, _salTotal(f, 'llamadas')); }) +
    fila('Fuente (Llamadas)', function(f){ return fuente(f.fuenteLlamadas); }) +
    fila('WhatsApp 3P', function(f){ return gdFmtValor(f.wpp3p); }) +
    fila('WhatsApp General', function(f){ return gdFmtValor(f.wppGeneral); }) +
    (hayWppSin ? fila('WhatsApp sin asignar', function(f){ return gdFmtValor(f.wppSinAsignar || 0); }) : '') +
    fila('Total WhatsApp', function(f){ return gdFmtValor(_salTotal(f, 'wpp')); }) +
    fila('% 3P (WhatsApp)', function(f){ return pct(f.wpp3p, _salTotal(f, 'wpp')); }) +
    fila('Fuente (WhatsApp)', function(f){ return fuente(f.fuenteWpp); });
  return '<div class="gd-tabla-scroll gd-tabla-mt">' +
    '<table class="aurora-rank-table"><thead><tr><th></th>'+encabezados+'</tr></thead>'+
    '<tbody>'+cuerpo+'</tbody></table></div>';
}
