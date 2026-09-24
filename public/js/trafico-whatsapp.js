// trafico-whatsapp.js — InConexion Platform. Fase 50; interfaz reescrita en
// la Fase 68 (Pedido 5, Edwin 23/09) para igualar Trafico de Llamadas.
//
// Panel "Trafico de WhatsApp" del dashboard de ORLANT (tipo de panel
// 'trafico_whatsapp_combo', dashboard-config-seed.js) + pantalla de carga en
// el admin. Desde la Fase 68 reusa TAL CUAL la misma interfaz/controles/
// tipos de grafica que Trafico de Llamadas (trafico.js): desplegable de
// linea (aqui, cola) + comparador, filtros de fecha, sub-pestanas Resumen/
// Abandono/AHT/ASA-ATA/SL 20s, exportar Excel/PDF -- las funciones de
// DIBUJO (_traficoDibujarKpis/_traficoDibujarResumenChart/_traficoDibujarAbandono/
// _traficoDibujarAht/_traficoDibujarAsaAta/_traficoDibujarSL, trafico.js) son
// las MISMAS para los dos canales, nunca copiadas. La UNICA diferencia real
// de fondo es el grano del dato: aqui cada fila es una COLA por un PERIODO
// completo (fechaInicio..fechaFin), no un dia -- por eso no hay
// granularidad diaria (traficoWppAgregarPorPeriodo, trafico-whatsapp-
// logic.js, agrupa por mes/año en vez de sumar dias) y las graficas de
// tendencia muestran un punto por PERIODO cargado (hoy, uno solo: agosto).

