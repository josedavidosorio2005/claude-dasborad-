// inasistencia.js — InConexion Platform (Fase 98, ORLANT, pedido URGENTE de
// Edwin; Fase 101: la vista PRINCIPAL pasa a ser "Por mes", total de todas
// las especialidades juntas -- "Por especialidad" deja de ser la principal;
// Fase 106, pedido de InCo: "que en Inasistencia solo quede en porcentaje,
// por mes" -- se retiran las sub-pestañas "Por especialidad" y "Detalle" y
// los conteos sueltos de "Por mes" (total de citas, atendidas, canceladas,
// inasistencias, pendientes); queda UNA sola vista, un panel
// `inasistencia_panel` sin `subtabs`: una tarjeta y una grafica, ambas solo
// con el % de inasistencia PONDERADO por mes, todas las especialidades
// juntas. El codigo de "Por especialidad"/"Detalle" (filtro de especialidad,
// grafica por especialidad, linea de tendencia por especialidad, tabla
// cruda) se borro en este cambio -- sigue disponible en el historial de git
// (PR de la Fase 106) si Edwin pide alguna de vuelta.
//
// El mes de la tarjeta sigue al selector "MES" de arriba (_gd.mesSel); la
// grafica compara TODOS los meses con datos, resaltando con otro color de
// la paleta categorica la barra del mes elegido arriba (nunca el semaforo
// -- no hay meta definida para inasistencia).
'use strict';

var _inasistenciaOpciones = {}; // cache por campana: { meses, especialidades }
var _inasistenciaEstado = {};   // { mes } por campana -- solo el mes sigue el selector global
var _inasistenciaCache = {}; // invalidado tras cada carga nueva (ver cargas.js) -- hoy sin uso propio, reservado por si se agrega cache de datos.

var _INASISTENCIA_VISTAS = {
  pormes: { titulo: 'Inasistencia por Mes' },
};

async function _inasistenciaCargarOpciones(campana){
  if(_inasistenciaOpciones[campana]) return _inasistenciaOpciones[campana];
  var op = { meses:[], especialidades:[] };
  try{ op = await apiRequest('GET','/calidad/inasistencia/opciones?campana='+encodeURIComponent(campana)); }
  catch(e){ /* sin datos o sin acceso -- se queda vacio, el panel muestra "sin datos" */ }
  _inasistenciaOpciones[campana] = op;
  return op;
}

// El Mes de Inasistencia SIEMPRE sigue al selector global (_gd.mesSel) --
// a diferencia de Agendas, no hay override propio dentro del panel. Devuelve
// true si el mes global no tiene datos de Inasistencia para esta campana.
function _inasistenciaSincronizarConMesGlobal(campana, opciones){
  if(!_inasistenciaEstado[campana]) _inasistenciaEstado[campana] = {};
  var mesGlobal = (typeof _gd !== 'undefined') ? _gd.mesSel : '';
  _inasistenciaEstado[campana].mes = mesGlobal;
  return !mesGlobal || (opciones.meses || []).indexOf(mesGlobal) === -1;
}

async function _inasistenciaRenderPanel(p, i){
  var campana = p.campana;
  var def = _INASISTENCIA_VISTAS.pormes;
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

  var sinDatosMes = _inasistenciaSincronizarConMesGlobal(campana, opciones);
  await _inasistenciaRenderPorMes(host, campana, i, titulo, sinDatosMes);
}

function _inasistenciaTarjetaHtml(titulo, valor, vari){
  var txt = (valor === null || valor === undefined) ? '—' : inasistenciaFmtPct(valor);
  var trendHtml = '';
  if(vari && vari.abs !== undefined){
    var bueno = vari.plano ? null : vari.baja; // % de inasistencia: mas bajo es mejor
    var tcls = vari.plano ? 'gd-tr-flat' : (bueno ? 'gd-tr-up' : 'gd-tr-down');
    var arrow = vari.plano ? '→' : (vari.sube ? '▲' : '▼');
    var absTxt = inasistenciaFmtPct(Math.abs(vari.abs));
    trendHtml = '<div class="gd-kpi-trend '+tcls+'">'+arrow+' <span>('+(vari.abs>=0?'+':'-')+absTxt+') vs mes anterior</span></div>';
  }
  return '<div class="aurora-kpi gd-kpi"><div class="kv">'+txt+'</div><div class="kl">'+esc(titulo)+'</div>'+trendHtml+'</div>';
}

