// roles-perms.js — InConexion Platform. Extraído de index.html (antes un único <script>).
// Se carga como <script src> global y en orden; todas las funciones son globales
// y se invocan desde manejadores del HTML. No cambiar el orden de carga.

// ROLES GRID
// ═══════════════════════════════════════════════════════════
function renderRoles(filter){
  filter=filter||'';
  var fl=filter.toLowerCase();
  var grid=document.getElementById('roles-grid');
  // Which roles to show in perms view
  var visibleRoles=ALL_ROLES.filter(function(r){return r.label.toLowerCase().includes(fl);});
  grid.innerHTML=visibleRoles.map(function(r){
    var count=users.filter(function(u){return u.rol===r.key;}).length;
    if(r.key==='ADMIN') count++; // include master admin
    var isAux=r.key==='AUX_ADMIN';
    var isAdm=r.key==='ADMIN';
    var ok=isFullAdmin()||isAux||isAdm||canAccessRole(r.key);
    // Aux cannot manage other admins or other aux
    if(!isFullAdmin() && (isAdm||isAux)) ok=false;
    return '<div class="role-card '+(isAux?'aux-card':'')+(isAdm?' admin-card':'')+' '+(!ok?'blocked-card':'')+'" '+
      'onclick="'+(ok?"openRoleDetail('"+r.key+"')":'showToast("Sin acceso a este rol")')+'">' +
      '<div class="role-icon">'+r.icon+'</div>'+
      '<div class="role-name">'+r.label+'</div>'+
      '<div class="role-count">'+count+' usuario'+(count!==1?'s':'')+'</div>'+
      (!ok?'<div class="role-locked">Sin acceso</div>':'')+
      '</div>';
  }).join('');
}
function filterRoles(){renderRoles(document.getElementById('role-search').value);}
function showRolesView(){
  document.getElementById('perms-roles-view').classList.remove('hidden');
  document.getElementById('perms-detail-view').classList.add('hidden');
}
function backToRoles(){showRolesView();currentRole=null;}

// ═══════════════════════════════════════════════════════════
// PERMISSIONS — REGULAR ROLES
// ═══════════════════════════════════════════════════════════
function openRoleDetail(roleKey){
  if(!isFullAdmin()&&!can('gestionPermisos')){showToast('Sin permiso para gestionar permisos');return;}
  currentRole=roleKey;
  var role=ALL_ROLES.find(function(r){return r.key===roleKey;});
  var isAux=roleKey==='AUX_ADMIN';
  document.getElementById('perms-roles-view').classList.add('hidden');
  document.getElementById('perms-detail-view').classList.remove('hidden');
  document.getElementById('detail-title').textContent=role.icon+' '+role.label;
  document.getElementById('regular-perm-card').classList.toggle('hidden',isAux);
  document.getElementById('aux-perm-card').classList.toggle('hidden',!isAux);
  if(isAux){
    document.getElementById('detail-subtitle').textContent='Configura las acciones y los roles que puede manejar cada Auxiliar Admin.';
    renderAuxPerms('');
  } else {
    document.getElementById('detail-subtitle').textContent='Activa o desactiva el acceso a cada modulo del dashboard.';
    document.getElementById('detail-table-title').textContent='Usuarios con rol '+role.label;
    document.getElementById('perm-user-search').value='';
    document.getElementById('perm-user-search').oninput=filterPermUsers;
    renderPermTable(roleKey,'');
  }
}
function filterPermUsers(){renderPermTable(currentRole,document.getElementById('perm-user-search').value);}

function allDashPermsOn(u){
  var ok=DASH_MODULES.every(function(m){return u.perms[m.key]===true;});
  if(!ok||u.rol!=='CLIENTES_DASH') return ok;
  return CLIENTES_LIST.every(function(c){return u.perms['cliente_'+c]===true;});
}

function renderPermTable(roleKey,filter){
  filter=filter||'';
  var fl=filter.toLowerCase();
  var ru=users.filter(function(u){
    return u.rol===roleKey&&(u.nombre.toLowerCase().includes(fl)||u.user.toLowerCase().includes(fl));
  });
  var noRes=document.getElementById('perm-no-results');
  var thead=document.getElementById('perm-thead');
  var tbody=document.getElementById('perm-tbody');
  var cols=DASH_MODULES.map(function(m){return {key:m.key,label:m.label};});
  if(roleKey==='CLIENTES_DASH') CLIENTES_LIST.forEach(function(c){cols.push({key:'cliente_'+c,label:c});});
  thead.innerHTML='<th class="col-user">Usuario</th><th class="col-all">Acceso total</th>'+
    cols.map(function(c){return '<th>'+c.label+'</th>';}).join('');
  if(!ru.length){tbody.innerHTML='';noRes.classList.remove('hidden');return;}
  noRes.classList.add('hidden');
  tbody.innerHTML=ru.map(function(u){
    var allOn=allDashPermsOn(u);
    return '<tr id="prow-'+u.id+'">'+
      '<td class="col-user"><span class="u-name">'+esc(u.nombre)+'</span><span class="u-login">@'+esc(u.user)+'</span>'+
      '<span class="u-status"><span class="dot '+(u.active?'dot-on':'dot-off')+'"></span>'+(u.active?'Activo':'Suspendido')+'</span></td>'+
      '<td class="col-all"><label class="master-toggle"><input type="checkbox" '+(allOn?'checked':'')+
      ' data-uid="'+u.id+'" data-role="'+roleKey+'" onchange="toggleAllPerms(this)">'+
      '<span class="mt-track"></span><span class="mt-thumb"></span></label></td>'+
      cols.map(function(c){
        return '<td><label class="mini-toggle"><input type="checkbox" data-uid="'+u.id+
          '" data-key="'+c.key+'" data-role="'+roleKey+'" '+(u.perms[c.key]===true?'checked':'')+
          ' onchange="togglePerm(this)"><span class="mt-track"></span><span class="mt-thumb"></span></label></td>';
      }).join('')+'</tr>';
  }).join('');
}

