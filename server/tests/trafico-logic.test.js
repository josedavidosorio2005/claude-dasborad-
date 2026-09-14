// trafico-logic.test.js — cubre public/js/trafico-logic.js (parseo del
// export de Volvox + agregacion por granularidad), corriendo la MISMA
// logica que usa el navegador contra el fixture REAL
// (server/tests/fixtures/EJEMPLO.xlsx, hoja DATA) — nunca un fixture
// inventado. Ver server/tests/helpers/xlsx-lite.js para por que se lee el
// .xlsx a mano en vez de con un paquete de npm.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { leerHojaXlsxComoAoA } = require('./helpers/xlsx-lite');
const {
  traficoParseFilas,
  traficoFechaDesdeSerial,
  traficoSegundosDesdeFraccionDia,
  traficoPctDesdeTexto,
  traficoPctDesdeFraccion,
  traficoNumero,
  traficoFiltrarFilas,
  traficoAgregar,
} = require('../../public/js/trafico-logic.js');

const FIXTURE = path.join(__dirname, 'fixtures', 'EJEMPLO.xlsx');

test('conversion: serial de Excel -> YYYY-MM-DD (aritmetica UTC, sin depender de la zona horaria)', () => {
  assert.equal(traficoFechaDesdeSerial(46266), '2026-09-01');
  assert.equal(traficoFechaDesdeSerial(46267), '2026-09-02');
  assert.equal(traficoFechaDesdeSerial('46268'), '2026-09-03'); // texto numerico tambien
  assert.equal(traficoFechaDesdeSerial('no es un numero'), null);
});

test('conversion: WAIT_TIME/AHT (hora nativa de Excel = fraccion de dia) -> segundos', () => {
  assert.equal(traficoSegundosDesdeFraccionDia(0.0002546296296296296), 22); // 0:00:22
  assert.equal(traficoSegundosDesdeFraccionDia(0.002488425925925926), 215); // 0:03:35
  assert.equal(traficoSegundosDesdeFraccionDia(0), 0);
  assert.equal(traficoSegundosDesdeFraccionDia(null), null);
  assert.equal(traficoSegundosDesdeFraccionDia(''), null);
});

test('conversion: SERVICE_LEVEL_*/ABANDON vienen como texto con % (con y sin espacio)', () => {
  assert.equal(traficoPctDesdeTexto('86.49 %'), 86.49); // con espacio
  assert.equal(traficoPctDesdeTexto('1.62%'), 1.62); // sin espacio
  assert.equal(traficoPctDesdeTexto('0.00%'), 0); // 0% real, no "sin dato"
  assert.equal(traficoPctDesdeTexto(''), null);
  assert.equal(traficoPctDesdeTexto(null), null);
  assert.equal(traficoPctDesdeTexto('texto raro'), null);
});

test('conversion: NIVEL DE ATENCION/TASA DE ABNDONO vienen como fraccion decimal, no como %', () => {
  assert.equal(traficoPctDesdeFraccion(0.9837837837837838), 98.38);
  assert.equal(traficoPctDesdeFraccion(0.016216216216216217), 1.62);
  assert.equal(traficoPctDesdeFraccion(0), 0);
  assert.equal(traficoPctDesdeFraccion(1), 100);
  assert.equal(traficoPctDesdeFraccion(null), null);
});

test('conversion: ASA/ATA (numero, a veces como texto) -> numero', () => {
  assert.equal(traficoNumero('22.47'), 22.47);
  assert.equal(traficoNumero(22.47), 22.47);
  assert.equal(traficoNumero('0.00'), 0);
  assert.equal(traficoNumero(''), null);
});

