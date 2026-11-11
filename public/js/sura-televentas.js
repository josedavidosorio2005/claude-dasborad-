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

var _stv = { cliente: null, host: null, root: null, app: null, abierto: false, observador: null, listo: false };
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

// Fase 273 (punto 5 de Edwin, 06/11): mientras llega el primer resumen, el
// marcado del HTML de Edwin trae «Cargar información» (p1) como pestaña
// activa, y se veia ~2 s antes del tablero. Ahora, hasta aplicar los permisos,
// la .wrap lleva .stv-cargando: todo oculto salvo un indicador de carga. Va en
// un <style> en linea (no en el .css, que llega por <link> y puede tardar mas
// que el propio marcado).
var STV_CSS_CARGANDO =
  '.stv-cargando-ind{display:none}' +
  '.wrap.stv-cargando>*:not(.stv-cargando-ind){display:none!important}' +
  '.wrap.stv-cargando>.stv-cargando-ind{display:flex;align-items:center;justify-content:center;gap:10px;min-height:220px;padding:40px 16px;' +
    'color:var(--c-text-muted,#5b6b73);font-family:inherit;font-size:0.95rem;text-align:center}' +
  '.stv-cargando-ind .stv-spin{width:20px;height:20px;flex:none;border:2.5px solid var(--c-border,#d6dee2);border-top-color:var(--c-primary-mid,#0f6f8a);border-radius:50%;animation:stv-giro .8s linear infinite}' +
  '.stv-cargando-ind.stv-error .stv-spin{display:none}' +
  '@keyframes stv-giro{to{transform:rotate(360deg)}}' +
  '@media (prefers-reduced-motion:reduce){.stv-cargando-ind .stv-spin{animation:none}}' +
  ':host-context([data-motion="off"]) .stv-cargando-ind .stv-spin{animation:none}';

// Hoja del Shadow DOM con la version del build (como los ?v= de index.html).
function _stvHojaCss() {
  var v = (typeof window !== 'undefined' && window.__BUILD_ID__) ? '?v=' + encodeURIComponent(window.__BUILD_ID__) : '';
  return '<style>' + STV_CSS_CARGANDO + '</style><link rel="stylesheet" href="css/sura-televentas-app.css' + v + '">';
}

// Fase 273: estado de carga del tablero. estado: 'cargando' (indicador),
// 'error' (mensaje, sin pestañas: nunca «Cargar información») o null (tablero).
function _stvEstadoCarga(root, estado, texto) {
  var wrap = root && root.querySelector('.wrap');
  if (!wrap) return;
  var ind = wrap.querySelector('.stv-cargando-ind');
  if (!ind) {
    ind = document.createElement('div');
    ind.className = 'stv-cargando-ind';
    ind.setAttribute('role', 'status');
    ind.setAttribute('aria-live', 'polite');
    wrap.insertBefore(ind, wrap.firstChild);
  }
  wrap.classList.toggle('stv-cargando', !!estado);
  ind.classList.toggle('stv-error', estado === 'error');
  ind.innerHTML = estado ? '<span class="stv-spin" aria-hidden="true"></span><span></span>' : '';
  if (estado) ind.lastChild.textContent = texto || 'Cargando el tablero…';
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
// Fase 242 (pedido de Edwin, 04/11): «Cargar información» (p1) sale del
// tablero para TODOS (también el administrador): esa carga queda solo en
// Cargar datos (stvMontarCarga, que la muestra por CSS con .stv-solo-carga).
var STV_PESTANAS_SOLO_CENTRO = ['p1'];
function _stvAplicarPermisos(perm) {
  var root = _stv.root;
  var permitidas = (perm.pestanas || []).filter(function (p) { return STV_PESTANAS_SOLO_CENTRO.indexOf(p) === -1; });
  root.querySelectorAll('.tab').forEach(function (t) { t.hidden = permitidas.indexOf(t.dataset.p) === -1; });
  root.querySelector('.wrap').classList.toggle('stv-lectura', !perm.puedeEditar);
  var actual = root.querySelector('.tab.on');
  if (!actual || actual.hidden) {
    var primera = root.querySelector('.tab:not([hidden])');
    if (primera) primera.click();
  }
}

// ── Fase 335: pestaña «Calidad» de Televentas ─────────────────────────────
// Se agrega DESDE AFUERA de la app de Edwin (sura-televentas-app.js no se toca, asi no se
// pierde si se regenera el HTML): un boton mas en su menu (misma clase .tab) y una seccion
// con un <slot>. El contenido va en el DOM normal del host (slot="stv-calidad"), donde el bloque
// «Resultado de los monitoreos» (calidad-panel.js) encuentra sus elementos y los estilos de la
// plataforma; se ve con el mismo tema. Plantilla de descuento, filtro Mes propio; el filtro
// Campaña de Televentas no aplica (los monitoreos no traen ese dato). La tabla por asesor la
// decide el registro (asesorVisibleCliente), igual que en las demas campañas; el cliente
// nunca recibe evaluador ni observaciones (servidor).
var STV_CAL_NOTA = 'Resultado de los monitoreos de Calidad con la plantilla «Televentas SURA». Usa su propio filtro de mes; el filtro de campaña de las otras pestañas (Odontológico / Salud para ti) no aplica aquí, porque los monitoreos no traen la campaña.';
var STV_CAL_I = 'stvcal'; // sufijo de los ids del bloque (gd-pstvcal, cmp-c-...-stvcal)

function _stvCalidadMontar(root, cliente) {
  var tabs = root.querySelector('.tabs');
  var wrap = root.querySelector('.wrap');
  if (!tabs || !wrap || root.querySelector('.tab[data-p="pcal"]')) return;
  var btn = document.createElement('button');
  btn.className = 'tab'; btn.type = 'button'; btn.dataset.p = 'pcal'; btn.hidden = true;
  btn.innerHTML = '<svg class="icono" aria-hidden="true" focusable="false"><use href="img/iconos/lucide.svg#i-circle-check"></use></svg>Calidad';
  tabs.appendChild(btn);
  var sec = document.createElement('section');
  sec.id = 'pcal'; sec.hidden = true;
  sec.innerHTML = '<div class="card"><h2>✅ Calidad</h2><div class="msg" style="margin:0">' + esc(STV_CAL_NOTA) + '</div></div><slot name="stv-calidad"></slot>';
  wrap.appendChild(sec);
  btn.addEventListener('click', function () { _stvCalidadAbrir(root, cliente); });
  // Otra pestaña de Televentas: su propio manejador muestra su seccion; aqui se esconde Calidad.
  tabs.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('.tab');
    if (t && t.dataset.p !== 'pcal') sec.hidden = true;
  });
}