async function persistPerms(u, label, action){
  try{
    await apiRequest('PUT','/users/'+u.id+'/perms',{perms:u.perms});
    showToast(action+': '+label+' - '+u.nombre);
  }catch(e){ showToast(e.message); }
}

function togglePerm(el){
  var uid=parseInt(el.dataset.uid), key=el.dataset.key, roleKey=el.dataset.role;
  var u=users.find(function(x){return x.id===uid;}); if(!u) return;
  u.perms[key]=el.checked;
  var master=document.querySelector('#prow-'+uid+' .master-toggle input');
  if(master) master.checked=allDashPermsOn(u);
  var label=key.replace('cliente_','');
  persistPerms(u, label, el.checked?'Activado':'Desactivado');
}

function toggleAllPerms(el){
  var uid=parseInt(el.dataset.uid), val=el.checked, roleKey=el.dataset.role;
  var u=users.find(function(x){return x.id===uid;}); if(!u) return;
  var cols=DASH_MODULES.map(function(m){return m.key;});
  if(roleKey==='CLIENTES_DASH') CLIENTES_LIST.forEach(function(c){cols.push('cliente_'+c);});
  cols.forEach(function(k){u.perms[k]=val;});
  document.querySelectorAll('#prow-'+uid+' .mini-toggle input').forEach(function(cb){cb.checked=val;});
  persistPerms(u, 'acceso total', val?'Todos activados':'Todos desactivados');
}

// ═══════════════════════════════════════════════════════════
// AUX ADMIN PERMISSIONS — completely rewritten, clean
// ═══════════════════════════════════════════════════════════
function filterAuxUsers(){renderAuxPerms(document.getElementById('aux-user-search').value);}

function renderAuxPerms(filter){
  filter=filter||'';
  var fl=filter.toLowerCase();
  var auxUsers=users.filter(function(u){
    return u.rol==='AUX_ADMIN'&&(u.nombre.toLowerCase().includes(fl)||u.user.toLowerCase().includes(fl));
  });
  var container=document.getElementById('aux-users-container');
  document.getElementById('aux-user-title').textContent='Usuarios Auxiliar Admin';
  if(!auxUsers.length){container.innerHTML='<div class="no-results">No hay usuarios con este rol.</div>';return;}

  var html='';
  for(var i=0;i<auxUsers.length;i++){
    var u=auxUsers[i];
    html+='<div style="border-top:1px solid #edf2f6;padding:22px 24px">';
    html+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">';
    html+='<strong style="color:#0d4a5e;font-size:0.95rem">'+esc(u.nombre)+'</strong>';
    html+='<span style="font-size:0.76rem;color:#7a9ba8">@'+esc(u.user)+'</span>';
    html+='<span class="dot '+(u.active?'dot-on':'dot-off')+'"></span>';
    html+='<span style="font-size:0.76rem;color:#7a9ba8">'+(u.active?'Activo':'Suspendido')+'</span>';
    html+='</div>';

    // Actions section
    html+='<div class="aux-section-title">Acciones permitidas en el panel</div>';
    html+='<div class="aux-grid" style="margin-bottom:22px">';
    for(var j=0;j<ADMIN_ACTIONS.length;j++){
      var a=ADMIN_ACTIONS[j];
      var checked=(u.perms[a.key]===true)?'checked':'';
      html+='<div class="aux-item"><span>'+a.label+'</span>';
      html+='<label class="mini-toggle">';
      html+='<input type="checkbox" '+checked+' data-uid="'+u.id+'" data-key="'+a.key+'" onchange="setAuxPerm(parseInt(this.dataset.uid),this.dataset.key,this.checked)">';
      html+='<span class="mt-track"></span><span class="mt-thumb"></span></label></div>';
    }
    html+='</div>';

    // Roles section
    html+='<div class="aux-section-title">Roles a los que puede intervenir</div>';
    html+='<div class="aux-grid">';
    for(var k=0;k<REGULAR_ROLES.length;k++){
      var r=REGULAR_ROLES[k];
      var rchecked=(u.perms['role_'+r.key]===true)?'checked':'';
      html+='<div class="aux-item role-item"><span>'+r.icon+' '+r.label+'</span>';
      html+='<label class="mini-toggle">';
      html+='<input type="checkbox" '+rchecked+' data-uid="'+u.id+'" data-key="role_'+r.key+'" onchange="setAuxPerm(parseInt(this.dataset.uid),this.dataset.key,this.checked)">';
      html+='<span class="mt-track"></span><span class="mt-thumb"></span></label></div>';
    }
    html+='</div></div>';
  }
  container.innerHTML=html;
}

// Single clean function with explicit parameters — no event object ambiguity
function setAuxPerm(uid, key, val){
  var u=users.find(function(x){return x.id===uid;}); if(!u) return;
  u.perms[key]=val;
  var isRole=key.indexOf('role_')===0;
  var label=isRole?'Acceso a rol '+(RL[key.replace('role_','')]||key):'';
  if(!isRole){for(var i=0;i<ADMIN_ACTIONS.length;i++){if(ADMIN_ACTIONS[i].key===key){label=ADMIN_ACTIONS[i].label;break;}}}
  persistPerms(u, label, val?'Activado':'Desactivado');
}

// ═══════════════════════════════════════════════════════════
