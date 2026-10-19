// fase155-boton-tema-tablero.test.js — Fase 155 (reunion con Edwin, 19/10):
// boton de modo claro/oscuro visible dentro del tablero de cliente, al lado de
// Exportar, con el MISMO mecanismo de tema (theme.js, clase .theme-toggle).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { request, app } = require('./helpers');

test('index.html: el boton de tema del tablero va justo despues de Exportar y usa toggleTema()', async () => {
  const res = await request(app).get('/');
  const html = res.text;
  const exp = html.indexOf('id="gd-export-btn"');
  const btn = html.indexOf('id="gd-tema-btn"');
  assert.ok(exp !== -1 && btn > exp, 'el boton existe y va despues de Exportar');
  const etiqueta = html.slice(html.lastIndexOf('<button', btn), html.indexOf('</button>', btn));
  assert.match(etiqueta, /class="[^"]*\btheme-toggle\b/, 'clase theme-toggle (mismo mecanismo)');
  assert.match(etiqueta, /onclick="toggleTema\(\)"/);
  assert.match(etiqueta, /type="button"/);
  assert.match(etiqueta, /aria-label="[^"]+"/, 'texto accesible');
  assert.match(etiqueta, /lucide\.svg#i-(moon|sun)/, 'icono Lucide');
  // Entre Exportar y el boton de tema no hay otro boton.
  const entre = html.slice(exp, html.lastIndexOf('<button', btn));
  assert.equal((entre.match(/<button/g) || []).length, 0);
});

test('theme.js: al cambiar de tema, el boton del tablero cambia de icono y de texto accesible', () => {
  const attrs = { 'data-theme': 'light' };
  const boton = {
    innerHTML: '', classList: { add() {}, remove() {} },
    _a: { title: 'Cambiar tema', 'aria-label': 'Cambiar tema' },
    setAttribute(k, v) { this._a[k] = v; }, hasAttribute(k) { return k in this._a; },
  };
  const ctx = {
    document: {
      documentElement: { getAttribute: (k) => attrs[k], setAttribute: (k, v) => { attrs[k] = v; } },
      querySelectorAll: (sel) => (sel === '.theme-toggle' ? [boton] : []),
      addEventListener() {},
    },
    localStorage: { setItem() {} },
    iconoSvg: (n) => '<svg data-icono="' + n + '"></svg>',
    setTimeout() {},
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'theme.js'), 'utf8'), ctx);
  ctx.toggleTema();
  assert.equal(attrs['data-theme'], 'dark');
  assert.match(boton.innerHTML, /sun/);
  assert.equal(boton._a['aria-label'], 'Cambiar a tema claro');
  assert.equal(boton._a.title, 'Cambiar a tema claro');
  ctx.toggleTema();
  assert.equal(attrs['data-theme'], 'light');
  assert.match(boton.innerHTML, /moon/);
  assert.equal(boton._a.title, 'Cambiar a tema oscuro');
});
