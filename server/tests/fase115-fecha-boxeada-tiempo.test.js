// fase115-fecha-boxeada-tiempo.test.js — Fase 115 (hallazgo real, archivo
// de ORLANT ago-sep/2026): WAIT_TIME/AHT llegan como celda de HORA nativa
// de Excel ("h:mm:ss"). SheetJS, leido con cellNF:true (necesario para la
// clasificacion de % de la Fase 88), convierte esas celdas numericas a un
// objeto Date dentro de XLSX.utils.sheet_to_json(ws,{header:1}) -- nunca en
// el worksheet crudo `ws`, que siempre conserva el numero original (la
// fraccion de dia). Esa conversion de SheetJS resulto depender de la ZONA
// HORARIA de quien sube el archivo: verificado a mano que con TZ=UTC el
// Date queda exacto, pero con America/Bogota (la zona de la maquina que
// sube el archivo real) el Date queda corrido por la hora solar media
// historica de Bogota (-4:56:16, vigente antes de 1914, que V8 todavia
// aplica a fechas de 1899) -- sin este arreglo, WAIT_TIME/AHT se leian
// como null en toda fila con esa celda en formato de hora real (confirmado
// en produccion: los 150 registros de agosto-septiembre/2026 de ORLANT
// subieron con AHT/WAIT_TIME en null antes de este fix).
//
// traficoValorCrudoSiFechaBoxeada recupera el numero original leyendo la
// celda CRUDA (`ws`), el mismo patron que ya usa traficoClasificarCeldaNumerica
// (Fase 88) -- nunca intenta "deshacer" la conversion de SheetJS (seria
// fragil, depende de la zona horaria de quien suba el archivo).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  TRAFICO_COLUMNAS,
  traficoCeldaRef,
  traficoValorCrudoSiFechaBoxeada,
  traficoParseFilas,
} = require('../../public/js/trafico-logic.js');

const HEADER = TRAFICO_COLUMNAS.map((c) => c.label);
const IDX = {};
TRAFICO_COLUMNAS.forEach((c, i) => { IDX[c.key] = i; });

function filaBase(over) {
  const row = new Array(HEADER.length).fill(null);
  row[IDX.skillName] = 'CALL INBOUND ORLANT 3P';
  row[IDX.fecha] = '2026-08-15';
  row[IDX.totalLlamadas] = 100;
  row[IDX.contestadas] = 90;
  Object.keys(over || {}).forEach((k) => { row[IDX[k]] = over[k]; });
  return row;
}

// Un Date "boxeado" cualquiera (no importa el desfase exacto -- la funcion
// nunca confia en su valor, siempre recupera el numero real desde `ws`).
const FECHA_BOXEADA_CUALQUIERA = new Date('1899-12-31T04:58:50.000Z');

test('traficoValorCrudoSiFechaBoxeada: Date + ws con la celda cruda numerica -> recupera el numero real (ignora el Date)', () => {
  const ws = { B2: { t: 'n', v: 0.0017824074074074075 } };
  assert.equal(traficoValorCrudoSiFechaBoxeada(FECHA_BOXEADA_CUALQUIERA, ws, 1, 1), 0.0017824074074074075);
});

test('traficoValorCrudoSiFechaBoxeada: sin ws -- devuelve el Date tal cual (no hay de donde recuperar el numero)', () => {
  assert.equal(traficoValorCrudoSiFechaBoxeada(FECHA_BOXEADA_CUALQUIERA, null, 1, 1), FECHA_BOXEADA_CUALQUIERA);
});

test('traficoValorCrudoSiFechaBoxeada: la celda cruda no es numerica -- devuelve el Date tal cual (nunca inventa un numero)', () => {
  const ws = { B2: { t: 's', v: 'texto' } };
  assert.equal(traficoValorCrudoSiFechaBoxeada(FECHA_BOXEADA_CUALQUIERA, ws, 1, 1), FECHA_BOXEADA_CUALQUIERA);
});

test('traficoValorCrudoSiFechaBoxeada: un valor que NO es Date (numero normal) -- se devuelve sin tocar, aunque haya ws', () => {
  const ws = { B2: { t: 'n', v: 999 } };
  assert.equal(traficoValorCrudoSiFechaBoxeada(42, ws, 1, 1), 42);
});

test('traficoParseFilas: WAIT_TIME/AHT boxeados como Date por SheetJS -- con `ws`, se recupera el segundo real (154s = 0:02:34, caso real de ORLANT 2026-08-01 3P)', () => {
  const fila = filaBase({ waitTimeSegundos: FECHA_BOXEADA_CUALQUIERA, ahtSegundos: FECHA_BOXEADA_CUALQUIERA });
  const aoa = [HEADER, fila];
  const ws = {
    [traficoCeldaRef(1, IDX.waitTimeSegundos)]: { t: 'n', v: 0.00005787037037037037 }, // 5s
    [traficoCeldaRef(1, IDX.ahtSegundos)]: { t: 'n', v: 0.0017824074074074075 }, // 154s
  };
  const res = traficoParseFilas(aoa, ws);
  assert.ok(!res.error, JSON.stringify(res));
  assert.equal(res.filas[0].waitTimeSegundos, 5);
  assert.equal(res.filas[0].ahtSegundos, 154);
});

test('traficoParseFilas: WAIT_TIME/AHT boxeados como Date, sin `ws` -- se descarta el dato (null), no se inventa un numero fragil dependiente de zona horaria', () => {
  const fila = filaBase({ waitTimeSegundos: FECHA_BOXEADA_CUALQUIERA, ahtSegundos: FECHA_BOXEADA_CUALQUIERA });
  const aoa = [HEADER, fila];
  const res = traficoParseFilas(aoa); // sin ws
  assert.ok(!res.error, JSON.stringify(res));
  assert.equal(res.filas[0].waitTimeSegundos, undefined);
  assert.equal(res.filas[0].ahtSegundos, undefined);
});

test('traficoParseFilas: WAIT_TIME/AHT como numero normal (no boxeado) sigue funcionando exactamente igual, con o sin `ws`', () => {
  const fila = filaBase({ waitTimeSegundos: 0.00005787037037037037, ahtSegundos: 0.0017824074074074075 });
  const aoa = [HEADER, fila];
  const sinWs = traficoParseFilas(aoa);
  assert.equal(sinWs.filas[0].waitTimeSegundos, 5);
  assert.equal(sinWs.filas[0].ahtSegundos, 154);
  const ws = {
    [traficoCeldaRef(1, IDX.waitTimeSegundos)]: { t: 'n', v: 0.00005787037037037037 },
    [traficoCeldaRef(1, IDX.ahtSegundos)]: { t: 'n', v: 0.0017824074074074075 },
  };
  const conWs = traficoParseFilas(aoa, ws);
  assert.equal(conWs.filas[0].waitTimeSegundos, 5);
  assert.equal(conWs.filas[0].ahtSegundos, 154);
});
