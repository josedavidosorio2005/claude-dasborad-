// calidad-carga-masiva-logic.test.js — cubre public/js/calidad-carga-masiva-logic.js
// (parseo de la hoja "Monitoreos" de la carga masiva de Calidad), corriendo la
// MISMA logica que usa el navegador contra un fixture REAL de 3 hojas
// (server/tests/fixtures/cartera-fixture.xlsx — datos claramente de prueba,
// nunca datos reales de la campana). Ver server/tests/helpers/xlsx-lite.js
// para por que se lee el .xlsx a mano en vez de con un paquete de npm.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { leerHojaXlsxComoAoA } = require('./helpers/xlsx-lite');
const {
  CM_COLUMNAS_FIJAS,
  cmColIndexMap,
  cmHeaderItemNumero,
  cmDetectarFilaEncabezado,
  cmParseFecha,
  cmParseRespuesta,
  cmParseRows,
} = require('../../public/js/calidad-carga-masiva-logic.js');
const { PLANTILLAS } = require('../calidad-plantillas-seed.js');

const FIXTURE = path.join(__dirname, 'fixtures', 'cartera-fixture.xlsx');
// Fase 134: CARTERA INTERNA se elimino de PLANTILLAS (ya no es un cliente de
// produccion) -- pero el fixture .xlsx de abajo sigue siendo datos REALES de
// prueba con esta forma exacta de 14 items (labels/orden), asi que la lista
// queda fija aqui en vez de derivarla de PLANTILLAS. La logica que se prueba
// (cmColIndexMap/cmParseRows/etc, public/js/calidad-carga-masiva-logic.js)
// es generica -- no le importa si la campana existe en produccion hoy.
const ITEMS_CARTERA = [
  { n: 1, cat: 'APERTURA', label: 'Saludo', weight: 5, critico: false },
  { n: 2, cat: 'APERTURA', label: 'Grabacion de la llamada o chat', weight: 7, critico: false },
  { n: 3, cat: 'APERTURA', label: 'Motivo de la llamada', weight: 9, critico: false },
  { n: 4, cat: 'COMUNICACION', label: 'Comunicacion oral y cumplimiento de parametros de cobranza', weight: 9, critico: false },
  { n: 5, cat: 'GESTION', label: 'Buen uso de los argumentos - Persuade al cliente', weight: 7, critico: true },
  { n: 6, cat: 'GESTION', label: 'Objeciones', weight: 9, critico: true },
  { n: 7, cat: 'GESTION', label: 'Liquidacion del credito', weight: 12, critico: true },
  { n: 8, cat: 'GESTION', label: 'Resolucion de la llamada - dudas', weight: 5, critico: false },
  { n: 9, cat: 'GESTION', label: 'Medios de pago', weight: 13, critico: true },
  { n: 10, cat: 'LEGAL', label: 'Habeas data', weight: 5, critico: false },
  { n: 11, cat: 'GESTION', label: 'Documenta gestion de la llamada', weight: 5, critico: false },
  { n: 12, cat: 'COMUNICACION', label: 'Ortografia', weight: 5, critico: false },
  { n: 13, cat: 'CIERRE', label: 'Cierre de la llamada', weight: 6, critico: false },
  { n: 14, cat: 'TIEMPOS', label: 'Tiempo de retoma de llamada', weight: 3, critico: false },
];
const ITEMS_ORLANT = PLANTILLAS.find((p) => p.campana === 'ORLANT').items;

test('cmParseFecha: formatos aceptados y rechazados', () => {
  assert.equal(cmParseFecha('2026-09-01'), '2026-09-01');
  assert.equal(cmParseFecha(new Date(Date.UTC(2026, 8, 1))), '2026-09-01');
  assert.equal(cmParseFecha('fecha-invalida'), null);
  assert.equal(cmParseFecha(''), null);
});

test('cmParseRespuesta: normaliza variantes de SI/NO/N-A', () => {
  assert.equal(cmParseRespuesta('si'), 'SI');
  assert.equal(cmParseRespuesta('SÍ'), 'SI');
  assert.equal(cmParseRespuesta('no'), 'NO');
  assert.equal(cmParseRespuesta('n/a'), 'N/A');
  assert.equal(cmParseRespuesta('NA'), 'N/A');
  assert.equal(cmParseRespuesta(''), '');
  assert.equal(cmParseRespuesta('algo-raro'), '');
});

test('cmColIndexMap: reconoce columnas fijas y de items por etiqueta, no por posicion', () => {
  const aoa = leerHojaXlsxComoAoA(FIXTURE, 'Monitoreos');
  const map = cmColIndexMap(aoa[0], ITEMS_CARTERA);
  assert.equal(map.fijas.asesor, 0);
  assert.equal(map.fijas.fecha, 1);
  assert.equal(Object.keys(map.items).length, 14); // los 14 items de Cartera
});

