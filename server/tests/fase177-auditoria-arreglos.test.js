// fase177-auditoria-arreglos.test.js — Fase 177: arreglos de la auditoria de
// bugs y seguridad de v1.72.1 (puntos 1, 2, 3 y 5). Todo SINTETICO.
//   1. "-" en el CDR de llamadas es "Llamadas de salida" SOLO con tipo
//      outbound_ma u out_pre; la salida del CDR no cuenta un skill de salida
//      con tipo de entrada.
//   2. El mes (AAAA-MM) tiene que existir: 01 a 12.
//   3. Resumen de calidad: puntaje en fraccion (0,85) se lee como porcentaje.
//   5. Tras cargar Tipificacion o Salida, el navegador vacia los caches de
//      opciones de esos paneles (Tipificacion apuntaba a un nombre que no existe).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const T = require('../../public/js/tipificacion-logic.js');
const CR = require('../../public/js/calidad-resumen-logic.js');
const { schemas } = require('../validation');
const { salidaCombinadaPorMes } = require('../salida-cdr');
const { request, app, tokenFor, MASTER_PASSWORD, db } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const JS = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');

test('1. "-" es salida solo con outbound_ma u out_pre; inbound, otro, internalcall o sin tipo siguen con "-"', () => {
  const H = ['AGENT_NAME', 'DATE', 'DESCRIPTION_COD_ACT', 'SKILL_NAME', 'TYPE_INTERACTION'];
  const fila = (dia, tipo) => ['Asesor Uno', '2026-09-' + dia, 'Agendada', '-', tipo];
  const r = T.tipificacionParseFilas([H,
    fila('01', 'outbound_ma'), fila('02', 'out_pre'), fila('03', 'inbound'), fila('04', 'transfer'),
    fila('05', 'internalcall'), fila('06', 'internalcall_inb'), fila('07', '-'), fila('08', ''),
  ], null, 'LLAMADAS');
  assert.deepEqual(r.filas.map((f) => [f.skill, f.tipoInteraccion]), [
    ['LLAMADAS DE SALIDA', 'outbound_ma'], ['LLAMADAS DE SALIDA', 'outbound_ma'],
    ['-', 'inbound'], ['-', 'otro'], ['-', 'otro'], ['-', 'otro'], ['-', 'otro'], ['-', null],
  ]);
  assert.equal(r.salida, 2);
});

test('1. la salida del CDR no cuenta un skill de salida con tipo de entrada (sin tipo si cuenta)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const tip = (agente, fecha, tipo) => [agente, fecha, '09:00:00', null, 'Agendada', 'LLAMADAS DE SALIDA', null, null, tipo, null, null];
  const r = await request(app).post('/api/calidad/tipificacion/carga').set(auth(admin)).send({ campana: 'ORLANT', canal: 'LLAMADAS', filas: [
    tip('Ana', '2024-03-04', 'outbound_ma'), tip('Ana', '2024-03-05', null), tip('Ana', '2024-03-06', 'inbound'), tip('Ana', '2024-03-07', 'otro'),
  ] });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const mar = salidaCombinadaPorMes(db, 'ORLANT').find((f) => f.mes === '2024-03');
  assert.equal(mar.llamadasSinAsignar, 2, 'outbound_ma + sin tipo');
  assert.equal(mar.fuenteLlamadas, 'cdr');
  const g = await request(app).get('/api/calidad/salida/asesores').query({ campana: 'ORLANT', mes: '2024-03' }).set(auth(admin));
  assert.deepEqual(g.body.asesores, [{ agente: 'Ana', llamadas: 2, wpp: 0, linea: null }]);
});

test('2. el mes tiene que existir (01-12) en todos los esquemas de mes', () => {
  const casos = [
    (mes) => schemas.salidaAsesoresQuery.safeParse({ campana: 'ORLANT', mes }),
    (mes) => schemas.whatsappTiemposRangosQuery.safeParse({ campana: 'ORLANT', mes }),
    (mes) => schemas.calidadResumenCargaBody.safeParse({ campana: 'MOBILIZE', mes, filas: [['A', 1, 90, 0]] }),
    (mes) => schemas.gerenciaKpiBody.safeParse({ periodo: mes, nombre: 'KPI', valor: 1 }),
  ];
  for (const parse of casos) {
    for (const malo of ['2026-13', '2026-00', '2026-1', '2026-99']) assert.equal(parse(malo).success, false, malo);
    for (const bueno of ['2026-01', '2026-09', '2026-12']) assert.equal(parse(bueno).success, true, bueno);
  }
});

test('2. la API responde 400 con un mes que no existe', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const r = await request(app).post('/api/calidad/calidad-resumen/carga').set(auth(admin)).send({ campana: 'MOBILIZE', mes: '2026-13', filas: [['A', 1, 90, 0]] });
  assert.equal(r.status, 400);
});

test('3. resumen de calidad: puntaje en fraccion se lee como porcentaje, con aviso', () => {
  const ENC = ['Nombre del Asesor', '# Monitoreos', 'Prom. Puntaje (%)', 'Clasificación', 'Alerta Críticos', 'Total Fallos Críticos'];
  const fr = CR.calidadResumenParseFilas([ENC, ['Asesor A', 10, 0.8534, '', '', 0], ['Asesor B', 5, 1, '', '', 1]]);
  assert.deepEqual(fr.filas, [['Asesor A', 10, 85.34, 0], ['Asesor B', 5, 100, 1]]);
  assert.ok(fr.avisos.some((a) => /fracci/i.test(a)));
  assert.equal(CR.calidadResumenClasificacion(fr.filas[0][2]), 'No crítico');
  // Con un solo puntaje mayor que 1, el archivo ya viene en porcentaje: no se toca.
  const pct = CR.calidadResumenParseFilas([ENC, ['Asesor A', 10, 85.344, '', '', 0], ['Asesor B', 5, 0.5, '', '', 1]]);
  assert.deepEqual(pct.filas, [['Asesor A', 10, 85.34, 0], ['Asesor B', 5, 0.5, 1]]);
  assert.ok(!pct.avisos.some((a) => /fracci/i.test(a)));
  // Todos en 0: no es fraccion.
  const ceros = CR.calidadResumenParseFilas([ENC, ['Asesor A', 3, 0, '', '', 2]]);
  assert.deepEqual(ceros.filas, [['Asesor A', 3, 0, 2]]);
  assert.ok(!ceros.avisos.some((a) => /fracci/i.test(a)));
});

test('5. tras cargar Tipificacion o Salida se vacian los caches de opciones de esos paneles', () => {
  const src = JS('cargas.js');
  assert.ok(!/_tipificacionCache/.test(src), 'nombre que no existe');
  const tip = src.slice(src.indexOf("'/calidad/tipificacion/carga'"), src.indexOf("'/calidad/tipificacion/carga'") + 600);
  assert.match(tip, /_tipificacionOpciones = \{\}/);
  assert.match(tip, /_salOpciones = \{\}/);
  const sal = src.slice(src.indexOf("'/calidad/salida/carga'"), src.indexOf("'/calidad/salida/carga'") + 300);
  assert.match(sal, /_salOpciones = \{\}/);
  // Son las variables globales reales de los paneles.
  assert.match(JS('tipificacion.js'), /^var _tipificacionOpciones = \{\}/m);
  assert.match(JS('salida.js'), /^var _salOpciones = \{\}/m);
});
