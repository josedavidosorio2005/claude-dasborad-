// historial.js — InConexion Platform. Extraído de index.html (antes un único <script>).
// Se carga como <script src> global y en orden; todas las funciones son globales
// y se invocan desde manejadores del HTML. No cambiar el orden de carga.

// HISTORIAL RENDER
// ═══════════════════════════════════════════════════════════
// Filtro de texto + filtro por tipo de accion. Compartido por la tabla
// (renderHist) y la descarga (exportHistorial) para que se exporte exactamente
// lo que se ve en pantalla.
function _histApplyFilters(list,filter,tipo){
  filter=(filter||'').toLowerCase(); tipo=tipo||'';
  if(filter) list=list.filter(function(h){
    return (h.nombre||'').toLowerCase().includes(filter)||
           (h.username||'').toLowerCase().includes(filter)||
           (h.actor||'').toLowerCase().includes(filter)||
           (h.detalle||'').toLowerCase().includes(filter)||
           (h.accion||'').toLowerCase().includes(filter);
  });
  // Fase 113 (tema A): "Inicios de sesion" agrupa los 3 eventos de
  // autenticacion en un solo filtro (en pantalla y en la descarga).
  if(tipo==='__LOGINS__') list=list.filter(function(h){
    return h.accion==='LOGIN_OK'||h.accion==='LOGIN_FALLIDO'||h.accion==='LOGIN_BLOQUEADO'||h.accion==='LOGOUT'; // Fase 178: + bloqueado
  });
  else if(tipo) list=list.filter(function(h){return h.accion===tipo;});
  return list;
}
function renderHist(filter,tipo){
  filter=(filter||'').toLowerCase(); tipo=tipo||'';
  var tbody=document.getElementById('hist-tbody');
  var noRes=document.getElementById('hist-no-results');
  var list=_histApplyFilters(historial.slice().reverse(),filter,tipo);
  var countEl=document.getElementById('hist-count');
  if(countEl) countEl.textContent=histTextoConteo(historialInfo, historial.length);
  var aviso=document.getElementById('hist-aviso');
  if(aviso){ var t=histTextoRecorte(historialInfo); aviso.textContent=t; aviso.classList.toggle('hidden',!t); }
  if(!list.length){
    tbody.innerHTML='';
    noRes.innerHTML = (historial.length===0)
      ? '<div class="empty-state"><div class="es-icon">&#128203;</div>'+
        '<div class="es-title">Sin eventos todavia</div>'+
        '<div class="es-hint">Las acciones sobre usuarios (crear, editar, suspender, cambiar permisos...) se registran aqui automaticamente.</div></div>'
      : '<div class="empty-state"><div class="es-icon">&#128269;</div>'+
        '<div class="es-title">Sin coincidencias</div>'+
        '<div class="es-hint">Ningun evento coincide con el texto o el filtro aplicado.</div></div>';
    noRes.classList.remove('hidden');
    return;
  }
  noRes.classList.add('hidden');
  tbody.innerHTML=list.map(function(h){
    return '<tr>'+
      '<td style="white-space:nowrap;font-size:0.79rem;color:var(--c-text-2)">'+esc(h.fecha)+'</td>'+
      '<td><strong style="color:var(--c-primary);font-size:0.84rem">'+esc(h.nombre)+'</strong><br>'+
        '<span style="font-size:var(--fs-note);color:var(--c-text-muted);font-family:monospace">@'+esc(h.username)+'</span></td>'+
      '<td style="font-size:0.78rem;color:var(--c-text)">'+esc(h.rol)+'</td>'+
      '<td><span class="hist-badge hb-'+esc(h.accion)+'">'+esc(h.accion)+'</span></td>'+
      '<td style="font-size:0.82rem;color:var(--c-text)">'+esc(h.actor)+'</td>'+
      '<td style="font-size:0.80rem;color:var(--c-text-2);max-width:220px">'+esc(h.detalle)+'</td>'+
      '</tr>';
  }).join('');
}
function filterHist(){
  renderHist(document.getElementById('hist-search').value,document.getElementById('hist-filter').value);
}
// 25/11/2026: tipo y fechas se filtran en el servidor (vuelve a pedir); el texto, sobre lo que llegó.
async function filterHistServidor(){
  var d=document.getElementById('hist-desde'), h=document.getElementById('hist-hasta');
  if(d && h && d.value && h.value && d.value>h.value){ showToast('La fecha «Desde» es posterior a «Hasta».'); return; }
  await loadHist();
  filterHist();
}
// Parámetros del servidor según los filtros de la pestaña (tipo y fechas). Puro, para las pruebas (state.js la usa en loadHist).
function histConsulta(tipo, desde, hasta) {
  var q = ['con_total=1'];
  if (tipo) q.push('tipo=' + encodeURIComponent(tipo));
  if (/^\d{4}-\d{2}-\d{2}$/.test(desde || '')) q.push('desde=' + desde);
  if (/^\d{4}-\d{2}-\d{2}$/.test(hasta || '')) q.push('hasta=' + hasta);
  return '/historial?' + q.join('&');
}
// Textos del conteo y del aviso de recorte (puros, para las pruebas).
function _histNum(n){ return Number(n||0).toLocaleString('es-CO'); }
function histTextoConteo(info, cargadas){
  info=info||{};
  var filtrado=(info.totalFiltrado||0)!==(info.total||0);
  if(info.recortado) return 'Se muestran '+_histNum(cargadas)+' de '+_histNum(info.totalFiltrado)+' eventos'+(filtrado?' (de '+_histNum(info.total)+' en total)':'');
  return _histNum(info.totalFiltrado)+' evento'+(info.totalFiltrado===1?'':'s')+(filtrado?' de '+_histNum(info.total)+' en total':' en total');
}
function histTextoRecorte(info){
  if(!info||!info.recortado) return '';
  return 'Se muestran los '+_histNum(info.limite)+' eventos más recientes. Para ver los anteriores, elige un tipo de evento o un rango de fechas.';
}
if (typeof module !== 'undefined' && module.exports) module.exports = { histConsulta: histConsulta, histTextoConteo: histTextoConteo, histTextoRecorte: histTextoRecorte };

