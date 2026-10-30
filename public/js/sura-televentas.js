// sura-televentas.js — Fase 215: abre el tablero "Televentas" de SURA dentro
// de la plataforma (login, encabezado, tema claro/oscuro). La logica del
// tablero (calculos y graficas del HTML de Edwin) vive en
// sura-televentas-app.js, dentro de un Shadow DOM para que sus ids y estilos
// no choquen con los de la plataforma. Aqui solo:
//   - el overlay y el encabezado de la plataforma;
//   - el objeto API que reemplaza a IndexedDB (rutas /api/sura-televentas);
//   - las pestanas que ve cada rol (las decide el servidor: el cliente no ve
//     "Cargar informacion" ni botones para cambiar datos; Fase 218);
//   - el tema: copia data-theme del documento al Shadow DOM.
// Fase 218: la misma app se monta una segunda vez en el Centro de cargas
// («Cargar Datos»), solo con «Cargar información» (stvMontarCarga).

var _stv = { cliente: null, host: null, root: null, app: null, abierto: false, observador: null };
var _stvCarga = { cliente: null, host: null, root: null, app: null, abierto: false };

// Cliente con este tablero (registro de clientes: parametros.especificos).
function stvEsTeleventas(cliente) {
  var reg = (typeof REGISTRO_CLIENTES !== 'undefined' && REGISTRO_CLIENTES) || [];
  return reg.some(function (c) {
    var esp = (c.parametros && c.parametros.especificos) || [];
    return c.nombre === cliente && esp.indexOf('sura_televentas') !== -1;
  });
}

// ArrayBuffer -> base64 sin armar un string gigante a mano.
function _stvBase64(buf) {
  return new Promise(function (res, rej) {
    var fr = new FileReader();
    fr.onload = function () { var s = String(fr.result); res(s.slice(s.indexOf(',') + 1)); };
    fr.onerror = function () { rej(fr.error || new Error('No se pudo leer el archivo')); };
    fr.readAsDataURL(new Blob([buf]));
  });
}

function _stvApi(cliente) {
  var base = '/sura-televentas/' + encodeURIComponent(cliente);
  function ruta(tipo, mes) { return base + '/bases/' + tipo + '/' + mes; }
  return {
    resumen: function () { return apiRequest('GET', base + '/resumen'); },
    base: function (tipo, mes) { return apiRequest('GET', ruta(tipo, mes)); },
    guardar: async function (tipo, mes, nombre, buf, datos) {
      try {
        var archivo = await _stvBase64(buf);
        return await apiRequest('POST', ruta(tipo, mes), { archivoNombre: nombre, datos: datos, archivo: archivo });
      } catch (e) { e.guardando = true; throw e; }
    },
    // Pide confirmacion antes (el HTML ya lo hace); devuelve true si se borro.
    eliminar: async function (tipo, mes, msgEl) {
      try { await apiRequest('DELETE', ruta(tipo, mes)); return true; } catch (e) {
        if (msgEl) msgEl.textContent = 'No se pudo eliminar: ' + e.message;
        return false;
      }
    },
    // Excel original para "Descargar" (solo administrador): { name, buf } o null.
    archivo: async function (tipo, mes) {
      try {
        var r = await fetch(API_BASE + ruta(tipo, mes) + '/archivo', { headers: apiHeaders(false) });
        if (!r.ok) return null;
        var cd = r.headers.get('Content-Disposition') || '';
        var m = cd.match(/filename\*=UTF-8''([^;]+)/i) || cd.match(/filename="?([^";]+)"?/i);
        return { name: m ? decodeURIComponent(m[1]) : (tipo + '_' + mes + '.xlsx'), buf: await r.arrayBuffer() };
      } catch (e) { return null; }
    },
    config: async function (clave, valor) {
      try { await apiRequest('PUT', base + '/config/' + clave, { valor: valor }); } catch (e) {
        if (typeof showToast === 'function') showToast('No se pudo guardar: ' + e.message);
        throw e;
      }
    }
  };
}

// Hoja del Shadow DOM con la version del build (como los ?v= de index.html).
function _stvHojaCss() {
  var v = (typeof window !== 'undefined' && window.__BUILD_ID__) ? '?v=' + encodeURIComponent(window.__BUILD_ID__) : '';
  return '<link rel="stylesheet" href="css/sura-televentas-app.css' + v + '">';
}

function _stvSincronizarTema() {
  var tema = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  [_stv.host, _stvCarga.host].forEach(function (h) { if (h) h.setAttribute('data-theme', tema); });
}

