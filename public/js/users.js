// users.js — InConexion Platform. Extraído de index.html (antes un único <script>).
// Se carga como <script src> global y en orden; todas las funciones son globales
// y se invocan desde manejadores del HTML. No cambiar el orden de carga.

// USERS TABLE
// ═══════════════════════════════════════════════════════════
function renderUsers(filter){
  filter=filter||'';
  var fl=filter.toLowerCase();
  var tbody=document.getElementById('users-tbody');
  var noRes=document.getElementById('no-results');
  var list=users.filter(function(u){
    return u.nombre.toLowerCase().includes(fl)||u.user.toLowerCase().includes(fl)||(RL[u.rol]||u.rol).toLowerCase().includes(fl);
  });
  // Aux only sees accessible roles, not other admins or other aux
  if (!isFullAdmin()) {
    list=list.filter(function(u){
      return u.rol!=='ADMIN' && u.rol!=='AUX_ADMIN' && canAccessRole(u.rol);
    });
  }
  if(!list.length){
    tbody.innerHTML='';
    noRes.innerHTML = (users.length===0)
      ? '<div class="empty-state"><div class="es-icon">&#128101;</div>'+
        '<div class="es-title">Aun no hay usuarios</div>'+
        '<div class="es-hint">Crea el primero con el boton &laquo;+ Nuevo Usuario&raquo; de arriba.</div></div>'
      : '<div class="empty-state"><div class="es-icon">&#128269;</div>'+
        '<div class="es-title">Sin coincidencias</div>'+
        '<div class="es-hint">Ningun usuario coincide con tu busqueda. Prueba con otro nombre, usuario o rol.</div></div>';
    noRes.classList.remove('hidden');
    return;
  }
  noRes.classList.add('hidden');
  tbody.innerHTML=list.map(function(u){
    var canEdit=isFullAdmin()||can('editarUsuarios');
    var canPass=isFullAdmin()||can('cambiarPassword');
    var canSusp=isFullAdmin()||can('suspenderUsuarios');
    var canDel =isFullAdmin()||can('eliminarUsuarios');
    var sl=u.active?'Suspender':'Activar';
    var sc=u.active?'btn-suspend':'btn-activate';
    var extra='';
    if(u.rol==='CALIDAD' || u.rol==='REPORTES' || u.rol==='SUPERVISOR' || u.rol==='GERENCIA'){
      var asignadas=CAMPANAS_CALIDAD.filter(function(c){return u.perms['campana_'+c]===true;});
      extra='<div style="font-size:0.72rem;color:'+(asignadas.length?'var(--c-success)':'var(--c-danger-dark)')+';margin-top:2px">'+
        (asignadas.length? '&#9989; '+asignadas.join(', ') : '&#9888; Sin campanas asignadas')+'</div>';
    } else if(u.rol==='ASESOR'){
      extra='<div style="font-size:0.72rem;color:'+(u.asesorCampana?'var(--c-success)':'var(--c-danger-dark)')+';margin-top:2px">'+
        (u.asesorCampana? '&#9989; '+esc(u.asesorCampana) : '&#9888; Sin operacion asignada')+'</div>';
    }
    return '<tr>'+
      '<td><strong style="color:var(--c-primary)">'+esc(u.nombre)+'</strong>'+extra+'</td>'+
      '<td style="color:var(--c-text-muted);font-family:monospace;font-size:0.82rem">'+esc(u.user)+'</td>'+
      '<td><span class="badge badge-'+u.rol+'">'+esc(RL[u.rol]||u.rol)+'</span></td>'+
      '<td><span class="dot '+(u.active?'dot-on':'dot-off')+'"></span>'+(u.active?'Activo':'Suspendido')+'</td>'+
      '<td style="font-size:0.78rem;color:var(--c-text-muted)">'+esc(u.createdAt||'-')+'</td>'+
      '<td><div class="action-btns">'+
        '<button class="btn-sm btn-edit '+(canEdit?'':'blocked')+'" '+(canEdit?'onclick="openEditModal('+u.id+')"':'disabled')+'>Editar</button>'+
        '<button class="btn-sm btn-pass '+(canPass?'':'blocked')+'" '+(canPass?'onclick="openPassModal('+u.id+')"':'disabled')+'>Contrasena</button>'+
        '<button class="btn-sm '+sc+' '+(canSusp?'':'blocked')+'" '+(canSusp?'onclick="toggleActive('+u.id+')"':'disabled')+'>'+sl+'</button>'+
        '<button class="btn-sm btn-delete '+(canDel?'':'blocked')+'" '+(canDel?'onclick="openDeleteModal('+u.id+')"':'disabled')+'>Eliminar</button>'+
      '</div></td></tr>';
  }).join('');
  updateStats();
}
function filterUsers(){renderUsers(document.getElementById('user-search').value);}

