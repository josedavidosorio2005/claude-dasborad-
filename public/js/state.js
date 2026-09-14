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
  if (rol === 'CALIDAD' || rol === 'REPORTES' || rol === 'SUPERVISOR' || rol === 'GERENCIA') {
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
    CLIENTES_LIST.forEach(function(c){ if(u.perms['cliente_'+c]===undefined) u.perms['cliente_'+c]=false; });
  }
  if (u.rol==='CALIDAD' || u.rol==='REPORTES' || u.rol==='SUPERVISOR') {
    CAMPANAS_CALIDAD.forEach(function(c){ if(u.perms['campana_'+c]===undefined) u.perms['campana_'+c]=false; });
  }
  if (u.rol==='GERENCIA') {
    CAMPANAS_CALIDAD.forEach(function(c){ if(u.perms['campana_'+c]===undefined) u.perms['campana_'+c]=false; });
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

// ═══════════════════════════════════════════════════════════
// DATOS DE DEMOSTRACION — banner "esto no es real" (ver seed-demo.js)
// ═══════════════════════════════════════════════════════════
var seedDemoActivo = false;

async function loadSeedDemoEstado() {
  try {
    var r = await apiRequest('GET', '/seed-demo/estado');
    seedDemoActivo = !!(r && r.activo);
  } catch (e) {
    seedDemoActivo = false; // si falla el chequeo, no se muestra un aviso a medias
  }
  renderSeedDemoBanner();
}

function ensureSeedDemoBannerEl() {
  var el = document.getElementById('seed-demo-banner');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'seed-demo-banner';
  el.className = 'hidden';
  // position:sticky (no fixed) para que empuje el contenido en flujo normal,
  // pero con z-index por encima de CUALQUIER overlay/modal de la app (el mas
  // alto existente es .toast en 3000) para que tambien se vea con un
  // dashboard abierto. Se inserta como PRIMER hijo de <body>, antes que
  // login-page/admin-page/user-page/... asi aparece encima de la que este
  // visible sin tocar el markup de cada pantalla.
  el.style.cssText =
    'position:sticky;top:0;left:0;right:0;z-index:4000;background:#92400e;color:#fff;' +
    'text-align:center;padding:8px 14px;font-size:0.85rem;font-weight:700;' +
    'letter-spacing:.2px;box-shadow:0 2px 10px rgba(0,0,0,.25)';
  el.textContent = '⚠ DATOS DE DEMOSTRACIÓN — la información mostrada es de prueba y no corresponde a la operación real.';
  document.body.insertBefore(el, document.body.firstChild);
  return el;
}

function renderSeedDemoBanner() {
  var el = ensureSeedDemoBannerEl();
  el.classList.toggle('hidden', !seedDemoActivo);
  // El navbar de cada pantalla tambien es sticky top:0 (misma tecnica) — sin
  // esto, al hacer scroll el navbar quedaria pegado justo debajo del banner
  // en el mismo punto y el banner (con mas z-index) lo taparia parcialmente.
  document.querySelectorAll('.navbar').forEach(function (nb) {
    nb.style.top = seedDemoActivo ? '34px' : '';
  });
}

function resetData() {
  showToast('El restablecimiento de datos de ejemplo ahora se hace desde el servidor (ver README), para no borrar datos reales por accidente.');
}

// ═══════════════════════════════════════════════════════════
