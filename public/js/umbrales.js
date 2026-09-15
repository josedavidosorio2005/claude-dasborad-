// umbrales.js — InConexion Platform.
// Se carga como <script src> global; funciones globales invocadas desde el HTML.
//
// ADMIN — UMBRALES DE SEMAFORO (color por dato en los dashboards de cliente).
// Mismo patron CRUD que metas.js/cronograma_metas: GET/POST/PUT/DELETE
// /api/umbrales, upsert por (metrica, campana) en el servidor. El motor de
// color que LEE estos umbrales vive en dashboard-generic.js (_gdSemaforoColor).

var _umbralesAll = [];       // todas las filas
var _editingUmbralId = null; // id en edicion, o null

async function renderUmbralesSection(){
  try{
    _umbralesAll = (await apiRequest('GET','/umbrales')) || [];
  }catch(e){ _umbralesAll = []; showToast('No se pudo cargar los umbrales: '+e.message); }

  var sel = document.getElementById('umbral-campana-sel');
  if(sel){
    var campanas = (typeof CAMPANAS_CON_PLANTILLA !== 'undefined' ? CAMPANAS_CON_PLANTILLA : []);
    sel.innerHTML = '<option value="">— Todas las campanas (default global) —</option>' +
      campanas.map(function(c){ return '<option value="'+esc(c)+'">'+esc(c)+'</option>'; }).join('');
  }

  previewUmbral();
  renderUmbralesTabla();
}

function _umbralColorFor(valor, verde, amarillo, direccion){
  if(valor===null || valor===undefined || isNaN(valor)) return null;
  var mayor = direccion !== 'menor_es_mejor';
  if(mayor) return valor >= verde ? 'verde' : (valor >= amarillo ? 'amarillo' : 'rojo');
  return valor <= verde ? 'verde' : (valor <= amarillo ? 'amarillo' : 'rojo');
}

function previewUmbral(){
  var pv = document.getElementById('umbral-preview');
  if(!pv) return;
  var verde = Number(document.getElementById('umbral-verde-input').value);
  var amarillo = Number(document.getElementById('umbral-amarillo-input').value);
  var direccion = document.getElementById('umbral-direccion-sel').value;
  if(isNaN(verde) || isNaN(amarillo)){ pv.innerHTML = ''; return; }
  var mayor = direccion !== 'menor_es_mejor';
  var ejemplos = mayor
    ? [verde, Math.round(((verde+amarillo)/2)*10)/10, Math.max(0, amarillo-1)]
    : [Math.max(0, verde-1), Math.round(((verde+amarillo)/2)*10)/10, amarillo+1];
  var COLORES = { verde:'#27ae60', amarillo:'#e67e22', rojo:'#e74c3c' };
  pv.innerHTML = ejemplos.map(function(v){
    var c = _umbralColorFor(v, verde, amarillo, direccion) || 'rojo';
    return '<span class="qi-pill" style="border-left:4px solid '+COLORES[c]+'"><span class="qv" style="color:'+COLORES[c]+'">'+v+'</span><span class="ql">'+c.toUpperCase()+'</span></span>';
  }).join(' ');
}

function renderUmbralesTabla(){
  var tbody = document.getElementById('umbrales-tbody');
  var noRes = document.getElementById('umbrales-no-results');
  if(!tbody) return;
  var rows = _umbralesAll.slice().sort(function(a,b){
    return a.metrica.localeCompare(b.metrica) || (a.campana||'').localeCompare(b.campana||'');
  });
  if(rows.length===0){
    tbody.innerHTML = '';
    if(noRes) noRes.classList.remove('hidden');
    return;
  }
  if(noRes) noRes.classList.add('hidden');
  tbody.innerHTML = rows.map(function(r){
    return '<tr><td>'+esc(r.metrica)+'</td><td>'+(r.campana ? esc(r.campana) : '<em>— Global —</em>')+'</td>'+
      '<td>'+r.verde+'</td><td>'+r.amarillo+'</td><td>'+esc(r.direccion)+'</td>'+
      '<td><button class="btn-sm btn-edit" onclick="editUmbral('+r.id+')">Editar</button> '+
      '<button class="btn-sm btn-delete" onclick="deleteUmbral('+r.id+')">Eliminar</button></td></tr>';
  }).join('');
}

