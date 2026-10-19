// fase153-subir-mes.test.js — Fase 153 (Centro de cargas, PR 4): Subir y
// Reemplazar DESDE EL MES, empezando por los modulos de Mobilize. El plan
// queda con ese modulo y el archivo con las filas de ese mes; el lector, la
// vista previa y el guardado son los de siempre.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const L = require('../../public/js/centro-cargas-logic.js');
const { cargasPlanConsolidado } = require('../../public/js/cargas-logic.js');

const PUB = path.join(__dirname, '..', '..', 'public', 'js');

test('todas las cargas suben desde el mes (Mobilize y ORLANT), menos Calidad', () => {
  const { CARGAS_POR_MODULO } = require('../centro-cargas');
  const ids = Object.values(CARGAS_POR_MODULO).flat().map((c) => c.id);
  ids.filter((id) => id !== 'calidad').forEach((id) => assert.ok(L.centroSubeDesdeMes(id), id));
  assert.equal(L.centroSubeDesdeMes('calidad'), false, 'Calidad tiene su propia carga');
  assert.deepEqual(Object.keys(L.CENTRO_CARGA_PLAN).sort(), ids.filter((id) => id !== 'calidad').sort(), 'ni de mas ni de menos');
});

test('el plan real de ORLANT (2 hojas de Trafico y modulos propios) tiene un renglon para cada carga', () => {
  // Mismos argumentos que onCargaClienteChange arma para ORLANT (plantilla
  // unificada): Trafico de voz y WhatsApp, Agendas, Tipificacion, Inasistencia,
  // Efectividad de Agendamiento y de Citas, Salida y WhatsApp tiempos.
  const c = [{ label: 'X' }];
  const plan = cargasPlanConsolidado({}, null, c, c, c, c, c, c, c, c, undefined, null, null, c, null);
  const esperado = {
    flujo_llamadas: 'LLAMADAS', flujo_whatsapp: 'WHATSAPP', whatsapp_tiempos: 'WHATSAPP_TIEMPOS', agendas: 'AGENDAS',
    salida: 'SALIDA', efectividad_agendamiento: 'EFECTIVIDAD_AGENDAMIENTO', inasistencia: 'INASISTENCIA',
    efectividad_citas: 'CITAS_ATENDIDAS', tipificacion_llamadas: 'TIPIFICACION_LLAMADAS', tipificacion_whatsapp: 'TIPIFICACION_WHATSAPP',
  };
  Object.keys(esperado).forEach((id) => assert.deepEqual(L.centroFiltrarPlan(plan, id).map((h) => h.hoja), [esperado[id]], id));
});

test('ORLANT: fecha de cada lector y filtro por mes', () => {
  assert.equal(L.centroFechaFila('agendas', { fechaSolicitud: '2026-08-04 10:30' }), '2026-08-04 10:30');
  assert.equal(L.centroFechaFila('whatsapp_tiempos', ['SKILL', '2026-08-05', '10:00', 30]), '2026-08-05');
  assert.equal(L.centroFechaFila('trafico', { fechaInicio: '2026-08-06', colaWhatsapp: 'C' }), '2026-08-06');
  ['salida', 'efectividad_agendamiento', 'inasistencia', 'citas_atendidas'].forEach((t) => assert.equal(L.centroFechaFila(t, { mes: '2026-08' }), '2026-08', t));
  const ag = L.centroFiltrarResultado({ tipo: 'agendas', filas: [{ fechaSolicitud: '2026-08-04 10:30' }, { fechaSolicitud: '2026-09-01 08:00' }], avisos: [] }, 'agendas', '2026-08');
  assert.equal(ag.filas.length, 1);
  assert.deepEqual(L.centroRangoFilas('agendas', ag.filas), { desde: '2026-08-04 10:30', hasta: '2026-08-04 10:30' }, 'Agendas con hora, como su lector');
  const sal = L.centroFiltrarResultado({ tipo: 'salida', filas: [{ mes: '2026-07' }, { mes: '2026-08' }, { mes: '2026-09' }], avisos: [] }, 'salida', '2026-08');
  assert.deepEqual(sal.filas, [{ mes: '2026-08' }]);
  assert.match(sal.avisos[0], /se ignoraron 2 fila\(s\) de otros meses \(julio 1, septiembre 1\)/);
});

