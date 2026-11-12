// helpers-paleta.js — Fase 345: lee la paleta de la plataforma desde su UNICO lugar,
// public/css/paleta.css, para que las pruebas nunca tengan colores de serie escritos a mano.
'use strict';
const fs = require('fs');
const path = require('path');

const CSS = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'css', 'paleta.css'), 'utf8');

function bloque(selector) {
  const i = CSS.indexOf(selector + '{');
  if (i === -1) throw new Error('paleta.css sin el bloque ' + selector);
  return CSS.slice(i, CSS.indexOf('}', i));
}
function leer(b) {
  const v = {};
  for (const m of b.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})/g)) v[m[1]] = m[2];
  const series = [];
  for (let i = 1; v['serie-' + i]; i++) series.push(v['serie-' + i]);
  const texto = [];
  for (let i = 1; v['serie-texto-' + i]; i++) texto.push(v['serie-texto-' + i]);
  return { series, PC: series.slice(0, 12), EXTRA: series.slice(12, 20), texto, tokens: v };
}
const claro = leer(bloque(':root'));
const oscuro = leer(bloque(':root[data-theme="dark"]'));

// Superficies donde se dibujan las graficas y el texto (styles.css): tarjeta, sutil y fondo.
const FONDOS = { claro: ['#ffffff', '#f7fbfd', '#f0f4f8'], oscuro: ['#132c35', '#17343e', '#0a1e25'] };
const SEMAFORO = { claro: ['#1f9d55', '#c26a00', '#e74c3c'], oscuro: ['#4ade80', '#fbbf24', '#f87171'] };

module.exports = { CSS, claro, oscuro, FONDOS, SEMAFORO };
