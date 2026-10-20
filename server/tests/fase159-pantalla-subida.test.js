// fase159-pantalla-subida.test.js — Fase 159 (pedidos de Edwin del 20/10,
// tras la carga fallida de agosto de Mobilize): en la pantalla de subida el
// cliente elegido se ve resaltado; desde el Centro de cargas el cliente y el
// mes quedan fijos; y el Centro ya no tiene el boton "Pantalla anterior"
// (no funcionaba). El recorrido real en el navegador se verifica aparte con
// Playwright; aqui se fija el contrato en el codigo.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

test('el Centro de cargas ya no tiene el boton "Pantalla anterior"', () => {
  assert.ok(!/cc-pantalla-anterior|Pantalla anterior<\/button>/.test(leer('public/index.html')));
  assert.ok(!/ccIrPantallaAnterior/.test(leer('public/js/centro-cargas.js')));
});

test('desde el Centro, el cliente y el mes quedan fijos; el cliente elegido se resalta', () => {
  const js = leer('public/js/cargas.js');
  const cuerpo = js.slice(js.indexOf('async function openCargas('), js.indexOf('function closeCargas('));
  assert.match(cuerpo, /selC\.disabled = !!_cargasFocoCentro/);
  assert.match(cuerpo, /per\.disabled = !!_cargasFocoCentro/);
  assert.match(cuerpo, /per\.value = _cargasFocoCentro\.mes/);
  assert.match(cuerpo, /selC\.classList\.add\('carga-campo-elegido'\)/);
  // El resaltado usa tokens del sistema de diseno (claro y oscuro), sin colores sueltos.
  const css = leer('public/css/styles.css');
  const regla = css.split('\n').find((l) => l.startsWith('.ig select.carga-campo-elegido,'));
  assert.ok(regla, 'falta la regla de resaltado');
  assert.ok(!/#[0-9a-f]{3,6}/i.test(regla), 'el resaltado debe usar tokens');
});
