// cargas.js — InConexion Platform. Pantalla de carga de datos operativos de los
// dashboards de cliente (Fase 2). Requiere el permiso `cargarDatos`.
//
// El Excel se parsea en el navegador (libreria XLSX ya cargada) y se envia como
// JSON a POST /api/dashboard/cargas. El servidor valida contra la definicion de
// la seccion y guarda. Volver a subir un periodo pide confirmacion antes de reemplazar (3.1).

var _cargasClientes = [];
var _cargasSpec = null;      // { cliente, secciones:{ key: {titulo, cadencia, periodo, filaUnica, columnas} } }
var _cargaParsed = null;     // { cliente, seccion, cadencia, periodo, archivoNombre, filas }

async function openCargas(){
  if(!(isFullAdmin() || (currentUser && currentUser.perms && currentUser.perms.cargarDatos))){
    showToast('No tienes permiso para cargar datos'); return;
  }
  document.getElementById('cargas-overlay').classList.add('show');
  _cargaParsed = null;
  document.getElementById('carga-preview-card').style.display = 'none';
  try{
    var r = await apiRequest('GET','/dashboard/clientes');
    _cargasClientes = (r && r.clientes) || [];
  }catch(e){ _cargasClientes = []; showToast(e.message); }
  var selC = document.getElementById('carga-cliente');
  selC.innerHTML = _cargasClientes.map(function(c){ return '<option value="'+esc(c)+'">'+esc(c)+'</option>'; }).join('')
    || '<option value="">Sin clientes configurados</option>';
  await onCargaClienteChange();
}
function closeCargas(){ document.getElementById('cargas-overlay').classList.remove('show'); }
document.getElementById('cargas-overlay').addEventListener('click',function(e){ if(e.target===this) closeCargas(); });

async function onCargaClienteChange(){
  var cliente = document.getElementById('carga-cliente').value;
  _cargasSpec = null;
  if(cliente){
    try{ _cargasSpec = await apiRequest('GET','/dashboard/secciones/'+encodeURIComponent(cliente)); }
    catch(e){ showToast(e.message); }
  }
  var selS = document.getElementById('carga-seccion');
  var keys = _cargasSpec ? Object.keys(_cargasSpec.secciones) : [];
  selS.innerHTML = keys.map(function(k){
    return '<option value="'+esc(k)+'">'+esc(_cargasSpec.secciones[k].titulo)+'</option>';
  }).join('') || '<option value="">—</option>';
  onCargaSeccionChange();
  renderCargasExistentes();
}

function _cargaSeccionActual(){
  if(!_cargasSpec) return null;
  return _cargasSpec.secciones[document.getElementById('carga-seccion').value] || null;
}

function onCargaSeccionChange(){
  var spec = _cargaSeccionActual();
  _cargaParsed = null;
  document.getElementById('carga-preview-card').style.display = 'none';
  document.getElementById('carga-file').value = '';
  var desc = document.getElementById('carga-seccion-desc');
  var cad = document.getElementById('carga-cadencia');
  var perLbl = document.getElementById('carga-periodo-label');
  var per = document.getElementById('carga-periodo');
  if(!spec){ desc.textContent=''; cad.value=''; return; }
  desc.textContent = spec.descripcion || '';
  cad.value = spec.cadencia;
  if(spec.periodo === 'dia'){ perLbl.textContent = 'Periodo (dia)'; per.type = 'date'; }
  else { perLbl.textContent = 'Periodo (mes)'; per.type = 'month'; }
  renderCargasExistentes();
}

// ── Plantilla ────────────────────────────────────────────────
function descargarPlantillaCarga(){
  if(typeof XLSX==='undefined'){ showToast('No se pudo cargar el generador de Excel.'); return; }
  var spec = _cargaSeccionActual();
  if(!spec){ showToast('Selecciona una seccion'); return; }
  var cliente = document.getElementById('carga-cliente').value;
  var seccion = document.getElementById('carga-seccion').value;
  var aoa;
  if(spec.filaUnica){
    aoa = [['Metrica','Valor']].concat(spec.columnas.map(function(c){ return [c.label, '']; }));
  } else {
    aoa = [spec.columnas.map(function(c){ return c.label; })];
    aoa.push(spec.columnas.map(function(){ return ''; }));
  }
  var ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = (spec.filaUnica ? [{wch:42},{wch:16}] : spec.columnas.map(function(){ return {wch:22}; }));
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Datos');
  XLSX.writeFile(wb, 'plantilla_'+cliente+'_'+seccion+'.xlsx');
}

