// fase136-pr8-modales-unificados.test.js — Fase 136 (PR 8, F04): los 6
// modales/overlays (calidad, supervisar-lider, cargas, dashcfg, gd,
// detalle-monitoreo) comparten la misma transicion de entrada/salida
// (motionAbrirModal/motionCerrarModal en motion-helpers.js) y Escape
// cierra el de mas arriba cuando hay anidamiento (Calidad -> Supervisar
// Lider). Nunca se toca la logica de abrir/cerrar en si (el
// classList.add/remove('show') del overlay), solo se envuelve.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { request, app } = require('./helpers');

const MODALES = [
  'calidad-modal',
  'detalle-monitoreo-modal',
  'supervisar-lider-modal',
  'cargas-modal',
  'dashcfg-modal',
  'gd-modal',
];

async function css() {
  const res = await request(app).get('/css/styles.css');
  assert.equal(res.status, 200);
  return res.text;
}

async function js(archivo) {
  const res = await request(app).get('/js/' + archivo);
  assert.equal(res.status, 200);
  return res.text;
}

test('CSS: los 6 modales tienen la transicion de entrada/salida (--dur-slow + --ease-out, opacity/transform solo)', async () => {
  const texto = await css();
  const selectorBase = MODALES.map((id) => '#' + id).join(',');
  const selectorShow = MODALES.map((id) => '#' + id + '.motion-modal-show').join(',');
  assert.ok(texto.includes(selectorBase + '{'), 'deberia existir una regla con los 6 selectores base juntos');
  assert.ok(texto.includes(selectorShow + '{'), 'deberia existir una regla con los 6 selectores .motion-modal-show juntos');

  const base = texto.match(/#calidad-modal,#detalle-monitoreo-modal,#supervisar-lider-modal,#cargas-modal,#dashcfg-modal,#gd-modal\{([^}]*)\}/);
  assert.ok(base, 'deberia encontrar la regla base');
  assert.match(base[1], /opacity:\s*0/);
  assert.match(base[1], /transform:\s*scale\(0\.97\)/, 'nunca scale(0) -- nada aparece de la nada');
  assert.match(base[1], /transition:\s*opacity var\(--dur-slow\) var\(--ease-out\),transform var\(--dur-slow\) var\(--ease-out\)/);
  // Nunca width/height/top/left ni "transition:all" en esta regla.
  assert.ok(!/\b(width|height|top|left)\s*:/.test(base[1]));
  assert.ok(!/transition:\s*all/.test(base[1]));

  const show = texto.match(/#calidad-modal\.motion-modal-show,#detalle-monitoreo-modal\.motion-modal-show,#supervisar-lider-modal\.motion-modal-show,#cargas-modal\.motion-modal-show,#dashcfg-modal\.motion-modal-show,#gd-modal\.motion-modal-show\{([^}]*)\}/);
  assert.ok(show, 'deberia encontrar la regla .motion-modal-show');
  assert.match(show[1], /opacity:\s*1/);
  assert.match(show[1], /transform:\s*scale\(1\)/);
});

test('motion-helpers.js: motionAbrirModal/motionCerrarModal se exportan y se sirven', async () => {
  const texto = await js('motion-helpers.js');
  assert.match(texto, /function motionAbrirModal\(/);
  assert.match(texto, /function motionCerrarModal\(/);
  assert.match(texto, /module\.exports\s*=\s*\{[^}]*motionAbrirModal[^}]*motionCerrarModal/);
});

test('cada open*/close* de los 6 modales llama motionAbrirModal/motionCerrarModal sin cambiar la clase show del overlay', async () => {
  const calidad = await js('calidad.js');
  assert.match(calidad, /motionAbrirModal\('calidad-modal'\)/);
  assert.match(calidad, /motionCerrarModal\('calidad-modal',\s*cerrarReal\)/);
  assert.match(calidad, /motionAbrirModal\('supervisar-lider-modal'\)/);
  assert.match(calidad, /motionCerrarModal\('supervisar-lider-modal',\s*cerrarReal\)/);
  // El overlay sigue mostrandose/ocultandose con la misma clase 'show' de siempre.
  assert.match(calidad, /getElementById\('calidad-overlay'\)\.classList\.add\('show'\)/);
  assert.match(calidad, /getElementById\('calidad-overlay'\)\.classList\.remove\('show'\)/);

  const cargas = await js('cargas.js');
  assert.match(cargas, /motionAbrirModal\('cargas-modal'\)/);
  assert.match(cargas, /motionCerrarModal\('cargas-modal',\s*cerrarReal\)/);

  const dashboardsAdmin = await js('dashboards-admin.js');
  assert.match(dashboardsAdmin, /motionAbrirModal\('dashcfg-modal'\)/);
  assert.match(dashboardsAdmin, /motionCerrarModal\('dashcfg-modal',\s*cerrarReal\)/);

  const misResultados = await js('mis-resultados.js');
  assert.match(misResultados, /motionAbrirModal\('detalle-monitoreo-modal'\)/);
  assert.match(misResultados, /motionCerrarModal\('detalle-monitoreo-modal',\s*cerrarReal\)/);

  const gd = await js('dashboard-generic.js');
  assert.match(gd, /motionAbrirModal\('gd-modal'\)/);
  assert.match(gd, /motionCerrarModal\('gd-modal',\s*cerrarReal\)/);
  // closeGenericDashboard: exitFullscreen() sigue yendo ANTES de cerrarReal (orden sin cambios).
  const idxFullscreen = gd.indexOf('document.exitFullscreen()');
  const idxCerrarReal = gd.indexOf('var cerrarReal', idxFullscreen);
  assert.ok(idxFullscreen > -1 && idxCerrarReal > idxFullscreen, 'exitFullscreen() deberia seguir yendo antes de la salida animada');
});

test('index.html: los 6 pares overlay/modal siguen anidados igual (modal hijo directo del overlay)', async () => {
  const html = (await request(app).get('/')).text;
  const pares = [
    ['dashcfg-overlay', 'dashcfg-modal'],
    ['gd-overlay', 'gd-modal'],
    ['calidad-overlay', 'calidad-modal'],
    ['cargas-overlay', 'cargas-modal'],
    ['detalle-monitoreo-overlay', 'detalle-monitoreo-modal'],
    ['supervisar-lider-overlay', 'supervisar-lider-modal'],
  ];
  for (const [overlay, modal] of pares) {
    const idxOverlay = html.indexOf('id="' + overlay + '"');
    const idxModal = html.indexOf('id="' + modal + '"', idxOverlay);
    assert.ok(idxOverlay > -1, overlay + ' deberia existir');
    assert.ok(idxModal > -1 && idxModal - idxOverlay < 60, modal + ' deberia ser el hijo inmediato de ' + overlay);
  }
});

test('motionAbrirModal/motionCerrarModal: logica real con elementos simulados (EventTarget real de Node, sin jsdom)', async () => {
  if (typeof global.requestAnimationFrame !== 'function') {
    global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
  }
  delete require.cache[path.join(__dirname, '..', '..', 'public', 'js', 'motion-helpers.js')];
  const mod = require(path.join(__dirname, '..', '..', 'public', 'js', 'motion-helpers.js'));

  class ElementoFalso extends EventTarget {
    constructor(id, parent) {
      super();
      this.id = id;
      this.parentElement = parent || null;
      this._clases = new Set();
      this.classList = {
        add: (c) => this._clases.add(c),
        remove: (c) => this._clases.delete(c),
        contains: (c) => this._clases.has(c),
      };
    }
  }

  const overlay = new ElementoFalso('calidad-overlay');
  const modal = new ElementoFalso('calidad-modal', overlay);
  overlay.classList.add('show');

  let cerrado = false;
  mod.motionAbrirModal.length; // existe como funcion con 1 parametro
  // motionAbrirModal busca el elemento por id via document.getElementById,
  // asi que se simula un document minimo para esta prueba puntual.
  const registro = { 'calidad-modal': modal, 'calidad-overlay': overlay };
  global.document = { getElementById: (id) => registro[id] || null };

  mod.motionAbrirModal('calidad-modal');
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(modal.classList.contains('motion-modal-show'), true, 'deberia agregar la clase de entrada');

  mod.motionCerrarModal('calidad-modal', () => { cerrado = true; overlay.classList.remove('show'); });
  assert.equal(cerrado, false, 'no deberia cerrar de inmediato -- espera la transicion de salida');
  modal.dispatchEvent(new Event('transitionend'));
  assert.equal(cerrado, true, 'deberia llamar cerrarReal cuando termina la transicion de salida');
  assert.equal(overlay.classList.contains('show'), false);

  delete global.document;
});
