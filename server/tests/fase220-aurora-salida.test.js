// fase220-aurora-salida.test.js — Fase 220 (pedido del 30/10): Clinica Aurora
// con "Llamadas y WhatsApp de salida", Tipificacion (CDR de llamadas y de
// WhatsApp) y "Total tráfico", con la regla de salida de ORLANT mientras Edwin
// confirma la suya (SALIDA_POR_CLIENTE, un solo lugar). Sin clasificar asesores,
// toda la salida va a "Sin clasificar" y cuenta en el Total. Datos inventados.
'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { db, cleanup } = require('./helpers');
const t = require('../tipificaciones');
const reg = require('../clientes-registro');
const { salidaCombinadaPorMes } = require('../salida-cdr');
const { totalTraficoPorMes } = require('../total-trafico');
const centro = require('../centro-cargas');
const { derivarListasRegistro } = require('../../public/js/registro-clientes.js');
const { AURORA, AURORA_MODULOS, auroraEsperada } = require('./helpers-aurora');

after(cleanup);

function fila(agente, skill, tipo, skillId, n, dia = 1) {
  return Array.from({ length: n }, (_, k) => [agente, '2026-10-' + String(dia + (k % 9)).padStart(2, '0'), null, 1, 'AGENDADO', skill, 60, '1', tipo, null, skillId]);
}
// Aurora, octubre: llamadas -> 6 de salida ("-"), 4 de entrada; WhatsApp -> 3 de salida (SKILL_ID 0), 5 de entrada.
t.cargarTipificaciones(db, { campana: AURORA, canal: 'LLAMADAS', archivoNombre: 'cdr.xlsx', cargadoPorNombre: 'test', filas: [
  ...fila('ASESOR A', '-', 'outbound_ma', '-', 4),
  ...fila('ASESOR B', '-', 'otro', '-', 2),
  ...fila('ASESOR A', 'COLA AURORA', 'inbound', '500', 4),
] });
t.cargarTipificaciones(db, { campana: AURORA, canal: 'WHATSAPP', archivoNombre: 'chat.xlsx', cargadoPorNombre: 'test', filas: [
  ...fila('ASESOR A', 'WPP AURORA', 'outbound_ma', '0', 3),
  ...fila('ASESOR B', 'WPP AURORA', 'inbound', '12', 5),
] });

test('la regla de salida esta en un solo lugar: ORLANT y Aurora (provisional) con la de ORLANT; los demas, no', () => {
  assert.deepEqual(t.SALIDA_POR_CLIENTE, {
    ORLANT: { regla: 'guion', clasificacionAsesores: true },
    'CLINICA AURORA': { regla: 'guion', clasificacionAsesores: true },
  });
  for (const c of ['ORLANT', AURORA]) { assert.equal(t.salidaPorGuion(c), true, c); assert.equal(t.usaClasificacionAsesores(c), true, c); }
  for (const c of ['MOBILIZE', 'HOSPITAL LA MARIA', 'SURA']) { assert.equal(t.salidaPorGuion(c), false, c); assert.equal(t.usaClasificacionAsesores(c), false, c); }
});

test('sin asesores clasificados: toda la salida de Aurora va a "Sin clasificar" y cuenta en el Total', () => {
  const oct = salidaCombinadaPorMes(db, AURORA).find((f) => f.mes === '2026-10');
  assert.deepEqual([oct.llamadas3p, oct.llamadasGeneral, oct.llamadasSinAsignar], [0, 0, 6]);
  assert.deepEqual([oct.wpp3p, oct.wppGeneral, oct.wppSinAsignar], [0, 0, 3]);
  assert.equal(oct.lineaPorCliente, true, 'la pestaña dice "Sin clasificar"');
  const tt = totalTraficoPorMes(db, AURORA).find((f) => f.mes === '2026-10');
  assert.deepEqual([tt.llamadasSalida, tt.whatsappSalida], [6, 3]);
  assert.equal(tt.contestados, 9, 'cada salida cuenta como contestada (no hay entrada de Trafico cargada)');
});

