// agendas-logic.test.js — cubre public/js/agendas-logic.js (parseo de la
// hoja AGENDAS de ORLANT + regla de privacidad de NOMBRE_ENTIDAD). Datos
// SIEMPRE inventados (nunca el archivo real de Edwin, que tiene nombres de
// pacientes -- ver docs de la Fase 78).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  AGENDAS_ORDEN_ARRAY,
  agendasColIndexMap,
  agendasNormTexto,
  agendasFechaHoraDesdeSerial,
  agendasParseFechaSolicitud,
  agendasParseFilas,
  agendasAplicarPrivacidadEntidad,
  agendasFilaComoArray,
  agendasRangoFechas,
} = require('../../public/js/agendas-logic.js');

const HEADER = ['NOMBRE DE AGENTE', 'SEDE', 'NOMBRE_EXAMEN', 'ESPECIALIDAD', 'PROFESIONAL', 'FECHA_SOLICITUD', 'TIPO DE LINEA', 'NOMBRE_ENTIDAD'];
function fila(over) {
  // 45777.5 = 2025-04-30 12:00:00 (mismo serial de referencia que el test
  // de borde de fin de mes, mas abajo -- verificado contra el archivo real).
  const base = ['ASESOR UNO', 'SEDE CENTRO', 'AUDIOMETRIA', 'AUDIOLOGIA', 'DR PEREZ', 45777.5, 'GENERAL', 'EPS INVENTADA'];
  return Object.assign([], base, over);
}

test('agendasColIndexMap: empareja por nombre de columna, no por posicion', () => {
  const map = agendasColIndexMap(['SEDE', 'NOMBRE DE AGENTE', 'ESPECIALIDAD', 'PROFESIONAL', 'NOMBRE_EXAMEN', 'TIPO DE LINEA', 'FECHA_SOLICITUD', 'NOMBRE_ENTIDAD']);
  assert.equal(map.asesor, 1);
  assert.equal(map.sede, 0);
  assert.equal(map.especialidad, 2);
});

test('agendasNormTexto: quita espacios al inicio/fin y colapsa dobles internos, sin cambiar nada mas', () => {
  assert.equal(agendasNormTexto('  AUDIOLOGIA  '), 'AUDIOLOGIA');
  assert.equal(agendasNormTexto('DR   PEREZ    GOMEZ'), 'DR PEREZ GOMEZ');
  assert.equal(agendasNormTexto('audiologia'), 'audiologia'); // no fuerza mayusculas
  assert.equal(agendasNormTexto(null), '');
  assert.equal(agendasNormTexto(undefined), '');
});

test('conversion: serial de Excel CON hora -> "aaaa-mm-dd hh:mm:ss"', () => {
  // 46266 = 2026-09-01 00:00:00 (mismo punto de referencia que trafico-logic.test.js)
  assert.equal(agendasFechaHoraDesdeSerial(46266), '2026-09-01 00:00:00');
  // +0.5 dia = mediodia
  assert.equal(agendasFechaHoraDesdeSerial(46266.5), '2026-09-01 12:00:00');
  assert.equal(agendasFechaHoraDesdeSerial('no es un numero'), null);
});

test('borde real: 30/04/2025 19:00 sigue siendo abril, no se corre a mayo por redondeo de punto flotante', () => {
  // Serial real tomado del archivo de Edwin (AGENDAS.xlsx, fila de ejemplo):
  // 30/04/2025 19:00:00 -> dias desde 1899-12-30 hasta 2025-04-30 (45777) + 19/24.
  const serial = 45777 + 19 / 24;
  assert.equal(agendasFechaHoraDesdeSerial(serial), '2025-04-30 19:00:00');
  assert.match(agendasFechaHoraDesdeSerial(serial), /^2025-04-30/, 'debe seguir siendo abril, no mayo');
});

test('agendasParseFechaSolicitud: texto dd/mm/aaaa hh:mm:ss (nunca se interpreta como mm/dd)', () => {
  assert.equal(agendasParseFechaSolicitud('30/04/2025 19:00:00'), '2025-04-30 19:00:00');
  assert.equal(agendasParseFechaSolicitud('01/04/2025 08:05'), '2025-04-01 08:05:00'); // sin segundos, default :00
  assert.equal(agendasParseFechaSolicitud('31/13/2025 10:00:00'), null, 'mes 13 invalido');
  assert.equal(agendasParseFechaSolicitud(''), null);
  assert.equal(agendasParseFechaSolicitud('texto raro'), null);
});