test('parseo del archivo REAL (EJEMPLO.xlsx, hoja DATA): todas las columnas, valores correctos', () => {
  const aoa = leerHojaXlsxComoAoA(FIXTURE, 'DATA');
  const res = traficoParseFilas(aoa);
  assert.ok(!res.error, res.error);
  assert.equal(res.filas.length, 12, 'el fixture tiene 12 filas de datos');
  assert.deepEqual(res.skills, ['CALL INBOUND ORLANT 3P']);
  assert.deepEqual(res.meses, ['2026-09']);

  const f1 = res.filas[0];
  assert.equal(f1.fecha, '2026-09-01');
  assert.equal(f1.skillName, 'CALL INBOUND ORLANT 3P');
  assert.equal(f1.totalLlamadas, 185);
  assert.equal(f1.contestadas, 182);
  assert.equal(f1.llamadasAbandonadas, 3);
  assert.equal(f1.serviceLevel10secPct, 86.49);
  assert.equal(f1.serviceLevel20secPct, 87.03);
  assert.equal(f1.serviceLevel30secPct, 88.11);
  assert.equal(f1.abandonPct, 1.62);
  assert.equal(f1.asaSegundos, 22.47);
  assert.equal(f1.ataSegundos, 162.33);
  assert.equal(f1.waitTimeSegundos, 22);
  assert.equal(f1.ahtSegundos, 215);
  assert.equal(f1.nivelAtencionPct, 98.38);
  assert.equal(f1.tasaAbandonoPct, 1.62);

  // Todas las fechas del fixture caen en septiembre-2026 (no necesariamente
  // consecutivas: el export real tiene huecos, ej. sin fila para el 9/6 ni
  // el 9/13 — un dia sin fila no es lo mismo que un dia en 0).
  const fechas = res.filas.map((f) => f.fecha).sort();
  assert.equal(fechas[0], '2026-09-01');
  assert.equal(fechas[fechas.length - 1], '2026-09-14');
  fechas.forEach((f) => assert.match(f, /^2026-09-\d{2}$/));
});

test('columnas extra se ignoran sin fallar (emparejamiento por nombre, no por posicion)', () => {
  const aoa = [
    ['SKILL_NAME', 'DATE', 'TOTAL LLAMADAS', 'LLAMADAS CONTESTADAS', 'COLUMNA_QUE_VOLVOX_AGREGO_MANANA'],
    ['SKILL X', '2026-01-01', 100, 90, 'lo que sea'],
  ];
  const res = traficoParseFilas(aoa);
  assert.ok(!res.error, res.error);
  assert.equal(res.filas.length, 1);
  assert.equal(res.filas[0].totalLlamadas, 100);
  assert.ok(!('COLUMNA_QUE_VOLVOX_AGREGO_MANANA' in res.filas[0]));
});

test('columnas reordenadas: el emparejamiento sigue siendo por nombre', () => {
  const aoa = [
    ['LLAMADAS CONTESTADAS', 'DATE', 'SKILL_NAME', 'TOTAL LLAMADAS'],
    [90, '2026-01-01', 'SKILL X', 100],
  ];
  const res = traficoParseFilas(aoa);
  assert.ok(!res.error, res.error);
  assert.equal(res.filas[0].skillName, 'SKILL X');
  assert.equal(res.filas[0].totalLlamadas, 100);
  assert.equal(res.filas[0].contestadas, 90);
});

test('columna obligatoria faltante -> error claro diciendo cual falta', () => {
  const aoa = [
    ['SKILL_NAME', 'DATE', 'TOTAL LLAMADAS'], // falta LLAMADAS CONTESTADAS
    ['SKILL X', '2026-01-01', 100],
  ];
  const res = traficoParseFilas(aoa);
  assert.ok(res.error);
  assert.match(res.error, /LLAMADAS CONTESTADAS/);
});

test('archivo con varias skills y varios meses a la vez (no es un caso raro, debe funcionar)', () => {
  const aoa = [
    ['SKILL_NAME', 'DATE', 'TOTAL LLAMADAS', 'LLAMADAS CONTESTADAS', 'NIVEL DE ATENCION'],
    ['SKILL A', '2026-01-15', 100, 90, 0.9],
    ['SKILL A', '2026-02-15', 120, 100, 0.83],
    ['SKILL B', '2026-01-20', 50, 45, 0.9],
    ['SKILL B', '2026-03-05', 80, 70, 0.875],
  ];
  const res = traficoParseFilas(aoa);
  assert.ok(!res.error, res.error);
  assert.equal(res.filas.length, 4);
  assert.deepEqual(res.skills.sort(), ['SKILL A', 'SKILL B']);
  assert.deepEqual(res.meses.sort(), ['2026-01', '2026-02', '2026-03']);
});

test('filas invalidas se descartan con un aviso explicando por que (fecha vacia, contestadas>total, etc.)', () => {
  const aoa = [
    ['SKILL_NAME', 'DATE', 'TOTAL LLAMADAS', 'LLAMADAS CONTESTADAS'],
    ['SKILL X', '', 100, 90], // fecha vacia
    ['SKILL X', '2026-01-01', 100, 150], // contestadas > total
    ['', '2026-01-02', 100, 90], // skill vacio
    ['SKILL X', '2026-01-03', 100, 90], // valida
  ];
  const res = traficoParseFilas(aoa);
  assert.ok(!res.error, res.error);
  assert.equal(res.filas.length, 1);
  assert.equal(res.avisos.length, 3);
  assert.match(res.avisos[0], /DATE invalida/);
  assert.match(res.avisos[1], /supera el total/);
  assert.match(res.avisos[2], /SKILL_NAME vacio/);
});

