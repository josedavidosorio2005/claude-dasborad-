// Fase 219 (pedido de Edwin, 30/10): en Tipificacion de ORLANT el filtro
// "Tipo" (TYPE_INTERACTION crudo: Entrante / Saliente / Otro) pasa a ser
// "Entrada o salida" con la MISMA regla de las tarjetas (condSalidaCanalSql):
// cada registro es de entrada o de salida, sin "Otro", y entrada + salida =
// total (tambien con TYPE_INTERACTION vacio). Mobilize sigue con "Tipo".
// Datos SIEMPRE inventados.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { db } = require('./helpers');
const t = require('../tipificaciones');
const { schemas } = require('../validation');

function fila(skill, tipo, skillId, n) {
  return Array.from({ length: n }, (_, k) => ['ASESOR ' + (k % 3), '2026-09-0' + (1 + (k % 9)), null, 1, 'AGENDADO', skill, 60, '1', tipo, null, skillId]);
}
const LLAMADAS = [
  ...fila('LLAMADAS DE SALIDA', 'outbound_ma', '-', 10), // salida
  ...fila('-', 'otro', '-', 2),                          // "-" con otro tipo: salida en ORLANT
  ...fila('-', null, '-', 1),                            // "-" sin tipo: salida en ORLANT
  ...fila('LLAMADAS DE SALIDA', 'outbound_ma', '4070', 4), // skill propio: cuenta en su skill (entrada)
  ...fila('CALL INBOUND ORLANT 3P', 'inbound', '4308', 6),
  ...fila('CALL INBOUND ORLANT 3P', null, '4308', 3),     // entrada sin tipo
];
const WHATSAPP = [
  ...fila('WPP ORLANT', 'outbound_ma', '0', 5), // salida (SKILL_ID 0)
  ...fila('WPP ORLANT', 'inbound', '12', 7),
  ...fila('WPP ORLANT', null, '12', 2),          // sin tipo: entrada (antes se perdia con NOT)
];

for (const campana of ['ORLANT', 'MOBILIZE']) {
  t.cargarTipificaciones(db, { campana, canal: 'LLAMADAS', archivoNombre: 'x.xlsx', cargadoPorNombre: 'test', filas: LLAMADAS });
}
t.cargarTipificaciones(db, { campana: 'ORLANT', canal: 'WHATSAPP', archivoNombre: 'w.xlsx', cargadoPorNombre: 'test', filas: WHATSAPP });

const total = (q) => t.tipificacionesPorTipo(db, { mes: '2026-09', ...q }).total;

test('ORLANT llamadas: salida = la tarjeta (13), entrada = el resto (13), suman el total (26)', () => {
  const todas = total({ campana: 'ORLANT', canal: 'LLAMADAS' });
  const sal = total({ campana: 'ORLANT', canal: 'LLAMADAS', sentido: 'salida' });
  const ent = total({ campana: 'ORLANT', canal: 'LLAMADAS', sentido: 'entrada' });
  assert.strictEqual(todas, 26);
  assert.strictEqual(sal, t.tipificacionesResumenSalida(db, { campana: 'ORLANT', mes: '2026-09' }).total);
  assert.strictEqual(sal, 13);
  assert.strictEqual(ent, 13);
});

test('ORLANT WhatsApp: salida = outbound_ma (5); entrada incluye los que no traen tipo (9)', () => {
  assert.strictEqual(total({ campana: 'ORLANT', canal: 'WHATSAPP', sentido: 'salida' }), 5);
  assert.strictEqual(total({ campana: 'ORLANT', canal: 'WHATSAPP', sentido: 'entrada' }), 9);
  assert.strictEqual(total({ campana: 'ORLANT', canal: 'WHATSAPP' }), 14);
});

test('el filtro no cambia las tarjetas de total ni de salida', () => {
  const sin = t.tipificacionesResumenSalida(db, { campana: 'ORLANT', mes: '2026-09' });
  const con = t.tipificacionesResumenSalida(db, { campana: 'ORLANT', mes: '2026-09', sentido: 'entrada' });
  assert.deepStrictEqual(con, sin);
});

test('validacion: sentido solo entrada | salida; tipoInteraccion (Mobilize) sigue igual', () => {
  const base = { campana: 'ORLANT', canal: 'LLAMADAS' };
  assert.ok(schemas.tipificacionFiltrosQuery.safeParse({ ...base, sentido: 'entrada' }).success);
  assert.ok(schemas.tipificacionFiltrosQuery.safeParse({ ...base, sentido: 'salida' }).success);
  assert.ok(!schemas.tipificacionFiltrosQuery.safeParse({ ...base, sentido: 'otro' }).success);
  assert.ok(schemas.tipificacionFiltrosQuery.safeParse({ campana: 'MOBILIZE', canal: 'LLAMADAS', tipoInteraccion: 'otro' }).success);
});

test('vista: ORLANT ve "Entrada o salida" (Todos / Entrada / Salida, sin Otro); Mobilize sigue con "Tipo"', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'tipificacion.js'), 'utf8');
  assert.ok(s.includes("[['', 'Todos'], ['entrada', 'Entrada'], ['salida', 'Salida']]"));
  assert.ok(s.includes('>Entrada o salida</label>'));
  assert.ok(s.includes("[['', 'Todos'], ['inbound', 'Entrante'], ['outbound_ma', 'Saliente'], ['otro', 'Otro']]"), 'Mobilize no cambia');
  assert.ok(s.includes("params.set(_tipificacionSentidoPorCampana[campana] ? 'sentido' : 'tipoInteraccion', deCanal.tipo);"));
  assert.ok(s.includes("[['', 'Entrada y salida (todas)'], ['GENERAL', 'Salida General'], ['3P', 'Salida 3P'], ['SIN', 'Salida sin clasificar']]"));
});
