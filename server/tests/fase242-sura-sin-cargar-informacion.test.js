// fase242-sura-sin-cargar-informacion.test.js — Fase 242 (pedido de Edwin,
// 04/11): el tablero de SURA ya no muestra la pestaña «Cargar información»
// (p1), ni al administrador; esa carga queda solo en Cargar datos.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PUB = path.join(__dirname, '..', '..', 'public');

function aplicar(perm) {
  const mk = (p, on) => ({ dataset: { p }, hidden: false, classList: { on }, clicked: 0, click() { this.clicked++; } });
  const tabs = [mk('p1', true), mk('p9'), mk('p2'), mk('p10')];
  const wrap = { classList: { toggle() {} } };
  const root = {
    querySelectorAll: () => tabs,
    querySelector: (sel) => (sel === '.wrap' ? wrap : sel === '.tab.on' ? tabs.find((t) => t.classList.on) : sel === '.tab:not([hidden])' ? tabs.find((t) => !t.hidden) : null),
  };
  const ctx = { _stv: { root } };
  vm.createContext(ctx);
  const src = fs.readFileSync(path.join(PUB, 'js', 'sura-televentas.js'), 'utf8');
  const i = src.indexOf('var STV_PESTANAS_SOLO_CENTRO');
  vm.runInContext(src.slice(i, src.indexOf('\n}\n', src.indexOf('function _stvAplicarPermisos', i)) + 2), ctx);
  ctx._stvAplicarPermisos(perm);
  return tabs;
}

test('administrador: sin «Cargar información» en el tablero; se abre la primera de las demás', () => {
  const tabs = aplicar({ pestanas: ['p1', 'p9', 'p2', 'p10'], puedeEditar: true });
  assert.deepEqual(tabs.map((t) => [t.dataset.p, t.hidden]), [['p1', true], ['p9', false], ['p2', false], ['p10', false]]);
  assert.equal(tabs[1].clicked, 1, 'abre Cumplimiento');
});

test('cliente: igual que antes (nunca tuvo «Cargar información»)', () => {
  const tabs = aplicar({ pestanas: ['p9', 'p2', 'p10'], puedeEditar: false });
  assert.equal(tabs[0].hidden, true);
  assert.equal(tabs.filter((t) => !t.hidden).length, 3);
});

test('Cargar datos sigue montando «Cargar información» por CSS (no depende de la lista de pestañas)', () => {
  const css = fs.readFileSync(path.join(PUB, 'css', 'sura-televentas-app.css'), 'utf8');
  assert.match(css, /\.wrap\.stv-solo-carga>#p1\{display:block!important\}/);
  assert.match(fs.readFileSync(path.join(PUB, 'js', 'sura-televentas.js'), 'utf8'), /_stvCarga\.root\.querySelector\('\.wrap'\)\.classList\.add\('stv-solo-carga'\)/);
});
