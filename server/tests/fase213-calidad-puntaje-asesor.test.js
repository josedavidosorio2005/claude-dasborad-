// fase213-calidad-puntaje-asesor.test.js — Fase 213 (pedido de Edwin, 29/10, Calidad ORLANT).
// 1) Carga masiva: las filas vacias de la plantilla (solo formulas, sin asesor,
//    sin fecha y sin items) se saltan sin aviso; una fila con algo y sin asesor
//    sigue avisando.
// 2) "Promedio de calidad por asesor": promedio del EQUIPO = el de todos los
//    monitoreos (decision del usuario) como linea, y cada asesor por encima (▲)
//    o por debajo (▼). Datos SIEMPRE inventados.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const L = require('../../public/js/calidad-carga-masiva-logic.js');
const D = require('../../public/js/calidad-dashboard-logic.js');

const ITEMS = [
  { n: 1, cat: 'APERTURA', label: 'Guion de saludo', weight: 60, critico: false },
  { n: 2, cat: 'GESTION', label: 'Agendamiento correcto / Servinte', weight: 40, critico: true },
];

test('carga masiva: filas vacias con formulas se saltan sin aviso', () => {
  const aoa = [
    ['PLANTILLA DE CALIDAD'],
    ['SI = cumple'],
    ['INFORMACIÓN GENERAL', null, null, null, null, null, 'APERTURA', 'GESTIÓN', 'PUNTAJE'],
    ['Nombre del Asesor', 'Fecha', 'ID / Llamada - Wpp', '# Teléfono', 'Codificación', 'Evaluador', '1. Guion de saludo (60%)', '⚠️ 2. Agendamiento correcto / Servinte (40%)', 'PUNTAJE OBTENIDO'],
    ['Asesor Demo Uno', '2026-10-05', 'ID-1', '3000000000', 'X', 'Evaluador Demo', 'SI', 'SI', 100],
    ['Asesor Demo Dos', '2026-10-06', 'ID-2', '3000000001', 'X', 'Evaluador Demo', 'SI', 'NO', 40],
    [null, null, null, null, null, null, null, null, ''],          // vacia con formula: sin aviso
    [null, null, null, null, null, null, null, null, '—'],         // vacia con formula: sin aviso
    [null, '2026-10-07', null, null, null, null, 'SI', null, 60],  // algo cargado sin asesor: aviso
  ];
  const r = L.cmParseRows(aoa, ITEMS);
  assert.equal(r.error, undefined, r.error);
  assert.equal(r.filas.length, 2);
  assert.deepEqual(r.avisos, ['Fila 9: ASESOR vacio, se omitio.']);
});

test('promedio del equipo = todos los monitoreos; por encima/por debajo sin redondear', () => {
  const m = (asesor, puntaje) => ({ asesor, puntaje });
  // A: 100, 100 (100) · B: 90 (90) · C: 94, 96 (95). Equipo: (100+100+90+94+96)/5 = 96.
  // Promedio de promedios seria (100+90+95)/3 = 95: NO es el que se usa.
  const r = D.calDashPuntajeVsEquipo([m('A', 100), m('A', 100), m('B', 90), m('C', 94), m('C', 96)]);
  assert.equal(r.equipo, 96);
  assert.deepEqual(r.filas, [
    { asesor: 'A', promedio: 100, encima: true },
    { asesor: 'C', promedio: 95, encima: false },
    { asesor: 'B', promedio: 90, encima: false },
  ]);
  assert.deepEqual([r.encima, r.debajo], [1, 2]);
  // Igual al promedio cuenta como "por encima".
  assert.equal(D.calDashPuntajeVsEquipo([m('X', 90), m('Y', 90)]).filas.every((f) => f.encima), true);
  assert.deepEqual(D.calDashPuntajeVsEquipo([]), { equipo: null, filas: [], encima: 0, debajo: 0 });
});

test('la grafica trae la linea del equipo, ▲/▼ y la nota; el export por asesor sigue fuera (Fase 130)', () => {
  const gen = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'dashboard-generic.js'), 'utf8');
  const bloque = gen.slice(gen.indexOf("if(p.tipo === 'calidad_bar_asesores'){"), gen.indexOf('// calidad_pie — clasificacion'));
  assert.match(bloque, /var vsEquipo = calDashPuntajeVsEquipo\(arr\);/);
  assert.match(bloque, /type:'line', label:'Promedio del equipo'/);
  assert.match(bloque, /'Promedio del equipo \(todos los monitoreos\): '/);
  assert.match(bloque, /encima \? '▲' : '▼'/);
  assert.ok(!/cuentas|monitoreos por asesor/i.test(bloque.replace('todos los monitoreos', '')), 'nunca el numero de monitoreos por asesor');
  assert.match(gen, /if\(p\.tipo === 'calidad_bar_asesores'\)\{ continue; \}/);
});
