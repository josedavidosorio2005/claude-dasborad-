// fase116-trafico-whatsapp-diario.test.js — Fase 116 (archivo real de
// Edwin, WPP_PARA_LA_PLATAFORMA_ago-sep_2026.xlsx): Wolkvox exporta WhatsApp
// en el MISMO formato diario que voz (SKILL_NAME + DATE, una fila por cola y
// DIA), no por periodo como la plantilla vieja (NOMBRE_COLA_WHATSAPP/FECHA
// INICIO/FECHA FIN). Verificado contra el archivo real (solo estructura):
// hoja "Hoja1", columnas SKILL_NAME, DATE, INBOUND_CALLS, ANSWER_CALLS,
// ABANDON_CALLS, SERVICE_LEVEL_10/20/30SEC, ABANDON, ASA, ATA, WAIT_TIME,
// AHT. Datos SIEMPRE inventados.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  traficoWppEsFormatoDiario,
  traficoWppParseFilas,
  traficoWppParseFilasPeriodo,
} = require('../../public/js/trafico-whatsapp-logic.js');

const HEADER_DIARIO = [
  'SKILL_NAME', 'DATE', 'INBOUND_CALLS', 'ANSWER_CALLS', 'ABANDON_CALLS',
  'SERVICE_LEVEL_10SEC', 'SERVICE_LEVEL_20SEC', 'SERVICE_LEVEL_30SEC',
  'ABANDON', 'ASA', 'ATA', 'WAIT_TIME', 'AHT',
];
const IDX = {};
HEADER_DIARIO.forEach((h, i) => { IDX[h] = i; });

function filaDiaria(over) {
  const row = new Array(HEADER_DIARIO.length).fill(null);
  row[IDX.SKILL_NAME] = 'WHATSAPP AUDIFONOS';
  row[IDX.DATE] = '2026-08-01';
  row[IDX.INBOUND_CALLS] = 9;
  row[IDX.ANSWER_CALLS] = 9;
  row[IDX.ABANDON_CALLS] = 0;
  row[IDX.SERVICE_LEVEL_20SEC] = '33.33 %';
  row[IDX.ASA] = '27,554.56';
  row[IDX.ATA] = '0.00';
  row[IDX.AHT] = '----';
  Object.assign(row, over || {});
  return row;
}

test('traficoWppEsFormatoDiario: detecta el formato diario real (SKILL_NAME+DATE+INBOUND_CALLS+ANSWER_CALLS)', () => {
  assert.equal(traficoWppEsFormatoDiario(HEADER_DIARIO), true);
});

test('traficoWppEsFormatoDiario: el formato viejo de periodo NO se detecta como diario', () => {
  assert.equal(traficoWppEsFormatoDiario(['NOMBRE_COLA_WHATSAPP', 'FECHA INICIO', 'FECHA FIN', 'TOTAL WHATSAPP', 'WHATSAPP CONTESTADOS']), false);
});

test('traficoWppEsFormatoDiario: el formato de Trafico de Llamadas (voz) NO se detecta como diario (INBOUND_CALLS/ANSWER_CALLS son unicos de WhatsApp)', () => {
  assert.equal(traficoWppEsFormatoDiario(['SKILL_NAME', 'DATE', 'TOTAL LLAMADAS', 'LLAMADAS CONTESTADAS']), false);
});

test('dispatcher traficoWppParseFilas: delega al parser DIARIO cuando el encabezado lo trae', () => {
  const aoa = [HEADER_DIARIO, filaDiaria()];
  const res = traficoWppParseFilas(aoa);
  assert.ok(!res.error, JSON.stringify(res));
  assert.equal(res.filas.length, 1);
  assert.equal(res.filas[0].colaWhatsapp, 'WHATSAPP AUDIFONOS');
  // Cada fila diaria produce fechaInicio===fechaFin===ese dia -- asi el
  // resto del pipeline (resumen, filtro, agregado, reemplazo por rango del
  // backend) funciona igual sin saber de que formato vino.
  assert.equal(res.filas[0].fechaInicio, '2026-08-01');
  assert.equal(res.filas[0].fechaFin, '2026-08-01');
});