test('Flujo de WhatsApp: sin filtro de skills (va al cliente elegido) y nunca un archivo de voz', () => {
  const filas = [{ fechaInicio: '2026-08-01', colaWhatsapp: 'COLA X' }, { fechaInicio: '2026-07-31', colaWhatsapp: 'COLA X' }];
  const r = L.centroFiltrarResultado({ tipo: 'trafico', canal: 'whatsapp', filas, avisos: [] }, 'flujo_whatsapp', '2026-08', { skillsDelCliente: {} });
  assert.equal(r.filas.length, 1, 'las colas de WhatsApp no pasan por el mapeo de skills de voz');
  const voz = L.centroFiltrarResultado({ tipo: 'trafico', canal: 'voz', filas: [{ fecha: '2026-08-01', skillName: 'S' }], avisos: [] }, 'flujo_whatsapp', '2026-08');
  assert.equal(voz.error, 'Este archivo es de Llamadas; aquí va el de WhatsApp.');
});

test('modulos mensuales: se reemplaza el mes entero y el aviso lo dice', () => {
  ['salida', 'efectividad_agendamiento', 'inasistencia', 'efectividad_citas'].forEach((id) => assert.ok(L.centroEsMensual(id), id));
  ['agendas', 'flujo_llamadas', 'llamadas_unicas'].forEach((id) => assert.equal(L.centroEsMensual(id), false, id));
  assert.equal(L.centroTextoReemplazoMensual('2026-08', { enMes: 12, enRango: 0 }), 'Este módulo se guarda por mes: se reemplaza agosto completo (12 registros de ahora).');
  assert.equal(L.centroTextoReemplazoMensual('2026-08', { enMes: 0, enRango: 0 }), 'Este módulo se guarda por mes y agosto no tiene datos todavía.');
  const cargas = fs.readFileSync(path.join(PUB, 'cargas.js'), 'utf8');
  assert.match(cargas, /if\(centroEsMensual\(focoArch\.carga\)\)\{/);
  // Salida: corregir el año nunca saca una fila del mes elegido en el Centro.
  assert.match(cargas, /if\(focoSalida && filas\.some\(function\(f\)\{ return f\.mes !== focoSalida\.mes; \}\)\)\{/);
  // Solo Flujo de Llamadas pide el mapeo de skills.
  assert.match(cargas, /if\(focoArch\.carga==='flujo_llamadas' && _cargasResultados\.some/);
});

test('centroFiltrarPlan deja solo el renglon de esa carga', () => {
  const plan = [
    { tipo: 'trafico', hoja: 'DATA' },
    { tipo: 'tipificacion', canalTipificacion: 'LLAMADAS', hoja: 'TIPIFICACION_LLAMADAS' },
    { tipo: 'tipificacion', canalTipificacion: 'WHATSAPP', hoja: 'TIPIFICACION_WHATSAPP' },
    { tipo: 'llamadas_unicas', hoja: 'LLAMADAS_UNICAS' },
    { tipo: 'llamadas_salida', hoja: 'LLAMADAS_SALIDA' },
    { tipo: 'encuesta', hoja: 'ENCUESTA' },
    { tipo: 'calidad', hoja: 'CALIDAD' },
  ];
  assert.deepEqual(L.centroFiltrarPlan(plan, 'tipificacion_whatsapp').map((h) => h.hoja), ['TIPIFICACION_WHATSAPP']);
  assert.deepEqual(L.centroFiltrarPlan(plan, 'flujo_llamadas').map((h) => h.hoja), ['DATA']);
  assert.deepEqual(L.centroFiltrarPlan(plan, 'llamadas_salida').map((h) => h.hoja), ['LLAMADAS_SALIDA']);
  // ORLANT (2 hojas de Trafico): solo la de voz.
  const orlant = [{ tipo: 'trafico', canalFijo: 'voz', hoja: 'LLAMADAS' }, { tipo: 'trafico', canalFijo: 'whatsapp', hoja: 'WHATSAPP' }];
  assert.deepEqual(L.centroFiltrarPlan(orlant, 'flujo_llamadas').map((h) => h.hoja), ['LLAMADAS']);
  assert.equal(L.centroFiltrarPlan(plan, 'calidad'), plan, 'una carga sin plan propio (Calidad) no cambia nada');
});

test('el plan real de Mobilize (cargasPlanConsolidado) tiene un renglon para cada carga que sube desde el mes', () => {
  // Mismos argumentos que onCargaClienteChange arma para MOBILIZE: Trafico
  // generico (hoja DATA), Tipificacion de 2 canales, Llamadas Unicas y de
  // Salida y Encuesta (columnas de relleno: aqui solo importa el plan).
  const c = [{ label: 'X' }];
  const plan = cargasPlanConsolidado({}, null, c, null, null, c, null, null, null, null, {}, c, c, null, c);
  ['flujo_llamadas', 'tipificacion_llamadas', 'tipificacion_whatsapp', 'llamadas_unicas', 'llamadas_salida', 'encuesta']
    .forEach((id) => assert.equal(L.centroFiltrarPlan(plan, id).length, 1, id));
  const src = fs.readFileSync(path.join(PUB, 'cargas.js'), 'utf8');
  assert.match(src, /_cargasPlan = centroFiltrarPlan\(_cargasPlan, foco\.carga\)/);
});

test('centroFiltrarResultado: solo las filas del mes, sin tocarlas, y avisa cuantas se ignoraron', () => {
  const filas = [['A', '2026-08-01', 'X', 'S'], ['B', '2026-08-31', 'X', 'S'], ['C', '2026-07-30', 'X', 'S'], ['D', '2026-09-01', 'X', 'S'], ['E', '2026-07-01', 'X', 'S']];
  const r = L.centroFiltrarResultado({ tipo: 'llamadas_unicas', filas, avisos: ['aviso del lector'] }, 'llamadas_unicas', '2026-08');
  assert.deepEqual(r.filas, [filas[0], filas[1]]);
  assert.equal(r.filas[0], filas[0], 'la misma fila, sin copiar ni cambiar');
  assert.equal(r.centroIgnoradas, 3);
  assert.equal(r.avisos[0], 'Solo se cargan las filas de Agosto 2026: se ignoraron 3 fila(s) de otros meses (julio 2, septiembre 1).');
  assert.equal(r.avisos[1], 'aviso del lector');
  // Un archivo solo de ese mes: sin avisos nuevos.
  const solo = L.centroFiltrarResultado({ tipo: 'llamadas_unicas', filas: [filas[0]], avisos: [] }, 'llamadas_unicas', '2026-08');
  assert.deepEqual(solo.avisos, []);
});

test('cada lector: la fecha sale de su columna', () => {
  assert.equal(L.centroFechaFila('llamadas_salida', ['ag', '2026-05-02', 'T', 'X']), '2026-05-02');
  assert.equal(L.centroFechaFila('encuesta', ['2026-05-03', 'ag', 'sk', 1, 1, 1, 1, '']), '2026-05-03');
  assert.equal(L.centroFechaFila('tipificacion', { fecha: '2026-05-04', agente: 'x' }), '2026-05-04');
  assert.equal(L.centroFechaFila('trafico', { fecha: '2026-05-05', skillName: 'S' }), '2026-05-05');
  const tip = L.centroFiltrarResultado({ tipo: 'tipificacion', canalTipificacion: 'WHATSAPP', filas: [{ fecha: '2026-05-04' }, { fecha: '2026-06-01' }], avisos: [] }, 'tipificacion_whatsapp', '2026-05');
  assert.equal(tip.filas.length, 1);
  const enc = L.centroFiltrarResultado({ tipo: 'encuesta', filas: [['2026-05-03'], ['2026-04-30']], avisos: [] }, 'encuesta', '2026-05');
  assert.equal(enc.filas.length, 1);
});

test('sin filas de ese mes: error claro y nada que guardar', () => {
  const r = L.centroFiltrarResultado({ tipo: 'llamadas_unicas', filas: [['A', '2026-07-30'], ['B', '2026-07-31']], avisos: [] }, 'llamadas_unicas', '2026-08');
  assert.equal(r.filas, undefined);
  assert.equal(r.error, 'El archivo no trae filas de Agosto 2026 (trae: julio 2).');
  // Si el lector ya rechazo todas las filas, el resultado pasa tal cual (con
  // sus avisos de "DATE invalida", nunca tapados por un mensaje del Centro).
  const rechazadas = { tipo: 'llamadas_unicas', filas: [], avisos: ['Fila 2: DATE invalida o vacia, se omitio.'] };
  assert.equal(L.centroFiltrarResultado(rechazadas, 'llamadas_unicas', '2026-08'), rechazadas);
});

test('Flujo de Llamadas: solo skills de ese cliente, y nunca un archivo de WhatsApp', () => {
  const filas = [
    { fecha: '2026-08-01', skillName: 'SKILL MOBILIZE' },
    { fecha: '2026-08-01', skillName: 'SKILL ORLANT' },
    { fecha: '2026-08-02', skillName: 'SKILL NUEVA' },
    { fecha: '2026-07-31', skillName: 'SKILL MOBILIZE' },
  ];
  const r = L.centroFiltrarResultado({ tipo: 'trafico', canal: 'voz', filas, avisos: [] }, 'flujo_llamadas', '2026-08', { skillsDelCliente: { 'SKILL MOBILIZE': true } });
  assert.deepEqual(r.filas.map((f) => f.skillName), ['SKILL MOBILIZE']);
  assert.equal(r.centroIgnoradas, 3);
  assert.match(r.avisos[1], /se ignoraron 2 fila\(s\) de skills de otro cliente o sin asignar/i);
  const soloOtras = L.centroFiltrarResultado({ tipo: 'trafico', canal: 'voz', filas: [filas[1]], avisos: [] }, 'flujo_llamadas', '2026-08', { skillsDelCliente: { 'SKILL MOBILIZE': true } });
  assert.match(soloOtras.error, /skills de otro cliente/);
  const wpp = L.centroFiltrarResultado({ tipo: 'trafico', canal: 'whatsapp', filas: [{ fechaInicio: '2026-08-01' }], avisos: [] }, 'flujo_llamadas', '2026-08');
  assert.equal(wpp.filas, undefined);
  assert.match(wpp.error, /WhatsApp/);
});

test('cableado: el Centro fija el foco, la pantalla lo aplica al leer y lo suelta al cerrar', () => {
  const cargas = fs.readFileSync(path.join(PUB, 'cargas.js'), 'utf8');
  const centro = fs.readFileSync(path.join(PUB, 'centro-cargas.js'), 'utf8');
  assert.match(centro, /_cargasFocoCentro = desdeMes \? \{ cliente: cliente, carga: c\.id, mes: x\.mes/);
  assert.match(cargas, /centroFiltrarResultado\(r, focoArch\.carga, focoArch\.mes, opcFoco\)/);
  assert.match(cargas, /_cargasFocoCentro = null;\n {2}\/\/ Fase 153: si se llego aqui desde el Centro/);
  // El guardado es el de siempre: ninguna ruta nueva de escritura.
  assert.doesNotMatch(cargas + centro, /apiRequest\('POST', ?'\/centro-cargas\/[^v]/);
});