test('cmParseRows: fixture de 3 hojas de Cartera — filas validas, invalidas descartadas con aviso', () => {
  const aoa = leerHojaXlsxComoAoA(FIXTURE, 'Monitoreos');
  const res = cmParseRows(aoa, ITEMS_CARTERA);
  assert.equal(res.error, undefined, JSON.stringify(res));
  // El fixture trae 5 filas de datos: 3 validas, 1 sin asesor y 1 con fecha
  // invalida (deben descartarse con aviso, no romper el resto de la carga).
  assert.equal(res.filas.length, 3);
  assert.equal(res.avisos.length, 2);
  assert.match(res.avisos[0], /asesor.*vacio/i);
  assert.match(res.avisos[1], /fecha.*invalida/i);

  const f1 = res.filas.find((f) => f.idLlamada === 'ID-TEST-001');
  assert.equal(f1.asesor, 'Asesor Prueba Uno');
  assert.equal(f1.fecha, '2026-09-01');
  assert.equal(f1.canal, 'LLAMADA');
  assert.equal(Object.keys(f1.answers).length, 14);
  assert.equal(f1.answers[1], 'SI');

  const f2 = res.filas.find((f) => f.idLlamada === 'ID-TEST-002');
  assert.equal(f2.answers[6], 'NO'); // item critico "Objeciones" fallado a proposito

  const f3 = res.filas.find((f) => f.idLlamada === 'ID-TEST-003');
  assert.equal(f3.canal, 'WPP');
  assert.equal(f3.answers[2], 'N/A');
});

// Fase 86 (tema 2, hallazgo real Fase 85): FECHA futura se rechaza (se
// omite, con aviso que dice la fila y la fecha) -- nunca "posterior a hoy".
test('Fase 86: cmParseRows -- FECHA en el futuro se omite con un aviso que dice la fila y la fecha', () => {
  const header = ['ASESOR', 'FECHA', ITEMS_CARTERA[0].label];
  const aoa = [header, ['Asesor Prueba', '2099-06-15', 'SI'], ['Asesor Prueba', '2026-01-03', 'SI']];
  const res = cmParseRows(aoa, ITEMS_CARTERA);
  assert.equal(res.error, undefined, JSON.stringify(res));
  assert.equal(res.filas.length, 1);
  assert.equal(res.avisos.length, 1);
  assert.match(res.avisos[0], /Fila 2/);
  assert.match(res.avisos[0], /2099-06-15/);
  assert.match(res.avisos[0], /futuro/);
});

test('Fase 86: cmParseRows -- FECHA anterior a 2020 SOLO se advierte, no se omite', () => {
  const header = ['ASESOR', 'FECHA', ITEMS_CARTERA[0].label];
  const aoa = [header, ['Asesor Prueba', '2015-03-10', 'SI']];
  const res = cmParseRows(aoa, ITEMS_CARTERA);
  assert.equal(res.error, undefined, JSON.stringify(res));
  assert.equal(res.filas.length, 1, 'la fila NO se omite, solo se advierte');
  assert.equal(res.avisos.length, 1);
  assert.match(res.avisos[0], /anterior a 2020/);
});

test('cmParseRows: hoja vacia o sin columnas obligatorias -> error legible', () => {
  assert.match(cmParseRows([], ITEMS_CARTERA).error, /vacia/i);
  const sinAsesor = [['FECHA', 'CANAL'], ['2026-09-01', 'LLAMADA']];
  assert.match(cmParseRows(sinAsesor, ITEMS_CARTERA).error, /ASESOR/);
});

// ── Fase 130, Parte 4: plantilla REAL de ORLANT (Edwin) ──────────────────
// El archivo real que manda Edwin cada mes NO es el .xlsx plano que genera
// esta plataforma (descargarPlantillaMonitoreos): trae titulo + leyenda +
// un encabezado agrupado por categoria ANTES del encabezado real, usa
// "Nombre del Asesor" en vez de "ASESOR", y cada item lleva su numero +
// un salto de linea + el peso en "(%)" (los criticos ademas con un emoji
// de advertencia al principio). Replica ese layout EXACTO con nombres
// ficticios -- nunca el archivo real -- para que Edwin pueda seguir
// subiendo el archivo de cada mes sin editarlo.
function _headerItemReal(it) {
  var prefijo = it.critico ? '⚠️ ' : '';
  return prefijo + it.n + '. ' + it.label + '\r\n(' + it.weight + '%)';
}

