// calidad-dashboard-logic.js — InConexion Platform.
//
// Logica PURA (sin DOM) del filtro nuevo de la pestaña "Calidad" del
// dashboard generico (paneles calidad_kpis/calidad_pie, dashboard-generic.js):
// hasta el 2026-09-16 esos paneles solo filtraban por el mes elegido en el
// selector superior del dashboard (igualdad exacta contra `m.mes`) — sin
// filtro de asesor ni rango de fechas. Extiende de forma consistente el
// mismo patron combinable de Trafico de Llamadas (trafico-logic.js:
// traficoFiltrarFilas) a los monitoreos de Calidad, que ya traen `asesor` y
// `fecha` reales (ver CAL_DB en public/js/calidad.js).
//
// Doble modo como trafico-logic.js: global en el navegador, require() en
// Node para las pruebas (server/tests/calidad-dashboard-logic.test.js).
'use strict';

function calDashFiltrarMonitoreos(monitoreos, opts) {
  opts = opts || {};
  var asesores = opts.asesores && opts.asesores.length ? opts.asesores : null;
  var set = null;
  if (asesores) {
    set = {};
    asesores.forEach(function (a) { set[a] = true; });
  }
  return (monitoreos || []).filter(function (m) {
    if (set && !set[m.asesor]) return false;
    if (opts.desde && m.fecha && m.fecha < opts.desde) return false;
    if (opts.hasta && m.fecha && m.fecha > opts.hasta) return false;
    return true;
  });
}

// Mismo criterio de clasificacion que ya usaba _gdRenderCalidad (90/70):
// se extrae aqui, sin cambiar los cortes, solo para que quede testeable.
function calDashResumen(monitoreos) {
  var arr = monitoreos || [];
  var total = arr.length;
  var promedio = total ? Math.round((arr.reduce(function (a, m) { return a + m.puntaje; }, 0) / total) * 10) / 10 : 0;
  var sobresaliente = arr.filter(function (m) { return m.puntaje >= 90; }).length;
  var noCritico = arr.filter(function (m) { return m.puntaje >= 70 && m.puntaje < 90; }).length;
  var critico = arr.filter(function (m) { return m.puntaje < 70; }).length;
  var clasificacion = total === 0 ? '—' : (promedio < 70 ? '🔴 CRITICO' : promedio < 90 ? '🟡 NO CRITICO' : '🟢 SOBRESALIENTE');
  return { total: total, promedio: promedio, sobresaliente: sobresaliente, noCritico: noCritico, critico: critico, clasificacion: clasificacion };
}

// Lista de asesores distintos (para poblar el multi-select), orden alfabetico.
function calDashAsesoresDistintos(monitoreos) {
  var vistos = {};
  (monitoreos || []).forEach(function (m) { if (m.asesor) vistos[m.asesor] = true; });
  return Object.keys(vistos).sort();
}

// Doble modo: global en el navegador, require() en Node para las pruebas.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calDashFiltrarMonitoreos: calDashFiltrarMonitoreos,
    calDashResumen: calDashResumen,
    calDashAsesoresDistintos: calDashAsesoresDistintos,
  };
}
