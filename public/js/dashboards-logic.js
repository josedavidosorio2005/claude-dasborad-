// dashboards-logic.js — InConexion Platform (Fase 83).
//
// Logica PURA (sin DOM) de que modulos/clientes puede ver un usuario en la
// pantalla "Selecciona un modulo" y en el modal "Dashboard Clientes".
// Doble modo, mismo patron que agendas-logic.js/cargas-logic.js: global en
// el navegador (dashboards-core.js la llama para pintar), require() en
// Node para las pruebas (server/tests/dashboards-logic.test.js).
//
// Fase 83 (hallazgo real: un usuario con acceso a un solo modulo veia
// igual TODOS los demas, atenuados con "Sin acceso" -- un boton que no
// lleva a ningun lado es puro ruido, el candado real ya vive en el
// servidor desde las Fases 72/81/82). Estas 2 funciones son la UNICA
// fuente de que se pinta: exactamente los mismos permisos que ya manda el
// servidor en el login (`currentUser.perms`), nunca una lista aparte que
// se pueda desincronizar. isFullAdmin se recibe como parametro (no se
// referencia el global de ui-core.js) para que esta funcion sea pura y
// facil de probar con cualquier combinacion, sin depender de `currentUser`
// global ni de cargar el resto de la app.
'use strict';

// Modulos visibles en el grid de "Selecciona un modulo". `m.soon` (modulo
// aun no construido) se deja SIEMPRE visible -- es un estado distinto de
// "sin permiso": explica que el modulo existe pero no esta listo, no
// esconde un acceso real.
function dashModulosVisibles(modulos, currentUser, esFullAdmin) {
  return (modulos || []).filter(function (m) {
    if (m.soon) return true;
    if (esFullAdmin) return true;
    return !!(currentUser && currentUser.perms && currentUser.perms[m.key] === true);
  });
}

// Clientes visibles en el modal "Dashboard Clientes" (perms.cliente_<c>).
function dashClientesVisibles(clientesList, currentUser, esFullAdmin) {
  return (clientesList || []).filter(function (c) {
    if (esFullAdmin) return true;
    return !!(currentUser && currentUser.perms && currentUser.perms['cliente_' + c] === true);
  });
}

// Roles visibles en la grilla de "Permisos" (roles-perms.js). Un Auxiliar
// Admin nunca maneja ADMIN/AUX_ADMIN (limite estructural, no un permiso
// que se pueda otorgar); del resto, solo los roles con canAccessRole
// (perms.role_<rol>). `esFullAdmin` ve todos.
function dashRolesVisibles(roles, esFullAdmin, puedeAccederRol) {
  return (roles || []).filter(function (r) {
    if (esFullAdmin) return true;
    if (r.key === 'ADMIN' || r.key === 'AUX_ADMIN') return false;
    return !!(puedeAccederRol && puedeAccederRol(r.key));
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    dashModulosVisibles: dashModulosVisibles,
    dashClientesVisibles: dashClientesVisibles,
    dashRolesVisibles: dashRolesVisibles,
  };
}
