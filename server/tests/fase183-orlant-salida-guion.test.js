// Fase 183 (pedido de Edwin, 26/10): en Tipificacion de llamadas de ORLANT,
// skill "-" = salida (cualquier tipo) y las out_pre con skill propio (4070
// CANCELACIONES Y REPROGRAMACION) vuelven a su skill. Sin el arreglo, la
// salida de agosto daba 6.945 (6.555 "-" de salida + 390 out_pre) en vez de
// 6.560, y Cancelaciones no salia en el filtro de skill. Mobilize no cambia.
const test = require('node:test');
const assert = require('node:assert');
const { db } = require('./helpers');
const t = require('../tipificaciones');
const { salidaCdrPorMes } = require('../salida-cdr');

function fila(skill, tipo, skillId, n, tipificacion = 'AGENDADO') {
  return Array.from({ length: n }, (_, k) => ['ASESOR ' + (k % 3), '2026-08-0' + (1 + (k % 9)), null, 1, tipificacion, skill, 60, '1', tipo, null, skillId]);
}
const FILAS = [
  ...fila('LLAMADAS DE SALIDA', 'outbound_ma', '-', 10), // "-" outbound_ma, ya guardado como salida
  ...fila('-', 'otro', '-', 2),                          // "-" internalcall: tambien es salida (las ~5 de Edwin)
  ...fila('-', null, '-', 1),                            // "-" sin tipo
  ...fila('LLAMADAS DE SALIDA', 'outbound_ma', '4070', 4), // out_pre de CANCELACIONES Y REPROGRAMACION
  ...fila('CALL INBOUND ORLANT 3P', 'inbound', '4308', 6),
];

for (const campana of ['ORLANT', 'MOBILIZE']) {
  t.cargarTipificaciones(db, { campana, canal: 'LLAMADAS', archivoNombre: 'x.xlsx', cargadoPorNombre: 'test', filas: FILAS });
}

test('ORLANT: salida = solo las filas con skill "-" (13), total llamadas del mes (23), una sola tarjeta', () => {
  const r = t.tipificacionesResumenSalida(db, { campana: 'ORLANT', mes: '2026-08' });
  assert.strictEqual(r.total, 13);
  assert.strictEqual(r.totalLlamadas, 23);
  assert.strictEqual(r.soloTotal, true);
});

test('ORLANT: el filtro de skill trae Cancelaciones y no deja "-" suelto', () => {
  const op = t.tipificacionesOpciones(db, 'ORLANT', 'LLAMADAS');
  assert.deepStrictEqual([...op.skills].sort(), ['CALL INBOUND ORLANT 3P', 'CANCELACIONES Y REPROGRAMACION', 'LLAMADAS DE SALIDA']);
  const canc = t.tipificacionesPorTipo(db, { campana: 'ORLANT', canal: 'LLAMADAS', mes: '2026-08', skill: 'CANCELACIONES Y REPROGRAMACION' });
  assert.strictEqual(canc.total, 4);
  const sal = t.tipificacionesPorTipo(db, { campana: 'ORLANT', canal: 'LLAMADAS', mes: '2026-08', skill: 'LLAMADAS DE SALIDA' });
  assert.strictEqual(sal.total, 13);
  const p3 = t.tipificacionesPorTipo(db, { campana: 'ORLANT', canal: 'LLAMADAS', mes: '2026-08', skill: 'CALL INBOUND ORLANT 3P' });
  assert.strictEqual(p3.total, 6);
});

test('ORLANT: la pestaña de salida (CDR) cuenta las mismas 13', () => {
  const m = salidaCdrPorMes(db, 'ORLANT')['2026-08'];
  assert.strictEqual(m.llamadas3p + m.llamadasGeneral + m.llamadasSinAsignar, 13);
});

test('MOBILIZE sigue con la regla de antes (outbound_ma, sin "-" de otro tipo)', () => {
  const r = t.tipificacionesResumenSalida(db, { campana: 'MOBILIZE', mes: '2026-08' });
  assert.strictEqual(r.total, 14);
  assert.ok(!r.soloTotal);
});
