// calidad-resumen.js — InConexion Platform (Fase 172, pedido de Edwin).
// Panel "calidad_resumen_panel" (pestaña Calidad de Mobilize): el resumen
// por asesor que Edwin carga con su plantilla. Sigue el MES de arriba:
// tarjetas (promedio general ponderado por # de monitoreos, total de
// monitoreos y fallos criticos del mes) y tabla por asesor con clasificacion
// y alerta en colores del semaforo (simbolo + texto, Fase 133). Debajo, la
// tabla "Por mes" respeta el filtro MESES (Fase 167). El servidor devuelve
// el resumen ya armado (GET /calidad/calidad-resumen/mensual).
'use strict';

var _calResOpciones = {}; // cache por campana: respuesta de /mensual

async function _calResCargar(campana){
  if(_calResOpciones[campana]) return _calResOpciones[campana];
  var r = { meses: [] };
  try{ r = (await apiRequest('GET','/calidad/calidad-resumen/mensual?campana='+encodeURIComponent(campana))) || r; }
  catch(e){ /* sin datos o sin acceso -- estado vacio */ }
  _calResOpciones[campana] = r;
  return r;
}

function _calResPct(v){ return v === null || v === undefined ? '—' : String(Math.round(v * 100) / 100).replace('.', ',') + ' %'; }

// Celda con el color del semaforo + simbolo (aria-hidden) + el texto visible.
function _calResCeldaSemaforo(texto, nivel){
  var cls = (typeof semaforoClaseCss === 'function') ? semaforoClaseCss(nivel) : '';
  var sim = (typeof semaforoSimboloDe === 'function') ? semaforoSimboloDe(nivel) : '';
  return '<td'+(cls ? ' class="'+cls+'"' : '')+'>'+(sim ? '<span class="gd-sem-simbolo" aria-hidden="true">'+sim+'</span> ' : '')+esc(texto || '—')+'</td>';
}

