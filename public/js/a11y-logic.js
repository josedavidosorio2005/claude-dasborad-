// a11y-logic.js — InConexion Platform (Fase 144, A2).
//
// Logica PURA (sin DOM) de accesibilidad por teclado, en doble modo como
// esc.js: global en el navegador (se carga por <script>) y require() en Node
// para las pruebas (server/tests/fase144-a2-teclado.test.js). El pegamento
// con el DOM vive en a11y-teclado.js.
'use strict';

// Patron "Tabs" de la WAI-ARIA APG con ACTIVACION MANUAL (consultado en
// Context7, /w3c/wai-aria-practices): las flechas solo MUEVEN el foco entre
// pestañas; Enter/Espacio la activan (los <button> ya lo hacen solos). Se
// eligio manual porque cada panel de esta app se arma al vuelo (innerHTML +
// peticion a la API): activar en cada flecha dispararia una carga por tecla.
// Devuelve el indice de la pestaña que debe recibir el foco, o -1 si la
// tecla no es de navegacion. Circular, como pide la APG.
function a11yIndiceTabSiguiente(actual, total, tecla) {
  if (!total || total < 1) return -1;
  if (actual < 0 || actual >= total) actual = 0;
  switch (tecla) {
    case 'ArrowRight': return (actual + 1) % total;
    case 'ArrowLeft': return (actual - 1 + total) % total;
    case 'Home': return 0;
    case 'End': return total - 1;
    default: return -1;
  }
}

// Teclas que activan un control con role="button" que NO es un <button>
// nativo (un <a> sin href, un <div> de tarjeta): Enter y Espacio, igual que
// un boton real (WCAG 2.1.1).
function a11yEsTeclaDeActivacion(tecla) {
  return tecla === 'Enter' || tecla === ' ' || tecla === 'Spacebar';
}

// Con `indiceActivo` (la pestaña seleccionada) devuelve el tabindex que le
// toca a cada una: 0 a la activa, -1 al resto ("roving tabindex": Tab entra
// a la barra en la pestaña activa y sale de ella con el siguiente Tab).
function a11yTabindexItinerante(total, indiceActivo) {
  var activo = indiceActivo >= 0 && indiceActivo < total ? indiceActivo : 0;
  var out = [];
  for (var i = 0; i < total; i++) out.push(i === activo ? 0 : -1);
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    a11yIndiceTabSiguiente: a11yIndiceTabSiguiente,
    a11yEsTeclaDeActivacion: a11yEsTeclaDeActivacion,
    a11yTabindexItinerante: a11yTabindexItinerante,
  };
}
