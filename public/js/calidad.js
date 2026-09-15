// calidad.js — InConexion Platform.
// Se carga como <script src> global y en orden; todas las funciones son globales
// y se invocan desde manejadores del HTML. No cambiar el orden de carga.
//
// MIGRADO A SERVIDOR (REAL_DATA_REPORT.md, Fase 1):
//  - Ya no se usa localStorage. Los monitoreos y el cronograma de metas viven en
//    la base de datos (endpoints /api/monitoreos, /api/metas, /api/calidad/plantillas).
//  - El puntaje de un monitoreo lo calcula SIEMPRE el servidor al guardar; aqui
//    solo se hace una vista previa mientras se responde el formulario.
//  - El cumplimiento individual por lider tambien lo calcula el servidor
//    (GET /api/metas/cumplimiento).
//  - CAL_DB pasa a ser una cache en memoria que se llena desde la API.

// ── Plantillas (formato de evaluacion por campana) ─────────────
// { 'ORLANT': { items:[{n,cat,label,weight,critico}], engine:'standard'|'sura' } }
var CAL_PLANTILLAS = {};
var _calPlantillasLoaded = false;

async function calLoadPlantillas(force){
  if(_calPlantillasLoaded && !force) return;
  try{
    var rows = await apiRequest('GET','/calidad/plantillas');
    CAL_PLANTILLAS = {};
    (rows||[]).forEach(function(p){ CAL_PLANTILLAS[p.campana] = { items:p.items||[], engine:p.engine||'standard' }; });
    _calPlantillasLoaded = true;
  }catch(e){
    if(!_calPlantillasLoaded) showToast('No se pudieron cargar las plantillas de Calidad: '+e.message);
  }
}

function calCampanas(){
  var k = Object.keys(CAL_PLANTILLAS);
  return k.length ? k : CAMPANAS_CON_PLANTILLA.slice();
}
function calItems(camp){ return (CAL_PLANTILLAS[camp] && CAL_PLANTILLAS[camp].items) || []; }
function calEngine(camp){ return (CAL_PLANTILLAS[camp] && CAL_PLANTILLAS[camp].engine) || 'standard'; }

// ── Cache de datos por campana ────────────────────────────────
// { camp: { monitoreos:[], cronogramaRows:[], cronogramaByMes:{}, cumplimiento:{mes:[]} } }
var CAL_DB = {};

function calCampCache(camp){
  if(!CAL_DB[camp]) CAL_DB[camp] = { monitoreos:[], cronogramaRows:[], cronogramaByMes:{}, cumplimiento:{} };
  return CAL_DB[camp];
}

// Carga desde el servidor los datos de una campana (monitoreos, cronograma y el
// cumplimiento del mes indicado). Se llama al abrir el modulo y al cambiar
// campana o mes. `mes` por defecto: el mes actual.
async function loadCalData(camp, mes){
  await calLoadPlantillas();
  // Umbrales de semaforo (color por dato, configurables desde el panel de
  // administracion): se cargan aqui tambien porque el modulo de Calidad se
  // puede abrir sin pasar por dashboard-generic.js/_gdBootstrap.
  if(typeof _gdCargarUmbrales === 'function'){ try{ await _gdCargarUmbrales(); }catch(e){} }
  if(!camp) return;
  mes = mes || new Date().toISOString().slice(0,7);
  var d = calCampCache(camp);
  var q = 'campana='+encodeURIComponent(camp);
  try{
    d.monitoreos = (await apiRequest('GET','/monitoreos?'+q)) || [];
  }catch(e){ d.monitoreos = d.monitoreos || []; }
  try{
    var metas = (await apiRequest('GET','/metas?'+q)) || [];
    d.cronogramaRows = metas;
    d.cronogramaByMes = {};
    metas.forEach(function(r){ (d.cronogramaByMes[r.mes] = d.cronogramaByMes[r.mes] || []).push(r); });
  }catch(e){ d.cronogramaRows = d.cronogramaRows || []; }
  try{
    var cu = await apiRequest('GET','/metas/cumplimiento?'+q+'&mes='+mes);
    d.cumplimiento[mes] = (cu && cu.lideres) || [];
  }catch(e){ d.cumplimiento[mes] = d.cumplimiento[mes] || []; }
}

// ── Helpers de filtro por mes (reutilizables en todos los modulos) ──
function calMonthKey(dateStr){ return dateStr ? String(dateStr).slice(0,7) : null; }
function calAvailableMonths(arr){
  var set = {};
  (arr||[]).forEach(function(m){ if(m.fecha) set[m.fecha.slice(0,7)] = true; });
  return Object.keys(set).sort().reverse();
}
function calFilterByMonth(arr, month){
  if(!month) return arr || [];
  return (arr||[]).filter(function(m){ return m.fecha && m.fecha.slice(0,7)===month; });
}
function calMonthSelectOptions(months, selected){
  return '<option value="">Todos los meses</option>' + months.map(function(mo){
    return '<option value="'+mo+'"'+(mo===selected?' selected':'')+'>'+mo+'</option>';
  }).join('');
}

