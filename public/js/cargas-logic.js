// cargas-logic.js — InConexion Platform.
//
// Logica PURA (sin DOM) del parseo de la carga de datos operativos de los
// dashboards de cliente (ver cargas.js para el flujo con UI). Doble modo
// como trafico-logic.js / calidad-carga-masiva-logic.js: global en el
// navegador y require() en Node para las pruebas
// (server/tests/cargas-logic.test.js).
'use strict';

function _cargasNorm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

function cargasColPorLabel(spec, label) {
  var n = _cargasNorm(label);
  return spec.columnas.find(function (c) { return _cargasNorm(c.label) === n || _cargasNorm(c.key) === n; }) || null;
}

function cargasParseFilaUnica(spec, aoa) {
  // Formato vertical: [ [label, valor], ... ]  (se ignora una fila de encabezado si dice "metrica")
  var obj = {};
  var avisos = [];
  aoa.forEach(function (row) {
    if (!row || row.length < 2) return;
    if (_cargasNorm(row[0]) === 'metrica' || _cargasNorm(row[0]) === 'métrica') return;
    var col = cargasColPorLabel(spec, row[0]);
    if (!col) { avisos.push('Se ignoro la fila "' + row[0] + '" (no coincide con ninguna metrica)'); return; }
    obj[col.key] = row[1];
  });
  if (Object.keys(obj).length === 0) return { error: 'El archivo no tiene metricas reconocibles. Descarga la plantilla.' };
  return { filas: [obj], avisos: avisos };
}

function cargasParseMultiFila(spec, aoa) {
  if (!aoa.length) return { error: 'El archivo esta vacio' };
  var headers = aoa[0].map(function (h) { return cargasColPorLabel(spec, h); });
  if (!headers.some(Boolean)) return { error: 'Los encabezados no coinciden con la plantilla. Descarga la plantilla.' };
  var filas = [];
  for (var i = 1; i < aoa.length; i++) {
    var row = aoa[i];
    if (!row || row.every(function (v) { return v === '' || v == null; })) continue;
    var obj = {};
    headers.forEach(function (col, j) { if (col) obj[col.key] = row[j]; });
    filas.push(obj);
  }
  if (filas.length === 0) return { error: 'El archivo no tiene filas de datos' };
  return { filas: filas, avisos: [] };
}

// ── Deteccion de formulas de Excel sin valor calculado ──────────────────
// Un .xlsx generado por script (nunca abierto en Excel/LibreOffice para
// forzar el recalculo) guarda el TEXTO de la formula pero no su resultado:
// la celda queda "vacia" para cualquier lector que solo mire el valor crudo
// (SheetJS incluido). Sin esta deteccion esas cargas se aceptaban en
// silencio y la vista previa mostraba "—" sin explicar por que (caso real:
// plantilla de Alberto Linero Go con =COUNTA/=COUNTIF apuntando a una hoja
// de detalle que el sistema nunca calculo).
//
// `ws` es un worksheet con la misma forma que usa SheetJS: un objeto plano
// con una entrada por direccion de celda ("A1", "B2", ...) donde cada celda
// es { v: valor, f: formula (si la hay) }. server/tests/helpers/xlsx-lite.js
// produce la misma forma para poder probar esto contra un .xlsx real sin
// depender del paquete npm `xlsx`.
function _cargasParseAddr(addr) {
  var m = /^([A-Z]+)(\d+)$/.exec(addr);
  var col = 0;
  for (var i = 0; i < m[1].length; i++) col = col * 26 + (m[1].charCodeAt(i) - 64);
  return { col: col, row: parseInt(m[2], 10) };
}
function _cargasCompararCeldas(a, b) {
  var pa = _cargasParseAddr(a), pb = _cargasParseAddr(b);
  if (pa.row !== pb.row) return pa.row - pb.row;
  return pa.col - pb.col;
}

// Devuelve { celda, formula, etiqueta, mensaje } de la primera celda con
// formula sin valor calculado (leyendo en orden de fila/columna, para
// reportar siempre la primera que veria un humano), o null si no hay ninguna.
function cargasDetectarFormulaSinValor(ws) {
  if (!ws) return null;
  var direcciones = Object.keys(ws)
    .filter(function (k) { return k.charAt(0) !== '!' && /^[A-Z]+\d+$/.test(k); })
    .sort(_cargasCompararCeldas);
  for (var i = 0; i < direcciones.length; i++) {
    var addr = direcciones[i];
    var cell = ws[addr];
    if (cell && cell.f && (cell.v === undefined || cell.v === null || cell.v === '')) {
      var fila = _cargasParseAddr(addr).row;
      var etiquetaCell = ws['A' + fila];
      var etiqueta = etiquetaCell && etiquetaCell.v != null && etiquetaCell.v !== '' ? String(etiquetaCell.v) : null;
      return {
        celda: addr,
        formula: cell.f,
        etiqueta: etiqueta,
        mensaje: 'La celda ' + addr + (etiqueta ? ' ("' + etiqueta + '")' : '') +
          ' tiene una formula de Excel ("=' + cell.f + '") sin calcular. ' +
          'Escribe el numero final ya calculado, no una formula — probablemente este archivo nunca se abrio ' +
          'en Excel o LibreOffice para forzar el recalculo.',
      };
    }
  }
  return null;
}

// Doble modo: global en el navegador, require() en Node para las pruebas.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    cargasColPorLabel: cargasColPorLabel,
    cargasParseFilaUnica: cargasParseFilaUnica,
    cargasParseMultiFila: cargasParseMultiFila,
    cargasDetectarFormulaSinValor: cargasDetectarFormulaSinValor,
  };
}
