// fase132-08-logo-mobilize.test.js — Fase 132 (Parte 8): el dashboard de
// MOBILIZE muestra su propio logo en el encabezado (provisional, ver
// docs/pendientes.md). Esta prueba falla si el codigo deja de referenciar
// un archivo de logo que REALMENTE existe en public/img/clientes/ -- no
// alcanza con que el <img> este en el HTML, el archivo tiene que estar ahi.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(PUBLIC_DIR, 'js', 'dashboard-generic.js'), 'utf8');

test('index.html tiene el <img id="gd-cliente-logo"> en el encabezado del dashboard, oculto por defecto', () => {
  const m = html.match(/<img id="gd-cliente-logo"[^>]*>/);
  assert.ok(m, 'falta <img id="gd-cliente-logo"> en public/index.html');
  assert.match(m[0], /display:none/, 'debe empezar oculto (JS lo muestra solo para MOBILIZE)');
  assert.match(m[0], /width="140"/, 'ancho maximo esperado: 140px');
});

test('dashboard-generic.js referencia un logo para MOBILIZE y lo oculta para el resto de clientes', () => {
  assert.match(js, /_gd\.cliente === 'MOBILIZE'/, 'falta el chequeo de cliente MOBILIZE junto al logo');
  const rutaMatch = js.match(/elLogo\.src = '([^']+)'/);
  assert.ok(rutaMatch, 'no se encontro la ruta del logo asignada a elLogo.src');
  assert.equal(rutaMatch[1], 'img/clientes/mobilize-logo.png');
});

test('el archivo del logo de MOBILIZE (1x y 2x) existe de verdad en public/img/clientes/, y el 2x mide el doble', () => {
  const p1x = path.join(PUBLIC_DIR, 'img', 'clientes', 'mobilize-logo.png');
  const p2x = path.join(PUBLIC_DIR, 'img', 'clientes', 'mobilize-logo@2x.png');
  assert.ok(fs.existsSync(p1x), 'falta public/img/clientes/mobilize-logo.png');
  assert.ok(fs.existsSync(p2x), 'falta public/img/clientes/mobilize-logo@2x.png');

  // PNG: ancho/alto en los bytes 16-23 del IHDR (despues de los 8 bytes de
  // firma + "IHDR"), sin depender de ninguna libreria de imagenes.
  function dimensionesPng(buf) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  const d1 = dimensionesPng(fs.readFileSync(p1x));
  const d2 = dimensionesPng(fs.readFileSync(p2x));
  assert.equal(d1.width, 140, 'mobilize-logo.png deberia medir 140px de ancho');
  assert.equal(d2.width, d1.width * 2, 'mobilize-logo@2x.png deberia medir el doble de ancho del 1x');
  assert.equal(d2.height, d1.height * 2, 'mobilize-logo@2x.png deberia medir el doble de alto del 1x');

  // "nunca el original" (CLAUDE.md -- los archivos de marca fuera del repo
  // nunca se commitean tal cual): el optimizado tiene que ser chico, el
  // original que llego (688x124, ~26KB) por lo menos 10x mas grande que
  // la version @2x (280px de ancho).
  const bytes2x = fs.statSync(p2x).size;
  assert.ok(bytes2x < 20000, '@2x deberia estar optimizado (< 20KB), mide ' + bytes2x + ' bytes -- revisar si se copio el original sin optimizar');
});
