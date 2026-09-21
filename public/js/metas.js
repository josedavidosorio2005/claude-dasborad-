// metas.js — InConexion Platform.
// Se carga como <script src> global y en orden; todas las funciones son globales
// y se invocan desde manejadores del HTML. No cambiar el orden de carga.
//
// MIGRADO A SERVIDOR (REAL_DATA_REPORT.md, Fase 1): el cronograma de metas vive
// en la tabla cronograma_metas. Endpoints: GET/POST/PUT/DELETE /api/metas.
// El servidor recalcula meta por asesor / diaria / semanales al guardar.

// Fase 37 (2026-09-18): las 9 tarjetas de esta pantalla (cronograma, nivel
// de servicio manual/Excel/historial, Trafico-Wolkvox y su mapeo de
// skills) vivian todas apiladas sueltas, sin agrupar -- de ahi la
// sensacion de "pantallas separadas" reportada desde la Fase 1. Se
// agrupan en 3 sub-pestanas (mismo patron visual .aurora-tabs/.atab que
// ya usan los dashboards de cliente, dashboard-generic.js) SIN tocar
// ningun formulario/tabla: solo se envuelve su HTML existente en 3 divs y
// se alterna cual esta visible. Los render*() de cada tarjeta siguen
// corriendo igual (renderMetasSection ya los llama a todos de una vez al
// abrir la pantalla), esto solo decide cual grupo se ve.
function switchMetasTab(key){
  ['cronograma','nivelservicio','trafico'].forEach(function(k){
    var panel = document.getElementById('metas-panel-'+k);
    if(panel) panel.classList.toggle('hidden', k!==key);
  });
  document.querySelectorAll('#metas-tabs .atab').forEach(function(btn){
    btn.classList.toggle('atab-active', btn.dataset.metastab===key);
  });
}

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
  renderNivelServicioSection();
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
      candidatos.map(function(u){ return '<option value="'+u.id+'">'+esc(u.nombre)+' ('+esc(u.rol)+')</option>'; }).join('');
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
    return '<tr><td>'+esc(r.liderNombre||'Sin asignar')+'</td><td>'+esc(r.campana)+'</td><td>'+esc(r.mes)+'</td><td>'+r.asesores+'</td><td>'+r.diasLaborales+'</td>'+
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

// ═══════════════════════════════════════════════════════════
// ADMIN — NIVEL DE SERVICIO (feedback de Edwin, punto 3.2)
// % de llamadas contestadas en <=20s sobre el total, por campana/mes.
// Mismo patron que el cronograma de metas de arriba.
// ═══════════════════════════════════════════════════════════
var _nivelServicioAll = [];
var _editingNivelServicioId = null;