function _hojaMonitoreosRealSintetica(filasDatos) {
  const nCols = 6 + ITEMS_ORLANT.length + 5; // fijas + items + columnas de resultado
  const filaTitulo = ['PLANTILLA DE CALIDAD — CLÍNICA FICTICIA  |  MONITOREOS DE LLAMADAS', ...Array(nCols - 1).fill(null)];
  const filaLeyenda = ['SI = cumple  |  NO = no cumple  |  N/A = no aplica', ...Array(nCols - 1).fill(null)];
  const filaCategorias = ['INFORMACIÓN GENERAL', null, null, null, null, null, ...ITEMS_ORLANT.map((it) => it.cat), 'PUNTAJE', 'CLASIFICACIÓN', 'FALLOS', 'NIVEL CRÍTICO', 'OBSERVACIONES'];
  const filaEncabezado = [
    'Nombre del Asesor', 'Fecha', 'ID / Llamada - Wpp', '# Teléfono', 'Codificación', 'Evaluador',
    ...ITEMS_ORLANT.map(_headerItemReal),
    'PUNTAJE\r\nOBTENIDO', 'NIVEL DE\r\nCALIDAD', '# FALLOS EN\r\nÍTEMS CRÍTICOS', 'ALERTA\r\nÍTEMS CRÍTICOS', 'OBSERVACIONES GENERALES',
  ];
  return [filaTitulo, filaLeyenda, filaCategorias, filaEncabezado, ...filasDatos];
}

test('cmHeaderItemNumero: extrae el numero ignorando el emoji de advertencia, el salto de linea y el peso', () => {
  assert.equal(cmHeaderItemNumero('1. Guion de saludo\r\n(5%)'), 1);
  assert.equal(cmHeaderItemNumero('⚠️ 3. Valida entidad y derechos\r\n(7%)'), 3);
  assert.equal(cmHeaderItemNumero('17. Gestion correcta pacientes 3P\r\n(10%)'), 17);
  assert.equal(cmHeaderItemNumero('OBSERVACIONES GENERALES'), null);
  assert.equal(cmHeaderItemNumero('# FALLOS EN\r\nÍTEMS CRÍTICOS'), null);
  assert.equal(cmHeaderItemNumero('ASESOR'), null);
});

test('cmDetectarFilaEncabezado: encuentra el encabezado real aunque no sea la fila 0 (titulo+leyenda+categorias antes)', () => {
  const aoa = _hojaMonitoreosRealSintetica([]);
  assert.equal(cmDetectarFilaEncabezado(aoa, ITEMS_ORLANT), 3);
});

test('cmDetectarFilaEncabezado: la plantilla plana (encabezado en la fila 0) sigue funcionando igual que antes', () => {
  const header = CM_COLUMNAS_FIJAS.map((c) => c.label).concat(ITEMS_ORLANT.map((it) => it.label));
  assert.equal(cmDetectarFilaEncabezado([header], ITEMS_ORLANT), 0);
});

test('cmColIndexMap: "Nombre del Asesor" y "# Teléfono" (plantilla real) resuelven a asesor/telefono', () => {
  const aoa = _hojaMonitoreosRealSintetica([]);
  const map = cmColIndexMap(aoa[3], ITEMS_ORLANT);
  assert.equal(map.fijas.asesor, 0);
  assert.equal(map.fijas.telefono, 3);
  assert.equal(Object.keys(map.items).length, ITEMS_ORLANT.length);
});

test('cmParseRows: plantilla REAL completa de ORLANT (titulo/leyenda/categorias + encabezado numerado) -- parsea 2 monitoreos ficticios sin error', () => {
  const filasDatos = [
    [
      'Asesor Ficticio Uno', '2026-09-12', 'ID-FICT-001', '3000000001', 'Audiología', 'Evaluador Ficticio',
      ...ITEMS_ORLANT.map(() => 'SI'),
      97, '🟢 SOBRESALIENTE', 0, '✅ SIN FALLOS CRÍTICOS', 'Observacion de prueba uno',
    ],
    [
      'Asesor Ficticio Dos', '2026-09-13', 'ID-FICT-002', '3000000002', 'Audiología', 'Evaluador Ficticio',
      ...ITEMS_ORLANT.map((it) => (it.n === 3 ? 'NO' : 'SI')), // falla el item critico #3 a proposito
      0, '🔴 CRITICO', 1, '⚠️ CON FALLOS CRÍTICOS', 'Observacion de prueba dos',
    ],
  ];
  const aoa = _hojaMonitoreosRealSintetica(filasDatos);
  const res = cmParseRows(aoa, ITEMS_ORLANT);
  assert.equal(res.error, undefined, JSON.stringify(res));
  assert.equal(res.filas.length, 2);
  assert.deepEqual(res.avisos, []);

  const f1 = res.filas.find((f) => f.idLlamada === 'ID-FICT-001');
  assert.equal(f1.asesor, 'Asesor Ficticio Uno');
  assert.equal(f1.fecha, '2026-09-12');
  assert.equal(f1.telefono, '3000000001');
  assert.equal(f1.evaluador, 'Evaluador Ficticio');
  assert.equal(f1.observaciones, 'Observacion de prueba uno');
  assert.equal(Object.keys(f1.answers).length, ITEMS_ORLANT.length);
  assert.equal(f1.answers[1], 'SI');
  assert.equal(f1.answers[17], 'SI');

  const f2 = res.filas.find((f) => f.idLlamada === 'ID-FICT-002');
  assert.equal(f2.answers[3], 'NO'); // item critico fallado a proposito
  assert.equal(f2.answers[1], 'SI');
});