// ── Parseo del archivo subido ────────────────────────────────
async function procesarArchivoCarga(input){
  var spec = _cargaSeccionActual();
  if(!spec){ showToast('Selecciona una seccion primero'); input.value=''; return; }
  var file = input.files && input.files[0];
  if(!file) return;
  var periodo = document.getElementById('carga-periodo').value;
  if(!periodo){ showToast('Indica el periodo antes de subir el archivo'); input.value=''; return; }

  var buf;
  try{ buf = await file.arrayBuffer(); }
  catch(e){ showToast('No se pudo leer el archivo'); return; }
  var wb, aoa;
  try{
    wb = XLSX.read(new Uint8Array(buf), {type:'array'});
    var ws = wb.Sheets[wb.SheetNames[0]];
    aoa = XLSX.utils.sheet_to_json(ws, {header:1, blankrows:false, defval:''});
  }catch(e){ showToast('El archivo no es un Excel valido'); return; }

  var res = spec.filaUnica ? _parseFilaUnica(spec, aoa) : _parseMultiFila(spec, aoa);
  if(res.error){ showToast(res.error); return; }

  _cargaParsed = {
    cliente: document.getElementById('carga-cliente').value,
    seccion: document.getElementById('carga-seccion').value,
    cadencia: spec.cadencia,
    periodo: periodo,
    archivoNombre: file.name,
    filas: res.filas
  };
  _renderPreviewCarga(spec, res.filas, res.avisos || []);
}

function _norm(s){ return String(s==null?'':s).trim().toLowerCase(); }
function _colPorLabel(spec, label){
  var n = _norm(label);
  return spec.columnas.find(function(c){ return _norm(c.label)===n || _norm(c.key)===n; }) || null;
}

function _parseFilaUnica(spec, aoa){
  // Formato vertical: [ [label, valor], ... ]  (se ignora una fila de encabezado si dice "metrica")
  var obj = {};
  var avisos = [];
  aoa.forEach(function(row){
    if(!row || row.length<2) return;
    if(_norm(row[0])==='metrica' || _norm(row[0])==='métrica') return;
    var col = _colPorLabel(spec, row[0]);
    if(!col){ avisos.push('Se ignoro la fila "'+row[0]+'" (no coincide con ninguna metrica)'); return; }
    obj[col.key] = row[1];
  });
  if(Object.keys(obj).length===0) return {error:'El archivo no tiene metricas reconocibles. Descarga la plantilla.'};
  return {filas:[obj], avisos:avisos};
}

function _parseMultiFila(spec, aoa){
  if(!aoa.length) return {error:'El archivo esta vacio'};
  var headers = aoa[0].map(function(h){ return _colPorLabel(spec, h); });
  if(!headers.some(Boolean)) return {error:'Los encabezados no coinciden con la plantilla. Descarga la plantilla.'};
  var filas = [];
  for(var i=1;i<aoa.length;i++){
    var row = aoa[i];
    if(!row || row.every(function(v){ return v===''||v==null; })) continue;
    var obj = {};
    headers.forEach(function(col, j){ if(col) obj[col.key] = row[j]; });
    filas.push(obj);
  }
  if(filas.length===0) return {error:'El archivo no tiene filas de datos'};
  return {filas:filas, avisos:[]};
}