async function renderNivelServicioSection(){
  try{
    _nivelServicioAll = (await apiRequest('GET','/calidad/nivel-servicio')) || [];
  }catch(e){ _nivelServicioAll = []; showToast('No se pudo cargar el nivel de servicio: '+e.message); }

  var sel = document.getElementById('ns-campana-sel');
  if(sel) sel.innerHTML = CAMPANAS_CON_PLANTILLA.map(function(c){ return '<option value="'+c+'">'+c+'</option>'; }).join('');
  var nsdSel = document.getElementById('nsd-campana-sel');
  if(nsdSel) nsdSel.innerHTML = CAMPANAS_CON_PLANTILLA.map(function(c){ return '<option value="'+c+'">'+c+'</option>'; }).join('');
  // Trafico de WhatsApp (Fase 50): alcance actual solo ORLANT, pero se puebla
  // igual desde el catalogo real (no un <option> fijo) para no reescribir
  // esto cuando se agregue otra campana con esta plantilla.
  var twwSel = document.getElementById('tww-campana-sel');
  if(twwSel) twwSel.innerHTML = CAMPANAS_CON_PLANTILLA.map(function(c){ return '<option value="'+c+'">'+c+'</option>'; }).join('');
  var monthInput = document.getElementById('ns-mes-input');
  if(monthInput && !monthInput.value) monthInput.value = new Date().toISOString().slice(0,7);

  var mesFilter = document.getElementById('ns-mes-filter');
  if(mesFilter){
    var meses = [];
    _nivelServicioAll.forEach(function(r){ if(meses.indexOf(r.mes)===-1) meses.push(r.mes); });
    meses.sort().reverse();
    var prev = mesFilter.value;
    mesFilter.innerHTML = '<option value="">Todos los meses</option>' + meses.map(function(m){ return '<option value="'+m+'">'+m+'</option>'; }).join('');
    if(prev && meses.indexOf(prev)!==-1) mesFilter.value = prev;
  }

  // Filtro de Campana (Fase 37) -- un ADMIN completo veia aqui filas de
  // TODAS las campanas mezcladas sin poder filtrar (gap anotado en la Fase
  // 34 de PROGRESS.md). Mismo patron que el filtro de mes de arriba:
  // opciones derivadas de los datos reales (incluye "(SIN ASIGNAR)" si
  // Trafico dejo alguna skill sin mapear), no de un catalogo fijo.
  var campFilter = document.getElementById('ns-campana-filter');
  if(campFilter){
    var campanas = [];
    _nivelServicioAll.forEach(function(r){ if(campanas.indexOf(r.campana)===-1) campanas.push(r.campana); });
    campanas.sort();
    var prevCamp = campFilter.value;
    campFilter.innerHTML = '<option value="">Todas las campanas</option>' + campanas.map(function(c){ return '<option value="'+esc(c)+'">'+esc(c)+'</option>'; }).join('');
    if(prevCamp && campanas.indexOf(prevCamp)!==-1) campFilter.value = prevCamp;
  }

  previewNivelServicio();
  renderNivelServicioHistory();
  if(typeof renderTraficoSkills === 'function') renderTraficoSkills();
  if(typeof renderTraficoCobertura === 'function') renderTraficoCobertura();
}

function previewNivelServicio(){
  var contestadasEl = document.getElementById('ns-contestadas-input');
  var totalesEl = document.getElementById('ns-totales-input');
  var pv = document.getElementById('ns-preview');
  if(!contestadasEl || !totalesEl || !pv) return;
  var contestadas = Number(contestadasEl.value)||0;
  var totales = Number(totalesEl.value)||0;
  var pct = totales>0 ? Math.round((contestadas/totales)*1000)/10 : null;
  var cumple = pct===null ? '—' : (pct>=80 ? 'CUMPLE' : 'NO CUMPLE');
  pv.innerHTML = '<div class="qi-pill"><div class="qv">'+(pct===null?'—':pct+'%')+'</div><div class="ql">NIVEL DE SERVICIO — '+cumple+' (meta 80%)</div></div>';
}

function renderNivelServicioHistory(){
  var filterEl = document.getElementById('ns-mes-filter');
  var filter = filterEl ? filterEl.value : '';
  var campFilterEl = document.getElementById('ns-campana-filter');
  var campFilter = campFilterEl ? campFilterEl.value : '';
  var rows = _nivelServicioAll.filter(function(r){
    return (!filter || r.mes===filter) && (!campFilter || r.campana===campFilter);
  });
  rows.sort(function(a,b){ return b.mes.localeCompare(a.mes) || a.campana.localeCompare(b.campana); });
  var tbody = document.getElementById('ns-history-tbody');
  var noRes = document.getElementById('ns-no-results');
  if(!tbody || !noRes) return;
  if(rows.length===0){
    tbody.innerHTML='';
    noRes.classList.remove('hidden');
    return;
  }
  noRes.classList.add('hidden');
  tbody.innerHTML = rows.map(function(r){
    var pctTxt = r.pct===null ? '—' : r.pct+'%';
    var cumpleTxt = r.cumple===null ? '—' : (r.cumple ? '🟢 SI' : '🔴 NO');
    // Campanas multi-sede (ej. HOSPITAL LA MARIA) pueden tener 2 filas del
    // mismo (campana, mes) — una por sede, nunca sumadas (ver
    // docs/ARQUITECTURA.md). Sin mostrar la sede aqui, esas 2 filas se
    // verian como un duplicado/error; se muestra entre parentesis.
    var campanaTxt = r.campana + (r.sede ? ' (' + r.sede + ')' : '');
    return '<tr><td>'+esc(campanaTxt)+'</td><td>'+esc(r.mes)+'</td><td>'+r.contestadas20s+'</td><td>'+r.llamadasTotales+'</td>'+
      '<td class="peak">'+esc(pctTxt)+'</td><td>'+esc(cumpleTxt)+'</td>'+
      '<td><button class="btn-sm btn-edit" onclick="editNivelServicio('+r.id+')">Editar</button> '+
      '<button class="btn-sm btn-delete" onclick="deleteNivelServicio('+r.id+')">Eliminar</button></td></tr>';
  }).join('');
}

