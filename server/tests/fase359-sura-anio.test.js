// fase359-sura-anio.test.js — Fase 359 (pedido de Edwin, 17/11): filtro por año en Televentas (SURA).
// Con bases INVENTADAS de 2026 y 2027 (Shadow DOM falso): el año elegido no mezcla meses, la carga
// usa el año elegido, y el cambio va en el generador y en el tablero publicado (no en el HTML).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const A = require('../../public/js/sura-televentas-anio.js');
const ROOT_REPO = path.join(__dirname, '..', '..');
const APP = fs.readFileSync(path.join(ROOT_REPO, 'public', 'js', 'sura-televentas-app.js'), 'utf8');
const GEN = fs.readFileSync(path.join(ROOT_REPO, 'scripts', 'sura', 'generar-televentas.js'), 'utf8');

test('años del selector: con datos + el actual; por defecto el más reciente con datos', () => {
  assert.deepEqual(A.stvAniosOpciones(['2026'], 2026), [2026]);
  assert.deepEqual(A.stvAniosOpciones(['2026', '2027'], 2027), [2027, 2026]);
  assert.deepEqual(A.stvAniosOpciones(['2026'], 2027), [2027, 2026], 'el año nuevo aparece aunque no tenga bases');
  assert.equal(A.stvAnioPorDefecto(['2026', '2027'], 2027), 2027);
  assert.equal(A.stvAnioPorDefecto(['2026'], 2027), 2026, 'el más reciente CON DATOS, no el del calendario');
  assert.equal(A.stvAnioPorDefecto([], 2027), 2027);
  assert.equal(A.stvAnioActual(new Date('2027-01-01T03:00:00Z')), 2026, '31/12 a las 10 p. m. en Colombia sigue siendo 2026');
});

test('tablero publicado: año elegible, MK() del año y MKT() con toda la historia', () => {
  assert.match(APP, /let YEAR=2026; \/\/ Fase 359/);
  assert.doesNotMatch(APP, /const YEAR=2026/);
  assert.match(APP, /const MKT=\(\)=>Object\.keys\(DB\)\.filter\(k=>!k\.startsWith\("__"\)\)\.sort\(\),MK=\(\)=>MKT\(\)\.filter\(k=>k\.startsWith\(YEAR\+"-"\)\),MKF=/);
  assert.match(APP, /function agFixDB\(\)\{for\(const k of MKT\(\)\)\{/);
  assert.match(APP, /return \{ cargar: cargar, anios: anios, anio: anio, leer:/);
});

test('generador: los mismos reemplazos (para la próxima regeneración desde el HTML de Edwin)', () => {
  for (const s of ["X('const YEAR=2026;', 'let YEAR=2026;", 'MK=()=>MKT().filter(k=>k.startsWith(YEAR+\\"-\\"))', "X('function agFixDB(){for(const k of MK()){'", 'function anios(){return [...new Set(MKT()', 'return { cargar: cargar, anios: anios, anio: anio, leer:']) {
    assert.ok(GEN.includes(s.replace(/\\"/g, '"')), s);
  }
});

// Ejecuta MK/MKF/anios/anio del tablero real sobre un DB inventado, sin DOM: se recorta el bloque
// de las funciones de meses del archivo publicado.
test('con bases de 2026 y 2027: cada año ve solo sus meses', () => {
  const i = APP.indexOf('let YEAR=2026;');
  const j = APP.indexOf('const MKT=');
  const k = APP.indexOf('\n', j);
  const codigo = 'const MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];' +
    APP.slice(i, APP.indexOf('\n', i)) + '\nlet DB={"2026-11":{},"2026-12":{},"2027-01":{},"__metas":{}};let VOFF=new Set(),MOFF=new Set();\n' + APP.slice(j, k) +
    '\nfunction anios(){return [...new Set(MKT().map(k=>k.slice(0,4)))].sort()}' +
    '\nreturn {MK,MKF,MKT,mname,anios,set:(a)=>{YEAR=a}};';
  const f = new Function(codigo)();
  assert.deepEqual(f.anios(), ['2026', '2027']);
  assert.deepEqual(f.MK(), ['2026-11', '2026-12']);
  f.set(2027);
  assert.deepEqual(f.MK(), ['2027-01']);
  assert.deepEqual(f.MKF(), ['2027-01']);
  assert.deepEqual(f.MKT(), ['2026-11', '2026-12', '2027-01'], 'la historia completa sigue disponible');
  assert.equal(f.mname('2027-01'), 'Enero');
});

test('encabezado: selector «Año» (oculto hasta cargar), script y Centro de cargas', () => {
  const index = fs.readFileSync(path.join(ROOT_REPO, 'public', 'index.html'), 'utf8');
  assert.match(index, /<span class="stv-anio hidden" id="stv-anio-wrap"><label for="stv-anio">Año<\/label><select id="stv-anio" onchange="stvCambiarAnio\(this\.value\)">/);
  assert.ok(index.indexOf('js/sura-televentas-anio.js') > 0);
  const w = fs.readFileSync(path.join(ROOT_REPO, 'public', 'js', 'sura-televentas.js'), 'utf8');
  assert.match(w, /stvAnioPreparar\(_stv\.app, document\.getElementById\('stv-anio'\)/);
  assert.match(w, /stvAnioPreparar\(_stvCarga\.app, wrap\.querySelector\('select'\), wrap\)/);
});
