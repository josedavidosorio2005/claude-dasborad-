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
    // Fase 237: todas las plantillas (varias por campaña, con `usable`).
    // Fase 254: con las versiones inactivas (para ver/editar monitoreos viejos; nunca son usables).
    try{ CAL_PLANTILLAS_TODAS = (await apiRequest('GET','/calidad/plantillas/todas?inactivas=1')) || []; }catch(e2){ CAL_PLANTILLAS_TODAS = []; }
    _calPlantillasLoaded = true;
  }catch(e){
    if(!_calPlantillasLoaded) showToast('No se pudieron cargar las plantillas de Calidad: '+e.message);
  }
}

// Campanas que ya tienen dashboard propio (12 campanas M3 + ORLANT/CLINICA
// AURORA/HOSPITAL LA MARIA): para esas, la carga masiva de Calidad se hizo
// desde la plantilla consolidada de la pantalla "Cargar Datos" (Fase "una
// sola plantilla por campana", 2026-09-16) — esta pestana se oculta para no
// dejar dos caminos de carga conviviendo. Campanas SIN dashboard (ej. CARTERA
// INTERNA, CONSULTORIO JULIAN MOLANO) no tienen a donde mas ir: conservan
// esta pestana intacta, tal cual funcionaba antes.
var _calClientesConDashboard = null;
async function _calCargarClientesConDashboard(){
  if(_calClientesConDashboard) return;
  try{
    var r = await apiRequest('GET','/dashboard/clientes');
    _calClientesConDashboard = (r && r.clientes) || [];
  }catch(e){ _calClientesConDashboard = []; }
}
function _calCampanaTieneDashboard(camp){
  return !!(_calClientesConDashboard && _calClientesConDashboard.indexOf(camp)!==-1);
}
function _calActualizarTabCarga(){
  var cargaBtn = document.getElementById('ctab-btn-carga');
  if(!cargaBtn) return;
  var mostrar = calCanEvaluate() && !_calCampanaTieneDashboard(_ccampana);
  cargaBtn.style.display = mostrar ? '' : 'none';
  if(!mostrar && _ctab==='carga') switchCalTab(calCanEvaluate() ? 'monitoreos' : 'resumen');
}

function calCampanas(){
  var k = Object.keys(CAL_PLANTILLAS);
  return k.length ? k : CAMPANAS_CON_PLANTILLA.slice();
}
// Fase 237: una campaña puede tener varias plantillas. calItems/calEngine
// usan la elegida en el formulario (_calPlantillaElegida[camp]); sin elegir,
// la principal (CAL_PLANTILLAS, una por campaña, la de siempre).
var CAL_PLANTILLAS_TODAS = [];
var _calPlantillaElegida = {};
function _calPlantillaDe(camp){
  var id = _calPlantillaElegida[camp];
  if(!id) return null;
  return CAL_PLANTILLAS_TODAS.find(function(p){ return p.id === id && p.campana === camp; }) || null;
}
function calItemsPrincipal(camp){ return (CAL_PLANTILLAS[camp] && CAL_PLANTILLAS[camp].items) || []; }
function calEnginePrincipal(camp){ return (CAL_PLANTILLAS[camp] && CAL_PLANTILLAS[camp].engine) || 'standard'; }
function calItems(camp){ var p = _calPlantillaDe(camp); return p ? (p.items || []) : calItemsPrincipal(camp); }
function calEngine(camp){ var p = _calPlantillaDe(camp); return p ? (p.engine || 'standard') : calEnginePrincipal(camp); }
// Plantillas de la campaña con las que este usuario puede monitorear.
function calPlantillasUsables(camp){ return CAL_PLANTILLAS_TODAS.filter(function(p){ return p.campana === camp && p.usable; }); }
function calElegirPlantilla(v){
  _calPlantillaElegida[_ccampana] = v ? Number(v) : null;
  renderCalItemsForm();
}
// Selector "Plantilla" del formulario: solo si hay mas de una para elegir.
function calPlantillaSelectorHtml(camp, editando){
  var lista = calPlantillasUsables(camp);
  var elegida = _calPlantillaDe(camp);
  if(editando){
    return elegida ? '<p class="cal-plantilla-nota">Plantilla: <strong>'+esc(elegida.nombre)+'</strong></p>' : '';
  }
  if(lista.length < 2) return '';
  var actual = elegida ? elegida.id : (lista.find(function(p){ return p.principal; }) || lista[0]).id;
  return '<div class="ig cal-plantilla-sel"><label for="cf-plantilla">Plantilla</label><select id="cf-plantilla" onchange="calElegirPlantilla(this.value)">' +
    lista.map(function(p){ return '<option value="'+p.id+'"'+(p.id===actual?' selected':'')+'>'+esc(p.nombre)+'</option>'; }).join('') +
    '</select></div>';
}

// ── Cache de datos por campana ────────────────────────────────
// { camp: { monitoreos:[], cronogramaRows:[], cronogramaByMes:{}, cumplimiento:{mes:[]} } }
var CAL_DB = {};

function calCampCache(camp){
  if(!CAL_DB[camp]) CAL_DB[camp] = { monitoreos:[], cronogramaRows:[], cronogramaByMes:{}, cumplimiento:{}, codificaciones:[] };
  return CAL_DB[camp];
}

// Fase 95 (tema B): catalogo de codificaciones de la campana (activas E
// inactivas -- la pantalla de admin necesita ambas). El formulario de
// monitoreo solo usa las activas.
function calCodificaciones(camp){ return (CAL_DB[camp] && CAL_DB[camp].codificaciones) || []; }
function calCodificacionesActivas(camp){
  return calCodificaciones(camp).filter(function(c){ return c.activo; }).map(function(c){ return c.valor; });
}

