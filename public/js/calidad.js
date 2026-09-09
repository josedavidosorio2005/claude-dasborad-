// calidad.js — InConexion Platform. Extraído de index.html (antes un único <script>).
// Se carga como <script src> global y en orden; todas las funciones son globales
// y se invocan desde manejadores del HTML. No cambiar el orden de carga.

// Replica exacta de NUEVA_PLANTILLA_DE_CALIDAD_CLINICA_ORLANT_2026.xlsx
// ═══════════════════════════════════════════════════════════
var CAL_ITEMS_ORLANT = [
  {n:1, cat:'APERTURA',      label:'Guion de saludo', weight:5, critico:false},
  {n:2, cat:'APERTURA',      label:'Solicita documento de identidad', weight:4, critico:false},
  {n:3, cat:'APERTURA',      label:'Valida entidad y derechos', weight:7, critico:true},
  {n:4, cat:'ESCUCHA',       label:'Identifica y gestiona el requerimiento', weight:7, critico:false},
  {n:5, cat:'ESCUCHA',       label:'No interrumpe al paciente', weight:3, critico:false},
  {n:6, cat:'GESTION',       label:'Revisa aplicativos y ofrece mejor disponibilidad', weight:11, critico:true},
  {n:7, cat:'GESTION',       label:'Agendamiento correcto / Servinte', weight:11, critico:true},
  {n:8, cat:'GESTION',       label:'Trazabilidad en el STA', weight:8, critico:true},
  {n:9, cat:'GESTION',       label:'Confirma datos en sistema', weight:4, critico:false},
  {n:10,cat:'GESTION',       label:'Confirmacion de la cita con el paciente', weight:4, critico:false},
  {n:11,cat:'INFORMACION',   label:'Recomendaciones / preparacion', weight:7, critico:true},
  {n:12,cat:'INFORMACION',   label:'Informa cancelacion', weight:3, critico:false},
  {n:13,cat:'INFORMACION',   label:'Conocimiento del servicio', weight:7, critico:true},
  {n:14,cat:'TIEMPOS',       label:'Acompanamiento en espera', weight:3, critico:false},
  {n:15,cat:'TIEMPOS',       label:'Uso del mute', weight:3, critico:false},
  {n:16,cat:'CIERRE',        label:'Despedida con protocolo', weight:3, critico:false},
  {n:17,cat:'GESTION 3P',    label:'Gestion correcta pacientes 3P', weight:10, critico:true}
];

var CAL_ITEMS_INFONDO = [
  {n:1, cat:'APERTURA', label:'Saludo', weight:5, critico:false},
  {n:2, cat:'APERTURA', label:'Valida correctamente la identidad del cliente', weight:9, critico:false},
  {n:3, cat:'ESCUCHA',  label:'Escucha activamente sin interrumpir', weight:7, critico:false},
  {n:4, cat:'ESCUCHA',  label:'Identifica correctamente la necesidad del cliente', weight:9, critico:true},
  {n:5, cat:'GESTION',  label:'Brinda informacion clara y completa', weight:12, critico:true},
  {n:6, cat:'GESTION',  label:'Utiliza lenguaje cordial y profesional', weight:10, critico:false},
  {n:7, cat:'GESTION',  label:'Resuelve la solicitud o brinda la gestion correcta', weight:13, critico:true},
  {n:8, cat:'GESTION',  label:'Ofrece alternativas o brinda gestion necesaria', weight:10, critico:false},
  {n:9, cat:'GESTION',  label:'Registra correctamente la gestion en el sistema (CRM)', weight:13, critico:true},
  {n:10,cat:'CIERRE',   label:'Cierre de llamada y se despide cordialmente', weight:7, critico:false},
  {n:11,cat:'TIEMPOS',  label:'Retoma la llamada cada 60 segundos', weight:5, critico:false}
];

var CAL_ITEMS_SURA = [
  {n:1, cat:'ACTITUD Y COMUNICACION', label:'Saludo y despedida', weight:7, critico:false},
  {n:2, cat:'ACTITUD Y COMUNICACION', label:'Intencionalidad', weight:6, critico:true},
  {n:3, cat:'ACTITUD Y COMUNICACION', label:'Amabilidad y trato hacia el cliente', weight:12, critico:true},
  {n:4, cat:'ACTITUD Y COMUNICACION', label:'Expresion verbal, seguridad y confianza', weight:5, critico:false},
  {n:5, cat:'CONOCIMIENTO Y PERFILACION', label:'Conocimiento producto', weight:12, critico:true},
  {n:6, cat:'CONOCIMIENTO Y PERFILACION', label:'Filtros obligatorios y perfilacion', weight:12, critico:true},
  {n:7, cat:'MANEJO DE OBJECIONES', label:'Manejo de objeciones (minimo 3 por llamada)', weight:12, critico:true},
  {n:8, cat:'MANEJO DE OBJECIONES', label:'Manejo de objeciones 2 (solo 2 objeciones)', weight:9, critico:false},
  {n:9, cat:'MANEJO DE OBJECIONES', label:'Manejo de objeciones 1 (solo 1 objecion)', weight:7, critico:false},
  {n:10,cat:'CIERRE', label:'Escucha activa concentracion', weight:6, critico:false},
  {n:11,cat:'CIERRE', label:'Tipificacion', weight:12, critico:true}
];

