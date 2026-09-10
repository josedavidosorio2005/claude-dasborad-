// historial.js — InConexion Platform. Extraído de index.html (antes un único <script>).
// Se carga como <script src> global y en orden; todas las funciones son globales
// y se invocan desde manejadores del HTML. No cambiar el orden de carga.

// HISTORIAL RENDER
// ═══════════════════════════════════════════════════════════
function renderHist(filter,tipo){
  filter=(filter||'').toLowerCase(); tipo=tipo||'';
  var tbody=document.getElementById('hist-tbody');
  var noRes=document.getElementById('hist-no-results');
  var list=historial.slice().reverse();
  if(filter) list=list.filter(function(h){
    return (h.nombre||'').toLowerCase().includes(filter)||
           (h.username||'').toLowerCase().includes(filter)||
           (h.actor||'').toLowerCase().includes(filter)||
           (h.detalle||'').toLowerCase().includes(filter)||
           (h.accion||'').toLowerCase().includes(filter);
  });
  if(tipo) list=list.filter(function(h){return h.accion===tipo;});
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
      '<td style="white-space:nowrap;font-size:0.79rem;color:#5b7a8a">'+esc(h.fecha)+'</td>'+
      '<td><strong style="color:#0d4a5e;font-size:0.84rem">'+esc(h.nombre)+'</strong><br>'+
        '<span style="font-size:0.74rem;color:#7a9ba8;font-family:monospace">@'+esc(h.username)+'</span></td>'+
      '<td style="font-size:0.78rem;color:#2a4a58">'+esc(h.rol)+'</td>'+
      '<td><span class="hist-badge hb-'+esc(h.accion)+'">'+esc(h.accion)+'</span></td>'+
      '<td style="font-size:0.82rem;color:#2a4a58">'+esc(h.actor)+'</td>'+
      '<td style="font-size:0.80rem;color:#5b7a8a;max-width:220px">'+esc(h.detalle)+'</td>'+
      '</tr>';
  }).join('');
}
function filterHist(){
  renderHist(document.getElementById('hist-search').value,document.getElementById('hist-filter').value);
}

// ═══════════════════════════════════════════════════════════
