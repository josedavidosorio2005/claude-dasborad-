// fase144-a5-contraste-12px.test.js — Fase 144 (A5). Hallazgos D07
// (contraste AA: version en la barra superior 2.08:1, "Editar"/badge
// INVENTARIO 4.36:1, badge CLIENTES_DASH 3.79:1, texto verde de campañas
// 3.49:1, contador de rol en oscuro 4.23:1), D08 (texto bajo el piso de 12px
// del sistema) y D27 (font-weight 800, que Quicksand no trae) de la Fase 143.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { contrasteRazon } = require('../../public/js/contraste-logic.js');

const PUB = path.join(__dirname, '..', '..', 'public');
const leer = (rel) => fs.readFileSync(path.join(PUB, rel), 'utf8');
const css = leer('css/styles.css');
const archivosJs = fs.readdirSync(path.join(PUB, 'js')).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f);

// Valor de un token en :root (claro) o en :root[data-theme="dark"].
function token(nombre, oscuro) {
  const ini = css.indexOf(oscuro ? ':root[data-theme="dark"]{' : ':root{');
  const bloque = css.slice(ini, css.indexOf('\n}', ini)); // solo el bloque de ESE tema
  const m = bloque.match(new RegExp(nombre.replace(/[-]/g, '\\-') + ':(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\\b'));
  assert.ok(m, 'token ' + nombre + (oscuro ? ' (oscuro)' : ''));
  const v = m[1];
  return v.length === 4 ? '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3] : v;
}
function mezclar(hex, alfa, fondo) {
  const c = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = c(hex), b = c(fondo);
  return '#' + a.map((v, i) => Math.round(v * alfa + b[i] * (1 - alfa)).toString(16).padStart(2, '0')).join('');
}

test('ningun texto en pantalla usa un font-size en rem bajo 0.75rem (12px) en JS, index.html ni CSS', () => {
  for (const rel of archivosJs.concat(['index.html', 'css/styles.css'])) {
    const malos = leer(rel).match(/font-size:\s*0\.(?:[0-6]\d*|7[0-4]?)rem/g) || [];
    assert.deepEqual(malos, [], rel);
  }
});

test('los font-size en px bajo 12px solo existen dentro de las plantillas de IMPRESION (PDF exportado, no se cambia)', () => {
  for (const rel of archivosJs) {
    const src = leer(rel);
    const re = /font-size:\s*(?:1[01]|\d)px/g;
    let m;
    while ((m = re.exec(src))) {
      const antes = src.slice(0, m.index);
      const fn = (antes.match(/function\s+([A-Za-z0-9_]+)\s*\(/g) || []).pop() || '';
      assert.match(fn, /Print/, rel + ': ' + m[0] + ' fuera de una funcion de impresion (' + fn + ')');
    }
  }
});

test('ningun font-weight 800/900 declarado (Quicksand solo trae 400/500/600/700)', () => {
  for (const rel of archivosJs.concat(['index.html', 'css/styles.css'])) {
    assert.doesNotMatch(leer(rel), /font-weight:\s*(800|900)/, rel);
  }
});

test('version en la barra superior: clase en CSS (sin estilo en linea) y >=4.5:1 en escritorio y en el menu movil', () => {
  const html = leer('index.html');
  const spans = html.match(/<span class="navbar-app-version"[^>]*>/g) || [];
  assert.equal(spans.length, 4);
  for (const s of spans) assert.doesNotMatch(s, /style=/);
  assert.match(css, /\.navbar-app-version\{font-size:var\(--fs-note\);color:rgba\(255,255,255,0\.78\)/);
  assert.match(css, /@media\(max-width:768px\)\{ \.navbar-right \.navbar-app-version\{color:var\(--c-text-muted\);\} \}/);
  const brand = token('--c-brand');
  assert.ok(contrasteRazon(mezclar('#ffffff', 0.78, brand), brand) >= 4.5, 'escritorio');
  assert.ok(contrasteRazon(token('--c-text-muted'), token('--c-surface')) >= 4.5, 'movil claro');
  assert.ok(contrasteRazon(token('--c-text-muted', true), token('--c-surface', true)) >= 4.5, 'movil oscuro');
});

test('"Editar" y badge INVENTARIO: --c-primary sobre --c-info-bg >=4.5:1 en los 2 temas', () => {
  assert.match(css, /\.btn-edit\{background:var\(--c-info-bg\);color:var\(--c-primary\);\}/);
  assert.match(css, /\.badge-INVENTARIO\{background:var\(--c-info-bg\);color:var\(--c-primary\);\}/);
  assert.ok(contrasteRazon(token('--c-primary'), token('--c-info-bg')) >= 4.5);
  assert.ok(contrasteRazon(token('--c-primary', true), token('--c-info-bg', true)) >= 4.5);
});

test('badge CLIENTES_DASH: token medido, >=4.5:1 sobre su fondo', () => {
  assert.match(css, /\.badge-CLIENTES_DASH\{background:#fef9e2;color:var\(--c-badge-clientes-text\);\}/);
  assert.ok(contrasteRazon(token('--c-badge-clientes-text'), '#fef9e2') >= 4.5);
});

test('contador de rol en oscuro (--c-text-2) y texto verde de campañas (--c-success-text) pasan AA', () => {
  assert.match(css, /\[data-theme="dark"\] \.role-count\{color:var\(--c-text-2\);\}/);
  assert.ok(contrasteRazon(token('--c-text-2', true), '#1c3e49') >= 4.5);
  const users = leer('js/users.js');
  assert.doesNotMatch(users, /'var\(--c-success\)'/, '--c-success es token de RELLENO, no de texto');
  assert.equal((users.match(/'var\(--c-success-text\)'/g) || []).length, 2);
  assert.ok(contrasteRazon(token('--c-success-text'), '#ffffff') >= 4.5);
  assert.ok(contrasteRazon(token('--c-success-text', true), token('--c-surface', true)) >= 4.5);
});

test('badge de monitoreos nuevos del asesor: texto blanco sobre --c-danger-dark (>=4.5:1)', () => {
  assert.match(leer('index.html'), /id="asesor-menu-calidad-badge"[^>]*background:var\(--c-danger-dark\);color:var\(--c-on-brand\)/);
  assert.ok(contrasteRazon('#ffffff', token('--c-danger-dark')) >= 4.5);
});
