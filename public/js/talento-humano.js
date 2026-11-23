// talento-humano.js — Fase GH1 (pedido de Edwin, reunión 23/11/2026): abre «Talento humano», la app de
// Gestión humana de Edwin, dentro de SinCo (menú y barra de SinCo, su visual tal cual). La app vive en
// public/gestion-humana/ (GENERADA por scripts/gestion-humana/generar-talento-humano.js; no se edita a
// mano) y corre en un iframe del mismo origen.
// Fase GH2: guarda en el servidor (/api/gh/estado, por talento-humano-api.js dentro del iframe). Al
// cerrar se manda lo pendiente y el iframe se descarga (al salir de sesión no quedan datos en memoria).
// El rol GESTION_HUMANA ve la tarjeta solo si el servidor lo deja (GH_ROL_ACTIVO=1, con OK del usuario).
'use strict';

// Ruta de la app, con la versión del build para no quedarse con una copia vieja en caché.
function talentoHumanoUrl(buildId) {
  return 'gestion-humana/talento-humano.html' + (buildId ? '?v=' + encodeURIComponent(buildId) : '');
}

function talentoHumanoAbrir() {
  var fr = document.getElementById('th-frame');
  if (!fr) return;
  // Se carga de nuevo en cada apertura: siempre lee lo último del servidor.
  if (!fr.getAttribute('src')) fr.setAttribute('src', talentoHumanoUrl(typeof window !== 'undefined' && window.__BUILD_ID__));
  openModal('th-overlay');
  try { fr.focus(); } catch (e) { /* nada */ }
}

// «Cerrar» de SinCo, «⌂ Menú principal» de la app (window.parent.talentoHumanoCerrar), salir de sesión y
// «Ver como» (cerrar-ventanas.js). Lo pendiente sale ANTES de descargar el iframe (la petición se arma
// con el token vigente aunque la sesión se cierre justo después).
function talentoHumanoCerrar() {
  closeModal('th-overlay');
  var fr = document.getElementById('th-frame');
  if (!fr) return;
  var envio = null;
  try { var w = fr.contentWindow; if (w && w.GH_STORE && typeof w.GH_STORE.vaciar === 'function') envio = w.GH_STORE.vaciar(); } catch (e) { envio = null; }
  var descargar = function () {
    var actual = document.getElementById('th-frame');
    if (!actual || actual !== fr) return;
    var nuevo = fr.cloneNode(false);
    nuevo.removeAttribute('src');
    fr.parentNode.replaceChild(nuevo, fr);
  };
  if (envio && typeof envio.then === 'function') envio.then(descargar, descargar); else descargar();
}

// ¿Este rol ve la tarjeta? El administrador la tiene siempre (dashTarjetasEntrada); GESTION_HUMANA solo
// si el servidor responde puede:true. Puro para las pruebas.
function talentoHumanoRolPide(rol, esFullAdmin) { return !esFullAdmin && rol === 'GESTION_HUMANA'; }

// Al pintar el menú: pide /gh/acceso y agrega la tarjeta si corresponde (no bloquea el menú).
function talentoHumanoTarjetaRol(rol, esFullAdmin, grid, tarjetaEntrada) {
  if (!talentoHumanoRolPide(rol, esFullAdmin) || !grid || typeof apiRequest !== 'function') return;
  apiRequest('GET', '/gh/acceso').then(function (r) {
    if (!r || r.puede !== true || grid.querySelector('[data-entrada="talento"]')) return;
    grid.insertAdjacentHTML('afterbegin', tarjetaEntrada({ key: 'talento', label: 'Talento humano', sub: 'Empleados, ausentismos y vacaciones', icon: 'i-contact', accion: 'talentoHumanoAbrir' }));
  }, function () { /* sin acceso o sin red: sin tarjeta */ });
}

if (typeof module !== 'undefined' && module.exports) module.exports = { talentoHumanoUrl: talentoHumanoUrl, talentoHumanoRolPide: talentoHumanoRolPide };
