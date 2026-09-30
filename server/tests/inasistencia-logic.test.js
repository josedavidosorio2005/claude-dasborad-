// inasistencia-logic.test.js — Fase 98 (ORLANT, pedido urgente de Edwin).
// Logica PURA de parseo de la hoja INASISTENCIA (public/js/inasistencia-logic.js):
// encabezados con/sin la D de ESPECIALIDAD, AÑO opcional, MES en texto/fecha/
// AAAA-MM, año inferido, mes futuro rechazado, filas vacias ignoradas, TOTAL
// que no cuadra (advertencia, nunca bloquea), % ponderado vs. archivo. Datos
// SIEMPRE inventados (los numeros de control del archivo real de Edwin se
// usan como EJEMPLO numerico, nunca el archivo en si).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  INASISTENCIA_COLUMNAS,
  inasistenciaColIndexMap,
  inasistenciaParseMes,
  inasistenciaParseFilas,
  inasistenciaFilaComoArray,
  inasistenciaMesesDeFilas,
  inasistenciaMesLbl,
  inasistenciaAgregarPorMes,
  inasistenciaMesesIncompletos,
} = require('../../public/js/inasistencia-logic.js');

// "Hoy" fijo para que la inferencia de año sea determinista en las pruebas
// (mismo criterio que agendas-logic.test.js con fecha-limites-logic.js):
// 2026-09-30, coincide con el ejemplo del pedido ("hoy AGOSTO y SEPTIEMBRE dan 2026").
const AHORA = new Date('2026-09-30T15:00:00Z');

function headerConD() {
  return ['MES', 'ESPECIALIDAD', 'CANCELADA', 'INASISTENCIA', 'PENDIENTE', 'ATENDIDAS', 'TOTAL'];
}
function headerSinD() {
  return ['MES', 'ESPECIALIDA', 'CANCELADA', 'INASISTENCIA', 'PENDIENTE', 'ATENDIDAS', 'TOTAL', 'INASISTENCIA & PENDIENTE', '% DE INASISTENCIA'];
}

test('inasistenciaColIndexMap: ESPECIALIDAD y ESPECIALIDA (sin la D, archivo real de Edwin) resuelven a la misma columna', () => {
  const map1 = inasistenciaColIndexMap(headerConD());
  const map2 = inasistenciaColIndexMap(headerSinD());
  assert.equal(map1.especialidad, 1);
  assert.equal(map2.especialidad, 1);
});

test('inasistenciaColIndexMap: AÑO y ANO (sin tilde) resuelven a la misma columna opcional', () => {
  const conTilde = inasistenciaColIndexMap(['MES', 'AÑO', 'ESPECIALIDAD', 'CANCELADA', 'INASISTENCIA', 'PENDIENTE', 'ATENDIDAS', 'TOTAL']);
  const sinTilde = inasistenciaColIndexMap(['MES', 'ANO', 'ESPECIALIDAD', 'CANCELADA', 'INASISTENCIA', 'PENDIENTE', 'ATENDIDAS', 'TOTAL']);
  assert.equal(conTilde.anio, 1);
  assert.equal(sinTilde.anio, 1);
});

// ── inasistenciaParseMes ─────────────────────────────────────────────────
test('inasistenciaParseMes: ya viene como AAAA-MM -> se devuelve tal cual', () => {
  assert.equal(inasistenciaParseMes('2026-08'), '2026-08');
});

test('inasistenciaParseMes: fecha completa AAAA-MM-DD -> se recorta a AAAA-MM', () => {
  assert.equal(inasistenciaParseMes('2026-08-15'), '2026-08');
});

test('inasistenciaParseMes: serial de Excel (numero o texto numerico) -> AAAA-MM', () => {
  // 46234 = 1/ago/2026 aprox (serial de Excel, epoch 1899-12-30).
  const desdeNumero = inasistenciaParseMes(46234);
  const desdeTexto = inasistenciaParseMes('46234');
  assert.equal(desdeNumero, desdeTexto);
  assert.match(desdeNumero, /^\d{4}-\d{2}$/);
});

test('inasistenciaParseMes: nombre de mes en texto + AÑO explicito -> se usa el AÑO tal cual (nunca se infiere)', () => {
  assert.equal(inasistenciaParseMes('AGOSTO', '2024'), '2024-08');
  assert.equal(inasistenciaParseMes('agosto', 2024), '2024-08'); // insensible a mayusculas, AÑO como numero
});

