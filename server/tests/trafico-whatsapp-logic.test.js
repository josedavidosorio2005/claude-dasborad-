// trafico-whatsapp-logic.test.js — cubre public/js/trafico-whatsapp-logic.js
// (parseo de la plantilla real de WhatsApp + resumen agregado), corriendo la
// MISMA logica que usa el navegador contra el fixture REAL
// (server/tests/fixtures/PLANTILLA_TRAFICO_WHATSAPP_EJEMPLO.xlsx, hoja
// DATA) — nunca un fixture inventado. Mismo patron que trafico-logic.test.js.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { leerHojaXlsxComoAoA } = require('./helpers/xlsx-lite');
const {
  traficoWppParseFilas,
  traficoWppParseFecha,
  traficoWppPctDesdeTexto,
  traficoWppNumero,
  traficoWppSegundosDesdeFraccionDia,
  traficoWppEsFilaTotal,
  traficoWppResumen,
  traficoWppFiltrarFilas,
  traficoWppPeriodoDe,
  traficoWppAgregarPorPeriodo,
} = require('../../public/js/trafico-whatsapp-logic.js');

const FIXTURE = path.join(__dirname, 'fixtures', 'PLANTILLA_TRAFICO_WHATSAPP_EJEMPLO.xlsx');

test('conversion: FECHA INICIO/FECHA FIN vienen como texto corto M/D/AA (no fecha nativa de Excel)', () => {
  assert.equal(traficoWppParseFecha('8/1/26'), '2026-08-01');
  assert.equal(traficoWppParseFecha('8/31/26'), '2026-08-31');
  assert.equal(traficoWppParseFecha('12/5/2026'), '2026-12-05');
  assert.equal(traficoWppParseFecha('2026-08-01'), '2026-08-01'); // formato ISO tambien
  assert.equal(traficoWppParseFecha('no es una fecha'), null);
  assert.equal(traficoWppParseFecha(''), null);
});

test('conversion: SERVICE_LEVEL_* vienen como texto con % (con espacio, como trae la plantilla real)', () => {
  assert.equal(traficoWppPctDesdeTexto('46.88 %'), 46.88);
  assert.equal(traficoWppPctDesdeTexto('0.00%'), 0);
  assert.equal(traficoWppPctDesdeTexto(''), null);
  assert.equal(traficoWppPctDesdeTexto(null), null);
});

test('conversion: ASA/ATA vienen con separador de miles (ej. "9,230.35")', () => {
  assert.equal(traficoWppNumero('9,230.35'), 9230.35);
  assert.equal(traficoWppNumero('82,800.00'), 82800);
  assert.equal(traficoWppNumero(192), 192);
  assert.equal(traficoWppNumero(''), null);
});

test('deteccion de fila TOTAL/resumen (mismo criterio que voz)', () => {
  assert.ok(traficoWppEsFilaTotal('TOTAL'));
  assert.ok(traficoWppEsFilaTotal('Totales'));
  assert.ok(traficoWppEsFilaTotal('TOTAL GENERAL'));
  assert.ok(!traficoWppEsFilaTotal('WHATSAPP ORLANT 3P'));
  assert.ok(!traficoWppEsFilaTotal('COLA TOTALIZADORA')); // contiene "total" pero no ES "total"
});

test('parseo del archivo REAL (PLANTILLA_TRAFICO_WHATSAPP_EJEMPLO.xlsx, hoja DATA): las 5 colas de ejemplo, valores correctos', () => {
  const aoa = leerHojaXlsxComoAoA(FIXTURE, 'DATA');
  const res = traficoWppParseFilas(aoa);
  assert.ok(!res.error, res.error);
  assert.equal(res.filas.length, 5, 'el fixture real trae 5 colas de ejemplo');
  assert.deepEqual(res.colas, [
    'WHATSAPP AUDIFONOS',
    'WHATSAPP FONIATRIA',
    'WHATSAPP FONOAUDIOLOGIA',
    'WHATSAPP ORLANT 3P',
    'WHATSAPP ORLANT GENERAL',
  ]);
  assert.deepEqual(res.periodos, ['2026-08-01_2026-08-31']);

  const orlant3p = res.filas.find((f) => f.colaWhatsapp === 'WHATSAPP ORLANT 3P');
  assert.equal(orlant3p.fechaInicio, '2026-08-01');
  assert.equal(orlant3p.fechaFin, '2026-08-31');
  assert.equal(orlant3p.totalWhatsapp, 4844);
  assert.equal(orlant3p.contestados, 4697);
  assert.equal(orlant3p.abandonados, 147);
  assert.equal(orlant3p.serviceLevel10secPct, 31.73);
  assert.equal(orlant3p.serviceLevel20secPct, 32.18);
  assert.equal(orlant3p.serviceLevel30secPct, 32.54);
  assert.equal(orlant3p.asaSegundos, 9230.35);
  assert.equal(orlant3p.ataSegundos, 79125.8);
  // ABANDONO (columna de la plantilla real) NUNCA se parsea -- se recalcula
  // exacto desde abandonados/total (traficoWppResumen), igual que voz desde
  // la Fase 45. La fila no debe traer ese campo.
  assert.equal(orlant3p.abandonoReportado, undefined);
  assert.equal(orlant3p.abandonoPct, undefined);
});

