// fase189-salida-botones-por-grafica.test.js — Fase 189 (ajuste de la Fase
// 188 pedido por Edwin, ORLANT, pestaña "Llamadas y WhatsApp de salida"): los
// botones Total / Línea General / Línea 3P van en la cabecera de la grafica de
// llamadas y en la de WhatsApp, cada grupo independiente (su tarjeta, sus
// barras y su parte de la tabla). "Línea de cada asesor" sigue arriba. Mismo
// selector de pastillas que las demas graficas (.gd-subtabs). Todo SINTETICO.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { gdGraficaHtml } = require('../../public/js/secciones-logic.js');

const JSP = (f) => path.join(__dirname, '..', '..', 'public', 'js', f);
const JS = (f) => fs.readFileSync(JSP(f), 'utf8');

// salida.js + salida-logic.js en un contexto aislado, con lo minimo del tablero.
function cargarSalida() {
  const ctx = {
    module: undefined, console,
    esc: (t) => String(t),
    gdFmtValor: (v, u) => (u === '%' ? String(v).replace('.', ',') + ' %' : String(v)),
    mesNombreLargo: (m) => ({ '2025-08': 'Agosto 2025', '2025-09': 'Septiembre 2025' }[m] || m),
  };
  vm.createContext(ctx);
  vm.runInContext(JS('mes-nombre-logic.js'), ctx);
  vm.runInContext(JS('salida-logic.js'), ctx);
  vm.runInContext(JS('salida.js'), ctx);
  return ctx;
}
const FILAS = [
  { mes: '2025-08', llamadas3p: 40, llamadasGeneral: 55, llamadasSinAsignar: 5, wpp3p: 12, wppGeneral: 7, wppSinAsignar: 1, fuenteLlamadas: 'cdr', fuenteWpp: 'cdr', lineaPorCliente: true },
  { mes: '2025-09', llamadas3p: 30, llamadasGeneral: 60, llamadasSinAsignar: 10, wpp3p: 20, wppGeneral: 10, wppSinAsignar: 0, fuenteLlamadas: 'cdr', fuenteWpp: 'cdr', lineaPorCliente: true },
];
// Filas de la tabla: [etiqueta, agosto, septiembre].
function filasTabla(html) {
  return [...html.matchAll(/<tr><td>([^<]*)<\/td>(.*?)<\/tr>/g)].map((m) => [m[1], ...[...m[2].matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((x) => x[1])]);
}

test('gdGraficaHtml: con `acciones` los controles van en la cabecera junto al titulo; sin la opcion, igual que siempre', () => {
  assert.equal(gdGraficaHtml('T', '<p>x</p>', { destacado: true }), '<section class="gd-grafica"><h3 class="gd-grafica-titulo gd-grafica-titulo-destacado">T</h3><p>x</p></section>');
  assert.equal(gdGraficaHtml('T', '<p>x</p>', { acciones: '<div id="a"></div>' }),
    '<section class="gd-grafica"><div class="gd-grafica-cab"><h3 class="gd-grafica-titulo">T</h3><div id="a"></div></div><p>x</p></section>');
});

test('tabla: cada canal con su propia linea; Total/Total es la de siempre y General + 3P + Sin clasificar = Total', () => {
  const ctx = cargarSalida();
  // Llamadas en Línea 3P, WhatsApp en Total.
  const mixta = filasTabla(ctx._salTablaHtml(FILAS, '2025-09', { llamadas: '3P', wpp: 'TOTAL' }));
  assert.deepEqual(mixta, [
    ['Llamadas · Línea 3P', '40', '30'],
    ['% del Total (Llamadas)', '40 %', '30 %'],
    ['Fuente (Llamadas)', 'CDR', 'CDR'],
    ['WhatsApp 3P', '12', '20'],
    ['WhatsApp General', '7', '10'],
    ['WhatsApp sin clasificar', '1', '0'],
    ['Total WhatsApp', '20', '30'],
    ['% 3P (WhatsApp)', '60 %', '66,7 %'],
    ['Fuente (WhatsApp)', 'CDR', 'CDR'],
  ]);
  // Al reves: llamadas Total, WhatsApp Línea General.
  const otra = filasTabla(ctx._salTablaHtml(FILAS, '2025-09', { llamadas: 'TOTAL', wpp: 'GENERAL' }));
  assert.deepEqual(otra.slice(0, 4), [['Llamadas 3P', '40', '30'], ['Llamadas General', '55', '60'], ['Llamadas sin clasificar', '5', '10'], ['Total Llamadas', '100', '100']]);
  assert.deepEqual(otra.slice(-3), [['WhatsApp · Línea General', '7', '10'], ['% del Total (WhatsApp)', '35 %', '33,3 %'], ['Fuente (WhatsApp)', 'CDR', 'CDR']]);
  // Total/Total: General + 3P + Sin clasificar = Total en cada mes y canal.
  const total = Object.fromEntries(filasTabla(ctx._salTablaHtml(FILAS, '2025-09')).map((f) => [f[0], f.slice(1).map(Number)]));
  for (const c of ['Llamadas', 'WhatsApp']) {
    [0, 1].forEach((k) => assert.equal(total[c + ' 3P'][k] + total[c + ' General'][k] + total[c + ' sin clasificar'][k], total['Total ' + c][k], c + ' mes ' + k));
  }
});

test('vista: sin fila de botones arriba; un grupo en la cabecera de cada grafica, independiente; "Línea de cada asesor" arriba', () => {
  const s = JS('salida.js');
  assert.doesNotMatch(s, /sal-lineas-'\+i/, 'ya no hay fila de botones arriba');
  assert.ok(s.includes("{ destacado: true, acciones: '<div id=\"sal-lin-llamadas-'+i+'\"></div>' }"));
  assert.ok(s.includes("{ destacado: true, acciones: '<div id=\"sal-lin-wpp-'+i+'\"></div>' }"));
  const iAse = s.indexOf("html += '<div id=\"sal-asesores-'+i+'\"></div>';");
  const iTar = s.indexOf("html += '<div id=\"sal-tarjetas-wrap-'+i+'\"></div>';");
  assert.ok(iAse > 0 && iAse < iTar, '"Línea de cada asesor" antes de las tarjetas');
  // Mismo selector de pastillas que las demas graficas (a11y-teclado: tablist + aria-selected + flechas).
  assert.ok(s.includes("'<div class=\"gd-subtabs sal-lineas\" aria-label=\"Línea de '+nombre+' de salida\">'"));
  assert.ok(s.includes("onclick=\"salElegirLinea('+i+',\\''+canal+'\\',\\''+b.clave+'\\')\""));
  const elegir = s.slice(s.indexOf('function salElegirLinea(i, canal, clave){'), s.indexOf('function _salPintar(i){'));
  assert.ok(elegir.includes('_salLinea[i][canal] = clave;'), 'solo cambia su canal');
  assert.doesNotMatch(elegir, /apiRequest/);
  const pintar = s.slice(s.indexOf('function _salPintar(i){'), s.indexOf('// ── Fase 170: linea'));
  assert.ok(pintar.includes("var totalLlam = salidaValorLinea(delMes, 'llamadas', lineas.llamadas);"));
  assert.ok(pintar.includes("var totalWpp = salidaValorLinea(delMes, 'wpp', lineas.wpp);"));
  assert.ok(pintar.includes("_salDibujarGrafica('sal-wpp-'+i, filasMeses, 'wpp', 'WhatsApp de salida'+sufijo('wpp'), lineas.wpp);"));
  // En el celular, los botones debajo del titulo; 44 px en el tablero movil (regla de la Fase 175).
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'css', 'styles.css'), 'utf8');
  assert.match(css, /@media \(max-width:480px\)\{\.gd-grafica-cab\{flex-direction:column;align-items:stretch;\}/);
  assert.match(css, /#gd-modal \.gd-subtab-btn\{min-height:44px;\}/);
});
