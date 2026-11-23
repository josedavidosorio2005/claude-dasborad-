// talento-humano-api.js — Fase GH2 (escrito a mano, NO lo genera el script): guardado de «Talento
// humano» en el servidor. La app de Edwin (talento-humano-app.js, generada) usa GH_STORE donde antes
// usaba localStorage. Este archivo:
//   - lee todo de GET /api/gh/estado antes de cargar la app (la app lee sincrónico al arrancar);
//   - guarda cada sección con PUT /api/gh/estado/:clave y su `version`. Si otra persona guardó antes
//     (409), esa sección deja de guardar y avisa que hay que volver a abrir: nunca pisa lo del otro;
//   - si falla la red, avisa y lo vuelve a intentar con el siguiente cambio o al cerrar (sin bucle);
//   - las marcas internas de la app (_init*, _impdemo, _lastcopy) siguen en el navegador.
// Las peticiones van por apiRequest de SinCo (window.parent, mismo origen): misma sesión y token.
'use strict';

var GH_CLAVES = ['inconexion_gh_empleados_v1', 'inconexion_gh_empleados_v1_vac', 'inconexion_gh_empleados_v1_nov',
  'inconexion_gh_empleados_v1_aus', 'inconexion_gh_empleados_v1_auscfg', 'inconexion_gh_empleados_v1_cfg'];

var GH_TEXTOS = {
  conflicto: 'Otra persona guardó cambios en Talento humano mientras lo tenías abierto. Tus últimos cambios NO se guardaron: cierra y vuelve a abrir Talento humano para ver lo último.',
  error: 'No se pudo guardar en la plataforma. Se intentará de nuevo con tu próximo cambio o al cerrar. ',
  guardado: '',
};

// opts: api(method, path, body) -> Promise (error con .status); local: almacén para lo que no es dato
// (localStorage); alAviso(tipo, texto); esperaMs: pausa antes de guardar (junta cambios seguidos).
function ghCrearAlmacen(opts) {
  var esperaMs = opts.esperaMs === undefined ? 600 : opts.esperaMs;
  var datos = {}, versiones = {}, pendientes = {}, enVuelo = {}, bloqueadas = {}, fallo = {}, timers = {};
  var esDato = function (k) { return GH_CLAVES.indexOf(k) !== -1; };
  var tiene = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  var aviso = function (tipo, texto) { if (typeof opts.alAviso === 'function') opts.alAviso(tipo, texto); };

  function cargar(claves) {
    Object.keys(claves || {}).forEach(function (k) {
      if (!esDato(k)) return;
      datos[k] = String(claves[k].valor);
      versiones[k] = Number(claves[k].version) || 0;
    });
  }
  function getItem(k) {
    k = String(k);
    if (!esDato(k)) { try { return opts.local ? opts.local.getItem(k) : null; } catch (e) { return null; } }
    return tiene(datos, k) ? datos[k] : null;
  }
  function setItem(k, v) {
    k = String(k); v = String(v);
    if (!esDato(k)) { try { if (opts.local) opts.local.setItem(k, v); } catch (e) { /* nada */ } return; }
    if (bloqueadas[k]) { aviso('conflicto', GH_TEXTOS.conflicto); return; }
    if (datos[k] === v && !tiene(pendientes, k)) return; // sin cambios: no gasta una versión
    datos[k] = v;
    pendientes[k] = v;
    programar(k);
  }
  function removeItem(k) {
    k = String(k);
    if (!esDato(k)) { try { if (opts.local) opts.local.removeItem(k); } catch (e) { /* nada */ } }
  }
  function programar(k) {
    if (timers[k]) clearTimeout(timers[k]);
    timers[k] = setTimeout(function () { timers[k] = null; enviar(k); }, esperaMs);
  }
  function enviar(k) {
    if (enVuelo[k]) return enVuelo[k];
    if (bloqueadas[k] || !tiene(pendientes, k)) return Promise.resolve();
    var v = pendientes[k];
    delete pendientes[k];
    fallo[k] = false;
    enVuelo[k] = Promise.resolve()
      .then(function () { return opts.api('PUT', '/gh/estado/' + encodeURIComponent(k), { valor: v, version: versiones[k] || 0 }); })
      .then(function (r) {
        versiones[k] = r.version;
        if (!Object.keys(fallo).some(function (x) { return fallo[x]; }) && !Object.keys(bloqueadas).length) aviso('guardado', GH_TEXTOS.guardado);
      }, function (e) {
        if (e && e.status === 409) { bloqueadas[k] = true; aviso('conflicto', GH_TEXTOS.conflicto); return; }
        if (!tiene(pendientes, k)) pendientes[k] = v; // se reintenta con el próximo cambio o al cerrar
        fallo[k] = true;
        aviso('error', GH_TEXTOS.error + ((e && e.message) || ''));
      })
      .then(function () {
        enVuelo[k] = null;
        // Llegó otro cambio mientras guardaba (y este salió bien): se manda ese también.
        if (!fallo[k] && !bloqueadas[k] && tiene(pendientes, k) && !timers[k]) programar(k);
      });
    return enVuelo[k];
  }
  // Manda YA todo lo pendiente (al cerrar la ventana o salir). La petición sale antes de devolver.
  function vaciar() {
    var claves = Object.keys(timers).filter(function (k) { return timers[k]; });
    claves.forEach(function (k) { clearTimeout(timers[k]); timers[k] = null; });
    var todas = Object.keys(pendientes).concat(Object.keys(enVuelo).filter(function (k) { return enVuelo[k]; }));
    return Promise.all(todas.filter(function (k, i) { return todas.indexOf(k) === i; }).map(function (k) {
      return Promise.resolve(enVuelo[k]).then(function () { return enviar(k); });
    }));
  }
  function hayPendientes() {
    return Object.keys(pendientes).length > 0 || Object.keys(enVuelo).some(function (k) { return enVuelo[k]; });
  }
  return { cargar: cargar, getItem: getItem, setItem: setItem, removeItem: removeItem, vaciar: vaciar, hayPendientes: hayPendientes,
    _version: function (k) { return versiones[k] || 0; }, _bloqueada: function (k) { return !!bloqueadas[k]; } };
}