var CAL_ITEMS_AURORA = [
  {n:1, cat:'GUION', label:'Saludo', weight:5, critico:false},
  {n:2, cat:'GUION', label:'Escucha activa', weight:8, critico:false},
  {n:3, cat:'GUION', label:'Revision (aplicativos y disponibilidad)', weight:10, critico:true},
  {n:4, cat:'GUION', label:'Manejo de tiempos de espera y acompanamiento', weight:4, critico:false},
  {n:5, cat:'GUION / AGENDAMIENTO', label:'Agendamiento correcto', weight:10, critico:true},
  {n:6, cat:'GUION / AGENDAMIENTO', label:'Registro en sistema', weight:12, critico:false},
  {n:7, cat:'GUION', label:'Recomendaciones', weight:10, critico:true},
  {n:8, cat:'GUION', label:'Confirma paciente (fecha y hora de la cita)', weight:8, critico:false},
  {n:9, cat:'GUION', label:'Conocimiento del producto', weight:10, critico:true},
  {n:10,cat:'CORDIALIDAD', label:'Uso del mute', weight:5, critico:false},
  {n:11,cat:'CORDIALIDAD', label:'Cordialidad y respeto', weight:13, critico:true},
  {n:12,cat:'CORDIALIDAD', label:'Despedida', weight:5, critico:false}
];

var CAL_ITEMS_CARTERA = [
  {n:1, cat:'APERTURA', label:'Saludo', weight:5, critico:false},
  {n:2, cat:'APERTURA', label:'Grabacion de la llamada o chat', weight:7, critico:false},
  {n:3, cat:'APERTURA', label:'Motivo de la llamada', weight:9, critico:false},
  {n:4, cat:'COMUNICACION', label:'Comunicacion oral y cumplimiento de parametros de cobranza', weight:9, critico:false},
  {n:5, cat:'GESTION', label:'Buen uso de los argumentos - Persuade al cliente', weight:7, critico:true},
  {n:6, cat:'GESTION', label:'Objeciones', weight:9, critico:true},
  {n:7, cat:'GESTION', label:'Liquidacion del credito', weight:12, critico:true},
  {n:8, cat:'GESTION', label:'Resolucion de la llamada - dudas', weight:5, critico:false},
  {n:9, cat:'GESTION', label:'Medios de pago', weight:13, critico:true},
  {n:10,cat:'LEGAL', label:'Habeas data', weight:5, critico:false},
  {n:11,cat:'GESTION', label:'Documenta gestion de la llamada', weight:5, critico:false},
  {n:12,cat:'COMUNICACION', label:'Ortografia', weight:5, critico:false},
  {n:13,cat:'CIERRE', label:'Cierre de la llamada', weight:6, critico:false},
  {n:14,cat:'TIEMPOS', label:'Tiempo de retoma de llamada', weight:3, critico:false}
];

var CAL_ITEMS_COMFAMA = [
  {n:1, cat:'NO NEGOCIABLES', label:'Presentacion y alianza (SURA Vida / Colmena Desempleo / Los Olivos Exequial)', weight:5, critico:true},
  {n:2, cat:'NO NEGOCIABLES', label:'3 coberturas minimas con valores correctos', weight:10, critico:true},
  {n:3, cat:'NO NEGOCIABLES', label:'Medio de pago, meses de pignoracion y vigencia', weight:8, critico:true},
  {n:4, cat:'NO NEGOCIABLES', label:'Pregunta PEP (persona politicamente expuesta)', weight:5, critico:true},
  {n:5, cat:'NO NEGOCIABLES', label:'Habeas Data (autorizacion tratamiento de datos)', weight:4, critico:true},
  {n:6, cat:'NO NEGOCIABLES', label:'Codigos OTP (1ro datos/condiciones, 2do debito)', weight:3, critico:true},
  {n:7, cat:'COMERCIAL', label:'Generar necesidad (conexion emocional antes del plan)', weight:13, critico:false},
  {n:8, cat:'COMERCIAL', label:'Manejo de objeciones', weight:15, critico:false},
  {n:9, cat:'COMERCIAL', label:'Cierre efectivo', weight:12, critico:false},
  {n:10,cat:'ATRIBUTOS', label:'Empatia', weight:8, critico:false},
  {n:11,cat:'ATRIBUTOS', label:'Resolutividad', weight:6, critico:false},
  {n:12,cat:'ATRIBUTOS', label:'Mentoria (adapta la explicacion al cliente)', weight:6, critico:false},
  {n:13,cat:'ATRIBUTOS', label:'Empoderamiento (seguridad y dominio)', weight:5, critico:false}
];

