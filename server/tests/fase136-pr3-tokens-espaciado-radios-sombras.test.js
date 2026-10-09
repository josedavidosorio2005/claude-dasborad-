// fase136-pr3-tokens-espaciado-radios-sombras.test.js — Fase 136 (F05).
// Correccion sobre la Fase 135: docs/auditoria-ui-fase135.md reporto "sin
// escala de espaciado/radios/sombras" -- en realidad la escala YA EXISTIA
// (--space-1..10, --r-sm/md/lg/xl/pill, --shadow-sm/md/lg en :root desde
// antes de esta fase), solo casi no se usaba (7 usos de --space-*, 4 de
// --r-pill, 1 de --shadow-md, contra 60 padding/36 margin/20 border-
// radius/19 box-shadow sueltos). Esta fase migra las coincidencias
// EXACTAS (mismo valor, cero cambio visual) a los tokens que ya existian,
// y agrega --shadow-xl (un valor que ya se repetia 3 veces identico sin
// nombre). Esta prueba confirma la migracion -- sin ella, los valores
// seguirian sueltos y esta prueba fallaria.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { request, app } = require('./helpers');

async function css() {
  const res = await request(app).get('/css/styles.css');
  assert.equal(res.status, 200);
  return res.text;
}

test('--shadow-xl existe y resuelve al valor que ya se repetia 3 veces (overlays grandes)', async () => {
  const texto = await css();
  const root = texto.match(/:root\{([\s\S]*?)\n\}/)[1];
  assert.match(root, /--shadow-xl:\s*0 20px 60px rgba\(var\(--shadow-rgb\),0\.35\)/);
});

test('0 ocurrencias sueltas de border-radius:6/10/14/18/20px -- todas migradas a var(--r-sm/md/lg/xl/pill)', async () => {
  const texto = await css();
  ['6px', '10px', '14px', '18px', '20px'].forEach((v) => {
    const re = new RegExp('border-radius:' + v + ';');
    assert.ok(!re.test(texto), `no deberia quedar border-radius:${v} suelto -- deberia ser un token var(--r-*)`);
  });
});

test('0 ocurrencias sueltas de los 2 box-shadow que ya tenian token (--shadow-sm, --shadow-xl)', async () => {
  const texto = await css();
  assert.ok(!texto.includes('box-shadow:0 2px 8px rgba(var(--shadow-rgb),0.07);'), 'deberia ser var(--shadow-sm)');
  assert.ok(!texto.includes('box-shadow:0 20px 60px rgba(var(--shadow-rgb),0.35);'), 'deberia ser var(--shadow-xl)');
});

test('adopcion real de los tokens subio (antes: 4 usos de --r-pill, 1 de --shadow-md; ahora bastante mas)', async () => {
  const texto = await css();
  const contar = (re) => (texto.match(re) || []).length;
  assert.ok(contar(/var\(--r-sm\)/g) >= 15, 'deberia haber muchos mas usos de --r-sm que antes (0)');
  assert.ok(contar(/var\(--r-md\)/g) >= 8, 'deberia haber usos de --r-md que antes (0)');
  assert.ok(contar(/var\(--r-xl\)/g) >= 4, 'deberia haber usos de --r-xl que antes (0)');
  assert.ok(contar(/var\(--shadow-sm\)/g) >= 3, 'deberia haber usos de --shadow-sm que antes (0)');
  assert.ok(contar(/var\(--shadow-xl\)/g) >= 3, 'deberia haber usos de --shadow-xl que antes (0, el token ni existia)');
});