// Descarga el historial (lo que este filtrado en pantalla) a un .xlsx.
// Mismo patron que _gdExportExcel de dashboard-generic.js (XLSX ya cargado).
function exportHistorial(){
  if(typeof XLSX === 'undefined'){ showToast('No se pudo cargar el generador de Excel.'); return; }
  var filter=document.getElementById('hist-search').value;
  var tipo=document.getElementById('hist-filter').value;
  var list=_histApplyFilters(historial.slice().reverse(),filter,tipo);
  if(!list.length){ showToast('No hay eventos para descargar con el filtro actual.'); return; }
  var rows=list.map(function(h){
    return {
      'Fecha y hora': h.fecha||'',
      'Usuario afectado': h.nombre||'',
      'Usuario (@)': h.username||'',
      'Rol': h.rol||'',
      'Accion': h.accion||'',
      'Realizado por': h.actor||'',
      'Detalle': h.detalle||''
    };
  });
  var wb=XLSX.utils.book_new();
  var ws=XLSX.utils.json_to_sheet(xlsxFilasSeguras(rows));
  ws['!cols']=[{wch:20},{wch:24},{wch:16},{wch:14},{wch:16},{wch:24},{wch:40}];
  XLSX.utils.book_append_sheet(wb,ws,'Historial');
  XLSX.writeFile(wb,'Historial_InConexion_'+gdHoyLocal()+'.xlsx');
  showToast('Historial descargado ('+list.length+' evento'+(list.length===1?'':'s')+').');
}

// ═══════════════════════════════════════════════════════════
