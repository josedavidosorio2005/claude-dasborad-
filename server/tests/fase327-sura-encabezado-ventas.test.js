// fase327-sura-encabezado-ventas.test.js — Fase 327 (10/11/2026, pedido de Edwin): en el tablero
// Televentas de SURA (Cumplimiento) el encabezado de la seccion dice «📅 Ventas por mes» y ya no
// queda «Agendas» en el tablero (tampoco en los comentarios). Solo texto: ningun calculo cambia.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const leer = (f) => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');

test('Televentas SURA: encabezado «📅 Ventas por mes» y ningún «Agendas» en el tablero', () => {
  const app = leer('public/js/sura-televentas-app.js');
  assert.doesNotThrow(() => new vm.Script(app));
  assert.ok(!/agenda/i.test(app), 'no queda «Agendas» en el tablero');
  assert.equal(app.split('📅 Ventas por mes</h2>').length - 1, 1);
  assert.ok(app.includes('/* ---------- Página 4: Ventas por mes ---------- */'));
  assert.ok(app.includes('/* ---------- Filtro por ciudades y departamentos (Ventas por mes) ---------- */'));
});

test('el generador lleva los tres cambios (no se pierden al regenerar desde el HTML de Edwin)', () => {
  const g = leer('scripts/sura/generar-televentas.js');
  assert.ok(g.includes("M('📅 Agendas</h2>', '📅 Ventas por mes</h2>');"));
  assert.ok(g.includes("X('/* ---------- Página 4: Agendas ---------- */', '/* ---------- Página 4: Ventas por mes ---------- */', 1);"));
  assert.ok(g.includes("X('/* ---------- Filtro por ciudades y departamentos (Agendas) ---------- */', '/* ---------- Filtro por ciudades y departamentos (Ventas por mes) ---------- */', 1);"));
});
