// sedes-logic.js — Fase 354 (reunion con Edwin del 13/11): clientes divididos en sedes.
// Hoy solo Hospital La Maria: «Sede Castilla» y «Sede 33», dos operaciones con su propio
// personal e indicadores. Cada sede es una campaña HIJA en el registro de clientes
// (parametros.sedeDe = el padre); el padre lista sus sedes en parametros.sedes.
//
// Permisos: quien tiene acceso al padre ve TODAS sus sedes mientras no tenga ninguna sede
// marcada; en cuanto se le marca una (en Usuarios, como cualquier cliente), ve solo las
// marcadas. Misma regla que las plantillas de Calidad (Fase 237): nadie pierde nada al
// desplegar. La usan el servidor (getActor y el inicio de sesion) y el navegador.
//
// Doble modo: global en el navegador y require() en Node. Sin DOM.
'use strict';

var SEDES_PREFIJOS = ['cliente_', 'campana_'];

function _sedesParam(c, p) { return (c && c.parametros) ? c.parametros[p] : undefined; }

// Sedes de un cliente: [{campana, etiqueta, codigo}] (vacio si no tiene).
function sedesDe(registro, cliente) {
  var c = (registro || []).find(function (x) { return x && x.nombre === cliente; });
  var s = _sedesParam(c, 'sedes');
  return Array.isArray(s) ? s.filter(function (x) { return x && typeof x === 'object' && typeof x.campana === 'string'; }) : [];
}

// El padre de una sede (o null si el cliente no es una sede).
function padreDeSede(registro, cliente) {
  var c = (registro || []).find(function (x) { return x && x.nombre === cliente; });
  var p = _sedesParam(c, 'sedeDe');
  return typeof p === 'string' && p ? p : null;
}

// Nombre corto de la sede para el encabezado ("Sede Castilla"); null si no es una sede.
function sedeEtiqueta(registro, cliente) {
  var padre = padreDeSede(registro, cliente);
  if (!padre) return null;
  var s = sedesDe(registro, padre).find(function (x) { return x.campana === cliente; });
  if (s && s.etiqueta) return s.etiqueta;
  var c = (registro || []).find(function (x) { return x && x.nombre === cliente; });
  return _sedesParam(c, 'sedeEtiqueta') || cliente;
}

// ¿Tiene marcada alguna sede de este padre? (cliente_ o campana_ en true)
function _tieneSedeMarcada(perms, sedes) {
  return sedes.some(function (s) {
    return SEDES_PREFIJOS.some(function (pre) { return perms[pre + s.campana] === true; });
  });
}

// Permisos con las sedes heredadas: por cada padre con sedes al que el usuario tiene
// cliente_/campana_, si no tiene ninguna sede marcada, recibe esa misma llave en todas.
function permisosConSedes(perms, registro) {
  var p = perms || {};
  var out = null;
  (registro || []).forEach(function (c) {
    var sedes = sedesDe(registro, c.nombre);
    if (!sedes.length || _tieneSedeMarcada(p, sedes)) return;
    SEDES_PREFIJOS.forEach(function (pre) {
      if (p[pre + c.nombre] !== true) return;
      sedes.forEach(function (s) {
        if (!out) out = Object.assign({}, p);
        out[pre + s.campana] = true;
      });
    });
  });
  return out || p;
}

// Sedes que esta persona puede abrir (con los permisos ya efectivos, ver permisosConSedes).
function sedesVisibles(registro, padre, perms, esAdmin) {
  return sedesDe(registro, padre).filter(function (s) {
    return !!esAdmin || !!(perms && (perms['cliente_' + s.campana] === true));
  });
}

// Lista de tarjetas de clientes (Dashboard Clientes / Portal Supervisor): sin las sedes
// sueltas, y el padre aparece si la persona ve al menos una de sus sedes.
function clientesParaTarjetas(lista, registro, perms, esAdmin) {
  return (lista || []).filter(function (c) {
    if (padreDeSede(registro, c)) return false;
    if (esAdmin) return true;
    if (perms && perms['cliente_' + c] === true) return true;
    return sedesVisibles(registro, c, perms, false).length > 0;
  });
}

// Fase 354b (arreglo temporal): «Datos anteriores» del padre (lo cargado antes de separar
// las sedes), en solo lectura, mientras las sedes esten vacias. Opcion del registro:
// parametros.datosAnteriores = { visible, etiqueta }. null si esta apagada o no existe.
function datosAnterioresDe(registro, padre) {
  var c = (registro || []).find(function (x) { return x && x.nombre === padre; });
  var d = _sedesParam(c, 'datosAnteriores');
  if (!d || typeof d !== 'object' || d.visible !== true) return null;
  return { etiqueta: (typeof d.etiqueta === 'string' && d.etiqueta) || 'Datos anteriores (sin separar por sede)' };
}

// ¿Puede esta persona (no administrador) abrir los «Datos anteriores» del padre? Opcion
// prendida y acceso al padre (cliente_/campana_): la misma regla que el servidor.
function puedeVerDatosAnteriores(registro, padre, perms) {
  if (!datosAnterioresDe(registro, padre)) return false;
  return !!(perms && (perms['cliente_' + padre] === true || perms['campana_' + padre] === true));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sedesDe: sedesDe, padreDeSede: padreDeSede, sedeEtiqueta: sedeEtiqueta,
    permisosConSedes: permisosConSedes, sedesVisibles: sedesVisibles, clientesParaTarjetas: clientesParaTarjetas,
    datosAnterioresDe: datosAnterioresDe, puedeVerDatosAnteriores: puedeVerDatosAnteriores, // Fase 354b
  };
}
