// inventario.js — InConexion Platform. Modulo de Inventario (gestion de stock).
// Se carga como <script src> global y en orden; todas las funciones son globales.
// Datos cargados desde Excel o creados manualmente. Backend: /api/inventario/*.

var _invItems = [];
var _invResumen = null;
var _invMovimientos = [];
var _invFiltroCat = '';
var _invFiltroEstado = '';
var _invTab = 'items';
var _invEditId = null;

// ═══════════════════════════════════════════════════════════
// APERTURA / CIERRE
// ═══════════════════════════════════════════════════════════
async function openInventario(){
  if(!(isFullAdmin() || (currentUser && currentUser.perms && currentUser.perms.Inventario))){
    showToast('No tienes acceso al modulo de Inventario'); return;
  }
  document.getElementById('inventario-overlay').classList.add('show');
  await loadInvData();
  renderInvFiltros();
  renderInvKpis();
  renderInvTabla();
}
function closeInventario(){
  document.getElementById('inventario-overlay').classList.remove('show');
}
document.getElementById('inventario-overlay').addEventListener('click',function(e){ if(e.target===this) closeInventario(); });

// ═══════════════════════════════════════════════════════════
// CARGA DE DATOS
// ═══════════════════════════════════════════════════════════
async function loadInvData(){
  try{
    _invItems = (await apiRequest('GET','/inventario/items')) || [];
  }catch(e){ _invItems = []; showToast('Error cargando inventario: '+e.message); }
  try{
    _invResumen = await apiRequest('GET','/inventario/resumen');
  }catch(e){ _invResumen = null; }
  try{
    _invMovimientos = (await apiRequest('GET','/inventario/movimientos')) || [];
  }catch(e){ _invMovimientos = []; }
}

// ═══════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════
function switchInvTab(t){
  _invTab = t;
  document.querySelectorAll('#inventario-modal .atab').forEach(function(el){ el.classList.toggle('atab-active', el.dataset.ctab===t); });
  document.querySelectorAll('#inventario-modal .atab-panel').forEach(function(el){ el.classList.toggle('visible', el.id==='ipanel-'+t); });
  if(t==='items') renderInvTabla();
  else if(t==='movimientos') renderInvMovimientosTabla();
  else if(t==='carga') renderInvCargaInfo();
}

// ═══════════════════════════════════════════════════════════
// KPIs
// ═══════════════════════════════════════════════════════════
function renderInvKpis(){
  var r = _invResumen;
  var html = '';
  if(!r){
    html = '<div class="aurora-kpi"><div class="kv">—</div><div class="kl">Cargando...</div></div>';
  } else {
    html += '<div class="aurora-kpi"><div class="kv">'+r.total+'</div><div class="kl">Items Registrados</div></div>';
    html += '<div class="aurora-kpi kpi-pur"><div class="kv">'+r.totalUnidades.toLocaleString('es-CO')+'</div><div class="kl">Unidades Totales</div></div>';
    html += '<div class="aurora-kpi kpi-org"><div class="kv">$'+Number(r.valorTotal).toLocaleString('es-CO')+'</div><div class="kl">Valor Total</div></div>';
    var disp = (r.porEstado||[]).find(function(e){return e.estado==='Disponible';});
    var uso = (r.porEstado||[]).find(function(e){return e.estado==='En Uso';});
    html += '<div class="aurora-kpi kpi-green"><div class="kv">'+(disp?disp.c:0)+'</div><div class="kl">Disponibles</div></div>';
    html += '<div class="aurora-kpi kpi-red"><div class="kv">'+(uso?uso.c:0)+'</div><div class="kl">En Uso</div></div>';
  }
  document.getElementById('inv-kpis').innerHTML = html;
}

// ═══════════════════════════════════════════════════════════
// FILTROS
// ═══════════════════════════════════════════════════════════
function renderInvFiltros(){
  var cats = [];
  _invItems.forEach(function(it){ if(cats.indexOf(it.categoria)===-1) cats.push(it.categoria); });
  cats.sort();
  var selC = document.getElementById('inv-filtro-cat');
  selC.innerHTML = '<option value="">Todas las categorias</option>' + cats.map(function(c){ return '<option value="'+esc(c)+'">'+esc(c)+'</option>'; }).join('');
  selC.value = _invFiltroCat;
  var selE = document.getElementById('inv-filtro-estado');
  selE.value = _invFiltroEstado;
}

function onInvFiltroChange(){
  _invFiltroCat = document.getElementById('inv-filtro-cat').value;
  _invFiltroEstado = document.getElementById('inv-filtro-estado').value;
  renderInvTabla();
}