// Descarga autenticada de la plantilla (GET requiere el header Authorization
// via JWT, asi que un <a href> plano no sirve -- mismo patron de blob+URL
// temporal que cualquier descarga autenticada de este tipo en un SPA).
async function descargarPlantillaTraficoWpp(){
  var res;
  try{
    res = await fetch(API_BASE + '/calidad/trafico/whatsapp/plantilla', { headers: apiHeaders(false) });
  }catch(e){ showToast('No se pudo conectar con el servidor.'); return; }
  if(!res.ok){
    var data = null; try{ data = await res.json(); }catch(e){}
    showToast((data && data.error) || 'No se pudo descargar la plantilla.');
    return;
  }
  var blob = await res.blob();
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'PLANTILLA_TRAFICO_WHATSAPP_INCONEXION_VACIA.xlsx';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

var _traficoWpp = {}; // cache por campana: { filas: [...] } (GET /calidad/trafico/whatsapp)
var _traficoWppEstado = {}; // estado de filtros actual por campana (mismo patron que _traficoEstado, trafico.js)
var _traficoWppAgregadoActual = {}; // ultimo agregado calculado por campana (para exportar)
var _traficoWppSubtabActivo = {}; // por campana -> key de subtab activa

// ASA/ATA/AHT de WhatsApp pueden ser bastante mayores que en voz (un chat
// puede quedar horas sin responder antes de que se marque abandonado, a
// diferencia de una llamada) -- se formatea con horas cuando aplica, no solo
// mm:ss, para que "82800" se lea "23:00:00" y no un numero de minutos gigante.
// Se pasa como `fmtTiempo` a _traficoDibujarAht/_traficoDibujarAsaAta
// (trafico.js) en vez de dejarles su formateador mm:ss por defecto.
function _traficoWppFmtTiempo(v) {
  if (v === null || v === undefined) return '—';
  var total = Math.round(v);
  var h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
  return h > 0 ? (h + ':' + pad2(m) + ':' + pad2(s)) : (m + ':' + pad2(s));
}

async function _traficoWppCargarDatos(campana) {
  if (_traficoWpp[campana]) return _traficoWpp[campana];
  var filas = [];
  try { filas = await apiRequest('GET', '/calidad/trafico/whatsapp?campana=' + encodeURIComponent(campana)) || []; }
  catch (e) { filas = []; }
  _traficoWpp[campana] = { filas: filas };
  return _traficoWpp[campana];
}

// Prefijo propio (distinto de TV_URL_PREFIJO en trafico.js) para que los
// filtros de Llamadas y de WhatsApp puedan vivir en la URL al mismo tiempo
// sin pisarse -- las dos pestañas del mismo dashboard de ORLANT comparten
// la misma campana ('ORLANT'), asi que sin un prefijo propio los ?tv_...
// de un canal se leerian/sobreescribirian con los del otro.
var TVW_URL_PREFIJO = 'tvw_';

function _traficoWppEstadoDesdeURL(){
  var params = new URLSearchParams(window.location.search);
  var skillsParam = params.get(TVW_URL_PREFIJO+'skills');
  return {
    skills: skillsParam ? skillsParam.split(',').filter(Boolean) : null,
    desde: params.get(TVW_URL_PREFIJO+'desde') || '',
    hasta: params.get(TVW_URL_PREFIJO+'hasta') || '',
    // Sin 'dia': WhatsApp no tiene granularidad diaria (cada fila ya es un
    // PERIODO completo) -- el desplegable de Granularidad de este panel
    // nunca ofrece esa opcion (ver _traficoWppRenderPanel).
    granularidad: params.get(TVW_URL_PREFIJO+'gran') || 'mes',
    combinar: params.get(TVW_URL_PREFIJO+'modo') !== 'separado',
  };
}
function _traficoWppGuardarEstadoURL(estado){
  var params = new URLSearchParams(window.location.search);
  if(estado.skills && estado.skills.length) params.set(TVW_URL_PREFIJO+'skills', estado.skills.join(','));
  else params.delete(TVW_URL_PREFIJO+'skills');
  if(estado.desde) params.set(TVW_URL_PREFIJO+'desde', estado.desde); else params.delete(TVW_URL_PREFIJO+'desde');
  if(estado.hasta) params.set(TVW_URL_PREFIJO+'hasta', estado.hasta); else params.delete(TVW_URL_PREFIJO+'hasta');
  params.set(TVW_URL_PREFIJO+'gran', estado.granularidad);
  params.set(TVW_URL_PREFIJO+'modo', estado.combinar ? 'combinado' : 'separado');
  var qs = params.toString();
  var url = window.location.pathname + (qs ? '?'+qs : '');
  window.history.replaceState(null, '', url);
}

async function _traficoWppRenderPanel(p, i) {
  var campana = p.campana;
  var host = document.getElementById('gd-p' + i);
  if (!host) return;
  host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">Trafico de WhatsApp (Wolkvox)</div>' +
    '<div style="text-align:center;color:var(--c-text-muted);padding:20px 8px">Cargando…</div></div>';

  var datosCampana = await _traficoWppCargarDatos(campana);
  if (!datosCampana.filas.length) {
    host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">Trafico de WhatsApp (Wolkvox)</div>' +
      '<div style="text-align:center;color:var(--c-text-muted);padding:24px 8px">Sin datos cargados todavia. Un usuario con permiso de administrador debe subir el archivo de Trafico de WhatsApp desde "Cargar Datos".</div></div>';
    return;
  }

  var colas = [];
  var vistoCola = {};
  datosCampana.filas.forEach(function(f){ if(!vistoCola[f.colaWhatsapp]){ vistoCola[f.colaWhatsapp]=true; colas.push(f.colaWhatsapp); } });
  colas.sort();

  var estado = _traficoWppEstadoDesdeURL();
  // Mismo criterio que Llamadas (traficoVentana12Meses, trafico-logic.js):
  // por defecto, los ultimos 12 meses CALENDARIO con datos -- aqui sobre
  // fechaInicio de cada periodo cargado, no sobre un dia individual.
  // minDisp = primer FECHA INICIO cargado; maxDisp = ultimo FECHA FIN
  // cargado (nunca fechaInicio para el limite "Hasta" -- un periodo tipico
  // dura casi un mes entero, asi que tomar fechaInicio como "Hasta" dejaba
  // el filtro por defecto mostrando "01/08" a "01/08" en vez de "01/08" a
  // "31/08").
  var fechasIniDisp = datosCampana.filas.map(function(f){ return f.fechaInicio; }).sort();
  var fechasFinDisp = datosCampana.filas.map(function(f){ return f.fechaFin; }).sort();
  var minDisp = fechasIniDisp[0], maxDisp = fechasFinDisp[fechasFinDisp.length-1];
  var desdeDefault = (typeof traficoVentana12Meses === 'function') ? traficoVentana12Meses(maxDisp, minDisp) : minDisp;
  if(!estado.desde) estado.desde = desdeDefault;
  if(!estado.hasta) estado.hasta = maxDisp;
  if(estado.desde > maxDisp || estado.hasta < minDisp){ estado.desde = desdeDefault; estado.hasta = maxDisp; }
  if(!estado.skills) estado.skills = colas.slice();
  else estado.skills = estado.skills.filter(function(s){ return colas.indexOf(s)!==-1; });
  if(!estado.skills.length) estado.skills = colas.slice();
  _traficoWppEstado[campana] = estado;

  var GRAN_LABEL = { mes:'Mes', anio:'Año' };
  var subActivo = _traficoWppSubtabActivo[campana] || 'resumen';
  host.innerHTML =
    '<div class="aurora-card">' +
      '<div class="aurora-card-title">Trafico de WhatsApp (Wolkvox)</div>' +
      '<div class="trafico-filtros" style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end;margin-bottom:12px">' +
        '<span id="tww-f-skillbar-'+i+'">'+_traficoFiltroLineaHTML('tww', i, colas, estado.skills, 'Cola', 'colas')+'</span>' +
        '<div><label style="display:block;font-size:0.72rem;color:var(--c-text-muted);margin-bottom:3px">Desde</label><input type="date" id="tww-f-desde-'+i+'" value="'+esc(estado.desde)+'"></div>' +
        '<div><label style="display:block;font-size:0.72rem;color:var(--c-text-muted);margin-bottom:3px">Hasta</label><input type="date" id="tww-f-hasta-'+i+'" value="'+esc(estado.hasta)+'"></div>' +
        '<div><label style="display:block;font-size:0.72rem;color:var(--c-text-muted);margin-bottom:3px">Granularidad</label>' +
          '<select id="tww-f-gran-'+i+'">' + ['mes','anio'].map(function(g){ return '<option value="'+g+'"'+(estado.granularidad===g?' selected':'')+'>'+GRAN_LABEL[g]+'</option>'; }).join('') + '</select></div>' +
        '<div><label style="display:block;font-size:0.72rem;color:var(--c-text-muted);margin-bottom:3px">&nbsp;</label>' +
          '<label style="font-size:0.8rem"><input type="checkbox" id="tww-f-separado-'+i+'" '+(!estado.combinar?'checked':'')+'> Ver colas por separado</label></div>' +
        '<button class="btn-primary btn-sm" onclick="_traficoWppAplicarFiltros('+i+')">Aplicar filtros</button>' +
        '<span style="margin-left:auto;display:flex;gap:6px">' +
          '<button class="btn-sm" onclick="_traficoWppExportExcel('+i+')">Excel</button>' +
          '<button class="btn-sm" onclick="_traficoWppExportPrint('+i+')">PDF</button>' +
        '</span>' +
      '</div>' +
      '<div class="gd-subtabs" id="tww-subtabs-'+i+'">' +
        _traficoSubtabsNavHTML('tww', i, subActivo, '_traficoWppSwitchSubtab', 'trafwppsub') +
      '</div>' +
      '<div id="tww-content-'+i+'"></div>' +
    '</div>';
  host.dataset.campana = campana;

  _traficoWppRenderSubtabContent(i);
}

// Mismo patron que _traficoRenderSubtabContent/_traficoSwitchSubtab
// (trafico.js), reusando _traficoSubtabContentHTML tal cual.
function _traficoWppRenderSubtabContent(i){
  var content = document.getElementById('tww-content-'+i);
  if(!content) return;
  var host = document.getElementById('gd-p'+i);
  var campana = host ? host.dataset.campana : null;
  var activo = _traficoWppSubtabActivo[campana] || 'resumen';
  content.innerHTML = _traficoSubtabContentHTML('tww', i, activo);
  _traficoWppRenderContenido(i);
}

function _traficoWppSwitchSubtab(i, key){
  var host = document.getElementById('gd-p'+i);
  var campana = host ? host.dataset.campana : null;
  _traficoWppSubtabActivo[campana] = key;
  var nav = document.getElementById('tww-subtabs-'+i);
  if(nav) Array.prototype.forEach.call(nav.querySelectorAll('.gd-subtab-btn'), function(btn){
    btn.classList.toggle('on', btn.dataset.trafwppsub===key);
  });
  _traficoWppRenderSubtabContent(i);
}

function _traficoWppLeerControles(i){
  var selCmp = document.getElementById('tww-f-skills-cmp-'+i);
  var seleccionCmp = selCmp ? Array.prototype.filter.call(selCmp.options, function(o){ return o.selected; }).map(function(o){ return o.value; }) : [];
  var selPrincipal = document.getElementById('tww-f-skill-'+i);
  var valorPrincipal = selPrincipal ? selPrincipal.value : '';
  var resuelto = traficoResolverSkillsControles(seleccionCmp, valorPrincipal);
  return {
    skills: resuelto.skills,
    desde: document.getElementById('tww-f-desde-'+i).value,
    hasta: document.getElementById('tww-f-hasta-'+i).value,
    granularidad: document.getElementById('tww-f-gran-'+i).value,
    combinar: !document.getElementById('tww-f-separado-'+i).checked,
  };
}

function _traficoWppAplicarFiltros(i){
  var host = document.getElementById('gd-p'+i);
  var campana = host.dataset.campana;
  var estado = _traficoWppLeerControles(i);
  var colasDisponibles = [];
  var visto = {};
  ((_traficoWpp[campana] || {}).filas || []).forEach(function(f){ if(!visto[f.colaWhatsapp]){ visto[f.colaWhatsapp]=true; colasDisponibles.push(f.colaWhatsapp); } });
  if(!estado.skills.length) estado.skills = colasDisponibles;
  _traficoWppEstado[campana] = estado;
  _traficoWppGuardarEstadoURL(estado);
  var skillbar = document.getElementById('tww-f-skillbar-'+i);
  if(skillbar) skillbar.innerHTML = _traficoFiltroLineaHTML('tww', i, colasDisponibles, estado.skills, 'Cola', 'colas');
  _traficoWppRenderContenido(i);
}

// Prepara los datos (filtrar + agregar por periodo) y delega el dibujo a
// las MISMAS funciones que usa Trafico de Llamadas (trafico.js) -- ver el
// comentario de cabecera de este archivo.
function _traficoWppRenderContenido(i){
  var host = document.getElementById('gd-p'+i);
  if(!host) return;
  var campana = host.dataset.campana;
  var estado = _traficoWppEstado[campana];
  var datosCampana = _traficoWpp[campana] || { filas: [] };
  var filtradas = traficoWppFiltrarFilas(datosCampana.filas, { skills: estado.skills, desde: estado.desde, hasta: estado.hasta });
  var agregado = traficoWppAgregarPorPeriodo(filtradas, { granularidad: estado.granularidad, combinar: estado.combinar });
  _traficoWppAgregadoActual[campana] = agregado;

  // Totales del periodo YA filtrado (nunca promedio de % de cada cola):
  // suma primero, calcula el % despues — mismo criterio de
  // traficoWppAgregarPorPeriodo/traficoAgregar.
  var totalWpp = filtradas.reduce(function(a,f){ return a+f.totalWhatsapp; }, 0);
  var totalContestados = filtradas.reduce(function(a,f){ return a+f.contestados; }, 0);
  var tieneAbandonados = filtradas.some(function(f){ return f.abandonados!=null; });
  var totalAbandonados = tieneAbandonados ? filtradas.reduce(function(a,f){ return a+(f.abandonados||0); }, 0) : null;
  var nivelAtencion = totalWpp>0 ? Math.round((totalContestados/totalWpp)*1000)/10 : null;
  var tasaAbandono = (totalWpp>0 && tieneAbandonados) ? Math.round((totalAbandonados/totalWpp)*1000)/10 : null;

  _traficoDibujarKpis('tww', i, { total: totalWpp, contestadas: totalContestados, abandonadas: totalAbandonados, nivelAtencion: nivelAtencion, tasaAbandono: tasaAbandono },
    { total: 'Total WhatsApp', contestadas: 'WhatsApp Contestados', abandonadas: 'WhatsApp Abandonados' }, campana);

  _traficoDibujarResumenChart('tww', i, agregado, estado.combinar, 'Total WhatsApp', 'WhatsApp Contestados');

  // Abandono/AHT/ASA-ATA/SL — siempre agregado combinado, sin depender del
  // checkbox "Ver colas por separado" de arriba (mismo criterio que
  // Llamadas): son la tendencia de la campana completa.
  var agregadoComb = estado.combinar ? agregado : traficoWppAgregarPorPeriodo(filtradas, { granularidad: estado.granularidad, combinar: true });

  _traficoDibujarAbandono('tww', i, agregadoComb);
  _traficoDibujarAht('tww', i, agregadoComb, _traficoWppFmtTiempo);
  _traficoDibujarAsaAta('tww', i, agregadoComb, _traficoWppFmtTiempo);
  _traficoDibujarSL('tww', i, agregadoComb);
}

// ═══════════════════════════════════════════════════════════
// EXPORTAR (Excel/PDF) — mismo patron que _traficoDatosExport/
// _traficoExportExcel/_traficoExportPrint (trafico.js), con las columnas
// de WhatsApp. Solo SL 20s (Pedido 3): serviceLevel10secPct/30secPct se
// siguen calculando igual, solo no se incluyen aqui.
// ═══════════════════════════════════════════════════════════
function _traficoWppDatosExport(i){
  var host = document.getElementById('gd-p'+i);
  var campana = host ? host.dataset.campana : null;
  var agregado = _traficoWppAgregadoActual[campana] || [];
  return agregado.map(function(a){
    return {
      Periodo: a.periodo,
      Cola: a.skillName || 'Todas (combinado)',
      'Total WhatsApp': a.totalLlamadas,
      'WhatsApp Contestados': a.contestadas,
      'WhatsApp Abandonados': a.llamadasAbandonadas,
      '% Nivel de Atencion': a.nivelAtencionPct,
      '% Tasa de Abandono': a.tasaAbandonoPct,
      '% Service Level 20s': a.serviceLevel20secPct,
      'ASA (seg)': a.asaSegundos,
      'ATA (seg)': a.ataSegundos,
      'AHT (seg)': a.ahtSegundos,
    };
  });
}

function _traficoWppExportExcel(i){
  if(typeof XLSX === 'undefined'){ showToast('No se pudo cargar el generador de Excel.'); return; }
  var datos = _traficoWppDatosExport(i);
  if(!datos.length){ showToast('No hay datos para exportar con estos filtros.'); return; }
  var host = document.getElementById('gd-p'+i);
  var campana = host ? host.dataset.campana : 'trafico_whatsapp';
  var wb = XLSX.utils.book_new();
  xlsxAgregarAvisoDemo(wb);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(xlsxFilasSeguras(datos)), 'TraficoWhatsApp');
  XLSX.writeFile(wb, 'Trafico_WhatsApp_'+String(campana).replace(/\s+/g,'_')+'.xlsx');
}

