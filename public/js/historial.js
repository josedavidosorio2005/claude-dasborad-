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
  if(tipo) list=list.filter(function(h){return h.accion===tipo;});
  return list;
}
function renderHist(filter,tipo){
  filter=(filter||'').toLowerCase(); tipo=tipo||'';
  var tbody=document.getElementById('hist-tbody');
  var noRes=document.getElementById('hist-no-results');
  var list=_histApplyFilters(historial.slice().reverse(),filter,tipo);
  var countEl=document.getElementById('hist-count');
  if(countEl) countEl.textContent=historial.length+' eventos totales';
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
        '<span style="font-size:0.74rem;color:var(--c-text-muted);font-family:monospace">@'+esc(h.username)+'</span></td>'+
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
  var ws=XLSX.utils.json_to_sheet(rows);
  ws['!cols']=[{wch:20},{wch:24},{wch:16},{wch:14},{wch:16},{wch:24},{wch:40}];
  XLSX.utils.book_append_sheet(wb,ws,'Historial');
  XLSX.writeFile(wb,'Historial_InConexion_'+new Date().toISOString().slice(0,10)+'.xlsx');
  showToast('Historial descargado ('+list.length+' evento'+(list.length===1?'':'s')+').');
}

// ═══════════════════════════════════════════════════════════