// Carga desde el servidor los datos de una campana (monitoreos, cronograma y el
// cumplimiento del mes indicado). Se llama al abrir el modulo y al cambiar
// campana o mes. `mes` por defecto: el mes actual.
// Fase 334: en el Modulo de Calidad, CALIDAD y SUPERVISOR ven solo lo que calificaron (el
// administrador y los demas roles, todo como siempre). El servidor es el que filtra.
function calVeSoloPropios(){
  return !isFullAdmin() && !!currentUser && (currentUser.rol==='CALIDAD' || currentUser.rol==='SUPERVISOR');
}
// Lista de monitoreos del MODULO (la propia para CALIDAD/SUPERVISOR; el consolidado para los demas).
function calMonModulo(camp){
  var d = CAL_DB[camp] || {};
  return (d.monitoreosModulo !== null && d.monitoreosModulo !== undefined) ? d.monitoreosModulo : (d.monitoreos || []);
}

async function loadCalData(camp, mes){
  await calLoadPlantillas();
  // Umbrales de semaforo (color por dato, configurables desde el panel de
  // administracion): se cargan aqui tambien porque el modulo de Calidad se
  // puede abrir sin pasar por dashboard-generic.js/_gdBootstrap.
  if(typeof _gdCargarUmbrales === 'function'){ try{ await _gdCargarUmbrales(); }catch(e){} }
  if(!camp) return;
  mes = mes || gdHoyLocal().slice(0,7);
  var d = calCampCache(camp);
  var q = 'campana='+encodeURIComponent(camp);
  try{
    d.monitoreos = (await apiRequest('GET','/monitoreos?'+q)) || [];
  }catch(e){ d.monitoreos = d.monitoreos || []; }
  // Fase 334: el Modulo de Calidad tiene su PROPIA lista (CALIDAD y SUPERVISOR: solo lo que
  // ellos calificaron, filtrado en el servidor). `d.monitoreos` sigue siendo el consolidado
  // que usa la pestaña Calidad del dashboard (no cambia).
  if(calVeSoloPropios()){
    try{ d.monitoreosModulo = (await apiRequest('GET','/monitoreos?'+q+'&vista=propios')) || []; }
    catch(e){ d.monitoreosModulo = d.monitoreosModulo || []; }
  } else d.monitoreosModulo = null;
  try{ d.totalCampana = await apiRequest('GET','/monitoreos/total?'+q); }catch(e){ d.totalCampana = null; }
  try{
    var metas = (await apiRequest('GET','/metas?'+q)) || [];
    d.cronogramaRows = metas;
    d.cronogramaByMes = {};
    metas.forEach(function(r){ (d.cronogramaByMes[r.mes] = d.cronogramaByMes[r.mes] || []).push(r); });
  }catch(e){ d.cronogramaRows = d.cronogramaRows || []; }
  try{
    var cu = await apiRequest('GET','/metas/cumplimiento?'+q+'&mes='+mes+(calVeSoloPropios()?'&vista=propios':'')); // Fase 334
    d.cumplimiento[mes] = (cu && cu.lideres) || [];
  }catch(e){ d.cumplimiento[mes] = d.cumplimiento[mes] || []; }
  try{
    d.codificaciones = (await apiRequest('GET','/calidad/codificaciones?'+q)) || [];
  }catch(e){ d.codificaciones = d.codificaciones || []; }
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
    var etiqueta = (typeof mesNombreLargo === 'function') ? mesNombreLargo(mo) : mo;
    return '<option value="'+mo+'"'+(mo===selected?' selected':'')+'>'+etiqueta+'</option>';
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
  // Fase 322: motor descuento (copia exacta de computeScoreDescuento del servidor).
  if(engine==='descuento'){
    var f = 0, ded = 0;
    items.forEach(function(it){
      var a = answers[it.n];
      if(it.critico){ if(a==='NO') f++; return; }
      if(!a) return;
      if(it.opciones && it.opciones.length){ var o = it.opciones.filter(function(x){ return x.v===a; })[0]; ded += o ? (Number(o.descuento)||0) : 0; }
      else if(a==='NO') ded += Number(it.descuento)||0;
    });
    var pd = f ? 0 : Math.max(0, Math.min(100, Math.round((100-ded)*100)/100));
    var clasificacion = pd<70 ? '🔴 CRITICO' : (pd<90 ? '🟡 NO CRITICO' : '🟢 SOBRESALIENTE');
    var nivelCritico = f ? '⛔ CRITICO EN NO (NOTA 0 %)' : '✅ SIN FALLOS CRITICOS';
    return {puntaje:pd, clasificacion:clasificacion, fallos:f, nivelCritico:nivelCritico};
  }
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
  if (typeof motionAbrirModal === 'function') motionAbrirModal('calidad-modal');
  await calLoadPlantillas();
  await _calCargarClientesConDashboard();
  populateCalCampanaSelect();
  if(_ccampana) await loadCalData(_ccampana, _cmesFiltro || undefined);
  populateCalMesSelect();
  var cfg = document.getElementById('ctab-btn-config');
  if(cfg) cfg.style.display = isFullAdmin() ? '' : 'none';
  var plt = document.getElementById('ctab-btn-plantillas'); // Fase 253: solo el administrador
  if(plt) plt.style.display = isFullAdmin() ? '' : 'none';
  var canEval = calCanEvaluate();
  var nuevoBtn = document.getElementById('ctab-btn-nuevo');
  if(nuevoBtn) nuevoBtn.style.display = canEval ? '' : 'none';
  _calActualizarTabCarga();
  calSetFechaEvaluadorAuto();
  renderCalItemsForm();
  populateCalAsesorSelect();
  renderCalCodifCampoForm('');
  var defaultTab = canEval ? 'nuevo' : (currentUser && currentUser.rol==='REPORTES' ? 'reportes' : 'resumen');
  switchCalTab(defaultTab);
  if(typeof cenActualizarTab==='function') cenActualizarTab(); // Fase 331: pestaña y contador
}
function closeCalidad(){
  if(typeof cenAlSalirDelModulo==='function') cenAlSalirDelModulo(); // Fase 331: libera la llamada abierta
  var cerrarReal = function(){ document.getElementById('calidad-overlay').classList.remove('show'); };
  if (typeof motionCerrarModal === 'function') motionCerrarModal('calidad-modal', cerrarReal);
  else cerrarReal();
}
document.getElementById('calidad-overlay').addEventListener('click',function(e){ if(e.target===this) closeCalidad(); });

