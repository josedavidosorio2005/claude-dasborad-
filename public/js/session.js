// session.js — InConexion Platform. Extraído de index.html (antes un único <script>).
// Se carga como <script src> global y en orden; todas las funciones son globales
// y se invocan desde manejadores del HTML. No cambiar el orden de carga.

// HISTORIAL — append-only, never deletable
// ═══════════════════════════════════════════════════════════
function nowStr() {
  var d=new Date();
  var pad=function(n){return n<10?'0'+n:n;};
  return pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear()
       +' '+pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());
}

function actorName() {
  if (currentUser===null) return 'Administrador (admin)';
  return currentUser.nombre + ' (@' + currentUser.user + ')';
}

function logEvent(accion, targetUser, detalle) {
  historial.push({
    ts: Date.now(),
    fecha: nowStr(),
    accion: accion,
    nombre: targetUser ? targetUser.nombre : '-',
    username: targetUser ? targetUser.user : '-',
    rol: targetUser ? (RL[targetUser.rol]||targetUser.rol) : '-',
    actor: actorName(),
    detalle: detalle || ''
  });
  saveHist();
  document.getElementById('stat-hist').textContent = historial.length;
}

// ═══════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════
async function doLogin() {
  var u=document.getElementById('username').value.trim();
  var p=document.getElementById('password').value;
  var err=document.getElementById('login-error');
  err.style.display='none';
  var btn=document.querySelector('.btn-login');
  if(btn){ btn.disabled=true; btn.textContent='Ingresando...'; }

  try {
    var data = await apiRequest('POST', '/auth/login', { user: u, password: p });
    authToken = data.token;

    if (data.user.isMasterAdmin) {
      currentUser = null; // null = admin maestro
      await loadData(); await loadHist(); await loadDashboardClientes(); await loadSeedDemoEstado();
      enterAdminPanel();
      return;
    }

    await loadData(); await loadHist(); await loadDashboardClientes(); await loadSeedDemoEstado();
    var found = users.find(function(x){ return x.id === data.user.id; });
    // GET /users filtra perms a {} para quien no administra usuarios/permisos
    // (para no exponer la matriz de permisos ajena) — pero eso NUNCA debe
    // pisar los permisos DEL PROPIO usuario logueado: los que ya trajo el
    // login (data.user, vía toPublicUser) son siempre los reales y completos.
    // Sin este merge, ensurePerms() (state.js) rellena los cliente_*/campana_*
    // que llegan undefined con `false` por defecto, y un usuario con acceso
    // real a sus clientes/campañas se queda sin ver ninguno tras iniciar sesión.
    currentUser = found ? Object.assign({}, found, { perms: data.user.perms }) : data.user;

    if (currentUser.rol==='ADMIN' || currentUser.rol==='AUX_ADMIN') { enterAdminPanel(); }
    else if (currentUser.rol==='ASESOR') { enterAsesorPage(); }
    else if (currentUser.rol==='SUPERVISOR') { enterSupervisorPage(); }
    else { enterUserDashboard(); }
  } catch(e) {
    err.textContent = e.message || 'Usuario o contrasena incorrectos';
    err.style.display='block';
  } finally {
    if(btn){ btn.disabled=false; btn.textContent='Ingresar'; }
  }
}
document.getElementById('password').addEventListener('keydown',function(e){if(e.key==='Enter')doLogin();});

function hideAllPages(){
  ['login-page','admin-page','user-page','asesor-page','supervisor-page'].forEach(function(id){
    document.getElementById(id).style.display='none';
  });
}

function enterAdminPanel(){
  hideAllPages();
  document.getElementById('admin-page').style.display='block';
  var isMaster = (currentUser===null);
  var isAdminRole = currentUser && currentUser.rol==='ADMIN';
  var isAux = currentUser && currentUser.rol==='AUX_ADMIN';

  // Navbar
  document.getElementById('nb-user-admin').textContent = isMaster ? 'Administrador' : currentUser.nombre;
  var rEl=document.getElementById('nb-role-admin');
  if (isMaster||isAdminRole) { rEl.textContent='ADMIN'; rEl.className='navbar-role admin-role'; }
  else { rEl.textContent='AUXILIAR ADMIN'; rEl.className='navbar-role aux'; }

  // Aux banner
  document.getElementById('aux-banner').classList.toggle('hidden',!isAux);
  // Reset button only for master
  document.getElementById('btn-reset').classList.toggle('hidden',!isMaster);
  // Historial tab only for master admin and ADMIN role users
  var histLi=document.getElementById('menu-hist-li');
  var metasLi=document.getElementById('menu-metas-li');
  var umbralesLi=document.getElementById('menu-umbrales-li');
  var reportesRoleLi=document.getElementById('menu-reportesrole-li');
  if (isMaster||isAdminRole) {
    histLi.classList.remove('hidden');
    metasLi.classList.remove('hidden');
    if(umbralesLi) umbralesLi.classList.remove('hidden');
    reportesRoleLi.classList.remove('hidden');
  } else {
    histLi.classList.add('hidden');
    metasLi.classList.add('hidden');
    if(umbralesLi) umbralesLi.classList.add('hidden');
    reportesRoleLi.classList.add('hidden');
  }

  var cargasLi=document.getElementById('menu-cargas-li');
  if(cargasLi) cargasLi.classList.toggle('hidden', !(isMaster||isAdminRole||canLoadData()));
  var dashboardsLi=document.getElementById('menu-dashboards-li');
  if(dashboardsLi) dashboardsLi.classList.toggle('hidden', !(isMaster||isAdminRole));
  var invLi=document.getElementById('menu-inventario-li');
  if(invLi) invLi.classList.toggle('hidden', !(isMaster||isAdminRole||(currentUser&&currentUser.perms&&currentUser.perms.Inventario)));
  var gerLi=document.getElementById('menu-gerencia-li');
  if(gerLi) gerLi.classList.toggle('hidden', !(isMaster||isAdminRole||(currentUser&&currentUser.perms&&currentUser.perms.Gerencia)));
  var ghLi=document.getElementById('menu-gestionhumana-li');
  if(ghLi) ghLi.classList.toggle('hidden', !(isMaster||isAdminRole||(currentUser&&currentUser.perms&&currentUser.perms.GestionHumana)));

  applyCreateBtn();
  showSection('users');
  renderUsers(); renderRoles(); updateStats();
}