function editNivelServicio(id){
  if(!isFullAdmin()){ showToast('Solo el administrador puede editar el nivel de servicio'); return; }
  var row = _nivelServicioAll.find(function(r){ return r.id===id; });
  if(!row){ showToast('No se encontro el registro a editar'); return; }
  _editingNivelServicioId = id;
  document.getElementById('ns-campana-sel').value = row.campana;
  document.getElementById('ns-mes-input').value = row.mes;
  document.getElementById('ns-contestadas-input').value = row.contestadas20s;
  document.getElementById('ns-totales-input').value = row.llamadasTotales;
  previewNivelServicio();
  showToast('Editando nivel de servicio de '+row.campana+' ('+row.mes+') — modifique y presione Guardar');
}

async function saveNivelServicio(){
  if(!isFullAdmin()){ showToast('Solo el administrador puede cargar el nivel de servicio'); return; }
  var camp = document.getElementById('ns-campana-sel').value;
  var mes = document.getElementById('ns-mes-input').value;
  var contestadas = parseInt(document.getElementById('ns-contestadas-input').value,10);
  var totales = parseInt(document.getElementById('ns-totales-input').value,10);
  if(!mes){ showToast('Seleccione el mes'); return; }
  if(isNaN(contestadas) || contestadas<0){ showToast('Ingrese las llamadas contestadas en <=20s'); return; }
  if(!totales || totales<1){ showToast('Ingrese el total de llamadas del mes'); return; }
  if(contestadas>totales){ showToast('Las llamadas contestadas no pueden superar el total'); return; }

  var body = { campana: camp, mes: mes, contestadas20s: contestadas, llamadasTotales: totales };
  var btn = document.getElementById('ns-save-btn');
  try{
    await withButtonLoading(btn, 'Guardando...', async function(){
      if(_editingNivelServicioId && !_nsMovio(camp, mes)){
        await apiRequest('PUT','/calidad/nivel-servicio/'+_editingNivelServicioId, body);
      } else {
        // POST hace upsert por (campana, mes); si se movio de celda, borramos
        // la fila original para no dejar un duplicado huerfano.
        if(_editingNivelServicioId) { try{ await apiRequest('DELETE','/calidad/nivel-servicio/'+_editingNivelServicioId); }catch(e){} }
        await apiRequest('POST','/calidad/nivel-servicio', body);
      }
    });
  }catch(e){ showToast(e.message); return; }
  showToast((_editingNivelServicioId?'Nivel de servicio actualizado para ':'Nivel de servicio guardado para ')+camp+' — '+mes);
  _editingNivelServicioId = null;
  await renderNivelServicioSection();
}

// true si al editar cambiaron campana/mes (la fila "se movio de celda")
function _nsMovio(camp, mes){
  var orig = _nivelServicioAll.find(function(r){ return r.id===_editingNivelServicioId; });
  if(!orig) return true;
  return orig.campana!==camp || orig.mes!==mes;
}

async function deleteNivelServicio(id){
  if(!isFullAdmin()){ showToast('Solo el administrador puede eliminar el nivel de servicio'); return; }
  if(!confirm('Eliminar este registro de nivel de servicio?')) return;
  try{
    await apiRequest('DELETE','/calidad/nivel-servicio/'+id);
  }catch(e){ showToast(e.message); return; }
  if(_editingNivelServicioId===id) _editingNivelServicioId = null;
  await renderNivelServicioSection();
}

