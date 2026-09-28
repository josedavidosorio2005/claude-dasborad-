// dashboards-core.js — InConexion Platform. Extraído de index.html (antes un único <script>).
// Se carga como <script src> global y en orden; todas las funciones son globales
// y se invocan desde manejadores del HTML. No cambiar el orden de carga.

// USER DASHBOARD
// ═══════════════════════════════════════════════════════════
// Fase 83 (hallazgo real: un usuario con acceso a un solo modulo veia
// igual TODOS los demas, atenuados con la etiqueta "Sin acceso" -- el
// candado de verdad ya vive en el servidor (Fases 72/81/82); mostrar un
// boton que al tocarlo no lleva a ningun lado (o el modulo lo rebota con
// un toast) es puro ruido. Ahora solo se pintan las tarjetas de los
// modulos a los que el usuario SI tiene acceso -- misma fuente de verdad
// que ya usaba el codigo viejo (currentUser.perms[m.key], la que manda el
// servidor en el login), nunca una lista aparte. ADMIN/admin maestro
// (isFullAdmin) siguen viendo todo, como antes. "Proximamente" (modulo
// aun no construido) es un caso distinto -- ese SI sigue visible y
// clicable, para explicar el estado en vez de esconder algo que existe.
function renderDashGrid(){
  var grid=document.getElementById('dash-grid');
  var modulos=dashModulosVisibles(DASH_MODULES, currentUser, isFullAdmin());
  grid.innerHTML=modulos.map(function(m){
    var cls='dash-btn '+m.cls;
    var corner='';
    if(m.soon){ cls+=' mod-soon'; corner='<div class="dash-soon">Proximamente</div>'; }
    return '<div class="'+cls+'" onclick="onDashBtn(\''+m.key+'\')">'+corner+
      '<div class="dash-icon">'+m.icon+'</div>'+
      '<div class="dash-label">'+m.label+'</div>'+
      '<div class="dash-sub">'+m.sub+'</div></div>';
  }).join('');
  // Tile extra para quien puede cargar datos operativos de los dashboards.
  var puedeCargar = typeof canLoadData==='function' && canLoadData() && !isFullAdmin();
  if(puedeCargar){
    grid.innerHTML += '<div class="dash-btn mod-clientes" onclick="openCargas()">'+
      '<div class="dash-icon">&#128228;</div>'+
      '<div class="dash-label">Cargar Datos</div>'+
      '<div class="dash-sub">Subir Excel de los dashboards</div></div>';
  }
  // Sin ningun modulo (ni "Cargar Datos") -> mensaje claro, sin tarjetas.
  var vacio=document.getElementById('dash-grid-vacio');
  var sinNada = modulos.length===0 && !puedeCargar;
  if(vacio) vacio.classList.toggle('hidden', !sinNada);
  grid.classList.toggle('hidden', sinNada);
}

function onDashBtn(key){
  var m=DASH_MODULES.find(function(x){return x.key===key;});
  if(m&&m.soon){
    showToast('El modulo '+m.label+' todavia no esta disponible. Te avisaremos cuando este listo.');
    return;
  }
  if(key==='ClientesDash'){openClientsModal();return;}
  if(key==='Calidad'){openCalidad();return;}
  if(key==='Inventario'){openInventario();return;}
  if(key==='Gerencia'){openGerencia();return;}
  if(key==='GestionHumana'){openGestionHumana();return;}
  showToast('El modulo '+(m?m.label:key)+' todavia no esta disponible.');
}

// Fase 83: mismo criterio que renderDashGrid -- solo se pintan los
// clientes a los que el usuario SI tiene acceso (currentUser.perms
// ['cliente_'+c], la misma fuente que ya usa el servidor). isFullAdmin()
// en vez del `!currentUser` suelto de antes -- ese solo cubria al admin
// maestro, dejando al rol ADMIN (que tambien es isFullAdmin) sujeto a sus
// perms.cliente_* como cualquier otro rol.
function openClientsModal(){
  var grid=document.getElementById('clients-grid');
  var html='';
  var clientesAccesibles=dashClientesVisibles(CLIENTES_LIST, currentUser, isFullAdmin());
  for(var i=0;i<clientesAccesibles.length;i++){
    var c=clientesAccesibles[i];
    var built=BUILT_CLIENT_DASHBOARDS.indexOf(c)!==-1;
    var cls='client-card';
    var tag='';
    if(!built){ cls+=' client-soon'; tag='<div class="client-soon-label">Proximamente</div>'; }
    // "Proximamente" se deja clicable para explicar el estado -- ya no hay
    // tarjetas sin acceso que mostrar.
    html+='<div class="'+cls+'" data-cliente="'+c+'" onclick="openClientByEl(this)">'+
      '<div class="client-name">'+c+'</div>'+tag+'</div>';
  }
  grid.innerHTML=html||'<div class="empty-state"><div class="es-icon">&#128193;</div>'+
    '<div class="es-title">Sin clientes asignados</div>'+
    '<div class="es-hint">Solicita al administrador acceso a los clientes que necesitas consultar.</div></div>';
  document.getElementById('clients-modal-overlay').classList.add('show');
}
function closeClientsModal(){document.getElementById('clients-modal-overlay').classList.remove('show');}
function openClientByEl(el){
  var c = el.dataset.cliente;
  // Fase 3: cualquier cliente con dashboard configurado se abre con el modulo generico.
  if (BUILT_CLIENT_DASHBOARDS.indexOf(c) !== -1) { openGenericDashboard(c); return; }
  showToast('El dashboard de '+c+' esta en preparacion. Pronto lo veras aqui.');
}

// Lista de clientes con dashboard configurado (Fase 3). Se pide al servidor tras
// el login y reemplaza la lista fija que habia antes en constants.js.
async function loadDashboardClientes(){
  try{
    var r = await apiRequest('GET','/dashboard/clientes');
    if(r && Array.isArray(r.clientes)) BUILT_CLIENT_DASHBOARDS = r.clientes;
  }catch(e){ /* deja la lista por defecto */ }
}
document.getElementById('clients-modal-overlay').addEventListener('click',function(e){if(e.target===this)closeClientsModal();});

// ═══════════════════════════════════════════════════════════
