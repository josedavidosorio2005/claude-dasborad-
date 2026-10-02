// citas-atendidas-logic.js — InConexion Platform (Fase 111, ORLANT, pedido
// textual de InCo). Logica PURA (sin DOM) de parseo de la hoja
// CITAS_ATENDIDAS.xlsx (total del mes): MES, AGENDAS, ATENDIDAS,
// EFECTIVIDAD CITAS ATENDIDAS (=ATENDIDAS/AGENDAS, viene en el archivo
// pero NUNCA se guarda -- se recalcula siempre, mismo criterio que
// efectividad-agendamiento-logic.js). Doble modo: global en el navegador,
// require() en Node para las pruebas.
//
// Mismo comentario que efectividad-agendamiento-logic.js sobre encabezados
// que no estan en la fila 1 del Excel: aoa[0] es SIEMPRE la fila de
// encabezados (SheetJS arma el array a partir del rango USADO de la hoja).
'use strict';

var _caMesNombre = (typeof require === 'function') ? require('./mes-nombre-logic.js') : (typeof window !== 'undefined' ? window : this);

var CITAS_ATENDIDAS_COLUMNAS = [
  { key: 'mes', label: 'MES', obligatoria: true },
  { key: 'agendas', label: 'AGENDAS', obligatoria: true },
  { key: 'atendidas', label: 'ATENDIDAS', obligatoria: true },
  { key: 'efectividadArchivo', label: 'EFECTIVIDAD CITAS ATENDIDAS', obligatoria: false, ocultaEnPlantilla: true },
];
// Orden fijo del payload compacto (arrays) -- debe coincidir EXACTO con
// server/efectividad-citas.js (CAMPOS_FILA) y validation.js
// (efectividadCitasFilaArraySchema).
var CITAS_ATENDIDAS_ORDEN_ARRAY = ['mes', 'agendas', 'atendidas'];

function _caNorm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

function citasAtendidasColIndexMap(headerRow) {
  var map = {};
  (headerRow || []).forEach(function (h, i) {
    var n = _caNorm(h);
    var col = CITAS_ATENDIDAS_COLUMNAS.filter(function (c) { return _caNorm(c.label) === n; })[0];
    if (col && map[col.key] === undefined) map[col.key] = i;
  });
  return map;
}

function _caNumeroEntero(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (Math.round(n) !== n) return null;
  if (n < 0) return null;
  return n;
}

