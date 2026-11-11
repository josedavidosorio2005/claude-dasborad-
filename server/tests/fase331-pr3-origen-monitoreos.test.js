// fase331-pr3-origen-monitoreos.test.js — Fase 331 (PR 3): en Calidad › Monitoreos los de
// Calidad de encuestas se distinguen (marca "Encuesta") y se pueden filtrar por origen. Solo
// cambia la LISTA: los promedios, tarjetas y resumen siguen contando todos los monitoreos (lo
// decide el supervisor). Datos SINTETICOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const C = require('../../public/js/calidad-encuestas-logic.js');

const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');
const LISTA = [{ id: 1, origen: 'manual' }, { id: 2, origen: 'encuesta' }, { id: 3 }, { id: 4, origen: 'encuesta' }];

test('filtro por origen: todos, los de siempre (incluye los viejos sin origen) y los de encuesta', () => {
  assert.deepEqual(C.cenFiltrarPorOrigen(LISTA, '').map((m) => m.id), [1, 2, 3, 4]);
  assert.deepEqual(C.cenFiltrarPorOrigen(LISTA, 'manual').map((m) => m.id), [1, 3]);
  assert.deepEqual(C.cenFiltrarPorOrigen(LISTA, 'encuesta').map((m) => m.id), [2, 4]);
  assert.deepEqual(C.cenFiltrarPorOrigen(LISTA, 'otro').map((m) => m.id), [1, 2, 3, 4], 'un valor raro no esconde nada');
  assert.equal(C.cenOrigenDe({}), 'manual');
});

test('nota: cuantos vienen de encuestas y que por ahora cuentan en los promedios', () => {
  assert.equal(C.cenNotaOrigen([{ origen: 'manual' }]), '');
  assert.equal(C.cenNotaOrigen(LISTA), '2 monitoreos vienen de Calidad de encuestas. Por ahora cuentan en los promedios igual que los demás.');
});

test('cableado: filtro oculto por defecto, marca "Encuesta" en la fila, y solo la lista usa el filtro', () => {
  const html = PUB('index.html');
  assert.ok(html.includes('<div class="cal-origen-fil" id="cal-origen-fil" hidden>'));
  assert.ok(html.includes('<select id="cal-origen-sel" onchange="renderCalMonitoreosTable()">'));
  const cal = PUB('js/calidad.js');
  assert.ok(cal.includes("(m.origen==='encuesta'?' <span class=\"cen-marca\""));
  // El filtro vive SOLO en renderCalMonitoreosTable: las tarjetas y el resumen no lo usan.
  assert.equal(cal.split('cenPrepararFiltroOrigen').length - 1, 2, 'una sola llamada (typeof + uso)');
  const ini = cal.indexOf('function renderCalMonitoreosTable(){');
  const fin = cal.indexOf('\nfunction ', ini + 10);
  assert.ok(cal.indexOf('cenPrepararFiltroOrigen') > ini && cal.indexOf('cenPrepararFiltroOrigen') < fin);
  for (const f of ['renderCalKpis', 'renderCalResumenTable']) {
    const i = cal.indexOf('function ' + f + '(');
    const j = cal.indexOf('\nfunction ', i + 10);
    assert.ok(!cal.slice(i, j).includes('origen'), f + ' no filtra por origen (ningun promedio cambia)');
  }
  const js = PUB('js/calidad-encuestas.js');
  assert.ok(js.includes("if (!mostrar) { sel.value = ''; return { lista: lista, origen: '' }; }"), 'en otras campañas no se ve y no filtra');
  const css = PUB('css/styles.css');
  const b = css.slice(css.indexOf('/* Fase 331 (PR 3)'));
  assert.ok(!/#[0-9a-f]{3,6}\b/i.test(b), 'solo tokens');
});