// ── Cronograma / metas (lectura desde la cache) ───────────────
function calGetCronogramaForLider(camp, monthKey, liderId){
  if(liderId===undefined || liderId===null || liderId==='') return null;
  var d = CAL_DB[camp]; if(!d) return null;
  var rows = (d.cronogramaRows||[])
    .filter(function(r){ return String(r.liderId)===String(liderId) && r.mes<=monthKey; })
    .sort(function(a,b){ return b.mes.localeCompare(a.mes); });
  return rows[0] || null;
}
function calGetMyMetaForMonth(camp, monthKey){
  if(!currentUser) return null;
  var row = calGetCronogramaForLider(camp, monthKey, currentUser.id);
  return row ? row.metaGrupal : null;
}
// Valores derivados de una meta grupal — SOLO para la vista previa del formulario
// de Admin (metas.js). Al guardar, el servidor recalcula y devuelve estos campos.
function calBuildCronogramaRow(liderId, liderNombre, metaGrupal, asesores, diasLaborales, whatsapp, pctWhatsapp){
  metaGrupal = Number(metaGrupal)||0;
  asesores = Number(asesores)||1;
  diasLaborales = Number(diasLaborales)||19;
  var r2 = function(n){ return Math.round(n*100)/100; };
  return {
    liderId: (liderId===undefined||liderId===null) ? null : liderId,
    liderNombre: liderNombre||'',
    metaGrupal: metaGrupal, asesores: asesores, diasLaborales: diasLaborales,
    whatsapp: !!whatsapp, pctWhatsapp: Number(pctWhatsapp)||0,
    metaPorAsesor: r2(metaGrupal/asesores),
    metaDiaria: r2(metaGrupal/diasLaborales),
    semana1: r2(metaGrupal*0.25), semana2: r2(metaGrupal*0.5),
    semana3: r2(metaGrupal*0.75), semana4: metaGrupal
  };
}

// Cumplimiento individual por lider — lo calcula el servidor; aqui solo se lee
// de la cache lo que se cargo para ese mes en loadCalData().
function calLideresCumplimiento(camp, mes){
  var d = CAL_DB[camp];
  return (d && d.cumplimiento && d.cumplimiento[mes]) || [];
}

var _ccampana = 'ORLANT';
var _ctab = 'nuevo';
var _cmesFiltro = '';

// ── Motor de puntaje — vista previa en el navegador ───────────
// Copia exacta de server/calidad-logic.js (computeScore). El valor guardado
// siempre es el que devuelve el servidor; esto solo alimenta el preview mientras
// se responde el formulario, sin round-trip por cada cambio de select.
function calComputeScore(items, answers, engine){
  engine = engine || 'standard';
  var answered = items.some(function(it){ return answers[it.n]; });
  if(!answered) return {puntaje:null, clasificacion:'—', fallos:null, nivelCritico:'—'};
  var sum = 0, fallos = 0;
  items.forEach(function(it){
    var a = answers[it.n];
    if(engine==='sura'){
      if(a==='SI') sum += it.weight;
      if(it.critico && a==='NO') fallos++;
    } else if(!it.critico){
      if(a==='N/A'||a==='SI') sum += it.weight;
    } else {
      if(a==='N/A'||a==='SI') sum += it.weight;
      else if(a==='NO'){ sum += (it.weight-20); fallos++; }
    }
  });
  var puntaje = Math.max(0, Math.min(100, sum));
  var clasificacion = puntaje<70 ? '🔴 CRITICO' : (puntaje<90 ? '🟡 NO CRITICO' : '🟢 SOBRESALIENTE');
  var nivelCritico;
  if(engine==='sura'){
    nivelCritico = fallos===0 ? '✅ SIN FALLOS CRITICOS' : (fallos===1 ? '⚠️ ALERTA' : '🚨 CRITICO FRECUENTE');
  } else {
    nivelCritico = fallos===0 ? '✅ SIN FALLOS CRITICOS' : (fallos===1 ? '⚠️ ALERTA — 1 CRITICO' : '🚨 CRITICO ABSOLUTO');
  }
  return {puntaje:puntaje, clasificacion:clasificacion, fallos:fallos, nivelCritico:nivelCritico};
}

// ── Permisos (reflejan lo que el servidor tambien verifica) ──
function calCurrentPerm(){
  if(isFullAdmin()) return true;
  if(!currentUser || (currentUser.rol!=='CALIDAD' && currentUser.rol!=='SUPERVISOR')) return false;
  return currentUser.perms['campana_'+_ccampana]===true;
}
function calCanEvaluate(){
  return isFullAdmin() || (currentUser && (currentUser.rol==='CALIDAD' || currentUser.rol==='SUPERVISOR'));
}
function calCanManageMonitoreos(){
  if(isFullAdmin()) return true;
  if(!currentUser || currentUser.rol!=='REPORTES') return false;
  return currentUser.perms['campana_'+_ccampana]===true;
}
function calAccessibleCampanas(){
  return calCampanas().filter(function(c){
    if(isFullAdmin()) return true;
    if(!currentUser) return false;
    return currentUser.perms['campana_'+c]===true;
  });
}
function populateCalCampanaSelect(){
  var sel = document.getElementById('cal-campana-sel');
  var accesibles = calAccessibleCampanas();
  if(accesibles.length===0){
    sel.innerHTML = '<option value="">Sin campanas asignadas</option>';
    return;
  }
  sel.innerHTML = accesibles.map(function(c){ return '<option value="'+esc(c)+'">'+esc(c)+'</option>'; }).join('');
  if(accesibles.indexOf(_ccampana)===-1) _ccampana = accesibles[0];
  sel.value = _ccampana;
}