function _traficoWppExportPrint(i){
  var datos = _traficoWppDatosExport(i);
  if(!datos.length){ showToast('No hay datos para exportar con estos filtros.'); return; }
  var host = document.getElementById('gd-p'+i);
  var campana = host ? host.dataset.campana : '';
  var w = window.open('', '_blank');
  if(!w){ showToast('Permite las ventanas emergentes para exportar a PDF.'); return; }
  var cols = Object.keys(datos[0]);
  var tabla = '<table><thead><tr>'+cols.map(function(c){ return '<th>'+esc(c)+'</th>'; }).join('')+'</tr></thead><tbody>'+
    datos.map(function(r){ return '<tr>'+cols.map(function(c){ var v=r[c]; return '<td>'+(v===null||v===undefined?'—':esc(v))+'</td>'; }).join('')+'</tr>'; }).join('')+
    '</tbody></table>';
  var avisoHtml = (typeof seedDemoActivo !== 'undefined' && seedDemoActivo)
    ? '<div style="background:#92400e;color:#fff;text-align:center;padding:8px 12px;font-weight:700;border-radius:6px;margin-bottom:16px">'+
      '⚠ DATOS DE DEMOSTRACIÓN — la información de este documento es de prueba y no corresponde a la operación real.</div>'
    : '';
  w.document.write('<!doctype html><html><head><title>Trafico de WhatsApp — '+esc(campana)+'</title>'+
    '<style>body{font-family:Segoe UI,system-ui,sans-serif;color:#2a4a58;margin:28px}h1{color:#0d4a5e;font-size:18px}'+
    'table{border-collapse:collapse;width:100%;margin:10px 0 22px;font-size:11px}th{background:#0d4a5e;color:#fff;padding:6px 8px;text-align:left}'+
    'td{padding:5px 8px;border-bottom:1px solid #dde8ef}</style></head><body>'+
    avisoHtml +
    '<h1>Trafico de WhatsApp — '+esc(campana)+'</h1>'+tabla+
    '<p style="margin-top:30px;color:#7a9ba8;font-size:10px">Generado por InConexion Platform — '+new Date().toLocaleString('es-CO')+'</p>'+
    '</body></html>');
  w.document.close();
  setTimeout(function(){ w.focus(); w.print(); }, 300);
}