function _invFiltered(){
  return _invItems.filter(function(it){
    if(_invFiltroCat && it.categoria !== _invFiltroCat) return false;
    if(_invFiltroEstado && it.estado !== _invFiltroEstado) return false;
    return true;
  });
}

// ═══════════════════════════════════════════════════════════
// TABLA DE ITEMS
// ═══════════════════════════════════════════════════════════
function renderInvTabla(){
  var items = _invFiltered().slice().sort(function(a,b){ return a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre); });
  var html = '<tr><th>Nombre</th><th>Categoria</th><th>Cantidad</th><th>Unidad</th><th>Ubicacion</th><th>Estado</th><th>Proveedor</th><th>Costo Unit.</th><th></th></tr>';
  if(items.length === 0){
    html += '<tr><td colspan="9" style="text-align:center;color:#7a9ba8">No hay items en el inventario'+(_invFiltroCat||_invFiltroEstado?' con estos filtros':'')+'</td></tr>';
  } else {
    items.forEach(function(it){
      var estadoCls = it.estado==='Disponible'?'kpi-green':it.estado==='En Uso'?'kpi-org':it.estado==='Mantenimiento'?'kpi-pur':'kpi-red';
      html += '<tr><td><strong>'+esc(it.nombre)+'</strong>'+(it.descripcion?'<br><span style="font-size:0.75rem;color:#7a9ba8">'+esc(it.descripcion)+'</span>':'')+'</td>'+
        '<td>'+esc(it.categoria)+'</td>'+
        '<td class="peak">'+it.cantidad+'</td>'+
        '<td>'+esc(it.unidad)+'</td>'+
        '<td>'+esc(it.ubicacion||'-')+'</td>'+
        '<td><span class="'+estadoCls+'" style="font-size:0.82rem;font-weight:600">'+esc(it.estado)+'</span></td>'+
        '<td>'+esc(it.proveedor||'-')+'</td>'+
        '<td>'+(it.costoUnitario?'$'+Number(it.costoUnitario).toLocaleString('es-CO'):'-')+'</td>'+
        '<td><button class="btn-sm btn-edit" onclick="invEditarItem('+it.id+')">Editar</button> '+
        '<button class="btn-sm btn-delete" onclick="invEliminarItem('+it.id+')">Eliminar</button></td></tr>';
    });
  }
  document.getElementById('inv-items-table').innerHTML = html;
}

// ═══════════════════════════════════════════════════════════
// CRUD ITEMS
// ═══════════════════════════════════════════════════════════
function invNuevoItem(){
  _invEditId = null;
  document.getElementById('inv-modal-title').textContent = 'Nuevo Item de Inventario';
  document.getElementById('inv-nombre').value = '';
  document.getElementById('inv-categoria').value = '';
  document.getElementById('inv-descripcion').value = '';
  document.getElementById('inv-cantidad').value = '0';
  document.getElementById('inv-unidad').value = 'un';
  document.getElementById('inv-ubicacion').value = '';
  document.getElementById('inv-estado').value = 'Disponible';
  document.getElementById('inv-proveedor').value = '';
  document.getElementById('inv-costo').value = '';
  document.getElementById('inv-observaciones').value = '';
  document.getElementById('inv-item-modal').classList.add('show');
}

function invEditarItem(id){
  var it = _invItems.find(function(x){return x.id===id;});
  if(!it){ showToast('Item no encontrado'); return; }
  _invEditId = id;
  document.getElementById('inv-modal-title').textContent = 'Editar Item';
  document.getElementById('inv-nombre').value = it.nombre;
  document.getElementById('inv-categoria').value = it.categoria;
  document.getElementById('inv-descripcion').value = it.descripcion;
  document.getElementById('inv-cantidad').value = it.cantidad;
  document.getElementById('inv-unidad').value = it.unidad;
  document.getElementById('inv-ubicacion').value = it.ubicacion;
  document.getElementById('inv-estado').value = it.estado;
  document.getElementById('inv-proveedor').value = it.proveedor;
  document.getElementById('inv-costo').value = it.costoUnitario || '';
  document.getElementById('inv-observaciones').value = it.observaciones;
  document.getElementById('inv-item-modal').classList.add('show');
}

function closeInvItemModal(){
  document.getElementById('inv-item-modal').classList.remove('show');
}