async function openCalidad(){
  document.getElementById('calidad-overlay').classList.add('show');
  await calLoadPlantillas();
  populateCalCampanaSelect();
  if(_ccampana) await loadCalData(_ccampana, _cmesFiltro || undefined);
  populateCalMesSelect();
  var cfg = document.getElementById('ctab-btn-config');
  if(cfg) cfg.style.display = isFullAdmin() ? '' : 'none';
  var canEval = calCanEvaluate();
  var nuevoBtn = document.getElementById('ctab-btn-nuevo');
  if(nuevoBtn) nuevoBtn.style.display = canEval ? '' : 'none';
  var cargaBtn = document.getElementById('ctab-btn-carga');
  if(cargaBtn) cargaBtn.style.display = canEval ? '' : 'none';
  document.getElementById('cf-fecha').value = new Date().toISOString().slice(0,10);
  if(currentUser) document.getElementById('cf-evaluador').value = currentUser.nombre;
  renderCalItemsForm();
  populateCalAsesorSelect();
  var defaultTab = canEval ? 'nuevo' : (currentUser && currentUser.rol==='REPORTES' ? 'reportes' : 'resumen');
  switchCalTab(defaultTab);
}
function closeCalidad(){
  document.getElementById('calidad-overlay').classList.remove('show');
}
document.getElementById('calidad-overlay').addEventListener('click',function(e){ if(e.target===this) closeCalidad(); });

function populateCalMesSelect(){
  var sel = document.getElementById('cal-mes-sel');
  var arr = (CAL_DB[_ccampana] && CAL_DB[_ccampana].monitoreos) || [];
  var months = calAvailableMonths(arr);
  var curMonth = new Date().toISOString().slice(0,7);
  if(months.indexOf(curMonth)===-1) months.unshift(curMonth);
  months.sort().reverse();
  if(_cmesFiltro && months.indexOf(_cmesFiltro)===-1) _cmesFiltro = '';
  sel.innerHTML = calMonthSelectOptions(months, _cmesFiltro);
  sel.value = _cmesFiltro;
}
async function onCalMesChange(){
  _cmesFiltro = document.getElementById('cal-mes-sel').value;
  await loadCalData(_ccampana, _cmesFiltro || undefined);
  switchCalTab(_ctab);
}
async function onCalCampanaChange(){
  _ccampana = document.getElementById('cal-campana-sel').value;
  await loadCalData(_ccampana, _cmesFiltro || undefined);
  populateCalMesSelect();
  renderCalItemsForm();
  populateCalAsesorSelect();
  switchCalTab(_ctab);
}

// Lista desplegable de asesores: solo usuarios con rol ASESOR, activos, y asignados a la campana actual.
function populateCalAsesorSelect(){
  var sel = document.getElementById('cf-asesor');
  var hint = document.getElementById('cf-asesor-hint');
  if(!sel) return;
  var asesores = users.filter(function(u){
    return u.rol==='ASESOR' && u.asesorCampana===_ccampana && u.active;
  }).sort(function(a,b){ return a.nombre.localeCompare(b.nombre); });
  if(asesores.length===0){
    sel.innerHTML = '<option value="">—</option>';
    sel.disabled = true;
    if(hint) hint.style.display = 'block';
  } else {
    sel.disabled = false;
    if(hint) hint.style.display = 'none';
    sel.innerHTML = '<option value="">Seleccione un asesor...</option>' +
      asesores.map(function(u){ return '<option value="'+esc(u.nombre)+'">'+esc(u.nombre)+'</option>'; }).join('');
  }
}

function switchCalTab(t){
  if((t==='nuevo' || t==='carga') && !calCanEvaluate()) t='resumen';
  _ctab = t;
  document.querySelectorAll('#calidad-modal .atab').forEach(function(el){ el.classList.toggle('atab-active', el.dataset.ctab===t); });
  document.querySelectorAll('#calidad-modal .atab-panel').forEach(function(el){ el.classList.toggle('visible', el.id==='cpanel-'+t); });
  populateCalMesSelect();
  renderCalKpis();
  if(t==='nuevo') renderCalPreview();
  else if(t==='carga'){ if(typeof cancelarPreviewMonitoreos==='function') cancelarPreviewMonitoreos(); }
  else if(t==='monitoreos') renderCalMonitoreosTable();
  else if(t==='resumen') renderCalResumenTable();
  else if(t==='reportes') setTimeout(renderCalReportes,60);
  else if(t==='config') renderCalConfig();
}

function renderCalItemsForm(){
  var items = calItems(_ccampana);
  var cats = [];
  items.forEach(function(it){ if(cats.indexOf(it.cat)===-1) cats.push(it.cat); });
  var html='';
  cats.forEach(function(cat){
    html += '<div class="qi-cat-header">'+esc(cat)+'</div>';
    items.filter(function(it){return it.cat===cat;}).forEach(function(it){
      html += '<div class="qi-row">'+
        '<div class="qi-label">'+(it.critico?'<span class="qi-crit">&#9888;</span>':'')+esc(it.n)+'. '+esc(it.label)+'<span class="qi-weight">('+esc(it.weight)+'%)</span></div>'+
        '<select class="qi-select" id="cf-item-'+esc(it.n)+'" onchange="renderCalPreview()">'+
          '<option value="">—</option><option value="SI">SI</option><option value="NO">NO</option><option value="N/A">N/A</option>'+
        '</select></div>';
    });
  });
  document.getElementById('cf-items-wrap').innerHTML = html;
  renderCalPreview();
}

