// gerencia.js — InConexion Platform. Modulo de Gerencia (indicadores ejecutivos).
// Se carga como <script src> global y en orden; todas las funciones son globales.
// KPIs cargados desde Excel o creados manualmente. Backend: /api/gerencia/*.

var _gerKpis = [];
var _gerPeriodos = [];
var _gerPeriodoSel = '';
var _gerResumen = null;
var _gerTab = 'panel';
var _gerEditId = null;

// Gerencia es SOLO LECTURA (feedback Edwin 2.2): crear/editar/borrar/cargar KPIs
// exige el permiso "Cargar Datos". El backend responde 403; aqui ocultamos las
// acciones de escritura para el rol GERENCIA puro.
function _gerCanWrite(){ return typeof canLoadData === 'function' ? canLoadData() : (typeof isFullAdmin === 'function' && isFullAdmin()); }
function _gerApplyWritePerm(){
  var show = _gerCanWrite();
  document.querySelectorAll('.ger-write-only').forEach(function(el){ el.style.display = show ? '' : 'none'; });
}

// ═══════════════════════════════════════════════════════════
// APERTURA / CIERRE
// ═══════════════════════════════════════════════════════════
async function openGerencia(){
  if(!(isFullAdmin() || (currentUser && currentUser.perms && currentUser.perms.Gerencia))){
    showToast('No tienes acceso al modulo de Gerencia'); return;
  }
  document.getElementById('gerencia-overlay').classList.add('show');
  await loadGerData();
  renderGerPeriodos();
  renderGerPanel();
  _gerApplyWritePerm();
}
function closeGerencia(){
  document.getElementById('gerencia-overlay').classList.remove('show');
}
document.getElementById('gerencia-overlay').addEventListener('click',function(e){ if(e.target===this) closeGerencia(); });

// ═══════════════════════════════════════════════════════════
// CARGA DE DATOS
// ═══════════════════════════════════════════════════════════
async function loadGerData(){
  try{
    _gerPeriodos = (await apiRequest('GET','/gerencia/periodos')) || [];
  }catch(e){ _gerPeriodos = []; }
  if(!_gerPeriodoSel && _gerPeriodos.length > 0) _gerPeriodoSel = _gerPeriodos[0];
  if(!_gerPeriodoSel) _gerPeriodoSel = new Date().toISOString().slice(0,7);
  try{
    _gerResumen = await apiRequest('GET','/gerencia/resumen?periodo='+encodeURIComponent(_gerPeriodoSel));
  }catch(e){ _gerResumen = null; }
  _gerKpis = (_gerResumen && _gerResumen.kpis) || [];
}

// ═══════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════
function switchGerTab(t){
  _gerTab = t;
  document.querySelectorAll('#gerencia-modal .atab').forEach(function(el){ el.classList.toggle('atab-active', el.dataset.ctab===t); });
  document.querySelectorAll('#gerencia-modal .atab-panel').forEach(function(el){ el.classList.toggle('visible', el.id==='ger-panel-'+t); });
  if(t==='panel') renderGerPanel();
  else if(t==='tabla') renderGerTabla();
  else if(t==='carga') renderGerCargaInfo();
}

// ═══════════════════════════════════════════════════════════
// PERIODO SELECTOR
// ═══════════════════════════════════════════════════════════
function renderGerPeriodos(){
  var sel = document.getElementById('ger-periodo-sel');
  var html = _gerPeriodos.map(function(p){
    return '<option value="'+p+'"'+(p===_gerPeriodoSel?' selected':'')+'>'+p+'</option>';
  }).join('');
  if(_gerPeriodos.indexOf(_gerPeriodoSel)===-1){
    html = '<option value="'+_gerPeriodoSel+'" selected>'+_gerPeriodoSel+'</option>' + html;
  }
  sel.innerHTML = html;
}

