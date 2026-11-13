// fase348-g-menu-lateral-propuesta.test.js — Fase 348, punto G (aprobado el 13/11; reunion con Edwin del
// 12/11): menu lateral izquierdo plegable como el de Televentas SURA, por ahora SOLO en Mobilize.
// ORLANT y los demas clientes no cambian hasta que el usuario lo apruebe.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const L = require('../../public/js/gd-menu-lateral.js');

const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');

test('G: solo Mobilize tiene el menu lateral (ORLANT y los demas, no)', () => {
  assert.deepEqual(L.GD_MENU_LATERAL_CLIENTES, ['MOBILIZE']);
  assert.equal(L.gdMenuLateralActivo('MOBILIZE'), true);
  assert.equal(L.gdMenuLateralActivo('mobilize'), true);
  for (const c of ['ORLANT', 'CLINICA AURORA', 'HOSPITAL LA MARIA', 'SURA', '', null]) assert.equal(L.gdMenuLateralActivo(c), false, String(c));
});

test('G: cada pestaña de Mobilize con su icono del sprite', () => {
  const sprite = PUB('img/iconos/lucide.svg');
  const pestañas = { 'Flujo de Llamadas': 'i-phone', 'Llamadas Únicas y de Salida': 'i-contact', 'Flujo por hora': 'i-chart-column', 'Tipificación': 'i-layout-dashboard', 'Encuesta': 'i-message-circle', 'Calidad': 'i-circle-check' };
  for (const [t, ico] of Object.entries(pestañas)) {
    assert.equal(L.gdMenuIcono(t), ico, t);
    assert.ok(sprite.includes('id="' + ico + '"'), ico + ' existe en el sprite');
  }
  assert.equal(L.gdMenuIcono('Otra cosa'), 'i-punto');
});

test('G: se aplica al dibujar las pestañas y el CSS solo actua con .gd-menu-lateral desde 901 px', () => {
  assert.match(PUB('js/dashboard-generic.js'), /if\(typeof gdMenuLateralAplicar === 'function'\) gdMenuLateralAplicar\(_gd\.cliente\);/);
  const html = PUB('index.html');
  assert.ok(html.indexOf('js/gd-menu-lateral.js') < html.indexOf('js/dashboard-generic.js"'));
  const css = PUB('css/styles.css');
  // Solo el bloque de G: termina donde cierra su @media (una linea con solo «}»), aunque despues
  // vengan otros bloques (E va al final porque su prueba lee hasta el final del archivo).
  const desde = css.slice(css.indexOf('/* Fase 348 (G)'));
  const b = desde.slice(0, desde.search(/\n\}\s*\n/) + 2);
  const media = b.slice(b.indexOf('@media (min-width:901px){'), -1);
  const reglas = media.slice(media.indexOf('{') + 1).split('}').map((r) => r.split('{')[0].trim()).filter(Boolean);
  for (const s of reglas) for (const p of s.split(',')) assert.match(p.trim(), /^#gd-modal\.gd-menu-lateral/, p);
  assert.doesNotMatch(b, /#[0-9a-f]{3,8}\b/i, 'sin colores escritos');
});
