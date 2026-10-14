// fase144-a3b-dialogos-restantes.test.js — Fase 144 (A3b), pendiente de A3:
// los 9 dialogos que no usan motionAbrirModal (Clientes, Usuario, Contrasena,
// Eliminar, Inventario item/movimiento, Gestion Humana, Gerencia KPI y
// "Cambiar mi contrasena") reciben el mismo trato de A3: role="dialog"
// aria-modal con titulo, foco adentro, fondo inerte, Escape y foco de vuelta.
// El comportamiento real se verifico en navegador (Playwright + Brave); aqui
// se fija la estructura y la logica de abrir/cerrar con un DOM minimo.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, '..', '..', 'public');
const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
const mh = require('../../public/js/motion-helpers.js');

const DIALOGOS = ['clients-modal-overlay', 'modal-user', 'modal-pass', 'modal-delete', 'inv-item-modal',
  'gh-person-modal', 'inv-mov-modal', 'ger-kpi-modal', 'modal-change-own-password'];

test('index.html: los 9 dialogos son role="dialog" aria-modal="true" con su titulo <h3> enlazado', () => {
  for (const id of DIALOGOS) {
    const tag = (html.match(new RegExp('<div [^>]*id="' + id + '"[^>]*>')) || [])[0];
    assert.ok(tag, id);
    assert.match(tag, /role="dialog"/, id);
    assert.match(tag, /aria-modal="true"/, id);
    const titulo = (tag.match(/aria-labelledby="([^"]+)"/) || [])[1];
    assert.ok(titulo, id);
    assert.match(html, new RegExp('<h3 id="' + titulo + '">[^<]+</h3>'), id);
  }
});

test('los textos de los titulos no cambian', () => {
  for (const t of ['Dashboard Clientes', 'Cambiar Contraseña', 'Eliminar Usuario', 'Registrar Movimiento', 'Cambiar mi Contraseña']) {
    assert.match(html, new RegExp('<h3 id="[^"]+">' + t + '</h3>'), t);
  }
});

test('Escape conoce los 9 dialogos y cada uno llama a su funcion de cierre de siempre', () => {
  assert.deepEqual(Object.keys(mh.MOTION_DIALOGOS_SIMPLES), DIALOGOS);
  const esc = mh._modalesEsc();
  for (const id of DIALOGOS) assert.equal(typeof esc[id], 'function', id);
  // los 6 de A3 siguen
  for (const id of ['calidad-overlay', 'gd-overlay', 'cargas-overlay', 'dashcfg-overlay', 'detalle-monitoreo-overlay', 'supervisar-lider-overlay']) {
    assert.equal(typeof esc[id], 'function', id);
  }
  const llamadas = [];
  global.closeModal = (id) => llamadas.push('closeModal:' + id);
  global.closeUserModal = () => llamadas.push('closeUserModal');
  global.closeClientsModal = () => llamadas.push('closeClientsModal');
  try {
    esc['modal-delete'](); esc['modal-user'](); esc['clients-modal-overlay'](); esc['modal-change-own-password']();
  } finally { delete global.closeModal; delete global.closeUserModal; delete global.closeClientsModal; }
  assert.deepEqual(llamadas, ['closeModal:modal-delete', 'closeUserModal', 'closeClientsModal', 'closeModal:modal-change-own-password']);
});

test('abrir enfoca el dialogo y recuerda el boton; cerrar le devuelve el foco', () => {
  const enfocados = [];
  const el = (nombre, extra) => Object.assign({
    nombre, attrs: {}, isConnected: true,
    focus() { enfocados.push(nombre); },
    hasAttribute(k) { return k in this.attrs; },
    setAttribute(k, v) { this.attrs[k] = v; },
    getClientRects() { return [1]; },
    closest() { return null; },
  }, extra);
  const boton = el('boton');
  const caja = el('caja');
  const overlay = { id: 'modal-delete', firstElementChild: caja, contains: (x) => x === caja, classList: { contains: () => true } };
  global.document = { activeElement: boton, body: {}, getElementById: (id) => (id === 'modal-delete' ? overlay : null) };
  try {
    mh.motionAbrirDialogo(overlay);
    assert.equal(caja._motionDisparador, boton);
    assert.equal(caja.attrs.tabindex, '-1');
    assert.deepEqual(enfocados, ['caja']);
    mh.motionCerrarDialogo(overlay);
    assert.deepEqual(enfocados, ['caja', 'boton']);
    assert.equal(caja._motionDisparador, null);
  } finally { delete global.document; }
});

test('el observador solo se activa en navegador y sin animacion nueva', () => {
  const src = fs.readFileSync(path.join(PUB, 'js', 'motion-helpers.js'), 'utf8');
  const bloque = src.slice(src.indexOf('var MOTION_DIALOGOS_SIMPLES'));
  assert.match(bloque, /typeof MutationObserver === 'function'/);
  assert.match(bloque, /attributeFilter: \['class'\]/);
  const abrirCerrar = bloque.slice(bloque.indexOf('function motionAbrirDialogo'), bloque.indexOf('Object.keys(MOTION_DIALOGOS_SIMPLES).forEach(function (id) { MOTION_MODALES_ESC'));
  assert.doesNotMatch(abrirCerrar, /motion-modal-hidden|requestAnimationFrame|transition/);
});
