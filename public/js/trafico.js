// trafico.js — InConexion Platform. Trafico de Llamadas (export real de
// Volvox, hoja DATA): carga por Excel (parseo + preview, mismo patron que
// cargas.js / metas.js NSD), mapeo de skills -> campana desde el panel de
// administracion, y el panel "trafico_combo" que consume el motor de
// dashboards genérico (dashboard-generic.js / dashboard-adapters.js) para
// la grafica combinada + filtros de cada dashboard de cliente.
//
// La logica pura (parseo del Excel, agregacion por granularidad) vive en
// trafico-logic.js, que se carga antes que este archivo — aqui solo hay
// codigo que toca el DOM / la API.

// ═══════════════════════════════════════════════════════════
// ADMIN — CARGA DE TRAFICO DESDE EXCEL (Volvox)
// ═══════════════════════════════════════════════════════════
var _tvParsed = null; // { archivoNombre, filas } listo para POST

async function procesarArchivoTrafico(input){
  var file = input.files && input.files[0];
  if(!file) return;

  var buf;
  try{ buf = await file.arrayBuffer(); }
  catch(e){ showToast('No se pudo leer el archivo'); input.value=''; return; }
  var wb, aoa;
  try{
    wb = XLSX.read(new Uint8Array(buf), { type:'array' }); // sin cellDates: DATE se convierte a mano (trafico-logic.js), no depende de la zona horaria
    var sheetName = wb.SheetNames.indexOf('DATA')!==-1 ? 'DATA' : wb.SheetNames[0];
    var ws = wb.Sheets[sheetName];
    aoa = XLSX.utils.sheet_to_json(ws, { header:1, blankrows:false, defval:null });
  }catch(e){ showToast('El archivo no es un Excel valido'); input.value=''; return; }

  var res = traficoParseFilas(aoa);
  if(res.error){ showToast(res.error); input.value=''; return; }

  _tvParsed = { archivoNombre: file.name, filas: res.filas };
  _renderPreviewTrafico(file.name, res);
}

function _renderPreviewTrafico(nombre, res){
  document.getElementById('tv-errores').innerHTML = (res.avisos||[]).map(function(a){ return '&#9888; '+esc(a); }).join('<br>');
  document.getElementById('tv-preview-resumen').textContent =
    nombre + ' — ' + res.filas.length + ' fila(s) validas, ' + res.skills.length + ' skill(s), ' +
    res.meses.length + ' mes(es) (' + res.meses.join(', ') + ')';
  var html = res.filas.slice(0,60).map(function(f){
    var nivel = f.nivelAtencionPct===undefined ? '—' : f.nivelAtencionPct+'%';
    return '<tr><td>'+esc(f.fecha)+'</td><td>'+esc(f.skillName)+'</td><td>'+f.totalLlamadas+'</td><td>'+f.contestadas+'</td><td>'+esc(nivel)+'</td></tr>';
  }).join('');
  if(res.filas.length>60) html += '<tr><td colspan="5" style="text-align:center;color:#7a9ba8">… y '+(res.filas.length-60)+' filas mas</td></tr>';
  document.getElementById('tv-preview-tbody').innerHTML = html;
  document.getElementById('tv-preview-card').style.display = '';
}

function cancelarPreviewTrafico(){
  _tvParsed = null;
  document.getElementById('tv-preview-card').style.display = 'none';
  document.getElementById('tv-file').value = '';
  document.getElementById('tv-errores').innerHTML = '';
}

