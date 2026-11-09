// aviso-pendiente-logic.js — Fase 296 (revisión de Aurora y HLM antes de la
// reunión del 10/11/2026): cuando a una pestaña le faltan datos que todavía no
// se han cargado (CDR/HistChat, tiempos de Wolkvox, meses de tráfico...), la
// cuenta del cliente veía la instrucción interna "Un usuario con permiso de
// administrador debe subir ... desde Cargar Datos". Ahora:
//   - quien puede cargar (admin, Cargar Datos, supervisor con su cliente):
//     el mismo mensaje de siempre, con la instrucción de qué subir;
//   - cualquier otra cuenta (cliente, gerencia...): un aviso neutro de
//     "Información pendiente", sin pasos internos.
// Doble modo (global/Node), sin DOM. Los textos que recibe son fijos del código
// (nunca datos de la base), por eso no se escapan aquí.
'use strict';

// ¿La cuenta en sesión puede cargar datos? Usa las mismas funciones que ya
// deciden el botón "Cargar Datos" (ui-core.js); fuera del navegador, false.
function avisoPendientePuedeCargar() {
  if (typeof canLoadAnyModule === 'function') return !!canLoadAnyModule();
  if (typeof canLoadData === 'function') return !!canLoadData();
  return false;
}

// que: nombre de lo que falta, como lo lee el cliente ("Tráfico de Llamadas").
// mensajeInterno: el texto de siempre para quien carga (con la instrucción).
// puedeCargar: opcional; si no se pasa, se decide con la sesión actual.
function avisoPendienteHtml(que, mensajeInterno, puedeCargar) {
  var carga = (puedeCargar === undefined) ? avisoPendientePuedeCargar() : !!puedeCargar;
  if (carga) return '<div class="gd-vacio" role="status">' + mensajeInterno + '</div>';
  return '<div class="gd-vacio gd-pendiente" role="status"><strong>Información pendiente</strong>' +
    '<span>' + avisoPendienteTextoCliente(que) + '</span></div>';
}

function avisoPendienteTextoCliente(que) {
  return 'Los datos de ' + que + ' todavía no están disponibles. Aparecerán aquí en cuanto se carguen.';
}

// Meses que faltan entre el último mes con datos y el mes pasado (hora
// Colombia). El mes en curso no cuenta: todavía no ha cerrado. Ej.: último
// 2026-08, hoy 2026-11-09 -> ['2026-09', '2026-10'] (el caso real de HLM).
// ultimoMes: 'AAAA-MM'; hoyISO: 'AAAA-MM-DD' (inyectable para las pruebas).
function avisoPendienteMesesFaltantes(ultimoMes, hoyISO) {
  var m = /^(\d{4})-(\d{2})/.exec(String(ultimoMes || ''));
  var h = /^(\d{4})-(\d{2})/.exec(String(hoyISO || ''));
  if (!m || !h) return [];
  var desde = Number(m[1]) * 12 + Number(m[2]) - 1 + 1; // el mes siguiente al último
  var hasta = Number(h[1]) * 12 + Number(h[2]) - 1 - 1; // el mes pasado
  var out = [];
  for (var k = desde; k <= hasta && out.length < 24; k++) {
    out.push(Math.floor(k / 12) + '-' + String(k % 12 + 1).padStart(2, '0'));
  }
  return out;
}

var AVISO_PENDIENTE_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];

// "septiembre y octubre de 2026", "diciembre de 2025 y enero de 2026".
function avisoPendienteMesesTexto(meses) {
  var partes = (meses || []).map(function (x) {
    return { a: x.slice(0, 4), n: AVISO_PENDIENTE_MESES[Number(x.slice(5, 7)) - 1] };
  });
  if (!partes.length) return '';
  var mismoAnio = partes.every(function (p) { return p.a === partes[0].a; });
  var nombres = partes.map(function (p) { return mismoAnio ? p.n : p.n + ' de ' + p.a; });
  var lista = nombres.length === 1 ? nombres[0]
    : nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1];
  return mismoAnio ? lista + ' de ' + partes[0].a : lista;
}

// Línea de aviso sobre un panel que SÍ tiene datos, pero le faltan los meses
// más recientes ('' si no falta ninguno). que: "el tráfico de llamadas".
function avisoPendienteMesesHtml(que, ultimoMes, hoyISO) {
  var faltan = avisoPendienteMesesFaltantes(ultimoMes, hoyISO);
  if (!faltan.length) return '';
  return '<p class="gd-pendiente-linea" role="status"><strong>Información pendiente:</strong> ' + que + ' de ' +
    avisoPendienteMesesTexto(faltan) + ' todavía no se ha cargado.</p>';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { avisoPendienteHtml: avisoPendienteHtml, avisoPendienteTextoCliente: avisoPendienteTextoCliente,
    avisoPendientePuedeCargar: avisoPendientePuedeCargar, avisoPendienteMesesFaltantes: avisoPendienteMesesFaltantes,
    avisoPendienteMesesTexto: avisoPendienteMesesTexto, avisoPendienteMesesHtml: avisoPendienteMesesHtml };
}
