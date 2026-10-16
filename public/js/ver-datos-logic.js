// ver-datos-logic.js — Fase 152 (B9): "Ver datos" de una grafica y la
// fraccion "3 de 45" en los tooltips.
//
// Logica PURA (sin DOM), doble modo como semaforo-logic.js: global en el
// navegador y require() en Node para las pruebas
// (server/tests/fase152-b9-ver-datos.test.js). Reutiliza los datos que la
// grafica YA tiene (cfg.data de Chart.js): no pide nada nuevo al servidor.
'use strict';

var _vdEsc = (typeof esc === 'function') ? esc : (typeof require === 'function' ? require('./esc.js').esc : function (s) { return String(s); });

function _vdNum(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = Number(v);
  return isNaN(n) ? null : n;
}

// "3 de 45" (miles con punto, es-CO). null si no hay denominador util.
function fraccionTexto(num, den) {
  var n = _vdNum(num);
  var d = _vdNum(den);
  if (n === null || d === null || d === 0) return null;
  return n.toLocaleString('es-CO') + ' de ' + d.toLocaleString('es-CO');
}

// Fraccion de un punto de un dataset:
//   - dataset.fraccion = { num: [...], den: [...] } (series de % que se
//     calculan a partir de dos conteos, ej. contestadas de total);
//   - torta/dona: el valor de esa porcion contra la suma de todas.
// null si no aplica.
function fraccionDePunto(tipoGrafica, dataset, i) {
  if (!dataset) return null;
  if (dataset.fraccion && dataset.fraccion.num && dataset.fraccion.den) {
    return fraccionTexto(dataset.fraccion.num[i], dataset.fraccion.den[i]);
  }
  if (tipoGrafica === 'pie' || tipoGrafica === 'doughnut') {
    var total = (dataset.data || []).reduce(function (a, v) { var n = _vdNum(v); return a + (n === null ? 0 : n); }, 0);
    return fraccionTexto(dataset.data[i], total);
  }
  return null;
}

// Tabla de una grafica: { columnas: [primera, ...series], filas: [[etiqueta,
// valor, ...]] }. Las lineas de meta (esMeta) no son datos y no entran.
// `formatear(datasetIndex, dataIndex, valor)` devuelve el texto de la celda
// (el mismo del tooltip); sin funcion, el numero con formato es-CO.
function verDatosTabla(data, opts) {
  var o = opts || {};
  var labels = (data && data.labels) || [];
  var series = ((data && data.datasets) || [])
    .map(function (d, j) { return { d: d, j: j }; })
    .filter(function (x) { return !x.d.esMeta; });
  var fmt = typeof o.formatear === 'function' ? o.formatear : function (j, i, v) {
    var n = _vdNum(v);
    return n === null ? '—' : n.toLocaleString('es-CO');
  };
  var columnas = [o.primeraColumna || 'Período'].concat(series.map(function (x) {
    return x.d.label || (series.length === 1 ? 'Valor' : 'Serie ' + (x.j + 1));
  }));
  var filas = labels.map(function (lbl, i) {
    return [Array.isArray(lbl) ? lbl.join(' ') : String(lbl)].concat(series.map(function (x) {
      return fmt(x.j, i, (x.d.data || [])[i]);
    }));
  });
  return { columnas: columnas, filas: filas };
}

// HTML de la tabla (escapado). `titulo` va como <caption> para lectores de
// pantalla; la primera columna es encabezado de fila (th scope="row").
function verDatosHtml(tabla, titulo) {
  var cab = '<tr>' + tabla.columnas.map(function (c) { return '<th scope="col">' + _vdEsc(c) + '</th>'; }).join('') + '</tr>';
  var cuerpo = tabla.filas.length
    ? tabla.filas.map(function (f) {
      return '<tr><th scope="row">' + _vdEsc(f[0]) + '</th>' + f.slice(1).map(function (v) { return '<td>' + _vdEsc(v) + '</td>'; }).join('') + '</tr>';
    }).join('')
    : '<tr><td colspan="' + tabla.columnas.length + '">Sin datos.</td></tr>';
  return '<table class="aurora-table ver-datos-tabla"><caption class="sr-only">' + _vdEsc(titulo || 'Datos de la gráfica') + '</caption>' +
    '<thead>' + cab + '</thead><tbody>' + cuerpo + '</tbody></table>';
}

// Quita el prefijo "Serie: " que pone un callback de tooltip (para la celda).
function sinPrefijoSerie(texto, etiquetaSerie) {
  var t = String(texto == null ? '' : texto);
  var p = String(etiquetaSerie || '') + ': ';
  return etiquetaSerie && t.indexOf(p) === 0 ? t.slice(p.length) : t;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fraccionTexto: fraccionTexto,
    fraccionDePunto: fraccionDePunto,
    verDatosTabla: verDatosTabla,
    verDatosHtml: verDatosHtml,
    sinPrefijoSerie: sinPrefijoSerie,
  };
}