// Shadow DOM con la hoja y el marcado del tablero, y el tema al dia (un solo
// observador para los dos lugares donde se monta).
function _stvPrepararHost(host) {
  var root = host.shadowRoot || host.attachShadow({ mode: 'open' });
  root.innerHTML = _stvHojaCss() + STV_MARKUP;
  if (!_stv.observador) {
    _stv.observador = new MutationObserver(_stvSincronizarTema);
    _stv.observador.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  return root;
}

function _stvCrearHost() {
  var host = document.getElementById('stv-host');
  var root = _stvPrepararHost(host);
  _stv.host = host;
  _stv.root = root;
  _stvSincronizarTema();
  var modal = document.getElementById('stv-modal');
  var head = modal.querySelector('.aurora-header');
  var fijar = function () { host.style.setProperty('--stv-header-h', head.offsetHeight + 'px'); };
  fijar();
  if (typeof ResizeObserver === 'function') new ResizeObserver(fijar).observe(head);
}

// Pestanas y botones segun lo que devuelve el servidor (PERM.pestanas,
// PERM.puedeEditar). La primera pestana permitida queda abierta.
function _stvAplicarPermisos(perm) {
  var root = _stv.root;
  var permitidas = perm.pestanas || [];
  root.querySelectorAll('.tab').forEach(function (t) { t.hidden = permitidas.indexOf(t.dataset.p) === -1; });
  root.querySelector('.wrap').classList.toggle('stv-lectura', !perm.puedeEditar);
  var actual = root.querySelector('.tab.on');
  if (!actual || actual.hidden) {
    var primera = root.querySelector('.tab:not([hidden])');
    if (primera) primera.click();
  }
}

async function openSuraTeleventas(cliente) {
  var overlay = document.getElementById('stv-overlay');
  // El selector de clientes deja el resto de la pagina `inert`: se cierra
  // antes, y el tablero entra a la pila de dialogos (fondo inerte, foco
  // adentro, Tab que da la vuelta). Sin funcion de cierre en Escape: igual
  // que el tablero de cliente, Escape no lo cierra (motion-helpers.js).
  if (typeof closeClientsModal === 'function') closeClientsModal();
  overlay.classList.add('show');
  if (typeof motionAbrirDialogo === 'function') motionAbrirDialogo(overlay);
  document.body.style.overflow = 'hidden';
  _stv.abierto = true;
  document.getElementById('stv-title').textContent = 'Televentas ' + cliente;
  document.getElementById('stv-sub').textContent = 'Cargando…';
  if (!_stv.host) _stvCrearHost();
  if (!_stv.app || _stv.cliente !== cliente) {
    _stv.root.innerHTML = _stvHojaCss() + STV_MARKUP;
    _stv.cliente = cliente;
    _stv.app = stvCrearApp(_stv.root, _stvApi(cliente), function () { return _stv.abierto; });
  }
  try {
    var perm = await _stv.app.cargar();
    _stvAplicarPermisos(perm);
    document.getElementById('stv-sub').textContent = perm.puedeEditar
      ? 'Ventas, metas y estrategias por mes'
      : 'Ventas por mes';
  } catch (e) {
    document.getElementById('stv-sub').textContent = '';
    if (typeof showToast === 'function') showToast('No se pudo abrir el tablero: ' + e.message);
  }
}

// Fase 218: «Cargar información» de SURA dentro del Centro de cargas. Es la
// misma app (stvCrearApp, misma API y mismo CSS) con la clase stv-solo-carga,
// que deja solo ese panel. Se crea una vez y en cada apertura vuelve a leer
// del servidor; devuelve el resumen (puedeEditar dice si es administrador).
async function stvMontarCarga(host, cliente) {
  _stvCarga.abierto = true;
  if (_stvCarga.host !== host) {
    _stvCarga.host = host;
    _stvCarga.root = _stvPrepararHost(host);
    _stvCarga.app = null;
    _stvSincronizarTema();
  }
  if (!_stvCarga.app || _stvCarga.cliente !== cliente) {
    _stvCarga.root.innerHTML = _stvHojaCss() + STV_MARKUP;
    _stvCarga.root.querySelector('.wrap').classList.add('stv-solo-carga');
    _stvCarga.cliente = cliente;
    _stvCarga.app = stvCrearApp(_stvCarga.root, _stvApi(cliente), function () { return _stvCarga.abierto; });
  }
  return _stvCarga.app.cargar();
}

function stvDesmontarCarga() {
  _stvCarga.abierto = false;
}

function closeSuraTeleventas() {
  _stv.abierto = false;
  var overlay = document.getElementById('stv-overlay');
  overlay.classList.remove('show');
  if (typeof motionCerrarDialogo === 'function') motionCerrarDialogo(overlay);
  document.body.style.overflow = '';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { stvEsTeleventas: stvEsTeleventas };
}