async function onGerPeriodoChange(){
  _gerPeriodoSel = document.getElementById('ger-periodo-sel').value;
  await loadGerData();
  renderGerPanel();
  if(_gerTab==='tabla') renderGerTabla();
}

// ═══════════════════════════════════════════════════════════
// PANEL KPIs
// ═══════════════════════════════════════════════════════════
function renderGerPanel(){
  var cats = _gerResumen ? _gerResumen.porCategoria : {};
  var catNames = Object.keys(cats || {}).sort();

  // KPIs strip
  var html = '';
  if(_gerKpis.length === 0){
    html = '<div class="aurora-kpi"><div class="kv" style="font-size:0.9rem">Sin indicadores para '+_gerPeriodoSel+'</div><div class="kl">Carga datos desde Excel o crea KPIs individualmente</div></div>';
  } else {
    html += '<div class="aurora-kpi"><div class="kv">'+_gerKpis.length+'</div><div class="kl">Indicadores ('+_gerPeriodoSel+')</div></div>';
    var conMeta = _gerKpis.filter(function(k){ return k.meta !== null && k.meta !== undefined; });
    if(conMeta.length > 0){
      var cumpleMeta = conMeta.filter(function(k){ return k.valor >= k.meta; }).length;
      html += '<div class="aurora-kpi '+(cumpleMeta===conMeta.length?'kpi-green':'kpi-org')+'"><div class="kv">'+cumpleMeta+'/'+conMeta.length+'</div><div class="kl">Cumplen Meta</div></div>';
    }
    html += '<div class="aurora-kpi kpi-pur"><div class="kv">'+catNames.length+'</div><div class="kl">Categorias</div></div>';
  }
  document.getElementById('ger-kpis').innerHTML = html;

  // Paneles por categoria
  var panelsHtml = '';
  if(catNames.length === 0){
    panelsHtml = '<div class="aurora-card"><div class="aurora-card-title">Sin datos para este periodo</div><p style="color:#7a9ba8;font-size:0.85rem">Sube un Excel con los indicadores del mes o crea KPIs individualmente.</p></div>';
  } else {
    catNames.forEach(function(cat){
      var kpis = cats[cat] || [];
      panelsHtml += '<div class="aurora-card"><div class="aurora-card-title">'+esc(cat)+'</div>';
      panelsHtml += '<div class="aurora-kpis" style="margin-top:8px">';
      kpis.forEach(function(k){
        var cls = '';
        if(k.meta !== null && k.meta !== undefined){
          cls = k.valor >= k.meta ? 'kpi-green' : (k.valor >= k.meta * 0.8 ? 'kpi-org' : 'kpi-red');
        }
        var valFmt = k.unidad === '%' ? (Math.round(k.valor * 100) / 100) + '%' :
                     k.unidad === 'USD' ? '$' + Number(k.valor).toLocaleString('es-CO') :
                     (Math.round(k.valor * 100) / 100).toLocaleString('es-CO');
        var metaTxt = (k.meta !== null && k.meta !== undefined) ?
          '<div style="font-size:0.72rem;color:#7a9ba8;margin-top:2px">Meta: '+(k.unidad==='%'?k.meta+'%':k.unidad==='USD'?'$'+k.meta.toLocaleString('es-CO'):k.meta.toLocaleString('es-CO'))+'</div>' : '';
        panelsHtml += '<div class="aurora-kpi '+cls+'"><div class="kv">'+valFmt+'</div><div class="kl">'+esc(k.nombre)+(k.unidad?' ('+esc(k.unidad)+')':'')+'</div>'+metaTxt+'</div>';
      });
      panelsHtml += '</div></div>';
    });
  }
  document.getElementById('ger-panels').innerHTML = panelsHtml;
}

