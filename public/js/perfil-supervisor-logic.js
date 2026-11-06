// perfil-supervisor-logic.js — Fase 283 (pedido de Edwin, 06/11): perfil propio del
// SUPERVISOR. Antes, para que un supervisor viera los tableros habia que darle los
// permisos de un CLIENTE (cliente_<C>) y, para Calidad, los de campaña
// (campana_<C>). Ahora tiene UNA lista: "Clientes que supervisa" (supervisa_<C>).
// Por cada cliente supervisado: abre su tablero desde su portal, carga sus bases
// (todos los modulos) y hace su control de Calidad. No crea usuarios ni cambia
// contraseñas de otros (eso sigue siendo del administrador).
//
// "Perfil efectivo": un SUPERVISOR que ya tiene alguna llave supervisa_<C> (true o
// false) usa SOLO esa lista: sus cliente_/campana_ viejos se ignoran (no se
// borran de la base). Un SUPERVISOR sin ninguna supervisa_ sigue exactamente como
// antes (hasta que se le pasa al perfil nuevo desde Usuarios). La misma funcion
// la usan el servidor (getActor y el inicio de sesion) y el navegador, asi que
// todas las reglas de acceso que ya existen (tableros, Calidad, cargas por
// cliente) siguen funcionando sin cambiar una por una. Sin DOM.
'use strict';

var SUPERVISA_PREFIJO = 'supervisa_';

// ¿Este SUPERVISOR ya esta en el perfil nuevo?
function supervisorUsaPerfil(rol, perms) {
  if (rol !== 'SUPERVISOR' || !perms) return false;
  return Object.keys(perms).some(function (k) { return k.indexOf(SUPERVISA_PREFIJO) === 0; });
}

// Clientes que supervisa (los marcados).
function supervisorClientes(perms) {
  return Object.keys(perms || {}).filter(function (k) { return k.indexOf(SUPERVISA_PREFIJO) === 0 && perms[k] === true; })
    .map(function (k) { return k.slice(SUPERVISA_PREFIJO.length); });
}

// Permisos con los que se decide el acceso. Para un SUPERVISOR en el perfil nuevo:
// cliente_<C> y campana_<C> salen SOLO de supervisa_<C>; el resto queda igual.
function permisosEfectivos(rol, perms) {
  var p = perms || {};
  if (!supervisorUsaPerfil(rol, p)) return p;
  var out = {};
  Object.keys(p).forEach(function (k) {
    if (k.indexOf('cliente_') === 0 || k.indexOf('campana_') === 0) return;
    out[k] = p[k];
  });
  supervisorClientes(p).forEach(function (c) { out['cliente_' + c] = true; out['campana_' + c] = true; });
  return out;
}

// Para el formulario de Usuarios: los clientes que hay que marcar al abrir un
// SUPERVISOR. En el perfil nuevo, sus supervisa_; si todavia no, los que hoy le
// dan acceso (cliente_ o campana_) -- es la "migracion": se ve marcado lo que ya
// tenia y, al guardar, queda en el perfil nuevo.
function supervisorClientesIniciales(rol, perms, clientes) {
  var p = perms || {};
  if (supervisorUsaPerfil(rol, p)) return supervisorClientes(p);
  return (clientes || []).filter(function (c) { return p['cliente_' + c] === true || p['campana_' + c] === true; });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SUPERVISA_PREFIJO: SUPERVISA_PREFIJO, supervisorUsaPerfil: supervisorUsaPerfil, supervisorClientes: supervisorClientes,
    permisosEfectivos: permisosEfectivos, supervisorClientesIniciales: supervisorClientesIniciales };
}
