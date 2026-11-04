// fase249-encabezado-sin-subtitulo.test.js — Fase 249 (pedido de Edwin, 04/11:
// "entre mas sencillo, mejor"): el encabezado de los dashboards ya no muestra
// la linea "Informe <meses> — <cliente>"; quedan el titulo y "Ultima
// actualizacion". Los exports (Excel/PDF) no dependian de ese texto.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DG = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'dashboard-generic.js'), 'utf8');

function extraer(src, firma) {
  const ini = src.indexOf(firma);
  assert.ok(ini >= 0, firma);
  return src.slice(ini, src.indexOf('\n}\n', ini) + 2);
}

test('el subtitulo queda vacio y oculto, y el boton Filtros se sigue actualizando', () => {
  const sub = { innerHTML: 'Informe Todos los meses (Ago 2026 – Oct 2026) — ORLANT', hidden: false };
  let filtros = 0;
  const ctx = { document: { getElementById: (id) => (id === 'gd-sub' ? sub : null) }, _gdFiltrosHeaderTexto: () => { filtros++; } };
  vm.createContext(ctx);
  vm.runInContext(extraer(DG, 'function _gdPintarSubtitulo()'), ctx);
  ctx._gdPintarSubtitulo();
  assert.equal(sub.innerHTML, '');
  assert.equal(sub.hidden, true);
  assert.equal(filtros, 1);
  // sin el elemento no falla
  ctx.document.getElementById = () => null;
  ctx._gdPintarSubtitulo();
  assert.equal(filtros, 2);
});

test('ningun codigo arma el texto "Informe ..." del encabezado; titulo y ultima actualizacion siguen', () => {
  assert.doesNotMatch(DG, /'Informe '/);
  assert.match(DG, /document\.getElementById\('gd-title'\)\.textContent = _gd\.config\.titulo \|\| _gd\.cliente;/);
  assert.match(DG, /function _gdPintarUltimaAct\(\)/);
});

test('Excel y PDF arman su propio texto de meses (no leen el subtitulo)', () => {
  assert.doesNotMatch(DG.replace(extraer(DG, 'function _gdPintarSubtitulo()'), ''), /gd-sub'/);
  assert.match(DG, /var mesLbl = _gdMesesLblExport\(\); \/\/ Fase 207: los meses de MESES/);
});
