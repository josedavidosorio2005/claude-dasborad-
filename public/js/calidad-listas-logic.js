// calidad-listas-logic.js — Fase 348 (reunion con Edwin del 12/11, punto C). Logica pura de las
// listas largas del Modulo de Calidad (Monitoreos, Detalle por mes, Calidad de encuestas): cuantas
// filas por pagina (10 por defecto, o 20) y que pagina se ve. Sin DOM: se prueba en node.
// La parte de la pagina (controles, estado por lista) vive en calidad-listas.js.
'use strict';

var CL_TAMANOS = [10, 20];
var CL_TAMANO_DEFECTO = 10;

// Cualquier valor que no sea 10 o 20 vuelve a 10.
function clTamano(v) {
  var n = Number(v);
  return CL_TAMANOS.indexOf(n) !== -1 ? n : CL_TAMANO_DEFECTO;
}

// Pagina segura (1..paginas) y el corte [desde, hasta) de la lista. Sin filas: 1 pagina vacia.
function clPaginar(total, pagina, porPagina) {
  var t = Math.max(0, Math.floor(Number(total)) || 0);
  var pp = clTamano(porPagina);
  var paginas = Math.max(1, Math.ceil(t / pp));
  var p = Math.floor(Number(pagina)) || 1;
  if (p < 1) p = 1;
  if (p > paginas) p = paginas;
  var desde = (p - 1) * pp;
  return { total: t, porPagina: pp, paginas: paginas, pagina: p, desde: desde, hasta: Math.min(desde + pp, t) };
}

// «11–20 de 53»; sin filas, «0 de 0».
function clTextoRango(pg) {
  if (!pg || !pg.total) return '0 de 0';
  return (pg.desde + 1) + '–' + pg.hasta + ' de ' + pg.total;
}

// Numeros de pagina para los botones: siempre la primera, la ultima y las vecinas de la actual;
// los huecos van como '…'. Ej.: (6, 12) -> [1, '…', 5, 6, 7, '…', 12].
function clPaginasVisibles(pagina, paginas) {
  var n = Math.max(1, Math.floor(Number(paginas)) || 1);
  var p = Math.min(Math.max(1, Math.floor(Number(pagina)) || 1), n);
  var set = {};
  [1, n, p - 1, p, p + 1].forEach(function (x) { if (x >= 1 && x <= n) set[x] = true; });
  var nums = Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
  var out = [];
  nums.forEach(function (x, i) {
    if (i > 0) {
      var prev = nums[i - 1];
      if (x - prev === 2) out.push(prev + 1); // hueco de una sola pagina: se muestra el numero
      else if (x - prev > 2) out.push('…');
    }
    out.push(x);
  });
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CL_TAMANOS: CL_TAMANOS, CL_TAMANO_DEFECTO: CL_TAMANO_DEFECTO, clTamano: clTamano, clPaginar: clPaginar, clTextoRango: clTextoRango, clPaginasVisibles: clPaginasVisibles };
}