// "93,67 %" / "93.67%" / 93.67 / 0.9367 (fraccion de formato % de Excel) ->
// 93.67 -- mismo criterio que _eaPctDesdeCelda/_inasistenciaPctDesdeCelda.
function _caPctDesdeCelda(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Math.round((v <= 1 ? v * 100 : v) * 100) / 100;
  var s = String(v).trim().replace('%', '').replace(',', '.').trim();
  if (s === '') return null;
  var n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

// aoa = array-of-arrays ya resuelto por SheetJS (aoa[0] = encabezados).
// Devuelve { error } si falta una columna obligatoria, o { filas, avisos,
// advertenciasEfectividad }.
function citasAtendidasParseFilas(aoa, ahora) {
  var header = (aoa && aoa[0]) || [];
  var map = citasAtendidasColIndexMap(header);
  var faltantes = CITAS_ATENDIDAS_COLUMNAS.filter(function (c) { return c.obligatoria && map[c.key] === undefined; });
  if (faltantes.length) {
    return { error: 'Faltan columnas obligatorias: ' + faltantes.map(function (c) { return c.label; }).join(', ') };
  }

  var filas = [];
  var avisos = [];
  var advertenciasEfectividad = [];
  for (var r = 1; r < (aoa || []).length; r++) {
    var row = aoa[r];
    if (!row || row.every(function (c) { return c === null || c === undefined || c === ''; })) continue;

    var mes = _caMesNombre.mesNombreAAAAMM(row[map.mes], null, ahora);
    if (!mes) { avisos.push('Fila ' + (r + 1) + ': MES "' + row[map.mes] + '" no reconocido, se omite.'); continue; }

    var agendas = _caNumeroEntero(row[map.agendas]);
    var atendidas = _caNumeroEntero(row[map.atendidas]);
    if (agendas === null || atendidas === null) {
      avisos.push('Fila ' + (r + 1) + ' (' + mes + '): AGENDAS/ATENDIDAS invalido, se omite.');
      continue;
    }

    var efRecalcPct = agendas > 0 ? Math.round((atendidas / agendas) * 10000) / 100 : 0;
    if (map.efectividadArchivo !== undefined) {
      var delArchivo = _caPctDesdeCelda(row[map.efectividadArchivo]);
      if (delArchivo !== null && delArchivo !== efRecalcPct) {
        advertenciasEfectividad.push(
          'Fila ' + (r + 1) + ' (' + mes + '): EFECTIVIDAD CITAS ATENDIDAS del archivo (' + delArchivo +
          '%) no coincide con el recalculo (' + efRecalcPct + '%) -- se usa el recalculo.'
        );
      }
    }

    filas.push({ mes: mes, agendas: agendas, atendidas: atendidas });
  }
  return { filas: filas, avisos: avisos, advertenciasEfectividad: advertenciasEfectividad };
}

function citasAtendidasFilaComoArray(f) {
  return CITAS_ATENDIDAS_ORDEN_ARRAY.map(function (k) { return f[k]; });
}

function citasAtendidasMesesDelArchivo(filas) {
  var set = {};
  (filas || []).forEach(function (f) { set[f.mes] = true; });
  return Object.keys(set).sort();
}

// 'AAAA-MM' -> "Ago-26" -- mismo formato corto que inasistenciaMesLbl/
// _agendasMesLbl/_gdMesLbl.
var CITAS_ATENDIDAS_MESES_ABREV = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
function citasAtendidasMesLbl(mes) {
  var partes = String(mes || '').split('-');
  return partes.length === 2 ? (CITAS_ATENDIDAS_MESES_ABREV[parseInt(partes[1], 10) - 1] + '-' + partes[0].slice(2)) : String(mes || '');
}

// "93,67 %" -- 2 decimales, coma decimal (es-CO) -- mismo criterio que
// inasistenciaFmtPct/efectividadAgendamientoFmtPct. `v` viene como
// fraccion 0..1.
function citasAtendidasFmtPct(v) {
  if (v === null || v === undefined) return '—';
  return (v * 100).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';
}

// % ponderado de un conjunto de filas/meses (Σatendidas/Σagendas, nunca el
// promedio simple de los % de cada mes) -- misma idea que
// inasistenciaPonderadoTotal. Devuelve la fraccion 0..1 (no el %), para
// pasar directo a citasAtendidasFmtPct.
function citasAtendidasPonderado(filas) {
  var tot = { agendas: 0, atendidas: 0 };
  (filas || []).forEach(function (f) { tot.agendas += f.agendas; tot.atendidas += f.atendidas; });
  return { agendas: tot.agendas, atendidas: tot.atendidas, pct: tot.agendas > 0 ? (tot.atendidas / tot.agendas) : null };
}

// "Ene-26 a Mar-26" (o "Ene-26" si solo hay un mes, o "" sin meses) --
// misma idea que inasistenciaRangoLbl. `filas` YA viene ordenada por mes
// (efectividadCitasPorMes, server/efectividad-citas.js: ORDER BY mes ASC).
function citasAtendidasRangoLbl(filas) {
  if (!filas || !filas.length) return '';
  var a = citasAtendidasMesLbl(filas[0].mes);
  var b = citasAtendidasMesLbl(filas[filas.length - 1].mes);
  return a === b ? a : (a + ' a ' + b);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CITAS_ATENDIDAS_COLUMNAS: CITAS_ATENDIDAS_COLUMNAS,
    CITAS_ATENDIDAS_ORDEN_ARRAY: CITAS_ATENDIDAS_ORDEN_ARRAY,
    citasAtendidasColIndexMap: citasAtendidasColIndexMap,
    citasAtendidasParseFilas: citasAtendidasParseFilas,
    citasAtendidasFilaComoArray: citasAtendidasFilaComoArray,
    citasAtendidasMesesDelArchivo: citasAtendidasMesesDelArchivo,
    citasAtendidasMesLbl: citasAtendidasMesLbl,
    citasAtendidasFmtPct: citasAtendidasFmtPct,
    citasAtendidasPonderado: citasAtendidasPonderado,
    citasAtendidasRangoLbl: citasAtendidasRangoLbl,
  };
}