function calReadAnswers(){
  var items = calItems(_ccampana);
  var answers = {};
  items.forEach(function(it){
    var el = document.getElementById('cf-item-'+it.n);
    answers[it.n] = el ? el.value : '';
  });
  return answers;
}

function renderCalPreview(){
  var items = calItems(_ccampana);
  var answers = calReadAnswers();
  var r = calComputeScore(items, answers, calEngine(_ccampana));
  var pv = document.getElementById('cf-preview');
  if(!pv) return;
  pv.innerHTML =
    '<div class="qi-pill"><div class="qv">'+(r.puntaje===null?'—':r.puntaje)+'</div><div class="ql">PUNTAJE OBTENIDO</div></div>'+
    '<div class="qi-pill"><div class="qv" style="font-size:0.95rem">'+r.clasificacion+'</div><div class="ql">CLASIFICACION</div></div>'+
    '<div class="qi-pill"><div class="qv">'+(r.fallos===null?'—':r.fallos)+'</div><div class="ql"># FALLOS CRITICOS</div></div>'+
    '<div class="qi-pill"><div class="qv" style="font-size:0.85rem">'+r.nivelCritico+'</div><div class="ql">NIVEL CRITICO</div></div>';
}

function setCanalAuditado(canal){
  document.getElementById('cf-canal').value = canal;
  document.getElementById('cf-canal-btn-LLAMADA').classList.toggle('active', canal==='LLAMADA');
  document.getElementById('cf-canal-btn-WPP').classList.toggle('active', canal==='WPP');
}

var _editingMonitoreoId = null;

function resetCalForm(){
  calItems(_ccampana).forEach(function(it){ var el=document.getElementById('cf-item-'+it.n); if(el) el.value=''; });
  populateCalAsesorSelect();
  document.getElementById('cf-idllamada').value='';
  document.getElementById('cf-telefono').value='';
  document.getElementById('cf-codificacion').value='';
  document.getElementById('cf-observaciones').value='';
  setCanalAuditado('LLAMADA');
  _editingMonitoreoId = null;
  var ft = document.getElementById('cf-form-title'); if(ft) ft.textContent = 'Datos generales del monitoreo';
  renderCalPreview();
}

function editarMonitoreo(id){
  if(!calCanManageMonitoreos()){ showToast('Solo el rol Reportes o el Administrador pueden editar un monitoreo ya guardado'); return; }
  var arr = (CAL_DB[_ccampana] && CAL_DB[_ccampana].monitoreos) || [];
  var m = arr.find(function(x){ return x.id===id; });
  if(!m){ showToast('Monitoreo no encontrado'); return; }
  _editingMonitoreoId = id;
  _ctab = 'nuevo';
  document.querySelectorAll('#calidad-modal .atab').forEach(function(el){ el.classList.toggle('atab-active', el.dataset.ctab==='nuevo'); });
  document.querySelectorAll('#calidad-modal .atab-panel').forEach(function(el){ el.classList.toggle('visible', el.id==='cpanel-nuevo'); });
  renderCalItemsForm();
  populateCalAsesorSelect();
  var ft = document.getElementById('cf-form-title'); if(ft) ft.textContent = 'Editando monitoreo existente (solo Reportes/Admin)';
  document.getElementById('cf-asesor').value = m.asesor;
  document.getElementById('cf-fecha').value = m.fecha || '';
  document.getElementById('cf-idllamada').value = m.idLlamada || '';
  document.getElementById('cf-telefono').value = m.telefono || '';
  document.getElementById('cf-codificacion').value = m.codificacion || '';
  document.getElementById('cf-evaluador').value = m.evaluador || '';
  document.getElementById('cf-observaciones').value = m.observaciones || '';
  setCanalAuditado(m.canal || 'LLAMADA');
  calItems(_ccampana).forEach(function(it){
    var el = document.getElementById('cf-item-'+it.n);
    if(el) el.value = (m.answers && m.answers[it.n]) || '';
  });
  renderCalPreview();
  showToast('Editando monitoreo de '+m.asesor+' ('+(m.fecha||'-')+') — modifique y presione Guardar');
}

async function submitMonitoreo(){
  var editing = !!_editingMonitoreoId;
  if(editing){
    if(!calCanManageMonitoreos()){ showToast('Solo el rol Reportes o el Administrador pueden editar un monitoreo ya guardado'); return; }
  } else if(!calCurrentPerm()){ showToast('No tiene permiso para evaluar esta campana'); return; }
  var asesor = document.getElementById('cf-asesor').value.trim();
  if(!asesor){ showToast('Seleccione el asesor a monitorear'); return; }
  var answers = calReadAnswers();
  var preview = calComputeScore(calItems(_ccampana), answers, calEngine(_ccampana));
  if(preview.puntaje===null){ showToast('Responda al menos un item'); return; }
  // El servidor solo acepta 'SI'/'NO'/'N/A'/''; enviamos las respuestas tal cual.
  var body = {
    campana: _ccampana,
    asesor: asesor,
    fecha: document.getElementById('cf-fecha').value,
    canal: document.getElementById('cf-canal').value || 'LLAMADA',
    idLlamada: document.getElementById('cf-idllamada').value.trim(),
    telefono: document.getElementById('cf-telefono').value.trim(),
    codificacion: document.getElementById('cf-codificacion').value.trim(),
    evaluador: document.getElementById('cf-evaluador').value.trim(),
    observaciones: document.getElementById('cf-observaciones').value.trim(),
    answers: answers
  };
  var btn = document.querySelector('#cpanel-nuevo .btn-primary');
  try{
    await withButtonLoading(btn, 'Guardando...', async function(){
      if(editing){
        await apiRequest('PUT','/monitoreos/'+_editingMonitoreoId, body);
      } else {
        await apiRequest('POST','/monitoreos', body);
      }
    });
  }catch(e){ showToast(e.message); return; }
  showToast(editing ? 'Monitoreo actualizado correctamente' : 'Monitoreo guardado correctamente');
  resetCalForm();
  await loadCalData(_ccampana, _cmesFiltro || undefined);
  switchCalTab('monitoreos');
}

