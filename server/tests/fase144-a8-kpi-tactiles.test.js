// fase144-a8-kpi-tactiles.test.js — Fase 144 (A8), hallazgos D18 y D16 de la
// Fase 143:
//  - D18: .kpi-green/org/red/pur sin prefijo ya no se aplican a la tarjeta
//    .aurora-kpi entera (la negrita se heredaba a la etiqueta .kl y en una
//    misma fila unas salian finas y otras en negrita). En la tarjeta el
//    semaforo sigue siendo el borde izquierdo; en <span>/<td> todo igual.
//  - D16: "Ver skills/colas por separado" y "Comparar varias..." de Trafico
//    con area clicable de 24 px de alto (WCAG 2.5.8).
// Pruebas estaticas sobre styles.css y los JS de Trafico; sin datos.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, '..', '..', 'public');
const css = fs.readFileSync(path.join(PUB, 'css', 'styles.css'), 'utf8');
const trafico = fs.readFileSync(path.join(PUB, 'js', 'trafico.js'), 'utf8');
const traficoWpp = fs.readFileSync(path.join(PUB, 'js', 'trafico-whatsapp.js'), 'utf8');
const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');

const COLORES = { green: '--c-success-text', org: '--c-warning-text', red: '--c-danger-text', pur: '--c-purple' };

test('D18: la regla suelta .kpi-* ya no alcanza a la tarjeta .aurora-kpi', () => {
  for (const [k, token] of Object.entries(COLORES)) {
    // ninguna regla con el selector suelto ".kpi-x{" (la que tenia la tarjeta)
    assert.doesNotMatch(sinComentarios, new RegExp('(^|[\\s}])\\.kpi-' + k + '\\{'), k);
    // la misma regla, excluyendo la tarjeta y con la especificidad de antes
    assert.ok(sinComentarios.includes('.kpi-' + k + ':not(:where(.aurora-kpi)){color:var(' + token + ');font-weight:700;}'), k);
  }
});

test('D18: el semaforo de la tarjeta (borde) y de las celdas no cambia', () => {
  for (const k of ['green', 'red', 'org', 'pur']) {
    assert.match(sinComentarios, new RegExp('\\.aurora-kpi\\.kpi-' + k + '\\{border-left-color:'), k);
  }
  for (const k of ['green', 'org', 'red']) {
    assert.match(sinComentarios, new RegExp('td\\.kpi-' + k + '\\{background:[^;]+;color:var\\(' + COLORES[k] + '\\);font-weight:700;\\}'), k);
  }
});

test('D18: la etiqueta .kl conserva su estilo propio (gris, sin negrita propia)', () => {
  const kl = sinComentarios.match(/\.aurora-kpi \.kl\{([^}]*)\}/)[1];
  assert.match(kl, /color:var\(--c-text-muted\)/);
  assert.match(kl, /font-size:var\(--fs-note\)/);
  assert.doesNotMatch(kl, /font-weight/);
});

test('D16: el checkbox de Trafico y de WhatsApp y el summary "Comparar" usan las clases de 24 px', () => {
  assert.match(trafico, /'<label class="filtro-check" style="font-size:0\.8rem"><input type="checkbox" id="tv-f-separado-'/);
  assert.match(traficoWpp, /'<label class="filtro-check" style="font-size:0\.8rem"><input type="checkbox" id="tww-f-separado-'/);
  assert.match(trafico, /'<summary class="filtro-summary" style="cursor:pointer;font-size:0\.78rem;/);
  assert.match(sinComentarios, /\.filtro-check\{[^}]*min-height:24px;[^}]*\}/);
  // summary: 16 px de linea + 4 px arriba y abajo = 24 px
  assert.match(sinComentarios, /\.filtro-summary\{padding:4px 0;\}/);
  // letra y color siguen en linea, sin cambio
  assert.ok(trafico.includes('Comparar varias \'+esc(etiquetaPlural)+\' especificas</summary>'));
});