function _renderPreviewCarga(spec, filas, avisos){
  document.getElementById('carga-preview-nombre').textContent = _cargaParsed.archivoNombre + ' — ' + _cargaParsed.periodo;
  document.getElementById('carga-errores').innerHTML = avisos.map(function(a){ return '&#9888; '+esc(a); }).join('<br>');
  var cols = spec.columnas;
  var html = '<tr>'+cols.map(function(c){ return '<th>'+esc(c.label)+'</th>'; }).join('')+'</tr>';
  html += filas.slice(0,30).map(function(f){
    return '<tr>'+cols.map(function(c){ return '<td>'+(f[c.key]===undefined||f[c.key]===''?'<span style="color:#c0392b">—</span>':esc(f[c.key]))+'</td>'; }).join('')+'</tr>';
  }).join('');
  if(filas.length>30) html += '<tr><td colspan="'+cols.length+'" style="text-align:center;color:#7a9ba8">… y '+(filas.length-30)+' filas mas</td></tr>';
  document.getElementById('carga-preview-table').innerHTML = html;
  document.getElementById('carga-preview-card').style.display = '';
}

function cancelarPreviewCarga(){
  _cargaParsed = null;
  document.getElementById('carga-preview-card').style.display = 'none';
  document.getElementById('carga-file').value = '';
}

async function guardarCarga(){
  if(!_cargaParsed){ showToast('Primero sube un archivo'); return; }
  var btn = document.querySelector('#carga-preview-card .btn-primary');
  try{
    await withButtonLoading(btn, 'Guardando...', function(){ return apiRequest('POST','/dashboard/cargas', _cargaParsed); });
  }catch(e){
    // 409: ya existe una carga para este cliente/seccion/periodo -> preguntar antes
    // de sobrescribir (feedback Edwin 3.1).
    if(e && e.status===409 && e.data && e.data.yaExiste){
      var d=e.data;
      var quien=d.cargadoPorNombre ? (' por '+d.cargadoPorNombre) : '';
      var cuando=d.cargadoEn ? (' el '+d.cargadoEn) : '';
      if(!confirm('Ya existe una carga para '+d.cliente+' / '+d.seccion+' / '+d.periodo+
                  ' (cargada'+quien+cuando+'). ¿Reemplazarla con este archivo?')){
        showToast('Carga cancelada. No se sobrescribió nada.');
        return;
      }
      try{
        var conReemplazo = Object.assign({}, _cargaParsed, { reemplazar: true });
        await withButtonLoading(btn, 'Reemplazando...', function(){ return apiRequest('POST','/dashboard/cargas', conReemplazo); });
      }catch(e2){ showToast(e2.message); return; }
    } else {
      showToast(e.message);
      return;
    }
  }
  showToast('Carga guardada. El dashboard ya usa estos datos.');
  cancelarPreviewCarga();
  renderCargasExistentes();
}

async function renderCargasExistentes(){
  var tbl = document.getElementById('carga-existentes-table');
  if(!tbl) return;
  var cliente = document.getElementById('carga-cliente').value;
  var seccion = document.getElementById('carga-seccion').value;
  var rows = [];
  try{
    rows = await apiRequest('GET','/dashboard/cargas?cliente='+encodeURIComponent(cliente)+'&seccion='+encodeURIComponent(seccion)) || [];
  }catch(e){ /* silencioso */ }
  var html = '<tr><th>Periodo</th><th>Cadencia</th><th>Filas</th><th>Cargado por</th><th>Fecha</th><th></th></tr>';
  if(rows.length===0){
    html += '<tr><td colspan="6" style="text-align:center;color:#7a9ba8">Sin cargas para esta seccion todavia</td></tr>';
  } else {
    rows.forEach(function(c){
      html += '<tr><td>'+esc(c.periodo)+'</td><td>'+esc(c.cadencia)+'</td><td>'+(c.filas?c.filas.length:0)+'</td>'+
        '<td>'+esc(c.cargadoPorNombre||'-')+'</td><td style="font-size:0.78rem;color:#7a9ba8">'+esc(c.cargadoEn||'-')+'</td>'+
        '<td><button class="btn-sm btn-delete" onclick="eliminarCarga('+c.id+')">Eliminar</button></td></tr>';
    });
  }
  tbl.innerHTML = html;
}

async function eliminarCarga(id){
  if(!confirm('Eliminar esta carga? El dashboard dejara de mostrar esos datos.')) return;
  try{ await apiRequest('DELETE','/dashboard/cargas/'+id); }
  catch(e){ showToast(e.message); return; }
  showToast('Carga eliminada');
  renderCargasExistentes();
}
