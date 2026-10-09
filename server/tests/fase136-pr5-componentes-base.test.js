// fase136-pr5-componentes-base.test.js — Fase 136 (PR 5). Componentes
// base: botones (feedback de prensado), formularios (una sola
// apariencia), menu lateral (indicador de activo, no solo color). Sin
// renombrar clases ni tocar logica JS -- solo CSS con los tokens de los
// PRs 3/4.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { request, app } = require('./helpers');

async function css() {
  const res = await request(app).get('/css/styles.css');
  assert.equal(res.status, 200);
  return res.text;
}

test('menu lateral: el estado activo tiene un indicador propio (border-left), distinto de :hover -- no solo color', async () => {
  const texto = await css();
  const hover = texto.match(/\.sidebar-menu li a:hover\{([^}]*)\}/);
  const activo = texto.match(/\.sidebar-menu li a\.active\{([^}]*)\}/);
  assert.ok(hover && activo, 'deberian existir reglas separadas para :hover y .active');
  assert.ok(!/border-left-color/.test(hover[1]), ':hover no deberia tener el indicador -- si no, no distingue "estoy aqui" de "el mouse esta encima"');
  assert.match(activo[1], /border-left-color:\s*var\(--c-brand\)/, '.active deberia tener el indicador de posicion');
});

test('botones principales: feedback de prensado (:active scale 0.97) con los tokens de movimiento, sin pisar sus transiciones existentes', async () => {
  const texto = await css();
  const m = texto.match(/\.btn-primary:active,[^{]*\{([^}]*)\}/);
  assert.ok(m, 'deberia existir la regla de :active compartida');
  assert.match(m[1], /transform:\s*scale\(0\.97\)/);
  ['.btn-primary', '.btn-login', '.btn-cancel', '.btn-logout', '.btn-sm', '.btn-close-modal'].forEach((sel) => {
    const selectorCompleto = m[0].slice(0, m[0].indexOf('{'));
    assert.ok(selectorCompleto.includes(sel + ':active'), `${sel} deberia tener feedback de prensado`);
  });
  // La transicion combinada (no "transition:all") sigue trayendo las
  // propiedades que cada boton ya animaba (opacity/background) MAS transform.
  const transicion = texto.match(/\.btn-primary, \.btn-login[^{]*\{([^}]*)\}/)[1];
  assert.match(transicion, /opacity var\(--dur-fast\) var\(--ease-out\)/);
  assert.match(transicion, /background var\(--dur-fast\) var\(--ease-out\)/);
  assert.match(transicion, /transform var\(--dur-fast\) var\(--ease-out\)/);
  // "transition: all" ya existe en 5 reglas PREEXISTENTES del archivo
  // (inventario de la Fase 135, fuera de alcance de este PR) -- esta
  // prueba solo confirma que la regla NUEVA no lo usa, no limpia las de
  // antes (eso seria un PR aparte, no pedido en esta fase).
  assert.ok(!/transition:\s*all\b/.test(transicion), 'la regla nueva de feedback de prensado no deberia usar "transition: all"');
});

test('formularios: .ig input/select y .aurora-filters select comparten el mismo radio (--r-sm) que .qi-select', async () => {
  const texto = await css();
  // ^ (modo multilinea): ancla al INICIO de linea -- sin esto, la regla
  // de tema oscuro "[data-theme="dark"] .qi-select{border-color:...}"
  // (que tambien contiene la subcadena ".qi-select{") se adelanta a la
  // regla real porque aparece antes en el archivo.
  const ig = texto.match(/^\.ig input,\.ig select\{([^}]*)\}/m);
  const filtros = texto.match(/^\.aurora-filters select\{([^}]*)\}/m);
  const qi = texto.match(/^\.qi-select\{([^}]*)\}/m);
  assert.match(ig[1], /border-radius:\s*var\(--r-sm\)/);
  assert.match(filtros[1], /border-radius:\s*var\(--r-sm\)/);
  assert.match(qi[1], /border-radius:\s*var\(--r-sm\)/);
  // Los 3 ya comparten el borde de control (WCAG 1.4.11, Fase 133) --
  // confirma que no se perdio en esta migracion.
  [ig, filtros, qi].forEach((m) => assert.match(m[1], /border:\s*1\.5px solid var\(--c-border-control\)/));
});