test('agendasParseFechaSolicitud: numero (serial) y texto ya normalizado tambien funcionan', () => {
  assert.equal(agendasParseFechaSolicitud(46266), '2026-09-01 00:00:00');
  assert.equal(agendasParseFechaSolicitud('2026-09-01 00:00:00'), '2026-09-01 00:00:00');
  assert.equal(agendasParseFechaSolicitud('46266'), '2026-09-01 00:00:00');
});

test('agendasParseFilas: camino feliz, espacios normalizados en todos los textos', () => {
  const aoa = [HEADER, fila({ 0: '  ASESOR   UNO  ', 2: 'AUDIOMETRIA  TONAL' })];
  const res = agendasParseFilas(aoa);
  assert.ok(!res.error, res.error);
  assert.equal(res.filas.length, 1);
  assert.equal(res.filas[0].asesor, 'ASESOR UNO');
  assert.equal(res.filas[0].examen, 'AUDIOMETRIA TONAL');
  assert.equal(res.filas[0].fechaSolicitud, '2025-04-30 12:00:00');
});

test('agendasParseFilas: columna obligatoria faltante -> error claro diciendo cual falta', () => {
  const headerSinEspecialidad = HEADER.filter((h) => h !== 'ESPECIALIDAD');
  const res = agendasParseFilas([headerSinEspecialidad]);
  assert.ok(res.error);
  assert.match(res.error, /ESPECIALIDAD/);
});

test('agendasParseFilas: fila sin FECHA_SOLICITUD valida se descarta con aviso, no rompe las demas', () => {
  const aoa = [HEADER, fila({ 5: 'no es una fecha' }), fila()];
  const res = agendasParseFilas(aoa);
  assert.ok(!res.error, res.error);
  assert.equal(res.filas.length, 1);
  assert.equal(res.avisos.length, 1);
  assert.match(res.avisos[0], /FECHA_SOLICITUD/);
});

test('agendasParseFilas: TIPO DE LINEA distinto de 3P/GENERAL se descarta con aviso, sin bloquear las demas filas', () => {
  const aoa = [HEADER, fila({ 6: 'OTRA COSA' }), fila()];
  const res = agendasParseFilas(aoa);
  assert.ok(!res.error, res.error);
  assert.equal(res.filas.length, 1);
  assert.equal(res.avisos.length, 1);
  assert.match(res.avisos[0], /TIPO DE LINEA/);
});

test('agendasParseFilas: NOMBRE_ENTIDAD vacia -> se guarda como "SIN ENTIDAD"', () => {
  const aoa = [HEADER, fila({ 7: '' }), fila({ 7: '   ' })];
  const res = agendasParseFilas(aoa);
  assert.ok(!res.error, res.error);
  assert.equal(res.filas.length, 2);
  res.filas.forEach((f) => assert.equal(f.entidad, 'SIN ENTIDAD'));
  assert.equal(res.entidadesSinDato, 2);
});

test('agendasParseFilas: filas vacias intermedias (fila en blanco en el Excel) se ignoran sin generar aviso', () => {
  const aoa = [HEADER, fila(), ['', '', '', '', '', '', '', ''], fila()];
  const res = agendasParseFilas(aoa);
  assert.ok(!res.error, res.error);
  assert.equal(res.filas.length, 2);
  assert.equal(res.avisos.length, 0);
});

