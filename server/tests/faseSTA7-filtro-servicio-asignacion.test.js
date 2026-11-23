// faseSTA7-filtro-servicio-asignacion.test.js — pendiente del STA de ORLANT (23/11/2026): en «Asignar»,
// el filtro «Servicio» mostraba opciones que no correspondían (Isa lo vio con Audífonos). Causa: las
// opciones de cada filtro de lista (Entidad, Servicio, Descripción CUPS) salían de TODOS los casos libres,
// sin los demás filtros. Ahora salen en cascada (scripts/orlant/generar-sta.js, 8c). Se prueban las
// funciones REALES del archivo generado en un vm, con casos INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'orlant-sta-app.js'), 'utf8');
// Copia el texto de una función de nivel superior del archivo generado (hasta la siguiente línea de nivel superior).
function fuente(nombre) {
  const i = APP.search(new RegExp('\\nfunction ' + nombre + '\\('));
  assert.ok(i >= 0, 'no está la función ' + nombre);
  const resto = APP.slice(i + 1);
  const fin = resto.slice(1).search(/\n(?:async )?function |\nconst |\nlet |\nROOT\./);
  return resto.slice(0, fin + 1);
}
function crear(casos) {
  const ctx = { S: { casos: Object.fromEntries(casos.map((c, i) => [String(i), Object.assign({ _id: String(i) }, c)])) },
    F: { cant: '', ent: null, serv: null, cups: null, ingD: '', ingH: '', autD: '', autH: '', expD: '', expH: '' },
    MS_CAMPO: { ent: 'Entidad', serv: 'Servicio', cups: 'Descripcion Cups' } };
  vm.createContext(ctx);
  vm.runInContext(['disponibles', 'filtrar', 'opciones', 'msTodos', 'msNormalizar'].map(fuente).join('\n'), ctx);
  return ctx;
}
const C = (ent, serv, cups, extra) => Object.assign({ Entidad: ent, Servicio: serv, 'Descripcion Cups': cups, 'Fecha Ingreso Sta': '2026-11-10' }, extra || {});
const CASOS = [
  C('ENTIDAD A', 'AUDIFONOS', 'CUPS 1'), C('ENTIDAD A', 'AUDIFONOS', 'CUPS 2'), C('ENTIDAD A', 'CONSULTA', 'CUPS 3'),
  C('ENTIDAD B', 'TERAPIA', 'CUPS 4'), C('ENTIDAD B', 'TERAPIA', 'CUPS 4'), C('ENTIDAD B', 'AUDIFONOS', 'CUPS 1', { _agente: 'x' }), // asignado: no cuenta
];

test('sin filtros: cada lista trae lo de todos los casos libres (los asignados no)', () => {
  const x = crear(CASOS);
  assert.deepEqual(JSON.parse(JSON.stringify(x.opciones('Servicio'))), [['AUDIFONOS', 2], ['CONSULTA', 1], ['TERAPIA', 2]]);
  assert.equal(x.filtrar().length, 5);
});

test('con una Entidad elegida, «Servicio» solo ofrece los servicios de esa entidad, con sus conteos', () => {
  const x = crear(CASOS);
  x.F.ent = new Set(['ENTIDAD B']);
  assert.deepEqual(JSON.parse(JSON.stringify(x.opciones('Servicio'))), [['TERAPIA', 2]], 'antes salían AUDIFONOS (2) y CONSULTA (1), que ENTIDAD B no tiene libres');
  assert.deepEqual(JSON.parse(JSON.stringify(x.opciones('Descripcion Cups'))), [['CUPS 4', 2]]);
  // la lista propia NO se recorta por su propio filtro (se puede ampliar la selección)
  assert.deepEqual(JSON.parse(JSON.stringify(x.opciones('Entidad'))), [['ENTIDAD A', 3], ['ENTIDAD B', 2]]);
});

test('y al revés: con un Servicio elegido, «Entidad» solo ofrece las que lo tienen', () => {
  const x = crear(CASOS);
  x.F.serv = new Set(['AUDIFONOS']);
  assert.deepEqual(JSON.parse(JSON.stringify(x.opciones('Entidad'))), [['ENTIDAD A', 2]]);
  assert.equal(x.filtrar().length, 2);
});

test('una opción ya marcada que se queda sin casos se sigue viendo (con 0) para poder quitarla', () => {
  const x = crear(CASOS);
  x.F.serv = new Set(['CONSULTA']);
  x.F.ent = new Set(['ENTIDAD B']);
  assert.deepEqual(JSON.parse(JSON.stringify(x.opciones('Servicio'))), [['CONSULTA', 0], ['TERAPIA', 2]]);
  assert.equal(x.filtrar().length, 0);
});

test('msNormalizar: «Todos» solo si están marcados exactamente los visibles (no por tener el mismo tamaño)', () => {
  const x = crear(CASOS);
  x.F.ent = new Set(['ENTIDAD A']);
  x.F.serv = new Set(['AUDIFONOS', 'TERAPIA']); // 2 marcados; visibles para ENTIDAD A: AUDIFONOS y CONSULTA
  x.msNormalizar('serv');
  assert.ok(x.F.serv, 'no se vuelve «Todos»: CONSULTA no está marcado');
  x.F.serv = new Set(['AUDIFONOS', 'CONSULTA']);
  x.msNormalizar('serv');
  assert.equal(x.F.serv, null);
});

test('el generador mantiene la cascada (la prueba guardiana falla si el HTML de Edwin cambia ahí)', () => {
  const gen = fs.readFileSync(path.join(__dirname, '..', '..', 'scripts', 'orlant', 'generar-sta.js'), 'utf8');
  assert.match(gen, /8c\) Asignar, filtros Entidad/);
  assert.match(APP, /function filtrar\(sin\)/);
  assert.match(APP, /filtrar\(k\)\.forEach/);
});