test('AHT "----" (placeholder real de Wolkvox, todas las filas reales de hoy) se lee como "sin dato" (null), nunca 0', () => {
  const aoa = [HEADER_DIARIO, filaDiaria()];
  const res = traficoWppParseFilas(aoa);
  assert.equal(res.filas[0].ahtSegundos, undefined, 'columna presente pero sin valor numerico -> no se agrega la clave (nunca 0)');
});

test('ASA/ATA con separador de miles ingles ("27,554.56") -- en SEGUNDOS como numero, nunca formato de hora de Excel', () => {
  const aoa = [HEADER_DIARIO, filaDiaria()];
  const res = traficoWppParseFilas(aoa);
  assert.equal(res.filas[0].asaSegundos, 27554.56);
  assert.equal(res.filas[0].ataSegundos, 0);
});

test('WAIT_TIME no se mapea a proposito (Fase 68 retiro Wait Time de WhatsApp) -- una columna con una hora de mas de 1h no rompe el resto del parseo', () => {
  const aoa = [HEADER_DIARIO, filaDiaria({ [IDX.WAIT_TIME]: new Date('1899-12-31T13:35:30.000Z') })]; // >1h, boxeado
  const res = traficoWppParseFilas(aoa);
  assert.ok(!res.error, JSON.stringify(res));
  assert.equal(res.filas[0].waitTimeSegundos, undefined);
  // El resto de la fila sigue intacto -- WAIT_TIME nunca interfiere.
  assert.equal(res.filas[0].totalWhatsapp, 9);
  assert.equal(res.filas[0].asaSegundos, 27554.56);
});

test('Contestados > total -- se omite igual que en el formato periodo', () => {
  const aoa = [HEADER_DIARIO, filaDiaria({ [IDX.INBOUND_CALLS]: 5, [IDX.ANSWER_CALLS]: 9 })];
  const res = traficoWppParseFilas(aoa);
  assert.ok(res.error || res.filas.length === 0);
});

test('Falta una columna obligatoria del formato diario (ANSWER_CALLS) -- ya no se detecta como diario (requiere las 2 columnas de volumen), cae al formato periodo y falla ahi con su propio error explicito', () => {
  const headerIncompleto = HEADER_DIARIO.filter((h) => h !== 'ANSWER_CALLS');
  assert.equal(traficoWppEsFormatoDiario(headerIncompleto), false);
  const aoa = [headerIncompleto, []];
  const res = traficoWppParseFilas(aoa);
  assert.ok(res.error);
  assert.match(res.error, /Faltan columnas obligatorias/);
});

test('Formato viejo (periodo) sigue cargando exactamente igual via el dispatcher -- compatibilidad hacia atras', () => {
  const headerViejo = ['NOMBRE_COLA_WHATSAPP', 'FECHA INICIO', 'FECHA FIN', 'TOTAL WHATSAPP', 'WHATSAPP CONTESTADOS'];
  const filaVieja = ['WHATSAPP ORLANT 3P', '8/1/26', '8/31/26', 1500, 1460];
  const aoa = [headerViejo, filaVieja];
  const viaDispatcher = traficoWppParseFilas(aoa);
  const viaDirecta = traficoWppParseFilasPeriodo(aoa);
  assert.deepEqual(viaDispatcher.filas, viaDirecta.filas);
  assert.equal(viaDispatcher.filas[0].fechaInicio, '2026-08-01');
  assert.equal(viaDispatcher.filas[0].fechaFin, '2026-08-31');
});

test('8 colas reales (ago-sep/2026) -- ninguna termina sin clasificar por el parser (todas cargan, aunque Resumen solo agrupe 3P/GENERAL)', () => {
  const COLAS_REALES = [
    'WHATSAPP ORLANT 3P', 'WHATSAPP ORLANT GENERAL', 'WHATSAPP AUDIFONOS',
    'WHATSAPP FONOAUDIOLOGIA', 'WHATSAPP FONIATRIA', 'WHATSAPP VESTIBULAR',
    'WHATSAPP TINNITUS', 'WHATSAPP PAUTAS',
  ];
  const aoa = [HEADER_DIARIO].concat(COLAS_REALES.map((c) => filaDiaria({ [IDX.SKILL_NAME]: c })));
  const res = traficoWppParseFilas(aoa);
  assert.ok(!res.error, JSON.stringify(res));
  assert.equal(res.filas.length, 8);
  assert.deepEqual(res.colas, COLAS_REALES.slice().sort());
});
