// metas.js — InConexion Platform.
// Se carga como <script src> global y en orden; todas las funciones son globales
// y se invocan desde manejadores del HTML. No cambiar el orden de carga.
//
// MIGRADO A SERVIDOR (REAL_DATA_REPORT.md, Fase 1): el cronograma de metas vive
// en la tabla cronograma_metas. Endpoints: GET/POST/PUT/DELETE /api/metas.
// El servidor recalcula meta por asesor / diaria / semanales al guardar.

// ═══════════════════════════════════════════════════════════
// ADMIN — CRONOGRAMA Y METAS DE MONITOREO (por campana, por mes, por lider)
// ═══════════════════════════════════════════════════════════
var _metasAll = [];              // todas las filas de cronograma (todas las campanas)
var _editingMetaId = null;       // id de la fila que se esta editando, o null

async function renderMetasSection(){
  await calLoadPlantillas();
  try{
    _metasAll = (await apiRequest('GET','/metas')) || [];
  }catch(e){ _metasAll = []; showToast('No se pudo cargar el cronograma: '+e.message); }

  var sel = document.getElementById('meta-campana-sel');
  sel.innerHTML = CAMPANAS_CON_PLANTILLA.map(function(c){ return '<option value="'+c+'">'+c+'</option>'; }).join('');
  var monthInput = document.getElementById('meta-mes-input');
  if(!monthInput.value) monthInput.value = new Date().toISOString().slice(0,7);
  populateMetaLiderSelect();

  var mesFilter = document.getElementById('metas-mes-filter');
  var meses = [];
  _metasAll.forEach(function(r){ if(meses.indexOf(r.mes)===-1) meses.push(r.mes); });
  meses.sort().reverse();
  var prev = mesFilter.value;
  mesFilter.innerHTML = '<option value="">Todos los meses</option>' + meses.map(function(m){ return '<option value="'+m+'">'+m+'</option>'; }).join('');
  if(prev && meses.indexOf(prev)!==-1) mesFilter.value = prev;

  previewMetaCalc();
  renderMetasHistory();
}

// Solo usuarios con rol CALIDAD o SUPERVISOR, activos, con acceso a la campana seleccionada.
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
  var rows = _metasAll.filter(function(r){ return !filter || r.mes===filter; });
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
      '<td><button class="btn-sm btn-edit" onclick="editMetaMes('+r.id+')">Editar</button> '+
      '<button class="btn-sm btn-delete" onclick="deleteMetaMes('+r.id+')">Eliminar</button></td></tr>';
  }).join('');
}

function editMetaMes(id){
  if(!isFullAdmin()){ showToast('Solo el administrador puede editar el cronograma'); return; }
  var row = _metasAll.find(function(r){ return r.id===id; });
  if(!row){ showToast('No se encontro la meta a editar'); return; }
  _editingMetaId = id;
  document.getElementById('meta-campana-sel').value = row.campana;
  populateMetaLiderSelect();
  document.getElementById('meta-lider-input').value = row.liderId;
  document.getElementById('meta-mes-input').value = row.mes;
  document.getElementById('meta-asesores-input').value = row.asesores;
  document.getElementById('meta-dias-input').value = row.diasLaborales;
  document.getElementById('meta-valor-input').value = row.metaGrupal;
  document.getElementById('meta-whatsapp-sel').value = row.whatsapp ? 'SI' : 'NO';
  document.getElementById('meta-pctwpp-input').value = row.pctWhatsapp;
  previewMetaCalc();
  showToast('Editando meta de '+row.liderNombre+' ('+row.mes+') — modifique y presione Guardar');
}

async function saveMetaMes(){
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

  var body = {
    campana: camp, mes: mes, liderId: parseInt(liderId,10),
    metaGrupal: metaGrupal, asesores: asesores, diasLaborales: dias,
    whatsapp: whatsapp, pctWhatsapp: pctWhatsapp
  };
  var btn = document.querySelector('#section-metas .btn-primary');
  try{
    await withButtonLoading(btn, 'Guardando...', async function(){
      if(_editingMetaId && !_metaMovio(camp, mes, parseInt(liderId,10))){
        await apiRequest('PUT','/metas/'+_editingMetaId, body);
      } else {
        // POST hace upsert por (campana, mes, liderId); si se movio de celda,
        // borramos la fila original para no dejar un duplicado huerfano.
        if(_editingMetaId) { try{ await apiRequest('DELETE','/metas/'+_editingMetaId); }catch(e){} }
        await apiRequest('POST','/metas', body);
      }
    });
  }catch(e){ showToast(e.message); return; }
  showToast((_editingMetaId?'Meta actualizada para ':'Meta individual guardada para ')+' '+camp+' — '+mes);
  _editingMetaId = null;
  await renderMetasSection();
}

// true si al editar cambiaron campana/mes/lider (la fila "se movio de celda")
function _metaMovio(camp, mes, liderId){
  var orig = _metasAll.find(function(r){ return r.id===_editingMetaId; });
  if(!orig) return true;
  return orig.campana!==camp || orig.mes!==mes || String(orig.liderId)!==String(liderId);
}

async function deleteMetaMes(id){
  if(!isFullAdmin()){ showToast('Solo el administrador puede eliminar del cronograma'); return; }
  if(!confirm('Eliminar esta meta individual?')) return;
  try{
    await apiRequest('DELETE','/metas/'+id);
  }catch(e){ showToast(e.message); return; }
  if(_editingMetaId===id) _editingMetaId = null;
  await renderMetasSection();
}