test('resumen agregado del periodo: suma volumenes primero, recalcula % desde la suma (no promedia % crudos)', () => {
  const aoa = leerHojaXlsxComoAoA(FIXTURE, 'DATA');
  const res = traficoWppParseFilas(aoa);
  const resumen = traficoWppResumen(res.filas);
  const totalEsperado = 192 + 4844 + 1504 + 31 + 734;
  const contestadosEsperado = 187 + 4697 + 1467 + 29 + 729;
  const abandonadosEsperado = 5 + 147 + 37 + 2 + 5;
  assert.equal(resumen.totalWhatsapp, totalEsperado);
  assert.equal(resumen.contestados, contestadosEsperado);
  assert.equal(resumen.abandonados, abandonadosEsperado);
  assert.equal(resumen.nivelAtencionPct, Math.round((contestadosEsperado / totalEsperado) * 10000) / 100);
  assert.equal(resumen.tasaAbandonoPct, Math.round((abandonadosEsperado / totalEsperado) * 10000) / 100);
  // Promedio ponderado por TOTAL WHATSAPP, no promedio simple de las 5 colas.
  assert.ok(resumen.serviceLevel10secPct > 0 && resumen.serviceLevel10secPct < 100);
});

test('columnas reordenadas: el emparejamiento sigue siendo por nombre, no por posicion', () => {
  const aoa = [
    ['TOTAL WHATSAPP', 'FECHA FIN', 'NOMBRE_COLA_WHATSAPP', 'FECHA INICIO', 'WHATSAPP CONTESTADOS'],
    [100, '2026-01-31', 'COLA X', '2026-01-01', 90],
  ];
  const res = traficoWppParseFilas(aoa);
  assert.ok(!res.error, res.error);
  assert.equal(res.filas[0].colaWhatsapp, 'COLA X');
  assert.equal(res.filas[0].totalWhatsapp, 100);
  assert.equal(res.filas[0].contestados, 90);
});

test('columna obligatoria faltante -> error claro diciendo cual falta', () => {
  const aoa = [
    ['NOMBRE_COLA_WHATSAPP', 'FECHA INICIO', 'TOTAL WHATSAPP', 'WHATSAPP CONTESTADOS'], // falta FECHA FIN
    ['COLA X', '2026-01-01', 100, 90],
  ];
  const res = traficoWppParseFilas(aoa);
  assert.ok(res.error);
  assert.match(res.error, /FECHA FIN/);
});

test('filas invalidas se descartan con un aviso explicando por que', () => {
  const aoa = [
    ['NOMBRE_COLA_WHATSAPP', 'FECHA INICIO', 'FECHA FIN', 'TOTAL WHATSAPP', 'WHATSAPP CONTESTADOS'],
    ['COLA X', '', '2026-01-31', 100, 90], // fecha inicio vacia
    ['COLA X', '2026-01-01', '2026-01-31', 100, 150], // contestados > total
    ['COLA X', '2026-02-01', '2026-01-31', 100, 90], // fecha fin antes que inicio
    ['', '2026-01-01', '2026-01-31', 100, 90], // cola vacia
    ['COLA X', '2026-01-01', '2026-01-31', 100, 90], // valida
  ];
  const res = traficoWppParseFilas(aoa);
  assert.ok(!res.error, res.error);
  assert.equal(res.filas.length, 1);
  assert.equal(res.avisos.length, 4);
  assert.match(res.avisos[0], /FECHA INICIO invalida/);
  assert.match(res.avisos[1], /supera el total/);
  assert.match(res.avisos[2], /anterior a FECHA INICIO/);
  assert.match(res.avisos[3], /NOMBRE_COLA_WHATSAPP vacio/);
});