test('inasistenciaParseMes: nombre de mes SIN año -- se infiere el AÑO MAS RECIENTE en que ese mes no es futuro (hora Colombia)', () => {
  // "Hoy" = 2026-09-30: Agosto y Septiembre (<= mes actual) -> 2026.
  assert.equal(inasistenciaParseMes('AGOSTO', undefined, AHORA), '2026-08');
  assert.equal(inasistenciaParseMes('SEPTIEMBRE', undefined, AHORA), '2026-09');
  // Octubre (> mes actual, seria futuro en 2026) -> año anterior, 2025.
  assert.equal(inasistenciaParseMes('OCTUBRE', undefined, AHORA), '2025-10');
  assert.equal(inasistenciaParseMes('DICIEMBRE', undefined, AHORA), '2025-12');
});

test('inasistenciaParseMes: mes no reconocido -> null', () => {
  assert.equal(inasistenciaParseMes('MESINVENTADO', undefined, AHORA), null);
  assert.equal(inasistenciaParseMes('', undefined, AHORA), null);
  assert.equal(inasistenciaParseMes(null, undefined, AHORA), null);
});

// ── inasistenciaParseFilas ───────────────────────────────────────────────
test('inasistenciaParseFilas: numeros de control del pedido (Ago-26 x3 especialidades, Sep-26 x1) -- encabezado SIN la D + año inferido', () => {
  const aoa = [
    headerSinD(),
    ['AGOSTO', 'AUDIFONOS', 475, 109, 10, 2270, 2864, 119, '4,16 %'],
    ['AGOSTO', 'AUDIOLOGIA', 327, 127, 1, 1317, 1772, 128, '7,22 %'],
    ['AGOSTO', 'EXAMENES ESPECIALES', 352, 84, 1, 820, 1257, 85, '6,76 %'],
    ['SEPTIEMBRE', 'EXAMENES ESPECIALES', 452, 94, 2, 935, 1483, 96, '6,47 %'],
  ];
  const res = inasistenciaParseFilas(aoa, AHORA);
  assert.equal(res.error, undefined, JSON.stringify(res));
  assert.equal(res.filas.length, 4);
  assert.deepEqual(inasistenciaMesesDeFilas(res.filas), ['2026-08', '2026-09']);
  const ago = res.filas.filter((f) => f.mes === '2026-08');
  const sep = res.filas.filter((f) => f.mes === '2026-09');
  assert.equal(ago.length, 3);
  assert.equal(sep.length, 1);
  assert.equal(sep[0].especialidad, 'EXAMENES ESPECIALES');
  assert.equal(sep[0].total, 1483);
  // Ninguna de estas 4 filas tiene TOTAL descuadrado ni % distinto del
  // recalculado -- CERO avisos (los numeros de control ya cuadran).
  assert.deepEqual(res.avisos, []);
});

test('inasistenciaParseFilas: filas vacias se ignoran (no generan aviso ni error)', () => {
  const aoa = [
    headerConD(),
    ['2025-04', 'AUDIFONOS', 10, 2, 0, 50, 62],
    ['', '', '', '', '', '', ''],
    [null, null, null, null, null, null, null],
    ['2025-04', 'AUDIOLOGIA', 5, 1, 0, 30, 36],
  ];
  const res = inasistenciaParseFilas(aoa);
  assert.equal(res.filas.length, 2);
});

test('inasistenciaParseFilas: mes futuro se rechaza (defensa igual a Agendas/Tipificacion, Fase 86) -- la fila se omite con aviso', () => {
  const aoa = [headerConD(), ['2030-01', 'AUDIFONOS', 10, 2, 0, 50, 62]];
  const res = inasistenciaParseFilas(aoa, AHORA);
  assert.equal(res.filas, undefined);
  assert.equal(res.error, 'Ninguna fila valida (revisa los avisos anteriores).');
  assert.ok(res.avisos.some((a) => /futuro/.test(a)));
});

test('inasistenciaParseFilas: TOTAL que no cuadra con la suma -- NO bloquea, usa el TOTAL del archivo y avisa', () => {
  const aoa = [headerConD(), ['2025-05', 'AUDIFONOS', 10, 2, 0, 50, 999]]; // 10+2+0+50=62, no 999
  const res = inasistenciaParseFilas(aoa);
  assert.equal(res.filas.length, 1);
  assert.equal(res.filas[0].total, 999, 'se usa el TOTAL del archivo tal cual, nunca se recalcula');
  assert.ok(res.avisos.some((a) => /TOTAL del archivo \(999\) no coincide/.test(a)));
});

