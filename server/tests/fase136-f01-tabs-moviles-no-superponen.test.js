// fase136-f01-tabs-moviles-no-superponen.test.js — Fase 136 (F01 de la
// auditoria de la Fase 135, hallazgo real confirmado con Playwright a
// 412px: las pestanas de #gd-tabs (.atab) se superponian, texto
// ilegible). Causa real, confirmada con getBoundingClientRect: el
// min-width:24/44px EXPLICITO de objetivos tactiles (Fase 133, linea
// ~930) sustituye el min-width:auto que por defecto protege a un flex
// item de encogerse por debajo del ancho de su propio texto
// (white-space:nowrap evita que envuelva). Sin esa proteccion,
// flex-shrink:1 (el default) comprimia cada pestana hasta superponerla
// con la siguiente, en vez de activar el overflow-x:auto que
// .aurora-tabs ya tenia. Esta prueba confirma que .atab tiene
// flex-shrink:0 -- sin esa linea, vuelve a fallar.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { request, app } = require('./helpers');

async function css() {
  const res = await request(app).get('/css/styles.css');
  assert.equal(res.status, 200);
  return res.text;
}

test('.atab tiene flex-shrink:0 (no se comprime por debajo de su texto, deja que .aurora-tabs haga scroll horizontal en vez de superponer)', async () => {
  const texto = await css();
  const m = texto.match(/\.atab\{([^}]*)\}/);
  assert.ok(m, 'deberia existir la regla .atab');
  assert.match(m[1], /flex-shrink:\s*0/, '.atab deberia tener flex-shrink:0 -- sin esto, el min-width explicito de objetivos tactiles permite que el texto se superponga a 412px (F01, Fase 135)');
});

test('.aurora-tabs (el contenedor, #gd-tabs en el HTML) sigue con overflow-x:auto -- el mecanismo de scroll ya existia, solo flex-shrink:0 faltaba para que se activara', async () => {
  const texto = await css();
  const m = texto.match(/\.aurora-tabs\{([^}]*)\}/);
  assert.ok(m, 'deberia existir la regla .aurora-tabs');
  assert.match(m[1], /overflow-x:\s*auto/);
});
