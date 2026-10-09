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

// Fase 136 (PR 8, F04): los 6 modales/overlays que comparten el mismo
// toggle display:none/flex (.show en el overlay, ver styles.css) usan
// este mismo par -- mantiene la LOGICA de abrir/cerrar de cada
// open*/close* exactamente igual (nunca se toca el .classList.add/
// remove('show') del overlay en si, ni el orden de lo que cada funcion
// ya hacia antes/despues), solo envuelve el momento en que el modal
// se vuelve visible/invisible con la clase .motion-modal-show en su
// HIJO real (#calidad-modal, etc.).
//
// Pila de overlays REALMENTE abiertos, en el orden en que se abrieron --
// hallazgo real probando este PR: Calidad puede abrir "Supervisar Lider"
// ENCIMA de si misma sin cerrarse primero (calidad-overlay se queda con
// .show mientras supervisar-lider-overlay tambien lo tiene) -- un
// anidamiento real que ya existia antes de este PR, no algo nuevo. Sin
// esta pila, Escape no podria saber cual de los 2 overlays visibles es
// el de ARRIBA (el que el usuario espera cerrar primero).
var MOTION_OVERLAY_STACK = [];
function _motionOverlayDe(modal) {
  return (modal && modal.parentElement && modal.parentElement.id) ? modal.parentElement.id : null;
}
// motionAbrirModal: llamar DESPUES de overlay.classList.add('show') --
// el orden dentro de cada open*() no importa, mientras la clase 'show'
// ya este puesta (si no, el modal esta en display:none y la transicion
// no se ve).
function motionAbrirModal(modalId) {
  var modal = document.getElementById(modalId);
  if (!modal) return;
  motionEnter(modal, 'motion-modal-show');
  var overlayId = _motionOverlayDe(modal);
  if (overlayId) {
    var i = MOTION_OVERLAY_STACK.indexOf(overlayId);
    if (i > -1) MOTION_OVERLAY_STACK.splice(i, 1);
    MOTION_OVERLAY_STACK.push(overlayId);
  }
}
// motionCerrarModal: reemplaza el closeX() completo -- hace la
// transicion de salida del modal y SOLO DESPUES llama a cerrarReal()
// (la funcion que el caller pasa, con el overlay.classList.remove
// ('show') y cualquier otra cosa que el close* original ya hiciera,
// en el mismo orden de siempre). Si el modal no existe en el DOM,
// cerrarReal() se llama de inmediato (nunca deja algo a medias).
function motionCerrarModal(modalId, cerrarReal) {
  var modal = document.getElementById(modalId);
  function sacarDeLaPila() {
    var overlayId = _motionOverlayDe(modal);
    if (overlayId) {
      var i = MOTION_OVERLAY_STACK.indexOf(overlayId);
      if (i > -1) MOTION_OVERLAY_STACK.splice(i, 1);
    }
    cerrarReal();
  }
  if (!modal) { cerrarReal(); return; }
  motionExit(modal, sacarDeLaPila, 'motion-modal-show');
}

// Fase 136 (PR 8): Escape cierra el modal/overlay de MAS ARRIBA (el
// ultimo abierto que sigue abierto, via MOTION_OVERLAY_STACK) --
// hallazgo real al armar el checklist de prueba de este PR (abrir/
// cerrar/guardar/cancelar/Esc/clic fuera): NINGUNO de los 6 modales
// tenia un atajo de teclado para cerrar, solo el boton "X Cerrar" y el
// clic fuera (ya existian, sin tocar). Siempre el mismo close*() de
// siempre -- nunca un camino nuevo de cierre, solo un disparador nuevo.
// Si el foco esta en un <input>/<select>/<textarea> dentro del modal,
// Escape lo cierra igual (es el comportamiento esperado de un dialogo)
// -- la UNICA excepcion es si hay un <input type="date"> con su propio
// calendario nativo abierto, que el navegador ya intercepta con su
// propio Escape antes de que llegue aqui.
var MOTION_MODALES_ESC = {
  'calidad-overlay': function () { if (typeof closeCalidad === 'function') closeCalidad(); },
  'detalle-monitoreo-overlay': function () { if (typeof closeDetalleMonitoreo === 'function') closeDetalleMonitoreo(); },
  'supervisar-lider-overlay': function () { if (typeof closeSupervisionLider === 'function') closeSupervisionLider(); },
  'cargas-overlay': function () { if (typeof closeCargas === 'function') closeCargas(); },
  'dashcfg-overlay': function () { if (typeof closeDashCfgModal === 'function') closeDashCfgModal(); },
  'gd-overlay': function () { if (typeof closeGenericDashboard === 'function') closeGenericDashboard(); },
};
// typeof document !== 'undefined': mismo patron dual navegador/Node que
// el resto del archivo -- Node (server/tests/fase136-pr4-base-
// movimiento.test.js hace require() directo de este archivo) no tiene
// `document` global, y un addEventListener de nivel de modulo (no
// dentro de una funcion) se ejecutaria apenas se cargue el archivo.
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    // De atras hacia adelante: el ultimo de la pila es el de mas arriba.
    // Si por lo que sea quedo un id en la pila cuyo overlay YA no tiene
    // .show (ej. se cerro por otro camino sin pasar por motionCerrarModal),
    // se descarta y se sigue probando el siguiente -- nunca se queda
    // atascado en una entrada vieja.
    while (MOTION_OVERLAY_STACK.length) {
      var overlayId = MOTION_OVERLAY_STACK[MOTION_OVERLAY_STACK.length - 1];
      var ov = document.getElementById(overlayId);
      if (ov && ov.classList.contains('show')) {
        var cerrar = MOTION_MODALES_ESC[overlayId];
        if (cerrar) cerrar();
        return;
      }
      MOTION_OVERLAY_STACK.pop();
    }
  });
}

// Doble modo: global en el navegador (los modulos se cargan por
// <script>), y require() en Node para pruebas de regresion.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { motionExit: motionExit, motionEnter: motionEnter, motionAbrirModal: motionAbrirModal, motionCerrarModal: motionCerrarModal };
}