function populateCalMesSelect(){
  var sel = document.getElementById('cal-mes-sel');
  var arr = calMonModulo(_ccampana);
  var months = calAvailableMonths(arr);
  var curMonth = gdHoyLocal().slice(0,7);
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
  if(typeof cenAlSalirDelModulo==='function') cenAlSalirDelModulo(); // Fase 331
  _ccampana = document.getElementById('cal-campana-sel').value;
  await loadCalData(_ccampana, _cmesFiltro || undefined);
  populateCalMesSelect();
  renderCalItemsForm();
  populateCalAsesorSelect();
  renderCalCodifCampoForm('');
  _calActualizarTabCarga();
  switchCalTab(_ctab);
  if(typeof cenActualizarTab==='function') cenActualizarTab(); // Fase 331
}

// Fase 340: el formulario viejo de Calificar se retiro (un solo formulario: calidad-calificar.js).
// Estas dos quedan como llamadas sin efecto para quien todavia las invoca: el formulario comun arma
// su propia lista de asesores y su campo de codificacion (con el catalogo de la campaña).
function renderCalCodifCampoForm(){ /* Fase 340: lo hace el formulario comun al dibujarse */ }
function populateCalAsesorSelect(){ /* Fase 340: idem */ }

function switchCalTab(t){
  if((t==='nuevo' || t==='carga') && !calCanEvaluate()) t='resumen';
  if(t==='carga' && _calCampanaTieneDashboard(_ccampana)) t='monitoreos';
  if(t==='plantillas' && !isFullAdmin()) t='resumen'; // Fase 253
  if(t==='encuestas' && !(typeof _cen!=='undefined' && _cen.activa && _cen.activaDe===_ccampana)) t = calCanEvaluate() ? 'nuevo' : 'resumen'; // Fase 331
  _ctab = t;
  document.querySelectorAll('#calidad-modal .atab').forEach(function(el){ el.classList.toggle('atab-active', el.dataset.ctab===t); });
  document.querySelectorAll('#calidad-modal .atab-panel').forEach(function(el){ el.classList.toggle('visible', el.id==='cpanel-'+t); });
  populateCalMesSelect();
  renderCalKpis();
  if(t==='nuevo') renderCalPreview();
  else if(t==='carga'){ if(typeof cancelarPreviewMonitoreos==='function') cancelarPreviewMonitoreos(); }
  else if(t==='monitoreos') renderCalMonitoreosTable();
  else if(t==='resumen') renderCalResumenTable();
  else if(t==='detalle' && typeof caRenderDetalle==='function') caRenderDetalle(); // Fase 255
  else if(t==='diccionario' && typeof caRenderDiccionario==='function') caRenderDiccionario(); // Fase 255
  else if(t==='reportes') setTimeout(renderCalReportes,60);
  else if(t==='config') renderCalConfig();
  else if(t==='plantillas' && typeof calPlantillasRender==='function') calPlantillasRender(); // Fase 253
  else if(t==='encuestas' && typeof cenRender==='function') cenRender(); // Fase 331
  if(typeof _cenPintarBanner==='function') _cenPintarBanner(); // Fase 331: datos de la llamada abierta
}

// Fase 340: un solo formulario. Siempre el comun (calidad-calificar.js: cc2Sync); sin plantilla
// habilitada para este usuario, un aviso (nunca el formulario viejo con la plantilla principal).
function renderCalItemsForm(){ if(typeof cc2Sync==='function') cc2Sync(); }
function renderCalPreview(){ /* Fase 340: la calificacion definitiva se calcula en vivo en el formulario comun */ }

var _editingMonitoreoId = null; // Fase 340: ya no se usa (la edicion va por el formulario comun)

// Fase 95 (tema A): "hoy" tal como lo ve el navegador (valor por defecto de la fecha del monitoreo;
// el servidor revisa que no sea futura con la hora de Colombia).
function calFechaHoyLocal(){
  var d = new Date();
  var pad = function(n){ return n<10 ? '0'+n : n; };
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
}
function calSetFechaEvaluadorAuto(){ /* Fase 340: el formulario comun pone hoy y el evaluador al dibujarse */ }

// Editar un monitoreo guardado: siempre en el formulario comun (quien puede, lo decide el servidor).
function editarMonitoreo(id){
  var m = calMonModulo(_ccampana).find(function(x){ return x.id===id; });
  if(!m){ showToast('Monitoreo no encontrado'); return; }
  if(!(typeof cc2PuedeEditar==='function' && cc2PuedeEditar(m))){ showToast('Solo quien lo calificó, el rol Reportes o el Administrador pueden editar un monitoreo guardado'); return; }
  if(!cc2Editar(m)) showToast('No se encontró la plantilla de este monitoreo');
}

