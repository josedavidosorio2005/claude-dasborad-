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
  inasistenciaRangoLbl,
  inasistenciaAvisosPorMes,
  inasistenciaOrdenarBaseBaja,
  inasistenciaNormSede,
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

// Fase 130 (Parte 2): el archivo real de ago-sep/2026 trae el encabezado de
// fecha como "FECHA CITA" (con espacio), no "FECHA_CITA" (guion bajo) --
// ambos deben resolver a la misma columna.
test('inasistenciaColIndexMap: FECHA_CITA y "FECHA CITA" (con espacio, archivo real ago-sep/2026) resuelven a la misma columna', () => {
  assert.equal(inasistenciaColIndexMap(header()).fecha, 2);
  assert.equal(inasistenciaColIndexMap(['SEDE', 'ESPECIALIDAD', 'FECHA CITA', 'NOMBRE ENTIDAD', 'CITEST']).fecha, 2);
});

test('INASISTENCIA_COLUMNAS: FECHA_CITA tiene "FECHA CITA" como alias', () => {
  const fecha = INASISTENCIA_COLUMNAS.find((c) => c.key === 'fecha');
  assert.ok(fecha.labelAlt.includes('FECHA CITA'));
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

// Fase 129 (hallazgo real en producción, archivo real de 83.006 filas):
// la carga consolidada lee el Excel con `cellNF:true` (necesario para
// Trafico) -- en la versión vendorizada de SheetJS de este repo, eso
// hace que una celda de FECHA_CITA con formato de fecha llegue como un
// objeto `Date` nativo, no como el serial numérico de siempre. Antes de
// este fix, esa rama no existía y TODAS las filas del archivo real
// quedaban "invalidas", disparando el rechazo completo de la carga
// ("Ninguna fila valida") con un archivo perfectamente bueno.
test('inasistenciaParseFechaCita: objeto Date nativo (SheetJS con cellNF:true) -> AAAA-MM-DD, mismo resultado que el serial equivalente', () => {
  assert.equal(inasistenciaParseFechaCita(new Date(2026, 1, 27)), '2026-02-27'); // mes 1 = febrero (0-indexado)
  assert.equal(inasistenciaParseFechaCita(new Date(2026, 7, 5)), '2026-08-05');
  // Mismo resultado sin importar la hora que traiga el objeto (solo
  // interesa la fecha local, nunca la hora) -- replica el caso real
  // observado (serial con un resto de horas, ej. "05:00:00Z" en una
  // maquina en America/Bogota).
  assert.equal(inasistenciaParseFechaCita(new Date(2026, 1, 27, 5, 0, 0)), '2026-02-27');
});

test('inasistenciaParseFechaCita: un Date invalido (Invalid Date) -> null', () => {
  assert.equal(inasistenciaParseFechaCita(new Date('esto-no-es-una-fecha')), null);
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

// Fase 130 (Parte 2): el archivo real de ago-sep/2026 trae SEDE 34 como
// "SEDE 34 (AUDIFONOS)" -- una sola sede, nunca partida en 2 valores de
// filtro distintos solo por la aclaracion entre parentesis.
test('inasistenciaNormSede: quita un parentesis final, nunca uno en medio del nombre', () => {
  assert.equal(inasistenciaNormSede('SEDE 34 (AUDIFONOS)'), 'SEDE 34');
  assert.equal(inasistenciaNormSede('  SEDE 34 (AUDIFONOS)  '), 'SEDE 34');
  assert.equal(inasistenciaNormSede('SEDE PRINCIPAL'), 'SEDE PRINCIPAL');
  assert.equal(inasistenciaNormSede('SEDE (CENTRO) 34'), 'SEDE (CENTRO) 34');
  assert.equal(inasistenciaNormSede(''), '');
  assert.equal(inasistenciaNormSede(null), '');
});

test('inasistenciaParseFilas: SEDE 34 (AUDIFONOS) y SEDE 34 agregan a LA MISMA sede, nunca a 2 valores distintos', () => {
  const aoa = [
    header(),
    ['SEDE 34 (AUDIFONOS)', 'AUDIFONOS', 46234, 'EPS UNO', 'T'],
    ['SEDE 34', 'AUDIFONOS', 46234, 'EPS UNO', 'T'],
  ];
  const res = inasistenciaParseFilas(aoa, AHORA);
  assert.equal(res.error, undefined, JSON.stringify(res));
  assert.equal(res.filas.length, 1);
  assert.equal(res.filas[0].sede, 'SEDE 34');
  assert.equal(res.filas[0].total, 2);
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

// ── Fase 109: rango de la tarjeta del periodo ────────────────────────────
test('inasistenciaRangoLbl: varios meses -> "Ene-26 a Sep-26"', () => {
  const agregado = inasistenciaAgregarPorMes([
    { mes: '2026-01', especialidad: 'AUDIFONOS', cancelada: 0, inasistencia: 1, pendiente: 0, atendidas: 9, total: 10 },
    { mes: '2026-09', especialidad: 'AUDIFONOS', cancelada: 0, inasistencia: 1, pendiente: 0, atendidas: 9, total: 10 },
  ]);
  assert.equal(inasistenciaRangoLbl(agregado), 'Ene-26 a Sep-26');
});

test('inasistenciaRangoLbl: un solo mes -> solo ese mes, sin "a"', () => {
  const agregado = inasistenciaAgregarPorMes([
    { mes: '2026-08', especialidad: 'AUDIFONOS', cancelada: 0, inasistencia: 1, pendiente: 0, atendidas: 9, total: 10 },
  ]);
  assert.equal(inasistenciaRangoLbl(agregado), 'Ago-26');
});

test('inasistenciaRangoLbl: sin meses -> ""', () => {
  assert.equal(inasistenciaRangoLbl([]), '');
});

// ── Fase 109: avisos por mes (parcial / incompleto / sin datos por filtro) ──
test('inasistenciaAvisosPorMes: un mes 100% formato viejo se marca "parcial", nunca tambien "incompleto"', () => {
  const agregado = inasistenciaAgregarPorMes([
    { mes: '2026-08', especialidad: 'AUDIFONOS', cancelada: 0, inasistencia: 1, pendiente: 0, atendidas: 9, total: 10 },
    { mes: '2026-08', especialidad: 'AUDIOLOGIA', cancelada: 0, inasistencia: 1, pendiente: 0, atendidas: 9, total: 10 },
    { mes: '2026-09', especialidad: 'EXAMENES ESPECIALES', cancelada: 1, inasistencia: 50, pendiente: 46, atendidas: 1386, total: 1483 },
  ]);
  const avisos = inasistenciaAvisosPorMes(agregado, ['2026-08', '2026-09'], ['2026-09']);
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].mes, '2026-09');
  assert.equal(avisos[0].tipo, 'parcial');
  assert.deepEqual(avisos[0].especialidades, ['EXAMENES ESPECIALES']);
});

// Fase 130 (Parte 3, pedido de Edwin): un mes con MENOS especialidades que
// otro (pero con datos reales, sede/entidad reales) ya NO se marca como
// aviso -- con archivos reales completos mes a mes, esa diferencia es una
// variacion de negocio normal (esa especialidad no opero ese mes), no un
// dato incompleto. Reemplaza el test viejo de "se marca incompleto".
test('inasistenciaAvisosPorMes: un mes con menos especialidades que otro, pero con datos reales, NO genera aviso (Fase 130)', () => {
  const agregado = inasistenciaAgregarPorMes([
    { mes: '2026-08', especialidad: 'AUDIFONOS', cancelada: 0, inasistencia: 1, pendiente: 0, atendidas: 9, total: 10 },
    { mes: '2026-08', especialidad: 'AUDIOLOGIA', cancelada: 0, inasistencia: 1, pendiente: 0, atendidas: 9, total: 10 },
    { mes: '2026-09', especialidad: 'AUDIFONOS', cancelada: 1, inasistencia: 50, pendiente: 46, atendidas: 1386, total: 1483 },
  ]);
  // '2026-09' NO esta en mesesFormatoViejo -- tiene datos reales, solo que menos especialidades.
  const avisos = inasistenciaAvisosPorMes(agregado, ['2026-08', '2026-09'], []);
  assert.deepEqual(avisos, []);
});

test('inasistenciaAvisosPorMes: un mes que existe en el universo pero el filtro lo dejo sin filas -> "sinDatosFiltro"', () => {
  const agregado = inasistenciaAgregarPorMes([
    { mes: '2026-08', especialidad: 'AUDIFONOS', cancelada: 0, inasistencia: 1, pendiente: 0, atendidas: 9, total: 10 },
  ]);
  // '2026-09' esta en mesesTodos (el universo SIN filtrar) pero no aparece en `agregado` (el filtro activo lo excluyo).
  const avisos = inasistenciaAvisosPorMes(agregado, ['2026-08', '2026-09'], []);
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].mes, '2026-09');
  assert.equal(avisos[0].tipo, 'sinDatosFiltro');
});

test('inasistenciaAvisosPorMes: todos los meses completos y sin filtro que excluya nada -> ningun aviso', () => {
  const agregado = inasistenciaAgregarPorMes([
    { mes: '2026-08', especialidad: 'AUDIFONOS', cancelada: 0, inasistencia: 1, pendiente: 0, atendidas: 9, total: 10 },
    { mes: '2026-09', especialidad: 'AUDIFONOS', cancelada: 0, inasistencia: 1, pendiente: 0, atendidas: 9, total: 10 },
  ]);
  assert.deepEqual(inasistenciaAvisosPorMes(agregado, ['2026-08', '2026-09'], []), []);
});

test('inasistenciaAvisosPorMes: sin agregado ni universo -> sin avisos', () => {
  assert.deepEqual(inasistenciaAvisosPorMes([], [], []), []);
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

// ── Fase 109: numeros de control reales de ORLANT (Ene-26 a Sep-26) ────────
// Agregados por mes (cancelada/inasistencia/pendiente/atendidas/total) --
// NUNCA datos de paciente, son las mismas sumas mensuales ya publicadas en
// PROGRESS.md (Fase 108, carga real verificada en produccion). Esta
// prueba fija (pin) que el calculo y la grafica de linea de la Fase 109
// siguen dando exactamente esos % -- si alguien toca la formula ponderada
// sin querer, esta prueba se rompe antes de llegar a produccion.
test('Fase 109: % por mes y % del periodo completo coinciden EXACTO con la tabla de control de ORLANT (Ene-26 a Sep-26)', () => {
  const filas = [
    { mes: '2026-01', especialidad: 'TODAS', cancelada: 1666, inasistencia: 463, pendiente: 103, atendidas: 6579, total: 8811 },
    { mes: '2026-02', especialidad: 'TODAS', cancelada: 1719, inasistencia: 610, pendiente: 21, atendidas: 7176, total: 9526 },
    { mes: '2026-03', especialidad: 'TODAS', cancelada: 1751, inasistencia: 735, pendiente: 19, atendidas: 7509, total: 10014 },
    { mes: '2026-04', especialidad: 'TODAS', cancelada: 1941, inasistencia: 675, pendiente: 30, atendidas: 7302, total: 9948 },
    { mes: '2026-05', especialidad: 'TODAS', cancelada: 1826, inasistencia: 630, pendiente: 78, atendidas: 7293, total: 9827 },
    { mes: '2026-06', especialidad: 'TODAS', cancelada: 2244, inasistencia: 637, pendiente: 60, atendidas: 7972, total: 10913 },
    { mes: '2026-07', especialidad: 'TODAS', cancelada: 2827, inasistencia: 742, pendiente: 70, atendidas: 9139, total: 12778 },
    { mes: '2026-08', especialidad: 'TODAS', cancelada: 2459, inasistencia: 786, pendiente: 48, atendidas: 7896, total: 11189 },
    { mes: '2026-09', especialidad: 'EXAMENES ESPECIALES', cancelada: 452, inasistencia: 94, pendiente: 2, atendidas: 935, total: 1483 },
  ];
  const agregado = inasistenciaAgregarPorMes(filas);
  const CONTROL = {
    '2026-01': 6.42, '2026-02': 6.62, '2026-03': 7.53, '2026-04': 7.09,
    '2026-05': 7.20, '2026-06': 6.39, '2026-07': 6.35, '2026-08': 7.45, '2026-09': 6.47,
  };
  agregado.forEach((a) => assert.equal(a.pct, CONTROL[a.mes], `pct de ${a.mes}`));

  // El total del periodo completo (Σ(I+P)/Σtotal de los 9 meses) = 6,87 %.
  assert.equal(inasistenciaPonderadoTotal(agregado).pct, 6.87);
  assert.equal(inasistenciaRangoLbl(agregado), 'Ene-26 a Sep-26');

  // El mes elegido (Ago-26, ej. el del selector global): su propia tarjeta
  // muestra su % individual, nunca el del periodo completo.
  const delMesElegido = agregado.find((a) => a.mes === '2026-08');
  assert.equal(delMesElegido.pct, 7.45);

  // Sep-26 (formato viejo, sede/entidad='SIN DATO' en la base real) queda
  // marcado 'parcial' -- nunca tambien 'incompleto'.
  const avisos = inasistenciaAvisosPorMes(agregado, Object.keys(CONTROL), ['2026-09']);
  assert.deepEqual(avisos, [{ mes: '2026-09', tipo: 'parcial', especialidades: ['EXAMENES ESPECIALES'] }]);
});
