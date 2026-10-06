// salida-logic.js — InConexion Platform (Fase 127, ORLANT, pedido textual
// de Edwin: "las llamadas de salida están muy bajas, hay que revisarlo").
// Logica PURA (sin DOM) de parseo de FLUJO_LLAMADAS_Y_WPP_DE_SALIDA_POR_MES.xlsx:
// MES, LINEA 3P, LINEA GENERAL, WHATSAPP 3P, WHATSAPP GENERAL -- un total
// AGREGADO por mes (nunca una fila por llamada/chat), sin año (mismo
// problema que Efectividad de Agendamiento/Citas Atendidas, Fase 111) y
// con el encabezado fuera de la fila 1 del Excel (filas 1-2 vacias, igual
// que esas 2 bases -- aoa[0] sigue siendo SIEMPRE la fila de encabezados,
// SheetJS arma el array a partir del rango USADO de la hoja).
//
// A diferencia de Efectividad de Agendamiento/Citas Atendidas (que
// resuelven el año EN SILENCIO), Edwin pidio explicitamente poder
// confirmar/corregir el año antes de guardar (cargas.js,
// _cargasGuardarSalida, llama a salidaParseFilas de nuevo con un año
// explicito si el usuario corrige).
//
// Doble modo: global en el navegador, require() en Node para las pruebas.
'use strict';

var _salidaMesNombre = (typeof require === 'function') ? require('./mes-nombre-logic.js') : (typeof window !== 'undefined' ? window : this);

var SALIDA_COLUMNAS = [
  { key: 'mes', label: 'MES', obligatoria: true },
  { key: 'llamadas3p', label: 'LINEA 3P', obligatoria: true },
  { key: 'llamadasGeneral', label: 'LINEA GENERAL', obligatoria: true },
  { key: 'wpp3p', label: 'WHATSAPP 3P', obligatoria: true },
  { key: 'wppGeneral', label: 'WHATSAPP GENERAL', obligatoria: true },
];
// Orden fijo del payload compacto (arrays) -- debe coincidir EXACTO con
// server/salida.js (CAMPOS_FILA) y validation.js (salidaFilaArraySchema).
var SALIDA_ORDEN_ARRAY = ['mes', 'llamadas3p', 'llamadasGeneral', 'wpp3p', 'wppGeneral'];

function _salidaNorm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

function salidaColIndexMap(headerRow) {
  var map = {};
  (headerRow || []).forEach(function (h, i) {
    var n = _salidaNorm(h);
    var col = SALIDA_COLUMNAS.filter(function (c) { return _salidaNorm(c.label) === n; })[0];
    if (col && map[col.key] === undefined) map[col.key] = i;
  });
  return map;
}

function _salidaNumeroEntero(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (Math.round(n) !== n) return null;
  if (n < 0) return null;
  return n;
}

// aoa = array-of-arrays ya resuelto por SheetJS (aoa[0] = encabezados).
// `anioForzado` (opcional, Fase 127): si el usuario corrigio el año en el
// modal de impacto, se usa ESE año para TODOS los meses del archivo en
// vez del inferido automaticamente (mesNombreAAAAMM, mes-nombre-logic.js)
// -- nunca una mezcla silenciosa de años distintos por fila.
// Devuelve { error } si falta una columna obligatoria, o { filas, avisos }
// -- cada fila trae ademas `mesTexto` (el valor crudo "AGOSTO") para que
// el modal de impacto pueda mostrar "AGOSTO → Agosto 2026".
function salidaParseFilas(aoa, ahora, anioForzado) {
  var header = (aoa && aoa[0]) || [];
  var map = salidaColIndexMap(header);
  var faltantes = SALIDA_COLUMNAS.filter(function (c) { return c.obligatoria && map[c.key] === undefined; });
  if (faltantes.length) {
    return { error: 'Faltan columnas obligatorias: ' + faltantes.map(function (c) { return c.label; }).join(', ') };
  }

  var filas = [];
  var avisos = [];
  var mesesVistos = {};
  for (var r = 1; r < (aoa || []).length; r++) {
    var row = aoa[r];
    if (!row || row.every(function (c) { return c === null || c === undefined || c === ''; })) continue;

    var mesTexto = row[map.mes];
    var mes = _salidaMesNombre.mesNombreAAAAMM(mesTexto, anioForzado, ahora);
    if (!mes) { avisos.push('Fila ' + (r + 1) + ': MES "' + mesTexto + '" no reconocido, se omite.'); continue; }
    if (mesesVistos[mes]) { avisos.push('Fila ' + (r + 1) + ': el mes ' + mes + ' ya aparecio antes en este archivo (mes duplicado), se omite esta fila repetida.'); continue; }

    var llamadas3p = _salidaNumeroEntero(row[map.llamadas3p]);
    var llamadasGeneral = _salidaNumeroEntero(row[map.llamadasGeneral]);
    var wpp3p = _salidaNumeroEntero(row[map.wpp3p]);
    var wppGeneral = _salidaNumeroEntero(row[map.wppGeneral]);
    if (llamadas3p === null || llamadasGeneral === null || wpp3p === null || wppGeneral === null) {
      avisos.push('Fila ' + (r + 1) + ' (' + mes + '): LINEA 3P/LINEA GENERAL/WHATSAPP 3P/WHATSAPP GENERAL invalido (debe ser un numero entero >= 0), se omite.');
      continue;
    }

    mesesVistos[mes] = true;
    filas.push({ mes: mes, mesTexto: String(mesTexto == null ? '' : mesTexto).trim(), llamadas3p: llamadas3p, llamadasGeneral: llamadasGeneral, wpp3p: wpp3p, wppGeneral: wppGeneral });
  }
  return { filas: filas, avisos: avisos };
}

function salidaFilaComoArray(f) {
  return SALIDA_ORDEN_ARRAY.map(function (k) { return f[k]; });
}

function salidaMesesDelArchivo(filas) {
  var set = {};
  (filas || []).forEach(function (f) { set[f.mes] = true; });
  return Object.keys(set).sort();
}

// 'AAAA-MM' -> "Agosto 2026" (mismo criterio que citasAtendidasMesLbl/
// efectividadAgendamientoMesLbl).
function salidaMesLbl(mes) {
  return _salidaMesNombre.mesNombreLargo(mes);
}

// Texto "AGOSTO → Agosto 2026" por fila, para el modal de confirmacion de
// año (Fase 127, pedido explicito de Edwin: nunca adivinar el año en
// silencio).
function salidaTextoConfirmacionAnio(filas) {
  return (filas || []).map(function (f) {
    return (f.mesTexto || f.mes) + ' → ' + salidaMesLbl(f.mes);
  }).join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SALIDA_COLUMNAS: SALIDA_COLUMNAS,
    SALIDA_ORDEN_ARRAY: SALIDA_ORDEN_ARRAY,
    salidaColIndexMap: salidaColIndexMap,
    salidaParseFilas: salidaParseFilas,
    salidaFilaComoArray: salidaFilaComoArray,
    salidaMesesDelArchivo: salidaMesesDelArchivo,
    salidaMesLbl: salidaMesLbl,
    salidaTextoConfirmacionAnio: salidaTextoConfirmacionAnio,
  };
}