async function calMonitoreosDelete(id){
  if(!calCanManageMonitoreos()){ showToast('Solo el rol Reportes o el Administrador pueden eliminar un monitoreo ya guardado'); return; }
  if(!confirm('Eliminar este monitoreo?')) return;
  try{
    await apiRequest('DELETE','/monitoreos/'+id);
  }catch(e){ showToast(e.message); return; }
  await loadCalData(_ccampana, _cmesFiltro || undefined);
  renderCalMonitoreosTable();
  renderCalKpis();
}

function renderCalMonitoreosTable(){
  var arr = calFilterByMonth((CAL_DB[_ccampana]||{}).monitoreos, _cmesFiltro).slice().sort(function(a,b){return b.id-a.id;});
  var canManage = calCanManageMonitoreos();
  var html = '<tr><th>Asesor</th><th>Fecha</th><th>Canal</th><th>ID/Llamada</th><th>Codificacion</th><th>Evaluador</th><th>Puntaje</th><th>Clasificacion</th><th>Fallos</th><th>Nivel Critico</th>'+(canManage?'<th></th>':'')+'</tr>';
  if(arr.length===0){
    html += '<tr><td colspan="11" style="text-align:center;color:#7a9ba8">Sin monitoreos registrados'+(_cmesFiltro?' en '+_cmesFiltro:'')+'</td></tr>';
  } else {
    arr.forEach(function(m){
      var canalLbl = m.canal==='WPP' ? '💬 WPP' : '📞 Llamada';
      html += '<tr><td>'+esc(m.asesor)+'</td><td>'+esc(m.fecha||'-')+'</td><td>'+canalLbl+'</td><td>'+esc(m.idLlamada||'-')+'</td><td>'+esc(m.codificacion||'-')+'</td><td>'+esc(m.evaluador||'-')+'</td>'+
        '<td class="peak">'+m.puntaje+'</td><td>'+m.clasificacion+'</td><td>'+m.fallos+'</td><td>'+m.nivelCritico+'</td>'+
        (canManage?('<td><button class="btn-sm btn-edit" onclick="editarMonitoreo('+m.id+')">Editar</button> <button class="btn-sm btn-delete" onclick="calMonitoreosDelete('+m.id+')">Eliminar</button></td>'):'')+'</tr>';
    });
  }
  document.getElementById('cal-monitoreos-table').innerHTML = html;
}

function renderCalResumenTable(){
  var arr = calFilterByMonth((CAL_DB[_ccampana]||{}).monitoreos, _cmesFiltro);
  var byAsesor = {};
  arr.forEach(function(m){
    if(!byAsesor[m.asesor]) byAsesor[m.asesor] = {count:0, sum:0, fallos:0};
    byAsesor[m.asesor].count++;
    byAsesor[m.asesor].sum += m.puntaje;
    byAsesor[m.asesor].fallos += (m.fallos||0);
  });
  var names = Object.keys(byAsesor);
  var html = '<tr><th>Asesor</th><th># Monitoreos</th><th>Prom. Puntaje</th><th>Clasificacion</th><th>Total Fallos Criticos</th><th>Alerta</th></tr>';
  if(names.length===0){
    html += '<tr><td colspan="6" style="text-align:center;color:#7a9ba8">Sin datos'+(_cmesFiltro?' en '+_cmesFiltro:'')+'</td></tr>';
  } else {
    names.forEach(function(n){
      var d = byAsesor[n];
      var prom = Math.round((d.sum/d.count)*10)/10;
      var clasif = prom<70 ? '🔴 CRITICO' : (prom<90 ? '🟡 NO CRITICO' : '🟢 SOBRESALIENTE');
      var alerta = d.fallos===0 ? '✅ SIN FALLOS CRITICOS' : (d.fallos<=1 ? '⚠️ ALERTA' : '🚨 CRITICO FRECUENTE');
      var promCls = (typeof _gdSemaforoClase === 'function' && typeof _gdSemaforoColor === 'function')
        ? _gdSemaforoClase(_gdSemaforoColor(prom, { metrica: 'qa_promedio', campana: _ccampana }))
        : '';
      html += '<tr><td>'+esc(n)+'</td><td>'+d.count+'</td><td class="peak'+(promCls?' '+promCls:'')+'">'+prom+'</td><td>'+clasif+'</td><td>'+d.fallos+'</td><td>'+alerta+'</td></tr>';
    });
  }
  document.getElementById('cal-resumen-table').innerHTML = html;
}