async function invGuardarItem(){
  var body = {
    nombre: document.getElementById('inv-nombre').value.trim(),
    categoria: document.getElementById('inv-categoria').value.trim() || 'General',
    descripcion: document.getElementById('inv-descripcion').value.trim(),
    cantidad: parseInt(document.getElementById('inv-cantidad').value, 10) || 0,
    unidad: document.getElementById('inv-unidad').value.trim() || 'un',
    ubicacion: document.getElementById('inv-ubicacion').value.trim(),
    estado: document.getElementById('inv-estado').value,
    proveedor: document.getElementById('inv-proveedor').value.trim(),
    costoUnitario: parseFloat(document.getElementById('inv-costo').value) || 0,
    observaciones: document.getElementById('inv-observaciones').value.trim()
  };
  if(!body.nombre){ showToast('El nombre es obligatorio'); return; }
  var btn = document.querySelector('#inv-item-modal .btn-primary');
  try{
    await withButtonLoading(btn, 'Guardando...', async function(){
      if(_invEditId){
        await apiRequest('PUT','/inventario/items/'+_invEditId, body);
      } else {
        await apiRequest('POST','/inventario/items', body);
      }
    });
  }catch(e){ showToast(e.message); return; }
  showToast(_invEditId ? 'Item actualizado' : 'Item creado');
  closeInvItemModal();
  await loadInvData();
  renderInvFiltros();
  renderInvKpis();
  renderInvTabla();
}

async function invEliminarItem(id){
  var it = _invItems.find(function(x){return x.id===id;});
  if(!it) return;
  if(!confirm('Eliminar "'+it.nombre+'" y todos sus movimientos?')) return;
  try{ await apiRequest('DELETE','/inventario/items/'+id); }
  catch(e){ showToast(e.message); return; }
  showToast('Item eliminado');
  await loadInvData();
  renderInvFiltros();
  renderInvKpis();
  renderInvTabla();
}

// ═══════════════════════════════════════════════════════════
// MOVIMIENTOS
// ═══════════════════════════════════════════════════════════
function renderInvMovimientosTabla(){
  var html = '<tr><th>Fecha</th><th>Item</th><th>Tipo</th><th>Cantidad</th><th>Motivo</th><th>Registrado por</th></tr>';
  if(_invMovimientos.length === 0){
    html += '<tr><td colspan="6" style="text-align:center;color:#7a9ba8">No hay movimientos registrados</td></tr>';
  } else {
    _invMovimientos.forEach(function(m){
      var item = _invItems.find(function(x){return x.id===m.itemId;});
      var tipoCls = m.tipo==='Entrada'?'kpi-green':m.tipo==='Salida'?'kpi-red':m.tipo==='Ajuste'?'kpi-org':'kpi-pur';
      html += '<tr><td>'+esc(m.fecha)+'</td><td>'+(item?esc(item.nombre):'Item #'+m.itemId)+'</td>'+
        '<td><span class="'+tipoCls+'" style="font-weight:600">'+esc(m.tipo)+'</span></td>'+
        '<td class="peak">'+m.cantidad+'</td>'+
        '<td>'+esc(m.motivo||'-')+'</td>'+
        '<td>'+esc(m.registradoPorNombre||'-')+'</td></tr>';
    });
  }
  document.getElementById('inv-movimientos-table').innerHTML = html;
}

function invNuevoMovimiento(){
  document.getElementById('inv-mov-item').innerHTML = _invItems.map(function(it){
    return '<option value="'+it.id+'">'+esc(it.nombre)+' ('+it.cantidad+' '+esc(it.unidad)+')</option>';
  }).join('');
  if(_invItems.length === 0){
    showToast('Primero crea items en el inventario'); return;
  }
  document.getElementById('inv-mov-tipo').value = 'Entrada';
  document.getElementById('inv-mov-cantidad').value = '';
  document.getElementById('inv-mov-fecha').value = new Date().toISOString().slice(0,10);
  document.getElementById('inv-mov-motivo').value = '';
  document.getElementById('inv-mov-destino').value = '';
  document.getElementById('inv-mov-modal').classList.add('show');
}
function closeInvMovModal(){ document.getElementById('inv-mov-modal').classList.remove('show'); }

