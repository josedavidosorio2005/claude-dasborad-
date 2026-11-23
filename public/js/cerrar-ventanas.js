// cerrar-ventanas.js — Fase 362: al cerrar sesión y al entrar o salir de «ver como» se cierra
// TODA ventana abierta (Calidad, Televentas, Gerencia, Inventario, diálogos...). Antes solo se
// cerraban el tablero y las cargas: la ventana de Calidad de una persona quedaba abierta para la
// siguiente (visto en la revisión final en producción del 17/11).
//
// Cada ventana abierta se cierra primero con SU función, si tiene (algunas liberan algo: Calidad
// suelta la llamada de encuesta tomada, Televentas devuelve el scroll), y después se le quita
// `show` a lo que quede abierto, aunque esa función tenga animación o no exista.
'use strict';

var CERRAR_VENTANAS_SELECTOR = '.modal-overlay.show, .clients-modal-overlay.show, [id$="-overlay"].show';
var CERRAR_VENTANAS_FUNCIONES = {
  'calidad-overlay': 'closeCalidad',
  'supervisar-lider-overlay': 'closeSupervisionLider',
  'detalle-monitoreo-overlay': 'closeDetalleMonitoreo',
  'stv-overlay': 'closeSuraTeleventas',
  'gd-overlay': 'closeGenericDashboard',
  'dashcfg-overlay': 'closeDashCfgModal',
  'cargas-overlay': 'closeCargas',
  'centro-overlay': 'closeCentroCargas',
  'clients-modal-overlay': 'closeClientsModal',
  'gerencia-overlay': 'closeGerencia',
  'gestionhumana-overlay': 'closeGestionHumana',
  'inventario-overlay': 'closeInventario',
  'activos-overlay': 'activosCerrar', // Fase 369
  'th-overlay': 'talentoHumanoCerrar', // Fase GH1
};

// `doc` y `global` se pueden pasar en las pruebas; en el navegador son document y window.
function cerrarVentanasAbiertas(doc, global) {
  doc = doc || document;
  global = global || (typeof window !== 'undefined' ? window : globalThis);
  var abiertas = Array.prototype.slice.call(doc.querySelectorAll(CERRAR_VENTANAS_SELECTOR));
  abiertas.forEach(function (el) {
    var fn = global[CERRAR_VENTANAS_FUNCIONES[el.id]];
    if (typeof fn === 'function') { try { fn(); } catch (e) { /* igual se cierra abajo */ } }
  });
  abiertas.forEach(function (el) { el.classList.remove('show'); });
  if (doc.body && doc.body.style) doc.body.style.overflow = '';
  return abiertas.length;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { cerrarVentanasAbiertas: cerrarVentanasAbiertas, CERRAR_VENTANAS_SELECTOR: CERRAR_VENTANAS_SELECTOR, CERRAR_VENTANAS_FUNCIONES: CERRAR_VENTANAS_FUNCIONES };
}
