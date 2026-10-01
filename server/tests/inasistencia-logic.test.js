// inasistencia-logic.test.js — Fase 98 (ORLANT, pedido urgente de Edwin);
// reescrito en la Fase 108 (pedido textual de InCo: "la inasistencia va a
// ser por mes, que se pueda filtrar por sede, especialidad, nombre
// entidad"). Logica PURA de parseo de la hoja INASISTENCIA/Hoja1 (public/
// js/inasistencia-logic.js) -- el archivo real ahora trae UNA FILA POR
// CITA (SEDE, ESPECIALIDAD/ESPECIALIDA, FECHA_CITA, NOMBRE ENTIDAD,
// CITEST), que el navegador agrega a (mes,sede,especialidad,entidad) antes
// de mandarla al servidor. Datos SIEMPRE inventados (los numeros de
// control del archivo real de InCo se usan como EJEMPLO numerico, nunca el
// archivo en si).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  INASISTENCIA_COLUMNAS,
  INASISTENCIA_ORDEN_ARRAY,
  inasistenciaColIndexMap,
  inasistenciaParseFechaCita,
  inasistenciaParseFilas,
  inasistenciaFilaComoArray,
  inasistenciaMesesDeFilas,
  inasistenciaMesLbl,
  inasistenciaPctPonderado,
  inasistenciaPonderadoTotal,
  inasistenciaAgregarPorMes,
  inasistenciaMesesIncompletos,
  inasistenciaOrdenarBaseBaja,
} = require('../../public/js/inasistencia-logic.js');

// "Hoy" fijo para que el rechazo de fecha futura sea determinista.
const AHORA = new Date('2026-09-30T15:00:00Z');

function header(){
  return ['SEDE', 'ESPECIALIDAD', 'FECHA_CITA', 'NOMBRE ENTIDAD', 'CITEST'];
}
function headerEspecialidadTruncada(){
  return ['SEDE', 'ESPECIALIDA', 'FECHA_CITA', 'NOMBRE ENTIDAD', 'CITEST'];
}

// ── inasistenciaColIndexMap / columnas ───────────────────────────────────
test('inasistenciaColIndexMap: ESPECIALIDAD y ESPECIALIDA (sin la D, archivo real) resuelven a la misma columna', () => {
  assert.equal(inasistenciaColIndexMap(header()).especialidad, 1);
  assert.equal(inasistenciaColIndexMap(headerEspecialidadTruncada()).especialidad, 1);
});

test('INASISTENCIA_COLUMNAS: las 5 son obligatorias, ESPECIALIDAD tiene "ESPECIALIDA" como alias', () => {
  assert.ok(INASISTENCIA_COLUMNAS.every((c) => c.obligatoria));
  const esp = INASISTENCIA_COLUMNAS.find((c) => c.key === 'especialidad');
  assert.ok(esp.labelAlt.includes('ESPECIALIDA'));
});

test('INASISTENCIA_ORDEN_ARRAY: orden fijo [mes, sede, especialidad, entidad, cancelada, inasistencia, pendiente, atendidas, total]', () => {
  assert.deepEqual(INASISTENCIA_ORDEN_ARRAY, ['mes', 'sede', 'especialidad', 'entidad', 'cancelada', 'inasistencia', 'pendiente', 'atendidas', 'total']);
});

// ── inasistenciaParseFechaCita ───────────────────────────────────────────
test('inasistenciaParseFechaCita: serial de Excel -> AAAA-MM-DD', () => {
  assert.equal(inasistenciaParseFechaCita(46234), '2026-07-31');
  assert.equal(inasistenciaParseFechaCita(46235), '2026-08-01');
});

test('inasistenciaParseFechaCita: texto "dd/mm/aaaa" -> AAAA-MM-DD (nunca interpretado como mm/dd, Fase 90)', () => {
  assert.equal(inasistenciaParseFechaCita('05/08/2026'), '2026-08-05');
  assert.equal(inasistenciaParseFechaCita('31/01/2026'), '2026-01-31'); // dia 31 -- imposible como "mes" en mm/dd
});

test('inasistenciaParseFechaCita: texto ISO -> se recorta a AAAA-MM-DD', () => {
  assert.equal(inasistenciaParseFechaCita('2026-08-15T00:00:00'), '2026-08-15');
});

