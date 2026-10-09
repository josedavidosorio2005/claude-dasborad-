// fase138-pr1-mes-nombre-logo-orlant.test.js — Fase 138 (PR1, ajustes de la
// reunion con Edwin del 09/10/2026): los selectores de mes de Calidad
// (#cal-mes-sel) y Mis Resultados (#mr-mes-sel) deben mostrar "Septiembre
// 2026" en vez del valor crudo "2026-09" -- el VALOR interno (option
// value) nunca cambia, solo la etiqueta visible. Ademas, el encabezado del
// tablero de ORLANT debe tener su propio logo (provisional, ver
// docs/marca.md), igual que ya tiene MOBILIZE desde la Fase 132.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const calidadJs = fs.readFileSync(path.join(PUBLIC_DIR, 'js', 'calidad.js'), 'utf8');
const dashboardJs = fs.readFileSync(path.join(PUBLIC_DIR, 'js', 'dashboard-generic.js'), 'utf8');
const html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
const { mesNombreLargo } = require('../../public/js/mes-nombre-logic.js');

// calidad.js es global-en-navegador (sin module.exports); se extrae SOLO la
// funcion pura calMonthSelectOptions (sin dependencias de DOM) con vm, para
// probar su comportamiento real en vez de solo buscar texto con regex.
function cargarCalMonthSelectOptions() {
  const m = calidadJs.match(/function calMonthSelectOptions\([\s\S]*?\n\}/);
  assert.ok(m, 'no se encontro la funcion calMonthSelectOptions en calidad.js');
  const sandbox = { mesNombreLargo: mesNombreLargo };
  vm.createContext(sandbox);
  vm.runInContext(m[0] + '\nthis.calMonthSelectOptions = calMonthSelectOptions;', sandbox);
  return sandbox.calMonthSelectOptions;
}

test('calMonthSelectOptions: usa mesNombreLargo para la etiqueta de cada mes (12 meses, distintos anios), el value interno no cambia', () => {
  const calMonthSelectOptions = cargarCalMonthSelectOptions();
  const meses = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
    '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2025-09'];
  const html2 = calMonthSelectOptions(meses, '2026-09');
  const esperado = {
    '2026-01': 'Enero 2026', '2026-02': 'Febrero 2026', '2026-03': 'Marzo 2026',
    '2026-04': 'Abril 2026', '2026-05': 'Mayo 2026', '2026-06': 'Junio 2026',
    '2026-07': 'Julio 2026', '2026-08': 'Agosto 2026', '2026-09': 'Septiembre 2026',
    '2026-10': 'Octubre 2026', '2026-11': 'Noviembre 2026', '2026-12': 'Diciembre 2026',
    '2025-09': 'Septiembre 2025',
  };
  Object.keys(esperado).forEach(function (valor) {
    const re = new RegExp('<option value="' + valor + '"[^>]*>' + esperado[valor] + '</option>');
    assert.match(html2, re, 'falta o esta mal la opcion para ' + valor + ' (se esperaba "' + esperado[valor] + '")');
  });
});

test('calMonthSelectOptions: el value interno sigue siendo "AAAA-MM" (nunca el nombre largo) y "selected" se mantiene sobre el value, no sobre la etiqueta', () => {
  const calMonthSelectOptions = cargarCalMonthSelectOptions();
  const html2 = calMonthSelectOptions(['2026-09'], '2026-09');
  assert.match(html2, /<option value="2026-09" selected>Septiembre 2026<\/option>/);
  assert.doesNotMatch(html2, /value="Septiembre/, 'el value nunca debe ser el nombre largo del mes');
});

test('calMonthSelectOptions: "Todos los meses" sigue como primera opcion con value vacio', () => {
  const calMonthSelectOptions = cargarCalMonthSelectOptions();
  const html2 = calMonthSelectOptions(['2026-09'], '');
  assert.match(html2, /^<option value="">Todos los meses<\/option>/);
});

// ── Logo de ORLANT en el encabezado (igual patron que fase132-08 para MOBILIZE) ──

test('index.html: el <img id="gd-cliente-logo"> sigue siendo el mismo elemento compartido (oculto por defecto)', () => {
  const m = html.match(/<img id="gd-cliente-logo"[^>]*>/);
  assert.ok(m, 'falta <img id="gd-cliente-logo"> en public/index.html');
  assert.match(m[0], /display:none/, 'debe empezar oculto (JS lo muestra para MOBILIZE/ORLANT)');
});

test('dashboard-generic.js: ORLANT tiene su propio logo (distinto del de MOBILIZE), con alt="Orlant"', () => {
  assert.match(dashboardJs, /_gd\.cliente === 'ORLANT'/, 'falta el chequeo de cliente ORLANT junto al logo');
  const rutaMatch = dashboardJs.match(/elLogo\.src = 'img\/clientes\/orlant[^']*\.png'/);
  assert.ok(rutaMatch, 'no se encontro la ruta del logo de ORLANT asignada a elLogo.src');
  assert.match(dashboardJs, /elLogo\.alt = 'Orlant'/);
});

test('dashboard-generic.js: el logo de ORLANT fija width/height explicitos (sin salto de layout), igual que el de MOBILIZE', () => {
  const bloqueOrlant = dashboardJs.slice(dashboardJs.indexOf("_gd.cliente === 'ORLANT'"), dashboardJs.indexOf("_gd.cliente === 'ORLANT'") + 900);
  assert.match(bloqueOrlant, /elLogo\.width = \d+;\s*elLogo\.height = \d+;/);
});

test('el archivo del logo de ORLANT (1x y 2x) existe de verdad en public/img/clientes/, y el 2x mide el doble', () => {
  const rutaMatch = dashboardJs.match(/elLogo\.src = 'img\/clientes\/(orlant[^']*\.png)'/);
  assert.ok(rutaMatch, 'no se encontro el nombre de archivo del logo de ORLANT');
  const nombre1x = rutaMatch[1];
  const nombre2x = nombre1x.replace('.png', '@2x.png');
  const p1x = path.join(PUBLIC_DIR, 'img', 'clientes', nombre1x);
  const p2x = path.join(PUBLIC_DIR, 'img', 'clientes', nombre2x);
  assert.ok(fs.existsSync(p1x), 'falta public/img/clientes/' + nombre1x);
  assert.ok(fs.existsSync(p2x), 'falta public/img/clientes/' + nombre2x);

  function dimensionesPng(buf) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  const d1 = dimensionesPng(fs.readFileSync(p1x));
  const d2 = dimensionesPng(fs.readFileSync(p2x));
  assert.equal(d2.width, d1.width * 2, nombre2x + ' deberia medir el doble de ancho del 1x');
  assert.equal(d2.height, d1.height * 2, nombre2x + ' deberia medir el doble de alto del 1x');

  // Nunca el original sin procesar (CLAUDE.md): el 2x optimizado debe ser
  // bastante mas chico que el PROVISIONAL que mando Edwin (~41KB).
  const bytes2x = fs.statSync(p2x).size;
  assert.ok(bytes2x < 20000, nombre2x + ' deberia estar optimizado (< 20KB), mide ' + bytes2x + ' bytes');
});