// ═══════════════════════════════════════════════════════════
// ADMIN — NIVEL DE SERVICIO: CARGA DIARIA DESDE EXCEL (Fase 1 del pedido de
// carga real). Mismo patron de parseo/preview que cargas.js (_colPorLabel,
// XLSX.read en el navegador, preview antes de confirmar): el servidor solo
// recibe filas ya parseadas como JSON, nunca parsea Excel.
// ═══════════════════════════════════════════════════════════
var _nsdParsed = null;   // { campana, archivoNombre, filas } listo para POST

var NSD_COLUMNAS = [
  { key: 'skillName', label: 'SKILL_NAME' },
  { key: 'fecha', label: 'DATE' },
  { key: 'totalLlamadas', label: 'TOTAL LLAMADAS' },
  { key: 'contestadas', label: 'LLAMADAS CONTESTADAS' },
  { key: 'serviceLevel20secPct', label: 'SERVICE_LEVEL_20SEC' },
];
var NSD_LABELS_OBLIGATORIAS = ['skillName', 'fecha', 'totalLlamadas', 'contestadas'];

function _nsdNorm(s){ return String(s==null?'':s).trim().toLowerCase(); }
function _nsdColPorLabel(label){
  var n = _nsdNorm(label);
  return NSD_COLUMNAS.find(function(c){ return _nsdNorm(c.label)===n; }) || null;
}
function _nsdColIndexMap(headerRow){
  var map = {};
  (headerRow||[]).forEach(function(h, i){
    var col = _nsdColPorLabel(h);
    if(col && map[col.key]===undefined) map[col.key] = i;
  });
  return map;
}

// DATE: puede venir como fecha nativa de Excel (con {cellDates:true} llega
// como objeto Date, construido por la libreria en UTC — por eso toISOString
// da el dia correcto sin importar la zona horaria del navegador) o como texto.
function _nsdParseFecha(v){
  if(v instanceof Date && !isNaN(v)) return v.toISOString().slice(0,10);
  if(typeof v==='string'){
    var t = v.trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    var d = new Date(t);
    if(!isNaN(d)) return d.toISOString().slice(0,10);
  }
  return null;
}