test('inasistenciaParseFechaCita: invalida -> null', () => {
  assert.equal(inasistenciaParseFechaCita('no es una fecha'), null);
  assert.equal(inasistenciaParseFechaCita(''), null);
  assert.equal(inasistenciaParseFechaCita(null), null);
});

// ── inasistenciaParseFilas: columnas/estructura ──────────────────────────
test('inasistenciaParseFilas: falta una columna obligatoria -> error explicito, nunca 500', () => {
  const aoa = [['SEDE', 'ESPECIALIDAD', 'FECHA_CITA'], ['SEDE 1', 'AUDIFONOS', 46234]];
  assert.match(inasistenciaParseFilas(aoa).error, /Faltan columnas obligatorias/);
});

test('inasistenciaParseFilas: hoja vacia -> error explicito', () => {
  assert.match(inasistenciaParseFilas([]).error, /vacio/);
  assert.match(inasistenciaParseFilas(null).error, /vacio/);
});

test('inasistenciaParseFilas: filas vacias se ignoran (no generan aviso ni error)', () => {
  const aoa = [
    header(),
    ['SEDE 1', 'AUDIFONOS', 46234, 'EPS UNO', 'T'],
    ['', '', '', '', ''],
    [null, null, null, null, null],
    ['SEDE 1', 'AUDIFONOS', 46234, 'EPS UNO', 'T'],
  ];
  const res = inasistenciaParseFilas(aoa, AHORA);
  assert.equal(res.error, undefined, JSON.stringify(res));
  // Las 2 filas reales agregan a UNA sola fila (misma mes/sede/especialidad/entidad).
  assert.equal(res.filas.length, 1);
  assert.equal(res.filas[0].total, 2);
});

test('inasistenciaParseFilas: fecha invalida -> fila omitida con aviso', () => {
  const aoa = [header(), ['SEDE 1', 'AUDIFONOS', 'no es fecha', 'EPS UNO', 'T']];
  const res = inasistenciaParseFilas(aoa, AHORA);
  assert.equal(res.filas, undefined);
  assert.ok(res.avisos.some((a) => /invalida/.test(a)));
});

test('inasistenciaParseFilas: fecha futura se rechaza (defensa igual a Agendas/Tipificacion) -- la fila se omite con aviso', () => {
  const aoa = [header(), ['SEDE 1', 'AUDIFONOS', '15/01/2030', 'EPS UNO', 'T']];
  const res = inasistenciaParseFilas(aoa, AHORA);
  assert.equal(res.filas, undefined);
  assert.ok(res.avisos.some((a) => /futuro/.test(a)));
});

test('inasistenciaParseFilas: SEDE/ESPECIALIDAD vacias se guardan igual, agrupadas como "SIN SEDE"/"SIN ESPECIALIDAD"', () => {
  const aoa = [header(), ['', '', 46234, 'EPS UNO', 'T']];
  const res = inasistenciaParseFilas(aoa, AHORA);
  assert.equal(res.error, undefined, JSON.stringify(res));
  assert.equal(res.filas[0].sede, 'SIN SEDE');
  assert.equal(res.filas[0].especialidad, 'SIN ESPECIALIDAD');
  assert.ok(res.avisos.some((a) => /SIN SEDE/.test(a)));
  assert.ok(res.avisos.some((a) => /SIN ESPECIALIDAD/.test(a)));
});

test('inasistenciaParseFilas: NOMBRE ENTIDAD vacio -> "SIN ENTIDAD" (nunca se descarta la cita)', () => {
  const aoa = [header(), ['SEDE 1', 'AUDIFONOS', 46234, '', 'T']];
  const res = inasistenciaParseFilas(aoa, AHORA);
  assert.equal(res.filas[0].entidad, 'SIN ENTIDAD');
});

// ── CITEST ────────────────────────────────────────────────────────────────
test('inasistenciaParseFilas: C/I/P/T mapean a cancelada/inasistencia/pendiente/atendidas', () => {
  const aoa = [
    header(),
    ['SEDE 1', 'AUDIFONOS', 46234, 'EPS UNO', 'C'],
    ['SEDE 1', 'AUDIFONOS', 46234, 'EPS UNO', 'I'],
    ['SEDE 1', 'AUDIFONOS', 46234, 'EPS UNO', 'P'],
    ['SEDE 1', 'AUDIFONOS', 46234, 'EPS UNO', 'T'],
  ];
  const res = inasistenciaParseFilas(aoa, AHORA);
  const f = res.filas[0]; // misma mes/sede/especialidad/entidad -> 1 sola fila agregada
  assert.equal(f.cancelada, 1);
  assert.equal(f.inasistencia, 1);
  assert.equal(f.pendiente, 1);
  assert.equal(f.atendidas, 1);
  assert.equal(f.total, 4);
});