function renderCalKpis(){
  var allArr = (CAL_DB[_ccampana]||{}).monitoreos || [];
  var arr = calFilterByMonth(allArr, _cmesFiltro);
  var total = arr.length;
  var promedio = total ? Math.round((arr.reduce(function(a,m){return a+m.puntaje;},0)/total)*10)/10 : 0;
  var criticos = arr.filter(function(m){return m.fallos>=2;}).length;
  var mesMeta = _cmesFiltro || new Date().toISOString().slice(0,7);
  var totalLabel = _cmesFiltro ? 'Monitoreos ('+_cmesFiltro+')' : 'Monitoreos Totales (todos los meses)';

  var promCardColor = (typeof _gdSemaforoColor === 'function') ? _gdSemaforoColor(total ? promedio : null, { metrica: 'qa_promedio', campana: _ccampana }) : null;
  var promCardCls = (typeof _gdSemaforoClase === 'function' && promCardColor) ? _gdSemaforoClase(promCardColor)
    : (promedio>=90?'kpi-green':promedio>=70?'kpi-org':'kpi-red');
  var html =
    '<div class="aurora-kpi"><div class="kv">'+total+'</div><div class="kl">'+totalLabel+'</div></div>'+
    '<div class="aurora-kpi '+promCardCls+'"><div class="kv">'+(total?promedio:'—')+'</div><div class="kl">Promedio Puntaje</div></div>'+
    '<div class="aurora-kpi kpi-red"><div class="kv">'+criticos+'</div><div class="kl">Monitoreos Criticos Absolutos</div></div>';

  if(currentUser && (currentUser.rol==='CALIDAD' || currentUser.rol==='SUPERVISOR')){
    var lideresList = calLideresCumplimiento(_ccampana, mesMeta);
    var mia = lideresList.find(function(l){ return String(l.liderId)===String(currentUser.id); });
    if(!mia){
      html += '<div class="aurora-kpi kpi-org"><div class="kv" style="font-size:0.85rem">Sin meta asignada</div><div class="kl">Mi Meta Individual ('+mesMeta+')</div></div>';
    } else {
      html += '<div class="aurora-kpi kpi-pur"><div class="kv">'+mia.realizados+' / '+mia.meta+'</div><div class="kl">Mi Meta Individual ('+mesMeta+')</div></div>'+
        '<div class="aurora-kpi '+(mia.pct>=100?'kpi-green':'kpi-org')+'"><div class="kv">'+mia.pct+'%</div><div class="kl">Mi Cumplimiento Total ('+mesMeta+')</div></div>'+
        '<div class="aurora-kpi"><div class="kv">'+mia.realizadosLlamada+' / '+mia.metaLlamada+'</div><div class="kl">Mi Cumplimiento Llamada'+(mia.pctLlamadaCompl!==null?' ('+mia.pctLlamadaCompl+'%)':'')+'</div></div>'+
        (mia.auditaWpp ? '<div class="aurora-kpi"><div class="kv">'+mia.realizadosWpp+' / '+mia.metaWpp+'</div><div class="kl">Mi Cumplimiento WhatsApp'+(mia.pctWppCompl!==null?' ('+mia.pctWppCompl+'%)':'')+'</div></div>' : '');
    }
  } else {
    var lideres = calLideresCumplimiento(_ccampana, mesMeta);
    var promedioCumpl = lideres.length ? Math.round(lideres.reduce(function(a,l){return a+l.pct;},0)/lideres.length) : 0;
    html += '<div class="aurora-kpi kpi-pur"><div class="kv">'+lideres.length+'</div><div class="kl">Personas con Meta ('+mesMeta+')</div></div>'+
      '<div class="aurora-kpi '+(promedioCumpl>=100?'kpi-green':'kpi-org')+'"><div class="kv">'+promedioCumpl+'%</div><div class="kl">Cumplimiento Promedio ('+mesMeta+')</div></div>';
  }
  document.getElementById('cal-kpis-strip').innerHTML = html;
}

function renderCalConfig(){
  var curMonth = new Date().toISOString().slice(0,7);
  var row = currentUser ? calGetCronogramaForLider(_ccampana, curMonth, currentUser.id) : null;
  var pv = document.getElementById('cf-cronograma-preview');
  if(pv){
    if(row){
      pv.innerHTML =
        '<div class="qi-pill"><div class="qv" style="font-size:1rem">'+esc(row.liderNombre||'—')+'</div><div class="ql">LIDER RESPONSABLE</div></div>'+
        '<div class="qi-pill"><div class="qv">'+row.asesores+'</div><div class="ql">CANTIDAD ASESORES</div></div>'+
        '<div class="qi-pill"><div class="qv">'+row.metaGrupal+'</div><div class="ql">MI META DEL MES</div></div>'+
        '<div class="qi-pill"><div class="qv">'+row.metaPorAsesor+'</div><div class="ql">META MES / ASESOR</div></div>'+
        '<div class="qi-pill"><div class="qv">'+row.metaDiaria+'</div><div class="ql">META DIARIA</div></div>'+
        '<div class="qi-pill"><div class="qv">'+(row.whatsapp? row.pctWhatsapp+'%' : 'NO')+'</div><div class="ql">WHATSAPP/CHAT A AUDITAR</div></div>';
    } else if(isFullAdmin()){
      pv.innerHTML = '<div class="qi-pill"><div class="qv" style="font-size:0.85rem">Vista de administrador — sin meta individual propia</div><div class="ql">Consulte Admin &gt; Cronograma y Metas para ver todas las metas</div></div>';
    } else {
      pv.innerHTML = '<div class="qi-pill"><div class="qv" style="font-size:0.9rem">Sin meta asignada</div><div class="ql">Este mes aun no tiene una meta individual programada en Admin</div></div>';
    }
  }
  var rows = users.filter(function(u){ return u.rol==='CALIDAD' || u.rol==='SUPERVISOR'; });
  var html = '<tr><th>Usuario</th><th>Rol</th><th>Acceso a '+_ccampana+'</th><th>Estado</th></tr>';
  if(rows.length===0){
    html += '<tr><td colspan="4" style="text-align:center;color:#7a9ba8">No hay usuarios con rol CALIDAD o SUPERVISOR</td></tr>';
  } else {
    rows.forEach(function(u){
      var acceso = u.perms['campana_'+_ccampana]===true;
      html += '<tr><td>'+esc(u.nombre)+' (@'+esc(u.user)+')</td><td>'+esc(u.rol)+'</td><td>'+(acceso?'✅ Si':'❌ No')+'</td><td>'+(u.active?'Activo':'Suspendido')+'</td></tr>';
    });
  }
  document.getElementById('cal-permisos-table').innerHTML = html;
}

