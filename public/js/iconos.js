// iconos.js — Fase 152 (F10): iconos SVG de Lucide (licencia ISC,
// public/img/iconos/LICENSE) en lugar de emojis en el menu y los botones.
//
// Los dibujos viven en UN solo archivo dentro del repo
// (public/img/iconos/lucide.svg, sin CDN: la CSP no permite origenes
// externos); cada icono se usa con <use href="...#i-NOMBRE">. Usan
// currentColor, asi que siguen el tema claro/oscuro. Siempre van con
// aria-hidden y focusable="false": el texto visible (o el aria-label del
// boton) es lo que dice que hace el control.
//
// Doble modo: global en el navegador y require() en Node para las pruebas
// (server/tests/fase152-f10-iconos.test.js).
'use strict';

var ICONOS_SPRITE = 'img/iconos/lucide.svg';

function iconoSvg(nombre, clase) {
  var n = String(nombre || '').replace(/[^a-z0-9-]/g, '');
  return '<svg class="icono' + (clase ? ' ' + clase : '') + '" aria-hidden="true" focusable="false">' +
    '<use href="' + ICONOS_SPRITE + '#i-' + n + '"></use></svg>';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ICONOS_SPRITE: ICONOS_SPRITE, iconoSvg: iconoSvg };
}
