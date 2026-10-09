// motion-helpers.js — Fase 136 (PR 4), base de movimiento.
//
// Orquesta la transicion de ENTRADA/SALIDA de elementos que hoy se
// muestran/ocultan con display:none (modales, overlays) -- CSS solo no
// puede animar ESE cambio porque display no es una propiedad animable.
//
// No depende de ninguna libreria externa a proposito: la auditoria de la
// Fase 135 estimo "motion" (sucesor JS-plano de Framer Motion) en 22 KB
// gzip (v11.15.0); medido de nuevo en esta fase con la ultima version
// estable publicada hace >=14 dias (v13.4.2, unico build autoalojable
// sin bundler), el peso real es 49 KB gzip -- mas del doble. Los 2 casos
// de uso reales de esta fase (salida de modales, transicion entre
// pestañas) no necesitan fisica de resortes ni scroll-linked animation
// -- se resuelven igual con esto, sin añadir ningun peso. Ver
// docs/auditoria-ui-fase135.md (Paso 1) y docs/sistema-de-diseno.md.
//
// Patron: el elemento ya tiene una transition CSS normal (opacity/
// transform) sobre una clase de estado (la convencion de este archivo es
// '.motion-show', pero el caller puede usar la que ya tenga el
// componente). motionExit() quita esa clase (dispara la transicion de
// salida) y espera 'transitionend' antes de llamar onDone (donde el
// caller pone display:none/oculta el elemento) -- con
// prefers-reduced-motion o data-motion="off" activos, la regla global ya
// existente deja la transicion en ~0.01ms, asi que 'transitionend' sigue
// disparando casi al instante: el modal se sigue cerrando bien, solo sin
// movimiento visible.
function motionExit(el, onDone, claseShow) {
  claseShow = claseShow || 'motion-show';
  if (!el) { if (onDone) onDone(); return; }
  var listo = false;
  function terminar() {
    if (listo) return;
    listo = true;
    el.removeEventListener('transitionend', alTerminarTransicion);
    if (onDone) onDone();
  }
  function alTerminarTransicion(e) {
    if (e.target !== el) return;
    terminar();
  }
  el.addEventListener('transitionend', alTerminarTransicion);
  // Salvavidas: si transitionend no dispara por lo que sea (ej. el
  // elemento no tenia ninguna propiedad realmente animada en ese
  // momento), no dejar el modal atascado -- 400ms cubre --dur-slow
  // (320ms, la mas lenta de la especificacion) con margen.
  setTimeout(terminar, 400);
  el.classList.remove(claseShow);
}

// Entrada: agrega la clase en el frame SIGUIENTE a que el elemento ya
// sea visible (display != none) -- si se hace en el mismo frame que se
// cambia display, el navegador no tiene un estado "antes" que animar y
// el elemento aparece de golpe.
function motionEnter(el, claseShow) {
  claseShow = claseShow || 'motion-show';
  if (!el) return;
  el.classList.remove(claseShow);
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      el.classList.add(claseShow);
    });
  });
}

// Doble modo: global en el navegador (los modulos se cargan por
// <script>), y require() en Node para pruebas de regresion.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { motionExit: motionExit, motionEnter: motionEnter };
}
