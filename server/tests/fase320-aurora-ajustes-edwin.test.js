// fase320-aurora-ajustes-edwin.test.js — Fase 320 (10/11/2026, reunion con Edwin): textos de
// WhatsApp en el flujo de líneas internas, Inasistencia y Encuestas por mes (con botones de
// vista) y el pendiente del usuario en mayusculas. Datos SINTETICOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { db } = require('./helpers');
const A = require('../../public/js/aurora-bases-logic.js');
const pub = (f) => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');

const INA = [
  { mes: '2026-09', especialidad: 'ESP UNO', total: 100, noAsistio: 10 },
  { mes: '2026-09', especialidad: 'ESP DOS', total: 50, noAsistio: 5 },
  { mes: '2026-10', especialidad: 'ESP UNO', total: 200, noAsistio: 30 },
  { mes: '2026-10', especialidad: 'ESP DOS', total: 100, noAsistio: 0 },
];
const ENC = [
  { mes: '2026-09', fecha: '2026-09-02', entidad: 'ENT A', n: 4 },
  { mes: '2026-10', fecha: '2026-10-01', entidad: 'ENT A', n: 6 },
  { mes: '2026-10', fecha: '2026-10-05', entidad: 'ENT B', n: 10 },
];

test('Inasistencia por mes: la misma fórmula de siempre aplicada a cada mes; promedio de los meses', () => {
  const s = A.inaPorMes(INA, []);
  assert.deepEqual(s.map((x) => [x.mes, x.total, x.noAsistio, x.pct]), [['2026-09', 150, 15, 10], ['2026-10', 300, 30, 10]]);
  // El % de un mes es el mismo que daba la vista de siempre con solo ese mes elegido.
  for (const m of ['2026-09', '2026-10']) {
    const esp = A.inaPorEspecialidad(INA, [m]);
    const tot = esp.reduce((a, x) => a + x.total, 0), no = esp.reduce((a, x) => a + x.noAsistio, 0);
    assert.equal(s.find((x) => x.mes === m).pct, Math.round(no / tot * 1000) / 10);
  }
  assert.equal(A.abPromedio(s.map((x) => x.pct)), 10);
  assert.equal(A.abPromedio([]), null);
  assert.deepEqual(A.inaPorMes(INA, ['2026-10']).map((x) => x.mes), ['2026-10'], 'un solo mes: un solo punto');
  assert.deepEqual(A.abMesesConDatos(INA, ['2026-08', '2026-10']), ['2026-10'], 'solo meses con datos');
  assert.deepEqual(A.abMesesConDatos(INA, []), ['2026-09', '2026-10']);
  assert.deepEqual(A.inaPorEspecialidad(INA, ['2026-10']).map((x) => [x.especialidad, x.pct]), [['ESP UNO', 15], ['ESP DOS', 0]], 'por especialidad del mes elegido, de mayor a menor');
});

test('Encuestas por mes, por entidad del mes y por día', () => {
  assert.deepEqual(A.encPorMes(ENC, []), [{ mes: '2026-09', n: 4 }, { mes: '2026-10', n: 16 }]);
  assert.deepEqual(A.encPorEntidad(ENC, ['2026-10']), [{ entidad: 'ENT B', n: 10 }, { entidad: 'ENT A', n: 6 }]);
  assert.deepEqual(A.encPorFecha(ENC, ['2026-10']).map((x) => x.fecha), ['2026-10-01', '2026-10-05']);
});

test('vistas de Inasistencia y Encuestas: inicial «Por mes» en línea, botones de vista y subtítulo de qué se muestra', () => {
  const src = pub('public/js/aurora-bases.js');
  assert.doesNotThrow(() => new vm.Script(src)); assert.doesNotThrow(() => new vm.Script(pub('public/js/aurora-bases-logic.js')));
  assert.match(src, /\{ ina: 'mes', inaMes: '', enc: 'mes', encMes: '' \}/, 'vista inicial: por mes');
  assert.match(src, /\[\{ v: 'mes', t: 'Por mes' \}, \{ v: 'especialidad', t: 'Por especialidad' \}\]/);
  assert.match(src, /\[\{ v: 'mes', t: 'Por mes' \}, \{ v: 'entidad', t: 'Por entidad' \}, \{ v: 'dia', t: 'Por día' \}\]/);
  assert.match(src, /type: 'line'/);
  assert.match(src, /'Promedio de los meses: ' \+ formato\(promedio\)/);
  assert.match(src, /<p class="ab-sub">Mes: <b>/);
  assert.match(src, /class="gd-subtabs au-ag-botones"/, 'mismo estilo de botones que Agendas');
});

test('flujo de líneas internas: textos de WhatsApp; la torta de llamadas (CDR) no cambia', () => {
  const li = pub('public/js/lineas-internas.js');
  const flujo = li.slice(li.indexOf('function _liRenderFlujo'), li.indexOf('function _liSelect'));
  assert.ok(!/llamadas|Llamadas/.test(flujo.replace(/\/\/.*$/gm, '')), 'el bloque del flujo ya no dice llamadas');
  for (const t of ["'Total de WhatsApp'", "text: 'WhatsApp'", "total de WhatsApp × 100", "'Flujo WhatsApp de entrada'", "'Contestadas'", "'Abandonadas'", "'Nivel de atención'"]) assert.ok(flujo.includes(t), t);
  assert.match(flujo, /st\.skill \? 'Sin datos de esta área para los meses elegidos\.' : 'Sin datos de este mes\.'/);
  assert.match(li, /'Total de WhatsApp': x\.total/, 'exportar y Ver datos');
  assert.match(li, /var canal = esCdr \? 'Llamadas' : 'WhatsApp';/, 'la torta de llamadas sigue igual');
  assert.equal(require('../plantillas-cliente').lineasInternasTab('CLINICA AURORA').panels[0].titulo, 'Flujo WhatsApp de entrada');
});

test('migración: el título del flujo en el layout de Aurora es «Flujo WhatsApp de entrada» (solo ese panel), idempotente', () => {
  const lay = () => JSON.parse(db.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'CLINICA AURORA'").get().layout);
  const panel = (l) => l.tabs.find((t) => t.key === 'lineas_internas').panels.find((p) => p.tipo === 'aurora_li_flujo_panel');
  assert.equal(panel(lay()).titulo, 'Flujo WhatsApp de entrada');
  // Sobre un layout con el titulo viejo, solo cambia ese titulo.
  const l = lay(); panel(l).titulo = 'Flujo de llamadas';
  db.prepare("UPDATE dashboards_config SET layout = ? WHERE cliente = 'CLINICA AURORA'").run(JSON.stringify(l));
  require('../db').tituloFlujoLineasInternas();
  const d = lay();
  assert.equal(panel(d).titulo, 'Flujo WhatsApp de entrada');
  panel(l).titulo = 'Flujo WhatsApp de entrada';
  assert.deepEqual(d, l, 'nada más cambia');
  require('../db').tituloFlujoLineasInternas();
  assert.deepEqual(lay(), d);
});

test('pendiente del usuario en mayúsculas marcado como resuelto', () => {
  assert.match(pub('docs/pendientes-2026-11-10.md'), /Resuelto desde la Fase 310/);
});