// ── vista única (Fase 106): tarjeta con el % de inasistencia PONDERADO del
// mes elegido arriba, mas una grafica de barras con el mismo % de CADA mes
// con datos (todas las especialidades juntas, sin filtro) -- la barra del
// mes elegido arriba se resalta con otro color de la paleta categorica.
// Aviso automatico cuando un mes trae menos especialidades que el mes mas
// completo del rango (ver inasistenciaMesesIncompletos, inasistencia-logic.js).
async function _inasistenciaRenderPorMes(host, campana, i, titulo, sinDatosMes){
  var html = '<div class="aurora-card">';
  html += '<div class="aurora-card-title">'+esc(titulo)+'</div>';
  html += '<div id="inasist-tarjetas-wrap-'+i+'"></div>';
  html += '<div class="aurora-card-title" style="margin-top:10px">% de inasistencia por mes '+
    '<span class="gd-help" title="% de inasistencia = (INASISTENCIA + PENDIENTES) de TODAS las especialidades, del mes, dividido entre el total de citas del mes -- PONDERADO (nunca el promedio simple del % de cada especialidad).">?</span></div>';
  html += '<div class="aurora-chart-wrap" style="height:320px"><canvas id="inasist-c-pormes-'+i+'"></canvas></div>';
  html += '<div id="inasist-aviso-'+i+'"></div>';
  html += '</div>';
  host.innerHTML = html;
  await _inasistenciaDibujarPorMes(campana, i, sinDatosMes);
}

async function _inasistenciaDibujarPorMes(campana, i, sinDatosMes){
  var qs = 'campana='+encodeURIComponent(campana);
  var datos = [];
  try{ datos = await apiRequest('GET','/calidad/inasistencia/mensual?'+qs) || []; }catch(e){ showToast(e.message); }
  var agregado = inasistenciaAgregarPorMes(datos);

  // Tarjeta del mes elegido arriba (aviso en su lugar si ese mes no tiene
  // datos -- la grafica de abajo sigue mostrando todos los meses igual).
  var wrap = document.getElementById('inasist-tarjetas-wrap-'+i);
  if(wrap){
    if(sinDatosMes){
      var ultimoConDatos = agregado.length ? agregado[agregado.length-1].mes : null;
      wrap.innerHTML = _gdAvisoSinDatosMesHtml('Inasistencia', _gd.mesSel, ultimoConDatos);
    } else {
      var mes = (_inasistenciaEstado[campana] || {}).mes;
      var idxMes = agregado.map(function(a){ return a.mes; }).indexOf(mes);
      var actual = idxMes !== -1 ? agregado[idxMes] : null;
      var anterior = idxMes > 0 ? agregado[idxMes-1] : null;
      if(actual){
        var variPct = anterior ? _gdVariacion(actual.pct, anterior.pct) : null;
        wrap.innerHTML = '<div class="aurora-kpis">' + _inasistenciaTarjetaHtml('% de inasistencia', actual.pct, variPct) + '</div>';
      } else {
        wrap.innerHTML = '';
      }
    }
  }

  var labels = agregado.map(function(a){ return inasistenciaMesLbl(a.mes); });
  var mesSel = (_inasistenciaEstado[campana] || {}).mes;
  // CD vs CP (en vez de CD vs CM): en el tema oscuro CD/CM son dos celestes
  // casi iguales (poco contraste para resaltar una sola barra) -- CD/CP
  // (navy/celeste vs morado) se distinguen bien en los 2 temas, siguen
  // siendo 2 colores fijos de la paleta categorica, nunca por valor
  // (nunca el semaforo -- no hay meta definida para inasistencia).
  var colorSel = (typeof CD!=='undefined'?CD:'#0d4a5e');
  var colorResto = (typeof CP!=='undefined'?CP:'#8e44ad');
  var colores = agregado.map(function(a){ return a.mes === mesSel ? colorSel : colorResto; });

  var o = loPct(null);
  _gdChart('inasist-c-pormes-'+i, {
    type: 'bar',
    data: { labels: labels, datasets: [{ label: '% de inasistencia', data: agregado.map(function(a){ return a.pct; }), backgroundColor: colores, borderRadius: 3 }] },
    options: o,
  });

  // Aviso: meses con menos especialidades que el mes mas completo del rango
  // -- nunca se comparan como si fueran el mes completo.
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
