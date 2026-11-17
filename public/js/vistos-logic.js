// vistos-logic.js — Fase 357 (C, pedido de Edwin 17/11): pestaña «Vistos» de Calidad. Lógica pura
// del semáforo, compartida por el servidor (routes/calidad.js) y la interfaz. Reglas aprobadas
// por el usuario:
//  - gris  «Sin monitoreos»: la asesora no tiene ningún monitoreo.
//  - verde «Al día»: 0 monitoreos sin ver.
//  - amarillo «Pendiente»: 1 o 2 sin ver y abrió su Calidad hace menos de 7 días.
//  - rojo «Atrasado»: 3 o más sin ver, o tiene sin ver y no la abre hace 7 días o más, o nunca.
// «Sin ver» cuenta solo los monitoreos desde la Fase 95 (desde cuando se registra si se vieron).
// Los días se cuentan en fechas de calendario de Colombia.
'use strict';

var VISTOS_DIAS_ROJO = 7;
var VISTOS_SIN_VER_ROJO = 3;
var VISTOS_ESTADOS = {
  gris: 'Sin monitoreos',
  verde: 'Al día',
  amarillo: 'Pendiente',
  rojo: 'Atrasado',
};

// 'AAAA-MM-DD' de una fecha en hora de Colombia.
function vistosFechaColombia(d) {
  var x = d instanceof Date ? d : new Date(d);
  if (isNaN(x.getTime())) return null;
  try {
    var p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(x);
    return /^\d{4}-\d{2}-\d{2}$/.test(p) ? p : null;
  } catch (e) {
    return new Date(x.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10); // Colombia: UTC-5 fijo
  }
}

// Días de calendario (Colombia) entre la última apertura y ahora; null si nunca abrió.
function vistosDiasDesde(ultimaIso, ahora) {
  if (!ultimaIso) return null;
  var a = vistosFechaColombia(ultimaIso), b = vistosFechaColombia(ahora || new Date());
  if (!a || !b) return null;
  return Math.max(0, Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000));
}

function vistosSemaforo(total, sinVer, ultimaIso, ahora) {
  total = Number(total) || 0;
  sinVer = Number(sinVer) || 0;
  if (total === 0) return 'gris';
  if (sinVer === 0) return 'verde';
  if (sinVer >= VISTOS_SIN_VER_ROJO) return 'rojo';
  var dias = vistosDiasDesde(ultimaIso, ahora);
  if (dias === null || dias >= VISTOS_DIAS_ROJO) return 'rojo';
  return 'amarillo';
}

// Orden de la tabla: primero lo que pide atención.
var VISTOS_ORDEN = { rojo: 0, amarillo: 1, verde: 2, gris: 3 };
function vistosOrdenar(filas) {
  return (filas || []).slice().sort(function (a, b) {
    var d = (VISTOS_ORDEN[a.semaforo] || 0) - (VISTOS_ORDEN[b.semaforo] || 0);
    if (d) return d;
    if ((b.sinVer || 0) !== (a.sinVer || 0)) return (b.sinVer || 0) - (a.sinVer || 0);
    return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VISTOS_DIAS_ROJO: VISTOS_DIAS_ROJO, VISTOS_SIN_VER_ROJO: VISTOS_SIN_VER_ROJO, VISTOS_ESTADOS: VISTOS_ESTADOS,
    vistosFechaColombia: vistosFechaColombia, vistosDiasDesde: vistosDiasDesde, vistosSemaforo: vistosSemaforo, vistosOrdenar: vistosOrdenar,
  };
}
