// fase122-agendas-fecha-boxeada.test.js — Fase 122 (hallazgo real contra el
// archivo AGENDAS_DE_AGOSTO_Y_SEPTIEMBRE.xlsx de Edwin): FECHA_SOLICITUD ahi
// es una celda NUMERICA con formato de fecha ("dd/mm/yyyy") -- con
// cellNF:true (necesario para que Trafico detecte el % real, cargas.js)
// SheetJS la convierte a un objeto Date dentro de
// XLSX.utils.sheet_to_json(ws,{header:1}), igual que WAIT_TIME/AHT en
// Trafico (Fase 115) y DATE en Tipificacion (Fase 116). SIN este fix,
// agendasParseFilas nunca recibia `ws` y rechazaba el archivo COMPLETO
// (ninguna fila valida) -- confirmado corriendo este mismo parser contra el
// archivo real (solo estructura, nunca datos de pacientes): 24.186/24.186
// filas rechazadas antes del fix, 0 despues.
//
// Datos SIEMPRE inventados en este archivo (nunca el archivo real).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  agendasCeldaRef,
  agendasValorCrudoSiFechaBoxeada,
  agendasParseFilas,
  agendasColIndexMap,
} = require('../../public/js/agendas-logic.js');

const HEADER = ['NOMBRE DE AGENTE', 'SEDE', 'NOMBRE_EXAMEN', 'ESPECIALIDAD', 'PROFESIONAL', 'FECHA_SOLICITUD', 'NOMBRE_ENTIDAD', 'TIPO DE LINEA'];
const IDX = {};
HEADER.forEach((h, i) => { IDX[h] = i; });

// Serial real confirmado contra el archivo (celda F2): 46272.46655092592 ==
// "07/09/2026 11:11:50" hora Colombia (fraccion de dia: 0.46655092592*24h =
// 11h11m50s, calculo puro sobre el numero, independiente de cualquier zona
// horaria). SheetJS boxea esto a un objeto Date usando el constructor LOCAL
// (new Date(y,m,d,H,Mi,S)) a partir de esos mismos componentes calculados en
// UTC -- por eso ese Date boxeado, leido con getters UTC, da "16:11:49" (5h
// de mas, el offset de Bogota) en vez de la hora real: exactamente el mismo
// hallazgo que ya motivo traficoValorCrudoSiFechaBoxeada (Fase 115) y
// tipificacionValorCrudoSiFechaBoxeada (Fase 116). Aqui se usa CUALQUIER
// Date como "boxeado" (la logica nunca confia en su valor, solo en la celda
// cruda de `ws`).
const SERIAL_REAL = 46272.46655092592;
const FECHA_BOXEADA = new Date('2026-09-07T16:11:49.999Z');

function filaFicticia(over) {
  const row = new Array(HEADER.length).fill(null);
  row[IDX['NOMBRE DE AGENTE']] = 'ASESOR DEMO UNO';
  row[IDX.SEDE] = 'SEDE DEMO';
  row[IDX.NOMBRE_EXAMEN] = 'EXAMEN DEMO';
  row[IDX.ESPECIALIDAD] = 'ESPECIALIDAD DEMO';
  row[IDX.PROFESIONAL] = 'PROFESIONAL DEMO';
  row[IDX.FECHA_SOLICITUD] = FECHA_BOXEADA;
  row[IDX.NOMBRE_ENTIDAD] = 'ENTIDAD DEMO';
  row[IDX['TIPO DE LINEA']] = '3P';
  Object.assign(row, over || {});
  return row;
}

test('agendasValorCrudoSiFechaBoxeada: Date + ws con la celda cruda numerica -> recupera el serial real (ignora el Date)', () => {
  const ws = { [agendasCeldaRef(1, 5)]: { t: 'n', v: SERIAL_REAL } };
  assert.equal(agendasValorCrudoSiFechaBoxeada(FECHA_BOXEADA, ws, 1, 5), SERIAL_REAL);
});

test('agendasValorCrudoSiFechaBoxeada: sin ws -- devuelve el Date tal cual', () => {
  assert.equal(agendasValorCrudoSiFechaBoxeada(FECHA_BOXEADA, null, 1, 5), FECHA_BOXEADA);
});

test('agendasValorCrudoSiFechaBoxeada: un numero normal (no Date) se devuelve sin tocar, aunque haya ws', () => {
  const ws = { [agendasCeldaRef(1, 5)]: { t: 'n', v: 999 } };
  assert.equal(agendasValorCrudoSiFechaBoxeada(46000, ws, 1, 5), 46000);
});

test('HALLAZGO REAL: SIN `ws`, una fila con FECHA_SOLICITUD boxeada a Date se rechaza COMPLETA (documentado a proposito, comportamiento de ANTES de este fix)', () => {
  const aoa = [HEADER, filaFicticia()];
  const res = agendasParseFilas(aoa); // sin ws
  assert.ok(res.error, 'sin ws no hay forma de recuperar el serial real -- FECHA_SOLICITUD invalida, ninguna fila valida');
});

test('FIX: CON `ws`, la fila boxeada se parsea correctamente (fecha y hora local de Colombia, sin convertir a UTC)', () => {
  const aoa = [HEADER, filaFicticia()];
  const ws = { [agendasCeldaRef(1, IDX.FECHA_SOLICITUD)]: { t: 'n', v: SERIAL_REAL } };
  const res = agendasParseFilas(aoa, ws);
  assert.ok(!res.error, JSON.stringify(res));
  assert.equal(res.filas.length, 1);
  assert.equal(res.filas[0].fechaSolicitud, '2026-09-07 11:11:50');
});

test('Formato de siempre (texto "dd/mm/aaaa hh:mm:ss" o numero plano) sigue funcionando igual, aunque se pase `ws`', () => {
  const filaTexto = filaFicticia({ [IDX.FECHA_SOLICITUD]: '07/09/2026 11:11:50' });
  const aoa = [HEADER, filaTexto];
  const resConWs = agendasParseFilas(aoa, {});
  const resSinWs = agendasParseFilas(aoa);
  assert.deepEqual(resConWs.filas, resSinWs.filas);
  assert.equal(resConWs.filas[0].fechaSolicitud, '2026-09-07 11:11:50');
});

test('Un archivo COMPLETO con varias filas boxeadas se parsea entero (ningun rechazo masivo)', () => {
  const filas5 = [1, 2, 3, 4, 5].map((n) => filaFicticia({ [IDX.FECHA_SOLICITUD]: new Date('2026-09-0' + n + 'T10:00:00.000Z') }));
  const aoa = [HEADER, ...filas5];
  const ws = {};
  filas5.forEach((_, idx) => { ws[agendasCeldaRef(idx + 1, IDX.FECHA_SOLICITUD)] = { t: 'n', v: SERIAL_REAL - (5 - (idx + 1)) }; });
  const res = agendasParseFilas(aoa, ws);
  assert.ok(!res.error, JSON.stringify(res));
  assert.equal(res.filas.length, 5);
});