test('inasistenciaParseFilas: CITEST desconocido por debajo del umbral de rechazo -- se omite esa fila con aviso, el resto se guarda', () => {
  const aoa = [header()];
  for (let i = 0; i < 95; i++) aoa.push(['SEDE 1', 'AUDIFONOS', 46234, 'EPS UNO', 'T']);
  for (let i = 0; i < 5; i++) aoa.push(['SEDE 1', 'AUDIFONOS', 46234, 'EPS UNO', 'X']); // 5% exacto, no pasa el umbral (>5%)
  const res = inasistenciaParseFilas(aoa, AHORA);
  assert.equal(res.error, undefined, JSON.stringify(res));
  assert.equal(res.filas[0].total, 95);
  assert.ok(res.avisos.some((a) => /CITEST "X" no reconocido/.test(a)));
});

test('inasistenciaParseFilas: CITEST desconocido por ENCIMA del umbral de rechazo -- la carga COMPLETA se rechaza', () => {
  const aoa = [header()];
  for (let i = 0; i < 90; i++) aoa.push(['SEDE 1', 'AUDIFONOS', 46234, 'EPS UNO', 'T']);
  for (let i = 0; i < 10; i++) aoa.push(['SEDE 1', 'AUDIFONOS', 46234, 'EPS UNO', 'X']); // 10% > 5%
  const res = inasistenciaParseFilas(aoa, AHORA);
  assert.equal(res.filas, undefined);
  assert.match(res.error, /CITEST desconocido/);
});

// ── Duplicados exactos: NUNCA se deduplican (a diferencia de Agendas/Tipificacion, Fase 88) ──
test('inasistenciaParseFilas: filas EXACTAMENTE repetidas no se deduplican -- sin id de cita, son 2 citas reales', () => {
  const aoa = [
    header(),
    ['SEDE 1', 'AUDIFONOS', 46234, 'EPS UNO', 'T'],
    ['SEDE 1', 'AUDIFONOS', 46234, 'EPS UNO', 'T'],
    ['SEDE 1', 'AUDIFONOS', 46234, 'EPS UNO', 'T'],
  ];
  const res = inasistenciaParseFilas(aoa, AHORA);
  assert.equal(res.filas.length, 1); // 1 fila agregada...
  assert.equal(res.filas[0].total, 3); // ...pero cuenta las 3 citas, no las colapsa a 1.
});

// ── Agregacion a (mes, sede, especialidad, entidad) ──────────────────────
test('inasistenciaParseFilas: agrega por (mes, sede, especialidad, entidad) -- filas con alguna dimension distinta NO se mezclan', () => {
  const aoa = [
    header(),
    ['SEDE 1', 'AUDIFONOS', 46234, 'EPS UNO', 'T'],
    ['SEDE 2', 'AUDIFONOS', 46234, 'EPS UNO', 'T'], // sede distinta
    ['SEDE 1', 'AUDIOLOGIA', 46234, 'EPS UNO', 'T'], // especialidad distinta
    ['SEDE 1', 'AUDIFONOS', 46265, 'EPS UNO', 'T'], // mes distinto (46265 = 46234+31 dias -> agosto, no julio)
  ];
  const res = inasistenciaParseFilas(aoa, AHORA);
  assert.equal(res.error, undefined, JSON.stringify(res));
  assert.equal(res.filas.length, 4);
  assert.ok(res.filas.every((f) => f.total === 1));
});

test('inasistenciaParseFilas: suma de TODAS las filas agregadas = total de filas de entrada (control de integridad)', () => {
  const aoa = [header()];
  const letras = ['C', 'I', 'P', 'T'];
  for (let i = 0; i < 200; i++) {
    aoa.push(['SEDE ' + (i % 3), 'ESP ' + (i % 5), 46234 + (i % 7), 'ENT ' + (i % 11), letras[i % 4]]);
  }
  const res = inasistenciaParseFilas(aoa, AHORA);
  assert.equal(res.error, undefined, JSON.stringify(res));
  const sumaTotal = res.filas.reduce((a, f) => a + f.total, 0);
  assert.equal(sumaTotal, 200);
});

