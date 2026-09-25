// tipificacion-logic.test.js — cubre public/js/tipificacion-logic.js
// (parseo de las hojas TIPIFICACION_LLAMADAS/TIPIFICACION_WHATSAPP de
// ORLANT). Datos SIEMPRE inventados (nunca el archivo real de Edwin, que
// tiene nombres de asesores reales -- ver docs de la Fase 77).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  TIPIFICACION_ORDEN_ARRAY,
  tipificacionColIndexMap,
  tipificacionNormTexto,
  tipificacionParseFecha,
  tipificacionParseHora,
  tipificacionParseDuracion,
  tipificacionEtiqueta,
  tipificacionParseFilas,
  tipificacionFilaComoArray,
  tipificacionRangoFechas,
} = require('../../public/js/tipificacion-logic.js');

const HEADER = ['AGENT_NAME', 'DATE', 'HORA', 'TIME_MIN', 'DESCRIPTION_COD_ACT', 'SKILL_NAME', 'MES'];
function fila(over) {
  const base = ['ASESOR DEMO UNO', '15/08/2026', '6:06:08 p. m.', 3, 'AGENDADA_InConexion', 'LLAMADAS DE SALIDA', 'Agosto'];
  return Object.assign([], base, over);
}

test('tipificacionColIndexMap: empareja por nombre de columna, no por posicion', () => {
  const map = tipificacionColIndexMap(['SKILL_NAME', 'AGENT_NAME', 'DATE', 'HORA', 'TIME_MIN', 'DESCRIPTION_COD_ACT']);
  assert.equal(map.skill, 0);
  assert.equal(map.agente, 1);
  assert.equal(map.tipificacion, 5);
});

test('tipificacionNormTexto: quita espacios al inicio/fin y colapsa dobles internos, sin cambiar nada mas', () => {
  assert.equal(tipificacionNormTexto('  AGENDADA_InConexion  '), 'AGENDADA_InConexion');
  assert.equal(tipificacionNormTexto('SARA   RAMIREZ    LOPEZ'), 'SARA RAMIREZ LOPEZ');
  assert.equal(tipificacionNormTexto(null), '');
});

// ── DATE ──────────────────────────────────────────────────────────────
test('tipificacionParseFecha: texto dd/mm/aaaa (nunca se interpreta como mm/dd)', () => {
  assert.equal(tipificacionParseFecha('31/08/2026'), '2026-08-31');
  assert.equal(tipificacionParseFecha('01/12/2026'), '2026-12-01');
  assert.equal(tipificacionParseFecha('31/13/2026'), null, 'mes 13 invalido');
  assert.equal(tipificacionParseFecha(''), null);
  assert.equal(tipificacionParseFecha('texto raro'), null);
});

test('tipificacionParseFecha: serial de Excel (mismo punto de referencia que trafico-logic.js: 46266 = 2026-09-01)', () => {
  assert.equal(tipificacionParseFecha(46266), '2026-09-01');
  assert.equal(tipificacionParseFecha('2026-09-01'), '2026-09-01'); // ya normalizada
});

// ── HORA ──────────────────────────────────────────────────────────────
test('tipificacionParseHora: "H:MM:SS p. m." con espacio normal', () => {
  assert.equal(tipificacionParseHora('6:06:08 p. m.'), '18:06:08');
  assert.equal(tipificacionParseHora('11:59:55 a. m.'), '11:59:55');
  assert.equal(tipificacionParseHora('12:00:00 p. m.'), '12:00:00', 'mediodia sigue siendo 12h');
  assert.equal(tipificacionParseHora('12:00:00 a. m.'), '00:00:00', 'medianoche es 0h');
});

test('tipificacionParseHora: espacio NO separable (U+00A0) antes de "m." -- el formato real del archivo de Edwin', () => {
  const conNbsp = '6:06:08 p. m.';
  assert.equal(tipificacionParseHora(conNbsp), '18:06:08');
  const conNbspAntes = '11:59:55 a. m.';
  assert.equal(tipificacionParseHora(conNbspAntes), '11:59:55');
});

test('tipificacionParseHora: variantes am/pm sin espacio ni puntos', () => {
  assert.equal(tipificacionParseHora('6:06:08pm'), '18:06:08');
  assert.equal(tipificacionParseHora('6:06am'), '06:06:00');
});

test('tipificacionParseHora: formato de 24 horas, sin am/pm', () => {
  assert.equal(tipificacionParseHora('18:06:08'), '18:06:08');
  assert.equal(tipificacionParseHora('06:06'), '06:06:00');
  assert.equal(tipificacionParseHora('23:59:59'), '23:59:59');
});

test('tipificacionParseHora: serial de Excel (fraccion de dia)', () => {
  assert.equal(tipificacionParseHora(0.5), '12:00:00');
  assert.equal(tipificacionParseHora(0.75), '18:00:00');
  assert.equal(tipificacionParseHora(0), '00:00:00');
});

test('tipificacionParseHora: invalida -> null, pero NO bloquea la fila (no es obligatoria)', () => {
  assert.equal(tipificacionParseHora('texto raro'), null);
  assert.equal(tipificacionParseHora(''), null);
  assert.equal(tipificacionParseHora(null), null);
  assert.equal(tipificacionParseHora('25:00:00'), null, 'hora fuera de rango');
});

