// fase163-visual-secciones.test.js — Fase 163 (punto 5, pedido de Edwin):
// cada grafica en su propio cuadro y un color de acento por seccion
// (Llamadas, WhatsApp, Salida), en claro y oscuro. Revisa la logica pura
// (secciones-logic.js), que los colores del CSS sean los medidos (contraste
// >= 4.5:1 contra los fondos donde se pintan, nunca verde) y que las
// pestanas y paneles lleven la clase de su seccion.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { contrasteRazon, contrasteHexARgb } = require('../../public/js/contraste-logic.js');
const S = require('../../public/js/secciones-logic.js');

const PUB = path.join(__dirname, '..', '..', 'public');
const CSS = fs.readFileSync(path.join(PUB, 'css', 'styles.css'), 'utf8');

test('gdSeccionDeTipo: Llamadas / WhatsApp / Salida; lo demas no tiene seccion', () => {
  assert.equal(S.gdSeccionDeTipo('trafico_combo'), 'llamadas');
  assert.equal(S.gdSeccionDeTipo('trafico_whatsapp_combo'), 'whatsapp');
  assert.equal(S.gdSeccionDeTipo('salida_panel'), 'salida');
  assert.equal(S.gdSeccionDeTipo('llamadas_unicas_panel'), 'llamadas');
  for (const otro of ['tipificacion_panel', 'nota_kpi', 'calidad_panel', undefined, null, '']) {
    assert.equal(S.gdSeccionDeTipo(otro), null, String(otro));
  }
});

test('gdClaseSeccion: clase de la seccion o vacio', () => {
  assert.equal(S.gdClaseSeccion('whatsapp'), 'gd-sec gd-sec-whatsapp');
  assert.equal(S.gdClaseSeccion(null), '');
});

test('gdGraficaHtml: un cuadro con su titulo y el contenido adentro; sin titulo no pinta el h4', () => {
  assert.equal(S.gdGraficaHtml('ASA', '<canvas id="x"></canvas>'),
    '<section class="gd-grafica"><h4 class="gd-grafica-titulo">ASA</h4><canvas id="x"></canvas></section>');
  assert.equal(S.gdGraficaHtml('', '<canvas></canvas>'), '<section class="gd-grafica"><canvas></canvas></section>');
});

function token(bloque, nombre) {
  const m = bloque.match(new RegExp('--' + nombre + ':\\s*(#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3}))\\b'));
  assert.ok(m, 'falta --' + nombre);
  return m[1];
}
const bloqueClaro = CSS.slice(CSS.indexOf(':root{'), CSS.indexOf(':root[data-theme="dark"]{'));
const bloqueOscuro = CSS.slice(CSS.indexOf(':root[data-theme="dark"]{'));
const lineaAcentoClaro = CSS.match(/:root\{ --c-acento-llamadas[^}]*\}/)[0];
const lineaAcentoOscuro = CSS.match(/:root\[data-theme="dark"\]\{ --c-acento-llamadas[^}]*\}/)[0];

for (const [tema, acentos, fondos] of [
  ['claro', lineaAcentoClaro, bloqueClaro],
  ['oscuro', lineaAcentoOscuro, bloqueOscuro],
]) {
  test(`acentos (${tema}): contraste >= 4.5:1 contra surface/bg/surface-subtle, distintos entre si y nunca verdes`, () => {
    const fondosHex = ['c-surface', 'c-bg', 'c-surface-subtle'].map((n) => token(fondos, n));
    const hex = ['llamadas', 'whatsapp', 'salida'].map((s) => token(acentos, 'c-acento-' + s));
    assert.equal(new Set(hex.map((h) => h.toLowerCase())).size, 3, 'un color por seccion');
    for (const h of hex) {
      for (const f of fondosHex) {
        assert.ok(contrasteRazon(h, f) >= 4.5, `${h} sobre ${f}: ${contrasteRazon(h, f).toFixed(2)}`);
      }
      // El verde queda para el semaforo: el canal verde nunca domina a los otros dos.
      const { r, g, b } = contrasteHexARgb(h);
      assert.ok(!(g > r && g > b), `${h} es verde`);
    }
  });
}

test('el CSS pinta el acento solo en bordes/puntos y cada grafica va en su cuadro', () => {
  assert.match(CSS, /\.gd-grafica\{[^}]*border-left:4px solid var\(--gd-acento/);
  assert.match(CSS, /\.atab\[class\*="gd-tab-sec-"\]::before\{[^}]*background:var\(--gd-acento\)/);
  // (border-top-color si vale: es un borde, no texto.)
  assert.ok(!/[;{\s]color:\s*var\(--gd-acento/.test(CSS), 'el acento nunca es color de texto');
});

test('pestanas y paneles llevan la clase de su seccion; secciones-logic.js se carga antes que los paneles', () => {
  const gd = fs.readFileSync(path.join(PUB, 'js', 'dashboard-generic.js'), 'utf8');
  assert.match(gd, /' gd-tab-sec-'\+sec/);
  assert.match(gd, /gdClaseSeccion\(gdSeccionDeTipo\(p\.tipo\)\)/);
  const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  const pos = (f) => html.indexOf('<script src="js/' + f + '"');
  assert.ok(pos('secciones-logic.js') !== -1);
  for (const f of ['trafico.js', 'salida.js', 'llamadas-unicas.js', 'dashboard-generic.js']) {
    assert.ok(pos(f) === -1 || pos('secciones-logic.js') < pos(f), f + ' se carga despues de secciones-logic.js');
  }
});

test('Salida: llamadas y WhatsApp de salida, cada una en su cuadro con su titulo', () => {
  const src = fs.readFileSync(path.join(PUB, 'js', 'salida.js'), 'utf8');
  assert.match(src, /gdGraficaHtml\('Llamadas de salida'/);
  assert.match(src, /gdGraficaHtml\('WhatsApp de salida'/);
});