test('inasistenciaParseFilas: % del archivo distinto del recalculado -- avisa (el recalculado SIEMPRE gana, nunca se guarda el % del archivo)', () => {
  const aoa = [
    ['MES', 'ESPECIALIDAD', 'CANCELADA', 'INASISTENCIA', 'PENDIENTE', 'ATENDIDAS', 'TOTAL', '% DE INASISTENCIA'],
    ['2025-06', 'AUDIFONOS', 10, 2, 0, 50, 62, '50 %'], // recalculado real (2 decimales): 2/62=3,23%, muy distinto de 50%
  ];
  const res = inasistenciaParseFilas(aoa);
  assert.equal(res.filas.length, 1);
  assert.ok(res.avisos.some((a) => /% DE INASISTENCIA del archivo \(50%\) difiere del recalculado \(3\.23%\)/.test(a)));
});

test('inasistenciaParseFilas: numero negativo -> fila omitida con aviso (nunca 500, nunca se cuela)', () => {
  const aoa = [headerConD(), ['2025-07', 'AUDIFONOS', -1, 2, 0, 50, 51]];
  const res = inasistenciaParseFilas(aoa);
  assert.equal(res.filas, undefined);
  assert.ok(res.avisos.some((a) => /numeros enteros no negativos/.test(a)));
});

test('inasistenciaParseFilas: falta una columna obligatoria -> error explicito, nunca 500', () => {
  const aoa = [['MES', 'ESPECIALIDAD', 'CANCELADA'], ['2025-04', 'AUDIFONOS', 10]];
  const res = inasistenciaParseFilas(aoa);
  assert.match(res.error, /Faltan columnas obligatorias/);
});

test('inasistenciaParseFilas: hoja vacia -> error explicito', () => {
  assert.match(inasistenciaParseFilas([]).error, /vacio/);
  assert.match(inasistenciaParseFilas(null).error, /vacio/);
});

// ── Helpers de payload/etiqueta ──────────────────────────────────────────
test('inasistenciaFilaComoArray: orden fijo [mes, especialidad, cancelada, inasistencia, pendiente, atendidas, total]', () => {
  const fila = { mes: '2026-08', especialidad: 'AUDIFONOS', cancelada: 475, inasistencia: 109, pendiente: 10, atendidas: 2270, total: 2864 };
  assert.deepEqual(inasistenciaFilaComoArray(fila), ['2026-08', 'AUDIFONOS', 475, 109, 10, 2270, 2864]);
});

test('inasistenciaMesesDeFilas: distintos, ordenados, sin duplicados', () => {
  const filas = [{ mes: '2026-09' }, { mes: '2026-08' }, { mes: '2026-08' }];
  assert.deepEqual(inasistenciaMesesDeFilas(filas), ['2026-08', '2026-09']);
});

test('inasistenciaMesLbl: AAAA-MM -> "Ago-26"', () => {
  assert.equal(inasistenciaMesLbl('2026-08'), 'Ago-26');
  assert.equal(inasistenciaMesLbl('2026-09'), 'Sep-26');
});

test('INASISTENCIA_COLUMNAS: ESPECIALIDAD tiene "ESPECIALIDA" como alias, AÑO es opcional', () => {
  const esp = INASISTENCIA_COLUMNAS.find((c) => c.key === 'especialidad');
  assert.ok(esp.labelAlt.includes('ESPECIALIDA'));
  const anio = INASISTENCIA_COLUMNAS.find((c) => c.key === 'anio');
  assert.equal(anio.obligatoria, false);
});

// ── "Por mes" (Fase 101, sub-pestaña PRINCIPAL): agregado de todas las
// especialidades juntas, % PONDERADO (nunca el promedio simple de los % de
// cada especialidad) -- numeros de control de Ago-26 (5.893 citas, 332
// inasistencias+pendientes, 5,63 %). Datos SIEMPRE inventados (2
// especialidades ficticias cuya suma cuadra con el total real de control),
// nunca el desglose real de ORLANT.
test('inasistenciaAgregarPorMes: suma TODAS las especialidades del mes y calcula el % PONDERADO (5,63 %, no el promedio simple ~9,39 %)', () => {
  const filas = [
    { mes: '2026-08', especialidad: 'ESPECIALIDAD GRANDE', cancelada: 0, inasistencia: 200, pendiente: 0, atendidas: 4800, total: 5000 },
    { mes: '2026-08', especialidad: 'ESPECIALIDAD CHICA', cancelada: 0, inasistencia: 132, pendiente: 0, atendidas: 761, total: 893 },
  ];
  const agregado = inasistenciaAgregarPorMes(filas);
  assert.equal(agregado.length, 1);
  assert.equal(agregado[0].mes, '2026-08');
  assert.equal(agregado[0].total, 5893);
  assert.equal(agregado[0].inasistenciaPendiente, 332);
  assert.equal(agregado[0].pct, 5.63); // 332/5893*100, ponderado

  // El promedio simple de los % de cada especialidad (4,00 % y 14,78 %) da
  // ~9,39 % -- bien distinto del 5,63 % ponderado. Confirma que
  // inasistenciaAgregarPorMes NUNCA promedia los % por especialidad.
  const pctGrande = Math.round((200 / 5000) * 10000) / 100;
  const pctChica = Math.round((132 / 893) * 10000) / 100;
  const promedioSimple = Math.round(((pctGrande + pctChica) / 2) * 100) / 100;
  assert.equal(promedioSimple, 9.39);
  assert.notEqual(agregado[0].pct, promedioSimple);
});