var _cc = {};
function ccmk(id,cfg){
  var el=document.getElementById(id); if(!el) return;
  if(_cc[id]) try{_cc[id].destroy();}catch(e){}
  _cc[id]=new Chart(el,cfg);
}

async function descargarReporteGeneral(){
  if(typeof XLSX==='undefined'){ showToast('No se pudo cargar el generador de Excel. Verifique su conexion a internet e intente de nuevo.'); return; }
  var mes = _cmesFiltro || new Date().toISOString().slice(0,7);
  var campanas = calAccessibleCampanas();
  var wb = XLSX.utils.book_new();
  var usedNames = {};
  for(var i=0;i<campanas.length;i++){
    var camp = campanas[i];
    await loadCalData(camp, mes);
    var lideres = calLideresCumplimiento(camp, mes);
    var aoa = [
      ['Reporte de Cumplimiento — '+camp],
      ['Mes: '+mes],
      [],
      ['Persona de Calidad / Supervisor','Meta Total','Realizados','% Cumplimiento Total','Meta Llamada','Real Llamada','% Llamada','Meta WhatsApp','Real WhatsApp','% WhatsApp']
    ];
    if(lideres.length===0){
      aoa.push(['Sin metas individuales programadas para '+mes]);
    } else {
      lideres.forEach(function(l){
        aoa.push([
          l.liderNombre, l.meta, l.realizados, l.pct+'%',
          l.metaLlamada, l.realizadosLlamada, (l.pctLlamadaCompl!==null?l.pctLlamadaCompl+'%':'-'),
          (l.auditaWpp?l.metaWpp:'-'), (l.auditaWpp?l.realizadosWpp:'-'), (l.pctWppCompl!==null?l.pctWppCompl+'%':'-')
        ]);
      });
    }
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{wch:28},{wch:10},{wch:11},{wch:16},{wch:12},{wch:12},{wch:9},{wch:13},{wch:13},{wch:10}];
    var sheetName = camp.replace(/[\\\/\?\*\[\]:]/g,'').slice(0,31) || 'Campana';
    if(usedNames[sheetName]){ sheetName = sheetName.slice(0,28)+'_'+Object.keys(usedNames).length; }
    usedNames[sheetName] = true;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }
  XLSX.writeFile(wb, 'Reporte_Cumplimiento_'+mes+'.xlsx');
  showToast('Reporte de '+mes+' descargado — una hoja por campana con acceso');
}

function closeSupervisionLider(){
  document.getElementById('supervisar-lider-overlay').classList.remove('show');
}
document.getElementById('supervisar-lider-overlay').addEventListener('click',function(e){ if(e.target===this) closeSupervisionLider(); });

// El boton "Supervisar" de la tabla de cumplimiento lleva los datos en data-*
// (no en un onclick con texto libre — evita inyeccion de JS via liderNombre).
document.getElementById('cal-cumplimiento-table').addEventListener('click', function(e){
  var btn = e.target.closest('button[data-lider]');
  if(!btn) return;
  verSupervisionLider(btn.dataset.campana, btn.dataset.mes, btn.dataset.lider);
});