function editUmbral(id){
  if(!isFullAdmin()){ showToast('Solo el administrador puede editar umbrales'); return; }
  var row = _umbralesAll.find(function(r){ return r.id===id; });
  if(!row){ showToast('No se encontro el umbral a editar'); return; }
  _editingUmbralId = id;
  document.getElementById('umbral-metrica-input').value = row.metrica;
  document.getElementById('umbral-campana-sel').value = row.campana || '';
  document.getElementById('umbral-verde-input').value = row.verde;
  document.getElementById('umbral-amarillo-input').value = row.amarillo;
  document.getElementById('umbral-direccion-sel').value = row.direccion;
  document.getElementById('umbral-form-title').textContent = 'Editando umbral: '+row.metrica+(row.campana ? ' ('+row.campana+')' : ' (global)');
  document.getElementById('umbral-cancel-btn').classList.remove('hidden');
  previewUmbral();
  showToast('Editando umbral de '+row.metrica+' — modifique y presione Guardar');
}

function cancelEditUmbral(){
  _editingUmbralId = null;
  document.getElementById('umbral-metrica-input').value = '';
  document.getElementById('umbral-campana-sel').value = '';
  document.getElementById('umbral-verde-input').value = '';
  document.getElementById('umbral-amarillo-input').value = '';
  document.getElementById('umbral-direccion-sel').value = 'mayor_es_mejor';
  document.getElementById('umbral-form-title').textContent = 'Nuevo umbral';
  document.getElementById('umbral-cancel-btn').classList.add('hidden');
  previewUmbral();
}

async function saveUmbral(){
  if(!isFullAdmin()){ showToast('Solo el administrador puede configurar umbrales'); return; }
  var metrica = document.getElementById('umbral-metrica-input').value.trim();
  var campana = document.getElementById('umbral-campana-sel').value;
  var verde = Number(document.getElementById('umbral-verde-input').value);
  var amarillo = Number(document.getElementById('umbral-amarillo-input').value);
  var direccion = document.getElementById('umbral-direccion-sel').value;
  if(!metrica){ showToast('Ingrese el identificador de la metrica'); return; }
  if(isNaN(verde) || isNaN(amarillo)){ showToast('Ingrese los valores verde y amarillo'); return; }

  var body = { metrica: metrica, campana: campana, verde: verde, amarillo: amarillo, direccion: direccion };
  var btn = document.querySelector('#section-umbrales .btn-primary');
  try{
    await withButtonLoading(btn, 'Guardando...', async function(){
      if(_editingUmbralId && !_umbralMovio(metrica, campana)){
        await apiRequest('PUT','/umbrales/'+_editingUmbralId, body);
      } else {
        // POST hace upsert por (metrica, campana); si cambio de clave al
        // editar, borramos la fila original para no dejar un duplicado.
        if(_editingUmbralId){ try{ await apiRequest('DELETE','/umbrales/'+_editingUmbralId); }catch(e){} }
        await apiRequest('POST','/umbrales', body);
      }
    });
  }catch(e){ showToast(e.message); return; }
  showToast((_editingUmbralId?'Umbral actualizado: ':'Umbral guardado: ')+metrica);
  cancelEditUmbral();
  await renderUmbralesSection();
}

function _umbralMovio(metrica, campana){
  var orig = _umbralesAll.find(function(r){ return r.id===_editingUmbralId; });
  if(!orig) return true;
  return orig.metrica!==metrica || (orig.campana||'')!==(campana||'');
}

async function deleteUmbral(id){
  if(!isFullAdmin()){ showToast('Solo el administrador puede eliminar umbrales'); return; }
  if(!confirm('Eliminar este umbral? Los KPI que lo usaban quedaran sin color hasta que se configure otro.')) return;
  try{
    await apiRequest('DELETE','/umbrales/'+id);
  }catch(e){ showToast(e.message); return; }
  if(_editingUmbralId===id) cancelEditUmbral();
  await renderUmbralesSection();
}