// ── En el navegador: leer del servidor y después cargar la app de Edwin ──
function _ghAviso(tipo, texto) {
  var el = document.getElementById('gh-aviso');
  if (!el) {
    el = document.createElement('div');
    el.id = 'gh-aviso';
    el.setAttribute('role', 'alert');
    el.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99999;max-width:min(620px,calc(100vw - 32px));' +
      'background:var(--card-2);border:1px solid var(--red);color:var(--ink);padding:12px 16px;border-radius:12px;font-size:14px;line-height:1.45;box-shadow:var(--shadow)';
    document.body.appendChild(el);
  }
  el.textContent = texto || '';
  el.hidden = !texto;
}
function _ghMensajeInicio(texto) {
  var main = document.getElementById('main');
  if (main) main.innerHTML = '<div class="card" style="margin:24px;padding:24px" role="alert"></div>';
  var c = main && main.firstChild;
  if (c) c.textContent = texto;
}
function ghArrancar() {
  var padre = null;
  try { padre = window.parent !== window && typeof window.parent.apiRequest === 'function' ? window.parent : null; } catch (e) { padre = null; }
  if (!padre) { _ghMensajeInicio('Abre Talento humano desde SinCo (menú principal).'); return; }
  var api = function (m, p, b) { return padre.apiRequest(m, p, b); };
  api('GET', '/gh/estado').then(function (r) {
    var almacen = ghCrearAlmacen({ api: api, local: window.localStorage, alAviso: _ghAviso });
    almacen.cargar(r && r.claves);
    window.GH_STORE = almacen;
    var s = document.createElement('script');
    s.src = 'talento-humano-app.js' + (location.search || '');
    document.body.appendChild(s);
  }, function (e) {
    _ghMensajeInicio(e && e.status === 403 ? 'No tienes acceso a Talento humano.' : 'No se pudo abrir Talento humano: ' + ((e && e.message) || 'error de conexión') + '. Cierra y vuelve a intentarlo.');
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GH_CLAVES: GH_CLAVES, GH_TEXTOS: GH_TEXTOS, ghCrearAlmacen: ghCrearAlmacen };
} else if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  ghArrancar();
}