async function calMonitoreosDelete(id){
  if(!calCanManageMonitoreos()){ showToast('Solo el rol Reportes o el Administrador pueden eliminar un monitoreo ya guardado'); return; }
  if(!confirm('Eliminar este monitoreo?')) return;
  try{
    await apiRequest('DELETE','/monitoreos/'+id);
  }catch(e){ showToast(e.message, 'error'); return; }
  await loadCalData(_ccampana, _cmesFiltro || undefined);
  renderCalMonitoreosTable();
  renderCalKpis();
}

function renderCalMonitoreosTable(){
  var arr = calFilterByMonth(calMonModulo(_ccampana), _cmesFiltro).slice().sort(function(a,b){return b.id-a.id;});
  // Fase 331 (PR 3): filtro por origen y marca de los de Calidad de encuestas (solo esta lista).
  var conOrigen = typeof cenPrepararFiltroOrigen==='function' ? cenPrepararFiltroOrigen(arr) : null;
  if(conOrigen) arr = conOrigen.lista;
  var canManage = calCanManageMonitoreos();
  // Fase 254: Calidad edita lo que ella califico con plantillas nuevas.
  var puedeAlguno = !canManage && typeof cc2PuedeEditar==='function' && arr.some(function(m){ return cc2PuedeEditar(m); });
  // Fase 337: «Cambiar fecha» (solo la fecha) para quien lo califico, Reportes y el administrador.
  var fechaAlguno = arr.some(function(m){ return calPuedeCambiarFecha(m); });
  var conAcciones = canManage || puedeAlguno || fechaAlguno;
  // Fase 344: el telefono solo si el servidor lo manda (quien califica); «—» si no se guardo.
  var verTel = arr.some(function(m){ return Object.prototype.hasOwnProperty.call(m,'telefono'); });
  // Fase 348 (C2): buscador por ID, asesor, fecha y (solo quien califica) telefono.
  var conTelBusca = clBuscaTelefono(arr);
  clPonerBuscador(document.getElementById('cal-monitoreos-buscar'), 'mon', conTelBusca);
  var totalSinBuscar = arr.length;
  arr = clBuscar('mon', arr, clCamposMonitoreo, conTelBusca);
  var html = '<tr><th>Asesor</th><th>Fecha</th><th>Canal</th><th>ID/Llamada</th>'+(verTel?'<th>Teléfono</th>':'')+'<th>Codificacion</th><th>Evaluador</th><th>Puntaje</th><th>Clasificacion</th><th>Fallos</th><th>Nivel Critico</th>'+(conAcciones?'<th class="cl-acc"><span class="sr-only">Acciones</span></th>':'')+'</tr>'; // Fase 348 (C3): columna fija a la derecha
  // Fase 348 (C1): 10 filas por pagina (o 20); los KPIs siguen contando todas.
  var corte = clCortar('mon', arr);
  if(arr.length===0){
    html += '<tr><td colspan="'+((verTel?12:11)+(conAcciones?1:0))+'" style="text-align:center;color:var(--c-text-muted)">'+(totalSinBuscar&&clSinResultadosTexto('mon')?esc(clSinResultadosTexto('mon')):'Sin monitoreos registrados'+(_cmesFiltro?' en '+_cmesFiltro:'')+(conOrigen&&conOrigen.origen?' con ese origen':''))+'</td></tr>';
  } else {
    corte.filas.forEach(function(m){
      var canalLbl = calEstadoHtml(m.canal==='WPP' ? '💬 WPP' : '📞 Llamada');
      html += '<tr><td>'+esc(textoFormatoNombre(m.asesor))+(m.origen==='encuesta'?' <span class="cen-marca" title="Monitoreo originado en una encuesta mal calificada">Encuesta</span>':'')+'</td><td>'+(typeof ceFechaConLlamadaHtml==='function'?ceFechaConLlamadaHtml(m,esc):esc(m.fecha||'-'))+'</td><td>'+canalLbl+'</td><td>'+esc(m.idLlamada||'-')+'</td>'+(verTel?'<td>'+esc(m.telefono||'—')+'</td>':'')+'<td>'+esc(m.codificacion||'-')+'</td><td>'+esc(m.evaluador||'-')+'</td>'+
        '<td class="peak">'+m.puntaje+'</td><td>'+calEstadoHtml(m.clasificacion)+'</td><td>'+m.fallos+'</td><td>'+calEstadoHtml(m.nivelCritico)+'</td>'+
        (conAcciones?('<td class="cal-acciones cl-acc"><div class="cl-acc-btns">'+
          ((canManage || (puedeAlguno && cc2PuedeEditar(m)))?'<button class="btn-sm btn-edit" onclick="editarMonitoreo('+m.id+')">Editar</button> ':'')+
          (calPuedeCambiarFecha(m)?'<button class="btn-sm" onclick="calCambiarFecha('+m.id+')">Cambiar fecha</button> ':'')+
          (canManage?'<button class="btn-sm btn-delete" onclick="calMonitoreosDelete('+m.id+')">Eliminar</button>':'')+'</div></td>'):'')+'</tr>';
    });
  }
  document.getElementById('cal-monitoreos-table').innerHTML = html;
  var pie = document.getElementById('cal-monitoreos-pie');
  if(pie) pie.innerHTML = clPieHtml('mon', corte.pg);
}
clRegistrar('mon', function(){ renderCalMonitoreosTable(); });

