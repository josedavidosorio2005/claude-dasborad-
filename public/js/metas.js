// metas.js — InConexion Platform. Extraído de index.html (antes un único <script>).
// Se carga como <script src> global y en orden; todas las funciones son globales
// y se invocan desde manejadores del HTML. No cambiar el orden de carga.

// ═══════════════════════════════════════════════════════════
// ADMIN — METAS DE CALIDAD (por campana, por mes, con historial)
// ═══════════════════════════════════════════════════════════
function renderMetasSection(){
  if(typeof loadCalData==='function') loadCalData();
  var sel = document.getElementById('meta-campana-sel');
  sel.innerHTML = CAMPANAS_CALIDAD.map(function(c){ return '<option value="'+c+'">'+c+'</option>'; }).join('');
  var monthInput = document.getElementById('meta-mes-input');
  if(!monthInput.value) monthInput.value = new Date().toISOString().slice(0,7);
  populateMetaLiderSelect();
  var mesFilter = document.getElementById('metas-mes-filter');
  var meses = [];
  CAMPANAS_CALIDAD.forEach(function(c){
    var cron = (CAL_DB[c] && CAL_DB[c].config.cronograma) || {};
    Object.keys(cron).forEach(function(m){ if(meses.indexOf(m)===-1) meses.push(m); });
  });
  meses.sort().reverse();
  mesFilter.innerHTML = '<option value="">Todos los meses</option>' + meses.map(function(m){ return '<option value="'+m+'">'+m+'</option>'; }).join('');
  previewMetaCalc();
  renderMetasHistory();
}

// Solo usuarios con rol CALIDAD o SUPERVISOR, activos, con acceso a la campana seleccionada.
// Esto asegura la trazabilidad: cada meta queda ligada a una cuenta real, no a un nombre escrito a mano.
function populateMetaLiderSelect(){
  var camp = document.getElementById('meta-campana-sel').value;
  var sel = document.getElementById('meta-lider-input');
  if(!sel) return;
  var candidatos = users.filter(function(u){
    return (u.rol==='CALIDAD' || u.rol==='SUPERVISOR') && u.active && u.perms['campana_'+camp]===true;
  }).sort(function(a,b){ return a.nombre.localeCompare(b.nombre); });
  if(candidatos.length===0){
    sel.innerHTML = '<option value="">— Sin usuarios de Calidad/Supervisor con acceso a esta campana —</option>';
  } else {
    sel.innerHTML = '<option value="">Seleccione un responsable...</option>' +
      candidatos.map(function(u){ return '<option value="'+u.id+'">'+u.nombre+' ('+u.rol+')</option>'; }).join('');
  }
}

function previewMetaCalc(){
  var metaGrupal = Number(document.getElementById('meta-valor-input').value)||0;
  var asesores = Number(document.getElementById('meta-asesores-input').value)||1;
  var dias = Number(document.getElementById('meta-dias-input').value)||19;
  var row = calBuildCronogramaRow(null, '', metaGrupal, asesores, dias, false, 0);
  var pv = document.getElementById('meta-preview');
  if(!pv) return;
  pv.innerHTML =
    '<div class="qi-pill"><div class="qv">'+row.metaPorAsesor+'</div><div class="ql">META MES / ASESOR</div></div>'+
    '<div class="qi-pill"><div class="qv">'+row.metaDiaria+'</div><div class="ql">META DIARIA LIDER/AUX</div></div>'+
    '<div class="qi-pill"><div class="qv">'+row.semana1+'</div><div class="ql">META SEMANA 1</div></div>'+
    '<div class="qi-pill"><div class="qv">'+row.semana2+'</div><div class="ql">META SEMANA 2</div></div>'+
    '<div class="qi-pill"><div class="qv">'+row.semana3+'</div><div class="ql">META SEMANA 3</div></div>'+
    '<div class="qi-pill"><div class="qv">'+row.semana4+'</div><div class="ql">META SEMANA 4</div></div>';
}
function renderMetasHistory(){
  var filter = document.getElementById('metas-mes-filter').value;
  var rows = [];
  CAMPANAS_CALIDAD.forEach(function(c){
    var cron = (CAL_DB[c] && CAL_DB[c].config.cronograma) || {};
    Object.keys(cron).forEach(function(m){
      if(filter && m!==filter) return;
      var arr = Array.isArray(cron[m]) ? cron[m] : [];
      arr.forEach(function(r){ rows.push(Object.assign({campana:c, mes:m}, r)); });
    });
  });
  rows.sort(function(a,b){ return b.mes.localeCompare(a.mes) || a.campana.localeCompare(b.campana) || (a.liderNombre||'').localeCompare(b.liderNombre||''); });
  var tbody = document.getElementById('metas-history-tbody');
  var noRes = document.getElementById('metas-no-results');
  if(rows.length===0){
    tbody.innerHTML='';
    noRes.classList.remove('hidden');
    return;
  }
  noRes.classList.add('hidden');
  tbody.innerHTML = rows.map(function(r){
    return '<tr><td>'+(r.liderNombre||'Sin asignar')+'</td><td>'+r.campana+'</td><td>'+r.mes+'</td><td>'+r.asesores+'</td><td>'+r.diasLaborales+'</td>'+
      '<td class="peak">'+r.metaGrupal+'</td><td>'+r.metaPorAsesor+'</td><td>'+r.metaDiaria+'</td>'+
      '<td>'+r.semana1+'</td><td>'+r.semana2+'</td><td>'+r.semana3+'</td><td>'+r.semana4+'</td>'+
      '<td>'+(r.whatsapp?'SI':'NO')+'</td><td>'+(r.whatsapp? (r.pctWhatsapp+'%') : '-')+'</td>'+
      '<td><button class="btn-sm btn-edit" onclick="editMetaMes(\''+r.campana+'\',\''+r.mes+'\',\''+r.liderId+'\')">Editar</button> '+
      '<button class="btn-sm btn-delete" onclick="deleteMetaMes(\''+r.campana+'\',\''+r.mes+'\',\''+r.liderId+'\')">Eliminar</button></td></tr>';
  }).join('');
}
var _editingMeta = null; // {camp, mes, liderId} cuando se esta editando una meta existente