async function invGuardarMovimiento(){
  var body = {
    itemId: parseInt(document.getElementById('inv-mov-item').value, 10),
    tipo: document.getElementById('inv-mov-tipo').value,
    cantidad: parseInt(document.getElementById('inv-mov-cantidad').value, 10),
    fecha: document.getElementById('inv-mov-fecha').value,
    motivo: document.getElementById('inv-mov-motivo').value.trim(),
    destino: document.getElementById('inv-mov-destino').value.trim()
  };
  if(!body.itemId){ showToast('Seleccione un item'); return; }
  if(!body.cantidad || body.cantidad < 1){ showToast('Ingrese una cantidad valida'); return; }
  if(!body.fecha){ showToast('Ingrese la fecha'); return; }
  var btn = document.querySelector('#inv-mov-modal .btn-primary');
  try{
    await withButtonLoading(btn, 'Registrando...', async function(){
      await apiRequest('POST','/inventario/movimientos', body);
    });
  }catch(e){ showToast(e.message); return; }
  showToast('Movimiento registrado');
  closeInvMovModal();
  await loadInvData();
  renderInvKpis();
  renderInvMovimientosTabla();
  if(_invTab==='items') renderInvTabla();
}

// ═══════════════════════════════════════════════════════════
// CARGA MASIVA DESDE EXCEL
// ═══════════════════════════════════════════════════════════
function renderInvCargaInfo(){
  document.getElementById('inv-carga-status').innerHTML =
    '<div class="aurora-kpi"><div class="kv">'+_invItems.length+'</div><div class="kl">Items actuales en inventario</div></div>'+
    '<div class="aurora-kpi"><div class="kv">'+_invMovimientos.length+'</div><div class="kl">Movimientos registrados</div></div>';
}

function invDescargarPlantillaItems(){
  if(typeof XLSX==='undefined'){ showToast('No se pudo cargar el generador de Excel.'); return; }
  var aoa = [['Nombre','Categoria','Descripcion','Cantidad','Unidad','Ubicacion','Estado','Proveedor','Costo Unitario','Observaciones'],
    ['Ejemplo: Audifonos Logitech', 'Equipos', 'Audifonos con microfono para asesores', 50, 'un', 'Bodega Central', 'Disponible', 'Logitech', 120000, '']];
  var ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{wch:30},{wch:15},{wch:35},{wch:10},{wch:8},{wch:18},{wch:15},{wch:18},{wch:15},{wch:25}];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Items');
  XLSX.writeFile(wb, 'plantilla_inventario_items.xlsx');
  showToast('Plantilla descargada');
}

function invDescargarPlantillaMovimientos(){
  if(typeof XLSX==='undefined'){ showToast('No se pudo cargar el generador de Excel.'); return; }
  var aoa = [['ID Item','Tipo (Entrada/Salida/Ajuste/Transferencia)','Cantidad','Fecha (AAAA-MM-DD)','Motivo','Destino'],
    [1, 'Entrada', 10, '2026-09-01', 'Compra inicial', '']];
  var ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{wch:10},{wch:40},{wch:10},{wch:18},{wch:25},{wch:20}];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
  XLSX.writeFile(wb, 'plantilla_inventario_movimientos.xlsx');
  showToast('Plantilla descargada');
}

async function invProcesarArchivoItems(input){
  var file = input.files && input.files[0];
  if(!file) return;
  if(typeof XLSX==='undefined'){ showToast('No se pudo cargar la libreria de Excel.'); return; }
  var buf = await file.arrayBuffer();
  var wb = XLSX.read(buf, {type:'array'});
  var ws = wb.Sheets[wb.SheetNames[0]];
  var data = XLSX.utils.sheet_to_json(ws);
  if(data.length === 0){ showToast('El archivo no tiene datos'); input.value=''; return; }

  var items = data.map(function(row){
    return {
      nombre: String(row['Nombre']||row['nombre']||'').trim(),
      categoria: String(row['Categoria']||row['categoria']||'General').trim(),
      descripcion: String(row['Descripcion']||row['descripcion']||'').trim(),
      cantidad: parseInt(row['Cantidad']||row['cantidad']||0, 10),
      unidad: String(row['Unidad']||row['unidad']||'un').trim(),
      ubicacion: String(row['Ubicacion']||row['ubicacion']||'').trim(),
      estado: String(row['Estado']||row['estado']||'Disponible').trim(),
      proveedor: String(row['Proveedor']||row['proveedor']||'').trim(),
      costoUnitario: parseFloat(row['Costo Unitario']||row['costoUnitario']||0) || 0,
      observaciones: String(row['Observaciones']||row['observaciones']||'').trim()
    };
  }).filter(function(it){ return it.nombre; });

  if(items.length === 0){ showToast('No se encontraron items con nombre valido'); input.value=''; return; }

  var btn = document.getElementById('inv-cargar-items-btn');
  try{
    await withButtonLoading(btn, 'Cargando '+items.length+' items...', async function(){
      await apiRequest('POST','/inventario/carga-items', { items: items });
    });
  }catch(e){ showToast(e.message); input.value=''; return; }
  showToast(items.length+' items cargados correctamente');
  input.value = '';
  await loadInvData();
  renderInvFiltros();
  renderInvKpis();
  renderInvTabla();
}