test('fila TOTAL/resumen de la base se descarta con aviso, no se suma como si fuera una cola real', () => {
  const aoa = [
    ['NOMBRE_COLA_WHATSAPP', 'FECHA INICIO', 'FECHA FIN', 'TOTAL WHATSAPP', 'WHATSAPP CONTESTADOS'],
    ['COLA X', '2026-01-01', '2026-01-31', 100, 90],
    ['TOTAL', '2026-01-01', '2026-01-31', 999, 999],
    ['TOTAL GENERAL', '2026-01-01', '2026-01-31', 999, 999],
    ['COLA TOTALIZADORA', '2026-01-01', '2026-01-31', 20, 15], // nombre real que solo CONTIENE "total"
  ];
  const res = traficoWppParseFilas(aoa);
  assert.ok(!res.error, res.error);
  assert.equal(res.filas.length, 2);
  assert.deepEqual(res.filas.map((f) => f.colaWhatsapp).sort(), ['COLA TOTALIZADORA', 'COLA X']);
  assert.equal(res.avisos.length, 2);
  assert.match(res.avisos[0], /TOTAL\/resumen/);
});

test('archivo sin filas de datos -> error', () => {
  const aoa = [
    ['NOMBRE_COLA_WHATSAPP', 'FECHA INICIO', 'FECHA FIN', 'TOTAL WHATSAPP', 'WHATSAPP CONTESTADOS'],
  ];
  const res = traficoWppParseFilas(aoa);
  assert.ok(res.error);
});

// ── Fase 68, Pedido 5 (Edwin, 23/09): columna AHT opcional ────────────────

test('conversion: AHT viene como hora nativa de Excel (fraccion de dia), igual que voz', () => {
  assert.equal(traficoWppSegundosDesdeFraccionDia(0.0024884259259259), 215);
  assert.equal(traficoWppSegundosDesdeFraccionDia(''), null);
  assert.equal(traficoWppSegundosDesdeFraccionDia(null), null);
});

test('parseo: AHT es opcional -- un archivo SIN esa columna sigue cargando igual (archivos viejos)', () => {
  const aoa = [
    ['NOMBRE_COLA_WHATSAPP', 'FECHA INICIO', 'FECHA FIN', 'TOTAL WHATSAPP', 'WHATSAPP CONTESTADOS'],
    ['COLA X', '2026-01-01', '2026-01-31', 100, 90],
  ];
  const res = traficoWppParseFilas(aoa);
  assert.ok(!res.error, res.error);
  assert.equal(res.filas[0].ahtSegundos, undefined); // ausente, no null explicito -- columna no vino
});

test('parseo: AHT presente se lee y se redondea a segundos enteros', () => {
  const aoa = [
    ['NOMBRE_COLA_WHATSAPP', 'FECHA INICIO', 'FECHA FIN', 'TOTAL WHATSAPP', 'WHATSAPP CONTESTADOS', 'AHT'],
    ['COLA X', '2026-01-01', '2026-01-31', 100, 90, 0.0024884259259259],
  ];
  const res = traficoWppParseFilas(aoa);
  assert.ok(!res.error, res.error);
  assert.equal(res.filas[0].ahtSegundos, 215);
});

test('el archivo REAL (sin columna AHT) sigue parseando igual que siempre -- ahtSegundos ausente en las 5 colas', () => {
  const aoa = leerHojaXlsxComoAoA(FIXTURE, 'DATA');
  const res = traficoWppParseFilas(aoa);
  assert.ok(!res.error, res.error);
  res.filas.forEach((f) => assert.equal(f.ahtSegundos, undefined));
});

// ── Fase 68, Pedido 5: traficoWppFiltrarFilas (cola + rango de fechas) ───

test('traficoWppFiltrarFilas: filtra por cola (mismo nombre de opcion "skills" que trafico-logic.js)', () => {
  const filas = [
    { colaWhatsapp: 'A', fechaInicio: '2026-08-01', fechaFin: '2026-08-31' },
    { colaWhatsapp: 'B', fechaInicio: '2026-08-01', fechaFin: '2026-08-31' },
  ];
  const res = traficoWppFiltrarFilas(filas, { skills: ['A'] });
  assert.deepEqual(res.map((f) => f.colaWhatsapp), ['A']);
});

