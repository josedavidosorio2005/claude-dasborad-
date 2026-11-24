// orlant-sta.js — Fase STA: abre «Gestión STA» de ORLANT (HTML de Edwin, generado en
// orlant-sta-app.js) en su overlay, dentro de un Shadow DOM, con el objeto API que habla con
// /api/orlant/sta (server/routes/orlant-sta.js). Qué ve cada quien lo decide el servidor:
// supervisor de ORLANT / ADMIN / GERENCIA → vista de supervisor; ASESOR de ORLANT → solo sus casos.
'use strict';

var _sta = { host: null, root: null, app: null, abierto: false };
var STA_BASE = '/orlant/sta';

// ArrayBuffer -> base64 sin armar un string gigante a mano (como Televentas).
function _staBase64(buf) {
  return new Promise(function (res, rej) {
    var fr = new FileReader();
    fr.onload = function () { var s = String(fr.result); res(s.slice(s.indexOf(',') + 1)); };
    fr.onerror = function () { rej(fr.error || new Error('No se pudo leer el archivo')); };
    fr.readAsDataURL(new Blob([buf]));
  });
}

function _staApi(vista) {
  var caso = function (n) { return STA_BASE + '/casos/' + encodeURIComponent(n); };
  var num = function (x) { return Number(x); };
  return {
    // Pedido de Edwin (23/11): la pestaña del Dashboard pide la vista «cliente» (solo «Gráficas»).
    estado: function () { return apiRequest('GET', STA_BASE + '/estado' + (vista === 'cliente' ? '?vista=cliente' : '')); },
    cargar: async function (file, columnas, filas) {
      var buf = await file.arrayBuffer();
      var b64 = await _staBase64(buf);
      return apiRequest('POST', STA_BASE + '/cargas', { archivo: file.name, columnas: columnas, filas: filas, archivoB64: b64 });
    },
    borrarCarga: function (id, conservar) { return apiRequest('DELETE', STA_BASE + '/cargas/' + encodeURIComponent(id) + (conservar ? '?conservar=1' : '')); },
    descargar: async function (id) {
      try {
        var r = await fetch(API_BASE + STA_BASE + '/cargas/' + encodeURIComponent(id) + '/archivo', { headers: apiHeaders(false) });
        if (!r.ok) return false;
        var cd = r.headers.get('Content-Disposition') || '';
        var m = cd.match(/filename\*=UTF-8''([^;]+)/i);
        var a = document.createElement('a');
        a.href = URL.createObjectURL(await r.blob());
        a.download = m ? decodeURIComponent(m[1]) : 'base_sta.xlsx';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        return true;
      } catch (e) { return false; }
    },
    asignar: function (agenteId, cantidad, filtros) { return apiRequest('POST', STA_BASE + '/asignar', { agenteId: num(agenteId), cantidad: cantidad, filtros: filtros }); },
    devolver: function (agenteId, numeros) { return apiRequest('POST', STA_BASE + '/devolver', { agenteId: num(agenteId), numeros: numeros }); },
    regresar: function (cuerpo) { return apiRequest('POST', STA_BASE + '/gestionados/regresar', cuerpo); }, // pedido de Edwin 23/11
    pasar: function (agenteId, destinoId, numeros) { return apiRequest('POST', STA_BASE + '/pasar', { agenteId: num(agenteId), destinoId: num(destinoId), numeros: numeros }); },
    tipis: function (tipis, efectivas) { return apiRequest('PUT', STA_BASE + '/config/tipis', { tipis: tipis, efectivas: efectivas }); },
    codificar: function (n, datos) { return apiRequest('POST', caso(n) + '/codificar', datos); },
    rellamada: function (n, accion) { return apiRequest('POST', caso(n) + '/rellamada', { accion: accion }); },
  };
}

function _staHojaCss() {
  var v = (typeof window !== 'undefined' && window.__BUILD_ID__) ? '?v=' + encodeURIComponent(window.__BUILD_ID__) : '';
  return '<link rel="stylesheet" href="css/orlant-sta-app.css' + v + '">';
}

