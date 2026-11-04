// usuarios-filtro-logic.js — InConexion Platform (Fase 234).
// Filtros de Admin › Usuarios: buscador de texto + rol + campaña/cliente.
// Logica pura (sin DOM): global en el navegador, require() en Node para las
// pruebas. Pedido del plan de Calidad (docs/calidad-plan-edwin-nov.md, sec. 7):
// con todos los asesores dentro, la lista tiene que poder filtrarse.
'use strict';

var USUARIOS_SIN_CAMPANA = '__SIN__';

// Campañas o clientes de un usuario: permisos campana_X / cliente_X en true y
// la campaña del asesor (asesorCampana). Sin repetir, en orden alfabetico.
function usuariosCampanasDe(u) {
  var set = {};
  var perms = (u && u.perms) || {};
  Object.keys(perms).forEach(function (k) {
    if (perms[k] !== true) return;
    var m = /^(campana|cliente)_(.+)$/.exec(k);
    if (m) set[m[2]] = true;
  });
  if (u && u.asesorCampana) set[u.asesorCampana] = true;
  return Object.keys(set).sort();
}

function _usuariosNorm(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// f = { texto, rol, campana }. `etiquetaRol(rol)` da el nombre visible del
// rol (para buscar "auxiliar" y encontrar AUX_ADMIN). campana =
// USUARIOS_SIN_CAMPANA deja los que no tienen ninguna.
function usuariosFiltrar(lista, f, etiquetaRol) {
  f = f || {};
  var t = _usuariosNorm(f.texto);
  var et = typeof etiquetaRol === 'function' ? etiquetaRol : function (r) { return r; };
  return (lista || []).filter(function (u) {
    if (f.rol && u.rol !== f.rol) return false;
    if (f.campana) {
      var cs = usuariosCampanasDe(u);
      if (f.campana === USUARIOS_SIN_CAMPANA ? cs.length : cs.indexOf(f.campana) === -1) return false;
    }
    if (!t) return true;
    return [u.nombre, u.user, et(u.rol), u.rol].some(function (x) { return _usuariosNorm(x).indexOf(t) !== -1; });
  });
}

// Opciones de los desplegables, solo con lo que hay en la lista (mas los
// clientes conocidos, para poder filtrar uno sin usuarios todavia).
function usuariosOpcionesFiltro(lista, clientesConocidos) {
  var roles = {};
  var camp = {};
  (clientesConocidos || []).forEach(function (c) { if (c) camp[c] = true; });
  (lista || []).forEach(function (u) {
    if (u.rol) roles[u.rol] = true;
    usuariosCampanasDe(u).forEach(function (c) { camp[c] = true; });
  });
  return { roles: Object.keys(roles).sort(), campanas: Object.keys(camp).sort() };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { usuariosCampanasDe: usuariosCampanasDe, usuariosFiltrar: usuariosFiltrar, usuariosOpcionesFiltro: usuariosOpcionesFiltro, USUARIOS_SIN_CAMPANA: USUARIOS_SIN_CAMPANA };
}
