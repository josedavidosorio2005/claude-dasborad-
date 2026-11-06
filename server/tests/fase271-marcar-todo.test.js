// fase271-marcar-todo.test.js — Fase 271 (pedido de Edwin, 05/11): "Marcar
// todo / Ninguno" en los selectores con casillas.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PUB = path.join(__dirname, '..', '..', 'public');
const M = require(path.join(PUB, 'js', 'marcar-todo.js'));

function dom(n, deshabilitada) {
  const eventos = [];
  const boxes = Array.from({ length: n }, (_, k) => ({ checked: k === 0, disabled: k === deshabilitada, dispatchEvent: (e) => eventos.push([k, e.type]) }));
  const cont = { querySelectorAll: () => boxes };
  return { boxes, eventos, document: { getElementById: (id) => (id === 'lista' ? cont : null) } };
}

test('marcarTodo: marca / desmarca las habilitadas y avisa UN solo change', () => {
  const d = dom(4, 2);
  const ctx = { document: d.document, Event: function (t) { this.type = t; } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(PUB, 'js', 'marcar-todo.js'), 'utf8').replace(/document\.addEventListener\(/, '(function(){})('), ctx);
  assert.equal(ctx.marcarTodo('lista', true), 2, 'la 0 ya estaba y la 2 esta deshabilitada');
  assert.deepEqual(d.boxes.map((b) => b.checked), [true, true, false, true]);
  assert.deepEqual(d.eventos, [[3, 'change']], 'un solo aviso');
  d.eventos.length = 0;
  assert.equal(ctx.marcarTodo('lista', false), 3);
  assert.deepEqual(d.boxes.map((b) => b.checked), [false, false, false, false]);
  assert.equal(d.eventos.length, 1);
  assert.equal(ctx.marcarTodo('no-existe', true), 0);
});

test('la barra: 2 botones con el contenedor, sin caracteres raros en el id', () => {
  const h = M.marcarTodoBarraHtml('au-asesoras-lista-3');
  assert.match(h, /<button type="button" class="btn-sm" data-marcar-todo="au-asesoras-lista-3" data-on="1">Marcar todo<\/button>/);
  assert.match(h, /data-on="0">Ninguno<\/button>/);
  const sucio = M.marcarTodoBarraHtml('x"><script>');
  assert.ok(sucio.includes('data-marcar-todo="xscript"') && !sucio.includes('<script'), 'el id se limpia');
});

test('donde va: MESES, Agendas por usuaria (Asesor) y las 4 listas del formulario de usuario', () => {
  const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  for (const id of ['gd-meses-lista', 'mu-client-perm-grid', 'mu-campaign-perm-grid', 'mu-plantillas-grid', 'mu-cargar-modulos-grid']) {
    assert.ok(html.includes(M.marcarTodoBarraHtml(id)), id);
  }
  assert.ok(html.indexOf('js/marcar-todo.js') > html.indexOf('js/esc.js'));
  const au = fs.readFileSync(path.join(PUB, 'js', 'agendas-usuaria.js'), 'utf8');
  assert.ok(au.includes("marcarTodoBarraHtml('au-asesoras-lista-' + i)") && au.includes('id="au-asesoras-lista-\' + i + \'"'));
});
