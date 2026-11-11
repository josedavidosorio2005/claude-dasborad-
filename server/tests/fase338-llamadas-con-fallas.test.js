// fase338-llamadas-con-fallas.test.js — Fase 338 (reunion con Edwin, 11/11): en Dashboard › Calidad
// (todas las campañas, tambien Televentas SURA: es el mismo bloque) «Llamadas con fallas» muestra 10
// filas, las mas recientes primero, con el total en el titulo, «Ver más» para todas y «Ver menos» para
// recogerlas. La tabla por asesor no cambia. Se prueba el bloque real en un DOM de mentira (vm).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');

function montar(nFallas) {
  const els = {};
  const el = (id) => (els[id] = els[id] || { id, innerHTML: '', style: {}, querySelector: () => null });
  const ctx = {
    console, esc: (x) => String(x == null ? '' : x).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';'),
    textoFormatoNombre: (x) => x, document: { getElementById: el, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] },
    currentUser: { rol: 'ADMIN' }, LISTAS_REGISTRO: { asesorVisibleCliente: [] }, _gdMeses: () => [],
  };
  vm.createContext(ctx);
  for (const f of ['calidad-analisis-logic.js', 'calidad-equipo-logic.js']) vm.runInContext(PUB(f), ctx);
  // Lo que el panel usa de calidad-analisis.js.
  vm.runInContext("function _caPill(c){return '<span>'+c.t+'</span>';} function _caPct(n){return n+'%';} function _caTieneNo(m){return Object.keys(m.answers||{}).some(function(k){return m.answers[k]==='NO';});}", ctx);
  vm.runInContext(PUB('calidad-panel.js'), ctx);
  const pl = { id: 1, campana: 'X', principal: true, items: [{ n: 1, label: 'Saludo' }, { n: 2, label: 'Cierre' }] };
  ctx.CAL_PLANTILLAS_TODAS = [pl];
  const mons = [];
  for (let i = 0; i < nFallas; i++) mons.push({ id: i + 1, campana: 'X', asesor: 'Asesor Ficticio', fecha: '2026-10-' + String(1 + (i % 28)).padStart(2, '0'), puntaje: 80, answers: { 1: 'SI', 2: 'NO' } });
  ctx.CAL_DB = { X: { monitoreos: mons } };
  ctx._cmpGraficas = () => {};
  ctx._cmpFiltro = { X: { clave: 'todos', meses: ['2026-10'], asesores: null, q: '' } };
  ctx._cmpRender({ tipo: 'calidad_monitoreos_panel', campana: 'X', mesesPropios: true }, 0);
  return { ctx, html: () => els['gd-p0'].innerHTML };
}
const filasFallas = (html) => { const i = html.indexOf('Llamadas con fallas ('); return (html.slice(i).match(/<tr class="ca-click"/g) || []).length; };

test('32 llamadas con fallas: 10 filas, total en el titulo y «Ver más (22)»; al abrir, todas y «Ver menos»', () => {
  const m = montar(32);
  let h = m.html();
  assert.ok(h.includes('Llamadas con fallas (32)'));
  assert.equal(filasFallas(h), 10);
  assert.ok(h.includes('aria-expanded="false" onclick="_cmpMostrarTodas(this.dataset.camp)">Ver más (22)</button>'));
  m.ctx._cmpMostrarTodas('X');
  h = m.html();
  assert.equal(filasFallas(h), 32);
  assert.ok(h.includes('aria-expanded="true" onclick="_cmpMostrarTodas(this.dataset.camp)">Ver menos</button>'));
  m.ctx._cmpMostrarTodas('X');
  assert.equal(filasFallas(m.html()), 10, '«Ver menos» las recoge');
});

test('las mas recientes primero; 10 o menos, sin boton', () => {
  const h = montar(32).html();
  const tabla = h.slice(h.indexOf('Llamadas con fallas ('));
  const fechas = [...tabla.matchAll(/<tr class="ca-click"[^>]*><td>(\d{4}-\d{2}-\d{2})<\/td>/g)].map((x) => x[1]);
  assert.deepEqual(fechas, fechas.slice().sort().reverse(), 'de la mas nueva a la mas vieja');
  const corta = montar(10).html();
  assert.equal(filasFallas(corta), 10);
  assert.ok(!corta.includes('cmp-vermas'));
});
