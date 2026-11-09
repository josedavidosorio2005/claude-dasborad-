// fase304-agendas-botones-lineas.test.js — Fase 304 (ajustes del supervisor a
// Clinica Aurora › Agendas): botones de base justo debajo de los filtros y todos
// los botones de la pestaña resaltados; grafica 2 de LINEA de mayor a menor (top 10
// + ver mas); cada grafica cambia solo con sus botones; paleta azul de Aurora con
// contraste en los 2 temas. Nada de ORLANT, Mobilize ni SURA.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const L = require('../../public/js/agendas-usuaria-logic.js');
const { contrasteRazon } = require('../../public/js/contraste-logic.js');

const PUB = path.join(__dirname, '..', '..', 'public');
const au = fs.readFileSync(path.join(PUB, 'js', 'agendas-usuaria.js'), 'utf8');
const css = fs.readFileSync(path.join(PUB, 'css', 'styles.css'), 'utf8');

test('paleta azul de Aurora: >= 3:1 contra la tarjeta en claro y oscuro, sin morados', () => {
  const fondos = { claro: '#ffffff', oscuro: '#132c35' };
  for (const [tema, fondo] of Object.entries(fondos)) {
    for (const id of ['total', 'citas', 'cancelaciones', 'inasistencias']) {
      const c = L.auColorAgendas(id, tema === 'oscuro');
      assert.ok(contrasteRazon(c, fondo) >= 3, `${tema} ${id} ${c}: ${contrasteRazon(c, fondo).toFixed(2)}:1`);
      const [r, g, b] = [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16));
      assert.ok(b >= r && b >= g - 10, `${tema} ${id} ${c} debe ser azul`);
    }
    const p = tema === 'oscuro' ? L.AU_PALETA.oscuro : L.AU_PALETA.claro;
    assert.equal(new Set(Object.values(p)).size, 4, 'cuatro tonos distintos');
  }
  assert.doesNotMatch(au.slice(au.indexOf('// ── Fase 302 (10/11): vista «Agendas»'), au.indexOf('// Excel de la vista')), /\bPC\b|a92dd2|d22d80/, 'sin la paleta morada de antes');
});

test('cada base se distingue tambien por marcador y trazo (no solo por color)', () => {
  const e = ['citas', 'cancelaciones', 'inasistencias'].map(L.auEstiloBase);
  assert.equal(new Set(e.map((x) => x.punto)).size, 3);
  assert.equal(new Set(e.map((x) => JSON.stringify(x.trazo))).size, 3);
});

test('botones de base justo DEBAJO de los filtros, dentro de la misma tarjeta', () => {
  const r = au.slice(au.indexOf('async function _auRenderAgendas'), au.indexOf('// Grafica 1: linea por mes'));
  const iFiltros = r.indexOf("'<div class=\"au-filtros\">'"), iBase = r.indexOf("'<div class=\"au-ag-base\">");
  assert.ok(iFiltros > 0 && iBase > iFiltros, 'la base va despues de los filtros');
  assert.ok(r.indexOf("_auBotones('base'") > iBase);
});

test('botones resaltados: claro fondo negro/letra blanca, oscuro fondo blanco/letra negra; activo azul con ✓; 44 px', () => {
  // Fase 305: los mismos reglones cubren tambien los botones de Mobilize (.gd-botones-resaltados).
  assert.match(css, /\.au-ag-botones \.gd-subtab-btn,\.gd-botones-resaltados \.gd-subtab-btn\{min-height:44px;[^}]*background:#111;color:#fff;/);
  assert.match(css, /\[data-theme="dark"\] \.au-ag-botones \.gd-subtab-btn,\[data-theme="dark"\] \.gd-botones-resaltados \.gd-subtab-btn\{background:#fff;color:#111;/);
  assert.match(css, /\.au-ag-botones \.gd-subtab-btn\.on,\.gd-botones-resaltados \.gd-subtab-btn\.on\{background:#1565c0;[^}]*color:#fff;/);
  assert.match(css, /\[data-theme="dark"\] \.au-ag-botones \.gd-subtab-btn\.on,\[data-theme="dark"\] \.gd-botones-resaltados \.gd-subtab-btn\.on\{background:#90c8f8;[^}]*color:#0a2540;/);
  assert.match(css, /\.au-ag-botones \.gd-subtab-btn\.on::before,\.gd-botones-resaltados \.gd-subtab-btn\.on::before\{content:"✓ "\}/);
  // Contraste del texto de cada estado (WCAG AA 4.5:1).
  for (const [fondo, texto] of [['#111111', '#ffffff'], ['#ffffff', '#111111'], ['#1565c0', '#ffffff'], ['#90c8f8', '#0a2540']]) {
    assert.ok(contrasteRazon(fondo, texto) >= 4.5, fondo + '/' + texto);
  }
  // Los 3 grupos de botones usan el mismo componente.
  for (const g of ["_auBotones('base'", "_auBotones('g1'", "_auBotones('g2'"]) assert.ok(au.includes(g), g);
});

test('grafica 2: LINEA por categoria, de mayor a menor, top 10 + ver mas', () => {
  const g2 = au.slice(au.indexOf('function _auPintarG2'), au.indexOf('// Botones: la base redibuja'));
  assert.match(g2, /type: 'line'/);
  assert.match(g2, /auRanking\(/);
  assert.match(g2, /st\.verMas \? null : AU_TOP/);
  const filas = [
    { base: 'citas', prof: 'B', n: 5 }, { base: 'citas', prof: 'A', n: 9 }, { base: 'cancelaciones', prof: 'B', n: 7 }, { base: 'inasistencias', prof: 'C', n: 1 },
  ];
  assert.deepEqual(L.auRanking(filas, 'prof', 10).items.map((x) => [x.valor, x.total]), [['B', 12], ['A', 9], ['C', 1]], 'de mayor a menor (no por fecha)');
});

test('cada grafica cambia SOLO con sus botones; la base y los filtros cambian las dos', () => {
  const h = au.slice(au.indexOf('// Botones: la base redibuja'), au.indexOf('// Excel de la vista'));
  assert.match(h, /if \(g === 'base'\) \{ st\.base = [^;]+; _auRepintarTodos\(\); return; \}/);
  assert.match(h, /if \(g === 'g1'\) \{[^}]*_auPintarG1\(i, camp\); return; \}/);
  assert.match(h, /if \(g === 'g2'\) \{[^}]*_auPintarG2\(i, camp\); return; \}/);
  assert.doesNotMatch(h.slice(h.indexOf("if (g === 'g1')")), /_auRepintarTodos/, 'g1, g2 y ver mas no repintan todo');
  assert.doesNotMatch(au.slice(au.indexOf('function _auPintarG1'), au.indexOf('// Grafica 2:')), /_auPintarG2|au-g2/);
  assert.doesNotMatch(au.slice(au.indexOf('function _auPintarG2'), au.indexOf('// Botones: la base redibuja')), /_auPintarG1|au-g1/);
});