// Fase 337: quien puede cambiar SOLO la fecha (el servidor decide: puedeCambiarFecha).
function calPuedeCambiarFecha(m){
  if(!m) return false;
  if(isFullAdmin()) return true;
  if(!currentUser) return false;
  if(calCanManageMonitoreos()) return true; // Reportes de la campaña
  return (currentUser.rol==='CALIDAD' || currentUser.rol==='SUPERVISOR') && m.evaluadorUserId === currentUser.id && calCurrentPerm();
}
function _calFechaDialogo(){
  var ov = document.getElementById('cal-fecha-ov');
  if(!ov){
    ov = document.createElement('div');
    ov.className = 'cc2-ov'; ov.id = 'cal-fecha-ov'; ov.hidden = true;
    ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true'); ov.setAttribute('aria-labelledby','cal-fecha-t');
    ov.innerHTML = '<div class="cc2-dlg"><h3 id="cal-fecha-t">Cambiar fecha del monitoreo</h3><p class="cpl-ayuda" id="cal-fecha-info"></p>'+
      '<label class="cc2-f"><span class="cc2-lt">Fecha del monitoreo</span><input type="date" id="cal-fecha-in" min="2020-01-01"></label>'+
      '<p class="cpl-ayuda">Solo cambia la fecha: las respuestas y el puntaje quedan igual. El monitoreo pasa al mes de la fecha nueva y el cambio queda en el historial.</p>'+
      '<div class="modal-btns"><button type="button" class="btn-cancel" onclick="calCerrarFecha()">Cancelar</button><button type="button" class="btn-primary" id="cal-fecha-ok" onclick="calGuardarFecha()">Guardar fecha</button></div></div>';
    ov.addEventListener('click', function(e){ if(e.target===ov) calCerrarFecha(); });
    ov.addEventListener('keydown', function(e){ if(e.key==='Escape'){ e.stopPropagation(); calCerrarFecha(); } });
    document.getElementById('calidad-modal').appendChild(ov);
  }
  return ov;
}
var _calFechaId = null, _calFechaFoco = null;
function calCambiarFecha(id){
  var m = calMonModulo(_ccampana).find(function(x){ return x.id===id; });
  if(!m || !calPuedeCambiarFecha(m)){ showToast('No puedes cambiar la fecha de este monitoreo'); return; }
  _calFechaId = id; _calFechaFoco = document.activeElement;
  var ov = _calFechaDialogo();
  document.getElementById('cal-fecha-info').textContent = textoFormatoNombre(m.asesor)+' · fecha actual '+(m.fecha||'-');
  var inp = document.getElementById('cal-fecha-in');
  inp.max = calFechaHoyLocal(); inp.value = m.fecha || calFechaHoyLocal();
  ov.hidden = false; inp.focus();
}
function calCerrarFecha(){
  var ov = document.getElementById('cal-fecha-ov'); if(ov) ov.hidden = true;
  _calFechaId = null;
  if(_calFechaFoco && _calFechaFoco.focus) _calFechaFoco.focus();
}
async function calGuardarFecha(){
  var id = _calFechaId; if(!id) return;
  var fecha = document.getElementById('cal-fecha-in').value;
  if(!fecha){ showToast('Elige la fecha del monitoreo', 'error'); return; }
  if(fecha > calFechaHoyLocal()){ showToast('La fecha del monitoreo no puede ser futura', 'error'); return; }
  try{
    await withButtonLoading(document.getElementById('cal-fecha-ok'), 'Guardando...', function(){ return apiRequest('PUT','/monitoreos/'+id+'/fecha', { fecha: fecha }); });
  }catch(e){ showToast(e.message, 'error'); return; }
  calCerrarFecha();
  showToast('Fecha del monitoreo actualizada');
  // El monitoreo pasa a su mes nuevo en todas las vistas del modulo (y en el dashboard al abrirlo).
  await loadCalData(_ccampana, _cmesFiltro || undefined);
  populateCalMesSelect();
  switchCalTab(_ctab);
}

function renderCalResumenTable(){
  if(typeof caRenderResumen==='function'){ caRenderResumen(); return; } // Fase 255: resumen como el HTML de Edwin
  var arr = calFilterByMonth(calMonModulo(_ccampana), _cmesFiltro);
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
    html += '<tr><td colspan="6" style="text-align:center;color:var(--c-text-muted)">Sin datos'+(_cmesFiltro?' en '+_cmesFiltro:'')+'</td></tr>';
  } else {
    names.forEach(function(n){
      var d = byAsesor[n];
      var prom = Math.round((d.sum/d.count)*10)/10;
      var clasif = prom<70 ? '🔴 CRITICO' : (prom<90 ? '🟡 NO CRITICO' : '🟢 SOBRESALIENTE');
      var alerta = d.fallos===0 ? '✅ SIN FALLOS CRITICOS' : (d.fallos<=1 ? '⚠️ ALERTA' : '🚨 CRITICO FRECUENTE');
      var promColor = (typeof _gdSemaforoColor === 'function') ? _gdSemaforoColor(prom, { metrica: 'qa_promedio', campana: _ccampana }) : null;
      var promCls = (typeof _gdSemaforoClase === 'function' && promColor) ? _gdSemaforoClase(promColor) : '';
      var promBadge = (typeof semaforoBadgeHtml === 'function' && promColor) ? semaforoBadgeHtml(promColor) : '';
      html += '<tr><td>'+esc(textoFormatoNombre(n))+'</td><td>'+d.count+'</td><td class="peak'+(promCls?' '+promCls:'')+'">'+promBadge+prom+'</td><td>'+calEstadoHtml(clasif)+'</td><td>'+d.fallos+'</td><td>'+calEstadoHtml(alerta)+'</td></tr>';
    });
  }
  document.getElementById('cal-resumen-table').innerHTML = html;
}