// ═══════════════════════════════════════════════════════════
// TABLA DETALLADA
// ═══════════════════════════════════════════════════════════
function renderGerTabla(){
  var html = '<tr><th>Nombre</th><th>Categoria</th><th>Valor</th><th>Unidad</th><th>Meta</th><th>Cumple</th><th>Observaciones</th><th></th></tr>';
  if(_gerKpis.length === 0){
    html += '<tr><td colspan="8" style="text-align:center;color:#7a9ba8">No hay indicadores para '+_gerPeriodoSel+'</td></tr>';
  } else {
    _gerKpis.forEach(function(k){
      var valFmt = k.unidad === '%' ? (Math.round(k.valor * 100) / 100) + '%' :
                   k.unidad === 'USD' ? '$' + Number(k.valor).toLocaleString('es-CO') :
                   (Math.round(k.valor * 100) / 100).toLocaleString('es-CO');
      var metaFmt = '-';
      var cumple = '-';
      if(k.meta !== null && k.meta !== undefined){
        metaFmt = k.unidad === '%' ? k.meta+'%' : k.unidad === 'USD' ? '$'+k.meta.toLocaleString('es-CO') : k.meta.toLocaleString('es-CO');
        cumple = k.valor >= k.meta ? '<span class="kpi-green" style="font-weight:600">Si</span>' : '<span class="kpi-red" style="font-weight:600">No</span>';
      }
      var acc = _gerCanWrite()
        ? '<button class="btn-sm btn-edit" onclick="gerEditarKpi('+k.id+')">Editar</button> <button class="btn-sm btn-delete" onclick="gerEliminarKpi('+k.id+')">Eliminar</button>'
        : '';
      html += '<tr><td><strong>'+esc(k.nombre)+'</strong></td><td>'+esc(k.categoria)+'</td><td class="peak">'+valFmt+'</td><td>'+esc(k.unidad||'-')+'</td><td>'+metaFmt+'</td><td>'+cumple+'</td><td>'+esc(k.observaciones||'-')+'</td>'+
        '<td>'+acc+'</td></tr>';
    });
  }
  document.getElementById('ger-tabla').innerHTML = html;
}

// ═══════════════════════════════════════════════════════════
// CRUD KPIs
// ═══════════════════════════════════════════════════════════
function gerNuevoKpi(){
  _gerEditId = null;
  document.getElementById('ger-kpi-modal-title').textContent = 'Nuevo Indicador';
  document.getElementById('ger-kpi-nombre').value = '';
  document.getElementById('ger-kpi-categoria').value = 'General';
  document.getElementById('ger-kpi-valor').value = '';
  document.getElementById('ger-kpi-unidad').value = '';
  document.getElementById('ger-kpi-meta').value = '';
  document.getElementById('ger-kpi-obs').value = '';
  document.getElementById('ger-kpi-modal').classList.add('show');
}

function gerEditarKpi(id){
  var k = _gerKpis.find(function(x){return x.id===id;});
  if(!k){ showToast('KPI no encontrado'); return; }
  _gerEditId = id;
  document.getElementById('ger-kpi-modal-title').textContent = 'Editar Indicador';
  document.getElementById('ger-kpi-nombre').value = k.nombre;
  document.getElementById('ger-kpi-categoria').value = k.categoria;
  document.getElementById('ger-kpi-valor').value = k.valor;
  document.getElementById('ger-kpi-unidad').value = k.unidad;
  document.getElementById('ger-kpi-meta').value = (k.meta !== null && k.meta !== undefined) ? k.meta : '';
  document.getElementById('ger-kpi-obs').value = k.observaciones;
  document.getElementById('ger-kpi-modal').classList.add('show');
}

function closeGerKpiModal(){ document.getElementById('ger-kpi-modal').classList.remove('show'); }