// ── Privacidad de NOMBRE ENTIDAD (reusa agendasAplicarPrivacidadEntidad, Fase 78) ──
test('inasistenciaParseFilas: entidad con menos de 5 citas en el archivo -> "PARTICULAR / OTRA" (nunca se expone el nombre real)', () => {
  const aoa = [header()];
  for (let i = 0; i < 10; i++) aoa.push(['SEDE 1', 'AUDIFONOS', 46234, 'EPS GRANDE', 'T']); // >=5 -> visible
  for (let i = 0; i < 3; i++) aoa.push(['SEDE 1', 'AUDIFONOS', 46234, 'CLINICA PEQUEÑA', 'T']); // <5 -> agrupada
  const res = inasistenciaParseFilas(aoa, AHORA);
  assert.equal(res.error, undefined, JSON.stringify(res));
  const entidades = res.filas.map((f) => f.entidad);
  assert.ok(entidades.includes('EPS GRANDE'));
  assert.ok(entidades.includes('PARTICULAR / OTRA'));
  assert.ok(!entidades.includes('CLINICA PEQUEÑA'));
  assert.equal(res.entidadesAgrupadas, 3);
  // El total de citas no cambia por la anonimizacion (solo cambia el nombre).
  const sumaTotal = res.filas.reduce((a, f) => a + f.total, 0);
  assert.equal(sumaTotal, 13);
});

// ── Payload compacto ──────────────────────────────────────────────────────
test('inasistenciaFilaComoArray: respeta INASISTENCIA_ORDEN_ARRAY', () => {
  const fila = { mes: '2026-08', sede: 'SEDE 1', especialidad: 'AUDIFONOS', entidad: 'EPS UNO', cancelada: 1, inasistencia: 2, pendiente: 0, atendidas: 7, total: 10 };
  assert.deepEqual(inasistenciaFilaComoArray(fila), ['2026-08', 'SEDE 1', 'AUDIFONOS', 'EPS UNO', 1, 2, 0, 7, 10]);
});

test('inasistenciaMesesDeFilas: distintos, ordenados, sin duplicados', () => {
  assert.deepEqual(inasistenciaMesesDeFilas([{ mes: '2026-09' }, { mes: '2026-08' }, { mes: '2026-08' }]), ['2026-08', '2026-09']);
});

test('inasistenciaMesLbl: AAAA-MM -> "Ago-26"', () => {
  assert.equal(inasistenciaMesLbl('2026-08'), 'Ago-26');
  assert.equal(inasistenciaMesLbl('2026-09'), 'Sep-26');
});

// ── % ponderado ───────────────────────────────────────────────────────────
test('inasistenciaPctPonderado: (inasistencia+pendiente)/total, 2 decimales; total<=0 -> null', () => {
  assert.equal(inasistenciaPctPonderado(109, 10, 2864), 4.16);
  assert.equal(inasistenciaPctPonderado(0, 0, 0), null);
});

test('inasistenciaPonderadoTotal: suma TODO el conjunto (Σ(I+P)/Σtotal), nunca el promedio simple', () => {
  const r = inasistenciaPonderadoTotal([
    { mes: '2026-08', inasistencia: 200, pendiente: 0, total: 5000 },
    { mes: '2026-08', inasistencia: 132, pendiente: 0, total: 893 },
  ]);
  assert.equal(r.total, 5893);
  assert.equal(r.pct, 5.63);
});

// ── "Resumen por mes" ─────────────────────────────────────────────────────
test('inasistenciaAgregarPorMes: suma TODAS las especialidades del mes y calcula el % PONDERADO (nunca el promedio simple)', () => {
  const filas = [
    { mes: '2026-08', especialidad: 'ESPECIALIDAD GRANDE', cancelada: 0, inasistencia: 200, pendiente: 0, atendidas: 4800, total: 5000 },
    { mes: '2026-08', especialidad: 'ESPECIALIDAD CHICA', cancelada: 0, inasistencia: 132, pendiente: 0, atendidas: 761, total: 893 },
  ];
  const agregado = inasistenciaAgregarPorMes(filas);
  assert.equal(agregado.length, 1);
  assert.equal(agregado[0].total, 5893);
  assert.equal(agregado[0].pct, 5.63);
  const promedioSimple = Math.round((((200 / 5000 * 100) + (132 / 893 * 100)) / 2) * 100) / 100;
  assert.notEqual(agregado[0].pct, promedioSimple);
});