test('tipificacionParseDuracion: entero de TIME_MIN, se guarda aunque no se muestre todavia', () => {
  assert.equal(tipificacionParseDuracion(3), 3);
  assert.equal(tipificacionParseDuracion('5'), 5);
  assert.equal(tipificacionParseDuracion(''), null);
  assert.equal(tipificacionParseDuracion(null), null);
});

// ── Etiqueta de presentacion (nunca cambia lo que se guarda) ────────────
test('tipificacionEtiqueta: "_" -> espacio, valor original se guarda tal cual', () => {
  assert.equal(tipificacionEtiqueta('AGENDADA_InConexion'), 'AGENDADA InConexion');
  assert.equal(tipificacionEtiqueta('INFORMACION_GENERAL_'), 'INFORMACION GENERAL', 'sin espacio colgando al final');
  assert.equal(tipificacionEtiqueta('NO_CONTESTAN'), 'NO CONTESTAN');
});

test('tipificacionEtiqueta: "-" (valor completo, sin tipificar) -> "Sin tipificación"', () => {
  assert.equal(tipificacionEtiqueta('-'), 'Sin tipificación');
});

test('tipificacionEtiqueta: un guion que es PARTE de un texto real no se confunde con el marcador', () => {
  assert.equal(tipificacionEtiqueta('PRE-AGENDADA'), 'PRE-AGENDADA');
});

// ── Parseo completo ──────────────────────────────────────────────────
test('tipificacionParseFilas: camino feliz, todos los campos parseados', () => {
  const aoa = [HEADER, fila()];
  const res = tipificacionParseFilas(aoa);
  assert.ok(!res.error, res.error);
  assert.equal(res.filas.length, 1);
  const f = res.filas[0];
  assert.equal(f.agente, 'ASESOR DEMO UNO');
  assert.equal(f.fecha, '2026-08-15');
  assert.equal(f.hora, '18:06:08');
  assert.equal(f.duracionMin, 3);
  assert.equal(f.tipificacion, 'AGENDADA_InConexion', 'se guarda el valor ORIGINAL, sin transformar');
  assert.equal(f.skill, 'LLAMADAS DE SALIDA');
});

test('tipificacionParseFilas: DESCRIPTION_COD_ACT "-" se guarda tal cual (no se transforma al cargar)', () => {
  const aoa = [HEADER, fila({ 4: '-' })];
  const res = tipificacionParseFilas(aoa);
  assert.equal(res.filas[0].tipificacion, '-');
});

test('tipificacionParseFilas: columna obligatoria faltante -> error claro diciendo cual falta', () => {
  const headerSinSkill = HEADER.filter((h) => h !== 'SKILL_NAME');
  const res = tipificacionParseFilas([headerSinSkill]);
  assert.ok(res.error);
  assert.match(res.error, /SKILL_NAME/);
});

test('tipificacionParseFilas: MES (formula de Excel) se ignora -- no es columna obligatoria ni se usa', () => {
  const headerSinMes = HEADER.filter((h) => h !== 'MES');
  const res = tipificacionParseFilas([headerSinMes, fila().slice(0, 6)]);
  assert.ok(!res.error, res.error);
  assert.equal(res.filas.length, 1);
});

test('tipificacionParseFilas: fila sin DATE valida se descarta con aviso, no rompe las demas', () => {
  const aoa = [HEADER, fila({ 1: 'no es una fecha' }), fila()];
  const res = tipificacionParseFilas(aoa);
  assert.ok(!res.error, res.error);
  assert.equal(res.filas.length, 1);
  assert.equal(res.avisos.length, 1);
  assert.match(res.avisos[0], /DATE/);
});

test('tipificacionParseFilas: HORA invalida NO descarta la fila (campo opcional)', () => {
  const aoa = [HEADER, fila({ 2: 'hora invalida' })];
  const res = tipificacionParseFilas(aoa);
  assert.ok(!res.error, res.error);
  assert.equal(res.filas.length, 1);
  assert.equal(res.filas[0].hora, null);
  assert.equal(res.avisos.length, 0);
});

test('tipificacionParseFilas: filas vacias intermedias se ignoran sin generar aviso', () => {
  const aoa = [HEADER, fila(), ['', '', '', '', '', '', ''], fila()];
  const res = tipificacionParseFilas(aoa);
  assert.ok(!res.error, res.error);
  assert.equal(res.filas.length, 2);
  assert.equal(res.avisos.length, 0);
});

test('tipificacionFilaComoArray: respeta TIPIFICACION_ORDEN_ARRAY', () => {
  const f = { agente: 'A', fecha: '2026-08-01', hora: '08:00:00', duracionMin: 3, tipificacion: 'T', skill: 'S' };
  assert.deepEqual(TIPIFICACION_ORDEN_ARRAY, ['agente', 'fecha', 'hora', 'duracionMin', 'tipificacion', 'skill']);
  assert.deepEqual(tipificacionFilaComoArray(f), ['A', '2026-08-01', '08:00:00', 3, 'T', 'S']);
});

test('tipificacionRangoFechas: primera y ultima DATE entre las filas', () => {
  const filas = [{ fecha: '2026-08-15' }, { fecha: '2026-08-01' }, { fecha: '2026-08-31' }];
  assert.deepEqual(tipificacionRangoFechas(filas), { desde: '2026-08-01', hasta: '2026-08-31' });
});

test('tipificacionRangoFechas: sin filas -> null', () => {
  assert.equal(tipificacionRangoFechas([]), null);
});
