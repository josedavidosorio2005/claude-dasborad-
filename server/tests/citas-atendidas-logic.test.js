// citas-atendidas-logic.test.js — Fase 111 (ORLANT, pedido textual de
// InCo). Logica PURA de public/js/citas-atendidas-logic.js. Los numeros de
// control (Ene-26 a Mar-26, ya dados por Edwin/InCo) se usan como EJEMPLO
// numerico en pruebas dedicadas.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  CITAS_ATENDIDAS_COLUMNAS,
  CITAS_ATENDIDAS_ORDEN_ARRAY,
  citasAtendidasColIndexMap,
  citasAtendidasParseFilas,
  citasAtendidasFilaComoArray,
  citasAtendidasMesesDelArchivo,
  citasAtendidasMesLbl,
  citasAtendidasFmtPct,
  citasAtendidasPonderado,
  citasAtendidasRangoLbl,
} = require('../../public/js/citas-atendidas-logic.js');

const HOY = new Date('2026-10-01T12:00:00Z'); // "hoy" Colombia = 2026-09-30

const HEADER = ['MES', 'AGENDAS', 'ATENDIDAS', 'EFECTIVIDAD CITAS ATENDIDAS'];

test('citasAtendidasColIndexMap: ubica las 4 columnas por nombre exacto', () => {
  const map = citasAtendidasColIndexMap(HEADER);
  assert.deepEqual(map, { mes: 0, agendas: 1, atendidas: 2, efectividadArchivo: 3 });
});

test('CITAS_ATENDIDAS_COLUMNAS: EFECTIVIDAD CITAS ATENDIDAS no es obligatoria y va oculta en la plantilla', () => {
  const ef = CITAS_ATENDIDAS_COLUMNAS.find((c) => c.key === 'efectividadArchivo');
  assert.equal(ef.obligatoria, false);
  assert.equal(ef.ocultaEnPlantilla, true);
});

test('falta una columna obligatoria -> error claro', () => {
  const r = citasAtendidasParseFilas([['MES', 'AGENDAS']], HOY);
  assert.ok(r.error);
  assert.match(r.error, /ATENDIDAS/);
});

test('los encabezados no tienen que estar en la fila 1 del Excel -- aoa[0] es SIEMPRE la fila de encabezados (el archivo real de Edwin trae sus 2 primeras filas totalmente vacias, encabezados en la fila 3)', () => {
  const aoa = [HEADER, ['ENERO', 158, 148, 148 / 158]];
  const r = citasAtendidasParseFilas(aoa, HOY);
  assert.equal(r.error, undefined);
  assert.equal(r.filas.length, 1);
  assert.equal(r.filas[0].mes, '2026-01');
});

test('EFECTIVIDAD CITAS ATENDIDAS nunca se guarda -- la fila resultante solo trae mes/agendas/atendidas', () => {
  const aoa = [HEADER, ['ENERO', 158, 148, 148 / 158]];
  const r = citasAtendidasParseFilas(aoa, HOY);
  assert.deepEqual(Object.keys(r.filas[0]).sort(), ['agendas', 'atendidas', 'mes']);
});

test('EFECTIVIDAD del archivo NO coincide con el recalculo -> advertencia explicita, sin bloquear la carga', () => {
  const aoa = [HEADER, ['ENERO', 100, 50, 0.9]]; // real: 50/100=50%, archivo dice 90%
  const r = citasAtendidasParseFilas(aoa, HOY);
  assert.equal(r.filas.length, 1);
  assert.equal(r.advertenciasEfectividad.length, 1);
  assert.match(r.advertenciasEfectividad[0], /90/);
  assert.match(r.advertenciasEfectividad[0], /50/);
});

test('fila con MES no reconocido se omite con un aviso', () => {
  const aoa = [HEADER, ['MESINVENTADO', 100, 50, 0.5]];
  const r = citasAtendidasParseFilas(aoa, HOY);
  assert.equal(r.filas.length, 0);
  assert.match(r.avisos[0], /MES/);
});

test('fila completamente vacia se ignora sin generar aviso', () => {
  const aoa = [HEADER, [null, null, null, null], ['ENERO', 158, 148, 0.9367]];
  const r = citasAtendidasParseFilas(aoa, HOY);
  assert.equal(r.filas.length, 1);
  assert.equal(r.avisos.length, 0);
});

test('citasAtendidasFilaComoArray respeta CITAS_ATENDIDAS_ORDEN_ARRAY (mes, agendas, atendidas)', () => {
  const f = { mes: '2026-01', agendas: 158, atendidas: 148 };
  assert.deepEqual(citasAtendidasFilaComoArray(f), ['2026-01', 158, 148]);
  assert.deepEqual(CITAS_ATENDIDAS_ORDEN_ARRAY, ['mes', 'agendas', 'atendidas']);
});

test('citasAtendidasMesesDelArchivo: meses distintos, ordenados, sin duplicados', () => {
  const filas = [{ mes: '2026-03' }, { mes: '2026-01' }, { mes: '2026-03' }];
  assert.deepEqual(citasAtendidasMesesDelArchivo(filas), ['2026-01', '2026-03']);
});

test('citasAtendidasMesLbl: "AAAA-MM" -> "Mes-AA" corto', () => {
  assert.equal(citasAtendidasMesLbl('2026-01'), 'Ene-26');
  assert.equal(citasAtendidasMesLbl('2026-03'), 'Mar-26');
});

test('citasAtendidasFmtPct: 2 decimales y coma -- control real (93,67 %, 84,32 %, 85,54 %, 86,01 %)', () => {
  assert.equal(citasAtendidasFmtPct(148 / 158), '93,67 %');
  assert.equal(citasAtendidasFmtPct(527 / 625), '84,32 %');
  assert.equal(citasAtendidasFmtPct(278 / 325), '85,54 %');
  assert.equal(citasAtendidasFmtPct(953 / 1108), '86,01 %');
  assert.equal(citasAtendidasFmtPct(null), '—');
});

test('control real Ene-26 a Mar-26 (dado por Edwin/InCo): ponderado 86,01 % (1.108/953), nunca el promedio simple de los 3 meses', () => {
  const filas = [
    { mes: '2026-01', agendas: 158, atendidas: 148 },
    { mes: '2026-02', agendas: 625, atendidas: 527 },
    { mes: '2026-03', agendas: 325, atendidas: 278 },
  ];
  const ponderado = citasAtendidasPonderado(filas);
  assert.equal(ponderado.agendas, 1108);
  assert.equal(ponderado.atendidas, 953);
  assert.equal(citasAtendidasFmtPct(ponderado.pct), '86,01 %');

  const promedioSimple = (148 / 158 + 527 / 625 + 278 / 325) / 3;
  assert.notEqual(Math.round(promedioSimple * 10000) / 10000, Math.round(ponderado.pct * 10000) / 10000);

  assert.equal(citasAtendidasRangoLbl(filas), 'Ene-26 a Mar-26');
});

test('citasAtendidasRangoLbl: un solo mes -> solo ese mes (sin "a"); sin filas -> cadena vacia', () => {
  assert.equal(citasAtendidasRangoLbl([{ mes: '2026-01' }]), 'Ene-26');
  assert.equal(citasAtendidasRangoLbl([]), '');
});

test('citasAtendidasPonderado: sin filas -> pct null (nunca 0 falso)', () => {
  const p = citasAtendidasPonderado([]);
  assert.equal(p.agendas, 0);
  assert.equal(p.atendidas, 0);
  assert.equal(p.pct, null);
});
