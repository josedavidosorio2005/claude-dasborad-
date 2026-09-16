// cargas.js — InConexion Platform. Pantalla de carga de datos operativos de los
// dashboards de cliente (Fase 2; consolidada en la Fase "una sola plantilla
// por campana", 2026-09-16). Requiere el permiso `cargarDatos`.
//
// Antes de la Fase 2026-09-16, una campana podia llegar a tener hasta 3
// botones de carga separados: Gestion de base (aqui), Calidad (su propio
// modulo) y Trafico (su propia pantalla de administracion). Ahora esta
// pantalla arma UN SOLO archivo .xlsx por cliente, con una hoja por tipo de
// dato (nunca aplanado en una tabla unica — mezclaria filas de naturaleza
// distinta). Decision de diseno completa en docs/ARQUITECTURA.md.
//
// El Excel se parsea en el navegador (libreria XLSX ya cargada) y se envia
// como JSON a las rutas que YA EXISTIAN para cada tipo de dato (nunca se
// reescribio su parseo/validacion): POST /dashboard/cargas (Gestion de
// base, una llamada por seccion con datos), POST /monitoreos/bulk (Calidad),
// POST /calidad/trafico/carga (Trafico). Una hoja vacia no es un error (no
// aplica esta vez); una hoja con datos invalidos se rechaza SOLA, sin
// bloquear las demas.
//
// El parseo puro (sin DOM) vive en cargas-logic.js para poder probarlo con
// node:test contra un .xlsx real (ver server/tests/cargas-logic.test.js).

var _cargasClientes = [];
var _cargasSpec = null;          // { cliente, secciones:{ key: {titulo, cadencia, periodo, filaUnica, columnas} } }
var _cargasCalidadPorCampana = {}; // { campana: {campana,engine,items} } — de GET /calidad/plantillas
var _cargasPlan = [];            // cargasPlanConsolidado(...) para el cliente actual
var _cargasArchivoNombre = '';
var _cargasResultados = [];      // 1 por hoja del plan, tras procesarArchivoConsolidado

async function openCargas(){
  if(!(isFullAdmin() || (currentUser && currentUser.perms && currentUser.perms.cargarDatos))){
    showToast('No tienes permiso para cargar datos'); return;
  }
  document.getElementById('cargas-overlay').classList.add('show');
  _cargasResultados = [];
  document.getElementById('carga-preview-card').style.display = 'none';
  try{
    var r = await apiRequest('GET','/dashboard/clientes');
    _cargasClientes = (r && r.clientes) || [];
  }catch(e){ _cargasClientes = []; showToast(e.message); }
  try{
    var plantillas = await apiRequest('GET','/calidad/plantillas') || [];
    _cargasCalidadPorCampana = {};
    plantillas.forEach(function(p){ _cargasCalidadPorCampana[p.campana] = p; });
  }catch(e){ _cargasCalidadPorCampana = {}; }
  var selC = document.getElementById('carga-cliente');
  selC.innerHTML = _cargasClientes.map(function(c){ return '<option value="'+esc(c)+'">'+esc(c)+'</option>'; }).join('')
    || '<option value="">Sin clientes configurados</option>';
  await onCargaClienteChange();
}
function closeCargas(){ document.getElementById('cargas-overlay').classList.remove('show'); }
document.getElementById('cargas-overlay').addEventListener('click',function(e){ if(e.target===this) closeCargas(); });

// ── Columnas de Trafico/Calidad normalizadas a {key?,label,opcional} para
// que el plan y la hoja INSTRUCCIONES usen siempre el mismo criterio
// (Trafico trae `obligatoria`; Gestion de base y esto de aqui usan `opcional`).
function _cargasTraficoColumnas(){
  // MES/AÑO al final son informativas (Volvox las trae, nadie las parsea:
  // traficoColIndexMap las ignora sin problema) — se agregan solo para que
  // la hoja DATA de esta plantilla se vea igual que la plantilla oficial ya
  // aprobada por el cliente (server/plantillas/PLANTILLA_TRAFICO_INCONEXION_VACIA.xlsx).
  return TRAFICO_COLUMNAS.map(function(c){ return { key:c.key, label:c.label, opcional: !c.obligatoria }; })
    .concat([{ key:'mes', label:'MES', opcional:true }, { key:'anio', label:'AÑO', opcional:true }]);
}
function _cargasCalidadColumnas(items){
  var obligatorias = { asesor:1, fecha:1 };
  return CM_COLUMNAS_FIJAS.map(function(c){ return { key:c.key, label:c.label, opcional: !obligatorias[c.key] }; })
    .concat(items.map(function(it){ return { key:'item_'+it.n, label: it.label, opcional:true }; }));
}

