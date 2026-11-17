// calidad-nombre-clave.js — Fase 361: UNA sola clave para comparar nombres de asesor/evaluador en
// Calidad, igual en el servidor (enlace-asesor.js y nombre_clave() de SQLite) y en el navegador
// (listas y resúmenes). Es la regla de la Fase 353b: sin distinguir mayúsculas (también con tilde o
// Ñ), espacios dobles o especiales (sin quiebre, de ancho cero...) como un espacio, sin espacios al
// borde. Las TILDES SÍ cuentan (con y sin tilde es «parecido», no el mismo nombre).
'use strict';

var CAL_NOMBRE_INVISIBLES = /[\u200b-\u200d\u2060\ufeff]/g;
var CAL_NOMBRE_ESPACIOS = /[\s\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/g;

function calClaveNombre(s) {
  return String(s == null ? '' : s).replace(CAL_NOMBRE_INVISIBLES, '').replace(CAL_NOMBRE_ESPACIOS, ' ').trim().toLowerCase();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calClaveNombre: calClaveNombre, CAL_NOMBRE_INVISIBLES: CAL_NOMBRE_INVISIBLES, CAL_NOMBRE_ESPACIOS: CAL_NOMBRE_ESPACIOS };
}