// ═══════════════════════════════════════════════════════════
// USER MODAL (create + edit unified)
// ═══════════════════════════════════════════════════════════
function openCreateModal(){
  document.getElementById('modal-user-title').textContent='Crear Nuevo Usuario';
  document.getElementById('mu-mode').value='create';
  document.getElementById('mu-id').value='';
  document.getElementById('mu-nombre').value='';
  document.getElementById('mu-user').value='';
  document.getElementById('mu-pass').value='';
  document.getElementById('mu-rol').value='CALIDAD';
  document.getElementById('mu-pass-hint').style.display='none';
  document.getElementById('mu-cargar-datos').checked=false;
  document.getElementById('modal-user').classList.add('show');
  onRolChange();
}

function openEditModal(id){
  var u=users.find(function(x){return x.id===id;}); if(!u) return;
  document.getElementById('modal-user-title').textContent='Editar Usuario';
  document.getElementById('mu-mode').value='edit';
  document.getElementById('mu-id').value=id;
  document.getElementById('mu-nombre').value=u.nombre;
  document.getElementById('mu-user').value=u.user;
  document.getElementById('mu-pass').value='';
  document.getElementById('mu-rol').value=u.rol;
  document.getElementById('mu-pass-hint').style.display='block';
  if (u.rol==='CLIENTES_DASH' || u.rol==='SUPERVISOR'){
    buildClientCheckboxes(u.perms);
    document.getElementById('mu-client-perms').style.display='block';
  } else {
    document.getElementById('mu-client-perms').style.display='none';
  }
  if (u.rol==='CALIDAD' || u.rol==='REPORTES' || u.rol==='SUPERVISOR' || u.rol==='GERENCIA'){
    buildCampaignCheckboxes(u.perms);
    document.getElementById('mu-campaign-perms').style.display='block';
  } else {
    document.getElementById('mu-campaign-perms').style.display='none';
  }
  var showAsesorEdit=(u.rol==='ASESOR');
  document.getElementById('mu-asesor-note').style.display=showAsesorEdit?'block':'none';
  if(showAsesorEdit) buildAsesorCampanaSelect(u.asesorCampana);
  document.getElementById('mu-cargar-datos').checked=(u.perms && u.perms.cargarDatos===true);
  syncCargarDatosLock(u.rol);
  document.getElementById('modal-user').classList.add('show');
}

function onRolChange(){
  var rol=document.getElementById('mu-rol').value;
  var show=(rol==='CLIENTES_DASH' || rol==='SUPERVISOR');
  document.getElementById('mu-client-perms').style.display=show?'block':'none';
  if(show) buildClientCheckboxes(null);
  var showCal=(rol==='CALIDAD' || rol==='REPORTES' || rol==='SUPERVISOR' || rol==='GERENCIA');
  document.getElementById('mu-campaign-perms').style.display=showCal?'block':'none';
  if(showCal) buildCampaignCheckboxes(null);
  var showAsesor=(rol==='ASESOR');
  document.getElementById('mu-asesor-note').style.display=showAsesor?'block':'none';
  if(showAsesor) buildAsesorCampanaSelect(null);
  syncCargarDatosLock(rol);
}

// REPORTES siempre puede cargar datos (feedback Edwin 2.1): el backend lo fuerza;
// aqui se refleja marcando y bloqueando el check para que el admin lo entienda.
function syncCargarDatosLock(rol){
  var cd=document.getElementById('mu-cargar-datos');
  var note=document.getElementById('mu-cargar-datos-reportes-note');
  if(rol==='REPORTES'){ cd.checked=true; cd.disabled=true; if(note) note.style.display='block'; }
  else { cd.disabled=false; if(note) note.style.display='none'; }
}