async function onCargaClienteChange(){
  var cliente = document.getElementById('carga-cliente').value;
  _cargasSpec = null;
  _cargasPlan = [];
  if(cliente){
    try{ _cargasSpec = await apiRequest('GET','/dashboard/secciones/'+encodeURIComponent(cliente)); }
    catch(e){ showToast(e.message); }
  }
  var calidad = cliente ? (_cargasCalidadPorCampana[cliente] || null) : null;
  var calidadCols = calidad ? _cargasCalidadColumnas(calidad.items) : null;
  if(_cargasSpec){
    _cargasPlan = cargasPlanConsolidado(_cargasSpec.secciones, calidadCols, _cargasTraficoColumnas());
  }
  _cargasResultados = [];
  document.getElementById('carga-preview-card').style.display = 'none';
  document.getElementById('carga-file').value = '';
  var desc = document.getElementById('carga-plan-desc');
  if(!_cargasPlan.length){
    desc.textContent = cliente ? 'Esta campana no tiene secciones configuradas.' : '';
  } else {
    desc.textContent = 'Esta plantilla trae ' + _cargasPlan.length + ' hoja(s): ' +
      _cargasPlan.map(function(h){ return h.hoja; }).join(', ') +
      '. La(s) que no apliquen hoy pueden quedar vacias.';
  }
  renderCargasExistentes();
}

// ── Plantilla consolidada (descarga) ────────────────────────────
function _cargasInstruccionesAoA(cliente, plan){
  var out = [];
  var put = function(s){ out.push([s]); };
  put('Plantilla consolidada de carga — ' + cliente);
  put('Un archivo, una hoja por tipo de dato. Leela una vez, luego llena cada hoja de abajo.');
  put('');
  put('COMO SE USA');
  put('1. Cada hoja de abajo corresponde a un tipo de dato distinto (ver la lista al final).');
  put('2. Si un tipo de dato NO aplica a esta campana hoy, deja su hoja vacia — no la borres, no la');
  put('   renombres. Una hoja vacia no genera error, el sistema simplemente la ignora.');
  put('3. Escribe SIEMPRE el numero final ya calculado. Nunca una formula de Excel: si una celda de');
  put('   Valor trae una formula sin calcular, el sistema rechaza esa hoja con un mensaje explicito.');
  put('4. Sube este archivo desde esta misma pantalla (Cargar Datos). El sistema valida cada hoja por');
  put('   separado — si una hoja tiene un error, corrigela y vuelve a subir el archivo completo; las');
  put('   hojas que ya estaban bien no se pierden.');
  put('');
  plan.forEach(function(h){
    put('HOJA "' + h.hoja + '" — ' + h.titulo);
    if(h.descripcion) put(h.descripcion);
    if(h.filaUnica){
      put('Formato vertical: una fila por metrica, columnas Metrica / Valor.');
    } else {
      put('Formato horizontal: encabezados en la primera fila, una fila por registro.');
    }
    put('Columnas:');
    h.columnas.forEach(function(c){
      put('  - ' + c.label + (c.opcional ? ' (OPCIONAL, puede quedar vacia)' : ' (OBLIGATORIA)'));
    });
    put('');
  });
  put('FORMATOS');
  put('- Fechas: AAAA-MM-DD, o fecha nativa de Excel.');
  put('- Porcentajes: numero entre 0 y 100 (no entre 0 y 1).');
  put('- Duraciones (ej. AHT): segundos como numero, salvo que la hoja indique otra cosa.');
  return out;
}

