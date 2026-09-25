// gd-combo-logic.js — InConexion Platform.
//
// Logica PURA (sin DOM) del panel `combo` (barras + linea opcional) del
// dashboard generico (dashboard-generic.js) -- arma los datasets de
// Chart.js a partir de los datos ya resueltos (_gdResolver), separado en su
// propio archivo por el mismo motivo que gd-filtro-logic.js: poder
// testearlo en Node sin DOM (dashboard-generic.js no se puede requerir en
// Node tal cual -- registra listeners contra `document` en la carga del
// modulo).
//
// Fase 76 (hallazgo Fase 75): con UNA sola categoria en el eje X, la barra
// ocupaba casi todo el ancho del panel y tapaba visualmente el punto de la
// linea (el dato SI se calculaba bien -- confirmado en "Servicios
// Gestionados del Mes" de Gestion STA, ORLANT: 334/417 = 80.1%, igual que
// "STA por Mes" -- el problema era solo de dibujo). Dos ajustes, los dos
// sin efecto quando ya hay varias categorias (Chart.js solo aplica el tope
// de ancho SI hace falta, y el `order` explicito no cambia el orden
// RELATIVO entre barras, solo pone la linea encima de todas ellas):
//   - maxBarThickness: tope de ancho en px -- con pocas categorias Chart.js
//     agranda la barra para llenar el espacio disponible; con este tope no
//     pasa de un ancho razonable. Con varias categorias el ancho natural ya
//     es menor al tope, asi que no cambia nada.
//   - order: la linea SIEMPRE se dibuja encima de las barras (Chart.js usa
//     `order` para decidir que dataset se pinta primero -- un valor mas
//     alto se dibuja primero, mas abajo en la pila visual). Antes no se
//     fijaba ningun `order`, así que Chart.js podia pintar la linea antes
//     que la barra en algunos casos (el bug que se ve con 1 sola
//     categoria, donde la barra es tan ancha que tapa el punto entero).
//
// Doble modo como gd-filtro-logic.js: global en el navegador, require() en
// Node para las pruebas (server/tests/gd-combo-logic.test.js).
'use strict';

var GD_COMBO_BAR_MAX_THICKNESS = 56; // px -- ancho comodo de barra, nunca alcanzado en un panel con varias categorias/series
var GD_COMBO_ORDER_BARRA = 2; // mas alto -> se dibuja primero (abajo)
var GD_COMBO_ORDER_LINEA = 1; // mas bajo -> se dibuja despues (encima)

// barras: [{ label, data, color }]   linea: { label, data, color } | null|undefined
function gdComboDatasets(barras, linea) {
  var ds = (barras || []).map(function (b) {
    return {
      type: 'bar',
      label: b.label,
      data: b.data || [],
      backgroundColor: b.color,
      borderRadius: 3,
      yAxisID: 'y',
      maxBarThickness: GD_COMBO_BAR_MAX_THICKNESS,
      order: GD_COMBO_ORDER_BARRA,
    };
  });
  if (linea) {
    ds.push({
      type: 'line',
      label: linea.label,
      data: linea.data || [],
      borderColor: linea.color,
      borderWidth: 2.5,
      pointRadius: 5,
      pointHoverRadius: 6,
      pointBackgroundColor: linea.color,
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      tension: 0.3,
      yAxisID: 'y2',
      order: GD_COMBO_ORDER_LINEA,
    });
  }
  return ds;
}

// Doble modo: global en el navegador, require() en Node para las pruebas.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GD_COMBO_BAR_MAX_THICKNESS: GD_COMBO_BAR_MAX_THICKNESS,
    GD_COMBO_ORDER_BARRA: GD_COMBO_ORDER_BARRA,
    GD_COMBO_ORDER_LINEA: GD_COMBO_ORDER_LINEA,
    gdComboDatasets: gdComboDatasets,
  };
}