function enterUserDashboard(){
  hideAllPages();
  document.getElementById('user-page').style.display='block';
  document.getElementById('nb-user-dash').textContent = currentUser.nombre;
  var rEl=document.getElementById('nb-role-dash');
  rEl.textContent=RL[currentUser.rol]||currentUser.rol;
  rEl.className='navbar-role';
  var fn=currentUser.nombre.split(' ')[0];
  document.getElementById('welcome-name').textContent='Bienvenido, '+fn;
  renderDashGrid();
}

function enterAsesorPage(){
  hideAllPages();
  document.getElementById('asesor-page').style.display='block';
  document.getElementById('nb-user-asesor').textContent = currentUser.nombre;
  showAsesorSection('calidad');
}

function showAsesorSection(sec){
  ['calidad'].forEach(function(s){
    var el=document.getElementById('asesor-section-'+s);
    var mel=document.getElementById('asesor-menu-'+s);
    if(el) el.style.display = (s===sec) ? 'block' : 'none';
    if(mel) mel.classList.toggle('active', s===sec);
  });
  if(sec==='calidad') renderMisResultados();
}

function enterSupervisorPage(){
  hideAllPages();
  document.getElementById('supervisor-page').style.display='block';
  document.getElementById('nb-user-supervisor').textContent = currentUser.nombre;
  showSupervisorSection('dashboards');
}

function showSupervisorSection(sec){
  ['dashboards','calidad'].forEach(function(s){
    var el=document.getElementById('supervisor-section-'+s);
    var mel=document.getElementById('supervisor-menu-'+s);
    if(el) el.style.display = (s===sec) ? 'block' : 'none';
    if(mel) mel.classList.toggle('active', s===sec);
  });
  if(sec==='dashboards') renderSupervisorClientsGrid();
  if(sec==='calidad') renderSupervisorMetaTable();
}

function renderSupervisorClientsGrid(){
  var grid=document.getElementById('supervisor-clients-grid');
  if(!grid) return;
  var html='';
  CLIENTES_LIST.forEach(function(c){
    var hasPerm = currentUser && currentUser.perms['cliente_'+c]===true;
    if(!hasPerm) return;
    var built = BUILT_CLIENT_DASHBOARDS.indexOf(c)!==-1;
    html+='<div class="client-card'+(built?'':' client-soon')+'" data-cliente="'+c+'" onclick="openClientByEl(this)">'+
      '<div class="client-name">'+c+'</div>'+
      (built?'':'<div class="client-soon-label">Proximamente</div>')+'</div>';
  });
  grid.innerHTML = html || '<div class="empty-state"><div class="es-icon">&#129309;</div>'+
    '<div class="es-title">Sin dashboards asignados</div>'+
    '<div class="es-hint">Solicita al administrador acceso a las campanas o clientes que supervisas.</div></div>';
}

async function renderSupervisorMetaTable(){
  var tbl = document.getElementById('supervisor-meta-table');
  if(!tbl || !currentUser) return;
  await calLoadPlantillas();
  var curMonth = new Date().toISOString().slice(0,7);
  var campanas = CAMPANAS_CON_PLANTILLA.filter(function(c){ return currentUser.perms['campana_'+c]===true; });
  for(var i=0;i<campanas.length;i++){ try{ await loadCalData(campanas[i], curMonth); }catch(e){} }
  var html = '<tr><th>Campana</th><th>Mi Meta</th><th>Realizados</th><th>% Total</th><th>Llamada</th><th>WhatsApp</th></tr>';
  if(campanas.length===0){
    html += '<tr><td colspan="6" style="text-align:center;color:#7a9ba8">No tienes campanas de Calidad asignadas.</td></tr>';
  } else {
    campanas.forEach(function(camp){
      var lideres = calLideresCumplimiento(camp, curMonth);
      var mia = lideres.find(function(l){ return String(l.liderId)===String(currentUser.id); });
      if(!mia){
        html += '<tr><td>'+camp+'</td><td colspan="5" style="color:#7a9ba8">Sin meta individual asignada este mes</td></tr>';
      } else {
        html += '<tr><td>'+camp+'</td><td>'+mia.meta+'</td><td>'+mia.realizados+'</td><td class="'+(mia.pct>=100?'peak':'')+'">'+mia.pct+'%</td>'+
          '<td>'+mia.realizadosLlamada+'/'+mia.metaLlamada+(mia.pctLlamadaCompl!==null?' ('+mia.pctLlamadaCompl+'%)':'')+'</td>'+
          '<td>'+(mia.auditaWpp ? (mia.realizadosWpp+'/'+mia.metaWpp+(mia.pctWppCompl!==null?' ('+mia.pctWppCompl+'%)':'')) : '-')+'</td></tr>';
      }
    });
  }
  tbl.innerHTML = html;
}

function doLogout(){
  currentUser=null; authToken=null; users=[]; historial=[];
  seedDemoActivo=false; renderSeedDemoBanner();
  hideAllPages();
  document.getElementById('login-page').style.display='flex';
  ['username','password'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('login-error').style.display='none';
}

// ═══════════════════════════════════════════════════════════