function buildAsesorCampanaSelect(existingCampana){
  var sel=document.getElementById('mu-asesor-campana');
  var campanas=CAMPANAS_CON_PLANTILLA.slice();
  sel.innerHTML=campanas.map(function(c){ return '<option value="'+c+'">'+c+'</option>'; }).join('');
  sel.value = existingCampana && campanas.indexOf(existingCampana)!==-1 ? existingCampana : campanas[0];
}

function buildClientCheckboxes(existingPerms){
  var grid=document.getElementById('mu-client-perm-grid');
  grid.innerHTML=CLIENTES_LIST.map(function(c){
    var checked=existingPerms?existingPerms['cliente_'+c]===true:true;
    return '<label class="client-perm-item">'+
      '<input type="checkbox" data-cliente="'+c+'" '+(checked?'checked':'')+'>'+c+'</label>';
  }).join('');
}

function getClientChecks(){
  var checks={};
  var inputs=document.getElementById('mu-client-perm-grid').querySelectorAll('input[data-cliente]');
  inputs.forEach(function(inp){checks[inp.dataset.cliente]=inp.checked;});
  return checks;
}

function buildCampaignCheckboxes(existingPerms){
  var grid=document.getElementById('mu-campaign-perm-grid');
  grid.innerHTML=CAMPANAS_CALIDAD.map(function(c){
    var checked=existingPerms?existingPerms['campana_'+c]===true:true;
    return '<label class="client-perm-item">'+
      '<input type="checkbox" data-campana="'+c+'" '+(checked?'checked':'')+'>'+c+'</label>';
  }).join('');
}

function getCampaignChecks(){
  var checks={};
  var inputs=document.getElementById('mu-campaign-perm-grid').querySelectorAll('input[data-campana]');
  inputs.forEach(function(inp){checks[inp.dataset.campana]=inp.checked;});
  return checks;
}

function closeUserModal(){
  document.getElementById('modal-user').classList.remove('show');
}

async function saveUserModal(){
  var mode=document.getElementById('mu-mode').value;
  var nombre=document.getElementById('mu-nombre').value.trim();
  var user=document.getElementById('mu-user').value.trim();
  var pass=document.getElementById('mu-pass').value;
  var rol=document.getElementById('mu-rol').value;
  if(!nombre||!user){showToast('Complete nombre y usuario');return;}
  // El servidor exige usuario sin espacios/caracteres raros y contrasena de 8+.
  if(!/^[a-zA-Z0-9._-]{3,32}$/.test(user)){
    showToast('El usuario: 3-32 caracteres, solo letras, numeros, . _ -');return;
  }
  if(pass && pass.length < PASSWORD_MIN){
    showToast('La contrasena debe tener al menos '+PASSWORD_MIN+' caracteres');return;
  }

  if(mode==='create'){
    if(!isFullAdmin()&&!can('crearUsuarios')){showToast('Sin permiso');return;}
    if(!pass || pass.length < PASSWORD_MIN){
      showToast('Define una contrasena de al menos '+PASSWORD_MIN+' caracteres para el nuevo usuario');return;
    }
    var clientChecks=(rol==='CLIENTES_DASH'||rol==='SUPERVISOR')?getClientChecks():null;
    var campaignChecks=(rol==='CALIDAD'||rol==='REPORTES'||rol==='SUPERVISOR'||rol==='GERENCIA')?getCampaignChecks():null;
    var payload={ nombre:nombre, user:user, password:pass, rol:rol,
                   perms:buildPerms(rol,clientChecks,campaignChecks) };
    if(document.getElementById('mu-cargar-datos').checked) payload.perms.cargarDatos=true;
    if(rol==='ASESOR') payload.asesorCampana = document.getElementById('mu-asesor-campana').value;
    var btnC=document.querySelector('#modal-user .btn-primary');
    try{
      var nu = await withButtonLoading(btnC,'Guardando...',function(){ return apiRequest('POST','/users',payload); });
      ensurePerms(nu); users.push(nu);
      closeUserModal();
      renderUsers(document.getElementById('user-search').value); renderRoles();
      showToast('Usuario creado correctamente');
    }catch(e){ showToast(e.message); }

  } else {
    if(!isFullAdmin()&&!can('editarUsuarios')){showToast('Sin permiso');return;}
    var id=parseInt(document.getElementById('mu-id').value);
    var u=users.find(function(x){return x.id===id;}); if(!u) return;
    var prevRol=u.rol;
    var newPerms = (prevRol!==rol) ? buildPerms(rol,null,null) : Object.assign({},u.perms);
    if(rol==='CLIENTES_DASH' || rol==='SUPERVISOR'){
      var cc=getClientChecks();
      CLIENTES_LIST.forEach(function(c){newPerms['cliente_'+c]=cc[c]===true;});
    }
    if(rol==='CALIDAD' || rol==='REPORTES' || rol==='SUPERVISOR' || rol==='GERENCIA'){
      var cac=getCampaignChecks();
      CAMPANAS_CALIDAD.forEach(function(c){newPerms['campana_'+c]=cac[c]===true;});
    }
    newPerms.cargarDatos = document.getElementById('mu-cargar-datos').checked;
    var payload={ nombre:nombre, user:user, rol:rol, perms:newPerms };
    if(pass) payload.password=pass;
    if(rol==='ASESOR') payload.asesorCampana=document.getElementById('mu-asesor-campana').value;
    var btnE=document.querySelector('#modal-user .btn-primary');
    try{
      var updated = await withButtonLoading(btnE,'Guardando...',function(){ return apiRequest('PUT','/users/'+id,payload); });
      ensurePerms(updated);
      var idx=users.findIndex(function(x){return x.id===id;});
      if(idx!==-1) users[idx]=updated;
      closeUserModal();
      renderUsers(document.getElementById('user-search').value); renderRoles();
      showToast('Usuario actualizado');
    }catch(e){ showToast(e.message); }
  }
}

