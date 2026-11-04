// calidad-sondeo-logic.js — InConexion Platform (Fase 236).
// "Tiempo real" de Calidad sin conexiones abiertas (plan de Calidad,
// docs/calidad-plan-edwin-nov.md, sección 6, opción B + C):
//   - el portal del ASESOR vuelve a pedir el aviso de monitoreos nuevos cada
//     CAL_SONDEO_ASESOR_MS (solo con la pestaña visible) y al volver a ella;
//   - el dashboard de un cliente, con la pestaña Calidad abierta, vuelve a
//     pedir los monitoreos cada CAL_SONDEO_DASH_MS y al volver a la pestaña,
//     y solo se redibuja si llegaron cambios.
// Logica pura (sin DOM ni temporizadores): global en el navegador, require()
// en Node para las pruebas.
'use strict';

var CAL_SONDEO_ASESOR_MS = 3 * 60 * 1000;
var CAL_SONDEO_DASH_MS = 5 * 60 * 1000;

// ¿Toca consultar ahora? Solo con la pestaña del navegador visible, con
// sesion, y si paso el intervalo desde la ultima consulta (o se pide forzar,
// p. ej. al volver a la pestaña).
function calSondeoToca(estado) {
  var e = estado || {};
  if (!e.conSesion || e.visible === false) return false;
  if (e.forzar) return true;
  return !e.ultima || (e.ahora - e.ultima) >= e.intervalo;
}

// Firma de una lista de monitoreos: cambia si se agrega, borra o edita uno
// (id + updatedAt/createdAt). Sirve para no redibujar si no cambio nada.
function calSondeoFirma(monitoreos) {
  return (monitoreos || []).map(function (m) { return m.id + ':' + (m.updatedAt || m.createdAt || ''); }).sort().join('|');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calSondeoToca: calSondeoToca, calSondeoFirma: calSondeoFirma, CAL_SONDEO_ASESOR_MS: CAL_SONDEO_ASESOR_MS, CAL_SONDEO_DASH_MS: CAL_SONDEO_DASH_MS };
}
