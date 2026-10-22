// filtros-movil-logic.js — Fase 152 (B4): movil y tableta.
//
// Logica PURA (sin DOM), doble modo como semaforo-logic.js: global en el
// navegador y require() en Node para las pruebas
// (server/tests/fase152-b4-movil.test.js).
'use strict';

// Ancho maximo (px) en el que los filtros se pliegan, la leyenda va debajo
// de la grafica y las etiquetas del eje se inclinan -- el mismo corte de
// movil/tableta del resto de la hoja de estilos.
var GD_ANCHO_MOVIL = 768;

// Cuantos filtros tienen un valor puesto. campos = [{ tipo, valor, marcado }]:
// un select/texto/fecha cuenta si no esta vacio ni en "todos/todas"; una
// casilla cuenta si esta marcada. El boton "Filtros (N)" muestra este N.
function gdContarFiltrosActivos(campos) {
  return (campos || []).filter(function (c) {
    if (!c) return false;
    if (c.tipo === 'checkbox') return !!c.marcado;
    var v = String(c.valor == null ? '' : c.valor).trim();
    return v !== '' && !/^(todos|todas|todo|\(todos\)|\(todas\))$/i.test(v);
  }).length;
}

function gdTextoBotonFiltros(n) {
  return 'Filtros' + (n > 0 ? ' (' + n + ')' : '');
}

// Ajusta (en el sitio) las opciones de una grafica de Chart.js para una
// pantalla de `ancho` px: en movil/tableta la leyenda va DEBAJO y las
// etiquetas del eje X se inclinan hasta 45 grados y se saltan las que no
// caben (mismo criterio que One & Done), para que no se monten. Tortas y
// barras horizontales no tienen eje X de categorias: solo la leyenda.
function gdOpcionesGraficaMovil(cfg, ancho) {
  if (!cfg || !(ancho <= GD_ANCHO_MOVIL)) return cfg;
  var o = cfg.options = cfg.options || {};
  o.plugins = o.plugins || {};
  var leyenda = o.plugins.legend = o.plugins.legend || {};
  if (leyenda.display !== false) leyenda.position = 'bottom';
  var tipo = cfg.type;
  if (tipo === 'pie' || tipo === 'doughnut' || o.indexAxis === 'y') return cfg;
  o.scales = o.scales || {};
  var x = o.scales.x = o.scales.x || {};
  x.ticks = x.ticks || {};
  x.ticks.autoSkip = true;
  x.ticks.maxRotation = 45;
  if (x.ticks.minRotation === undefined || x.ticks.minRotation > 45) x.ticks.minRotation = 0;
  return cfg;
}

// Fase 164 (D-10): atributos del contenedor con scroll horizontal de una
// tabla, para que el teclado lo alcance (y asi pueda desplazarlo con las
// flechas) y un lector de pantalla lo anuncie con el nombre de la tabla.
// `titulo` es el titulo visible de la grafica o del cuadro que la contiene;
// `encabezado`, el texto de la primera cabecera de la tabla (se usa si no
// hay titulo, o para distinguir dos tablas del mismo cuadro); `usados`, los
// nombres que ya tienen otras tablas en pantalla (cada nombre, unico).
function gdAtributosTablaScroll(titulo, encabezado, usados) {
  var limpio = function (s) { return String(s || '').replace(/\s+/g, ' ').trim(); };
  var t = limpio(titulo), e = limpio(encabezado);
  var ya = usados || [];
  var nombre = 'Tabla' + (t || e ? ': ' + (t || e) : '');
  if (ya.indexOf(nombre) !== -1 && t && e) nombre = 'Tabla: ' + t + ' (' + e + ')';
  var base = nombre, n = 2;
  while (ya.indexOf(nombre) !== -1) nombre = base + ' ' + (n++);
  return { tabindex: '0', role: 'region', 'aria-label': nombre };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GD_ANCHO_MOVIL: GD_ANCHO_MOVIL,
    gdAtributosTablaScroll: gdAtributosTablaScroll,
    gdContarFiltrosActivos: gdContarFiltrosActivos,
    gdTextoBotonFiltros: gdTextoBotonFiltros,
    gdOpcionesGraficaMovil: gdOpcionesGraficaMovil,
  };
}
