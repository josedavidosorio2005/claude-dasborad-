// fase197-nps-y-flujo-hora-claros.test.js — Fase 197 (Mobilize, presentacion):
// 1) Encuesta, NPS: "%" en las barras tambien en el celular (vertical, nunca
//    oculto) y el resumen dice que 21,4 es el NPS = % promotores - % detractores.
// 2) Flujo por hora: las columnas llevan el titulo "Día del mes".
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('../../public/js/encuesta-logic.js');

const JS = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');

test('NPS: el resumen muestra la formula con % y aclara que es promotores − detractores (octubre 21,4)', () => {
  const ctx = { esc: (s) => String(s), console };
  vm.createContext(ctx);
  vm.runInContext(JS('encuesta-logic.js') + '\n' + JS('encuesta.js'), ctx);
  const V = Array.from({ length: 11 }, (_, v) => ({ valor: v, cantidad: { 0: 4, 1: 3, 4: 1, 5: 2, 8: 2, 9: 4, 10: 12 }[v] || 0 }));
  const html = ctx._encuestaNpsHtml(L.encuestaNps({ valores: V }));
  const txt = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.match(txt, /NPS \(promotores − detractores\) 21,4/);
  assert.match(txt, /NPS = 57,1 % de promotores − 35,7 % de detractores = 21,4/);
  assert.match(txt, /Promotores 16 \(57,1 %\), pasivos 2 \(7,1 %\), detractores 10 \(35,7 %\), sobre 28 que contestaron la pregunta 1 \(100 %\)/);
});

test('NPS: los "%" de las barras no se ocultan en el celular (van verticales)', () => {
  const s = JS('encuesta.js');
  assert.ok(!s.includes('return ctx.chart.width >= 480; };'), 'ya no se ocultan');
  assert.ok(s.includes("o.plugins.datalabels.rotation = function (ctx) { return ctx.chart.width < 480 ? -90 : 0; };"));
});

test('Flujo por hora: encabezado "Día del mes" sobre las columnas de los días', () => {
  const ctx = { esc: (s) => String(s), console };
  vm.createContext(ctx);
  vm.runInContext(JS('flujo-hora-logic.js') + '\n' + JS('flujo-hora.js'), ctx);
  const m = ctx.flujoHoraMatriz([{ dia: '2025-03-03', hora: 8, ingresadas: 5, contestadas: 4, abandonadas: 1 }], '2025-03', 'ingresadas');
  const html = ctx._flujoHoraTablaHtml(m, { key: 'ingresadas', titulo: 'Ingresadas' });
  assert.ok(html.includes('<th scope="colgroup" colspan="31" class="fh-dias-titulo">Día del mes</th>'));
  assert.ok(html.includes('rowspan="2">Hora</th>') && html.includes('rowspan="2">Total</th>'));
});
