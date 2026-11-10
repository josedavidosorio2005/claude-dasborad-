// graficas-lineas-logic.js — Fase 297 (pedido del supervisor, 09/11/2026, para
// Clínica Aurora y, como tiene las mismas pestañas, Hospital La María):
//   - "Total tráfico": gráfica de LÍNEAS por mes con 3 series de ingreso
//     (Total = llamadas ingresadas + WhatsApp ingresados, Llamadas ingresadas,
//     WhatsApp ingresados). Sin "contestados" ni la salida en la gráfica.
//   - "Llamadas y WhatsApp de salida": una gráfica de línea por canal, con el
//     valor en cada punto y la variación frente al mes anterior.
// Solo cambia la PRESENTACIÓN: los números salen tal cual de
// /calidad/total-trafico/mensual (llamadasEntrada, whatsappEntrada) y de
// /calidad/salida/mensual (salidaValorLinea).
// Fase 300 (10/11): ORLANT usa la MISMA grafica de Total tráfico (solo esa; su
// salida sigue en barras) y su pestaña pasa a ir tercera. Mobilize y SURA igual.
// Doble modo (global/Node), sin DOM.
'use strict';

// Salida en lineas (con variacion mes a mes): Aurora y HLM.
var GRAFICAS_LINEAS_CLIENTES = ['CLINICA AURORA', 'HOSPITAL LA MARIA'];
// Total trafico en 3 lineas de ingreso: Aurora, HLM y, desde la Fase 300, ORLANT.
var TOTAL_TRAFICO_LINEAS_CLIENTES = ['CLINICA AURORA', 'HOSPITAL LA MARIA', 'ORLANT'];

function _glNorm(c) { return String(c || '').trim().toUpperCase(); }
function graficasLineasAplica(campana) {
  return GRAFICAS_LINEAS_CLIENTES.indexOf(_glNorm(campana)) !== -1;
}
function totalTraficoLineasAplica(campana) {
  return TOTAL_TRAFICO_LINEAS_CLIENTES.indexOf(_glNorm(campana)) !== -1;
}

// Las 3 series de ingreso por mes (mismo orden que `filas`).
function totalTraficoSeriesIngreso(filas) {
  var llam = [], wpp = [], total = [];
  (filas || []).forEach(function (f) {
    var l = Number(f && f.llamadasEntrada) || 0;
    var w = Number(f && f.whatsappEntrada) || 0;
    llam.push(l); wpp.push(w); total.push(l + w);
  });
  return { total: total, llamadas: llam, whatsapp: wpp };
}

// ¿b es el mes siguiente de a? ('AAAA-MM')
function _glMesSiguiente(a, b) {
  var x = /^(\d{4})-(\d{2})/.exec(String(a || '')), y = /^(\d{4})-(\d{2})/.exec(String(b || ''));
  if (!x || !y) return false;
  return (Number(y[1]) * 12 + Number(y[2])) - (Number(x[1]) * 12 + Number(x[2])) === 1;
}

// Variación % de cada mes contra el mes INMEDIATAMENTE anterior (null en el
// primero, si falta el mes anterior en la lista o si el anterior es 0 / sin dato).
function variacionMesAMes(valores, meses) {
  return (valores || []).map(function (v, k) {
    if (k === 0) return null;
    var ant = valores[k - 1];
    if (meses && !_glMesSiguiente(meses[k - 1], meses[k])) return null;
    if (v === null || v === undefined || ant === null || ant === undefined || !(Number(ant) > 0)) return null;
    return (Number(v) - Number(ant)) / Number(ant) * 100;
  });
}

// "+8 %", "−3 %" (signo menos tipográfico), "0 %"; '' sin dato. Redondeo a
// entero, como pidió el supervisor ("+8%"), formato es-CO con espacio.
function variacionTexto(p) {
  if (p === null || p === undefined || !isFinite(p)) return '';
  var r = Math.round(p);
  if (r === 0) return '0 %';
  return (r > 0 ? '+' : '−') + Math.abs(r).toLocaleString('es-CO') + ' %';
}

// 'sube' | 'baja' | 'igual' | null -- para el color (verde/rojo) y el ▲/▼.
function variacionSentido(p) {
  if (p === null || p === undefined || !isFinite(p)) return null;
  var r = Math.round(p);
  return r > 0 ? 'sube' : (r < 0 ? 'baja' : 'igual');
}

