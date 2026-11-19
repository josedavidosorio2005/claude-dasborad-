// fase375-sura-ventas-dia.test.js — Fase 375 (pedido de Edwin, 19/11): «📅 Ventas por día» en la
// pestaña Agentes del tablero Televentas de SURA: un recuadro aparte (se abre con un botón), con el
// mes, las ventas por día de cada asesor (fecha_venta) y un gráfico por día. Mismos filtros que
// «Ventas por agente» (validación y campaña). Va por el generador; la hoja de estilos no cambia.
// Datos INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const APP = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'sura-televentas-app.js'), 'utf8');
const GEN = fs.readFileSync(path.join(__dirname, '..', '..', 'scripts', 'sura', 'generar-televentas.js'), 'utf8');

test('el tablero publicado trae el botón y el recuadro (cerrado), y el generador los produce', () => {
  assert.ok(APP.includes('id=\\"vpdb\\"') && APP.includes('aria-controls=\\"vpd\\"'), 'botón en el markup');
  assert.ok(APP.includes('<div id=\\"vpd\\" hidden>'), 'el recuadro empieza cerrado');
  assert.ok(APP.includes('function drawVPD()') && APP.includes('function draw8(){drawVPD();'));
  assert.ok(GEN.includes("X('function draw8(){'") && GEN.includes('Fase 375'), 'el cambio va por el generador');
});

test('vpdDatos: suma por asesor y día del mes, con los filtros de validación y campaña', () => {
  const i = APP.indexOf('function vpdDatos('), j = APP.indexOf('function drawVPD(');
  const src = APP.slice(i, j);
  const VOFF = new Set(['ANULADA']), NV = '(sin validación)';
  const cOK = (c) => c !== 'otra';
  const campOf = (r) => r[7];
  const DB = { '2026-11': { rows: [
    ['asesora_uno', '2026-11-03', 2, 100, 'p', [], 'OK', 'odonto'],
    ['asesora_uno', '2026-11-03', 1, 50, 'p', [], 'OK', 'odonto'],
    ['asesora_dos', '2026-11-30', 1, 70, 'p', [], 'OK', 'odonto'],
    ['asesora_dos', '2026-11-30', 5, 999, 'p', [], 'ANULADA', 'odonto'], // validación excluida
    ['asesora_dos', '2026-11-10', 4, 999, 'p', [], 'OK', 'otra'], // campaña fuera del filtro
    ['asesora_tres', '2026-10-31', 9, 999, 'p', [], 'OK', 'odonto'], // otro mes: no entra
    ['', '2026-11-15', 1, 10, 'p', [], 'OK', 'odonto'],
  ] } };
  const vpdDatos = new Function('DB', 'VOFF', 'NV', 'cOK', 'campOf', src + '; return vpdDatos;')(DB, VOFF, NV, cOK, campOf);
  const v = vpdDatos('2026-11', 'v');
  assert.equal(v.n, 30);
  assert.equal(v.A.asesora_uno[2], 3);
  assert.equal(v.A.asesora_dos[29], 1);
  assert.equal(v.A['(sin agente)'][14], 1);
  assert.ok(!v.A.asesora_tres);
  assert.equal(v.tot.reduce((s, x) => s + x, 0), 5);
  const p = vpdDatos('2026-11', 'p');
  assert.equal(p.A.asesora_uno[2], 150);
  assert.equal(vpdDatos('2026-02', 'v').n, 28);
});

test('los textos que se pintan pasan por esc (asesor, mes)', () => {
  const draw = APP.slice(APP.indexOf('function drawVPD('), APP.indexOf('function draw8(){drawVPD();'));
  assert.ok(draw.includes('${esc(pretty(x.a))}') && draw.includes('${esc(x.a)}') && draw.includes('${esc(lab)}'));
  assert.ok(!/\$\{pretty\(x\.a\)\}/.test(draw), 'ningún nombre sin escapar');
});