// engine 'standard' = N/A o SI suma peso completo, NO en critico resta -20 del peso (replica Orlant/Infondo/Aurora/Cartera/Comfama)
// engine 'sura' = solo SI suma peso completo; NO o N/A no suman nada; los criticos no penalizan el puntaje, solo cuentan fallos (replica exacta de la plantilla Sura)
var CAL_CAMPANAS = {
  'ORLANT':             { items: CAL_ITEMS_ORLANT,  engine:'standard' },
  'INFONDO':            { items: CAL_ITEMS_INFONDO, engine:'standard' },
  'TELEVENTAS SURA':    { items: CAL_ITEMS_SURA,     engine:'sura' },
  'CLINICA AURORA':     { items: CAL_ITEMS_AURORA,   engine:'standard' },
  'CARTERA INTERNA':    { items: CAL_ITEMS_CARTERA,  engine:'standard' },
  'TELEVENTAS COMFAMA': { items: CAL_ITEMS_COMFAMA,  engine:'standard' }
};

var CAL_SK = 'inconexion_calidad_v1';
var CAL_DB = {}; // { ORLANT: { monitoreos:[], config:{metas:{'2026-07':6}} } }
function calGetCronogramaRows(camp, monthKey){
  // todas las filas (una por lider) programadas exactamente para ese mes, sin carry-forward
  var d = CAL_DB[camp]; if(!d) return [];
  var cron = d.config.cronograma || {};
  return Array.isArray(cron[monthKey]) ? cron[monthKey] : [];
}
function calGetCronogramaForLider(camp, monthKey, liderId){
  // busca la meta INDIVIDUAL de ese lider para ese mes; si no hay una entrada exacta, toma la del mes anterior mas reciente que si tenga
  if(liderId===undefined || liderId===null || liderId==='') return null;
  var d = CAL_DB[camp]; if(!d) return null;
  var cron = d.config.cronograma || {};
  var months = Object.keys(cron).filter(function(k){return k<=monthKey;}).sort().reverse();
  for(var i=0;i<months.length;i++){
    var rows = cron[months[i]];
    if(!Array.isArray(rows)) continue;
    var found = rows.filter(function(r){return String(r.liderId)===String(liderId);})[0];
    if(found) return found;
  }
  return null;
}
function calGetMyMetaForMonth(camp, monthKey){
  // la meta INDIVIDUAL del usuario actualmente logueado (persona de Calidad o Supervisor) para esa campana/mes
  if(!currentUser) return null; // el admin maestro no tiene una meta individual propia
  var row = calGetCronogramaForLider(camp, monthKey, currentUser.id);
  return row ? row.metaGrupal : null;
}
var _ccampana = 'ORLANT';
var _ctab = 'nuevo';
var _cmesFiltro = '';

// ── Helpers de filtro por mes (reutilizables en todos los modulos) ──
function calAvailableMonths(arr){
  var set = {};
  arr.forEach(function(m){ if(m.fecha) set[m.fecha.slice(0,7)] = true; });
  return Object.keys(set).sort().reverse();
}
function calFilterByMonth(arr, month){
  if(!month) return arr;
  return arr.filter(function(m){ return m.fecha && m.fecha.slice(0,7)===month; });
}
function calMonthSelectOptions(months, selected){
  return '<option value="">Todos los meses</option>' + months.map(function(mo){
    return '<option value="'+mo+'"'+(mo===selected?' selected':'')+'>'+mo+'</option>';
  }).join('');
}

