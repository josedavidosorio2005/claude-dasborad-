// sura-televentas-paleta-logic.js — Fase 345 (PR 2): la paleta 3 de la plataforma en el tablero
// Televentas de SURA, aplicada DESDE AFUERA. El tablero sale del HTML del supervisor
// (sura-televentas-app.js/.css, regenerados con scripts/sura/generar-televentas.js) y trae sus
// colores escritos; este archivo NO lo toca. Genera una hoja que sura-televentas.js agrega al
// Shadow DOM despues de la del tablero y que cambia esos colores por las variables de
// public/css/paleta.css (las variables CSS cruzan el Shadow DOM). Si se regenera el tablero con
// los mismos colores, la capa sigue funcionando sola.
//
// Que se cambia y que no:
//  - series de las graficas (rellenos y trazos SVG, leyendas, barras): a --serie-N;
//  - numeros pintados sobre las graficas (texto): a --serie-texto-N (>= 4,5:1);
//  - acentos decorativos de recuadros y filtros (--mc / --fc) y los botones de acento: a la paleta;
//  - ESTADOS (no se tocan, siguen en verde/amarillo/rojo con su texto): la barra de avance
//    g/y/r, los lotes A/B/C de #ialotes (🟢🟡🔴 con texto) y las tarjetas .ac-g/.ac-y/.ac-r.
// Logica pura: doble modo (navegador global / require en Node para las pruebas).
'use strict';

// Color del tablero -> numero de serie de la plataforma. PAL/MC del tablero, en su orden
// (1..12), y los 2 tonos extra de «Meta vs. produccion» para que ninguna grafica repita color.
var STV_SERIE_POR_HEX = {
  '#1f6feb': 1, '#12a37f': 2, '#e5833b': 3, '#a05cd6': 4, '#d64545': 5, '#c9a227': 6,
  '#2aa6c9': 7, '#7a8b99': 8, '#e255a1': 9, '#6b8e23': 10, '#8d5a3c': 11, '#3f51b5': 12,
  '#8b5cf6': 5, '#3b82f6': 4,
};
// Acentos DECORATIVOS de recuadros y filtros (--mc / --fc): el tono base de la paleta (1-6) mas
// parecido al del tablero, asi un recuadro nunca toma una variante oscura (series 7+).
var STV_ACENTO_POR_HEX = {
  '#1f6feb': 1, '#2aa6c9': 4, '#a05cd6': 2, '#8b5cf6': 6, '#e5833b': 5, '#e255a1': 3, '#12a37f': 4, '#c9a227': 5,
};
// Numeros pintados en color sobre la grafica «Meta vs. produccion» (texto, no relleno).
var STV_TEXTO_POR_HEX = { '#e5833b': 3, '#a78bfa': 5, '#60a5fa': 4, '#2fc79f': 2 };
// Colores que el tablero usa como ESTADO en la barra de avance (nunca se cambian ahi).
var STV_ESTADO_HEX = ['#12a37f', '#e0a800', '#d64545'];
// Botones de accion con color propio («Asesores», «＋ Agregar»): pasan al boton secundario.
var STV_BOTON_HEX = ['#e0559a', '#12a37f'];

function stvPaletaCss() {
  var r = [];
  // Variables propias del tablero (acento, botones, barras) -> paleta de la plataforma.
  // El acento del tablero (--ac) se usa de FONDO con letra blanca (pestaña activa, boton
  // principal): va en el teal de marca, como el boton primario de la plataforma (11,22:1).
  r.push(':host{--ac:var(--btn-primario-bg)!important;--ac2:var(--serie-2)!important;--bar:var(--serie-1)!important;--bar2:var(--serie-2)!important}');
  // Botones activos de segmento (fondo de color con letra blanca): boton primario.
  r.push('.seg .btn.on,.fx .seg .btn.on{background:var(--btn-primario-bg)!important;border-color:var(--btn-primario-bg)!important;color:var(--btn-primario-fg)!important}');
  Object.keys(STV_SERIE_POR_HEX).forEach(function (hex) {
    var v = 'var(--serie-' + STV_SERIE_POR_HEX[hex] + ')';
    r.push('[fill="' + hex + '" i]{fill:' + v + '}');
    r.push('[stroke="' + hex + '" i]{stroke:' + v + '}');
    r.push('.lg i[style*="background:' + hex + '" i]{background:' + v + '!important}');
    r.push('i[style*="background:' + hex + ';border-radius:4px" i]{background:' + v + '!important}');
    if (STV_ESTADO_HEX.indexOf(hex) === -1) r.push('i[style*="background:' + hex + '" i]{background:' + v + '!important}');
  });
  Object.keys(STV_ACENTO_POR_HEX).forEach(function (hex) {
    var v = 'var(--serie-' + STV_ACENTO_POR_HEX[hex] + ')';
    r.push('[style*="--mc:' + hex + '" i]{--mc:' + v + '!important}');
    r.push('[style*="--fc:' + hex + '" i]{--fc:' + v + '!important}');
  });
  Object.keys(STV_TEXTO_POR_HEX).forEach(function (hex) {
    r.push('[style*="fill:' + hex + '" i]{fill:var(--serie-texto-' + STV_TEXTO_POR_HEX[hex] + ')!important}');
  });
  STV_BOTON_HEX.forEach(function (hex) {
    r.push('button[style*="border-color:' + hex + '" i]{border-color:var(--btn-secundario-borde)!important;color:var(--btn-secundario-fg)!important;background:var(--btn-secundario-bg)!important}');
  });
  // Estados: los lotes A/B/C conservan su verde, amarillo y rojo (llevan 🟢🟡🔴 y texto).
  r.push('#ialotes .sbox[style*="--mc:#12a37f" i]{--mc:#12a37f!important}');
  r.push('#ialotes .sbox[style*="--mc:#e0a800" i]{--mc:#e0a800!important}');
  r.push('#ialotes .sbox[style*="--mc:#d64545" i]{--mc:#d64545!important}');
  return r.join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { STV_SERIE_POR_HEX: STV_SERIE_POR_HEX, STV_ACENTO_POR_HEX: STV_ACENTO_POR_HEX, STV_TEXTO_POR_HEX: STV_TEXTO_POR_HEX, STV_ESTADO_HEX: STV_ESTADO_HEX, STV_BOTON_HEX: STV_BOTON_HEX, stvPaletaCss: stvPaletaCss };
}
