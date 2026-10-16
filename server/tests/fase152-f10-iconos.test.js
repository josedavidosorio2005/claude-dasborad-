// fase152-f10-iconos.test.js — Fase 152 (F10, opcion 1: Lucide): iconos
// SVG dentro del repo en lugar de emojis en el menu y los botones.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { iconoSvg, ICONOS_SPRITE } = require('../../public/js/iconos.js');

const PUB = path.join(__dirname, '..', '..', 'public');
const leer = (r) => fs.readFileSync(path.join(PUB, r), 'utf8');
const sprite = leer('img/iconos/lucide.svg');
const html = leer('index.html');
const idsSprite = new Set([...sprite.matchAll(/<symbol id="i-([a-z0-9-]+)"/g)].map((m) => m[1]));

test('iconoSvg: SVG decorativo (aria-hidden, sin foco) que usa el sprite del repo', () => {
  const s = iconoSvg('users');
  assert.equal(s, '<svg class="icono" aria-hidden="true" focusable="false"><use href="img/iconos/lucide.svg#i-users"></use></svg>');
  assert.equal(ICONOS_SPRITE, 'img/iconos/lucide.svg', 'mismo origen: sin CDN');
  assert.match(iconoSvg('x"><script>'), /#i-xscript"/, 'el nombre se limpia');
});

test('el sprite: solo dibujos (sin scripts ni enlaces), con currentColor, y su licencia ISC', () => {
  assert.doesNotMatch(sprite, /<script|\son[a-z]+=|xlink:href|<image|<foreignObject|https?:\/\/(?!www\.w3\.org)/i);
  assert.match(sprite, /stroke="currentColor"/);
  assert.ok(idsSprite.size >= 26);
  const lic = leer('img/iconos/LICENSE');
  assert.match(lic, /ISC License/);
  assert.match(lic, /Lucide Contributors/);
});

test('todo icono que se usa existe en el sprite y va con aria-hidden', () => {
  const fuentes = [html, ...fs.readdirSync(path.join(PUB, 'js')).filter((f) => f.endsWith('.js')).map((f) => leer('js/' + f))].join('\n');
  const usados = new Set([
    ...[...fuentes.matchAll(/lucide\.svg#i-([a-z0-9-]+)/g)].map((m) => m[1]),
    ...[...fuentes.matchAll(/iconoSvg\('([a-z0-9-]+)'/g)].map((m) => m[1]),
  ]);
  assert.ok(usados.size >= 20);
  for (const n of usados) assert.ok(idsSprite.has(n), 'falta en el sprite: ' + n);
  const svgs = html.match(/<svg class="icono"[^>]*>/g) || [];
  assert.ok(svgs.length >= 40);
  svgs.forEach((t) => { assert.match(t, /aria-hidden="true"/); assert.match(t, /focusable="false"/); });
});

test('menu y botones ya no usan los emojis reemplazados', () => {
  const MENU = { 'menu-users': 'users', 'menu-perms': 'lock', 'menu-hist': 'history', 'menu-metas': 'target', 'menu-umbrales': 'gauge',
    'menu-reportesrole': 'trending-up', 'menu-cargas': 'upload', 'menu-dashboards': 'layout-dashboard', 'menu-inventario': 'package',
    'menu-gerencia': 'chart-column', 'menu-gestionhumana': 'contact', 'asesor-menu-calidad': 'trophy',
    'supervisor-menu-dashboards': 'layout-dashboard', 'supervisor-menu-calidad': 'circle-check' };
  for (const [id, icono] of Object.entries(MENU)) {
    const linea = html.split('\n').find((l) => l.includes('id="' + id + '"'));
    assert.ok(linea, id);
    assert.ok(linea.includes('<span class="s-icon">' + iconoSvg(icono) + '</span>'), id + ' -> ' + icono);
  }
  // Emojis de botones que ya no deben aparecer en index.html
  for (const ent of ['&#128065;', '&#127769;', '&#9776;', '&#128100;', '&#9974;', '&#11015;', '&#8635;', '&#8592;', '&#128276;']) {
    assert.ok(!html.includes(ent), 'sigue el emoji ' + ent);
  }
  assert.doesNotMatch(html, /<div class="search-bar"><span[^>]*>&#128269;/);
  assert.doesNotMatch(html, /<span class="s-icon">&#/);
});

test('los iconos que cambian de estado (tema, contrasena, pantalla completa) tambien son SVG', () => {
  assert.match(leer('js/theme.js'), /iconoSvg\(tema === 'dark' \? 'sun' : 'moon'\)/);
  const ui = leer('js/ui-core.js');
  assert.match(ui, /btn\.innerHTML=iconoSvg\('eye-off'\)/);
  assert.match(ui, /btn\.innerHTML=iconoSvg\('eye'\)/);
  assert.match(leer('js/dashboard-generic.js'), /GD_FS_ICON_ENTRAR = iconoSvg\('maximize'\), GD_FS_ICON_SALIR = iconoSvg\('minimize'\)/);
  const i = (s) => html.indexOf('<script src="js/' + s + '"></script>');
  assert.ok(i('iconos.js') > 0 && i('iconos.js') < i('theme.js'), 'iconos.js antes de theme.js');
});
