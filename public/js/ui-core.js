// ui-core.js — InConexion Platform. Extraído de index.html (antes un único <script>).
// Se carga como <script src> global y en orden; todas las funciones son globales
// y se invocan desde manejadores del HTML. No cambiar el orden de carga.

// PERMISSION HELPERS
// ═══════════════════════════════════════════════════════════
function isMasterAdmin(){ return currentUser===null; }
function isFullAdmin(){
  return currentUser===null || (currentUser && currentUser.rol==='ADMIN');
}
function can(action){
  if (isFullAdmin()) return true;
  if (!currentUser) return false;
  return currentUser.perms[action]===true;
}
function canAccessRole(rk){
  if (isFullAdmin()) return true;
  if (!currentUser) return false;
  return currentUser.perms['role_'+rk]===true;
}
function canLoadData(){
  if (isFullAdmin()) return true;
  return !!(currentUser && currentUser.perms && currentUser.perms.cargarDatos===true);
}
function applyCreateBtn(){
  var btn=document.getElementById('btn-create-user');
  var ok=isFullAdmin()||can('crearUsuarios');
  btn.disabled=!ok; btn.classList.toggle('blocked',!ok);
  btn.style.opacity=ok?'1':'0.5'; btn.style.cursor=ok?'pointer':'not-allowed';
}

// ═══════════════════════════════════════════════════════════
// RESPONSIVE: sidebar off-canvas + menu de perfil (celular, <=768px)
// ═══════════════════════════════════════════════════════════
// El sidebar off-canvas y el dropdown de perfil comparten un patrón simple:
// una clase que se prende/apaga en el contenedor padre (.app-page para el
// sidebar, .navbar-right para el perfil) y el CSS (@media max-width:768px)
// se encarga de mostrar/ocultar y animar. En desktop estas clases no tienen
// ningún efecto visual (el CSS base ya deja todo visible en línea).
function closeNavbarProfile(){
  document.querySelectorAll('.navbar-right.open').forEach(function(el){ el.classList.remove('open'); });
}
function toggleSidebar(btn){
  var page = btn.closest('.app-page');
  if(!page) return;
  var willOpen = !page.classList.contains('sidebar-open');
  // El sidebar (z-index 300) queda por encima del dropdown de perfil
  // (z-index 250) y ambos pueden ocupar la misma franja derecha en celular
  // -- si los dos quedan abiertos a la vez el sidebar tapa parte del
  // dropdown. Se evita dejando abierto solo uno de los dos.
  if(willOpen) closeNavbarProfile();
  page.classList.toggle('sidebar-open', willOpen);
}
function closeSidebar(){
  document.querySelectorAll('.app-page.sidebar-open').forEach(function(p){
    p.classList.remove('sidebar-open');
  });
}
function toggleNavbarProfile(btn){
  var wrap = btn.closest('.navbar-right');
  if(!wrap) return;
  var willOpen = !wrap.classList.contains('open');
  if(willOpen) closeSidebar();
  closeNavbarProfile();
  if(willOpen) wrap.classList.add('open');
}
// Cerrar el menu de perfil al tocar afuera.
document.addEventListener('click', function(e){
  document.querySelectorAll('.navbar-right.open').forEach(function(el){
    if(!el.contains(e.target)) el.classList.remove('open');
  });
});
// Cerrar el sidebar off-canvas al elegir una opcion del menu (en desktop
// esto no hace nada visible, sidebar-open no tiene efecto ahi).
document.addEventListener('click', function(e){
  if(e.target.closest('.sidebar-menu a')) closeSidebar();
});

// ═══════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════
function showSection(sec){
  ['users','perms','hist','metas','reportesrole','dashboards','inventario','gerencia','gestionhumana'].forEach(function(s){
    var el=document.getElementById('section-'+s);
    var mel=document.getElementById('menu-'+s);
    if(el) el.classList.toggle('hidden',s!==sec);
    if(mel) mel.classList.toggle('active',s===sec);
  });
  if(sec==='perms') showRolesView();
  if(sec==='hist'){ loadHist().then(function(){ renderHist(); }); }
  if(sec==='metas'){ renderMetasSection(); }
  if(sec==='reportesrole'){ renderReportesRoleSection(); }
  if(sec==='dashboards'){ renderDashboardsSection(); }
  if(sec==='inventario'){ renderInventarioSection(); }
  if(sec==='gerencia'){ renderGerenciaSection(); }
  if(sec==='gestionhumana'){ renderGestionHumanaSection(); }
}

// ═══════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════
function updateStats(){
  document.getElementById('stat-active').textContent=users.filter(function(u){return u.active;}).length;
  document.getElementById('stat-suspended').textContent=users.filter(function(u){return !u.active;}).length;
  document.getElementById('stat-total').textContent=users.length;
  document.getElementById('stat-hist').textContent=historial.length;
}

// ═══════════════════════════════════════════════════════════
// TOAST + EYE
// ═══════════════════════════════════════════════════════════
function showToast(msg){
  var t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show'); clearTimeout(t._t);
  t._t=setTimeout(function(){t.classList.remove('show');},3000);
}
function toggleEye(inputId,btn){
  var inp=document.getElementById(inputId);
  if(inp.type==='password'){inp.type='text';btn.textContent='X';}
  else{inp.type='password';btn.innerHTML='&#128065;';}
}

// ═══════════════════════════════════════════════════════════
// ESTADOS DE CARGA
// ═══════════════════════════════════════════════════════════
// Deshabilita un boton y le cambia el texto mientras corre una accion async
// (evita doble envio y le da feedback al usuario). Restaura todo al terminar,
// aunque la accion falle. Uso: await withButtonLoading(btn, 'Guardando...', function(){ ... });
async function withButtonLoading(btn, loadingLabel, fn){
  if(!btn) return fn();
  var prevText=btn.textContent, wasDisabled=btn.disabled;
  btn.disabled=true; btn.textContent=loadingLabel;
  try { return await fn(); }
  finally { btn.disabled=wasDisabled; btn.textContent=prevText; }
}

// Fila "cargando" para una tabla, con el colspan correcto.
function tableLoadingRow(cols, msg){
  return '<tr><td colspan="'+cols+'"><div class="loading-state">'+
    '<div class="spinner"></div>'+(msg||'Cargando...')+'</div></td></tr>';
}

// ═══════════════════════════════════════════════════════════