// ═══════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════
function openModal(id){document.getElementById(id).classList.add('show');}
function closeModal(id){document.getElementById(id).classList.remove('show');}
['modal-user','modal-pass','modal-delete'].forEach(function(id){
  document.getElementById(id).addEventListener('click',function(e){if(e.target===this)closeModal(id);});
});
document.getElementById('modal-user').addEventListener('click',function(e){
  if(e.target===this) closeUserModal();
});

function openPassModal(id){document.getElementById('pass-id').value=id;openModal('modal-pass');}
function openDeleteModal(id){
  var u=users.find(function(x){return x.id===id;}); if(!u) return;
  document.getElementById('delete-id').value=id;
  document.getElementById('delete-name').textContent=u.nombre;
  openModal('modal-delete');
}

async function savePass(){
  if(!isFullAdmin()&&!can('cambiarPassword')){showToast('Sin permiso');return;}
  var id=parseInt(document.getElementById('pass-id').value);
  var np=document.getElementById('pass-new').value;
  var cp=document.getElementById('pass-confirm').value;
  if(!np){showToast('Ingresa una contrasena');return;}
  if(np.length < PASSWORD_MIN){showToast('La contrasena debe tener al menos '+PASSWORD_MIN+' caracteres');return;}
  if(np!==cp){showToast('Las contrasenas no coinciden');return;}
  var btnP=document.querySelector('#modal-pass .btn-primary');
  try{
    await withButtonLoading(btnP,'Cambiando...',function(){ return apiRequest('PUT','/users/'+id+'/password',{password:np}); });
    closeModal('modal-pass');
    showToast('Contrasena actualizada');
  }catch(e){ showToast(e.message); }
}

async function toggleActive(id){
  if(!isFullAdmin()&&!can('suspenderUsuarios')){showToast('Sin permiso');return;}
  var u=users.find(function(x){return x.id===id;}); if(!u) return;
  try{
    var res = await apiRequest('PUT','/users/'+id+'/active',{});
    u.active = res.active;
    renderUsers(document.getElementById('user-search').value); renderRoles();
    if(currentRole) renderPermTable(currentRole,document.getElementById('perm-user-search').value);
    showToast(u.active?'Usuario activado':'Usuario suspendido');
  }catch(e){ showToast(e.message); }
}

async function confirmDelete(){
  if(!isFullAdmin()&&!can('eliminarUsuarios')){showToast('Sin permiso');return;}
  var id=parseInt(document.getElementById('delete-id').value);
  var btnD=document.querySelector('#modal-delete .btn-primary');
  try{
    await withButtonLoading(btnD,'Eliminando...',function(){ return apiRequest('DELETE','/users/'+id); });
    users=users.filter(function(x){return x.id!==id;});
    closeModal('modal-delete');
    renderUsers(document.getElementById('user-search').value); renderRoles();
    showToast('Usuario eliminado');
  }catch(e){ showToast(e.message); }
}

// ═══════════════════════════════════════════════════════════