// ── Agregacion: el requisito mas delicado — nunca promediar los % diarios ──
test('agregacion: nivel de atencion mensual = contestadas del mes / total del mes (NO el promedio de los % diarios)', () => {
  // Dia 1: 100 llamadas, 50 contestadas -> 50%. Dia 2: 10 llamadas, 10 contestadas -> 100%.
  // Promedio simple de los dos % (incorrecto): (50+100)/2 = 75%.
  // Correcto (ponderado por volumen real): (50+10)/(100+10) = 54.545...% ≈ 54.55%.
  const filas = [
    { fecha: '2026-01-01', skillName: 'X', totalLlamadas: 100, contestadas: 50 },
    { fecha: '2026-01-02', skillName: 'X', totalLlamadas: 10, contestadas: 10 },
  ];
  const agregadoMes = traficoAgregar(filas, { granularidad: 'mes' });
  assert.equal(agregadoMes.length, 1);
  assert.equal(agregadoMes[0].totalLlamadas, 110);
  assert.equal(agregadoMes[0].contestadas, 60);
  assert.notEqual(agregadoMes[0].nivelAtencionPct, 75, 'NO debe ser el promedio simple de 50% y 100%');
  assert.equal(agregadoMes[0].nivelAtencionPct, 54.55);
});

test('agregacion: granularidad dia/mes/anio agrega los volumenes correctamente', () => {
  const filas = [
    { fecha: '2026-01-05', skillName: 'X', totalLlamadas: 10, contestadas: 8 },
    { fecha: '2026-01-20', skillName: 'X', totalLlamadas: 20, contestadas: 18 },
    { fecha: '2026-02-10', skillName: 'X', totalLlamadas: 30, contestadas: 25 },
    { fecha: '2027-01-01', skillName: 'X', totalLlamadas: 5, contestadas: 5 },
  ];
  const porDia = traficoAgregar(filas, { granularidad: 'dia' });
  assert.equal(porDia.length, 4);

  const porMes = traficoAgregar(filas, { granularidad: 'mes' });
  assert.equal(porMes.length, 3);
  const enero2026 = porMes.find((p) => p.periodo === '2026-01');
  assert.equal(enero2026.totalLlamadas, 30);
  assert.equal(enero2026.contestadas, 26);

  const porAnio = traficoAgregar(filas, { granularidad: 'anio' });
  assert.equal(porAnio.length, 2);
  const anio2026 = porAnio.find((p) => p.periodo === '2026');
  assert.equal(anio2026.totalLlamadas, 60);
  assert.equal(anio2026.contestadas, 51);
});

test('filtro combinable: varias skills se suman salvo que se pidan como series separadas', () => {
  const filas = [
    { fecha: '2026-01-01', skillName: 'A', totalLlamadas: 100, contestadas: 90 },
    { fecha: '2026-01-01', skillName: 'B', totalLlamadas: 50, contestadas: 40 },
  ];
  const combinado = traficoAgregar(filas, { granularidad: 'dia', combinar: true });
  assert.equal(combinado.length, 1);
  assert.equal(combinado[0].totalLlamadas, 150);
  assert.equal(combinado[0].contestadas, 130);
  assert.equal(combinado[0].skillName, null);

  const separado = traficoAgregar(filas, { granularidad: 'dia', combinar: false });
  assert.equal(separado.length, 2);
  assert.deepEqual(separado.map((s) => s.skillName).sort(), ['A', 'B']);
});

test('filtro por skill y por rango de fechas (previo a agregar)', () => {
  const filas = [
    { fecha: '2026-01-01', skillName: 'A', totalLlamadas: 10, contestadas: 9 },
    { fecha: '2026-01-15', skillName: 'B', totalLlamadas: 20, contestadas: 18 },
    { fecha: '2026-02-01', skillName: 'A', totalLlamadas: 30, contestadas: 25 },
  ];
  const soloA = traficoFiltrarFilas(filas, { skills: ['A'] });
  assert.equal(soloA.length, 2);

  const rango = traficoFiltrarFilas(filas, { desde: '2026-01-10', hasta: '2026-01-31' });
  assert.equal(rango.length, 1);
  assert.equal(rango[0].skillName, 'B');
});