async function guardarTrafico(){
  if(!_tvParsed){ showToast('Primero sube un archivo'); return; }
  var btn = document.getElementById('tv-save-btn');
  var resp;
  try{
    resp = await withButtonLoading(btn, 'Guardando...', function(){ return apiRequest('POST','/calidad/trafico/carga', _tvParsed); });
  }catch(e){ showToast(e.message); return; }
  var msg = resp.insertadas + ' fila(s) guardadas en ' + resp.campanas.length + ' campana(s)';
  if(resp.skillsSinAsignar && resp.skillsSinAsignar.length){
    msg += '. ' + resp.skillsSinAsignar.length + ' skill(s) nueva(s) sin asignar: ' + resp.skillsSinAsignar.join(', ');
  }
  showToast(msg);
  cancelarPreviewTrafico();
  _trafico = {}; // invalida el cache de datos de los paneles trafico_combo abiertos
  // Refresca tambien la tabla de Historial de Nivel de Servicio de esta misma
  // pagina (la carga de trafico recalcula esos meses, y sin esto quedaria
  // mostrando numeros de antes de subir el archivo hasta recargar la pagina).
  if(typeof renderNivelServicioSection === 'function') await renderNivelServicioSection();
  else if(typeof renderTraficoSkills === 'function') renderTraficoSkills();
}