function descargarPlantillaConsolidada(){
  if(typeof XLSX==='undefined'){ showToast('No se pudo cargar el generador de Excel.'); return; }
  var cliente = document.getElementById('carga-cliente').value;
  if(!cliente || !_cargasPlan.length){ showToast('Selecciona un cliente'); return; }

  var wb = XLSX.utils.book_new();

  var wsInstr = XLSX.utils.aoa_to_sheet(_cargasInstruccionesAoA(cliente, _cargasPlan));
  wsInstr['!cols'] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, CARGAS_HOJA_INSTRUCCIONES);

  _cargasPlan.forEach(function(h){
    var aoa;
    if(h.filaUnica){
      aoa = [['Metrica','Valor']].concat(h.columnas.map(function(c){ return [c.label, '']; }));
    } else {
      aoa = [h.columnas.map(function(c){ return c.label; })];
      aoa.push(h.columnas.map(function(){ return ''; }));
    }
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = h.filaUnica ? [{wch:42},{wch:16}] : h.columnas.map(function(){ return {wch:20}; });
    XLSX.utils.book_append_sheet(wb, ws, h.hoja);

    // La hoja de Calidad trae ademas Diccionario/Resumen por Asesor de
    // referencia (no se parsean), igual que la plantilla que ya conocian
    // los usuarios de esa carga individual.
    if(h.tipo === 'calidad'){
      var calidad = _cargasCalidadPorCampana[cliente];
      var items = calidad ? calidad.items : [];
      var dicAoa = [['#','Categoria','Item','Peso %','Critico']].concat(
        items.map(function(it){ return [it.n, it.cat, it.label, it.weight, it.critico ? 'SI' : 'NO']; })
      );
      var wsDic = XLSX.utils.aoa_to_sheet(dicAoa);
      wsDic['!cols'] = [{wch:4},{wch:16},{wch:55},{wch:9},{wch:9}];
      XLSX.utils.book_append_sheet(wb, wsDic, CARGAS_HOJA_DICCIONARIO);

      var wsResumen = XLSX.utils.aoa_to_sheet([['Asesor','# Monitoreos','Promedio','Clasificacion']]);
      wsResumen['!cols'] = [{wch:24},{wch:14},{wch:12},{wch:16}];
      XLSX.utils.book_append_sheet(wb, wsResumen, CARGAS_HOJA_RESUMEN_ASESOR);
    }
  });

  XLSX.writeFile(wb, 'plantilla_consolidada_'+String(cliente).replace(/\s+/g,'_')+'.xlsx');
}

// ── Parseo del archivo consolidado ──────────────────────────────
async function procesarArchivoConsolidado(input){
  var cliente = document.getElementById('carga-cliente').value;
  if(!cliente || !_cargasPlan.length){ showToast('Selecciona un cliente primero'); input.value=''; return; }
  var file = input.files && input.files[0];
  if(!file) return;

  var buf;
  try{ buf = await file.arrayBuffer(); }
  catch(e){ showToast('No se pudo leer el archivo'); return; }
  var wb;
  // sheetStubs:true es imprescindible: sin esta opcion, SheetJS descarta por
  // completo (ni siquiera aparece en ws) una celda con formula sin valor
  // cacheado — cargasDetectarFormulaSinValor nunca la veria (verificado
  // contra la libreria real: sin sheetStubs, ws['B2'] da undefined aunque el
  // XML tenga <f> en esa celda; con sheetStubs llega como {t:'z', f, v:0}).
  try{ wb = XLSX.read(new Uint8Array(buf), {type:'array', sheetStubs:true}); }
  catch(e){ showToast('El archivo no es un Excel valido'); input.value=''; return; }

  var calidad = _cargasCalidadPorCampana[cliente] || null;
  _cargasArchivoNombre = file.name;
  _cargasResultados = _cargasPlan.map(function(h){
    var ws = wb.Sheets[h.hoja];
    var defval = h.tipo==='seccion' ? '' : null;
    var aoa = ws ? XLSX.utils.sheet_to_json(ws, {header:1, blankrows:false, defval:defval}) : null;
    var parseFn;
    if(h.tipo === 'seccion'){
      var spec = _cargasSpec.secciones[h.hoja];
      parseFn = function(a){ return spec.filaUnica ? cargasParseFilaUnica(spec, a) : cargasParseMultiFila(spec, a); };
    } else if(h.tipo === 'calidad'){
      parseFn = function(a){ return cmParseRows(a, calidad.items); };
    } else {
      parseFn = traficoParseFilas;
    }
    return cargasProcesarHoja(h, aoa, ws, parseFn);
  });

  if(!_cargasResultados.some(function(r){ return r.filas; })){
    showToast('El archivo no tiene datos en ninguna hoja reconocida (¿subiste la plantilla de este cliente?).');
    input.value='';
    _cargasResultados = [];
    return;
  }

  _renderPreviewCarga();
}