test('con un asesor clasificado, su salida pasa a esa linea', () => {
  db.prepare("INSERT INTO asesor_clasificacion (campana, agente, linea, guardadoPorNombre, updatedAt) VALUES (?, 'ASESOR A', 'GENERAL', 'test', ?)").run(AURORA, new Date().toISOString());
  const oct = salidaCombinadaPorMes(db, AURORA).find((f) => f.mes === '2026-10');
  assert.deepEqual([oct.llamadasGeneral, oct.llamadasSinAsignar, oct.wppGeneral, oct.wppSinAsignar], [4, 2, 3, 0]);
  db.prepare('DELETE FROM asesor_clasificacion WHERE campana = ?').run(AURORA);
});

test('Tipificacion de Aurora: entrada + salida = total (regla de las tarjetas)', () => {
  const tot = (q) => t.tipificacionesPorTipo(db, { campana: AURORA, mes: '2026-10', ...q }).total;
  assert.deepEqual([tot({ canal: 'LLAMADAS', sentido: 'entrada' }), tot({ canal: 'LLAMADAS', sentido: 'salida' }), tot({ canal: 'LLAMADAS' })], [4, 6, 10]);
  assert.deepEqual([tot({ canal: 'WHATSAPP', sentido: 'entrada' }), tot({ canal: 'WHATSAPP', sentido: 'salida' }), tot({ canal: 'WHATSAPP' })], [5, 3, 8]);
});

test('registro y Cargar Datos: modulos, clasificacion, CDR de Tipificacion y sin la hoja manual de salida', () => {
  const r = reg.leerRegistro(db).find((c) => c.nombre === AURORA);
  assert.deepEqual(r.modulos, AURORA_MODULOS);
  assert.equal(r.parametros.salidaUsaClasificacion, true);
  const listas = derivarListasRegistro(reg.leerRegistro(db));
  assert.ok(listas.tipificacionExtra.includes(AURORA), 'CDR de Tipificacion (llamadas y WhatsApp) en Cargar Datos');
  assert.ok(!listas.traficoUnificado.includes(AURORA));
  assert.deepEqual(centro.CARGAS_POR_MODULO.tipificacion.map((c) => c.id), ['tipificacion_llamadas', 'tipificacion_whatsapp']);
  assert.equal(centro.cargaRetiradaPara(AURORA, centro.CARGAS_POR_MODULO.salida[0]), true, 'la salida sale del CDR');
  assert.equal(centro.cargaRetiradaPara('HOSPITAL LA MARIA', centro.CARGAS_POR_MODULO.salida[0]), false);
  // SKILL_ID 0 (WhatsApp de salida) ya viene en su tabla de skills, como en ORLANT.
  assert.deepEqual(db.prepare('SELECT codigo, nombre FROM skills_whatsapp WHERE campana = ?').all(AURORA), [{ codigo: '0', nombre: 'WHATSAPP DE SALIDA' }]);
});

test('migracion fase220_aurora_salida_v1: idempotente, respeta lo que ya habia y no toca a nadie mas', () => {
  const foto = () => ['ORLANT', 'MOBILIZE', 'HOSPITAL LA MARIA', 'SURA'].map((c) => {
    const d = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(c);
    const g = db.prepare('SELECT modulos, parametros FROM clientes_registro WHERE nombre = ?').get(c);
    return JSON.stringify([d && d.layout, g]);
  });
  const antesOtros = foto();
  const layout = () => JSON.parse(db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(AURORA).layout);
  // Un cambio del administrador en una pestaña que ya existia se conserva.
  const l = layout();
  l.tabs.find((x) => x.key === 'calidad').label = 'Calidad (editada)';
  db.prepare('UPDATE dashboards_config SET layout = ? WHERE cliente = ?').run(JSON.stringify(l), AURORA);
  db.habilitarSalidaAurora();
  db.habilitarSalidaAurora();
  const despues = layout();
  assert.equal(despues.tabs.find((x) => x.key === 'calidad').label, 'Calidad (editada)');
  assert.equal(despues.tabs.filter((x) => x.key === 'total_trafico').length, 1);
  assert.deepEqual(despues.tabs.map((x) => x.key), auroraEsperada().layout.tabs.map((x) => x.key));
  assert.deepEqual(reg.leerRegistro(db).find((c) => c.nombre === AURORA).modulos, AURORA_MODULOS);
  assert.deepEqual(foto(), antesOtros);
});