function renderCalKpis(){
  var allArr = calMonModulo(_ccampana);
  var arr = calFilterByMonth(allArr, _cmesFiltro);
  var total = arr.length;
  var promedio = total ? Math.round((arr.reduce(function(a,m){return a+m.puntaje;},0)/total)*10)/10 : 0;
  var criticos = arr.filter(function(m){return m.fallos>=2;}).length;
  var mesMeta = _cmesFiltro || gdHoyLocal().slice(0,7);
  var totalLabel = _cmesFiltro ? 'Monitoreos ('+_cmesFiltro+')' : 'Monitoreos Totales (todos los meses)';

  var promCardColorReal = (typeof _gdSemaforoColor === 'function') ? _gdSemaforoColor(total ? promedio : null, { metrica: 'qa_promedio', campana: _ccampana }) : null;
  var promCardColorFallback = promedio>=90?'verde':promedio>=70?'amarillo':'rojo';
  var promCardCls = (typeof _gdSemaforoClase === 'function' && promCardColorReal) ? _gdSemaforoClase(promCardColorReal)
    : (promCardColorFallback==='verde'?'kpi-green':promCardColorFallback==='amarillo'?'kpi-org':'kpi-red');
  var promCardBadge = (typeof semaforoBadgeHtml === 'function') ? semaforoBadgeHtml(promCardColorReal || promCardColorFallback) : '';
  // Fase 334: con la vista propia (CALIDAD / SUPERVISOR) la tarjeta muestra el total de la
  // campaña, hechos por todos, y debajo «Hechos por mí: N»; promedio y críticos, sobre los propios.
  var tarjetaTotal = '<div class="aurora-kpi"><div class="kv">'+total+'</div><div class="kl">'+totalLabel+'</div></div>';
  var tc = (CAL_DB[_ccampana]||{}).totalCampana;
  if(calVeSoloPropios() && tc){
    var tMes = _cmesFiltro ? ((tc.porMes||{})[_cmesFiltro] || { total: 0, propios: 0 }) : tc;
    tarjetaTotal = '<div class="aurora-kpi"><div class="kv">'+tMes.total+'</div><div class="kl">'+totalLabel+' · de toda la campaña</div>'+
      '<div class="kl cal-kpi-mios">Hechos por mí: <b>'+total+'</b></div></div>';
  }
  var html =
    tarjetaTotal+
    '<div class="aurora-kpi '+promCardCls+'"><div class="kv">'+promCardBadge+(total?promedio:'—')+'</div><div class="kl">'+(calVeSoloPropios()?'Promedio de mis monitoreos':'Promedio Puntaje')+'</div></div>'+
    '<div class="aurora-kpi kpi-red"><div class="kv">'+criticos+'</div><div class="kl">'+(calVeSoloPropios()?'Mis monitoreos críticos absolutos':'Monitoreos Criticos Absolutos')+'</div></div>';

  if(currentUser && (currentUser.rol==='CALIDAD' || currentUser.rol==='SUPERVISOR')){
    var lideresList = calLideresCumplimiento(_ccampana, mesMeta);
    var mia = lideresList.find(function(l){ return String(l.liderId)===String(currentUser.id); });
    if(!mia){
      html += '<div class="aurora-kpi kpi-org"><div class="kv" style="font-size:0.85rem">Sin meta asignada</div><div class="kl">Mi Meta Individual ('+mesMeta+')</div></div>';
    } else {
      var miaColor = mia.pct>=100?'verde':'amarillo';
      html += '<div class="aurora-kpi kpi-pur"><div class="kv">'+mia.realizados+' / '+mia.meta+'</div><div class="kl">Mi Meta Individual ('+mesMeta+')</div></div>'+
        '<div class="aurora-kpi '+(miaColor==='verde'?'kpi-green':'kpi-org')+'"><div class="kv">'+((typeof semaforoBadgeHtml === 'function')?semaforoBadgeHtml(miaColor):'')+mia.pct+'%</div><div class="kl">Mi Cumplimiento Total ('+mesMeta+')</div></div>'+
        '<div class="aurora-kpi"><div class="kv">'+mia.realizadosLlamada+' / '+mia.metaLlamada+'</div><div class="kl">Mi Cumplimiento Llamada'+(mia.pctLlamadaCompl!==null?' ('+mia.pctLlamadaCompl+'%)':'')+'</div></div>'+
        (mia.auditaWpp ? '<div class="aurora-kpi"><div class="kv">'+mia.realizadosWpp+' / '+mia.metaWpp+'</div><div class="kl">Mi Cumplimiento WhatsApp'+(mia.pctWppCompl!==null?' ('+mia.pctWppCompl+'%)':'')+'</div></div>' : '');
    }
  } else {
    var lideres = calLideresCumplimiento(_ccampana, mesMeta);
    var promedioCumpl = lideres.length ? Math.round(lideres.reduce(function(a,l){return a+l.pct;},0)/lideres.length) : 0;
    var promedioCumplColor = promedioCumpl>=100?'verde':'amarillo';
    html += '<div class="aurora-kpi kpi-pur"><div class="kv">'+lideres.length+'</div><div class="kl">Personas con Meta ('+mesMeta+')</div></div>'+
      '<div class="aurora-kpi '+(promedioCumplColor==='verde'?'kpi-green':'kpi-org')+'"><div class="kv">'+((typeof semaforoBadgeHtml === 'function')?semaforoBadgeHtml(promedioCumplColor):'')+promedioCumpl+'%</div><div class="kl">Cumplimiento Promedio ('+mesMeta+')</div></div>';
  }
  document.getElementById('cal-kpis-strip').innerHTML = html;
}