function _cargasEstadoLabel(r){
  if(r.error) return '<span style="color:#c0392b">&#9888; '+esc(r.error)+'</span>';
  if(r.vacia) return '<span style="color:#7a9ba8">Vacia — no aplica esta vez</span>';
  return '<span style="color:#2e7d32">OK — '+r.filas.length+' fila(s)'+(r.avisos && r.avisos.length ? ', '+r.avisos.length+' aviso(s)' : '')+'</span>';
}

function _renderPreviewCarga(){
  document.getElementById('carga-preview-nombre').textContent = _cargasArchivoNombre;
  var html = '<tr><th>Hoja</th><th>Tipo</th><th>Estado</th></tr>';
  html += _cargasResultados.map(function(r){
    var tipoLabel = r.tipo==='seccion' ? 'Gestion de base' : (r.tipo==='calidad' ? 'Calidad' : 'Trafico');
    return '<tr><td>'+esc(r.titulo)+'</td><td>'+esc(tipoLabel)+'</td><td>'+_cargasEstadoLabel(r)+'</td></tr>';
  }).join('');
  var avisos = [];
  _cargasResultados.forEach(function(r){ (r.avisos||[]).forEach(function(a){ avisos.push(r.titulo+': '+a); }); });
  document.getElementById('carga-errores').innerHTML = avisos.map(function(a){ return '&#9888; '+esc(a); }).join('<br>');
  document.getElementById('carga-preview-table').innerHTML = html;
  document.getElementById('carga-preview-card').style.display = '';
}

function cancelarPreviewCarga(){
  _cargasResultados = [];
  document.getElementById('carga-preview-card').style.display = 'none';
  document.getElementById('carga-file').value = '';
}

// ── Guardado (una llamada por hoja con datos, a la ruta que ya existia) ──
async function _cargasGuardarSeccion(cliente, periodo, r){
  var spec = _cargasSpec.secciones[r.hoja];
  var payload = { cliente: cliente, seccion: r.hoja, cadencia: spec.cadencia, periodo: periodo, archivoNombre: _cargasArchivoNombre, filas: r.filas };
  try{
    await apiRequest('POST','/dashboard/cargas', payload);
    return { ok:true };
  }catch(e){
    if(e && e.status===409 && e.data && e.data.yaExiste){
      var d=e.data;
      var quien=d.cargadoPorNombre ? (' por '+d.cargadoPorNombre) : '';
      var cuando=d.cargadoEn ? (' el '+d.cargadoEn) : '';
      if(!confirm('Ya existe una carga para '+d.cliente+' / '+d.seccion+' / '+d.periodo+
                  ' (cargada'+quien+cuando+'). ¿Reemplazarla con este archivo?')){
        return { ok:false, mensaje: 'Se dejo la carga anterior sin tocar.' };
      }
      try{
        await apiRequest('POST','/dashboard/cargas', Object.assign({}, payload, { reemplazar:true }));
        return { ok:true };
      }catch(e2){ return { ok:false, mensaje: e2.message }; }
    }
    return { ok:false, mensaje: e.message };
  }
}

async function _cargasGuardarCalidad(cliente, r){
  try{
    var resp = await apiRequest('POST','/monitoreos/bulk', { campana: cliente, archivoNombre: _cargasArchivoNombre, filas: r.filas });
    return { ok:true, mensaje: (resp.insertadas||0)+' nueva(s), '+(resp.actualizadas||0)+' actualizada(s), '+(resp.omitidas||0)+' omitida(s)' };
  }catch(e){ return { ok:false, mensaje: e.message }; }
}