// ── Privacidad de NOMBRE_ENTIDAD (regla obligatoria) ────────────────────
test('agendasAplicarPrivacidadEntidad: entidad con menos de 5 registros en el archivo -> "PARTICULAR / OTRA", el valor original NUNCA queda en el resultado', () => {
  const filas = [
    { entidad: 'JUAN PEREZ PACIENTE' }, { entidad: 'JUAN PEREZ PACIENTE' },
    { entidad: 'JUAN PEREZ PACIENTE' }, // 3 veces, < 5
    { entidad: 'EPS GRANDE' }, { entidad: 'EPS GRANDE' }, { entidad: 'EPS GRANDE' },
    { entidad: 'EPS GRANDE' }, { entidad: 'EPS GRANDE' }, // 5 veces, >= 5
  ];
  const { filas: out, entidadesAgrupadas } = agendasAplicarPrivacidadEntidad(filas);
  assert.equal(entidadesAgrupadas, 3);
  out.slice(0, 3).forEach((f) => assert.equal(f.entidad, 'PARTICULAR / OTRA'));
  out.slice(3).forEach((f) => assert.equal(f.entidad, 'EPS GRANDE'));
  // El nombre original nunca aparece en NINGUNA fila del resultado.
  assert.ok(out.every((f) => f.entidad !== 'JUAN PEREZ PACIENTE'));
  assert.ok(JSON.stringify(out).indexOf('JUAN PEREZ PACIENTE') === -1);
});

test('agendasAplicarPrivacidadEntidad: umbral es EXACTO -- 4 se agrupa, 5 se conserva', () => {
  const cuatro = Array.from({ length: 4 }, () => ({ entidad: 'ENTIDAD CUATRO' }));
  const cinco = Array.from({ length: 5 }, () => ({ entidad: 'ENTIDAD CINCO' }));
  const { filas: out } = agendasAplicarPrivacidadEntidad(cuatro.concat(cinco));
  out.slice(0, 4).forEach((f) => assert.equal(f.entidad, 'PARTICULAR / OTRA'));
  out.slice(4).forEach((f) => assert.equal(f.entidad, 'ENTIDAD CINCO'));
});

test('agendasAplicarPrivacidadEntidad: vacia -> "SIN ENTIDAD" (no cuenta como agrupada por umbral)', () => {
  const filas = [{ entidad: '' }, { entidad: '' }];
  const { filas: out, entidadesAgrupadas, entidadesSinDato } = agendasAplicarPrivacidadEntidad(filas);
  out.forEach((f) => assert.equal(f.entidad, 'SIN ENTIDAD'));
  assert.equal(entidadesSinDato, 2);
  assert.equal(entidadesAgrupadas, 0);
});

test('agendasParseFilas: integra la privacidad -- una entidad que aparece 1 sola vez en el archivo sale como PARTICULAR / OTRA en el resultado final', () => {
  const aoa = [HEADER, fila({ 7: 'CLINICA UNICA RARA' })];
  const res = agendasParseFilas(aoa);
  assert.ok(!res.error, res.error);
  assert.equal(res.filas[0].entidad, 'PARTICULAR / OTRA');
  assert.equal(res.entidadesAgrupadas, 1);
});

test('agendasFilaComoArray: respeta AGENDAS_ORDEN_ARRAY, para el payload compacto que se manda al servidor', () => {
  const f = { asesor: 'A', sede: 'S', examen: 'E', especialidad: 'ESP', profesional: 'P', fechaSolicitud: '2025-04-01 08:00:00', tipoLinea: 'GENERAL', entidad: 'ENT' };
  const arr = agendasFilaComoArray(f);
  assert.deepEqual(AGENDAS_ORDEN_ARRAY, ['asesor', 'sede', 'examen', 'especialidad', 'profesional', 'fechaSolicitud', 'tipoLinea', 'entidad']);
  assert.deepEqual(arr, ['A', 'S', 'E', 'ESP', 'P', '2025-04-01 08:00:00', 'GENERAL', 'ENT']);
});

test('agendasRangoFechas: primera y ultima FECHA_SOLICITUD entre las filas (define el periodo a reemplazar)', () => {
  const filas = [
    { fechaSolicitud: '2025-04-15 10:00:00' },
    { fechaSolicitud: '2025-04-01 08:00:00' },
    { fechaSolicitud: '2025-04-30 19:00:00' },
  ];
  assert.deepEqual(agendasRangoFechas(filas), { desde: '2025-04-01 08:00:00', hasta: '2025-04-30 19:00:00' });
});

test('agendasRangoFechas: sin filas -> null', () => {
  assert.equal(agendasRangoFechas([]), null);
});
