// efectividad-agendamiento-logic.test.js — Fase 111 (ORLANT, pedido de
// Edwin: "el ranking va a ser efectividad por agendamiento"). Logica PURA
// de parseo de EFECTIVIDAD_AGENDAMIENTO.xlsx (public/js/
// efectividad-agendamiento-logic.js). Datos SIEMPRE inventados -- los 2
// valores de control del archivo real de Edwin (1er y ultimo puesto, Sep-26)
// se usan como EJEMPLO numerico (ya los dio el propio Edwin/InCo como
// control de verificacion), nunca el archivo ni el resto de los nombres
// reales.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  EFECTIVIDAD_AGENDAMIENTO_COLUMNAS,
  EFECTIVIDAD_AGENDAMIENTO_ORDEN_ARRAY,
  efectividadAgendamientoColIndexMap,
  efectividadAgendamientoParseFilas,
  efectividadAgendamientoFilaComoArray,
  efectividadAgendamientoFmtPct,
  efectividadAgendamientoMesesDelArchivo,
} = require('../../public/js/efectividad-agendamiento-logic.js');

const HOY = new Date('2026-10-01T12:00:00Z'); // "hoy" Colombia = 2026-09-30

const HEADER = ['NOMBRE DE AGENTE', 'MES', 'CANTIDAD DE GESTIONES', 'AGENDAS', 'EFECTIVIDAD'];

test('efectividadAgendamientoColIndexMap: ubica las 5 columnas por nombre exacto', () => {
  const map = efectividadAgendamientoColIndexMap(HEADER);
  assert.deepEqual(map, { asesor: 0, mes: 1, gestiones: 2, agendas: 3, efectividadArchivo: 4 });
});

test('EFECTIVIDAD_AGENDAMIENTO_COLUMNAS: EFECTIVIDAD no es obligatoria y va oculta en la plantilla', () => {
  const ef = EFECTIVIDAD_AGENDAMIENTO_COLUMNAS.find((c) => c.key === 'efectividadArchivo');
  assert.equal(ef.obligatoria, false);
  assert.equal(ef.ocultaEnPlantilla, true);
});

test('falta una columna obligatoria -> error claro', () => {
  const r = efectividadAgendamientoParseFilas([['NOMBRE DE AGENTE', 'MES', 'AGENDAS']], HOY);
  assert.ok(r.error);
  assert.match(r.error, /CANTIDAD DE GESTIONES/);
});

test('los encabezados no tienen que estar en la fila 1 del Excel -- aoa[0] es SIEMPRE la fila de encabezados, sea cual sea su fila real en el archivo original (el archivo real de Edwin trae sus 2 primeras filas de Excel totalmente vacias -- sin ninguna celda -- y los encabezados en la fila 3; SheetJS arma `aoa` a partir del RANGO USADO de la hoja -- `!ref` -- asi que aoa[0] ya es esa fila, confirmado contra el archivo real fuera del repo)', () => {
  const aoa = [HEADER, ['Asesor Fila3', 'SEPTIEMBRE', 379, 369, 369 / 379]];
  const r = efectividadAgendamientoParseFilas(aoa, HOY);
  assert.equal(r.error, undefined);
  assert.equal(r.filas.length, 1);
  assert.equal(r.filas[0].asesor, 'Asesor Fila3');
  assert.equal(r.filas[0].mes, '2026-09');
});

test('MES sin año (nombre en español) se infiere con mesNombreAAAAMM -- SEPTIEMBRE -> 2026-09', () => {
  const aoa = [HEADER, ['Asesor Uno', 'SEPTIEMBRE', 100, 50, 0.5]];
  const r = efectividadAgendamientoParseFilas(aoa, HOY);
  assert.equal(r.filas[0].mes, '2026-09');
});

test('EFECTIVIDAD nunca se guarda -- la fila resultante solo trae mes/asesor/gestiones/agendas', () => {
  const aoa = [HEADER, ['Asesor Uno', 'SEPTIEMBRE', 100, 50, 0.5]];
  const r = efectividadAgendamientoParseFilas(aoa, HOY);
  assert.deepEqual(Object.keys(r.filas[0]).sort(), ['agendas', 'asesor', 'gestiones', 'mes']);
});

test('EFECTIVIDAD del archivo coincide con el recalculo -> sin advertencia', () => {
  const aoa = [HEADER, ['Asesor Uno', 'SEPTIEMBRE', 379, 369, 369 / 379]];
  const r = efectividadAgendamientoParseFilas(aoa, HOY);
  assert.equal(r.advertenciasEfectividad.length, 0);
});

