// fase323-resumen-asesor-sura.test.js — Fase 323 (10/11/2026, plan de Calidad C6 variante
// SURA): resumen por asesor de una plantilla por descuento (# monitoreos, promedio,
// clasificacion, calificaciones en 0 %, mejor y peor) en Calidad › Resumen por asesor, en la
// pestaña de resultados y en «Mis resultados» (solo las del asesor). Datos SINTETICOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const CA = require('../../public/js/calidad-analisis-logic.js');
const pub = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');

const M = [
  { asesor: 'asesor_ficticio_a', puntaje: 100 }, { asesor: 'asesor_ficticio_a', puntaje: 0 }, { asesor: 'ASESOR_FICTICIO_A', puntaje: 79 },
  { asesor: 'asesor_ficticio_b', puntaje: 90 }, { asesor: 'asesor_ficticio_b', puntaje: 94 },
  { asesor: 'asesor_ficticio_c', puntaje: 0 }, { asesor: 'asesor_ficticio_c', puntaje: null },
];

test('métricas por descuento: # monitoreos, promedio, clasificación, en 0 %, mejor y peor', () => {
  assert.deepEqual(CA.caMetricasDescuento(M.slice(0, 3)), { monitoreos: 3, promedio: 59.7, clase: { k: 'bad', t: 'Crítico' }, enCero: 1, mejor: 100, peor: 0 });
  assert.deepEqual(CA.caMetricasDescuento([]), { monitoreos: 0, promedio: null, clase: { k: 'na', t: 'Sin datos' }, enCero: 0, mejor: null, peor: null });
  assert.equal(CA.caMetricasDescuento([{ puntaje: null }]).monitoreos, 0, 'sin nota no cuenta');
});

test('resumen por asesor (SURA): una fila por asesor (sin distinguir mayúsculas), de mayor a menor promedio', () => {
  const r = CA.caResumenDescuento(M);
  assert.deepEqual(r.map((f) => [f.asesor, f.monitoreos, f.promedio, f.clase.t, f.enCero, f.mejor, f.peor]), [
    ['asesor_ficticio_b', 2, 92, 'Sobresaliente', 0, 94, 90],
    ['asesor_ficticio_a', 3, 59.7, 'Crítico', 1, 100, 0],
    ['asesor_ficticio_c', 1, 0, 'Crítico', 1, 0, 0],
  ]);
});

test('las tres vistas usan la variante SURA solo con una plantilla por descuento; las demás siguen igual', () => {
  const an = pub('calidad-analisis.js'), pa = pub('calidad-panel.js'), mr = pub('mis-resultados.js');
  for (const s of [an, pa, mr, pub('calidad-analisis-logic.js')]) assert.doesNotThrow(() => new vm.Script(s));
  assert.match(an, /if \(info\.p && info\.p\.engine === 'descuento'\) \{ tbl\.innerHTML = caResumenDescuentoHtml\(caResumenDescuento\(arr\)\);/);
  assert.match(an, /<th>En 0 %<\/th><th>Mejor<\/th><th>Peor<\/th>/);
  assert.match(an, /<th>Fallos críticos<\/th><th>Alerta<\/th>/, 'la tabla de siempre sigue para las demás');
  assert.match(pa, /if \(c\.pl && \(c\.pl\.engine \|\| c\.pl\.motor\) === 'descuento'\) \{ _cmpPintarResumenDescuento/);
  assert.match(pa, /<th>Alerta críticos<\/th><th>Total fallos críticos<\/th>/, 'la de siempre sigue');
  assert.match(mr, /if\(plPrin && plPrin\.engine==='descuento' && typeof caMetricasDescuento==='function'\)/);
  assert.match(mr, /Calificaciones en 0 %/);
  assert.match(mr, /Total Fallos Criticos/, 'la de siempre sigue para las demás campañas');
});
