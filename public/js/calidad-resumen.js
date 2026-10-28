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

// Fase 203: meses de las tarjetas = los de MESES que tienen resumen; con
// "Todos" (o sin tablero), todos los meses cargados.
function _calResMesesTarjeta(meses){
  var sel = (typeof _gd !== 'undefined' && _gd && _gd.mesesSel) || [];
  return (typeof gdMesesTarjetas === 'function') ? gdMesesTarjetas(sel, meses) : meses.slice().sort();
}
function _calResMesesLbl(meses){
  if(!meses.length) return '';
  if(meses.length === 1) return mesNombreLargo(meses[0]);
  return gdMesesTexto(meses, mesNombreLargo);
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
  // Fase 203: tarjetas, torta, barras y tabla por asesor suman los meses de
  // MESES (Todos = todos los meses cargados), nunca un mes por defecto.
  var mesesT = _calResMesesTarjeta(meses);
  var delMes = calidadResumenSumarMeses(datos.meses || [], mesesT);
  var lblMes = _calResMesesLbl(delMes ? delMes.meses : mesesT);
  var varios = !!delMes && delMes.meses.length > 1;
  var html = '<div class="aurora-card">'+titulo;
  if(!delMes){
    html += _gdAvisoSinDatosMesHtml('Resumen de calidad', mesesT[mesesT.length - 1], meses[meses.length - 1]);
  } else {
    var clasif = calidadResumenClasificacion(delMes.promedio);
    var nivel = calidadResumenNivelClasificacion(clasif);
    var semCls = (typeof semaforoClaseCss === 'function') ? semaforoClaseCss(nivel) : '';
    html += '<div class="aurora-kpis">' +
      '<div class="aurora-kpi'+(semCls ? ' '+semCls : '')+'"><div class="kv">'+_calResPct(delMes.promedio)+'</div><div class="kl">Promedio general · '+esc(lblMes)+
        (clasif ? ' · '+((typeof semaforoSimboloDe === 'function') ? '<span class="gd-sem-simbolo" aria-hidden="true">'+semaforoSimboloDe(nivel)+'</span> ' : '')+esc(clasif) : '')+'</div></div>' +
      '<div class="aurora-kpi"><div class="kv">'+gdFmtValor(delMes.monitoreos)+'</div><div class="kl">Monitoreos'+(varios ? ' de los meses elegidos' : ' del mes')+'</div></div>' +
      '<div class="aurora-kpi"><div class="kv">'+gdFmtValor(delMes.fallos)+'</div><div class="kl">Fallos críticos'+(varios ? ' de los meses elegidos' : ' del mes')+'</div></div>' +
      '</div>';
    html += '<p class="cal-res-nota">Promedio general ponderado por el número de monitoreos de cada asesor.</p>';
    // Fase 202: torta con el % de monitoreos de cada asesor (suma 100 %) y
    // barras con el Prom. puntaje (%) de cada asesor (no suma 100: va en barras).
    html += '<div class="cal-res-graficas">' +
      gdGraficaHtml('Monitoreos por asesor (%) — '+esc(lblMes),
        '<div class="aurora-chart-wrap" style="height:280px"><canvas id="calres-c-pie-'+i+'" role="img" aria-label="Porcentaje de monitoreos de cada asesor en el mes"></canvas></div>') +
      gdGraficaHtml('Prom. puntaje (%) por asesor — '+esc(lblMes),
        '<div class="aurora-chart-wrap" style="height:280px"><canvas id="calres-c-bar-'+i+'" role="img" aria-label="Promedio de puntaje de cada asesor en el mes"></canvas></div>') +
      '</div>';
    html += gdGraficaHtml('Por asesor — '+esc(lblMes),
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
        return '<tr'+(delMes && !varios && delMes.meses[0] === m.mes ? ' style="font-weight:700"' : '')+'><td>'+esc(mesNombreLargo(m.mes))+'</td><td>'+gdFmtValor(m.monitoreos)+'</td><td>'+_calResPct(m.promedio)+'</td>' +
          _calResCeldaSemaforo(c, calidadResumenNivelClasificacion(c)) + '<td>'+gdFmtValor(m.fallos)+'</td></tr>';
      }).join('') + '</tbody></table></div>');
  }
  html += '</div>';
  host.innerHTML = html;
  if(delMes) _calResDibujarGraficas(delMes, i);
}

