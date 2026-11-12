// fase348-f-televentas-todos.test.js — Fase 348, punto F (reunion con Edwin del 12/11): boton
// «Quitar todos / Agregar todos» en los filtros generales de Televentas SURA (Mes y Resultado de
// validación), hecho desde afuera: el HTML del supervisor no se toca. El boton marca/desmarca las
// casillas que falten y dispara el mismo change que el tablero ya escucha.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const L = require('../../public/js/sura-televentas-todos.js');

const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');

test('F: el texto sigue al estado (todas marcadas = Quitar todos; si falta alguna = Agregar todos)', () => {
  assert.deepEqual(L.stvTodosEstado(3, 3), { total: 3, marcadas: 3, accion: 'quitar', texto: 'Quitar todos', visible: true });
  assert.equal(L.stvTodosEstado(3, 2).texto, 'Agregar todos');
  assert.equal(L.stvTodosEstado(3, 0).accion, 'agregar');
  assert.equal(L.stvTodosEstado(1, 1).visible, false, 'con una sola casilla no hace falta');
  assert.equal(L.stvTodosEstado(0, 0).visible, false);
  assert.equal(L.stvTodosEstado(2, 9).marcadas, 2);
  assert.deepEqual(L.STV_TODOS_GRUPOS.map((g) => g.id), ['mf', 'vf']);
});

// DOM minimo: un contenedor con casillas y el registro de los change que se disparan.
function domFalso(estados) {
  const eventos = [];
  const oyentes = {};
  const casillas = estados.map((c, i) => ({ checked: c, value: 'v' + i, dispatchEvent(e) { eventos.push([this.value, this.checked, e.type, e.bubbles]); } }));
  const insertados = [];
  const cont = {
    attrs: {}, getAttribute(k) { return this.attrs[k]; }, setAttribute(k, v) { this.attrs[k] = v; },
    querySelectorAll: () => casillas, addEventListener: (t, f) => { oyentes[t] = f; },
    parentNode: { insertBefore: (n) => insertados.push(n) },
  };
  const root = { querySelector: (s) => (s === '#mf' ? cont : null), appendChild: (n) => insertados.push(n) };
  global.document = { createElement: () => ({ attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(t, f) { this['on' + t] = f; } }) };
  global.Event = class { constructor(type, o) { this.type = type; this.bubbles = !!(o && o.bubbles); } };
  return { root, cont, casillas, eventos, insertados };
}

test('F: Quitar todos desmarca y dispara change solo en las que cambian; Agregar todos las vuelve a marcar', () => {
  const d = domFalso([true, true, true]);
  L.stvTodosMontar(d.root);
  const btn = d.insertados.find((n) => n.attrs['data-todos-de'] === 'mf');
  assert.ok(btn, 'boton insertado antes del grupo de Mes');
  assert.equal(btn.textContent, 'Quitar todos');
  assert.equal(btn.attrs['aria-label'], 'Quitar todos (meses)');
  btn.onclick();
  assert.deepEqual(d.casillas.map((c) => c.checked), [false, false, false]);
  assert.deepEqual(d.eventos, [['v0', false, 'change', true], ['v1', false, 'change', true], ['v2', false, 'change', true]]);
  assert.equal(btn.textContent, 'Agregar todos');
  d.casillas[1].checked = true; d.eventos.length = 0;
  btn.onclick();
  assert.deepEqual(d.eventos.map((e) => e[0]), ['v0', 'v2'], 'la que ya estaba marcada no se toca');
  assert.equal(btn.textContent, 'Quitar todos');
  L.stvTodosMontar(d.root);
  assert.equal(d.insertados.filter((n) => n.attrs['data-todos-de'] === 'mf').length, 1, 'montar dos veces no duplica el boton');
  delete global.document; delete global.Event;
});

test('F: se monta al abrir Televentas, desde afuera (sin tocar el HTML del supervisor)', () => {
  const html = PUB('index.html');
  assert.ok(html.indexOf('js/sura-televentas-todos.js') < html.indexOf('js/sura-televentas.js"'));
  assert.match(PUB('js/sura-televentas.js'), /if \(typeof stvTodosMontar === 'function'\) stvTodosMontar\(_stv\.root\);/);
  let base;
  try { base = execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { encoding: 'utf8' }).trim(); } catch (e) { return; } // sin git: se omite
  const diff = execFileSync('git', ['diff', base, '--', 'public/js/sura-televentas-app.js', 'public/css/sura-televentas-app.css', 'scripts/sura'], { encoding: 'utf8' });
  assert.equal(diff, '', 'el tablero del supervisor no cambia');
});
