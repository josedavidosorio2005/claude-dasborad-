// talento-humano.js — Fase GH1 (pedido de Edwin, reunión 23/11/2026): abre «Talento humano», la app de
// Gestión humana de Edwin, dentro de SinCo (menú y barra de SinCo, su visual tal cual). La app vive en
// public/gestion-humana/ (GENERADA por scripts/gestion-humana/generar-talento-humano.js; no se edita a
// mano) y corre en un iframe del mismo origen. En GH1 guarda en el navegador; GH2 la pasa al servidor.
'use strict';

// Ruta de la app, con la versión del build para no quedarse con una copia vieja en caché.
function talentoHumanoUrl(buildId) {
  return 'gestion-humana/talento-humano.html' + (buildId ? '?v=' + encodeURIComponent(buildId) : '');
}

function talentoHumanoAbrir() {
  var fr = document.getElementById('th-frame');
  if (!fr) return;
  // Se carga una sola vez por sesión de página: reabrir la ventana conserva donde iba.
  if (!fr.getAttribute('src')) fr.setAttribute('src', talentoHumanoUrl(typeof window !== 'undefined' && window.__BUILD_ID__));
  openModal('th-overlay');
  try { fr.focus(); } catch (e) { /* nada */ }
}

// «Cerrar» de SinCo y «⌂ Menú principal» de la app (desde el iframe, window.parent.talentoHumanoCerrar).
function talentoHumanoCerrar() {
  closeModal('th-overlay');
}

if (typeof module !== 'undefined' && module.exports) module.exports = { talentoHumanoUrl: talentoHumanoUrl };