function verSupervisionLider(camp, mes, liderNombre){
  var lideres = calLideresCumplimiento(camp, mes);
  var l = lideres.find(function(x){ return x.liderNombre===liderNombre; });
  if(!l){ showToast('No se encontraron datos para esta persona'); return; }
  document.getElementById('sl-sub-label').textContent = camp+' — '+mes;
  document.getElementById('sl-kpis').innerHTML =
    '<div class="aurora-kpi" style="grid-column:span 1"><div class="kv" style="font-size:1rem">'+esc(l.liderNombre)+'</div><div class="kl">Persona de Calidad / Supervisor</div></div>'+
    '<div class="aurora-kpi"><div class="kv">'+l.realizados+' / '+l.meta+'</div><div class="kl">Total Realizado / Meta</div></div>'+
    '<div class="aurora-kpi '+(l.pct>=100?'kpi-green':'kpi-org')+'"><div class="kv">'+l.pct+'%</div><div class="kl">% Cumplimiento Total</div></div>'+
    '<div class="aurora-kpi"><div class="kv">'+l.realizadosLlamada+' / '+l.metaLlamada+'</div><div class="kl">Llamada'+(l.pctLlamadaCompl!==null?' ('+l.pctLlamadaCompl+'%)':'')+'</div></div>'+
    (l.auditaWpp ? '<div class="aurora-kpi"><div class="kv">'+l.realizadosWpp+' / '+l.metaWpp+'</div><div class="kl">WhatsApp/Chat'+(l.pctWppCompl!==null?' ('+l.pctWppCompl+'%)':'')+'</div></div>' : '');

  var arr = (CAL_DB[camp] && CAL_DB[camp].monitoreos) || [];
  var misMon = arr.filter(function(m){
    return calMonthKey(m.fecha)===mes && String(m.evaluadorUserId)===String(l.liderId);
  }).sort(function(a,b){ return (b.fecha||'').localeCompare(a.fecha||''); });
  var html = '<tr><th>Fecha</th><th>Asesor</th><th>Canal</th><th>Puntaje</th><th>Clasificacion</th><th>Nivel Critico</th></tr>';
  if(misMon.length===0){
    html += '<tr><td colspan="6" style="text-align:center;color:#7a9ba8">Sin monitoreos registrados este mes</td></tr>';
  } else {
    misMon.forEach(function(m){
      var canalLbl = m.canal==='WPP' ? '💬 WPP' : '📞 Llamada';
      html += '<tr><td>'+esc(m.fecha||'-')+'</td><td>'+esc(m.asesor)+'</td><td>'+canalLbl+'</td><td class="peak">'+m.puntaje+'</td><td>'+m.clasificacion+'</td><td>'+m.nivelCritico+'</td></tr>';
    });
  }
  document.getElementById('sl-monitoreos-table').innerHTML = html;
  document.getElementById('supervisar-lider-overlay').classList.add('show');
}

function renderCalReportes(){
  var allArr = (CAL_DB[_ccampana]||{}).monitoreos || [];
  var arr = calFilterByMonth(allArr, _cmesFiltro);
  var curMonth = _cmesFiltro || new Date().toISOString().slice(0,7);
  var sobresaliente = arr.filter(function(m){return m.puntaje>=90;}).length;
  var noCritico = arr.filter(function(m){return m.puntaje>=70 && m.puntaje<90;}).length;
  var critico = arr.filter(function(m){return m.puntaje<70;}).length;

  document.getElementById('cal-reportes-kpis').innerHTML =
    '<div class="aurora-kpi kpi-green"><div class="kv">'+sobresaliente+'</div><div class="kl">🟢 Sobresaliente</div></div>'+
    '<div class="aurora-kpi kpi-org"><div class="kv">'+noCritico+'</div><div class="kl">🟡 No Critico</div></div>'+
    '<div class="aurora-kpi kpi-red"><div class="kv">'+critico+'</div><div class="kl">🔴 Critico</div></div>'+
    '<div class="aurora-kpi"><div class="kv">'+arr.length+'</div><div class="kl">Total Evaluados'+(_cmesFiltro?' ('+_cmesFiltro+')':'')+'</div></div>';

  ccmk('cch-clasificacion',{type:'doughnut',data:{labels:['Sobresaliente','No Critico','Critico'],datasets:[{data:[sobresaliente,noCritico,critico],backgroundColor:[CG,CO,CR]}]},options:loPie()});

  var lideres = calLideresCumplimiento(_ccampana, curMonth);
  var nombres = lideres.map(function(l){return l.liderNombre;});
  var pcts = lideres.map(function(l){return l.pct;});
  ccmk('cch-cumplimiento',{type:'bar',data:{labels:nombres.length?nombres:['Sin metas programadas'],datasets:[
    {label:'% Cumplimiento Individual',data:pcts.length?pcts:[0],backgroundColor:CM,borderRadius:4}
  ]},options:loPct2(30)});

  var html = '<tr><th>Persona de Calidad / Supervisor</th><th>Meta Total</th><th>Realizados</th><th>% Total</th><th>Meta Llamada</th><th>Real Llamada</th><th>Meta WPP</th><th>Real WPP</th><th></th></tr>';
  if(lideres.length===0){
    html += '<tr><td colspan="9" style="text-align:center;color:#7a9ba8">'+curMonth+' no tiene metas individuales programadas en Admin</td></tr>';
  } else {
    lideres.forEach(function(l){
      html += '<tr><td>'+esc(l.liderNombre)+'</td><td>'+l.meta+'</td><td>'+l.realizados+'</td><td class="'+(l.pct>=100?'peak':'')+'">'+l.pct+'%</td>'+
        '<td>'+l.metaLlamada+'</td><td>'+l.realizadosLlamada+(l.pctLlamadaCompl!==null?' ('+l.pctLlamadaCompl+'%)':'')+'</td>'+
        '<td>'+(l.auditaWpp?l.metaWpp:'-')+'</td><td>'+(l.auditaWpp?(l.realizadosWpp+(l.pctWppCompl!==null?' ('+l.pctWppCompl+'%)':'')):'-')+'</td>'+
        '<td><button class="btn-sm btn-edit" data-campana="'+esc(_ccampana)+'" data-mes="'+esc(curMonth)+'" data-lider="'+esc(l.liderNombre)+'">Supervisar</button></td></tr>';
    });
  }
  document.getElementById('cal-cumplimiento-table').innerHTML = html;
}