// ═══════════════════════════════════════════════════════════
// ADMIN — MAPEO DE SKILLS -> CAMPANA
// ═══════════════════════════════════════════════════════════
async function renderTraficoSkills(){
  var tbody = document.getElementById('tv-skills-tbody');
  if(!tbody) return;
  var rows = [];
  try{ rows = await apiRequest('GET','/calidad/trafico/skills') || []; }
  catch(e){ tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#7a9ba8">'+esc(e.message)+'</td></tr>'; return; }

  if(!rows.length){
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#7a9ba8">Todavia no se ha cargado trafico de ninguna skill.</td></tr>';
    return;
  }
  var campanas = (typeof CAMPANAS_CALIDAD !== 'undefined') ? CAMPANAS_CALIDAD : [];
  tbody.innerHTML = rows.map(function(r, idx){
    var opciones = '<option value="">— Sin asignar —</option>' + campanas.map(function(c){
      return '<option value="'+esc(c)+'"'+(r.campana===c?' selected':'')+'>'+esc(c)+'</option>';
    }).join('');
    return '<tr>' +
      '<td>'+esc(r.skillName)+(r.campana?'':' <span style="background:#fff4e5;color:#8a5a12;border-radius:4px;padding:1px 6px;font-size:0.7rem;margin-left:4px">sin asignar</span>')+'</td>' +
      '<td><select id="tv-skill-sel-'+idx+'" data-skill="'+esc(r.skillName)+'">'+opciones+'</select></td>' +
      '<td>'+r.filas+'</td>' +
      '<td><button class="btn-sm" onclick="guardarMapeoSkill('+idx+')">Guardar</button></td>' +
      '</tr>';
  }).join('');
}

async function guardarMapeoSkill(idx){
  var sel = document.getElementById('tv-skill-sel-'+idx);
  if(!sel) return;
  var skillName = sel.dataset.skill;
  var campana = sel.value || null;
  try{
    var resp = await apiRequest('PUT','/calidad/trafico/skills/'+encodeURIComponent(skillName), { campana: campana });
    showToast('Mapeo guardado. '+resp.movidas+' fila(s) reatribuidas, '+resp.mesesRecalculados.length+' mes(es) recalculado(s).');
  }catch(e){ showToast(e.message); return; }
  _trafico = {}; // invalida cache: el trafico de esta skill ya vive en otra campana
  if(typeof renderNivelServicioSection === 'function') await renderNivelServicioSection();
  else renderTraficoSkills();
}

// ═══════════════════════════════════════════════════════════
// PANEL "trafico_combo" del dashboard generico (dashboard-generic.js)
// ═══════════════════════════════════════════════════════════
var _trafico = {};          // cache por campana: { campana: { filas:[...], skills:[...] } }
var _traficoEstado = {};    // estado de filtros actual por campana
var _traficoAgregadoActual = {}; // ultimo agregado calculado por campana (para exportar)

async function _traficoCargarDatos(campana){
  if(_trafico[campana]) return _trafico[campana];
  var filas = [];
  try{ filas = await apiRequest('GET','/calidad/nivel-servicio/diario?campana='+encodeURIComponent(campana)) || []; }
  catch(e){ filas = []; }
  var skills = [];
  var visto = {};
  filas.forEach(function(f){ if(!visto[f.skillName]){ visto[f.skillName]=true; skills.push(f.skillName); } });
  skills.sort();
  _trafico[campana] = { filas: filas, skills: skills };
  return _trafico[campana];
}

// Prefijo corto para no chocar con otros parametros de la URL si el dia de
// manana la app usara query params para otra cosa.
var TV_URL_PREFIJO = 'tv_';

function _traficoEstadoDesdeURL(){
  var params = new URLSearchParams(window.location.search);
  var skillsParam = params.get(TV_URL_PREFIJO+'skills');
  return {
    skills: skillsParam ? skillsParam.split(',').filter(Boolean) : null,
    desde: params.get(TV_URL_PREFIJO+'desde') || '',
    hasta: params.get(TV_URL_PREFIJO+'hasta') || '',
    granularidad: params.get(TV_URL_PREFIJO+'gran') || 'dia',
    combinar: params.get(TV_URL_PREFIJO+'modo') !== 'separado',
  };
}

// Solo escribe en la URL los parametros de ESTE panel; deja cualquier otro
// query param que ya existiera tal cual (para poder compartir la vista
// concreta sin pisar nada mas de la URL).
function _traficoGuardarEstadoURL(estado){
  var params = new URLSearchParams(window.location.search);
  if(estado.skills && estado.skills.length) params.set(TV_URL_PREFIJO+'skills', estado.skills.join(','));
  else params.delete(TV_URL_PREFIJO+'skills');
  if(estado.desde) params.set(TV_URL_PREFIJO+'desde', estado.desde); else params.delete(TV_URL_PREFIJO+'desde');
  if(estado.hasta) params.set(TV_URL_PREFIJO+'hasta', estado.hasta); else params.delete(TV_URL_PREFIJO+'hasta');
  params.set(TV_URL_PREFIJO+'gran', estado.granularidad);
  params.set(TV_URL_PREFIJO+'modo', estado.combinar ? 'combinado' : 'separado');
  var qs = params.toString();
  var url = window.location.pathname + (qs ? '?'+qs : '');
  window.history.replaceState(null, '', url);
}

async function _traficoRenderPanel(p, i){
  var host = document.getElementById('gd-p'+i);
  if(!host) return;
  var campana = p.campana;
  host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">Trafico de Llamadas (Volvox)</div>'+
    '<div style="text-align:center;color:#9bb0bb;padding:20px 8px">Cargando…</div></div>';

  var datos = await _traficoCargarDatos(campana);
  if(!datos.filas.length){
    host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">Trafico de Llamadas (Volvox)</div>'+
      '<div style="text-align:center;color:#9bb0bb;padding:24px 8px">Sin datos cargados todavia. Un usuario con permiso de administrador debe subir el export de Volvox desde "Cargar Datos → Trafico de Llamadas".</div></div>';
    return;
  }

  var estado = _traficoEstadoDesdeURL();
  var fechasDisponibles = datos.filas.map(function(f){ return f.fecha; }).sort();
  if(!estado.desde) estado.desde = fechasDisponibles[0];
  if(!estado.hasta) estado.hasta = fechasDisponibles[fechasDisponibles.length-1];
  if(!estado.skills) estado.skills = datos.skills.slice(); // sin filtro en la URL -> todas
  else estado.skills = estado.skills.filter(function(s){ return datos.skills.indexOf(s)!==-1; });
  if(!estado.skills.length) estado.skills = datos.skills.slice();
  _traficoEstado[campana] = estado;

  var GRAN_LABEL = { dia:'Dia', mes:'Mes', anio:'Año' };
  host.innerHTML =
    '<div class="aurora-card">' +
      '<div class="aurora-card-title">Trafico de Llamadas (Volvox)</div>' +
      '<div class="trafico-filtros" style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end;margin-bottom:12px">' +
        '<div><label style="display:block;font-size:0.72rem;color:#7a9ba8;margin-bottom:3px">Skill</label>' +
          '<select multiple id="tv-f-skills-'+i+'" size="'+Math.min(6, Math.max(2, datos.skills.length))+'" style="min-width:180px">' +
            datos.skills.map(function(s){ return '<option value="'+esc(s)+'"'+(estado.skills.indexOf(s)!==-1?' selected':'')+'>'+esc(s)+'</option>'; }).join('') +
          '</select></div>' +
        '<div><label style="display:block;font-size:0.72rem;color:#7a9ba8;margin-bottom:3px">Desde</label><input type="date" id="tv-f-desde-'+i+'" value="'+esc(estado.desde)+'"></div>' +
        '<div><label style="display:block;font-size:0.72rem;color:#7a9ba8;margin-bottom:3px">Hasta</label><input type="date" id="tv-f-hasta-'+i+'" value="'+esc(estado.hasta)+'"></div>' +
        '<div><label style="display:block;font-size:0.72rem;color:#7a9ba8;margin-bottom:3px">Granularidad</label>' +
          '<select id="tv-f-gran-'+i+'">' + ['dia','mes','anio'].map(function(g){ return '<option value="'+g+'"'+(estado.granularidad===g?' selected':'')+'>'+GRAN_LABEL[g]+'</option>'; }).join('') + '</select></div>' +
        '<div><label style="display:block;font-size:0.72rem;color:#7a9ba8;margin-bottom:3px">&nbsp;</label>' +
          '<label style="font-size:0.8rem"><input type="checkbox" id="tv-f-separado-'+i+'" '+(!estado.combinar?'checked':'')+'> Ver skills por separado</label></div>' +
        '<button class="btn-primary btn-sm" onclick="_traficoAplicarFiltros('+i+')">Aplicar filtros</button>' +
        '<span style="margin-left:auto;display:flex;gap:6px">' +
          '<button class="btn-sm" onclick="_traficoExportExcel('+i+')">Excel</button>' +
          '<button class="btn-sm" onclick="_traficoExportPrint('+i+')">PDF</button>' +
        '</span>' +
      '</div>' +
      '<div class="aurora-kpis" id="tv-kpis-'+i+'"></div>' +
      '<div class="aurora-chart-wrap" style="height:280px"><canvas id="tv-canvas-'+i+'"></canvas></div>' +
    '</div>';
  host.dataset.campana = campana;

  _traficoRenderContenido(campana, i);
}

function _traficoLeerControles(i){
  var sel = document.getElementById('tv-f-skills-'+i);
  var skills = sel ? Array.prototype.filter.call(sel.options, function(o){ return o.selected; }).map(function(o){ return o.value; }) : [];
  return {
    skills: skills,
    desde: document.getElementById('tv-f-desde-'+i).value,
    hasta: document.getElementById('tv-f-hasta-'+i).value,
    granularidad: document.getElementById('tv-f-gran-'+i).value,
    combinar: !document.getElementById('tv-f-separado-'+i).checked,
  };
}

function _traficoAplicarFiltros(i){
  var host = document.getElementById('gd-p'+i);
  var campana = host.dataset.campana;
  var estado = _traficoLeerControles(i);
  if(!estado.skills.length) estado.skills = (_trafico[campana] && _trafico[campana].skills.slice()) || [];
  _traficoEstado[campana] = estado;
  _traficoGuardarEstadoURL(estado);
  _traficoRenderContenido(campana, i);
}

function _traficoRenderContenido(campana, i){
  var datos = _trafico[campana];
  var estado = _traficoEstado[campana];
  var filtradas = traficoFiltrarFilas(datos.filas, { skills: estado.skills, desde: estado.desde, hasta: estado.hasta });
  var agregado = traficoAgregar(filtradas, { granularidad: estado.granularidad, combinar: estado.combinar });
  _traficoAgregadoActual[campana] = agregado;

  var totalLlamadas = filtradas.reduce(function(a,f){ return a+f.totalLlamadas; }, 0);
  var totalContestadas = filtradas.reduce(function(a,f){ return a+f.contestadas; }, 0);
  var nivelAtencion = totalLlamadas>0 ? Math.round((totalContestadas/totalLlamadas)*1000)/10 : null;
  var kpisEl = document.getElementById('tv-kpis-'+i);
  if(kpisEl){
    kpisEl.innerHTML =
      '<div class="aurora-kpi"><div class="kv">'+totalLlamadas.toLocaleString('es-CO')+'</div><div class="kl">Total Llamadas</div></div>'+
      '<div class="aurora-kpi kpi-green"><div class="kv">'+totalContestadas.toLocaleString('es-CO')+'</div><div class="kl">Llamadas Contestadas</div></div>'+
      '<div class="aurora-kpi '+(nivelAtencion===null?'':nivelAtencion>=90?'kpi-green':nivelAtencion>=70?'kpi-org':'kpi-red')+'"><div class="kv">'+(nivelAtencion===null?'—':nivelAtencion+'%')+'</div><div class="kl">Nivel de Atencion</div></div>';
  }

  var canvasId = 'tv-canvas-'+i;
  var labels, datasets;
  var CDl = (typeof CD!=='undefined') ? CD : '#0d4a5e';
  var CGl = (typeof CG!=='undefined') ? CG : '#27ae60';
  var COl = (typeof CO!=='undefined') ? CO : '#e67e22';
  var pal = (typeof PC!=='undefined') ? PC : [CDl,CGl,COl];

  if(estado.combinar){
    labels = agregado.map(function(a){ return a.periodo; });
    datasets = [
      { type:'bar', label:'Total Llamadas', data: agregado.map(function(a){return a.totalLlamadas;}), backgroundColor: CDl, yAxisID:'y', borderRadius:3 },
      { type:'bar', label:'Llamadas Contestadas', data: agregado.map(function(a){return a.contestadas;}), backgroundColor: CGl, yAxisID:'y', borderRadius:3 },
      { type:'line', label:'Nivel de Atencion', data: agregado.map(function(a){return a.nivelAtencionPct;}), borderColor: COl, backgroundColor: COl, yAxisID:'y2', borderWidth:2.5, pointRadius:3, tension:0.3 },
    ];
  } else {
    var periodos = agregado.map(function(a){ return a.periodo; }).filter(function(v,idx,arr){ return arr.indexOf(v)===idx; }).sort();
    var skillsPresentes = agregado.map(function(a){ return a.skillName; }).filter(function(v,idx,arr){ return arr.indexOf(v)===idx; });
    datasets = [];
    skillsPresentes.forEach(function(sk, idx){
      var porPeriodo = {};
      agregado.filter(function(a){ return a.skillName===sk; }).forEach(function(a){ porPeriodo[a.periodo]=a; });
      var color = pal[idx % pal.length];
      datasets.push({ type:'bar', label: sk+' — Total', data: periodos.map(function(p){ return porPeriodo[p]?porPeriodo[p].totalLlamadas:0; }), backgroundColor: color, yAxisID:'y', borderRadius:3 });
      datasets.push({ type:'line', label: sk+' — Nivel Atencion', data: periodos.map(function(p){ return porPeriodo[p]?porPeriodo[p].nivelAtencionPct:null; }), borderColor: color, backgroundColor: color, yAxisID:'y2', borderWidth:2, pointRadius:2, tension:0.3 });
    });
    labels = periodos;
  }

  var o = (typeof loBar==='function') ? loBar() : { responsive:true, maintainAspectRatio:false, plugins:{} };
  o.scales = {
    y: { position:'left', grid:{color:'#f0f4f8'}, ticks:{font:{size:8}} },
    y2: { position:'right', min:0, max:100, grid:{display:false}, ticks:{font:{size:8}, callback:function(v){ return v+'%'; }} },
    x: { grid:{display:false}, ticks:{font:{size:8}, maxRotation:60} },
  };
  o.plugins.datalabels = { display:false };
  o.plugins.tooltip = { callbacks: { label: function(ctx){
    var v = ctx.parsed.y;
    var suf = ctx.dataset.yAxisID==='y2' ? '%' : '';
    return ctx.dataset.label + ': ' + (v===null||v===undefined ? '—' : (suf ? v+suf : v.toLocaleString('es-CO')));
  } } };

  if(typeof _gdChart === 'function'){
    _gdChart(canvasId, { data:{ labels: labels, datasets: datasets }, options: o });
  }
}

function _traficoDatosExport(i){
  var host = document.getElementById('gd-p'+i);
  var campana = host ? host.dataset.campana : null;
  var agregado = _traficoAgregadoActual[campana] || [];
  return agregado.map(function(a){
    return {
      Periodo: a.periodo,
      Skill: a.skillName || 'Todas (combinado)',
      'Total Llamadas': a.totalLlamadas,
      'Llamadas Contestadas': a.contestadas,
      'Llamadas Abandonadas': a.llamadasAbandonadas,
      '% Nivel de Atencion': a.nivelAtencionPct,
      '% Tasa de Abandono': a.tasaAbandonoPct,
      '% Service Level 10s': a.serviceLevel10secPct,
      '% Service Level 20s': a.serviceLevel20secPct,
      '% Service Level 30s': a.serviceLevel30secPct,
      'ASA (seg)': a.asaSegundos,
      'ATA (seg)': a.ataSegundos,
      'AHT (seg)': a.ahtSegundos,
      'Wait Time (seg)': a.waitTimeSegundos,
    };
  });
}

function _traficoExportExcel(i){
  if(typeof XLSX === 'undefined'){ showToast('No se pudo cargar el generador de Excel.'); return; }
  var datos = _traficoDatosExport(i);
  if(!datos.length){ showToast('No hay datos para exportar con estos filtros.'); return; }
  var host = document.getElementById('gd-p'+i);
  var campana = host ? host.dataset.campana : 'trafico';
  var wb = XLSX.utils.book_new();
  if(typeof seedDemoActivo !== 'undefined' && seedDemoActivo){
    var avisoWs = XLSX.utils.aoa_to_sheet([
      ['DATOS DE DEMOSTRACION'],
      ['La informacion de este archivo es de prueba y NO corresponde a la operacion real.'],
    ]);
    XLSX.utils.book_append_sheet(wb, avisoWs, 'AVISO');
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(datos), 'Trafico');
  XLSX.writeFile(wb, 'Trafico_Llamadas_'+String(campana).replace(/\s+/g,'_')+'.xlsx');
}

function _traficoExportPrint(i){
  var datos = _traficoDatosExport(i);
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
  w.document.write('<!doctype html><html><head><title>Trafico de Llamadas — '+esc(campana)+'</title>'+
    '<style>body{font-family:Segoe UI,system-ui,sans-serif;color:#2a4a58;margin:28px}h1{color:#0d4a5e;font-size:18px}'+
    'table{border-collapse:collapse;width:100%;margin:10px 0 22px;font-size:11px}th{background:#0d4a5e;color:#fff;padding:6px 8px;text-align:left}'+
    'td{padding:5px 8px;border-bottom:1px solid #dde8ef}</style></head><body>'+
    avisoHtml +
    '<h1>Trafico de Llamadas — '+esc(campana)+'</h1>'+tabla+
    '<p style="margin-top:30px;color:#7a9ba8;font-size:10px">Generado por InConexion Platform — '+new Date().toLocaleString('es-CO')+'</p>'+
    '</body></html>');
  w.document.close();
  setTimeout(function(){ w.focus(); w.print(); }, 300);
}