function renderCalConfig(){
  var curMonth = gdHoyLocal().slice(0,7);
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
    html += '<tr><td colspan="4" style="text-align:center;color:var(--c-text-muted)">No hay usuarios con rol CALIDAD o SUPERVISOR</td></tr>';
  } else {
    rows.forEach(function(u){
      var acceso = u.perms['campana_'+_ccampana]===true;
      html += '<tr><td>'+esc(u.nombre)+' (@'+esc(u.user)+')</td><td>'+esc(u.rol)+'</td><td>'+calEstadoHtml(acceso?'✅ Si':'❌ No')+'</td><td>'+(u.active?'Activo':'Suspendido')+'</td></tr>';
    });
  }
  document.getElementById('cal-permisos-table').innerHTML = html;
  renderCalCodificacionesAdmin();
}

// Fase 95 (tema B): pantalla de admin del catalogo de codificaciones,
// dentro de la pestana "Configuracion" del modulo de Calidad (ya bloqueada
// a isFullAdmin() en openCalidad()). Mismo patron CRUD que umbrales.js/
// metas.js, salvo que aqui nunca se borra -- solo se desactiva/reactiva.
function renderCalCodificacionesAdmin(){
  var tbl = document.getElementById('cal-codificaciones-table');
  if(!tbl) return;
  var rows = calCodificaciones(_ccampana).slice().sort(function(a,b){ return a.valor.localeCompare(b.valor); });
  var html = '<tr><th>Codificacion</th><th>Estado</th><th></th></tr>';
  if(rows.length===0){
    html += '<tr><td colspan="3" style="text-align:center;color:var(--c-text-muted)">Sin codificaciones cargadas todavia -- el campo sigue siendo texto libre</td></tr>';
  } else {
    rows.forEach(function(c){
      html += '<tr><td>'+esc(c.valor)+'</td><td>'+calEstadoHtml(c.activo?'✅ Activa':'⛔ Desactivada')+'</td>'+
        '<td><button class="btn-sm '+(c.activo?'btn-delete':'btn-edit')+'" onclick="calCodificacionToggle('+c.id+','+(!c.activo)+')">'+(c.activo?'Desactivar':'Reactivar')+'</button></td></tr>';
    });
  }
  tbl.innerHTML = html;
}

async function calCodificacionesAgregar(){
  if(!isFullAdmin()){ showToast('Solo el administrador puede administrar el catalogo de codificaciones'); return; }
  var ta = document.getElementById('cf-cod-nuevas');
  var valores = (ta.value||'').split('\n').map(function(v){ return v.trim(); }).filter(function(v){ return v.length>0; });
  if(valores.length===0){ showToast('Pegue al menos una codificacion'); return; }
  try{
    var r = await apiRequest('POST','/calidad/codificaciones/bulk',{ campana: _ccampana, valores: valores });
    ta.value = '';
    await loadCalData(_ccampana, _cmesFiltro || undefined);
    renderCalCodificacionesAdmin();
    renderCalCodifCampoForm('');
    var msg = r.creadas.length+' agregada(s)'+(r.yaExistian.length? ', '+r.yaExistian.length+' ya existian (se omitieron)':'');
    showToast(msg);
  }catch(e){ showToast(e.message, 'error'); }
}

async function calCodificacionToggle(id, activo){
  if(!isFullAdmin()){ showToast('Solo el administrador puede administrar el catalogo de codificaciones'); return; }
  try{
    await apiRequest('PUT','/calidad/codificaciones/'+id,{ activo: activo });
    await loadCalData(_ccampana, _cmesFiltro || undefined);
    renderCalCodificacionesAdmin();
    renderCalCodifCampoForm('');
    showToast(activo ? 'Codificacion reactivada' : 'Codificacion desactivada');
  }catch(e){ showToast(e.message, 'error'); }
}

var _cc = {};
function ccmk(id,cfg){
  var el=document.getElementById(id); if(!el) return;
  if(_cc[id]) try{_cc[id].destroy();}catch(e){}
  _cc[id]=new Chart(el,cfg);
  if(typeof gdEtiquetarCanvasChart === 'function') gdEtiquetarCanvasChart(_cc[id]);
}
// Fase 136 (PR 7, F09): mismo helper y mismo texto que
// mrMostrarSinDatosOCanvas (mis-resultados.js) -- un doughnut de 3
// valores en 0 no dibuja ningun sector, quedaba en blanco sin avisar.
function ccMostrarSinDatosOCanvas(canvasId, hayDatos, etiqueta){
  var host = document.getElementById(canvasId);
  var wrap = host ? host.parentElement : document.querySelector('[data-cc-wrap-de="'+canvasId+'"]');
  if(!wrap) return;
  if(hayDatos){
    if(!document.getElementById(canvasId)){
      wrap.innerHTML = '<canvas id="'+canvasId+'"></canvas>';
    }
  } else {
    if(_cc[canvasId]){ try{_cc[canvasId].destroy();}catch(e){} delete _cc[canvasId]; }
    wrap.setAttribute('data-cc-wrap-de', canvasId);
    wrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--c-text-muted);font-size:var(--fs-small);text-align:center;padding:0 16px">Sin datos de '+esc(etiqueta)+' todavia.</div>';
  }
}