function editMetaMes(camp, mes, liderId){
  if(!isFullAdmin()){ showToast('Solo el administrador puede editar el cronograma'); return; }
  var cron = CAL_DB[camp] && CAL_DB[camp].config.cronograma;
  var row = cron && Array.isArray(cron[mes]) ? cron[mes].find(function(r){ return String(r.liderId)===String(liderId); }) : null;
  if(!row){ showToast('No se encontro la meta a editar'); return; }
  _editingMeta = {camp:camp, mes:mes, liderId:liderId};
  document.getElementById('meta-campana-sel').value = camp;
  populateMetaLiderSelect();
  document.getElementById('meta-lider-input').value = liderId;
  document.getElementById('meta-mes-input').value = mes;
  document.getElementById('meta-asesores-input').value = row.asesores;
  document.getElementById('meta-dias-input').value = row.diasLaborales;
  document.getElementById('meta-valor-input').value = row.metaGrupal;
  document.getElementById('meta-whatsapp-sel').value = row.whatsapp ? 'SI' : 'NO';
  document.getElementById('meta-pctwpp-input').value = row.pctWhatsapp;
  previewMetaCalc();
  showToast('Editando meta de '+row.liderNombre+' ('+mes+') — modifique y presione Guardar');
}

function saveMetaMes(){
  if(!isFullAdmin()){ showToast('Solo el administrador puede configurar el cronograma'); return; }
  var camp = document.getElementById('meta-campana-sel').value;
  var mes = document.getElementById('meta-mes-input').value;
  var liderId = document.getElementById('meta-lider-input').value;
  var asesores = parseInt(document.getElementById('meta-asesores-input').value,10);
  var dias = parseInt(document.getElementById('meta-dias-input').value,10);
  var metaGrupal = parseInt(document.getElementById('meta-valor-input').value,10);
  var whatsapp = document.getElementById('meta-whatsapp-sel').value==='SI';
  var pctWhatsapp = parseInt(document.getElementById('meta-pctwpp-input').value,10)||0;
  if(!mes){ showToast('Seleccione el mes'); return; }
  if(!liderId){ showToast('Seleccione el lider responsable / persona a cargo'); return; }
  if(!metaGrupal || metaGrupal<1){ showToast('Ingrese una meta valida'); return; }
  if(!asesores || asesores<1){ showToast('Ingrese la cantidad de asesores'); return; }
  if(!dias || dias<1){ showToast('Ingrese los dias laborales del mes'); return; }
  var liderUser = users.find(function(u){ return String(u.id)===String(liderId); });
  if(!liderUser){ showToast('Usuario responsable no encontrado'); return; }
  // si veniamos editando y el mes/campana/lider cambiaron, quitar la fila original de su ubicacion previa
  if(_editingMeta && (_editingMeta.camp!==camp || _editingMeta.mes!==mes || String(_editingMeta.liderId)!==String(liderId))){
    var oldCron = CAL_DB[_editingMeta.camp] && CAL_DB[_editingMeta.camp].config.cronograma;
    if(oldCron && Array.isArray(oldCron[_editingMeta.mes])){
      oldCron[_editingMeta.mes] = oldCron[_editingMeta.mes].filter(function(r){ return String(r.liderId)!==String(_editingMeta.liderId); });
    }
  }
  if(!CAL_DB[camp]) CAL_DB[camp] = {monitoreos:[], config:{cronograma:{}}};
  if(!CAL_DB[camp].config.cronograma) CAL_DB[camp].config.cronograma = {};
  if(!Array.isArray(CAL_DB[camp].config.cronograma[mes])) CAL_DB[camp].config.cronograma[mes] = [];
  var arr = CAL_DB[camp].config.cronograma[mes];
  var newRow = calBuildCronogramaRow(liderId, liderUser.nombre, metaGrupal, asesores, dias, whatsapp, pctWhatsapp);
  var idx = arr.findIndex(function(r){ return String(r.liderId)===String(liderId); });
  if(idx>=0) arr[idx]=newRow; else arr.push(newRow);
  saveCalData();
  showToast((_editingMeta?'Meta actualizada para ':'Meta individual guardada para ')+liderUser.nombre+' — '+camp+' — '+mes);
  _editingMeta = null;
  renderMetasSection();
}
function deleteMetaMes(camp, mes, liderId){
  if(!isFullAdmin()){ showToast('Solo el administrador puede eliminar del cronograma'); return; }
  if(!confirm('Eliminar esta meta individual?')) return;
  var cron = CAL_DB[camp] && CAL_DB[camp].config.cronograma;
  if(cron && Array.isArray(cron[mes])){
    cron[mes] = cron[mes].filter(function(r){ return String(r.liderId)!==String(liderId); });
  }
  if(_editingMeta && _editingMeta.camp===camp && _editingMeta.mes===mes && String(_editingMeta.liderId)===String(liderId)) _editingMeta = null;
  saveCalData();
  renderMetasSection();
}