// SERVICE_LEVEL_20SEC viene como texto '87.03 %' (o similar). Celda vacia o
// no parseable -> null (no 0: 0% de nivel de servicio es un dato real y muy
// distinto de "no hay dato ese dia").
function _nsdParsePct(v){
  if(v===null || v===undefined || v==='') return null;
  if(typeof v==='number') return v;
  var s = String(v).replace('%','').trim().replace(',', '.');
  if(s==='') return null;
  var n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function _nsdParseRows(aoa){
  if(!aoa || !aoa.length) return { error: 'El archivo esta vacio' };
  var map = _nsdColIndexMap(aoa[0]);
  var faltantes = NSD_LABELS_OBLIGATORIAS.filter(function(k){ return map[k]===undefined; });
  if(faltantes.length){
    var labels = faltantes.map(function(k){ return NSD_COLUMNAS.find(function(c){ return c.key===k; }).label; });
    return { error: 'Faltan columnas obligatorias: '+labels.join(', ')+'. Revisa los encabezados del archivo.' };
  }
  var filas = [];
  var avisos = [];
  for(var i=1;i<aoa.length;i++){
    var row = aoa[i];
    if(!row || row.every(function(v){ return v===''||v==null; })) continue;
    var fecha = _nsdParseFecha(row[map.fecha]);
    var skillName = row[map.skillName]==null ? '' : String(row[map.skillName]).trim();
    var totalLlamadas = Number(row[map.totalLlamadas]);
    var contestadas = Number(row[map.contestadas]);
    var pct = map.serviceLevel20secPct===undefined ? null : _nsdParsePct(row[map.serviceLevel20secPct]);
    var fila = (i+1);
    if(!fecha){ avisos.push('Fila '+fila+': fecha invalida, se omitio.'); continue; }
    if(!skillName){ avisos.push('Fila '+fila+': SKILL_NAME vacio, se omitio.'); continue; }
    if(!isFinite(totalLlamadas) || totalLlamadas<0){ avisos.push('Fila '+fila+' ('+fecha+'): TOTAL LLAMADAS invalido, se omitio.'); continue; }
    if(!isFinite(contestadas) || contestadas<0){ avisos.push('Fila '+fila+' ('+fecha+'): LLAMADAS CONTESTADAS invalido, se omitio.'); continue; }
    if(contestadas>totalLlamadas){ avisos.push('Fila '+fila+' ('+fecha+'): contestadas ('+contestadas+') supera el total ('+totalLlamadas+'), se omitio.'); continue; }
    filas.push({ fecha: fecha, skillName: skillName, totalLlamadas: totalLlamadas, contestadas: contestadas, serviceLevel20secPct: pct });
  }
  if(filas.length===0) return { error: 'El archivo no tiene filas de datos validas.' };
  return { filas: filas, avisos: avisos };
}

async function procesarArchivoNivelServicioDiario(input){
  var campana = document.getElementById('nsd-campana-sel').value;
  if(!campana){ showToast('Selecciona una campana primero'); input.value=''; return; }
  var file = input.files && input.files[0];
  if(!file) return;

  var buf;
  try{ buf = await file.arrayBuffer(); }
  catch(e){ showToast('No se pudo leer el archivo'); return; }
  var wb, aoa;
  try{
    wb = XLSX.read(new Uint8Array(buf), { type:'array', cellDates:true });
    var sheetName = wb.SheetNames.indexOf('DATA')!==-1 ? 'DATA' : wb.SheetNames[0];
    var ws = wb.Sheets[sheetName];
    aoa = XLSX.utils.sheet_to_json(ws, { header:1, blankrows:false, defval:null });
  }catch(e){ showToast('El archivo no es un Excel valido'); input.value=''; return; }

  var res = _nsdParseRows(aoa);
  if(res.error){ showToast(res.error); input.value=''; return; }

  _nsdParsed = { campana: campana, archivoNombre: file.name, filas: res.filas };
  _renderPreviewNivelServicioDiario(file.name, res.filas, res.avisos||[]);
}

function _renderPreviewNivelServicioDiario(nombre, filas, avisos){
  document.getElementById('nsd-errores').innerHTML = avisos.map(function(a){ return '&#9888; '+esc(a); }).join('<br>');
  var html = filas.slice(0,60).map(function(f){
    var pctTxt = f.serviceLevel20secPct===null ? '—' : f.serviceLevel20secPct+'%';
    return '<tr><td>'+esc(f.fecha)+'</td><td>'+esc(f.skillName)+'</td><td>'+f.totalLlamadas+'</td><td>'+f.contestadas+'</td><td>'+esc(pctTxt)+'</td></tr>';
  }).join('');
  if(filas.length>60) html += '<tr><td colspan="5" style="text-align:center;color:var(--c-text-muted)">… y '+(filas.length-60)+' filas mas</td></tr>';
  document.getElementById('nsd-preview-tbody').innerHTML = html;
  document.getElementById('nsd-preview-card').style.display = '';
}

function cancelarPreviewNivelServicioDiario(){
  _nsdParsed = null;
  document.getElementById('nsd-preview-card').style.display = 'none';
  document.getElementById('nsd-file').value = '';
  document.getElementById('nsd-errores').innerHTML = '';
}

async function guardarNivelServicioDiario(){
  if(!_nsdParsed){ showToast('Primero sube un archivo'); return; }
  var btn = document.getElementById('nsd-save-btn');
  var resp;
  try{
    resp = await withButtonLoading(btn, 'Guardando...', function(){ return apiRequest('POST','/calidad/nivel-servicio/carga-diaria', _nsdParsed); });
  }catch(e){ showToast(e.message); return; }
  var meses = ((resp && resp.mensual) || []).map(function(m){ return m.mes; }).join(', ');
  showToast('Carga guardada: '+((resp && resp.diario && resp.diario.insertadas) || 0)+' fila(s). Mes(es) recalculado(s): '+(meses||'-'));
  cancelarPreviewNivelServicioDiario();
  await renderNivelServicioSection();
}