function loadCalData(){
  var alreadyLoaded = CAL_DB && Object.keys(CAL_DB).length>0;
  if(!alreadyLoaded){
    try{
      var raw = localStorage.getItem(CAL_SK);
      CAL_DB = raw ? JSON.parse(raw) : {};
    } catch(e){ CAL_DB = {}; }
  }
  CAMPANAS_CALIDAD.forEach(function(c){
    if(!CAL_DB[c]) CAL_DB[c] = {monitoreos:[], config:{cronograma:{}}};
    if(!CAL_DB[c].config) CAL_DB[c].config = {cronograma:{}};
    if(!CAL_DB[c].config.cronograma) CAL_DB[c].config.cronograma = {};
    var cron = CAL_DB[c].config.cronograma;
    // backward-compat: una fila unica por mes (formato viejo) -> se convierte en arreglo de 1 fila "Sin asignar"
    Object.keys(cron).forEach(function(m){
      if(!Array.isArray(cron[m])){
        var old = cron[m];
        cron[m] = old ? [Object.assign({liderId:null, liderNombre:(old.lider||'Sin asignar')}, old)] : [];
      }
    });
    // backward-compat: metas planas (solo numero) migradas a fila "Sin asignar"
    if(CAL_DB[c].config.metas){
      Object.keys(CAL_DB[c].config.metas).forEach(function(m){
        if(cron[m]===undefined || cron[m].length===0){
          var v = CAL_DB[c].config.metas[m];
          cron[m] = [calBuildCronogramaRow(null, 'Sin asignar', v, 1, 19, false, 0)];
        }
      });
      delete CAL_DB[c].config.metas;
    }
    if(CAL_DB[c].config.metaMensual!==undefined){
      var curM=new Date().toISOString().slice(0,7);
      if(cron[curM]===undefined || cron[curM].length===0){
        cron[curM] = [calBuildCronogramaRow(null, 'Sin asignar', CAL_DB[c].config.metaMensual, 1, 19, false, 0)];
      }
      delete CAL_DB[c].config.metaMensual;
    }
    if(!CAL_DB[c].monitoreos) CAL_DB[c].monitoreos=[];
  });
}
function calBuildCronogramaRow(liderId, liderNombre, metaGrupal, asesores, diasLaborales, whatsapp, pctWhatsapp){
  metaGrupal = Number(metaGrupal)||0;
  asesores = Number(asesores)||1;
  diasLaborales = Number(diasLaborales)||19;
  return {
    liderId: (liderId===undefined||liderId===null) ? null : liderId,
    liderNombre: liderNombre||'',
    metaGrupal: metaGrupal,
    asesores: asesores,
    diasLaborales: diasLaborales,
    whatsapp: !!whatsapp,
    pctWhatsapp: Number(pctWhatsapp)||0,
    metaPorAsesor: Math.round((metaGrupal/asesores)*100)/100,
    metaDiaria: Math.round((metaGrupal/diasLaborales)*100)/100,
    semana1: Math.round(metaGrupal*0.25*100)/100,
    semana2: Math.round(metaGrupal*0.5*100)/100,
    semana3: Math.round(metaGrupal*0.75*100)/100,
    semana4: metaGrupal
  };
}
function saveCalData(){
  try{ localStorage.setItem(CAL_SK, JSON.stringify(CAL_DB)); }catch(e){}
}

