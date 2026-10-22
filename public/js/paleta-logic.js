// paleta-logic.js — InConexion Platform.
//
// Logica PURA (sin DOM) de color categorico ESTABLE para las graficas de
// tendencia/barras/pie de los dashboards de cliente (dashboard-generic.js,
// trafico.js). Doble modo como semaforo-logic.js/trafico-logic.js: global en
// el navegador, require() en Node para las pruebas
// (server/tests/paleta-logic.test.js).
//
// Bug real que esto corrige (2026-09-16): antes, el color de una serie/
// categoria salia de su POSICION en el array (`paleta[indice % paleta.length]`).
// En los paneles de pie/bar que leen filas de un Excel (tipificacion,
// asesores, entidades...) esa posicion depende del orden de las filas tal
// cual vienen del archivo subido — si el orden cambia entre un mes y otro
// (algo normal en un Excel editado a mano), la MISMA categoria cambiaba de
// color de una carga a otra. `paletaColorPara` deriva el color de la
// ETIQUETA (hash determinista), nunca de la posicion: el mismo dato usa
// siempre el mismo color, sin importar el orden en que llegue ni cuantas
// veces se recargue la pagina.
//
// Nunca se mezcla con semaforo-logic.js: esta paleta es puramente
// categorica (identidad de dato -> color fijo), el semaforo es un color por
// UMBRAL (verde/amarillo/rojo segun si un valor cumple una meta) — dos
// significados distintos que no deben compartir ni paleta ni funcion.
'use strict';

// Hash simple (djb2-like) sobre la etiqueta -> indice estable en la paleta.
// Determinista: la MISMA cadena produce SIEMPRE el mismo indice, en
// cualquier ejecucion/navegador (no depende de Object key order ni de Math.random).
function paletaColorPara(etiqueta, paleta) {
  var pal = (paleta && paleta.length) ? paleta : (typeof PC !== 'undefined' ? PC : ['#0d4a5e']);
  var s = String(etiqueta === null || etiqueta === undefined ? '' : etiqueta).trim().toUpperCase();
  var h = 5381;
  for (var i = 0; i < s.length; i++) {
    h = ((h * 33) ^ s.charCodeAt(i)) | 0;
  }
  var idx = Math.abs(h) % pal.length;
  return pal[idx];
}

// Fase 164 (D-02, auditoria de diseno): con 12 colores y ~9 categorias en
// una misma torta, el hash casi siempre hace coincidir a dos (en Tipificacion
// salian dos rosados y dos beige). Colores para UNA grafica: cada etiqueta
// conserva su color propio (paletaColorPara) salvo que otra etiqueta ANTERIOR
// de la lista ya lo tenga; entonces toma el siguiente color libre de la
// paleta. Las etiquetas van en el orden de la grafica (la de mas registros
// primero), asi que la categoria grande conserva su color de siempre. Solo
// si hay mas etiquetas que colores se repite alguno (no hay otra salida).
function paletaColoresSinRepetir(etiquetas, paleta) {
  var pal = (paleta && paleta.length) ? paleta : (typeof PC !== 'undefined' ? PC : ['#0d4a5e']);
  var usados = {};
  return (etiquetas || []).map(function (e) {
    var c = paletaColorPara(e, pal);
    if (usados[c] && Object.keys(usados).length < pal.length) {
      var i = pal.indexOf(c);
      while (usados[pal[i]]) i = (i + 1) % pal.length;
      c = pal[i];
    }
    usados[c] = true;
    return c;
  });
}

// Doble modo: global en el navegador, require() en Node para las pruebas.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { paletaColorPara: paletaColorPara, paletaColoresSinRepetir: paletaColoresSinRepetir };
}