// Anfitriones de la app (el overlay y, desde el 23/11, la pestaña STA del Dashboard): todos siguen el tema.
var _staHosts = [];
var _staObsTema = null;
function _staSincronizarTema() {
  var t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  _staHosts = _staHosts.filter(function (h) { return h === _sta.host || document.body.contains(h); });
  _staHosts.forEach(function (h) { h.setAttribute('data-theme', t); });
}
function _staRegistrarHost(host, app) {
  if (_staHosts.indexOf(host) === -1) _staHosts.push(host);
  if (!_staObsTema) {
    _staObsTema = new MutationObserver(_staSincronizarTema);
    _staObsTema.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  // Los manejadores en línea del HTML de Edwin llaman a window.STAapp: la instancia que recibe el
  // clic, el foco o la tecla pasa a ser la activa (antes de que corra el manejador).
  ['pointerdown', 'focusin', 'keydown'].forEach(function (ev) { host.addEventListener(ev, function () { app.activar(); }, true); });
  _staSincronizarTema();
}

async function openOrlantSta() {
  var overlay = document.getElementById('sta-overlay');
  if (typeof closeClientsModal === 'function') closeClientsModal();
  overlay.classList.add('show');
  if (typeof motionAbrirDialogo === 'function') motionAbrirDialogo(overlay);
  document.body.style.overflow = 'hidden';
  _sta.abierto = true;
  document.getElementById('sta-sub').textContent = 'Cargando…';
  if (!_sta.host) {
    _sta.host = document.getElementById('sta-host');
    _sta.root = _sta.host.shadowRoot || _sta.host.attachShadow({ mode: 'open' });
  }
  if (!_sta.app) {
    _sta.root.innerHTML = _staHojaCss() + STA_MARKUP;
    _sta.app = staCrearApp(_sta.root, _staApi(), function () { return _sta.abierto; }, closeOrlantSta);
    _staRegistrarHost(_sta.host, _sta.app);
  }
  _staSincronizarTema();
  _sta.app.activar();
  try {
    await _sta.app.iniciar();
    document.getElementById('sta-sub').textContent = _sta.app.vista() === 'supervisor'
      ? 'ORLANT · Base, asignación y tipificaciones'
      : 'ORLANT · Mis casos';
  } catch (e) {
    document.getElementById('sta-sub').textContent = '';
    if (typeof showToast === 'function') showToast('No se pudo abrir Gestión STA: ' + e.message);
  }
}

function closeOrlantSta() {
  _sta.abierto = false;
  var overlay = document.getElementById('sta-overlay');
  overlay.classList.remove('show');
  if (typeof motionCerrarDialogo === 'function') motionCerrarDialogo(overlay);
  document.body.style.overflow = '';
}

// Pedido de Edwin (23/11/2026): la pestaña STA del Dashboard de ORLANT muestra la MISMA visual de
// «Gráficas» del supervisor, de solo lectura (el servidor manda los casos recortados). Monta la app de
// Edwin en un Shadow DOM propio dentro de `contenedor` y devuelve la instancia.
async function staMontarCliente(contenedor) {
  var host = document.createElement('div');
  host.className = 'sta-cli-host';
  contenedor.innerHTML = '';
  contenedor.appendChild(host);
  var root = host.attachShadow({ mode: 'open' });
  root.innerHTML = _staHojaCss() + STA_MARKUP;
  var app = staCrearApp(root, _staApi('cliente'), function () { return document.body.contains(host); }, function () {});
  _staRegistrarHost(host, app);
  app.activar();
  await app.iniciar();
  return app;
}

// ¿Quién ve la tarjeta «Gestión STA»? (el servidor vuelve a revisar cada ruta)
// Supervisor con ORLANT, ADMIN, GERENCIA y los ASESOR de ORLANT. Nunca el cliente.
function staVeTarjeta(user, esFullAdmin) {
  if (esFullAdmin) return true;
  if (!user) return false;
  var p = user.perms || {};
  if (user.rol === 'GERENCIA') return true;
  if (user.rol === 'SUPERVISOR') return p.campana_ORLANT === true || p.cliente_ORLANT === true || p.supervisa_ORLANT === true;
  if (user.rol === 'ASESOR') return user.asesorCampana === 'ORLANT';
  return false;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { staVeTarjeta: staVeTarjeta };