test('inasistenciaAgregarPorMes: con UNA sola especialidad en las filas (ej. ya filtrada por el servidor), cada mes refleja solo esa especialidad', () => {
  const filas = [
    { mes: '2026-08', especialidad: 'AUDIFONOS', cancelada: 0, inasistencia: 10, pendiente: 0, atendidas: 90, total: 100 },
    { mes: '2026-09', especialidad: 'AUDIFONOS', cancelada: 0, inasistencia: 20, pendiente: 0, atendidas: 80, total: 100 },
  ];
  const agregado = inasistenciaAgregarPorMes(filas);
  assert.deepEqual(agregado.map((a) => a.pct), [10, 20]);
  assert.deepEqual(agregado.map((a) => a.especialidades), [['AUDIFONOS'], ['AUDIFONOS']]);
});

test('inasistenciaAgregarPorMes: sin filas -> sin meses', () => {
  assert.deepEqual(inasistenciaAgregarPorMes([]), []);
  assert.deepEqual(inasistenciaAgregarPorMes(undefined), []);
});

test('inasistenciaMesesIncompletos: un mes con MENOS especialidades que el mas completo del rango queda marcado', () => {
  const agregado = inasistenciaAgregarPorMes([
    { mes: '2026-08', especialidad: 'AUDIFONOS', cancelada: 0, inasistencia: 1, pendiente: 0, atendidas: 9, total: 10 },
    { mes: '2026-08', especialidad: 'AUDIOLOGIA', cancelada: 0, inasistencia: 1, pendiente: 0, atendidas: 9, total: 10 },
    { mes: '2026-09', especialidad: 'AUDIFONOS', cancelada: 1, inasistencia: 50, pendiente: 46, atendidas: 1386, total: 1483 },
  ]);
  const incompletos = inasistenciaMesesIncompletos(agregado);
  assert.equal(incompletos.length, 1);
  assert.equal(incompletos[0].mes, '2026-09');
});

test('inasistenciaMesesIncompletos: todos los meses con el mismo numero de especialidades -> ningun aviso', () => {
  const agregado = inasistenciaAgregarPorMes([
    { mes: '2026-08', especialidad: 'AUDIFONOS', cancelada: 0, inasistencia: 1, pendiente: 0, atendidas: 9, total: 10 },
    { mes: '2026-09', especialidad: 'AUDIFONOS', cancelada: 0, inasistencia: 1, pendiente: 0, atendidas: 9, total: 10 },
  ]);
  assert.deepEqual(inasistenciaMesesIncompletos(agregado), []);
});

// ── "Por especialidad": base baja ────────────────────────────────────────
test('inasistenciaOrdenarBaseBaja: ordena de mayor a menor %, manda al final las de menos de `umbral` citas, marcadas', () => {
  const filas = [
    { especialidad: 'GRANDE BAJA', pct: 5, total: 1000 },
    { especialidad: 'GRANDE ALTA', pct: 40, total: 1000 },
    { especialidad: 'CHICA EXTREMA', pct: 50, total: 2 }, // base baja: 1 de 2 da un % enganoso
  ];
  const r = inasistenciaOrdenarBaseBaja(filas, 30);
  assert.deepEqual(r.map((f) => f.especialidad), ['GRANDE ALTA', 'GRANDE BAJA', 'CHICA EXTREMA']);
  assert.deepEqual(r.map((f) => f.baseBaja), [false, false, true]);
  // Nunca expone el conteo real (total) en el resultado.
  assert.ok(r.every((f) => !('total' in f)));
});

test('inasistenciaOrdenarBaseBaja: umbral por defecto es 30 si no se pasa uno valido', () => {
  const filas = [{ especialidad: 'A', pct: 10, total: 29 }, { especialidad: 'B', pct: 20, total: 30 }];
  const r = inasistenciaOrdenarBaseBaja(filas);
  assert.equal(r.find((f) => f.especialidad === 'A').baseBaja, true);
  assert.equal(r.find((f) => f.especialidad === 'B').baseBaja, false);
});

test('inasistenciaOrdenarBaseBaja: sin filas -> sin filas', () => {
  assert.deepEqual(inasistenciaOrdenarBaseBaja([], 30), []);
  assert.deepEqual(inasistenciaOrdenarBaseBaja(undefined, 30), []);
});