async function gerGuardarKpi(){
  var metaVal = document.getElementById('ger-kpi-meta').value.trim();
  var body = {
    periodo: _gerPeriodoSel,
    nombre: document.getElementById('ger-kpi-nombre').value.trim(),
    categoria: document.getElementById('ger-kpi-categoria').value.trim() || 'General',
    valor: parseFloat(document.getElementById('ger-kpi-valor').value) || 0,
    unidad: document.getElementById('ger-kpi-unidad').value.trim(),
    meta: metaVal !== '' ? parseFloat(metaVal) : null,
    observaciones: document.getElementById('ger-kpi-obs').value.trim()
  };
  if(!body.nombre){ showToast('El nombre del indicador es obligatorio'); return; }
  var btn = document.querySelector('#ger-kpi-modal .btn-primary');
  try{
    await withButtonLoading(btn, 'Guardando...', async function(){
      if(_gerEditId){
        await apiRequest('PUT','/gerencia/kpis/'+_gerEditId, body);
      } else {
        await apiRequest('POST','/gerencia/kpis', body);
      }
    });
  }catch(e){ showToast(e.message); return; }
  showToast(_gerEditId ? 'Indicador actualizado' : 'Indicador creado');
  closeGerKpiModal();
  await loadGerData();
  renderGerPeriodos();
  renderGerPanel();
  if(_gerTab==='tabla') renderGerTabla();
}

async function gerEliminarKpi(id){
  var k = _gerKpis.find(function(x){return x.id===id;});
  if(!k) return;
  if(!confirm('Eliminar el indicador "'+k.nombre+'" de '+k.periodo+'?')) return;
  try{ await apiRequest('DELETE','/gerencia/kpis/'+id); }
  catch(e){ showToast(e.message); return; }
  showToast('Indicador eliminado');
  await loadGerData();
  renderGerPanel();
  if(_gerTab==='tabla') renderGerTabla();
}

// ═══════════════════════════════════════════════════════════
// CARGA MASIVA DESDE EXCEL
// ═══════════════════════════════════════════════════════════
function renderGerCargaInfo(){
  document.getElementById('ger-carga-status').innerHTML =
    '<div class="aurora-kpi"><div class="kv">'+_gerPeriodos.length+'</div><div class="kl">Periodos con datos</div></div>'+
    '<div class="aurora-kpi kpi-pur"><div class="kv">'+_gerKpis.length+'</div><div class="kl">Indicadores en '+_gerPeriodoSel+'</div></div>';
}

function gerDescargarPlantilla(){
  if(typeof XLSX==='undefined'){ showToast('No se pudo cargar el generador de Excel.'); return; }
  var aoa = [['Nombre','Categoria','Valor','Unidad','Meta','Observaciones'],
    ['Nivel de atencion promedio','Operaciones',92.5,'%',90,''],
    ['AHT promedio','Operaciones',420,'segundos',360,''],
    ['Satisfaccion del cliente','Calidad',4.6,'',4.5,'Escala 1-5'],
    ['Costo por llamada','Financiero',2.50,'USD',3.00,''],
    ['Productividad por asesor','Productividad',85,'%',80,''],
    ['Inasistencia promedio','Talento Humano',8,'%',10,'']];
  var ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{wch:30},{wch:18},{wch:10},{wch:12},{wch:10},{wch:25}];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'KPIs');
  XLSX.writeFile(wb, 'plantilla_gerencia_'+_gerPeriodoSel+'.xlsx');
  showToast('Plantilla descargada para '+_gerPeriodoSel);
}