async function _cargasGuardarTrafico(r){
  var parsed = { archivoNombre: _cargasArchivoNombre, filas: r.filas };
  try{
    var impacto = await apiRequest('POST','/calidad/trafico/carga/impacto', parsed);
    var afectados = (impacto||[]).filter(function(p){ return p.filasExistentes>0; });
    if(afectados.length){
      var detalle = afectados.map(function(p){ return '• ' + p.skillName + ' — ' + p.mes + ': ' + p.filasExistentes + ' registro(s) existentes'; }).join('\n');
      var total = afectados.reduce(function(a,p){ return a+p.filasExistentes; }, 0);
      if(!confirm('La hoja de Trafico va a REEMPLAZAR '+total+' registro(s) ya cargados:\n\n'+detalle+'\n\n¿Continuar?')){
        return { ok:false, mensaje: 'Se dejo el trafico anterior sin tocar.' };
      }
    }
  }catch(e){ return { ok:false, mensaje: e.message }; }
  try{
    var resp = await apiRequest('POST','/calidad/trafico/carga', parsed);
    _trafico = {}; // invalida el cache de los paneles trafico_combo abiertos
    return { ok:true, mensaje: resp.insertadas+' fila(s) en '+resp.campanas.length+' campana(s)'+
      (resp.skillsSinAsignar && resp.skillsSinAsignar.length ? '. '+resp.skillsSinAsignar.length+' skill(s) sin asignar' : '') };
  }catch(e){ return { ok:false, mensaje: e.message }; }
}

async function guardarCarga(){
  if(!_cargasResultados.length){ showToast('Primero sube un archivo'); return; }
  var cliente = document.getElementById('carga-cliente').value;
  var conDatos = _cargasResultados.filter(function(r){ return r.filas; });
  if(!conDatos.length){ showToast('No hay ninguna hoja lista para guardar'); return; }

  var necesitaPeriodo = conDatos.some(function(r){ return r.tipo==='seccion'; });
  var periodo = document.getElementById('carga-periodo').value;
  if(necesitaPeriodo && !periodo){
    showToast('Indica el periodo (mes) para guardar las hojas de Gestion de base');
    return;
  }

  var btn = document.querySelector('#carga-preview-card .btn-primary');
  var resumen = [];
  await withButtonLoading(btn, 'Guardando...', async function(){
    for(var i=0;i<conDatos.length;i++){
      var r = conDatos[i];
      var res;
      if(r.tipo==='seccion') res = await _cargasGuardarSeccion(cliente, periodo, r);
      else if(r.tipo==='calidad') res = await _cargasGuardarCalidad(cliente, r);
      else res = await _cargasGuardarTrafico(r);
      resumen.push((res.ok ? '✓ ' : '✗ ') + r.titulo + (res.mensaje ? ': '+res.mensaje : ''));
    }
  });
  showToast(resumen.join('\n'));
  cancelarPreviewCarga();
  renderCargasExistentes();
}

async function renderCargasExistentes(){
  var tbl = document.getElementById('carga-existentes-table');
  if(!tbl) return;
  var cliente = document.getElementById('carga-cliente').value;
  var rows = [];
  if(cliente){
    try{ rows = await apiRequest('GET','/dashboard/cargas?cliente='+encodeURIComponent(cliente)) || []; }
    catch(e){ /* silencioso */ }
  }
  var html = '<tr><th>Seccion</th><th>Periodo</th><th>Cadencia</th><th>Filas</th><th>Cargado por</th><th>Fecha</th><th></th></tr>';
  if(rows.length===0){
    html += '<tr><td colspan="7" style="text-align:center;color:#7a9ba8">Sin cargas de Gestion de base todavia</td></tr>';
  } else {
    rows.forEach(function(c){
      var titulo = (_cargasSpec && _cargasSpec.secciones[c.seccion]) ? _cargasSpec.secciones[c.seccion].titulo : c.seccion;
      html += '<tr><td>'+esc(titulo)+'</td><td>'+esc(c.periodo)+'</td><td>'+esc(c.cadencia)+'</td><td>'+(c.filas?c.filas.length:0)+'</td>'+
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
