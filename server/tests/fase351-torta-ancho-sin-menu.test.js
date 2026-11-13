// fase351-torta-ancho-sin-menu.test.js — Fase 351: las graficas que deciden su forma por el ancho
// de su contenedor (tortas de Tipificación y de «Gestión líneas internas», barras de líneas
// internas) calculan sus cortes con el ancho que tendria el contenedor SIN el menu lateral.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const L = require('../../public/js/gd-menu-lateral.js');
const T = require('../../public/js/tipificacion-logic.js');

const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');

test('351: ancho equivalente sin menu (el contenedor ocupa la misma fraccion del panel)', () => {
  // 1440 px: panel ~1360 sin menu; con el menu abierto, 220 px menos.
  assert.equal(L.gdAnchoEquivalente(1140, 1140, 220), 1360, 'contenedor de todo el panel');
  assert.equal(L.gdAnchoEquivalente(550, 1140, 220), 656, 'torta junto a la tabla (mitad del panel)');
  assert.equal(L.gdAnchoEquivalente(550, 1140, 0), 550, 'sin menu: tal cual');
  assert.equal(L.gdAnchoEquivalente(0, 1140, 220), 0);
  assert.equal(L.gdAnchoEquivalente(550, 0, 220), 550);
});

test('351: con el ancho sin menu, la torta de 1440 px vuelve a sus 15 porciones y leyenda al lado', () => {
  const sinCompensar = 550, compensado = L.gdAnchoEquivalente(550, 1140, 220);
  assert.equal(T.tipificacionMaxPorciones(sinCompensar), 10, 'lo que pasaba con el menu abierto');
  assert.equal(T.tipificacionMaxPorciones(compensado), 15, 'igual que antes del menu');
  assert.ok(compensado >= 600, 'leyenda al lado (no abajo)');
});

test('351: las tres graficas por ancho usan gdAnchoSinMenu (con respaldo si no esta cargado)', () => {
  const tip = PUB('js/tipificacion.js');
  assert.ok(tip.includes("var anchoTorta = (typeof gdAnchoSinMenu === 'function' ? gdAnchoSinMenu(contHost) : contHost.clientWidth)"));
  const li = PUB('js/lineas-internas.js');
  assert.ok(li.includes("var ancho = (wrap && (typeof gdAnchoSinMenu === 'function' ? gdAnchoSinMenu(wrap) : wrap.clientWidth))"));
  assert.ok(li.includes("(elFlujo && (typeof gdAnchoSinMenu === 'function' ? gdAnchoSinMenu(elFlujo) : elFlujo.clientWidth))"));
  // Ninguna otra grafica del tablero mide el ancho de su contenedor (las demas usan la ventana).
  const otros = fs.readdirSync(path.join(__dirname, '..', '..', 'public', 'js')).filter((f) => f.endsWith('.js') && !/^(tipificacion|lineas-internas|gd-menu-lateral|row-actions|sura-televentas.*)\.js$/.test(f));
  for (const f of otros) assert.doesNotMatch(PUB('js/' + f), /\.clientWidth\b/, f + ' mide el ancho de un contenedor: revisar si cambia con el menu');
});

test('351: sin menu lateral (otros clientes o 900 px o menos) el ancho no cambia', () => {
  const src = PUB('js/gd-menu-lateral.js');
  assert.ok(src.includes("!modal.classList.contains('gd-menu-lateral')"));
  assert.ok(src.includes("if (cs.display !== 'grid') return w;"));
});
