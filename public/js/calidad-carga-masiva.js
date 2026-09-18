// calidad-carga-masiva.js — InConexion Platform.
// Carga masiva de monitoreos de Calidad desde un Excel de 3 hojas:
//   - "Monitoreos" (se diligencia y se sube — la unica hoja que se parsea)
//   - "Diccionario" (referencia: item, categoria, peso%, critico — de apoyo)
//   - "Resumen por Asesor" (de apoyo, se calcula solo, no se parsea)
// Mismo patron que el resto de cargas (cargas.js, NSD en metas.js): parseo
// y preview 100% en el navegador con XLSX.js, el servidor solo recibe filas
// ya validadas como JSON (POST /api/monitoreos/bulk). Primera campana real:
// CARTERA INTERNA (14 items, ver server/calidad-plantillas-seed.js). El
// parseo en si (puro, sin DOM) vive en calidad-carga-masiva-logic.js.

var _cmParsed = null; // { campana, archivoNombre, filas } listo para POST

function descargarPlantillaMonitoreos(){
  if(typeof XLSX==='undefined'){ showToast('No se pudo cargar el generador de Excel.'); return; }
  var items = calItems(_ccampana);
  if(!items.length){ showToast('Esta campana no tiene plantilla de calificacion.'); return; }

  var headerMonitoreos = CM_COLUMNAS_FIJAS.map(function(c){ return c.label; }).concat(items.map(function(it){ return it.label; }));
  var wsMonitoreos = XLSX.utils.aoa_to_sheet([headerMonitoreos]);
  wsMonitoreos['!cols'] = headerMonitoreos.map(function(){ return { wch: 20 }; });

  var dicAoa = [['#','Categoria','Item','Peso %','Critico']].concat(
    items.map(function(it){ return [it.n, it.cat, it.label, it.weight, it.critico ? 'SI' : 'NO']; })
  );
  var wsDic = XLSX.utils.aoa_to_sheet(dicAoa);
  wsDic['!cols'] = [{wch:4},{wch:16},{wch:55},{wch:9},{wch:9}];

  var wsResumen = XLSX.utils.aoa_to_sheet([['Asesor','# Monitoreos','Promedio','Clasificacion']]);
  wsResumen['!cols'] = [{wch:24},{wch:14},{wch:12},{wch:16}];

  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsMonitoreos, 'Monitoreos');
  XLSX.utils.book_append_sheet(wb, wsDic, 'Diccionario');
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen por Asesor');
  XLSX.writeFile(wb, 'plantilla_monitoreos_'+String(_ccampana||'').replace(/\s+/g,'_')+'.xlsx');
}

async function procesarArchivoMonitoreos(input){
  var items = calItems(_ccampana);
  if(!items.length){ showToast('Esta campana no tiene plantilla de calificacion.'); input.value=''; return; }
  var file = input.files && input.files[0];
  if(!file) return;

  var buf;
  try{ buf = await file.arrayBuffer(); }
  catch(e){ showToast('No se pudo leer el archivo'); return; }
  var wb, aoa;
  try{
    wb = XLSX.read(new Uint8Array(buf), { type:'array', cellDates:true });
    var sheetName = wb.SheetNames.indexOf('Monitoreos')!==-1 ? 'Monitoreos' : wb.SheetNames[0];
    var ws = wb.Sheets[sheetName];
    aoa = XLSX.utils.sheet_to_json(ws, { header:1, blankrows:false, defval:null });
  }catch(e){ showToast('El archivo no es un Excel valido'); input.value=''; return; }

  var res = cmParseRows(aoa, items);
  if(res.error){ showToast(res.error); input.value=''; return; }

  _cmParsed = { campana: _ccampana, archivoNombre: file.name, filas: res.filas };
  _renderPreviewMonitoreos(file.name, res.filas, res.avisos||[]);
}

function _renderPreviewMonitoreos(nombre, filas, avisos){
  document.getElementById('cm-preview-nombre').textContent = nombre;
  document.getElementById('cm-avisos').innerHTML = avisos.map(function(a){ return '&#9888; '+esc(a); }).join('<br>');
  var head = '<tr><th>Asesor</th><th>Fecha</th><th>Canal</th><th>ID Llamada</th><th># Items respondidos</th></tr>';
  var body = filas.slice(0,60).map(function(f){
    return '<tr><td>'+esc(f.asesor)+'</td><td>'+esc(f.fecha)+'</td><td>'+esc(f.canal)+'</td><td>'+esc(f.idLlamada||'—')+'</td><td>'+Object.keys(f.answers).length+'</td></tr>';
  }).join('');
  if(filas.length>60) body += '<tr><td colspan="5" style="text-align:center;color:var(--c-text-muted)">… y '+(filas.length-60)+' filas mas</td></tr>';
  document.getElementById('cm-preview-table').innerHTML = head + body;
  document.getElementById('cm-preview-card').style.display = '';
}

function cancelarPreviewMonitoreos(){
  _cmParsed = null;
  var card = document.getElementById('cm-preview-card');
  if(card) card.style.display = 'none';
  var input = document.getElementById('cm-file');
  if(input) input.value = '';
  var avisos = document.getElementById('cm-avisos');
  if(avisos) avisos.innerHTML = '';
}

async function guardarMonitoreosMasivo(){
  if(!_cmParsed){ showToast('Primero sube un archivo'); return; }
  var btn = document.getElementById('cm-save-btn');
  var resp;
  try{
    resp = await withButtonLoading(btn, 'Guardando...', function(){ return apiRequest('POST','/monitoreos/bulk', _cmParsed); });
  }catch(e){ showToast(e.message); return; }
  showToast('Carga guardada: '+(resp.insertadas||0)+' nueva(s), '+(resp.actualizadas||0)+' actualizada(s), '+(resp.omitidas||0)+' omitida(s).');
  cancelarPreviewMonitoreos();
  await loadCalData(_ccampana, _cmesFiltro || undefined);
  renderCalKpis();
  if(_ctab==='monitoreos') renderCalMonitoreosTable();
  if(_ctab==='resumen') renderCalResumenTable();
}
