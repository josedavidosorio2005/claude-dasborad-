// salida-logic.test.js — cubre public/js/salida-logic.js (Fase 127,
// pedido textual de Edwin: "las llamadas de salida estan muy bajas").
// Archivo real: FLUJO_LLAMADAS_Y_WPP_DE_SALIDA_POR_MES.xlsx -- Hoja1,
// encabezado en la fila 3 (filas 1-2 vacias), MES sin año, 2 filas de
// datos. Fixtures con la forma EXACTA del real: encabezado NO en la
// primera fila del AOA, mes en mayusculas sin año. Datos SIEMPRE
// inventados.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  SALIDA_ORDEN_ARRAY,
  salidaColIndexMap,
  salidaParseFilas,
  salidaFilaComoArray,
  salidaMesesDelArchivo,
  salidaMesLbl,
  salidaTextoConfirmacionAnio,
} = require('../../public/js/salida-logic.js');

const HOY = new Date('2026-10-01T12:00:00Z'); // "hoy" Colombia = 2026-09-30
const HEADER = ['MES', 'LINEA 3P', 'LINEA GENERAL', 'WHATSAPP 3P', 'WHATSAPP GENERAL'];

test('salidaColIndexMap: empareja por nombre de columna exacto, sin importar mayusculas/espacios', () => {
  const map = salidaColIndexMap(['mes', ' Linea 3p ', 'LINEA GENERAL', 'whatsapp 3p', 'Whatsapp General']);
  assert.deepEqual(map, { mes: 0, llamadas3p: 1, llamadasGeneral: 2, wpp3p: 3, wppGeneral: 4 });
});

test('salidaParseFilas: camino feliz, encabezado en la fila 3 del Excel (aoa[0] sigue siendo el encabezado, filas 1-2 vacias YA las quito SheetJS)', () => {
  // aoa[0] = encabezado (lo que SheetJS entrega cuando el rango usado de la
  // hoja empieza en A3 -- las filas 1-2 vacias del Excel real NUNCA llegan
  // a este array, igual que Efectividad de Agendamiento/Citas Atendidas).
  const aoa = [HEADER, ['AGOSTO', 2169, 4391, 747, 2635], ['SEPTIEMBRE', 3530, 6874, 1277, 2720]];
  const r = salidaParseFilas(aoa, HOY);
  assert.equal(r.avisos.length, 0);
  assert.equal(r.filas.length, 2);
  assert.deepEqual(r.filas[0], { mes: '2026-08', mesTexto: 'AGOSTO', llamadas3p: 2169, llamadasGeneral: 4391, wpp3p: 747, wppGeneral: 2635 });
  assert.deepEqual(r.filas[1], { mes: '2026-09', mesTexto: 'SEPTIEMBRE', llamadas3p: 3530, llamadasGeneral: 6874, wpp3p: 1277, wppGeneral: 2720 });
});

test('salidaParseFilas: totales de control del archivo real de Edwin (6.560/10.404 llamadas, 3.382/3.997 WhatsApp)', () => {
  const aoa = [HEADER, ['AGOSTO', 2169, 4391, 747, 2635], ['SEPTIEMBRE', 3530, 6874, 1277, 2720]];
  const r = salidaParseFilas(aoa, HOY);
  const ago = r.filas[0], sep = r.filas[1];
  assert.equal(ago.llamadas3p + ago.llamadasGeneral, 6560);
  assert.equal(sep.llamadas3p + sep.llamadasGeneral, 10404);
  assert.equal(ago.wpp3p + ago.wppGeneral, 3382);
  assert.equal(sep.wpp3p + sep.wppGeneral, 3997);
});

test('salidaParseFilas: falta una columna obligatoria -> error claro, nunca una carga parcial', () => {
  const aoa = [['MES', 'LINEA 3P', 'LINEA GENERAL', 'WHATSAPP 3P'], ['AGOSTO', 1, 2, 3]];
  const r = salidaParseFilas(aoa, HOY);
  assert.match(r.error, /WHATSAPP GENERAL/);
});

test('salidaParseFilas: otro nombre de hoja no afecta el parseo (el reconocimiento de hoja es responsabilidad de cargas.js, esta funcion solo ve el AOA ya resuelto)', () => {
  const aoa = [HEADER, ['AGOSTO', 1, 2, 3, 4]];
  const r = salidaParseFilas(aoa, HOY);
  assert.equal(r.filas.length, 1);
});

test('salidaParseFilas: otras mayusculas/tildes en el nombre de mes (ej. "Agosto", "SEPTIEMBRE ") se reconocen igual', () => {
  const aoa = [HEADER, ['Agosto', 1, 2, 3, 4], ['  SEPTIEMBRE  ', 5, 6, 7, 8]];
  const r = salidaParseFilas(aoa, HOY);
  assert.equal(r.filas.length, 2);
  assert.equal(r.filas[0].mes, '2026-08');
  assert.equal(r.filas[1].mes, '2026-09');
});

test('salidaParseFilas: un solo mes en el archivo', () => {
  const aoa = [HEADER, ['AGOSTO', 1, 2, 3, 4]];
  const r = salidaParseFilas(aoa, HOY);
  assert.equal(r.filas.length, 1);
  assert.equal(salidaMesesDelArchivo(r.filas).length, 1);
});

