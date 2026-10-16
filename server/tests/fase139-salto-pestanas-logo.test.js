// tests/fase139-salto-pestanas-logo.test.js — Fase 139 (hallazgo real de la
// verificacion en vivo de Mobilize): las pestanas del dashboard se movian
// un instante DESPUES de dibujarse (Mobilize -30px, ORLANT +14px, medido con
// Playwright en escritorio/movil y claro/oscuro) y un clic rapido caia en
// otra pestana. Causa: `.gd-cliente-logo{height:auto}` anulaba la reserva de
// alto del <img> (atributos width/height) mientras la imagen nueva cargaba,
// asi que la cabecera cambiaba de alto al terminar de cargar el logo.
//
// Estas pruebas fallan SIN el arreglo. La comprobacion con un navegador real
// (posicion de #gd-tabs fotograma a fotograma desde el primer dibujo, con el
// logo retrasado y el aviso amarillo de "sin datos") vive en
// .github/scripts/ci-pantallas-orlant.js (job `pantallas` de CI).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const css = fs.readFileSync(path.join(PUBLIC_DIR, 'css', 'styles.css'), 'utf8');
const js = fs.readFileSync(path.join(PUBLIC_DIR, 'js', 'dashboard-generic.js'), 'utf8');

function altoPng(nombre) {
  const buf = fs.readFileSync(path.join(PUBLIC_DIR, 'img', 'clientes', nombre));
  return buf.readUInt32BE(20);
}

test('.gd-cliente-logo tiene alto FIJO (no height:auto): la cabecera mide lo mismo antes y despues de cargar el logo', () => {
  const m = css.match(/\.gd-cliente-logo\{([^}]*)\}/);
  assert.ok(m, 'falta la regla .gd-cliente-logo en styles.css');
  assert.match(m[1], /height:\s*25px/, '.gd-cliente-logo deberia fijar height:25px');
  assert.doesNotMatch(m[1], /height:\s*auto/, 'height:auto anula la reserva de alto mientras carga la imagen (salto de pestanas)');
  assert.match(m[1], /object-fit:\s*contain/, 'object-fit:contain evita deformar un logo con otra proporcion');
  assert.doesNotMatch(m[1], /transition|animation/, 'el arreglo no agrega animaciones');
});

test('el alto fijo coincide con el de los logos reales (1x = 25px), asi que no deforma ninguno', () => {
  assert.equal(altoPng('mobilize-logo.png'), 25);
  assert.equal(altoPng('orlant-logo-blanco.png'), 25);
});

test('renderGenericHeader oculta el logo (visibility) mientras carga uno nuevo y lo muestra al terminar o fallar', () => {
  const ini = js.indexOf('function renderGenericHeader');
  assert.ok(ini !== -1, 'falta renderGenericHeader');
  const cuerpo = js.slice(ini, ini + 4000);
  assert.match(cuerpo, /getAttribute\('src'\) !== nuevoLogo/, 'solo se oculta cuando la imagen CAMBIA');
  assert.match(cuerpo, /elLogo\.style\.visibility = 'hidden'/, 'se oculta con visibility (el espacio sigue reservado), no con display');
  assert.match(cuerpo, /elLogo\.onload = elLogo\.onerror = function\(\)\{ elLogo\.style\.visibility = ''; \}/,
    'se vuelve a mostrar al cargar y tambien si falla (nunca queda oculto para siempre)');
  // El ocultar va ANTES de cambiar el src (si no, el onload de una imagen
  // ya en cache podria llegar antes y dejarla oculta).
  assert.ok(cuerpo.indexOf("elLogo.style.visibility = 'hidden'") < cuerpo.indexOf('elLogo.src = logoCli.src;'));
});

test('el aviso amarillo de "sin datos" se dibuja en el MISMO paso que las pestanas (sin await en medio): nunca aparece despues', () => {
  const ini = js.indexOf('async function _gdBootstrap');
  const fin = js.indexOf('function closeGenericDashboard');
  assert.ok(ini !== -1 && fin > ini);
  const cola = js.slice(js.indexOf('await Promise.all(tareasBootstrap);', ini), fin);
  const iKpis = cola.indexOf('renderGenericKpis();');
  const iTabs = cola.indexOf('renderGenericTabs();');
  assert.ok(iKpis !== -1 && iTabs !== -1 && iKpis < iTabs, 'renderGenericKpis (que dibuja el aviso) va antes que renderGenericTabs');
  const tramo = cola.slice(cola.indexOf('await Promise.all(tareasBootstrap);') + 1);
  assert.doesNotMatch(tramo, /\bawait\b/, 'no debe haber un await entre el aviso y las pestanas');
  const kpisFn = js.slice(js.indexOf('function renderGenericKpis'), js.indexOf('function renderGenericKpis') + 400);
  assert.match(kpisFn, /renderGenericBanner\(\)/, 'renderGenericKpis dibuja el aviso');
});
