// fase348-e-tema-claro-tarjetas.test.js — Fase 348, punto E (reunion con Edwin del 12/11): en el
// tema claro las tarjetas y bloques se confundian con el fondo. Sombra suave + aro de 1px desde los
// estilos comunes, SOLO en claro (el oscuro no cambia) y sin colores nuevos (todo de --shadow-rgb y
// --c-surface). public/css/paleta.css no se toca.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const css = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'css', 'styles.css'), 'utf8');
const bloque = css.slice(css.indexOf('/* Fase 348 (E): TEMA CLARO'));
const reglas = bloque.slice(bloque.indexOf('*/') + 2);

test('E: cada regla del bloque es solo para el tema claro', () => {
  const selectores = reglas.split('}').map((r) => r.split('{')[0].trim()).filter(Boolean);
  assert.equal(selectores.length, 5);
  for (const s of selectores) {
    for (const parte of s.split(',')) assert.match(parte.trim(), /^:root:not\(\[data-theme="dark"\]\)/, parte);
  }
});

test('E: tarjetas, KPIs y cuadros de grafica con sombra suave y aro', () => {
  assert.match(reglas, /\.aurora-card,[\s\S]*\.section-card,[\s\S]*\.stat-card,[\s\S]*\.aurora-chart-card,[\s\S]*\.aurora-table-card\{box-shadow:var\(--e-aro\),var\(--e-sombra\)\}/);
  assert.match(reglas, /\.aurora-kpi\{background:var\(--c-surface\);box-shadow:var\(--e-aro\),var\(--e-sombra-suave\)\}/);
  assert.match(reglas, /\.gd-grafica\{box-shadow:var\(--e-sombra-suave\)\}/);
});

test('E: sin colores nuevos (solo rgba de --shadow-rgb)', () => {
  assert.doesNotMatch(bloque, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(bloque, /rgba?\(/, 'las reglas solo usan los tokens');
  // Los 3 tokens viven en :root, junto a --shadow-*, y solo con --shadow-rgb.
  const tokens = css.slice(css.indexOf('/* Fase 348 (E): sombra y aro'), css.indexOf('/* Fase 348 (E): sombra y aro') + 400).split('\n').slice(1, 4);
  assert.deepEqual(tokens.map((l) => l.trim().split(':')[0]), ['--e-aro', '--e-sombra', '--e-sombra-suave']);
  for (const l of tokens) {
    const todas = (l.match(/rgba?\(/g) || []).length;
    assert.ok(todas > 0);
    assert.equal((l.match(/rgba\(var\(--shadow-rgb\),0\.\d+\)/g) || []).length, todas, l);
  }
  assert.ok(css.indexOf('--e-aro:') < css.indexOf(':root[data-theme="dark"]{'), 'en el :root de arriba');
});

test('E: public/css/paleta.css y el bloque del tema oscuro no cambian en esta rama', () => {
  let base;
  try { base = execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { encoding: 'utf8' }).trim(); } catch (e) { return; } // sin git (docker): se omite
  const diffPaleta = execFileSync('git', ['diff', base, '--', 'public/css/paleta.css'], { encoding: 'utf8' });
  assert.equal(diffPaleta, '', 'paleta.css intacta');
  const ini = css.indexOf(':root[data-theme="dark"]{');
  const viejo = execFileSync('git', ['show', base + ':public/css/styles.css'], { encoding: 'utf8' });
  const bloqueOscuro = (s) => s.slice(s.indexOf(':root[data-theme="dark"]{'), s.indexOf('}', s.indexOf(':root[data-theme="dark"]{')));
  assert.ok(ini !== -1);
  assert.equal(bloqueOscuro(css), bloqueOscuro(viejo), 'tokens del tema oscuro intactos');
});
