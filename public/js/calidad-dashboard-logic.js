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

// Fase 361: la misma clave de nombre que el servidor (calidad-nombre-clave.js): la misma persona
// con un espacio doble o especial ya no sale en dos filas; se muestra el primer nombre visto.
var _cdClave = (typeof calClaveNombre === 'function') ? calClaveNombre : require('./calidad-nombre-clave.js').calClaveNombre;
function _cdAgrupar(arr) {
  var nombre = {}, sumas = {}, cuentas = {}, orden = [];
  arr.forEach(function (m) {
    var k = _cdClave(m.asesor);
    if (!k) return;
    if (!(k in sumas)) { nombre[k] = String(m.asesor).trim(); sumas[k] = 0; cuentas[k] = 0; orden.push(k); }
    sumas[k] += m.puntaje; cuentas[k]++;
  });
  return { orden: orden, nombre: nombre, sumas: sumas, cuentas: cuentas };
}

function calDashFiltrarMonitoreos(monitoreos, opts) {
  opts = opts || {};
  var asesores = opts.asesores && opts.asesores.length ? opts.asesores : null;
  var set = null;
  if (asesores) {
    set = {};
    asesores.forEach(function (a) { set[_cdClave(a)] = true; });
  }
  return (monitoreos || []).filter(function (m) {
    if (set && !set[_cdClave(m.asesor)]) return false;
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
  var g = _cdAgrupar((monitoreos || []).map(function (m) { return { asesor: m.asesor, puntaje: 0 }; }));
  return g.orden.map(function (k) { return g.nombre[k]; }).sort();
}

// Fase 130 (pedido de Edwin, vista de Calidad): promedio de puntaje POR
// asesor, para la barra horizontal "nombre + %" -- deliberadamente NUNCA
// incluye el numero de monitoreos (ni como campo, ni en ningun calculo
// visible), para que no haya forma de que se cuele en un tooltip/eje mas
// adelante. Recibe los monitoreos YA FILTRADOS por mes/fecha/asesor (mismo
// `arr` que ya usan calidad_kpis/calidad_pie, _gdRenderCalidad) -- el
// promedio nunca mezcla meses porque nunca ve datos fuera de ese filtro.
// Orden: de mayor a menor promedio (pedido explicito, "ordenadas").
function calDashPromedioPorAsesor(monitoreos) {
  var g = _cdAgrupar(monitoreos || []);
  return g.orden
    .map(function (k) {
      return { asesor: g.nombre[k], promedio: Math.round((g.sumas[k] / g.cuentas[k]) * 10) / 10 };
    })
    .sort(function (a, b) { return b.promedio - a.promedio; });
}

// Fase 213 (pedido de Edwin, Calidad ORLANT): promedio del EQUIPO = el de
// todos los monitoreos (no el promedio de los promedios por asesor, decision
// del usuario) y, por asesor, si queda por encima (>=) o por debajo. La
// comparacion se hace con los valores sin redondear; se muestran con 1
// decimal (asesor, igual que calDashPromedioPorAsesor) y 2 (equipo).
function calDashPuntajeVsEquipo(monitoreos) {
  var arr = (monitoreos || []).filter(function (m) { return m.asesor && typeof m.puntaje === 'number'; });
  if (!arr.length) return { equipo: null, filas: [], encima: 0, debajo: 0 };
  var equipo = arr.reduce(function (a, m) { return a + m.puntaje; }, 0) / arr.length;
  var g = _cdAgrupar(arr);
  var filas = g.orden.map(function (k) {
    var exacto = g.sumas[k] / g.cuentas[k];
    return { asesor: g.nombre[k], promedio: Math.round(exacto * 10) / 10, encima: exacto >= equipo, _exacto: exacto };
  }).sort(function (x, y) { return y._exacto - x._exacto; })
    .map(function (f) { return { asesor: f.asesor, promedio: f.promedio, encima: f.encima }; });
  return {
    equipo: Math.round(equipo * 100) / 100,
    filas: filas,
    encima: filas.filter(function (f) { return f.encima; }).length,
    debajo: filas.filter(function (f) { return !f.encima; }).length,
  };
}

// Doble modo: global en el navegador, require() en Node para las pruebas.
// Fase 145 (Calidad sin monitoreos): texto del aviso cuando una campaña
// todavia no tiene NINGUN monitoreo de calidad (ni en el mes elegido ni en
// ningun otro). Antes salia "Sin datos de Calidad para <mes>", que hacia
// pensar que solo faltaba ese mes. El nombre va como se escribe en la
// interfaz ("MOBILIZE" -> "Mobilize").
function calDashTextoSinMonitoreos(campana) {
  var nombre = String(campana || '').trim().toLowerCase().replace(/(^|[\s-])(\S)/g, function (m, sep, letra) { return sep + letra.toUpperCase(); });
  return 'Todavía no hay monitoreos de calidad' + (nombre ? ' para ' + nombre : '') + '.';
}

// Fase 208 (Mobilize): si la misma pestaña trae el resumen de calidad
// cargado (calidad_resumen_panel de esa campaña, con al menos un mes), los
// paneles de monitoreos vacios no dicen "Todavía no hay monitoreos": la
// calidad ya esta a la vista en el resumen. Sin resumen, el aviso sigue.
function calDashResumenCubreSinMonitoreos(panelesTab, campana, mesesResumen) {
  if (!mesesResumen || !mesesResumen.length) return false;
  return (panelesTab || []).some(function (p) {
    return !!p && p.tipo === 'calidad_resumen_panel' && (p.campana || campana) === campana;
  });
}

// Fase 164 (D-03): alto (px) de la grafica "Promedio de calidad por asesor"
// para que entren TODOS los nombres del eje: ~28px por barra mas el margen
// del eje, nunca menos que los 230px de siempre.
function calDashAltoBarrasAsesores(n) {
  return Math.max(230, 28 * (Number(n) || 0) + 60);
}

// Fase 164 (lote 2): los textos de estado de Calidad ("🔴 CRITICO",
// "⚠️ ALERTA", "📞 Llamada"...) los calcula el SERVIDOR, se guardan asi en
// la base y salen asi en las exportaciones -- no se tocan. Solo EN PANTALLA
// el emoji del principio se cambia por un icono Lucide del sprite del repo
// (decorativo, aria-hidden: el estado lo dice la palabra que sigue). `tono`
// pinta el icono con el color de su estado (critico/medio/ok); con
// opts.sinColor el icono no trae color propio: lo toma de donde esta (en la
// tarjeta del tablero, del color de la meta qa_promedio, ver styles.css).
var CAL_ESTADO_ICONOS = [
  { emoji: '🔴', icono: 'punto', tono: 'critico' },
  { emoji: '🟡', icono: 'punto', tono: 'medio' },
  { emoji: '🟢', icono: 'punto', tono: 'ok' },
  { emoji: '✅', icono: 'circle-check', tono: 'ok' },
  { emoji: '⚠️', icono: 'triangle-alert', tono: 'medio' },
  { emoji: '⚠', icono: 'triangle-alert', tono: 'medio' },
  { emoji: '🚨', icono: 'octagon-alert', tono: 'critico' },
  { emoji: '❌', icono: 'circle-x', tono: 'critico' },
  { emoji: '⛔', icono: 'ban', tono: null },
  { emoji: '💬', icono: 'message-circle', tono: null },
  { emoji: '📞', icono: 'phone', tono: null },
];
function calIconoHtml(icono, clase) {
  return '<svg class="icono' + (clase ? ' ' + clase : '') +
    '" aria-hidden="true" focusable="false"><use href="img/iconos/lucide.svg#i-' + icono + '"></use></svg>';
}
function calEstadoHtml(texto, opts) {
  var t = String(texto == null ? '' : texto);
  var escHtml = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  for (var k = 0; k < CAL_ESTADO_ICONOS.length; k++) {
    var m = CAL_ESTADO_ICONOS[k];
    if (t.indexOf(m.emoji) === 0) {
      var resto = t.slice(m.emoji.length).replace(/^\s+/, '');
      var tono = m.tono && !(opts && opts.sinColor) ? ' estado-' + m.tono : '';
      return '<span class="estado-con-icono' + tono + '">' + calIconoHtml(m.icono) + escHtml(resto) + '</span>';
    }
  }
  return escHtml(t);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calDashPuntajeVsEquipo: calDashPuntajeVsEquipo,
    calEstadoHtml: calEstadoHtml,
    calIconoHtml: calIconoHtml,
    calDashAltoBarrasAsesores: calDashAltoBarrasAsesores,
    calDashFiltrarMonitoreos: calDashFiltrarMonitoreos,
    calDashResumen: calDashResumen,
    calDashAsesoresDistintos: calDashAsesoresDistintos,
    calDashPromedioPorAsesor: calDashPromedioPorAsesor,
    calDashTextoSinMonitoreos: calDashTextoSinMonitoreos,
    calDashResumenCubreSinMonitoreos: calDashResumenCubreSinMonitoreos,
  };
}
