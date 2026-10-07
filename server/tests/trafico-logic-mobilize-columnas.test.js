// trafico-logic-mobilize-columnas.test.js — Fase 131 (Parte 2): el motor de
// Tráfico de Llamadas (public/js/trafico-logic.js) se reutiliza tal cual
// para Mobilize, que trae los MISMOS datos de Volvox pero con sus propios
// nombres de columna ("TIPO DE LINEA", "DÍA", "LLAMADAS INGRESADAS",
// "NIVEL DE SERVICIO 80 - 20", "% ABANDONO") -- se agregaron como alias de
// las columnas de siempre (ver TRAFICO_COLUMNAS, trafico-logic.js), nunca un
// parser nuevo. Este archivo cubre SOLO lo nuevo de la Parte 2 (aliases,
// ASA/ATA como texto, aviso de porcentaje fuera de rango); el fixture real
// de ORLANT (trafico-logic.test.js) sigue intacto y en verde.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  traficoParseFilas,
  traficoColIndexMap,
  traficoSegundosDesdeTextoOTexto,
} = require('../../public/js/trafico-logic.js');

const ENCABEZADO_MOBILIZE = [
  'TIPO DE LINEA', 'DÍA', 'LLAMADAS INGRESADAS', 'LLAMADAS CONTESTADAS',
  'LLAMADAS ABANDONADAS', 'SERVICE_LEVEL_10SEC', 'NIVEL DE SERVICIO 80 - 20',
  'SERVICE_LEVEL_30SEC', 'ABANDON', 'ASA', 'ATA', 'WAIT_TIME', 'AHT',
  'NIVEL DE ATENCION', '% ABANDONO',
];

test('traficoColIndexMap: reconoce los encabezados de Mobilize por alias (TIPO DE LINEA/DÍA/LLAMADAS INGRESADAS/NIVEL DE SERVICIO 80 - 20/% ABANDONO)', () => {
  const map = traficoColIndexMap(ENCABEZADO_MOBILIZE);
  assert.equal(map.skillName, 0);
  assert.equal(map.fecha, 1);
  assert.equal(map.totalLlamadas, 2);
  assert.equal(map.contestadas, 3);
  assert.equal(map.serviceLevel20secPct, 6);
  assert.equal(map.tasaAbandonoPct, 14);
  // "ABANDON" (columna propia de Volvox, Fase 45: nunca se lee) no mapea a
  // ninguna clave -- Mobilize no pierde nada por traerla ademas de "% ABANDONO".
  assert.equal(Object.values(map).includes(8), false);
});

test('traficoColIndexMap: un archivo de ORLANT (encabezados de siempre) sigue mapeando exactamente igual, sin ningun alias de Mobilize', () => {
  const map = traficoColIndexMap(['SKILL_NAME', 'DATE', 'TOTAL LLAMADAS', 'LLAMADAS CONTESTADAS', 'SERVICE_LEVEL_20SEC', 'TASA DE ABNDONO']);
  assert.equal(map.skillName, 0);
  assert.equal(map.fecha, 1);
  assert.equal(map.totalLlamadas, 2);
  assert.equal(map.serviceLevel20secPct, 4);
  assert.equal(map.tasaAbandonoPct, 5);
});

function filaMobilize(dia) {
  return ['SKILL SAC', '2026-09-' + String(dia).padStart(2, '0'), 10, 10, 0, '95.00 %', '85.00 %', '99.00 %', '5.00 %', '5', '0', 0.001, 0.002, 0.95, 0.05];
}

test('traficoParseFilas: un archivo con encabezados de Mobilize se parsea completo, sin "faltan columnas obligatorias"', () => {
  const aoa = [ENCABEZADO_MOBILIZE, filaMobilize(1), filaMobilize(2)];
  const r = traficoParseFilas(aoa);
  assert.equal(r.error, undefined);
  assert.equal(r.filas.length, 2);
  assert.equal(r.filas[0].skillName, 'SKILL SAC');
  assert.equal(r.filas[0].totalLlamadas, 10);
  assert.equal(r.filas[0].serviceLevel20secPct, 85);
  assert.equal(r.filas[0].tasaAbandonoPct, 5); // % ABANDONO 0.05 -> 5% (fraccion, igual que TASA DE ABNDONO de ORLANT -- sin cambios en el parser)
});