// Fase 202: torta (% de monitoreos por asesor) y barras (Prom. puntaje por asesor).
function _calResDibujarGraficas(delMes, i){
  if(typeof _gdChart !== 'function') return;
  var nombres = delMes.asesores.map(function(a){ return textoFormatoNombre(a.agente); });
  var colores = (typeof paletaColoresSinRepetir === 'function') ? paletaColoresSinRepetir(nombres) : (typeof PC !== 'undefined' ? PC.slice(0, nombres.length) : []);
  var pcts = calidadResumenPctMonitoreos(delMes.asesores);
  var oPie = (typeof loPie === 'function') ? loPie() : { responsive: true, maintainAspectRatio: false, plugins: {} };
  oPie.plugins.legend = { position: 'bottom', labels: { font: { size: 12 }, boxWidth: 10, padding: 8 } };
  oPie.plugins.tooltip = { callbacks: { label: function(ctx){
    var a = delMes.asesores[ctx.dataIndex];
    return nombres[ctx.dataIndex]+': '+_calResPct(pcts[ctx.dataIndex])+' ('+a.monitoreos+' de '+delMes.monitoreos+' monitoreos)';
  } } };
  _gdChart('calres-c-pie-'+i, { type: 'pie', data: { labels: nombres, datasets: [{ data: delMes.asesores.map(function(a){ return a.monitoreos; }), backgroundColor: colores }] }, options: oPie });
  var oBar = (typeof loBar === 'function') ? loBar() : { responsive: true, maintainAspectRatio: false, plugins: {} };
  oBar.plugins = oBar.plugins || {};
  oBar.plugins.legend = { display: false };
  oBar.scales = {
    y: { min: 0, max: 100, grid: { color: (typeof CHART_GRID !== 'undefined' ? CHART_GRID : '#f0f4f8') }, ticks: { font: { size: 12 }, callback: function(v){ return v + ' %'; } } },
    x: { grid: { display: false }, ticks: { font: { size: 12 } } },
  };
  oBar.plugins.tooltip = { callbacks: { label: function(ctx){ var a = delMes.asesores[ctx.dataIndex]; return _calResPct(a.puntaje)+' · '+a.clasificacion; } } };
  oBar.plugins.datalabels = { display: true, anchor: 'end', align: 'end', formatter: function(v){ return _calResPct(v); } };
  var color = (typeof colorSerie === 'function') ? colorSerie('principal') : '#29564b';
  _gdChart('calres-c-bar-'+i, { type: 'bar', data: { labels: nombres, datasets: [{ label: 'Prom. puntaje (%)', data: delMes.asesores.map(function(a){ return a.puntaje; }), backgroundColor: color, borderRadius: 3 }] }, options: oBar });
}

// Exportar (Excel/PDF del tablero): asesores del mes elegido + por mes.
async function _gdExportarCalidadResumen(p){
  var campana = p.campana || _gd.cliente;
  var datos = await _calResCargar(campana);
  if(!(datos.meses || []).length) return [{ titulo: 'Resumen de calidad por asesor', tipo: 'aviso', filas: [], mensaje: 'Sin resumen de calidad cargado todavía.' }];
  // Fase 203: los mismos meses que las tarjetas (MESES).
  var delMes = calidadResumenSumarMeses(datos.meses, _calResMesesTarjeta(datos.meses.map(function(m){ return m.mes; })));
  var out = [];
  if(delMes){
    var pctsExp = calidadResumenPctMonitoreos(delMes.asesores); // Fase 202: lo mismo que la torta
    out.push({ titulo: 'Resumen de calidad por asesor — '+_calResMesesLbl(delMes.meses), tipo: 'tabla', filas: delMes.asesores.map(function(a, k){
      return { Asesor: textoFormatoNombre(a.agente), '# Monitoreos': a.monitoreos, '% de monitoreos': pctsExp[k], 'Prom. puntaje (%)': a.puntaje, 'Clasificación': a.clasificacion, 'Alerta críticos': a.alerta, 'Fallos críticos': a.fallos };
    }) });
  }
  var porMes = (typeof gdAplicarFiltroMeses === 'function') ? gdAplicarFiltroMeses(datos.meses, function(m){ return m.mes; }) : datos.meses;
  out.push({ titulo: 'Resumen de calidad por mes', tipo: 'tabla', filas: porMes.map(function(m){
    return { Mes: mesNombreLargo(m.mes), Monitoreos: m.monitoreos, 'Promedio general (%)': m.promedio, 'Clasificación': calidadResumenClasificacion(m.promedio), 'Fallos críticos': m.fallos };
  }) });
  return out;
}