async function invProcesarArchivoMovimientos(input){
  var file = input.files && input.files[0];
  if(!file) return;
  if(typeof XLSX==='undefined'){ showToast('No se pudo cargar la libreria de Excel.'); return; }
  var buf = await file.arrayBuffer();
  var wb = XLSX.read(buf, {type:'array'});
  var ws = wb.Sheets[wb.SheetNames[0]];
  var data = XLSX.utils.sheet_to_json(ws);
  if(data.length === 0){ showToast('El archivo no tiene datos'); input.value=''; return; }

  var movimientos = data.map(function(row){
    return {
      itemId: parseInt(row['ID Item']||row['itemId']||0, 10),
      tipo: String(row['Tipo']||row['tipo']||'Entrada').trim(),
      cantidad: parseInt(row['Cantidad']||row['cantidad']||0, 10),
      fecha: String(row['Fecha']||row['fecha']||'').trim(),
      motivo: String(row['Motivo']||row['motivo']||'').trim(),
      destino: String(row['Destino']||row['destino']||'').trim()
    };
  }).filter(function(m){ return m.itemId && m.cantidad > 0 && m.fecha; });

  if(movimientos.length === 0){ showToast('No se encontraron movimientos validos (requiere: ID Item, Cantidad, Fecha)'); input.value=''; return; }

  var btn = document.getElementById('inv-cargar-mov-btn');
  try{
    await withButtonLoading(btn, 'Cargando '+movimientos.length+' movimientos...', async function(){
      await apiRequest('POST','/inventario/carga-movimientos', { movimientos: movimientos });
    });
  }catch(e){ showToast(e.message); input.value=''; return; }
  showToast(movimientos.length+' movimientos cargados correctamente');
  input.value = '';
  await loadInvData();
  renderInvKpis();
  renderInvMovimientosTabla();
}

// ═══════════════════════════════════════════════════════════
// ADMIN SECTION (sidebar en panel admin)
// ═══════════════════════════════════════════════════════════
async function renderInventarioSection(){
  await loadInvData();
  renderInvAdminStats();
  renderInvAdminTabla();
}

function renderInvAdminStats(){
  var r = _invResumen;
  if(!r) return;
  var html = '<div class="stat-card"><div class="stat-num">'+r.total+'</div><div class="stat-label">Items</div></div>'+
    '<div class="stat-card" style="border-left-color:#8e44ad"><div class="stat-num">'+r.totalUnidades.toLocaleString('es-CO')+'</div><div class="stat-label">Unidades</div></div>'+
    '<div class="stat-card" style="border-left-color:#e67e22"><div class="stat-num">$'+Number(r.valorTotal).toLocaleString('es-CO')+'</div><div class="stat-label">Valor Total</div></div>';
  var el = document.getElementById('inv-admin-stats');
  if(el) el.innerHTML = html;
}

function renderInvAdminTabla(){
  var items = _invItems.slice().sort(function(a,b){ return a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre); });
  var html = '<tr><th>Nombre</th><th>Categoria</th><th>Cantidad</th><th>Unidad</th><th>Estado</th><th>Costo</th><th></th></tr>';
  if(items.length === 0){
    html += '<tr><td colspan="7" style="text-align:center;color:#7a9ba8">No hay items. Crea uno o carga un Excel.</td></tr>';
  } else {
    items.forEach(function(it){
      html += '<tr><td><strong>'+esc(it.nombre)+'</strong></td><td>'+esc(it.categoria)+'</td><td class="peak">'+it.cantidad+'</td><td>'+esc(it.unidad)+'</td>'+
        '<td>'+esc(it.estado)+'</td><td>'+(it.costoUnitario?'$'+Number(it.costoUnitario).toLocaleString('es-CO'):'-')+'</td>'+
        '<td><button class="btn-sm btn-edit" onclick="invEditarItem('+it.id+')">Editar</button> '+
        '<button class="btn-sm btn-delete" onclick="invEliminarItem('+it.id+')">Eliminar</button></td></tr>';
    });
  }
  var tbody = document.getElementById('inv-admin-tbody');
  if(tbody) tbody.innerHTML = html;
}
