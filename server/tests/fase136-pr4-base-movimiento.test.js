// fase136-pr4-base-movimiento.test.js — Fase 136 (PR 4), base de
// movimiento: tokens --dur-*/--ease-*, interruptor data-motion="off", y
// motion-helpers.js (vanilla, sin dependencias -- ver el comentario de
// cabecera de ese archivo: "motion" vendorizado se midio en 49 KB gzip
// real, v13.4.2, mas del doble de los 22 KB estimados en la Fase 135;
// los 2 casos de uso reales de esta fase no lo necesitan).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { request, app } = require('./helpers');

async function css() {
  const res = await request(app).get('/css/styles.css');
  assert.equal(res.status, 200);
  return res.text;
}

test('tokens de duracion existen con los 3 valores de la especificacion (120/200/320ms)', async () => {
  const texto = await css();
  const root = texto.match(/:root\{([\s\S]*?)\n\}/)[1];
  assert.match(root, /--dur-fast:\s*120ms/);
  assert.match(root, /--dur-medium:\s*200ms/);
  assert.match(root, /--dur-slow:\s*320ms/);
});

test('tokens de easing existen (2 curvas, sin rebotes -- cubic-bezier, nunca un keyword debil)', async () => {
  const texto = await css();
  const root = texto.match(/:root\{([\s\S]*?)\n\}/)[1];
  assert.match(root, /--ease-out:\s*cubic-bezier\(0\.23,1,0\.32,1\)/);
  assert.match(root, /--ease-in-out:\s*cubic-bezier\(0\.77,0,0\.175,1\)/);
});

test('interruptor html[data-motion="off"] existe y apaga animation/transition igual que prefers-reduced-motion', async () => {
  const texto = await css();
  const m = texto.match(/html\[data-motion="off"\][^{]*\{([^}]*)\}/);
  assert.ok(m, 'deberia existir la regla html[data-motion="off"]');
  assert.match(m[1], /animation-duration:\s*0\.01ms\s*!important/);
  assert.match(m[1], /transition-duration:\s*0\.01ms\s*!important/);
  // Mismo mecanismo que prefers-reduced-motion -- no un apagado distinto
  // que pueda desincronizarse de ese.
  const reducedMotion = texto.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\*, \*::before, \*::after \{([^}]*)\}/)[1];
  assert.equal(m[1].replace(/\s/g, ''), reducedMotion.replace(/\s/g, ''), 'data-motion="off" deberia apagar exactamente las mismas propiedades que prefers-reduced-motion');
});

test('motion-helpers.js se sirve y esta incluido en index.html, ANTES de los modulos que lo van a usar (gd-modal/calidad/cargas, dashboards-core)', async () => {
  const js = await request(app).get('/js/motion-helpers.js');
  assert.equal(js.status, 200);
  assert.match(js.text, /function motionExit\(/);
  assert.match(js.text, /function motionEnter\(/);

  const html = await request(app).get('/');
  assert.equal(html.status, 200);
  // Fase 79 (cache-busting): los <script src="..."> reales llevan
  // "?v=BUILD_ID" agregado por el servidor -- indexOf exacto no sirve.
  const indiceDe = (archivo) => html.text.search(new RegExp('src="js/' + archivo.replace('.', '\\.') + '(\\?[^"]*)?"'));
  const ordenEsc = indiceDe('esc.js');
  const ordenMotion = indiceDe('motion-helpers.js');
  const ordenDashboards = indiceDe('dashboards-core.js');
  assert.ok(ordenEsc > -1 && ordenMotion > -1 && ordenDashboards > -1);
  assert.ok(ordenEsc < ordenMotion, 'motion-helpers.js deberia cargar despues de esc.js (mismo bloque de utilidades tempranas)');
  assert.ok(ordenMotion < ordenDashboards, 'motion-helpers.js deberia cargar ANTES de los modulos que lo usaran en PRs siguientes');
});

test('motion-helpers.js: no depende de ninguna libreria externa (sin require/import de paquetes npm)', async () => {
  const js = await request(app).get('/js/motion-helpers.js');
  assert.ok(!/require\(['"](?!.*module)/.test(js.text.replace(/module\.exports/g, '')), 'no deberia haber ningun require() de paquete externo');
  assert.ok(!/from ['"][a-z]/.test(js.text), 'no deberia haber ningun import de paquete externo');
});

test('motionExit/motionEnter: logica real con un elemento simulado (EventTarget real de Node, sin jsdom)', async () => {
  // Node no trae requestAnimationFrame (es una API de navegador) -- se
  // poliriza solo para esta prueba; en el navegador real siempre existe.
  if (typeof global.requestAnimationFrame !== 'function') {
    global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
  }
  const mod = require(path.join(__dirname, '..', '..', 'public', 'js', 'motion-helpers.js'));
  class ElementoFalso extends EventTarget {
    constructor() {
      super();
      this._clases = new Set(['motion-show']);
      this.classList = {
        add: (c) => this._clases.add(c),
        remove: (c) => this._clases.delete(c),
        contains: (c) => this._clases.has(c),
      };
    }
  }

  // motionExit: quita la clase de inmediato y llama onDone cuando llega transitionend.
  const el1 = new ElementoFalso();
  let terminado = false;
  mod.motionExit(el1, () => { terminado = true; });
  assert.equal(el1.classList.contains('motion-show'), false, 'deberia quitar la clase de inmediato (dispara la transicion CSS de salida)');
  assert.equal(terminado, false, 'no deberia llamar onDone todavia -- espera transitionend');
  el1.dispatchEvent(new Event('transitionend'));
  assert.equal(terminado, true, 'deberia llamar onDone cuando transitionend dispara');

  // motionExit: el salvavidas (setTimeout) evita que un modal quede
  // atascado si transitionend nunca dispara.
  const el2 = new ElementoFalso();
  let terminado2 = false;
  mod.motionExit(el2, () => { terminado2 = true; });
  await new Promise((r) => setTimeout(r, 450));
  assert.equal(terminado2, true, 'el salvavidas de 400ms deberia llamar onDone aunque transitionend nunca dispare');

  // motionEnter: agrega la clase (en el frame siguiente, asincrono).
  const el3 = new ElementoFalso();
  el3.classList.remove('motion-show');
  mod.motionEnter(el3);
  assert.equal(el3.classList.contains('motion-show'), false, 'no deberia agregar la clase en el mismo tick (necesita un frame para que el navegador vea el estado inicial)');
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(el3.classList.contains('motion-show'), true, 'deberia agregar la clase despues de los 2 requestAnimationFrame');
});