// Motor de puntaje — replica exacta de la formula de Excel:
// no critico: SI o N/A -> peso completo; NO -> 0
// critico:    N/A o SI -> peso completo; NO -> peso - 20 (puede ir negativo)
// total = MAX(0, MIN(100, suma))
function calComputeScore(items, answers, engine){
  engine = engine || 'standard';
  var answered = items.some(function(it){ return answers[it.n]; });
  if(!answered) return {puntaje:null, clasificacion:'—', fallos:null, nivelCritico:'—'};
  var sum = 0, fallos = 0;
  items.forEach(function(it){
    var a = answers[it.n];
    if(engine==='sura'){
      // Solo SI suma el peso completo; NO o N/A no suman nada (replica exacta plantilla Sura)
      if(a==='SI') sum += it.weight;
      if(it.critico && a==='NO') fallos++;
    } else {
      if(!it.critico){
        if(a==='N/A'||a==='SI') sum += it.weight;
        // NO -> +0
      } else {
        if(a==='N/A'||a==='SI') sum += it.weight;
        else if(a==='NO'){ sum += (it.weight-20); fallos++; }
      }
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

function calCurrentPerm(){
  // true si el usuario actual puede CALIFICAR (crear monitoreos nuevos) en la campana seleccionada
  if(isFullAdmin()) return true;
  if(!currentUser || (currentUser.rol!=='CALIDAD' && currentUser.rol!=='SUPERVISOR')) return false;
  return currentUser.perms['campana_'+_ccampana]===true;
}

function calCanEvaluate(){
  // rol CALIDAD, SUPERVISOR o el administrador pueden ver/usar la plantilla para crear monitoreos
  return isFullAdmin() || (currentUser && (currentUser.rol==='CALIDAD' || currentUser.rol==='SUPERVISOR'));
}

function calCanManageMonitoreos(){
  // Una vez guardado un monitoreo, solo el rol REPORTES (con acceso a la campana) o el Admin pueden editarlo/eliminarlo.
  // Ni la persona de Calidad ni el Supervisor que lo creo pueden modificarlo despues de guardado.
  if(isFullAdmin()) return true;
  if(!currentUser || currentUser.rol!=='REPORTES') return false;
  return currentUser.perms['campana_'+_ccampana]===true;
}

function calAccessibleCampanas(){
  // campanas que tienen plantilla de calificacion Y a las que el usuario tiene acceso (admin ve todas)
  return Object.keys(CAL_CAMPANAS).filter(function(c){
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
  sel.innerHTML = accesibles.map(function(c){ return '<option value="'+c+'">'+c+'</option>'; }).join('');
  if(accesibles.indexOf(_ccampana)===-1) _ccampana = accesibles[0];
  sel.value = _ccampana;
}
function openCalidad(){
  loadCalData();
  document.getElementById('calidad-overlay').classList.add('show');
  populateCalCampanaSelect();
  populateCalMesSelect();
  var cfg = document.getElementById('ctab-btn-config');
  if(cfg) cfg.style.display = isFullAdmin() ? '' : 'none';
  var canEval = calCanEvaluate();
  var nuevoBtn = document.getElementById('ctab-btn-nuevo');
  if(nuevoBtn) nuevoBtn.style.display = canEval ? '' : 'none';
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
function onCalMesChange(){
  _cmesFiltro = document.getElementById('cal-mes-sel').value;
  switchCalTab(_ctab);
}

function onCalCampanaChange(){
  _ccampana = document.getElementById('cal-campana-sel').value;
  populateCalMesSelect();
  renderCalItemsForm();
  populateCalAsesorSelect();
  switchCalTab(_ctab);
}

// Lista desplegable de asesores: solo usuarios con rol ASESOR, activos, y asignados a la campana actual.
// Garantiza trazabilidad: el monitoreo siempre queda vinculado a un usuario real del modulo ASESOR.
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
      asesores.map(function(u){ return '<option value="'+u.nombre+'">'+u.nombre+'</option>'; }).join('');
  }
}

function switchCalTab(t){
  if(t==='nuevo' && !calCanEvaluate()) t='resumen';
  _ctab = t;
  document.querySelectorAll('#calidad-modal .atab').forEach(function(el){ el.classList.toggle('atab-active', el.dataset.ctab===t); });
  document.querySelectorAll('#calidad-modal .atab-panel').forEach(function(el){ el.classList.toggle('visible', el.id==='cpanel-'+t); });
  populateCalMesSelect();
  renderCalKpis();
  if(t==='nuevo') renderCalPreview();
  else if(t==='monitoreos') renderCalMonitoreosTable();
  else if(t==='resumen') renderCalResumenTable();
  else if(t==='reportes') setTimeout(renderCalReportes,60);
  else if(t==='config') renderCalConfig();
}

function renderCalItemsForm(){
  var items = CAL_CAMPANAS[_ccampana].items;
  var cats = [];
  items.forEach(function(it){ if(cats.indexOf(it.cat)===-1) cats.push(it.cat); });
  var html='';
  cats.forEach(function(cat){
    html += '<div class="qi-cat-header">'+cat+'</div>';
    items.filter(function(it){return it.cat===cat;}).forEach(function(it){
      html += '<div class="qi-row">'+
        '<div class="qi-label">'+(it.critico?'<span class="qi-crit">&#9888;</span>':'')+it.n+'. '+it.label+'<span class="qi-weight">('+it.weight+'%)</span></div>'+
        '<select class="qi-select" id="cf-item-'+it.n+'" onchange="renderCalPreview()">'+
          '<option value="">—</option><option value="SI">SI</option><option value="NO">NO</option><option value="N/A">N/A</option>'+
        '</select></div>';
    });
  });
  document.getElementById('cf-items-wrap').innerHTML = html;
  renderCalPreview();
}

function calReadAnswers(){
  var items = CAL_CAMPANAS[_ccampana].items;
  var answers = {};
  items.forEach(function(it){
    var el = document.getElementById('cf-item-'+it.n);
    answers[it.n] = el ? el.value : '';
  });
  return answers;
}

function renderCalPreview(){
  var items = CAL_CAMPANAS[_ccampana].items;
  var answers = calReadAnswers();
  var r = calComputeScore(items, answers, CAL_CAMPANAS[_ccampana].engine);
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
  var items = CAL_CAMPANAS[_ccampana].items;
  items.forEach(function(it){ var el=document.getElementById('cf-item-'+it.n); if(el) el.value=''; });
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
  var arr = CAL_DB[_ccampana].monitoreos;
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
  var items = CAL_CAMPANAS[_ccampana].items;
  items.forEach(function(it){
    var el = document.getElementById('cf-item-'+it.n);
    if(el) el.value = (m.answers && m.answers[it.n]) || '';
  });
  renderCalPreview();
  showToast('Editando monitoreo de '+m.asesor+' ('+(m.fecha||'-')+') — modifique y presione Guardar');
}

function submitMonitoreo(){
  var editing = !!_editingMonitoreoId;
  if(editing){
    if(!calCanManageMonitoreos()){ showToast('Solo el rol Reportes o el Administrador pueden editar un monitoreo ya guardado'); return; }
  } else if(!calCurrentPerm()){ showToast('No tiene permiso para evaluar esta campana'); return; }
  var asesor = document.getElementById('cf-asesor').value.trim();
  if(!asesor){ showToast('Seleccione el asesor a monitorear'); return; }
  var items = CAL_CAMPANAS[_ccampana].items;
  var answers = calReadAnswers();
  var r = calComputeScore(items, answers, CAL_CAMPANAS[_ccampana].engine);
  if(r.puntaje===null){ showToast('Responda al menos un item'); return; }
  var mon = {
    id: editing ? _editingMonitoreoId : Date.now(),
    asesor: asesor,
    fecha: document.getElementById('cf-fecha').value,
    idLlamada: document.getElementById('cf-idllamada').value.trim(),
    telefono: document.getElementById('cf-telefono').value.trim(),
    codificacion: document.getElementById('cf-codificacion').value.trim(),
    evaluador: document.getElementById('cf-evaluador').value.trim() || actorName(),
    canal: document.getElementById('cf-canal').value || 'LLAMADA',
    answers: answers,
    puntaje: r.puntaje, clasificacion: r.clasificacion, fallos: r.fallos, nivelCritico: r.nivelCritico,
    observaciones: document.getElementById('cf-observaciones').value.trim(),
    createdAt: nowStr()
  };
  if(editing){
    var idx = CAL_DB[_ccampana].monitoreos.findIndex(function(x){ return x.id===_editingMonitoreoId; });
    if(idx>=0){ mon.createdAt = CAL_DB[_ccampana].monitoreos[idx].createdAt; CAL_DB[_ccampana].monitoreos[idx] = mon; }
    saveCalData();
    showToast('Monitoreo actualizado correctamente');
  } else {
    CAL_DB[_ccampana].monitoreos.push(mon);
    saveCalData();
    showToast('Monitoreo guardado correctamente');
  }
  resetCalForm();
  switchCalTab('monitoreos');
}

function calMonitoreosDelete(id){
  if(!calCanManageMonitoreos()){ showToast('Solo el rol Reportes o el Administrador pueden eliminar un monitoreo ya guardado'); return; }
  if(!confirm('Eliminar este monitoreo?')) return;
  var arr = CAL_DB[_ccampana].monitoreos;
  var idx = arr.findIndex(function(m){return m.id===id;});
  if(idx>=0){ arr.splice(idx,1); saveCalData(); renderCalMonitoreosTable(); renderCalKpis(); }
}

function renderCalMonitoreosTable(){
  var arr = calFilterByMonth(CAL_DB[_ccampana].monitoreos, _cmesFiltro).slice().sort(function(a,b){return b.id-a.id;});
  var canManage = calCanManageMonitoreos();
  var html = '<tr><th>Asesor</th><th>Fecha</th><th>Canal</th><th>ID/Llamada</th><th>Codificacion</th><th>Evaluador</th><th>Puntaje</th><th>Clasificacion</th><th>Fallos</th><th>Nivel Critico</th>'+(canManage?'<th></th>':'')+'</tr>';
  if(arr.length===0){
    html += '<tr><td colspan="11" style="text-align:center;color:#7a9ba8">Sin monitoreos registrados'+(_cmesFiltro?' en '+_cmesFiltro:'')+'</td></tr>';
  } else {
    arr.forEach(function(m){
      var canalLbl = m.canal==='WPP' ? '💬 WPP' : '📞 Llamada';
      html += '<tr><td>'+m.asesor+'</td><td>'+(m.fecha||'-')+'</td><td>'+canalLbl+'</td><td>'+(m.idLlamada||'-')+'</td><td>'+(m.codificacion||'-')+'</td><td>'+(m.evaluador||'-')+'</td>'+
        '<td class="peak">'+m.puntaje+'</td><td>'+m.clasificacion+'</td><td>'+m.fallos+'</td><td>'+m.nivelCritico+'</td>'+
        (canManage?('<td><button class="btn-sm btn-edit" onclick="editarMonitoreo('+m.id+')">Editar</button> <button class="btn-sm btn-delete" onclick="calMonitoreosDelete('+m.id+')">Eliminar</button></td>'):'')+'</tr>';
    });
  }
  document.getElementById('cal-monitoreos-table').innerHTML = html;
}

function renderCalResumenTable(){
  var arr = calFilterByMonth(CAL_DB[_ccampana].monitoreos, _cmesFiltro);
  var byAsesor = {};
  arr.forEach(function(m){
    if(!byAsesor[m.asesor]) byAsesor[m.asesor] = {count:0, sum:0, fallos:0};
    byAsesor[m.asesor].count++;
    byAsesor[m.asesor].sum += m.puntaje;
    byAsesor[m.asesor].fallos += m.fallos;
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
      html += '<tr><td>'+n+'</td><td>'+d.count+'</td><td class="peak">'+prom+'</td><td>'+clasif+'</td><td>'+d.fallos+'</td><td>'+alerta+'</td></tr>';
    });
  }
  document.getElementById('cal-resumen-table').innerHTML = html;
}

function calMonthKey(dateStr){
  if(!dateStr) return null;
  return dateStr.slice(0,7); // YYYY-MM
}

function calLideresCumplimiento(camp, mes){
  // Para cada lider con una meta vigente ese mes (via carry-forward), calcula su cumplimiento INDIVIDUAL,
  // desglosado por canal (Llamada / WhatsApp) segun el % de WhatsApp a auditar configurado en el cronograma.
  var d = CAL_DB[camp]; if(!d) return [];
  var arr = d.monitoreos;
  var cron = d.config.cronograma || {};
  var liderIds = {};
  Object.keys(cron).filter(function(k){return k<=mes;}).forEach(function(k){
    (cron[k]||[]).forEach(function(r){ if(r.liderId) liderIds[r.liderId]=true; });
  });
  return Object.keys(liderIds).map(function(lid){
    var row = calGetCronogramaForLider(camp, mes, lid);
    if(!row) return null;
    var misMon = arr.filter(function(m){
      return calMonthKey(m.fecha)===mes && (m.evaluador||'').trim().toLowerCase()===(row.liderNombre||'').trim().toLowerCase();
    });
    var realizados = misMon.length;
    var realizadosWpp = misMon.filter(function(m){ return m.canal==='WPP'; }).length;
    var realizadosLlamada = realizados - realizadosWpp;
    var pctWpp = row.pctWhatsapp || 0;
    var metaWpp = row.whatsapp ? Math.round(row.metaGrupal * pctWpp/100) : 0;
    var metaLlamada = row.metaGrupal - metaWpp;
    var pct = row.metaGrupal ? Math.round(Math.min(100,(realizados/row.metaGrupal)*100)) : 0;
    var pctWppCompl = metaWpp ? Math.round(Math.min(100,(realizadosWpp/metaWpp)*100)) : null;
    var pctLlamadaCompl = metaLlamada ? Math.round(Math.min(100,(realizadosLlamada/metaLlamada)*100)) : null;
    return {
      liderNombre: row.liderNombre, meta: row.metaGrupal, realizados: realizados, pct: pct,
      auditaWpp: !!row.whatsapp, metaWpp: metaWpp, realizadosWpp: realizadosWpp, pctWppCompl: pctWppCompl,
      metaLlamada: metaLlamada, realizadosLlamada: realizadosLlamada, pctLlamadaCompl: pctLlamadaCompl
    };
  }).filter(Boolean).sort(function(a,b){ return a.liderNombre.localeCompare(b.liderNombre); });
}

function renderCalKpis(){
  var allArr = CAL_DB[_ccampana].monitoreos;
  var arr = calFilterByMonth(allArr, _cmesFiltro);
  var total = arr.length;
  var promedio = total ? Math.round((arr.reduce(function(a,m){return a+m.puntaje;},0)/total)*10)/10 : 0;
  var criticos = arr.filter(function(m){return m.fallos>=2;}).length;
  var mesMeta = _cmesFiltro || new Date().toISOString().slice(0,7);
  var totalLabel = _cmesFiltro ? 'Monitoreos ('+_cmesFiltro+')' : 'Monitoreos Totales (todos los meses)';

  var html =
    '<div class="aurora-kpi"><div class="kv">'+total+'</div><div class="kl">'+totalLabel+'</div></div>'+
    '<div class="aurora-kpi '+(promedio>=90?'kpi-green':promedio>=70?'kpi-org':'kpi-red')+'"><div class="kv">'+(total?promedio:'—')+'</div><div class="kl">Promedio Puntaje</div></div>'+
    '<div class="aurora-kpi kpi-red"><div class="kv">'+criticos+'</div><div class="kl">Monitoreos Criticos Absolutos</div></div>';

  if(currentUser && (currentUser.rol==='CALIDAD' || currentUser.rol==='SUPERVISOR')){
    var lideresList = calLideresCumplimiento(_ccampana, mesMeta);
    var mia = lideresList.find(function(l){ return l.liderNombre.trim().toLowerCase()===(currentUser.nombre||'').trim().toLowerCase(); });
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
        '<div class="qi-pill"><div class="qv" style="font-size:1rem">'+(row.liderNombre||'—')+'</div><div class="ql">LIDER RESPONSABLE</div></div>'+
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
      html += '<tr><td>'+u.nombre+' (@'+u.user+')</td><td>'+u.rol+'</td><td>'+(acceso?'✅ Si':'❌ No')+'</td><td>'+(u.active?'Activo':'Suspendido')+'</td></tr>';
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

function descargarReporteGeneral(){
  if(typeof loadCalData==='function') loadCalData();
  if(typeof XLSX==='undefined'){ showToast('No se pudo cargar el generador de Excel. Verifique su conexion a internet e intente de nuevo.'); return; }
  var mes = _cmesFiltro || new Date().toISOString().slice(0,7);
  var wb = XLSX.utils.book_new();
  var usedNames = {};
  CAMPANAS_CALIDAD.forEach(function(camp){
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
  });
  XLSX.writeFile(wb, 'Reporte_Cumplimiento_'+mes+'.xlsx');
  showToast('Reporte de '+mes+' descargado — una hoja completa por campana');
}

function closeSupervisionLider(){
  document.getElementById('supervisar-lider-overlay').classList.remove('show');
}
document.getElementById('supervisar-lider-overlay').addEventListener('click',function(e){ if(e.target===this) closeSupervisionLider(); });

function verSupervisionLider(camp, mes, liderNombre){
  var lideres = calLideresCumplimiento(camp, mes);
  var l = lideres.find(function(x){ return x.liderNombre===liderNombre; });
  if(!l){ showToast('No se encontraron datos para esta persona'); return; }
  document.getElementById('sl-sub-label').textContent = camp+' — '+mes;
  document.getElementById('sl-kpis').innerHTML =
    '<div class="aurora-kpi" style="grid-column:span 1"><div class="kv" style="font-size:1rem">'+l.liderNombre+'</div><div class="kl">Persona de Calidad / Supervisor</div></div>'+
    '<div class="aurora-kpi"><div class="kv">'+l.realizados+' / '+l.meta+'</div><div class="kl">Total Realizado / Meta</div></div>'+
    '<div class="aurora-kpi '+(l.pct>=100?'kpi-green':'kpi-org')+'"><div class="kv">'+l.pct+'%</div><div class="kl">% Cumplimiento Total</div></div>'+
    '<div class="aurora-kpi"><div class="kv">'+l.realizadosLlamada+' / '+l.metaLlamada+'</div><div class="kl">Llamada'+(l.pctLlamadaCompl!==null?' ('+l.pctLlamadaCompl+'%)':'')+'</div></div>'+
    (l.auditaWpp ? '<div class="aurora-kpi"><div class="kv">'+l.realizadosWpp+' / '+l.metaWpp+'</div><div class="kl">WhatsApp/Chat'+(l.pctWppCompl!==null?' ('+l.pctWppCompl+'%)':'')+'</div></div>' : '');

  var arr = (CAL_DB[camp] && CAL_DB[camp].monitoreos) || [];
  var misMon = arr.filter(function(m){
    return calMonthKey(m.fecha)===mes && (m.evaluador||'').trim().toLowerCase()===liderNombre.trim().toLowerCase();
  }).sort(function(a,b){ return (b.fecha||'').localeCompare(a.fecha||''); });
  var html = '<tr><th>Fecha</th><th>Asesor</th><th>Canal</th><th>Puntaje</th><th>Clasificacion</th><th>Nivel Critico</th></tr>';
  if(misMon.length===0){
    html += '<tr><td colspan="6" style="text-align:center;color:#7a9ba8">Sin monitoreos registrados este mes</td></tr>';
  } else {
    misMon.forEach(function(m){
      var canalLbl = m.canal==='WPP' ? '💬 WPP' : '📞 Llamada';
      html += '<tr><td>'+(m.fecha||'-')+'</td><td>'+m.asesor+'</td><td>'+canalLbl+'</td><td class="peak">'+m.puntaje+'</td><td>'+m.clasificacion+'</td><td>'+m.nivelCritico+'</td></tr>';
    });
  }
  document.getElementById('sl-monitoreos-table').innerHTML = html;
  document.getElementById('supervisar-lider-overlay').classList.add('show');
}

function renderCalReportes(){
  var allArr = CAL_DB[_ccampana].monitoreos;
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
      html += '<tr><td>'+l.liderNombre+'</td><td>'+l.meta+'</td><td>'+l.realizados+'</td><td class="'+(l.pct>=100?'peak':'')+'">'+l.pct+'%</td>'+
        '<td>'+l.metaLlamada+'</td><td>'+l.realizadosLlamada+(l.pctLlamadaCompl!==null?' ('+l.pctLlamadaCompl+'%)':'')+'</td>'+
        '<td>'+(l.auditaWpp?l.metaWpp:'-')+'</td><td>'+(l.auditaWpp?(l.realizadosWpp+(l.pctWppCompl!==null?' ('+l.pctWppCompl+'%)':'')):'-')+'</td>'+
        '<td><button class="btn-sm btn-edit" onclick="verSupervisionLider(\''+_ccampana+'\',\''+curMonth+'\',\''+l.liderNombre.replace(/'/g,"\\'")+'\')">Supervisar</button></td></tr>';
    });
  }
  document.getElementById('cal-cumplimiento-table').innerHTML = html;
}
