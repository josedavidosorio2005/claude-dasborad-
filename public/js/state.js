// state.js — InConexion Platform. Extraído de index.html (antes un único <script>).
// Se carga como <script src> global y en orden; todas las funciones son globales
// y se invocan desde manejadores del HTML. No cambiar el orden de carga.

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════
var users=[], historial=[], nextId=10, currentUser=null, currentRole=null;

// ═══════════════════════════════════════════════════════════
// PERMISSIONS
// ═══════════════════════════════════════════════════════════
function buildPerms(rol, clientChecks, campaignChecks) {
  if (rol === 'ADMIN') return {isAdmin: true};
  if (rol === 'AUX_ADMIN') {
    var p = {};
    ADMIN_ACTIONS.forEach(function(a){ p[a.key] = false; });
    REGULAR_ROLES.forEach(function(r){ p['role_' + r.key] = false; });
    return p;
  }
  var defMod = ROLE_DEFAULT[rol];
  var p = {};
  DASH_MODULES.forEach(function(m){ p[m.key] = (m.key === defMod); });
  if (rol === 'GERENCIA') { p['Calidad'] = true; } // ve resultados de Calidad, solo lectura
  if (rol === 'CLIENTES_DASH' || rol === 'SUPERVISOR') {
    CLIENTES_LIST.forEach(function(c){
      p['cliente_' + c] = clientChecks ? (clientChecks[c] === true) : true;
    });
  }
  if (rol === 'CALIDAD' || rol === 'REPORTES' || rol === 'SUPERVISOR') {
    CAMPANAS_CALIDAD.forEach(function(c){
      p['campana_' + c] = campaignChecks ? (campaignChecks[c] === true) : true;
    });
  }
  return p;
}

function ensurePerms(u) {
  if (!u.perms) { u.perms = buildPerms(u.rol); return; }
  if (u.rol === 'ADMIN') { u.perms.isAdmin = true; return; }
  if (u.rol === 'AUX_ADMIN') {
    ADMIN_ACTIONS.forEach(function(a){ if(u.perms[a.key]===undefined) u.perms[a.key]=false; });
    REGULAR_ROLES.forEach(function(r){ if(u.perms['role_'+r.key]===undefined) u.perms['role_'+r.key]=false; });
    return;
  }
  var defMod = ROLE_DEFAULT[u.rol];
  DASH_MODULES.forEach(function(m){ if(u.perms[m.key]===undefined) u.perms[m.key]=(m.key===defMod); });
  if (u.rol==='GERENCIA') { u.perms.Calidad = true; }
  if (u.rol==='CLIENTES_DASH' || u.rol==='SUPERVISOR') {
    CLIENTES_LIST.forEach(function(c){ if(u.perms['cliente_'+c]===undefined) u.perms['cliente_'+c]=true; });
  }
  if (u.rol==='CALIDAD' || u.rol==='REPORTES' || u.rol==='SUPERVISOR') {
    CAMPANAS_CALIDAD.forEach(function(c){ if(u.perms['campana_'+c]===undefined) u.perms['campana_'+c]=true; });
  }
}

// ═══════════════════════════════════════════════════════════
// PERSISTENCE
// ═══════════════════════════════════════════════════════════
// saveData() ya no existe como "guardar todo el arreglo": cada accion
// (crear, editar, cambiar password, etc.) llama a su propio endpoint.
// Esta funcion solo se deja como recordatorio visual ("Guardado") y para
// no romper llamadas antiguas que pudieran quedar sueltas en la UI.
function saveData() {
  var el=document.getElementById('save-flash');
  if(!el) return;
  el.classList.add('show'); clearTimeout(el._t);
  el._t=setTimeout(function(){el.classList.remove('show');},1600);
}

function saveHist() { /* el historial se guarda en el servidor al momento de cada accion */ }

async function loadData() {
  try {
    var rows = await apiRequest('GET', '/users');
    users = rows || [];
    nextId = users.reduce(function(m,u){return Math.max(m,u.id+1);}, 10);
    users.forEach(function(u){ ensurePerms(u); });
  } catch(e){
    users = [];
    showToast('No se pudo conectar con el servidor: ' + e.message);
  }
}

async function loadHist() {
  try {
    historial = await apiRequest('GET', '/historial');
  } catch(e){ historial = []; }
}

function resetData() {
  showToast('El restablecimiento de datos de ejemplo ahora se hace desde el servidor (ver README), para no borrar datos reales por accidente.');
}

// ═══════════════════════════════════════════════════════════
