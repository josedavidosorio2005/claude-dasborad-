// gd-filtro-logic.js — InConexion Platform.
//
// Logica PURA (sin DOM) de los filtros nuevos de las graficas de Gestion de
// base del dashboard generico (dashboard-generic.js), extendiendo de forma
// consistente el patron ya usado por Trafico de Llamadas
// (traficoFiltrarFilas, trafico-logic.js) a los paneles pie/bar/line que
// leen filas de un Excel (modo:'filas'):
//   - pie / bar sobre un campo categorico (tipificacion, asesor, entidad,
//     categoria...) -> filtro de QUE categorias incluir (multi-select),
//     igual en espiritu al multi-select de skills de Trafico.
//   - line sobre 'fecha' (lineas diarias: "Llamadas por dia", "AHT por
//     dia"...) -> filtro de rango Desde/Hasta, igual en espiritu al
//     Desde/Hasta de Trafico.
//
// Doble modo como trafico-logic.js: global en el navegador, require() en
// Node para las pruebas (server/tests/gd-filtro-logic.test.js).
'use strict';

function _gdfNorm(v) {
  return String(v === null || v === undefined ? '' : v).trim().toUpperCase().replace(/\s+/g, ' ');
}

// Sin `incluidas` (null/undefined/vacio) -> no filtra (se ven todas las
// categorias, comportamiento identico al de antes de este cambio).
function gdFiltrarFilasCategorias(filas, campo, incluidas) {
  if (!incluidas || !incluidas.length) return filas || [];
  var set = {};
  incluidas.forEach(function (v) { set[_gdfNorm(v)] = true; });
  return (filas || []).filter(function (r) { return set[_gdfNorm(r[campo])]; });
}

// Desde/Hasta sobre `fecha` (formato 'YYYY-MM-DD', comparable como texto).
// Sin desde/hasta -> no filtra.
function gdFiltrarFilasRangoFechas(filas, desde, hasta) {
  return (filas || []).filter(function (r) {
    if (desde && r.fecha < desde) return false;
    if (hasta && r.fecha > hasta) return false;
    return true;
  });
}

// Lista de valores distintos de `campo` entre las filas, en el orden en que
// aparecen (para poblar un multi-select) — no se ordena alfabeticamente a
// proposito: el orden de aparicion es mas facil de reconocer para el
// admin/visor que ya conoce el Excel que subio.
function gdValoresDistintos(filas, campo) {
  var vistos = {};
  var out = [];
  (filas || []).forEach(function (r) {
    var v = r[campo];
    if (v === null || v === undefined || v === '') return;
    var k = _gdfNorm(v);
    if (!vistos[k]) { vistos[k] = true; out.push(v); }
  });
  return out;
}

// Elige una serie entre varias por su `label` (panel con `filtroSerie:true`,
// ej. Llamadas de salida con series Linea General / Linea 3P — una sola
// grafica, selector en vez de 4 paneles separados). Sin seleccion, o una
// seleccion que ya no existe en `series` (ej. quedo en la URL/estado de un
// panel que cambio de series), cae a la primera — nunca a "ninguna serie".
function gdSerieSeleccionada(series, labelSeleccionado) {
  var lista = series || [];
  if (!lista.length) return null;
  if (labelSeleccionado) {
    var m = lista.filter(function (s) { return s.label === labelSeleccionado; })[0];
    if (m) return m;
  }
  return lista[0];
}

// 'YYYY-MM' -> 'YYYY'. null-safe (sin mes seleccionado, ej. dashboard recien
// abierto sin cargas todavia).
function gdAnioDeMes(mes) {
  return (mes && /^\d{4}-\d{2}/.test(mes)) ? mes.slice(0, 4) : null;
}

// Cargas (cada una con `.periodo` 'YYYY-MM') cuyo anio coincide con `anio`
// ('YYYY'). Sin `anio` -> ninguna carga (nunca "todas" por accidente: una
// agregacion "(año)" sin año resuelto no debe sumar años distintos).
function gdCargasDelAnio(cargas, anio) {
  if (!anio) return [];
  return (cargas || []).filter(function (c) { return c && typeof c.periodo === 'string' && c.periodo.slice(0, 4) === anio; });
}

// Doble modo: global en el navegador, require() en Node para las pruebas.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    gdFiltrarFilasCategorias: gdFiltrarFilasCategorias,
    gdFiltrarFilasRangoFechas: gdFiltrarFilasRangoFechas,
    gdValoresDistintos: gdValoresDistintos,
    gdSerieSeleccionada: gdSerieSeleccionada,
    gdAnioDeMes: gdAnioDeMes,
    gdCargasDelAnio: gdCargasDelAnio,
  };
}
