// api.js — InConexion Platform. Extraído de index.html (antes un único <script>).
// Se carga como <script src> global y en orden; todas las funciones son globales
// y se invocan desde manejadores del HTML. No cambiar el orden de carga.

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// API — el backend (server.js) es la unica fuente de verdad.
// Ya no se usa localStorage para usuarios/contrasenas/historial.
// ═══════════════════════════════════════════════════════════
var API_BASE = '/api';
var authToken = null; // JWT de la sesion actual (en memoria, no en localStorage)
var PASSWORD_MIN = 8; // politica minima de contrasena (debe coincidir con el servidor)

function apiHeaders(json){
  var h = {};
  if (json) h['Content-Type'] = 'application/json';
  if (authToken) h['Authorization'] = 'Bearer ' + authToken;
  return h;
}

// Traduce fallos técnicos a un mensaje que el usuario entienda.
// Si el servidor ya envió un texto claro en data.error, ese tiene prioridad.
function friendlyHttpError(status){
  if (status === 401) return 'Tu sesion expiro. Vuelve a iniciar sesion.';
  if (status === 403) return 'No tienes permiso para realizar esta accion.';
  if (status === 404) return 'No se encontro el recurso solicitado.';
  if (status === 409) return 'El dato ya existe o esta en uso.';
  if (status === 429) return 'Demasiados intentos seguidos. Espera un momento e intentalo de nuevo.';
  if (status >= 500) return 'El servidor tuvo un problema. Intentalo de nuevo en unos minutos.';
  return 'Error ' + status;
}

async function apiRequest(method, path, body){
  var res;
  try {
    res = await fetch(API_BASE + path, {
      method: method,
      headers: apiHeaders(!!body),
      body: body ? JSON.stringify(body) : undefined
    });
  } catch(e){
    // fetch solo rechaza por fallo de red / CORS / servidor caído
    throw new Error('No se pudo conectar con el servidor. Revisa tu conexion e intentalo de nuevo.');
  }
  var data = null;
  try { data = await res.json(); } catch(e){}
  if (!res.ok) {
    var msg = (data && data.error) ? data.error : friendlyHttpError(res.status);
    var err = new Error(msg);
    err.status = res.status;   // para que el llamador pueda distinguir 409, 403, etc.
    err.data = data;
    throw err;
  }
  return data;
}

// Fase 95 (tema D): "vX.Y.Z" discreto en el menu de usuario de cada
// pagina (.navbar-app-version). Unica fuente de verdad: package.json,
// expuesto por el servidor en GET /health (nunca se copia el numero a
// mano en el HTML, para que no se desactualice).
var _appVersion = null;
async function renderAppVersion(){
  if(_appVersion===null){
    try{
      var h = await apiRequest('GET','/health');
      _appVersion = (h && h.version) ? ('v'+h.version) : '';
    }catch(e){ _appVersion = ''; }
  }
  document.querySelectorAll('.navbar-app-version').forEach(function(el){ el.textContent = _appVersion; });
}
document.addEventListener('DOMContentLoaded', renderAppVersion);
