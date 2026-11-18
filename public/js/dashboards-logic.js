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

// Fase 216: clientes con tablero propio (hoy SURA, "Televentas") para la
// lista "Dashboards configurados" de Admin. No viven en dashboards_config
// (no se arman con el constructor): salen del registro de clientes, por
// parametros.especificos -- la misma marca que usa stvEsTeleventas().
var DASH_TABLEROS_PROPIOS = { sura_televentas: 'Televentas' };

function dashTablerosPropios(registro) {
  var out = [];
  (registro || []).forEach(function (c) {
    var esp = (c && c.parametros && c.parametros.especificos) || [];
    Object.keys(DASH_TABLEROS_PROPIOS).forEach(function (k) {
      if (esp.indexOf(k) !== -1) out.push({ cliente: c.nombre, titulo: DASH_TABLEROS_PROPIOS[k], especifico: k });
    });
  });
  return out;
}

// Fase 281: ¿el cliente ya tiene tablero? Uno generico (construidos = los de
// dashboards_config, BUILT_CLIENT_DASHBOARDS) o uno propio del registro (SURA,
// Televentas). La usan el selector de clientes y el Portal Supervisor, para que
// ningun portal marque como "Proximamente" un tablero que ya existe (el Portal
// Supervisor solo miraba los genericos y SURA salia "Proximamente").
function dashClienteTieneTablero(cliente, construidos, registro) {
  if ((construidos || []).indexOf(cliente) !== -1) return true;
  return dashTablerosPropios(registro).some(function (t) { return t.cliente === cliente; });
}

// Fase 282: clientes "libres" para armar un tablero NUEVO en Admin › Dashboards ›
// Nuevo dashboard: los que todavia no tienen tablero, ni generico ni propio (SURA,
// Televentas, ya no sale). Al editar, el cliente que se edita siempre queda.
function dashClientesLibres(clientesList, construidos, registro, editando) {
  return (clientesList || []).filter(function (c) { return c === editando || !dashClienteTieneTablero(c, construidos, registro); });
}

// Fase 357 (B, pedido de Edwin 17/11): menú único de tarjetas para todos los internos. Además
// de los módulos por permiso, tarjetas de entrada: «Administración» (ADMIN, y el Auxiliar Admin
// que ya entraba al panel), «Mi portal» (SUPERVISOR) y «Cargar Datos» (quien puede cargar).
// Puro: se prueba en Node.
function dashTarjetasEntrada(rol, esFullAdmin, puedeCargar) {
  var t = [];
  if (esFullAdmin || rol === 'AUX_ADMIN') t.push({ key: 'admin', label: 'Administración', sub: 'Usuarios, permisos, historial y configuración', icon: 'i-lock', accion: 'enterAdminPanel' });
  if (rol === 'SUPERVISOR' && !esFullAdmin) t.push({ key: 'portal', label: 'Mi portal', sub: 'Tus clientes, cargas y metas de Calidad', icon: 'i-users', accion: 'enterSupervisorPage' });
  // Fase 358: «Malla de turnos» (ADMIN y supervisor editan; Reportes la ve).
  if (esFullAdmin || rol === 'SUPERVISOR' || rol === 'REPORTES') t.push({ key: 'malla', label: 'Malla de turnos', sub: 'Horarios por semana y grupos de asesoras', icon: 'i-calendar', accion: 'mallaAbrir' });
  if (puedeCargar) t.push({ key: 'cargar', label: 'Cargar Datos', sub: 'Subir Excel de los dashboards', icon: 'i-upload', accion: 'openCentroCargas' });
  // Fase 364 (pedido de Edwin 18/11, B2): «Sugerencias / Tickets» como tarjeta propia (antes en la barra superior).
  t.push({ key: 'tickets', label: 'Sugerencias / Tickets', sub: 'Reporta un problema, una pregunta o una idea', icon: 'i-message-circle', accion: 'ticketsAbrir' });
  return t;
}

// Fase 357 (B): a qué pantalla entra cada rol al iniciar sesión.
function dashPantallaDeEntrada(rol, esMaestro) {
  if (esMaestro || rol === 'ADMIN') return 'tarjetas';
  if (rol === 'AUX_ADMIN') return 'admin';
  if (rol === 'ASESOR') return 'asesor';
  return 'tarjetas'; // SUPERVISOR, GERENCIA, REPORTES, CALIDAD, CLIENTES_DASH, SISTEMAS, ...
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    dashTarjetasEntrada: dashTarjetasEntrada, dashPantallaDeEntrada: dashPantallaDeEntrada, // Fase 357 (B)
    dashClienteTieneTablero: dashClienteTieneTablero,
    dashClientesLibres: dashClientesLibres,
    dashModulosVisibles: dashModulosVisibles,
    dashClientesVisibles: dashClientesVisibles,
    dashRolesVisibles: dashRolesVisibles,
    dashTablerosPropios: dashTablerosPropios,
  };
}
