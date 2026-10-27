// fase144-a2-teclado.test.js — Fase 144 (A2). Hallazgos de la Fase 143:
// D01 (menu lateral no se activaba con Enter/Espacio), D02 (la tarjeta del
// tablero en la bienvenida del cliente no era alcanzable con Tab), D09
// (pestañas sin role="tab"/aria-selected ni flechas), D10 (selector MES sin
// foco visible) y D19 (boton ☰ sin aria-expanded ni Escape).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { a11yIndiceTabSiguiente, a11yEsTeclaDeActivacion, a11yTabindexItinerante } = require('../../public/js/a11y-logic.js');

const PUB = path.join(__dirname, '..', '..', 'public');
const leer = (rel) => fs.readFileSync(path.join(PUB, rel), 'utf8');

test('flechas entre pestañas: circular, Inicio/Fin, otras teclas no navegan (APG, activacion manual)', () => {
  assert.equal(a11yIndiceTabSiguiente(0, 5, 'ArrowRight'), 1);
  assert.equal(a11yIndiceTabSiguiente(4, 5, 'ArrowRight'), 0);
  assert.equal(a11yIndiceTabSiguiente(0, 5, 'ArrowLeft'), 4);
  assert.equal(a11yIndiceTabSiguiente(3, 5, 'Home'), 0);
  assert.equal(a11yIndiceTabSiguiente(1, 5, 'End'), 4);
  assert.equal(a11yIndiceTabSiguiente(2, 5, 'Enter'), -1, 'Enter activa (lo hace el <button>), no navega');
  assert.equal(a11yIndiceTabSiguiente(2, 5, 'Tab'), -1);
  assert.equal(a11yIndiceTabSiguiente(0, 0, 'ArrowRight'), -1);
  assert.equal(a11yIndiceTabSiguiente(-1, 3, 'ArrowRight'), 1, 'sin foco valido parte de la primera');
});

test('Enter y Espacio activan un role="button"; otras teclas no', () => {
  for (const k of ['Enter', ' ', 'Spacebar']) assert.equal(a11yEsTeclaDeActivacion(k), true, k);
  for (const k of ['a', 'Tab', 'Escape', 'ArrowDown']) assert.equal(a11yEsTeclaDeActivacion(k), false, k);
});

test('tabindex itinerante: 0 solo en la activa (o la primera si no hay activa)', () => {
  assert.deepEqual(a11yTabindexItinerante(4, 2), [-1, -1, 0, -1]);
  assert.deepEqual(a11yTabindexItinerante(3, -1), [0, -1, -1]);
  assert.deepEqual(a11yTabindexItinerante(0, 0), []);
});

test('index.html: TODAS las opciones de los 3 menus laterales son role="button" con tabindex="0"', () => {
  const html = leer('index.html');
  const opciones = html.match(/<a id="(?:asesor-|supervisor-)?menu-[a-z]+"[^>]*>/g) || [];
  assert.ok(opciones.length >= 14, 'deberia haber al menos 14 opciones de menu, hay ' + opciones.length);
  for (const o of opciones) {
    assert.match(o, /role="button"/, o);
    assert.match(o, /tabindex="0"/, o);
  }
});

test('index.html: ningun control anula el foco con outline:none en linea (MES del tablero, Calidad, Inventario, Gerencia, Mis Resultados)', () => {
  const html = leer('index.html');
  // Fase 201: el selector MES ya no existe; la regla de abajo cubre todo el archivo.
  assert.ok(!html.includes('id="gd-mes-sel"'));
  assert.equal((html.match(/outline:\s*none/g) || []).length, 0);
});

test('index.html: a11y-logic.js y a11y-teclado.js se cargan, despues de ui-core.js y motion-helpers.js', () => {
  const html = leer('index.html');
  const pos = (s) => html.indexOf('<script src="js/' + s + '"></script>');
  for (const s of ['a11y-logic.js', 'a11y-teclado.js', 'ui-core.js', 'motion-helpers.js']) assert.ok(pos(s) > 0, s);
  assert.ok(pos('a11y-logic.js') < pos('a11y-teclado.js'));
  assert.ok(pos('a11y-teclado.js') > pos('ui-core.js') && pos('a11y-teclado.js') > pos('motion-helpers.js'));
});

test('tarjetas clicables que no son <button> (bienvenida, Cargar Datos, clientes, supervisor) son role="button" tabindex="0"', () => {
  const core = leer('js/dashboards-core.js');
  const ses = leer('js/session.js');
  const divsOnclick = (src) => src.match(/<div class="[^"]*"[^>]*onclick="[^"]*"[^>]*>/g) || [];
  const todos = divsOnclick(core).concat(divsOnclick(ses).filter((d) => /openClientByEl/.test(d)));
  assert.ok(todos.length >= 4, 'esperaba al menos 4 tarjetas, hay ' + todos.length);
  for (const d of todos) {
    assert.match(d, /role="button"/, d);
    assert.match(d, /tabindex="0"/, d);
  }
});

test('la opcion activa del menu lateral lleva aria-current="page" (admin, asesor, supervisor)', () => {
  assert.match(leer('js/ui-core.js'), /setAttribute\('aria-current','page'\)/);
  assert.equal((leer('js/session.js').match(/setAttribute\('aria-current','page'\)/g) || []).length, 2);
});

test('a11y-teclado.js: role tablist/tab, aria-selected, tabpanel de #gd-panels, Enter/Espacio, flechas, Escape y aria-expanded', () => {
  const src = leer('js/a11y-teclado.js');
  for (const patron of [
    /setAttribute\('role', 'tablist'\)/, /setAttribute\('role', 'tab'\)/, /'aria-selected'/,
    /setAttribute\('role', 'tabpanel'\)/, /'aria-labelledby'/, /a11yEsTeclaDeActivacion\(e\.key\)/,
    /a11yIndiceTabSiguiente\(/, /e\.key === 'Escape'/, /'aria-expanded'/, /MutationObserver/,
    /atab-active/, /classList\.contains\('on'\)/,
  ]) assert.match(src, patron, String(patron));
});
