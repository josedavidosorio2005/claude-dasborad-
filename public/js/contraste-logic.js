// contraste-logic.js — InConexion Platform (Fase 133).
//
// Logica PURA (sin DOM) de contraste WCAG 2.1 -- luminancia relativa y
// razon de contraste entre 2 colores, mas una simulacion de vision de
// color alterada (protanopia/deuteranopia/tritanopia, matrices estandar
// de Machado/Oliveira/Fairchild 2009) y distancia perceptual CIELAB
// (deltaE76) para medir si 2 colores se distinguen entre si. Sin
// dependencias nuevas. Doble modo como semaforo-logic.js/esc.js: global
// en el navegador, require() en Node para las pruebas
// (server/tests/contraste-logic.test.js, sistema-de-diseno.test.js).
'use strict';

// Acepta "#rgb" o "#rrggbb". Devuelve {r,g,b} en 0-255.
function contrasteHexARgb(hex) {
  var h = String(hex || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.substr(0, 2), 16),
    g: parseInt(h.substr(2, 2), 16),
    b: parseInt(h.substr(4, 2), 16),
  };
}

function contrasteCanalLineal(c) {
  var s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

// Luminancia relativa WCAG (0 = negro, 1 = blanco).
function contrasteLuminancia(hex) {
  var rgb = contrasteHexARgb(hex);
  if (!rgb) return null;
  var r = contrasteCanalLineal(rgb.r), g = contrasteCanalLineal(rgb.g), b = contrasteCanalLineal(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Razon de contraste WCAG entre 2 colores hex -- 1 (igual) a 21 (negro/blanco).
function contrasteRazon(hexA, hexB) {
  var lA = contrasteLuminancia(hexA), lB = contrasteLuminancia(hexB);
  if (lA === null || lB === null) return null;
  var l1 = Math.max(lA, lB) + 0.05, l2 = Math.min(lA, lB) + 0.05;
  return l1 / l2;
}

// true/false contra el umbral AA que corresponda. grande = texto >=24px, o
// >=18.66px (1.167rem) en negrita (WCAG 2.1, 1.4.3). componente = icono/
// borde de control/grafica (1.4.11), umbral 3:1 igual que "grande".
function contrastePasaAA(hexA, hexB, opts) {
  var r = contrasteRazon(hexA, hexB);
  if (r === null) return false;
  var o = opts || {};
  var umbral = (o.grande || o.componente) ? 3 : 4.5;
  return r >= umbral;
}

// ── Simulacion de vision de color alterada (Machado/Oliveira/Fairchild
// 2009, severidad 100%) -- matrices en espacio RGB lineal. Se usa para
// confirmar que la paleta categorica de graficas (PC/PC_DARK) se distingue
// incluso con protanopia/deuteranopia/tritanopia, no solo con vision
// tipica. ──
var CONTRASTE_MATRICES_CVD = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.011820, 0.042940, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.303900],
  ],
};

function contrasteCanalLinealARgb(s) {
  var v = s <= 0.0031308 ? s * 12.92 : 1.055 * Math.pow(s, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

// Devuelve el hex simulado bajo el tipo de CVD dado ('protanopia'|
// 'deuteranopia'|'tritanopia'). hex sin cambios si el tipo no existe.
function contrasteSimularCvd(hex, tipo) {
  var m = CONTRASTE_MATRICES_CVD[tipo];
  var rgb = contrasteHexARgb(hex);
  if (!m || !rgb) return hex;
  var rl = contrasteCanalLineal(rgb.r), gl = contrasteCanalLineal(rgb.g), bl = contrasteCanalLineal(rgb.b);
  var r2 = m[0][0] * rl + m[0][1] * gl + m[0][2] * bl;
  var g2 = m[1][0] * rl + m[1][1] * gl + m[1][2] * bl;
  var b2 = m[2][0] * rl + m[2][1] * gl + m[2][2] * bl;
  var r = contrasteCanalLinealARgb(r2), g = contrasteCanalLinealARgb(g2), b = contrasteCanalLinealARgb(b2);
  return '#' + [r, g, b].map(function (c) { return ('0' + c.toString(16)).slice(-2); }).join('');
}

// sRGB (0-255) -> CIELAB {L,a,b}, D65. Para deltaE76 (distancia perceptual).
function contrasteRgbALab(rgb) {
  function pivotXyz(v) { return v > 0.008856 ? Math.pow(v, 1 / 3) : (7.787 * v) + 16 / 116; }
  var rl = contrasteCanalLineal(rgb.r), gl = contrasteCanalLineal(rgb.g), bl = contrasteCanalLineal(rgb.b);
  var x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047;
  var y = (rl * 0.2126 + gl * 0.7152 + bl * 0.0722) / 1.0;
  var z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883;
  var fx = pivotXyz(x), fy = pivotXyz(y), fz = pivotXyz(z);
  return { L: (116 * fy) - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

// Distancia perceptual CIELAB (deltaE76) entre 2 colores hex. >= ~10-12
// se considera "claramente distinguible" para la mayoria de observadores.
function contrasteDeltaE(hexA, hexB) {
  var rgbA = contrasteHexARgb(hexA), rgbB = contrasteHexARgb(hexB);
  if (!rgbA || !rgbB) return null;
  var labA = contrasteRgbALab(rgbA), labB = contrasteRgbALab(rgbB);
  return Math.sqrt(Math.pow(labA.L - labB.L, 2) + Math.pow(labA.a - labB.a, 2) + Math.pow(labA.b - labB.b, 2));
}

// Doble modo: global en el navegador, require() en Node para las pruebas.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    contrasteHexARgb: contrasteHexARgb,
    contrasteLuminancia: contrasteLuminancia,
    contrasteRazon: contrasteRazon,
    contrastePasaAA: contrastePasaAA,
    contrasteSimularCvd: contrasteSimularCvd,
    contrasteDeltaE: contrasteDeltaE,
  };
}
