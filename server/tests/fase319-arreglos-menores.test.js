// fase319-arreglos-menores.test.js — Fase 319 (10/11/2026): tarjetas del modulo de Calidad
// en el celular, tarjetas del flujo de líneas internas en 2 columnas y aviso claro antes de
// cargar una base de líneas internas con varios meses. Sin datos reales.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('../../public/js/lineas-internas-logic.js');
const pub = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');
const NM = (m) => ({ '2026-09': 'Septiembre 2026', '2026-10': 'Octubre 2026', '2026-11': 'Noviembre 2026' })[m] || m;

test('aviso de carga: dice qué meses trae, cuáles REEMPLAZA (con cuántos había) y cuáles son nuevos, y pide confirmación', () => {
  const t = L.liTextoConfirmacion({ archivo: 'base.xlsx', resumen: '100 registro(s)', mesElegido: '2026-10', avisos: [], nombreMes: NM,
    meses: [{ mes: '2026-10', existentes: 70, nuevas: 80 }, { mes: '2026-09', existentes: 15, nuevas: 20 }] });
  assert.match(t, /Este archivo trae 2 meses: Septiembre 2026 y Octubre 2026\./);
  assert.match(t, /• Septiembre 2026: 20 registro\(s\) — REEMPLAZA los 15 que ya están cargados/);
  assert.match(t, /• Octubre 2026: 80 registro\(s\) — REEMPLAZA los 70 que ya están cargados/);
  assert.match(t, /⚠ Elegiste «Subir» en Octubre 2026, pero el archivo también trae Septiembre 2026: ese mes también se guarda y reemplaza lo que ya estaba cargado\./);
  assert.match(t, /Se van a reemplazar Septiembre 2026 y Octubre 2026\. Lo reemplazado se puede recuperar con «Deshacer» \(30 días\)\./);
  assert.match(t, /¿Guardar\?$/);
});

test('aviso de carga: un solo mes nuevo, sin alarmas; un mes que reemplaza, en singular', () => {
  const nuevo = L.liTextoConfirmacion({ archivo: 'b.xlsx', resumen: 'r', mesElegido: '2026-11', avisos: [], nombreMes: NM, meses: [{ mes: '2026-11', existentes: 0, nuevas: 5 }] });
  assert.match(nuevo, /Este archivo trae 1 mes: Noviembre 2026\./);
  assert.match(nuevo, /mes nuevo \(no había datos\)/);
  assert.ok(!/Elegiste|reemplazar/.test(nuevo));
  const uno = L.liTextoConfirmacion({ archivo: 'b.xlsx', resumen: 'r', mesElegido: '2026-10', avisos: ['1 fila(s) de prueba'], nombreMes: NM, meses: [{ mes: '2026-10', existentes: 3, nuevas: 4 }] });
  assert.match(uno, /Se va a reemplazar Octubre 2026\./);
  assert.match(uno, /Avisos:\n1 fila\(s\) de prueba/);
});

test('el aviso nuevo solo se usa en las bases de líneas internas; Inasistencia y Encuestas siguen con el de siempre', () => {
  const ab = pub('js/aurora-bases.js');
  assert.doesNotThrow(() => new vm.Script(ab)); assert.doesNotThrow(() => new vm.Script(pub('js/lineas-internas-logic.js')));
  assert.match(ab, /var textoConfirmar = \(AB_LI\[tipo\] && typeof liTextoConfirmacion === 'function'\)/);
  assert.match(ab, /: '«' \+ f\.name \+ '»: ' \+ resumen \+ '\\n\\nSe va a guardar:\\n' \+ lineas\.join\('\\n'\) \+ avisos \+ '\\n\\n¿Continuar\?';/);
  assert.match(ab, /data-ab-mes="' \+ esc\(mes \|\| ''\) \+ '"/);
});

test('CSS: la franja de tarjetas de Calidad no se encoge y va en 2 columnas en el celular; las del flujo, 2 columnas a 600 px', () => {
  const css = pub('css/styles.css');
  assert.match(css, /@media\(max-width:768px\)\{#cal-kpis-strip\{flex-shrink:0;\}\}/, 'solo en celular y tablet: escritorio igual');
  assert.match(css, /@media\(max-width:600px\)\{#cal-kpis-strip\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media \(max-width:600px\)\{#gd-panels \.aurora-kpis\.li-kpis\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.ok(!/\.li-kpis \.aurora-kpi\{flex:1 1 calc\(50% - 10px\)/.test(css), 'la regla de flex que no aplicaba, fuera');
});