// Colores pedidos: Total azul, Llamadas naranja, WhatsApp verde (excepción
// documentada en docs/sistema-de-diseno.md: no son semáforo aquí, son series
// con nombre en la leyenda). Todos >= 3:1 contra el fondo de la tarjeta en
// los 2 temas (server/tests/fase297-graficas-lineas.test.js).
function graficasLineasColores(oscuro) {
  return oscuro
    ? { total: '#60a5fa', llamadas: '#fbbf24', whatsapp: '#4ade80', sube: '#4ade80', baja: '#f87171', igual: '#8fb4bf' }
    : { total: '#1d5fa8', llamadas: '#b45309', whatsapp: '#15803d', sube: '#15803d', baja: '#c0392b', igual: '#4f6f7d' };
}

// Orden de las pestañas de Aurora y HLM (Fase 300, corrige la 297: Total tráfico
// va TERCERA): Tráfico de Llamadas, Tráfico de WhatsApp, Total tráfico, Llamadas
// y WhatsApp de salida, Agendas por usuaria, Errores, Tipificación. Se aplica al
// MOSTRAR (dashboard-generic.js, _gdTabsVisibles): dashboards_config no cambia, así
// una pestaña que se agregue después por migración no deshace este orden. Las que
// no están en la lista quedan al final, en el orden que ya tenían. Otro cliente: igual.
// Fase 305: «Errores» siempre de ultima (despues de Tipificación).
// Fase 306: + Inasistencia y Encuestas (Aurora), antes de Errores.
var PESTANAS_ORDEN_AURORA_HLM = ['trafico', 'trafico_whatsapp', 'total_trafico', 'salida', 'agendas_usuaria', 'tipificacion', 'inasistencia_au', 'encuestas_au', 'errores'];

// ORLANT (Fase 300): solo se mueve Total tráfico justo despues de Tráfico de
// WhatsApp (o de Tráfico de Llamadas si no esta); todas las demas, igual.
function _glMoverTotalTrafico(lista) {
  var i = -1;
  for (var k = 0; k < lista.length; k++) if (lista[k] && lista[k].key === 'total_trafico') i = k;
  if (i === -1) return lista;
  var tt = lista.splice(i, 1)[0];
  var ancla = -1;
  ['trafico_whatsapp', 'trafico'].some(function (key) {
    for (var j = 0; j < lista.length; j++) if (lista[j] && lista[j].key === key) { ancla = j; return true; }
    return false;
  });
  lista.splice(ancla + 1, 0, tt);
  return lista;
}

function pestanasOrdenCliente(tabs, cliente) {
  var lista = (tabs || []).slice();
  if (_glNorm(cliente) === 'ORLANT') return _glMoverTotalTrafico(lista);
  if (!graficasLineasAplica(cliente)) return lista;
  var pos = function (t) {
    if (t && t.key === 'lineas_internas') return PESTANAS_ORDEN_AURORA_HLM.length + 2; // Fase 311: «Gestión líneas internas» despues de Errores
    if (t && t.key === 'errores') return PESTANAS_ORDEN_AURORA_HLM.length + 1; // Fase 306: Errores SIEMPRE de ultima
    var k = PESTANAS_ORDEN_AURORA_HLM.indexOf(t && t.key); return k === -1 ? PESTANAS_ORDEN_AURORA_HLM.length : k;
  };
  return lista.map(function (t, i) { return { t: t, i: i }; })
    .sort(function (a, b) { return (pos(a.t) - pos(b.t)) || (a.i - b.i); })
    .map(function (x) { return x.t; });
}

// Fase 305: clientes cuyo tablero lleva los botones (sub-pestañas y vistas)
// resaltados como Aurora › Agendas (claro negro/blanco, oscuro blanco/negro,
// activo azul con ✓). Solo MOBILIZE; ORLANT se ve igual que siempre.
var GD_CLIENTES_BOTONES_RESALTADOS = ['MOBILIZE'];
function gdBotonesResaltados(cliente) {
  return GD_CLIENTES_BOTONES_RESALTADOS.indexOf(_glNorm(cliente)) !== -1;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PESTANAS_ORDEN_AURORA_HLM: PESTANAS_ORDEN_AURORA_HLM, GD_CLIENTES_BOTONES_RESALTADOS: GD_CLIENTES_BOTONES_RESALTADOS, gdBotonesResaltados: gdBotonesResaltados, pestanasOrdenCliente: pestanasOrdenCliente, GRAFICAS_LINEAS_CLIENTES: GRAFICAS_LINEAS_CLIENTES, graficasLineasAplica: graficasLineasAplica,
    TOTAL_TRAFICO_LINEAS_CLIENTES: TOTAL_TRAFICO_LINEAS_CLIENTES, totalTraficoLineasAplica: totalTraficoLineasAplica,
    totalTraficoSeriesIngreso: totalTraficoSeriesIngreso, variacionMesAMes: variacionMesAMes,
    variacionTexto: variacionTexto, variacionSentido: variacionSentido, graficasLineasColores: graficasLineasColores };
}