async function gerProcesarArchivo(input){
  var file = input.files && input.files[0];
  if(!file) return;
  if(typeof XLSX==='undefined'){ showToast('No se pudo cargar la libreria de Excel.'); return; }
  var buf = await file.arrayBuffer();
  var wb = XLSX.read(buf, {type:'array'});
  var ws = wb.Sheets[wb.SheetNames[0]];
  var data = XLSX.utils.sheet_to_json(ws);
  if(data.length === 0){ showToast('El archivo no tiene datos'); input.value=''; return; }

  var kpis = data.map(function(row){
    return {
      nombre: String(row['Nombre']||row['nombre']||'').trim(),
      categoria: String(row['Categoria']||row['categoria']||'General').trim(),
      valor: parseFloat(row['Valor']||row['valor']||0) || 0,
      unidad: String(row['Unidad']||row['unidad']||'').trim(),
      meta: (row['Meta']!==undefined && row['Meta']!=='' && row['Meta']!==null) ? parseFloat(row['Meta']) || null : null,
      observaciones: String(row['Observaciones']||row['observaciones']||'').trim()
    };
  }).filter(function(k){ return k.nombre; });

  if(kpis.length === 0){ showToast('No se encontraron indicadores con nombre valido'); input.value=''; return; }

  var btn = document.getElementById('ger-cargar-btn');
  try{
    await withButtonLoading(btn, 'Cargando '+kpis.length+' indicadores...', async function(){
      await apiRequest('POST','/gerencia/carga', { periodo: _gerPeriodoSel, kpis: kpis });
    });
  }catch(e){ showToast(e.message); input.value=''; return; }
  showToast(kpis.length+' indicadores cargados para '+_gerPeriodoSel);
  input.value = '';
  await loadGerData();
  renderGerPeriodos();
  renderGerPanel();
  if(_gerTab==='tabla') renderGerTabla();
}

// ═══════════════════════════════════════════════════════════
// ADMIN SECTION (sidebar en panel admin)
// ═══════════════════════════════════════════════════════════
async function renderGerenciaSection(){
  await loadGerData();
  renderGerAdminStats();
  renderGerAdminTabla();
  _gerApplyWritePerm();
}

function renderGerAdminStats(){
  var html = '<div class="stat-card"><div class="stat-num">'+_gerPeriodos.length+'</div><div class="stat-label">Periodos</div></div>'+
    '<div class="stat-card" style="border-left-color:#8e44ad"><div class="stat-num">'+_gerKpis.length+'</div><div class="stat-label">Indicadores ('+_gerPeriodoSel+')</div></div>';
  var conMeta = _gerKpis.filter(function(k){ return k.meta !== null && k.meta !== undefined; });
  if(conMeta.length > 0){
    var cumple = conMeta.filter(function(k){ return k.valor >= k.meta; }).length;
    html += '<div class="stat-card" style="border-left-color:#27ae60"><div class="stat-num">'+cumple+'/'+conMeta.length+'</div><div class="stat-label">Cumplen Meta</div></div>';
  }
  var el = document.getElementById('ger-admin-stats');
  if(el) el.innerHTML = html;
}

function renderGerAdminTabla(){
  var html = '<tr><th>Periodo</th><th>Nombre</th><th>Categoria</th><th>Valor</th><th>Unidad</th><th>Meta</th><th></th></tr>';
  if(_gerKpis.length === 0){
    html += '<tr><td colspan="7" style="text-align:center;color:#7a9ba8">No hay indicadores para este periodo</td></tr>';
  } else {
    _gerKpis.forEach(function(k){
      var valFmt = k.unidad === '%' ? k.valor+'%' : k.unidad === 'USD' ? '$'+k.valor.toLocaleString('es-CO') : k.valor;
      var metaFmt = (k.meta !== null && k.meta !== undefined) ?
        (k.unidad === '%' ? k.meta+'%' : k.unidad === 'USD' ? '$'+k.meta.toLocaleString('es-CO') : k.meta) : '-';
      var acc = _gerCanWrite()
        ? '<button class="btn-sm btn-edit" onclick="gerEditarKpi('+k.id+')">Editar</button> <button class="btn-sm btn-delete" onclick="gerEliminarKpi('+k.id+')">Eliminar</button>'
        : '';
      html += '<tr><td>'+esc(k.periodo)+'</td><td><strong>'+esc(k.nombre)+'</strong></td><td>'+esc(k.categoria)+'</td><td class="peak">'+valFmt+'</td><td>'+esc(k.unidad||'-')+'</td><td>'+metaFmt+'</td>'+
        '<td>'+acc+'</td></tr>';
    });
  }
  var tbody = document.getElementById('ger-admin-tbody');
  if(tbody) tbody.innerHTML = html;
}
