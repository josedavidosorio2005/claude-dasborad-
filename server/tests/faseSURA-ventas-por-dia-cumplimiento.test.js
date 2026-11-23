// faseSURA-ventas-por-dia-cumplimiento.test.js — pedido 5 de Edwin (reunión 23/11/2026; lo pregunta el
// cliente SURA): en Cumplimiento › «📅 Ventas por mes», «Ver por: Mes / Día». Con «Día», las ventas del
// mes elegido día a día por fecha_venta, con los mismos filtros de la sección. Va por el generador
// (scripts/sura/generar-televentas.js, regla de la Fase 360); la hoja de estilos no cambia (Fase 345).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const gen = fs.readFileSync(path.join(RAIZ, 'scripts', 'sura', 'generar-televentas.js'), 'utf8');
const app = fs.readFileSync(path.join(RAIZ, 'public', 'js', 'sura-televentas-app.js'), 'utf8');

test('el tablero publicado trae «Ver por: Mes / Día» en Ventas por mes de Cumplimiento', () => {
  assert.ok(app.includes('<label>Ver por<select id=\\"g4p\\"><option value=\\"m\\">Mes</option><option value=\\"d\\">Día</option></select></label><label id=\\"g4ml\\" hidden>Mes<select id=\\"g4mes\\"></select></label><label>Agente<select id=\\"ga\\"></select></label>'));
  assert.match(app, /function draw4\(\)\{if\(\$\("g4p"\)\.value==="d"\)return draw4dia\(\);\$\("g4ml"\)\.hidden=true;/);
  assert.match(app, /\["g4p","g4mes"\]\.forEach\(i=>\$\(i\)\.addEventListener\("change",draw4\)\);/);
});

test('por día usa fecha_venta (r[1]) del mes elegido y los mismos filtros (rows(true) + geoOK); textos con esc', () => {
  assert.match(app, /function draw4dia\(\)\{const a=\$\("ga"\)\.value\|\|"__total",med=\$\("gm"\)\.value,R=rows\(true\)\.filter\(geoOK\)/);
  assert.match(app, /const RM=cur\?R\.filter\(r=>String\(r\[1\]\|\|""\)\.startsWith\(cur\)\):\[\];/);
  assert.match(app, /<option value="\$\{esc\(k\)\}" \$\{k===cur\?"selected":""\}>\$\{esc\(mname\(k\)\+" "\+k\.slice\(0,4\)\)\}<\/option>/);
  assert.match(app, /<td>\$\{esc\(s\.n\)\}<\/td>/);
});

test('va por el generador (no a mano)', () => {
  assert.match(gen, /Pedido de Edwin \(reunión 23\/11\/2026; lo pregunta el cliente\)/);
  assert.ok(gen.includes("'function draw4(){if($(\"g4p\").value===\"d\")return draw4dia();$(\"g4ml\").hidden=true;'"));
});