test('salidaParseFilas: 3 meses en el archivo (no solo 2)', () => {
  const aoa = [HEADER, ['JULIO', 1, 2, 3, 4], ['AGOSTO', 5, 6, 7, 8], ['SEPTIEMBRE', 9, 10, 11, 12]];
  const r = salidaParseFilas(aoa, HOY);
  assert.equal(r.filas.length, 3);
  assert.deepEqual(salidaMesesDelArchivo(r.filas), ['2026-07', '2026-08', '2026-09']);
});

test('salidaParseFilas: mes duplicado (mismo mes 2 veces) -> la 2da fila se omite con un aviso, nunca se guardan ambas', () => {
  const aoa = [HEADER, ['AGOSTO', 1, 2, 3, 4], ['AGOSTO', 100, 200, 300, 400]];
  const r = salidaParseFilas(aoa, HOY);
  assert.equal(r.filas.length, 1);
  assert.equal(r.filas[0].llamadas3p, 1, 'debe quedar la PRIMERA fila, no la duplicada');
  assert.equal(r.avisos.length, 1);
  assert.match(r.avisos[0], /ya aparecio antes/);
});

test('salidaParseFilas: valor negativo -> fila omitida con aviso, no bloquea las demas', () => {
  const aoa = [HEADER, ['AGOSTO', -1, 2, 3, 4], ['SEPTIEMBRE', 5, 6, 7, 8]];
  const r = salidaParseFilas(aoa, HOY);
  assert.equal(r.filas.length, 1);
  assert.equal(r.filas[0].mes, '2026-09');
  assert.equal(r.avisos.length, 1);
});

test('salidaParseFilas: celda vacia -> fila omitida con aviso, no bloquea las demas', () => {
  const aoa = [HEADER, ['AGOSTO', '', 2, 3, 4], ['SEPTIEMBRE', 5, 6, 7, 8]];
  const r = salidaParseFilas(aoa, HOY);
  assert.equal(r.filas.length, 1);
  assert.equal(r.filas[0].mes, '2026-09');
});

test('salidaParseFilas: texto no numerico en una columna de cantidad -> fila omitida con aviso', () => {
  const aoa = [HEADER, ['AGOSTO', 'no es un numero', 2, 3, 4]];
  const r = salidaParseFilas(aoa, HOY);
  assert.equal(r.filas.length, 0);
  assert.equal(r.avisos.length, 1);
});

test('salidaParseFilas: mes futuro se rechaza (mismo criterio que agendas/tipificacion/inasistencia) -- NUNCA se reconoce como el año que viene', () => {
  // "hoy" Colombia (fechaLimitesHoyColombia, UTC-5) = 2026-10-01:
  // DICIEMBRE sin año resuelve al año mas reciente en que DICIEMBRE no es
  // futuro -> 2025, nunca 2026.
  const aoa = [HEADER, ['DICIEMBRE', 1, 2, 3, 4]];
  const r = salidaParseFilas(aoa, HOY);
  assert.equal(r.filas.length, 1);
  assert.equal(r.filas[0].mes, '2025-12');
});

test('salidaParseFilas: filas vacias intermedias se ignoran sin generar aviso', () => {
  const aoa = [HEADER, ['AGOSTO', 1, 2, 3, 4], [null, null, null, null, null], ['SEPTIEMBRE', 5, 6, 7, 8]];
  const r = salidaParseFilas(aoa, HOY);
  assert.equal(r.filas.length, 2);
  assert.equal(r.avisos.length, 0);
});

test('salidaParseFilas: con anioForzado (correccion del usuario en el modal), usa ESE año para todos los meses, nunca el inferido', () => {
  const aoa = [HEADER, ['AGOSTO', 1, 2, 3, 4], ['SEPTIEMBRE', 5, 6, 7, 8]];
  const r = salidaParseFilas(aoa, HOY, '2025');
  assert.equal(r.filas[0].mes, '2025-08');
  assert.equal(r.filas[1].mes, '2025-09');
});

test('salidaFilaComoArray: respeta SALIDA_ORDEN_ARRAY, para el payload compacto que se manda al servidor', () => {
  const fila = { mes: '2026-08', mesTexto: 'AGOSTO', llamadas3p: 2169, llamadasGeneral: 4391, wpp3p: 747, wppGeneral: 2635 };
  assert.deepEqual(salidaFilaComoArray(fila), ['2026-08', 2169, 4391, 747, 2635]);
  assert.deepEqual(SALIDA_ORDEN_ARRAY, ['mes', 'llamadas3p', 'llamadasGeneral', 'wpp3p', 'wppGeneral']);
});

test('salidaMesLbl: "AAAA-MM" -> nombre de mes completo en español', () => {
  assert.equal(salidaMesLbl('2026-08'), 'Agosto 2026');
  assert.equal(salidaMesLbl('2026-09'), 'Septiembre 2026');
});

test('salidaTextoConfirmacionAnio: arma el texto "MES_ARCHIVO → Mes Año" por fila, para el modal de confirmacion de año', () => {
  const filas = [
    { mes: '2026-08', mesTexto: 'AGOSTO' },
    { mes: '2026-09', mesTexto: 'SEPTIEMBRE' },
  ];
  assert.equal(salidaTextoConfirmacionAnio(filas), 'AGOSTO → Agosto 2026\nSEPTIEMBRE → Septiembre 2026');
});
