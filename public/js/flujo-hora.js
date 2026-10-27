// flujo-hora.js — InConexion Platform (Fase 196, Mobilize). Panel
// "flujo_hora_panel" (pestaña "Flujo por hora"): tres mapas de calor, uno
// debajo del otro -- Ingresadas, Contestadas y Abandonadas. Filas = hora
// (tramo), columnas = dias del mes, celda = cantidad de llamadas, con fila y
// columna de Total. Sigue el MES de arriba. Color en tres niveles del maximo
// de cada tabla (flujoHoraNivel): alto verde, medio amarillo, bajo gris; el
// numero siempre esta escrito. En el celular cada tabla se desplaza de lado
// dentro de su tarjeta (.table-wrap).
'use strict';

var _flujoHoraOpciones = {}; // cache por campana: { meses, skills }

async function _flujoHoraCargarOpciones(campana){
  if(_flujoHoraOpciones[campana]) return _flujoHoraOpciones[campana];
  var op = { meses: [], skills: [] };
  try{ op = (await apiRequest('GET','/calidad/flujo-hora/opciones?campana='+encodeURIComponent(campana))) || op; }
  catch(e){ /* sin datos o sin acceso -- estado vacio */ }
  _flujoHoraOpciones[campana] = op;
  return op;
}

var FLUJO_HORA_NIVEL_TEXTO = { alto: 'Alto', medio: 'Medio', bajo: 'Bajo' };

function _flujoHoraTablaHtml(m, metrica){
  var n = function(v){ return (v || 0).toLocaleString('es-CO'); };
  var cab = '<tr><th class="th-izq fh-hora" scope="col">Hora</th>' + m.dias.map(function(d){ return '<th scope="col">'+d+'</th>'; }).join('') + '<th scope="col" class="fh-total">Total</th></tr>';
  var cuerpo = m.horas.map(function(h){
    return '<tr><th scope="row" class="th-izq fh-hora">'+esc(flujoHoraTramo(h))+'</th>' +
      m.dias.map(function(d){
        var v = m.celdas[h][d];
        var nivel = flujoHoraNivel(v, m.max);
        return '<td class="fh-celda fh-'+nivel+'" title="'+esc(metrica.titulo+' · día '+d+' · '+flujoHoraTramo(h)+': '+v+' ('+FLUJO_HORA_NIVEL_TEXTO[nivel].toLowerCase()+')')+'">'+n(v)+'</td>';
      }).join('') +
      '<td class="fh-total">'+n(m.totalFila[h])+'</td></tr>';
  }).join('');
  var pie = '<tr class="fh-fila-total"><th scope="row" class="th-izq fh-hora">Total</th>' +
    m.dias.map(function(d){ return '<td class="fh-total">'+n(m.totalColumna[d])+'</td>'; }).join('') +
    '<td class="fh-total fh-gran-total">'+n(m.total)+'</td></tr>';
  return '<div class="table-wrap fh-wrap" tabindex="0" role="region" aria-label="'+esc(metrica.titulo+' por hora y día')+'">' +
    '<table class="aurora-table fh-tabla"><thead>'+cab+'</thead><tbody>'+cuerpo+pie+'</tbody></table></div>';
}

function _flujoHoraLeyendaHtml(){
  return '<p class="fh-leyenda"><span class="fh-muestra fh-alto"></span> Alto · <span class="fh-muestra fh-medio"></span> Medio · <span class="fh-muestra fh-bajo"></span> Bajo ' +
    '<span class="fh-leyenda-nota">(en tres tramos del valor más alto de cada tabla)</span></p>';
}

async function _flujoHoraRenderPanel(p, i){
  var host = document.getElementById('gd-p'+i);
  if(!host) return;
  var campana = p.campana || _gd.cliente;
  host.dataset.campana = campana;
  var op = await _flujoHoraCargarOpciones(campana);
  var titulo = '<div class="aurora-card-title">Flujo por hora</div>' +
    '<p class="lu-aviso">Llamadas por hora y día del mes, del reporte de cola por hora de Wolkvox.</p>';
  if(!(op.meses || []).length){
    host.innerHTML = '<div class="aurora-card">'+titulo+'<div class="gd-vacio">Sin flujo por hora cargado todavía' +
      (typeof canLoadData === 'function' && canLoadData() ? '. Se sube desde el Centro de cargas: Flujo por hora.' : '.') + '</div></div>';
    return;
  }
  var mesSel = (typeof _gd !== 'undefined' && _gd.mesSel) || op.meses[op.meses.length - 1];
  if(op.meses.indexOf(mesSel) === -1){
    host.innerHTML = '<div class="aurora-card">'+titulo+_gdAvisoSinDatosMesHtml('Flujo por hora', mesSel, op.meses[op.meses.length - 1])+'</div>';
    return;
  }
  var filas = [];
  try{ filas = (await apiRequest('GET','/calidad/flujo-hora/mes?campana='+encodeURIComponent(campana)+'&mes='+encodeURIComponent(mesSel))) || []; }
  catch(e){ showToast(e.message, 'error'); }
  var html = '<div class="aurora-card">'+titulo+_flujoHoraLeyendaHtml()+'</div>';
  FLUJO_HORA_METRICAS.forEach(function(met){
    var m = flujoHoraMatriz(filas, mesSel, met.key);
    html += '<div class="aurora-card fh-card" data-metrica="'+met.key+'">' +
      gdGraficaHtml(esc(met.titulo)+' — '+esc(mesNombreLargo(mesSel))+' <span class="fh-total-titulo">('+m.total.toLocaleString('es-CO')+')</span>', _flujoHoraTablaHtml(m, met)) +
      '</div>';
  });
  host.innerHTML = html;
}

// Exportar (Excel/PDF del tablero): una tabla por metrica del mes elegido.
async function _gdExportarFlujoHora(p){
  var campana = p.campana || _gd.cliente;
  var op = await _flujoHoraCargarOpciones(campana);
  var mesSel = _gd.mesSel;
  if(!(op.meses || []).length || op.meses.indexOf(mesSel) === -1) return [{ titulo: 'Flujo por hora', tipo: 'aviso', filas: [], mensaje: 'Sin flujo por hora para este mes.' }];
  var filas = [];
  try{ filas = (await apiRequest('GET','/calidad/flujo-hora/mes?campana='+encodeURIComponent(campana)+'&mes='+encodeURIComponent(mesSel))) || []; }catch(e){}
  return FLUJO_HORA_METRICAS.map(function(met){
    var m = flujoHoraMatriz(filas, mesSel, met.key);
    var tabla = m.horas.map(function(h){
      var f = { Hora: flujoHoraTramo(h) };
      m.dias.forEach(function(d){ f[String(d)] = m.celdas[h][d]; });
      f.Total = m.totalFila[h];
      return f;
    });
    var tot = { Hora: 'Total' };
    m.dias.forEach(function(d){ tot[String(d)] = m.totalColumna[d]; });
    tot.Total = m.total;
    tabla.push(tot);
    return { titulo: 'Flujo por hora — '+met.titulo+' — '+mesNombreLargo(mesSel), tipo: 'tabla', filas: tabla };
  });
}