test('traficoSegundosDesdeTextoOTexto: numero/texto numerico plano sigue igual que traficoNumero (ORLANT no cambia)', () => {
  assert.equal(traficoSegundosDesdeTextoOTexto(5), 5);
  assert.equal(traficoSegundosDesdeTextoOTexto('5'), 5);
  assert.equal(traficoSegundosDesdeTextoOTexto(''), null);
  assert.equal(traficoSegundosDesdeTextoOTexto(null), null);
});

test('traficoSegundosDesdeTextoOTexto: formato de reloj como texto (Mobilize, ASA/ATA) -- MM:SS y H:MM:SS a segundos', () => {
  assert.equal(traficoSegundosDesdeTextoOTexto('00:05'), 5);
  assert.equal(traficoSegundosDesdeTextoOTexto('01:30'), 90);
  assert.equal(traficoSegundosDesdeTextoOTexto('1:02:03'), 3723);
  assert.equal(traficoSegundosDesdeTextoOTexto('no es un tiempo'), null);
});

test('traficoParseFilas: ASA/ATA como texto de reloj ("00:05") se leen en segundos', () => {
  const header = ['SKILL_NAME', 'DATE', 'TOTAL LLAMADAS', 'LLAMADAS CONTESTADAS', 'ASA', 'ATA'];
  const row = ['SAC', '2026-09-01', 10, 10, '00:05', '01:10'];
  const r = traficoParseFilas([header, row]);
  assert.equal(r.error, undefined);
  assert.equal(r.filas[0].asaSegundos, 5);
  assert.equal(r.filas[0].ataSegundos, 70);
});

test('traficoParseFilas: NIVEL DE ATENCION por encima de 100% al tratarlo como fraccion dispara un aviso (nunca cambia ni descarta el valor)', () => {
  // Columna YA en escala 0-100 (95, no 0.95) -- traficoPctDesdeFraccion la
  // multiplica *100 igual que siempre (sin cambios para ORLANT), da 9500%,
  // numero imposible -- debe avisar, no corregir solo ni fallar.
  const header = ['SKILL_NAME', 'DATE', 'TOTAL LLAMADAS', 'LLAMADAS CONTESTADAS', 'NIVEL DE ATENCION'];
  const row = ['SAC', '2026-09-01', 10, 10, 95];
  const r = traficoParseFilas([header, row]);
  assert.equal(r.error, undefined);
  assert.equal(r.filas[0].nivelAtencionPct, 9500);
  assert.ok(r.avisos.some((a) => a.indexOf('NIVEL DE ATENCION') !== -1 && a.indexOf('100%') !== -1));
});

test('traficoParseFilas: % ABANDONO por encima de 100% al tratarlo como fraccion tambien dispara su propio aviso', () => {
  const header = ['SKILL_NAME', 'DATE', 'TOTAL LLAMADAS', 'LLAMADAS CONTESTADAS', '% ABANDONO'];
  const row = ['SAC', '2026-09-01', 10, 10, 50];
  const r = traficoParseFilas([header, row]);
  assert.equal(r.error, undefined);
  assert.equal(r.filas[0].tasaAbandonoPct, 5000);
  assert.ok(r.avisos.some((a) => a.indexOf('100%') !== -1));
});

test('traficoParseFilas: un periodo normal (0-100% ya esperado) de Mobilize nunca dispara el aviso de "mas de 100%"', () => {
  const aoa = [ENCABEZADO_MOBILIZE, filaMobilize(1), filaMobilize(2)];
  const r = traficoParseFilas(aoa);
  assert.equal(r.avisos.some((a) => a.indexOf('100%') !== -1), false);
});
