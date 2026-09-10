// reportes.js — InConexion Platform. Extraído de index.html (antes un único <script>).
// Se carga como <script src> global y en orden; todas las funciones son globales
// y se invocan desde manejadores del HTML. No cambiar el orden de carga.

// ═══════════════════════════════════════════════════════════
// ADMIN — ROL REPORTES: permisos por campana
// ═══════════════════════════════════════════════════════════
function renderReportesRoleSection(filter){
  var thead = document.getElementById('reportes-perm-thead');
  var cols = ['Usuario'].concat(CAMPANAS_CALIDAD).concat(['Estado']);
  thead.innerHTML = cols.map(function(c){ return '<th>'+c+'</th>'; }).join('');
  var rows = users.filter(function(u){ return u.rol==='REPORTES'; });
  if(filter){
    var f = filter.toLowerCase();
    rows = rows.filter(function(u){ return u.nombre.toLowerCase().indexOf(f)>=0 || u.user.toLowerCase().indexOf(f)>=0; });
  }
  var tbody = document.getElementById('reportes-perm-tbody');
  var noRes = document.getElementById('reportes-no-results');
  if(rows.length===0){
    tbody.innerHTML='';
    noRes.classList.remove('hidden');
    return;
  }
  noRes.classList.add('hidden');
  tbody.innerHTML = rows.map(function(u){
    var cells = '<td>'+esc(u.nombre)+' (@'+esc(u.user)+')</td>';
    CAMPANAS_CALIDAD.forEach(function(c){
      var checked = u.perms['campana_'+c]===true;
      cells += '<td><input type="checkbox" '+(checked?'checked':'')+' onchange="toggleReportesCampana('+u.id+',\''+c+'\',this.checked)"></td>';
    });
    cells += '<td>'+(u.active?'Activo':'Suspendido')+'</td>';
    return '<tr>'+cells+'</tr>';
  }).join('');
}
function filterReportesUsers(){ renderReportesRoleSection(document.getElementById('reportes-user-search').value); }
function toggleReportesCampana(userId, camp, val){
  if(!isFullAdmin() && !can('gestionPermisos')){ showToast('Sin permiso para gestionar permisos'); renderReportesRoleSection(); return; }
  var u = users.find(function(x){return x.id===userId;}); if(!u) return;
  u.perms['campana_'+camp] = val===true;
  persistPerms(u, 'campana '+camp, val?'Otorgado':'Revocado');
}