// La pestaña se ve si quien mira tiene acceso a los monitoreos de la campaña (admin, supervisor
// y cliente de SURA): el servidor responde la lista; sin acceso, 403 y la pestaña no sale.
async function _stvCalidadPermiso(root, cliente) {
  var btn = root.querySelector('.tab[data-p="pcal"]');
  if (!btn) return;
  var ok = false;
  try { await apiRequest('GET', '/monitoreos/total?campana=' + encodeURIComponent(cliente)); ok = true; } catch (e) { ok = false; }
  btn.hidden = !ok;
}

async function _stvCalidadAbrir(root, cliente) {
  root.querySelectorAll('.tab').forEach(function (x) { x.classList.toggle('on', x.dataset.p === 'pcal'); });
  root.querySelectorAll('.wrap > section').forEach(function (s) { s.hidden = s.id !== 'pcal'; });
  ['gfbar', 'dhbar'].forEach(function (id) { var el = root.getElementById ? root.getElementById(id) : root.querySelector('#' + id); if (el) el.hidden = true; });
  var luz = _stvCalidadLuz();
  var cont = document.getElementById('gd-p' + STV_CAL_I);
  cont.innerHTML = '<div class="aurora-card"><p class="ca-vacio">Cargando…</p></div>';
  try {
    if (typeof loadCalData === 'function') await loadCalData(cliente);
  } catch (e) { /* sin datos: el bloque lo dice */ }
  var hay = typeof CAL_DB !== 'undefined' && CAL_DB[cliente] && (CAL_DB[cliente].monitoreos || []).length;
  if (!hay) { cont.style.display = ''; cont.innerHTML = '<div class="aurora-card"><p class="ca-vacio">Todavía no hay monitoreos de Calidad para ' + esc(cliente) + '.</p></div>'; return; }
  if (typeof _cmpRender === 'function') _cmpRender({ tipo: 'calidad_monitoreos_panel', campana: cliente, mesesPropios: true }, STV_CAL_I);
  luz.hidden = false;
}

// Contenedor en el DOM normal del host (se proyecta en el <slot> de la seccion).
function _stvCalidadLuz() {
  var host = _stv.host;
  var luz = host.querySelector('[slot="stv-calidad"]');
  if (!luz) {
    luz = document.createElement('div');
    luz.setAttribute('slot', 'stv-calidad');
    luz.className = 'stv-cal-luz';
    luz.innerHTML = '<div id="gd-p' + STV_CAL_I + '"></div>';
    host.appendChild(luz);
  }
  return luz;
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
    _stv.listo = false;
    _stv.app = stvCrearApp(_stv.root, _stvApi(cliente), function () { return _stv.abierto; });
  }
  // Fase 273: hasta que el servidor diga que pestañas van (y con que datos),
  // solo el indicador. Al volver a abrir, el tablero ya armado se queda a la
  // vista mientras recarga (como antes).
  if (!_stv.listo) _stvEstadoCarga(_stv.root, 'cargando');
  try {
    var perm = await _stv.app.cargar();
    _stvCalidadMontar(_stv.root, cliente); // Fase 335: pestaña Calidad (antes de elegir la primera)
    _stvAplicarPermisos(perm);
    await _stvCalidadPermiso(_stv.root, cliente);
    _stv.listo = true;
    _stvEstadoCarga(_stv.root, null);
    document.getElementById('stv-sub').textContent = perm.puedeEditar
      ? 'Ventas, metas y estrategias por mes'
      : 'Ventas por mes';
  } catch (e) {
    document.getElementById('stv-sub').textContent = '';
    if (!_stv.listo) _stvEstadoCarga(_stv.root, 'error', 'No se pudo cargar el tablero. Ciérralo y vuelve a abrirlo.');
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
