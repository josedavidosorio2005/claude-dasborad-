// fase278-aurora-salida-total.test.js — Fase 278 (pedido de Edwin, 06/11):
// Clinica Aurora › Llamadas y WhatsApp de salida: solo el total (sin botones
// General / 3P, sin editor de lineas, sin filas 3P/General en la tabla) y el
// WhatsApp de salida suma las colas 4062 (Confirmaciones whatsapp) y 4063
// (Recordaciones 3 dias) ademas del SKILL_ID 0. 4019 (Whatsapp de entrada) no
// cuenta. Llamadas igual. ORLANT no cambia. Datos SINTETICOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const T = require('../../public/js/tipificacion-logic.js');
const tip = require('../tipificaciones');
const { salidaCombinadaPorMes } = require('../salida-cdr');
const { db } = require('./helpers');

const AURORA = 'CLINICA AURORA';
const H = ['CONN_ID', 'CHANNEL', 'DATE', 'DATE_CLOSE', 'AGENT_NAME', 'DESCRIPTION_COD_ACT', 'SKILL_ID'];
// Octubre inventado: 4019 = 40, 4062 = 25, 4063 = 7, 0 = 9 (y 4166 = 2, sin nombre).
const N = { 4019: 40, 4062: 25, 4063: 7, 0: 9, 4166: 2 };
function archivo(prefijo) {
  return [H, ...Object.entries(N).flatMap(([id, n]) => Array.from({ length: n }, (_, k) => [prefijo + id + '-' + k, 'whatsapp',
    '2026-10-1' + (k % 9) + ' 09:00:00', '2026-10-1' + (k % 9) + ' 10:00:00', 'ASESORA ' + (k % 3), 'AGENDADA', id]))];
}
function cargarWpp(campana) {
  const r = T.tipificacionParseFilas(archivo(campana[0]), null, 'WHATSAPP', { skillsWhatsapp: { 0: 'WHATSAPP DE SALIDA' } });
  assert.equal(r.error, undefined);
  tip.cargarTipificaciones(db, { campana, canal: 'WHATSAPP', archivoNombre: 's.xlsx', cargadoPorNombre: 'test', filas: r.filas.map(T.tipificacionFilaComoArray) });
}
// 6 llamadas de salida ("-", outbound_ma) y 10 de entrada, en octubre.
function cargarLlamadas(campana) {
  const fila = (agente, skill, tipo, n) => Array.from({ length: n }, (_, k) => T.tipificacionFilaComoArray({ agente, fecha: '2026-10-0' + (1 + k % 8), hora: '09:00', duracionMin: 1, tipificacion: 'AGENDADA', skill, duracionSeg: 60, codAct: '', tipoInteraccion: tipo, hungUp: '', skillId: skill === '-' ? '-' : '10', unicaDia: '' }));
  tip.cargarTipificaciones(db, { campana, canal: 'LLAMADAS', archivoNombre: 'c.xlsx', cargadoPorNombre: 'test', filas: [...fila('ASESORA 1', '-', 'outbound_ma', 6), ...fila('ASESORA 2', 'LINEA DE ENTRADA', 'inbound', 10)] });
}
cargarWpp(AURORA); cargarLlamadas(AURORA);
cargarWpp('ORLANT'); cargarLlamadas('ORLANT');

test('Aurora: WhatsApp de salida = 0 + 4062 + 4063 (41); 4019 y 4166 no; llamadas igual (6)', () => {
  const oct = salidaCombinadaPorMes(db, AURORA).find((f) => f.mes === '2026-10');
  const tot = (p) => oct[p + '3p'] + oct[p + 'General'] + oct[p + 'SinAsignar'];
  assert.equal(tot('wpp'), 9 + 25 + 7, 'antes de la Fase 278 daba 9 (solo el SKILL_ID 0)');
  assert.equal(tot('llamadas'), 6);
});

test('Aurora: solo el total, sin lineas (sinLineas, sin lineaPorCliente, sin asesores "sin asignar")', () => {
  const oct = salidaCombinadaPorMes(db, AURORA).find((f) => f.mes === '2026-10');
  assert.equal(oct.sinLineas, true);
  assert.equal(oct.lineaPorCliente, undefined, 'sin botones General / 3P');
  assert.deepEqual([oct.wpp3p, oct.wppGeneral, oct.llamadas3p, oct.llamadasGeneral], [0, 0, 0, 0]);
  assert.equal(oct.asesoresSinAsignar, 0, 'sin aviso de asesores sin linea');
});

test('ORLANT no cambia: WhatsApp de salida solo el SKILL_ID 0, con sus lineas', () => {
  const oct = salidaCombinadaPorMes(db, 'ORLANT').find((f) => f.mes === '2026-10');
  assert.equal(oct.wpp3p + oct.wppGeneral + oct.wppSinAsignar, 9);
  assert.equal(oct.sinLineas, undefined);
  assert.equal(tip.condSalidaWhatsappSql('ORLANT'), "tipoInteraccion = 'outbound_ma'");
  assert.equal(tip.condSalidaWhatsappSql('MOBILIZE'), "tipoInteraccion = 'outbound_ma'");
  assert.equal(tip.condSalidaWhatsappSql('HOSPITAL LA MARIA'), "tipoInteraccion = 'outbound_ma'");
});

test('Aurora › Tipificación «Entrada o salida» usa la misma regla: salida 41, entrada 42 (= 83)', () => {
  const q = { campana: AURORA, canal: 'WHATSAPP', mes: '2026-10' };
  assert.equal(tip.tipificacionesPorTipo(db, { ...q, sentido: 'salida' }).total, 41);
  assert.equal(tip.tipificacionesPorTipo(db, { ...q, sentido: 'entrada' }).total, 40 + 2);
  assert.equal(tip.tipificacionesPorTipo(db, q).total, 83);
});

test('tabla de la pestaña sin lineas: solo «Total … de salida» y «Fuente» por canal', () => {
  const ctx = { gdFmtValor: (v) => String(v), esc: (s) => String(s), salidaMesLbl: (m) => m, _salSinTexto: () => 'Sin clasificar' };
  vm.createContext(ctx);
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'salida.js'), 'utf8');
  const fn = (nombre) => { const i = src.indexOf('function ' + nombre + '('); return src.slice(i, src.indexOf('\n}\n', i) + 2); };
  vm.runInContext(fn('_salTotal') + fn('_salTablaHtml'), ctx);
  const filas = salidaCombinadaPorMes(db, AURORA);
  const html = ctx._salTablaHtml(filas, '2026-10', { llamadas: 'TOTAL', wpp: 'TOTAL' });
  const rotulos = [...html.matchAll(/<tr><td>([^<]+)<\/td>/g)].map((m) => m[1]);
  assert.deepEqual(rotulos, ['Total Llamadas de salida', 'Fuente (Llamadas)', 'Total WhatsApp de salida', 'Fuente (WhatsApp)']);
  assert.match(html, /<td style="font-weight:700">41<\/td>/);
  const conLineas = ctx._salTablaHtml(salidaCombinadaPorMes(db, 'ORLANT'), '2026-10', { llamadas: 'TOTAL', wpp: 'TOTAL' });
  assert.match(conLineas, /Llamadas 3P/, 'ORLANT sigue con 3P / General');
});