async function descargarReporteGeneral(){
  if(typeof XLSX==='undefined'){ showToast('No se pudo cargar el generador de Excel. Verifique su conexion a internet e intente de nuevo.'); return; }
  var mes = _cmesFiltro || gdHoyLocal().slice(0,7);
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
    var ws = XLSX.utils.aoa_to_sheet(xlsxFilasSeguras(aoa));
    ws['!cols'] = [{wch:28},{wch:10},{wch:11},{wch:16},{wch:12},{wch:12},{wch:9},{wch:13},{wch:13},{wch:10}];
    var sheetName = xlsxNombreHojaUnico(camp, usedNames);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }
  XLSX.writeFile(wb, 'Reporte_Cumplimiento_'+mes+'.xlsx');
  showToast('Reporte de '+mes+' descargado — una hoja por campana con acceso');
}

function closeSupervisionLider(){
  var cerrarReal = function(){ document.getElementById('supervisar-lider-overlay').classList.remove('show'); };
  if (typeof motionCerrarModal === 'function') motionCerrarModal('supervisar-lider-modal', cerrarReal);
  else cerrarReal();
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

  var arr = calMonModulo(camp);
  var misMon = arr.filter(function(m){
    return calMonthKey(m.fecha)===mes && String(m.evaluadorUserId)===String(l.liderId);
  }).sort(function(a,b){ return (b.fecha||'').localeCompare(a.fecha||''); });
  var html = '<tr><th>Fecha</th><th>Asesor</th><th>Canal</th><th>Puntaje</th><th>Clasificacion</th><th>Nivel Critico</th></tr>';
  if(misMon.length===0){
    html += '<tr><td colspan="6" style="text-align:center;color:var(--c-text-muted)">Sin monitoreos registrados este mes</td></tr>';
  } else {
    misMon.forEach(function(m){
      var canalLbl = calEstadoHtml(m.canal==='WPP' ? '💬 WPP' : '📞 Llamada');
      html += '<tr><td>'+(typeof ceFechaConLlamadaHtml==='function'?ceFechaConLlamadaHtml(m,esc):esc(m.fecha||'-'))+'</td><td>'+esc(textoFormatoNombre(m.asesor))+'</td><td>'+canalLbl+'</td><td class="peak">'+m.puntaje+'</td><td>'+calEstadoHtml(m.clasificacion)+'</td><td>'+calEstadoHtml(m.nivelCritico)+'</td></tr>';
    });
  }
  document.getElementById('sl-monitoreos-table').innerHTML = html;
  document.getElementById('supervisar-lider-overlay').classList.add('show');
  if (typeof motionAbrirModal === 'function') motionAbrirModal('supervisar-lider-modal');
}

function renderCalReportes(){
  var allArr = calMonModulo(_ccampana);
  var arr = calFilterByMonth(allArr, _cmesFiltro);
  var curMonth = _cmesFiltro || gdHoyLocal().slice(0,7);
  var sobresaliente = arr.filter(function(m){return m.puntaje>=90;}).length;
  var noCritico = arr.filter(function(m){return m.puntaje>=70 && m.puntaje<90;}).length;
  var critico = arr.filter(function(m){return m.puntaje<70;}).length;

  document.getElementById('cal-reportes-kpis').innerHTML =
    '<div class="aurora-kpi kpi-green"><div class="kv">'+sobresaliente+'</div><div class="kl">'+calEstadoHtml('🟢 Sobresaliente')+'</div></div>'+
    '<div class="aurora-kpi kpi-org"><div class="kv">'+noCritico+'</div><div class="kl">'+calEstadoHtml('🟡 No Critico')+'</div></div>'+
    '<div class="aurora-kpi kpi-red"><div class="kv">'+critico+'</div><div class="kl">'+calEstadoHtml('🔴 Critico')+'</div></div>'+
    '<div class="aurora-kpi"><div class="kv">'+arr.length+'</div><div class="kl">Total Evaluados'+(_cmesFiltro?' ('+_cmesFiltro+')':'')+'</div></div>';

  ccMostrarSinDatosOCanvas('cch-clasificacion', arr.length > 0, 'Distribucion de Clasificacion');
  if (arr.length > 0) {
    ccmk('cch-clasificacion',{type:'doughnut',data:{labels:['Sobresaliente','No Critico','Critico'],datasets:[{data:[sobresaliente,noCritico,critico],backgroundColor:[CG,CO,CR]}]},options:loDatalabelsAuto(loPie())});
  }

  var lideres = calLideresCumplimiento(_ccampana, curMonth);
  var nombres = lideres.map(function(l){return l.liderNombre;});
  var pcts = lideres.map(function(l){return l.pct;});
  ccmk('cch-cumplimiento',{type:'bar',data:{labels:nombres.length?nombres:['Sin metas programadas'],datasets:[
    {label:'% Cumplimiento Individual',data:pcts.length?pcts:[0],backgroundColor:CM,borderRadius:4}
  ]},options:loDatalabelsAuto(loPct2(30))});

  var html = '<tr><th>Persona de Calidad / Supervisor</th><th>Meta Total</th><th>Realizados</th><th>% Total</th><th>Meta Llamada</th><th>Real Llamada</th><th>Meta WPP</th><th>Real WPP</th><th></th></tr>';
  if(lideres.length===0){
    html += '<tr><td colspan="9" style="text-align:center;color:var(--c-text-muted)">'+curMonth+' no tiene metas individuales programadas en Admin</td></tr>';
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