test('EFECTIVIDAD del archivo NO coincide con el recalculo -> advertencia explicita, sin bloquear la carga', () => {
  const aoa = [HEADER, ['Asesor Uno', 'SEPTIEMBRE', 100, 50, 0.9]]; // real: 50/100=50%, archivo dice 90%
  const r = efectividadAgendamientoParseFilas(aoa, HOY);
  assert.equal(r.filas.length, 1); // se carga igual, con el recalculo
  assert.equal(r.advertenciasEfectividad.length, 1);
  assert.match(r.advertenciasEfectividad[0], /Asesor Uno/);
  assert.match(r.advertenciasEfectividad[0], /90/);
  assert.match(r.advertenciasEfectividad[0], /50/);
});

test('una fila "_falla" nunca se funde con el asesor real del mismo nombre base -- queda tal cual, como una fila distinta', () => {
  const aoa = [
    HEADER,
    ['MICHELL GARCIA SERNA', 'SEPTIEMBRE', 1002, 965, 965 / 1002],
    ['MICHELL GARCIA SERNA_falla', 'SEPTIEMBRE', 494, 254, 254 / 494],
  ];
  const r = efectividadAgendamientoParseFilas(aoa, HOY);
  assert.equal(r.filas.length, 2);
  assert.equal(r.filas[0].asesor, 'MICHELL GARCIA SERNA');
  assert.equal(r.filas[1].asesor, 'MICHELL GARCIA SERNA_falla');
});

test('fila sin NOMBRE DE AGENTE se omite con un aviso', () => {
  const aoa = [HEADER, ['', 'SEPTIEMBRE', 100, 50, 0.5]];
  const r = efectividadAgendamientoParseFilas(aoa, HOY);
  assert.equal(r.filas.length, 0);
  assert.equal(r.avisos.length, 1);
});

test('fila con MES no reconocido se omite con un aviso', () => {
  const aoa = [HEADER, ['Asesor Uno', 'MESINVENTADO', 100, 50, 0.5]];
  const r = efectividadAgendamientoParseFilas(aoa, HOY);
  assert.equal(r.filas.length, 0);
  assert.match(r.avisos[0], /MES/);
});

test('fila con GESTIONES/AGENDAS invalido (texto, negativo) se omite con un aviso', () => {
  const aoa = [HEADER, ['Asesor Uno', 'SEPTIEMBRE', 'no-es-numero', 50, 0.5]];
  const r = efectividadAgendamientoParseFilas(aoa, HOY);
  assert.equal(r.filas.length, 0);
  assert.equal(r.avisos.length, 1);
});

test('fila completamente vacia (fila en blanco en el Excel) se ignora sin generar aviso', () => {
  const aoa = [HEADER, [null, null, null, null, null], ['Asesor Uno', 'SEPTIEMBRE', 100, 50, 0.5]];
  const r = efectividadAgendamientoParseFilas(aoa, HOY);
  assert.equal(r.filas.length, 1);
  assert.equal(r.avisos.length, 0);
});

test('efectividadAgendamientoFilaComoArray respeta EFECTIVIDAD_AGENDAMIENTO_ORDEN_ARRAY (mes, asesor, gestiones, agendas)', () => {
  const f = { mes: '2026-09', asesor: 'Asesor Uno', gestiones: 100, agendas: 50 };
  assert.deepEqual(efectividadAgendamientoFilaComoArray(f), ['2026-09', 'Asesor Uno', 100, 50]);
  assert.deepEqual(EFECTIVIDAD_AGENDAMIENTO_ORDEN_ARRAY, ['mes', 'asesor', 'gestiones', 'agendas']);
});

test('efectividadAgendamientoFmtPct: 2 decimales y coma -- control real (97,36 %, 44,81 %, 12,18 %)', () => {
  assert.equal(efectividadAgendamientoFmtPct(369 / 379), '97,36 %');
  assert.equal(efectividadAgendamientoFmtPct(8319 / 18566), '44,81 %');
  assert.equal(efectividadAgendamientoFmtPct(254 / 2086), '12,18 %');
  assert.equal(efectividadAgendamientoFmtPct(null), '—');
  assert.equal(efectividadAgendamientoFmtPct(undefined), '—');
});

test('efectividadAgendamientoMesesDelArchivo: meses distintos, ordenados, sin duplicados', () => {
  const filas = [
    { mes: '2026-09', asesor: 'A' },
    { mes: '2026-08', asesor: 'B' },
    { mes: '2026-09', asesor: 'C' },
  ];
  assert.deepEqual(efectividadAgendamientoMesesDelArchivo(filas), ['2026-08', '2026-09']);
});