test('traficoWppFiltrarFilas: "Desde"/"Hasta" incluye cualquier periodo que SE SOLAPE con el rango (no exige que quede totalmente adentro)', () => {
  const filas = [
    { colaWhatsapp: 'A', fechaInicio: '2026-07-01', fechaFin: '2026-07-31' }, // antes del rango
    { colaWhatsapp: 'B', fechaInicio: '2026-08-01', fechaFin: '2026-08-31' }, // se solapa
    { colaWhatsapp: 'C', fechaInicio: '2026-09-01', fechaFin: '2026-09-30' }, // despues del rango
  ];
  const res = traficoWppFiltrarFilas(filas, { desde: '2026-08-15', hasta: '2026-08-20' });
  assert.deepEqual(res.map((f) => f.colaWhatsapp), ['B']);
});

// ── Fase 68, Pedido 5: traficoWppAgregarPorPeriodo ────────────────────────

test('traficoWppPeriodoDe: "mes" agrupa por AAAA-MM, "anio" por AAAA', () => {
  assert.equal(traficoWppPeriodoDe('2026-08-01', 'mes'), '2026-08');
  assert.equal(traficoWppPeriodoDe('2026-08-01', 'anio'), '2026');
  assert.equal(traficoWppPeriodoDe('2026-08-01'), '2026-08'); // default 'mes'
});

test('traficoWppAgregarPorPeriodo: combinado suma volumenes y recalcula % desde la suma (misma forma de salida que traficoAgregar)', () => {
  const filas = [
    { colaWhatsapp: 'A', fechaInicio: '2026-08-01', fechaFin: '2026-08-31', totalWhatsapp: 100, contestados: 90, abandonados: 8, serviceLevel20secPct: 80, asaSegundos: 10, ataSegundos: 20, ahtSegundos: 200 },
    { colaWhatsapp: 'B', fechaInicio: '2026-08-01', fechaFin: '2026-08-31', totalWhatsapp: 50, contestados: 40, abandonados: 5, serviceLevel20secPct: 60, asaSegundos: 30, ataSegundos: 40, ahtSegundos: 100 },
  ];
  const agregado = traficoWppAgregarPorPeriodo(filas, { granularidad: 'mes', combinar: true });
  assert.equal(agregado.length, 1);
  const p = agregado[0];
  assert.equal(p.periodo, '2026-08');
  assert.equal(p.skillName, null);
  assert.equal(p.totalLlamadas, 150);
  assert.equal(p.contestadas, 130);
  assert.equal(p.llamadasAbandonadas, 13);
  assert.equal(p.nivelAtencionPct, Math.round((130 / 150) * 10000) / 100);
  assert.equal(p.tasaAbandonoPct, Math.round((13 / 150) * 10000) / 100);
  // Promedio ponderado por total, nunca promedio simple de las 2 colas (70 !== 70 aqui por coincidencia -- se verifica con la formula, no un numero fijo).
  assert.equal(p.serviceLevel20secPct, Math.round(((80 * 100 + 60 * 50) / 150) * 100) / 100);
  assert.equal(p.ahtSegundos, Math.round(((200 * 100 + 100 * 50) / 150) * 100) / 100);
  assert.equal(p.waitTimeSegundos, null); // WhatsApp nunca tiene este dato
});

test('traficoWppAgregarPorPeriodo: separado (combinar:false) deja una fila por cola, con skillName = la cola', () => {
  const filas = [
    { colaWhatsapp: 'A', fechaInicio: '2026-08-01', fechaFin: '2026-08-31', totalWhatsapp: 100, contestados: 90 },
    { colaWhatsapp: 'B', fechaInicio: '2026-08-01', fechaFin: '2026-08-31', totalWhatsapp: 50, contestados: 40 },
  ];
  const agregado = traficoWppAgregarPorPeriodo(filas, { granularidad: 'mes', combinar: false });
  assert.equal(agregado.length, 2);
  assert.deepEqual(agregado.map((a) => a.skillName), ['A', 'B']);
  assert.equal(agregado[0].totalLlamadas, 100);
  assert.equal(agregado[1].totalLlamadas, 50);
});

test('traficoWppAgregarPorPeriodo: dos filas de la MISMA cola en el mismo mes se suman (no se pisan)', () => {
  const filas = [
    { colaWhatsapp: 'A', fechaInicio: '2026-08-01', fechaFin: '2026-08-15', totalWhatsapp: 60, contestados: 50 },
    { colaWhatsapp: 'A', fechaInicio: '2026-08-16', fechaFin: '2026-08-31', totalWhatsapp: 40, contestados: 35 },
  ];
  const agregado = traficoWppAgregarPorPeriodo(filas, { granularidad: 'mes', combinar: true });
  assert.equal(agregado.length, 1);
  assert.equal(agregado[0].totalLlamadas, 100);
  assert.equal(agregado[0].contestadas, 85);
});