// ═══════════════════════════════════════════════════════════
// ADMIN — CARGA (parseo en el navegador, POST /calidad/trafico/whatsapp/carga)
// ═══════════════════════════════════════════════════════════
var _twwParsed = null; // { campana, archivoNombre, filas } listo para guardar

async function procesarArchivoTraficoWpp(input) {
  var file = input.files && input.files[0];
  if (!file) return;

  var buf;
  try { buf = await file.arrayBuffer(); }
  catch (e) { showToast('No se pudo leer el archivo'); input.value = ''; return; }
  var wb, aoa;
  try {
    wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
    var sheetName = wb.SheetNames.indexOf('DATA') !== -1 ? 'DATA' : wb.SheetNames[0];
    var ws = wb.Sheets[sheetName];
    aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null });
  } catch (e) { showToast('El archivo no es un Excel valido'); input.value = ''; return; }

  var res = traficoWppParseFilas(aoa);
  if (res.error) { showToast(res.error); input.value = ''; return; }

  var campana = document.getElementById('tww-campana-sel').value;
  _twwParsed = { campana: campana, archivoNombre: file.name, filas: res.filas };
  _renderPreviewTraficoWpp(file.name, res);
}

function _renderPreviewTraficoWpp(nombre, res) {
  document.getElementById('tww-errores').innerHTML = (res.avisos || []).map(function (a) { return '&#9888; ' + esc(a); }).join('<br>');
  document.getElementById('tww-preview-resumen').textContent =
    nombre + ' — ' + res.filas.length + ' fila(s) validas, ' + res.colas.length + ' cola(s), ' +
    res.periodos.length + ' periodo(s)';
  var html = res.filas.slice(0, 60).map(function (f) {
    return '<tr><td>' + esc(f.colaWhatsapp) + '</td><td>' + esc(f.fechaInicio) + '</td><td>' + esc(f.fechaFin) + '</td><td>' + f.totalWhatsapp + '</td><td>' + f.contestados + '</td></tr>';
  }).join('');
  if (res.filas.length > 60) html += '<tr><td colspan="5" style="text-align:center;color:var(--c-text-muted)">… y ' + (res.filas.length - 60) + ' filas mas</td></tr>';
  document.getElementById('tww-preview-tbody').innerHTML = html;
  document.getElementById('tww-preview-card').style.display = '';
}

function cancelarPreviewTraficoWpp() {
  _twwParsed = null;
  document.getElementById('tww-preview-card').style.display = 'none';
  document.getElementById('tww-file').value = '';
  document.getElementById('tww-errores').innerHTML = '';
}

async function guardarTraficoWpp() {
  if (!_twwParsed) { showToast('Primero sube un archivo'); return; }
  var btn = document.getElementById('tww-save-btn');
  var resp;
  try {
    resp = await withButtonLoading(btn, 'Guardando...', function () { return apiRequest('POST', '/calidad/trafico/whatsapp/carga', _twwParsed); });
  } catch (e) { showToast(e.message); return; }
  showToast(resp.insertadas + ' fila(s) guardadas (' + resp.colas.length + ' cola(s))');
  cancelarPreviewTraficoWpp();
  delete _traficoWpp[_twwParsed && _twwParsed.campana]; // invalida el cache del panel del dashboard
  _traficoWpp = {}; // por simplicidad, invalida todo el cache (pocas campanas usan este modulo hoy)
}