test('inasistenciaAgregarPorMes: un mes por fila, ordenados asc, con las especialidades que aportaron datos', () => {
  const filas = [
    { mes: '2026-09', especialidad: 'EXAMENES ESPECIALES', cancelada: 1, inasistencia: 50, pendiente: 46, atendidas: 1386, total: 1483 },
    { mes: '2026-08', especialidad: 'AUDIFONOS', cancelada: 0, inasistencia: 10, pendiente: 0, atendidas: 90, total: 100 },
    { mes: '2026-08', especialidad: 'AUDIOLOGIA', cancelada: 0, inasistencia: 5, pendiente: 0, atendidas: 95, total: 100 },
  ];
  const agregado = inasistenciaAgregarPorMes(filas);
  assert.deepEqual(agregado.map((a) => a.mes), ['2026-08', '2026-09']);
  assert.deepEqual(agregado[0].especialidades, ['AUDIFONOS', 'AUDIOLOGIA']);
  assert.deepEqual(agregado[1].especialidades, ['EXAMENES ESPECIALES']);
});

test('inasistenciaAgregarPorMes: sin filas -> sin meses', () => {
  assert.deepEqual(inasistenciaAgregarPorMes([]), []);
  assert.deepEqual(inasistenciaAgregarPorMes(undefined), []);
});

// ── Aviso de mes incompleto (Fase 101, debajo de la grafica "Por mes") ──
test('inasistenciaMesesIncompletos: un mes con MENOS especialidades que el mas completo del rango queda marcado -- ej. real "Sep-26: solo incluye Examenes Especiales"', () => {
  const agregado = inasistenciaAgregarPorMes([
    { mes: '2026-08', especialidad: 'AUDIFONOS', cancelada: 0, inasistencia: 1, pendiente: 0, atendidas: 9, total: 10 },
    { mes: '2026-08', especialidad: 'AUDIOLOGIA', cancelada: 0, inasistencia: 1, pendiente: 0, atendidas: 9, total: 10 },
    { mes: '2026-08', especialidad: 'EXAMENES ESPECIALES', cancelada: 0, inasistencia: 1, pendiente: 0, atendidas: 9, total: 10 },
    { mes: '2026-09', especialidad: 'EXAMENES ESPECIALES', cancelada: 1, inasistencia: 50, pendiente: 46, atendidas: 1386, total: 1483 },
  ]);
  const incompletos = inasistenciaMesesIncompletos(agregado);
  assert.equal(incompletos.length, 1);
  assert.equal(incompletos[0].mes, '2026-09');
  assert.deepEqual(incompletos[0].especialidades, ['EXAMENES ESPECIALES']);
});

test('inasistenciaMesesIncompletos: todos los meses con el mismo numero de especialidades -> ningun aviso', () => {
  const agregado = inasistenciaAgregarPorMes([
    { mes: '2026-08', especialidad: 'AUDIFONOS', cancelada: 0, inasistencia: 1, pendiente: 0, atendidas: 9, total: 10 },
    { mes: '2026-08', especialidad: 'AUDIOLOGIA', cancelada: 0, inasistencia: 1, pendiente: 0, atendidas: 9, total: 10 },
    { mes: '2026-09', especialidad: 'AUDIFONOS', cancelada: 0, inasistencia: 1, pendiente: 0, atendidas: 9, total: 10 },
    { mes: '2026-09', especialidad: 'AUDIOLOGIA', cancelada: 0, inasistencia: 1, pendiente: 0, atendidas: 9, total: 10 },
  ]);
  assert.deepEqual(inasistenciaMesesIncompletos(agregado), []);
});

test('inasistenciaMesesIncompletos: sin meses -> sin avisos', () => {
  assert.deepEqual(inasistenciaMesesIncompletos([]), []);
});