async function _calidadResumenRenderPanel(p, i){
  var host = document.getElementById('gd-p'+i);
  if(!host) return;
  var campana = p.campana || _gd.cliente;
  host.dataset.campana = campana;
  var titulo = '<div class="aurora-card-title">Resumen de calidad por asesor</div>';
  var datos = await _calResCargar(campana);
  var meses = (datos.meses || []).map(function(m){ return m.mes; });
  if(!meses.length){
    host.innerHTML = '<div class="aurora-card">'+titulo+'<div class="gd-vacio">Sin resumen de calidad cargado todavía' +
      (typeof canLoadData === 'function' && canLoadData() ? '. Se sube desde el Centro de cargas: Calidad: resumen por asesor.' : '.') + '</div></div>';
    return;
  }
  var mesSel = (typeof _gd !== 'undefined' && _gd.mesSel) || meses[meses.length - 1];
  var delMes = (datos.meses || []).filter(function(m){ return m.mes === mesSel; })[0];
  var html = '<div class="aurora-card">'+titulo;
  if(!delMes){
    html += _gdAvisoSinDatosMesHtml('Resumen de calidad', mesSel, meses[meses.length - 1]);
  } else {
    var clasif = calidadResumenClasificacion(delMes.promedio);
    var nivel = calidadResumenNivelClasificacion(clasif);
    var semCls = (typeof semaforoClaseCss === 'function') ? semaforoClaseCss(nivel) : '';
    html += '<div class="aurora-kpis">' +
      '<div class="aurora-kpi'+(semCls ? ' '+semCls : '')+'"><div class="kv">'+_calResPct(delMes.promedio)+'</div><div class="kl">Promedio general · '+esc(mesNombreLargo(mesSel))+
        (clasif ? ' · '+((typeof semaforoSimboloDe === 'function') ? '<span class="gd-sem-simbolo" aria-hidden="true">'+semaforoSimboloDe(nivel)+'</span> ' : '')+esc(clasif) : '')+'</div></div>' +
      '<div class="aurora-kpi"><div class="kv">'+gdFmtValor(delMes.monitoreos)+'</div><div class="kl">Monitoreos del mes</div></div>' +
      '<div class="aurora-kpi"><div class="kv">'+gdFmtValor(delMes.fallos)+'</div><div class="kl">Fallos críticos del mes</div></div>' +
      '</div>';
    html += '<p class="cal-res-nota">Promedio general ponderado por el número de monitoreos de cada asesor.</p>';
    html += gdGraficaHtml('Por asesor — '+esc(mesNombreLargo(mesSel)),
      '<div class="table-wrap"><table class="aurora-table"><thead><tr><th class="th-izq">Asesor</th><th># Monitoreos</th><th>Prom. puntaje</th><th>Clasificación</th><th>Alerta críticos</th><th>Fallos críticos</th></tr></thead><tbody>' +
      delMes.asesores.map(function(a){
        return '<tr><td>'+esc(textoFormatoNombre(a.agente))+'</td><td>'+gdFmtValor(a.monitoreos)+'</td><td>'+_calResPct(a.puntaje)+'</td>' +
          _calResCeldaSemaforo(a.clasificacion, calidadResumenNivelClasificacion(a.clasificacion)) +
          _calResCeldaSemaforo(a.alerta, calidadResumenNivelAlerta(a.alerta)) +
          '<td>'+gdFmtValor(a.fallos)+'</td></tr>';
      }).join('') + '</tbody></table></div>');
  }
  // Por mes (respeta el filtro MESES).
  var porMes = (typeof gdAplicarFiltroMeses === 'function') ? gdAplicarFiltroMeses(datos.meses || [], function(m){ return m.mes; }) : (datos.meses || []);
  if(porMes.length){
    html += gdGraficaHtml('Por mes',
      '<div class="table-wrap"><table class="aurora-table"><thead><tr><th class="th-izq">Mes</th><th>Monitoreos</th><th>Promedio general</th><th>Clasificación</th><th>Fallos críticos</th></tr></thead><tbody>' +
      porMes.map(function(m){
        var c = calidadResumenClasificacion(m.promedio);
        return '<tr'+(m.mes === mesSel ? ' style="font-weight:700"' : '')+'><td>'+esc(mesNombreLargo(m.mes))+'</td><td>'+gdFmtValor(m.monitoreos)+'</td><td>'+_calResPct(m.promedio)+'</td>' +
          _calResCeldaSemaforo(c, calidadResumenNivelClasificacion(c)) + '<td>'+gdFmtValor(m.fallos)+'</td></tr>';
      }).join('') + '</tbody></table></div>');
  }
  html += '</div>';
  host.innerHTML = html;
}

// Exportar (Excel/PDF del tablero): asesores del mes elegido + por mes.
async function _gdExportarCalidadResumen(p){
  var campana = p.campana || _gd.cliente;
  var datos = await _calResCargar(campana);
  if(!(datos.meses || []).length) return [{ titulo: 'Resumen de calidad por asesor', tipo: 'aviso', filas: [], mensaje: 'Sin resumen de calidad cargado todavía.' }];
  var mesSel = _gd.mesSel;
  var delMes = datos.meses.filter(function(m){ return m.mes === mesSel; })[0];
  var out = [];
  if(delMes){
    out.push({ titulo: 'Resumen de calidad por asesor — '+mesNombreLargo(mesSel), tipo: 'tabla', filas: delMes.asesores.map(function(a){
      return { Asesor: textoFormatoNombre(a.agente), '# Monitoreos': a.monitoreos, 'Prom. puntaje (%)': a.puntaje, 'Clasificación': a.clasificacion, 'Alerta críticos': a.alerta, 'Fallos críticos': a.fallos };
    }) });
  }
  var porMes = (typeof gdAplicarFiltroMeses === 'function') ? gdAplicarFiltroMeses(datos.meses, function(m){ return m.mes; }) : datos.meses;
  out.push({ titulo: 'Resumen de calidad por mes', tipo: 'tabla', filas: porMes.map(function(m){
    return { Mes: mesNombreLargo(m.mes), Monitoreos: m.monitoreos, 'Promedio general (%)': m.promedio, 'Clasificación': calidadResumenClasificacion(m.promedio), 'Fallos críticos': m.fallos };
  }) });
  return out;
}
