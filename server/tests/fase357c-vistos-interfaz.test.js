// fase357c-vistos-interfaz.test.js — Fase 357 C: interfaz de «Vistos» y registro en el Portal Asesor.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
global.VISTOS_ESTADOS = require('../../public/js/vistos-logic.js').VISTOS_ESTADOS;
const UI = require('../../public/js/vistos.js');
const PUB = path.join(__dirname, '..', '..', 'public');
const leer = (r) => fs.readFileSync(path.join(PUB, r), 'utf8');

test('quién ve la pestaña: ADMIN, Reportes y supervisor', () => {
  assert.equal(UI.vistosPuedeVer(null, true), true);
  assert.equal(UI.vistosPuedeVer('REPORTES', false), true);
  assert.equal(UI.vistosPuedeVer('SUPERVISOR', false), true);
  for (const r of ['CALIDAD', 'GERENCIA', 'CLIENTES_DASH', 'ASESOR', 'SISTEMAS']) assert.equal(UI.vistosPuedeVer(r, false), false, r);
});

test('tabla: resumen por estado, nunca/días, todo escapado', () => {
  const html = UI.vistosTablaHtml([
    { nombre: '<b>Ana</b>', ultimaApertura: null, dias: null, sinVer: 3, total: 3, semaforo: 'rojo' },
    { nombre: 'Luz', ultimaApertura: '2026-11-17T20:30:00Z', dias: 0, sinVer: 1, total: 2, semaforo: 'amarillo' },
    { nombre: 'Sol', ultimaApertura: '2026-11-10T20:30:00Z', dias: 7, sinVer: 0, total: 1, semaforo: 'verde' },
    { nombre: 'Mar', ultimaApertura: null, dias: null, sinVer: 0, total: 0, semaforo: 'gris' },
  ]);
  assert.doesNotMatch(html, /<b>Ana/);
  assert.match(html, /&lt;b&gt;Ana&lt;\/b&gt;/);
  assert.match(html, /Atrasado: 1/);
  assert.match(html, /Pendiente: 1/);
  assert.match(html, /Al día: 1/);
  assert.match(html, /Sin monitoreos: 1/);
  assert.match(html, />Nunca</);
  assert.match(html, /\(hoy\)/);
  assert.match(html, /\(hace 7 días\)/);
  assert.match(html, /17\/11\/2026/);
  assert.match(UI.vistosTablaHtml([]), /No hay asesoras activas/);
});

test('cableado: pestaña oculta por defecto, panel, scripts, switchCalTab y Portal Asesor', () => {
  const i = leer('index.html');
  assert.match(i, /data-ctab="vistos" id="ctab-btn-vistos" onclick="switchCalTab\('vistos'\)" style="display:none">Vistos</);
  assert.match(i, /id="cpanel-vistos" class="atab-panel"/);
  assert.ok(i.indexOf('js/vistos-logic.js') < i.indexOf('js/vistos.js'));
  const c = leer('js/calidad.js');
  assert.match(c, /t==='vistos' && !\(typeof vistosPuedeVer==='function'/);
  assert.match(c, /renderCalVistos\(\); \/\/ Fase 357 \(C\)/);
  assert.match(c, /vistosActualizarTab\(\); \/\/ Fase 357 \(C\)/);
  assert.match(leer('js/session.js'), /if\(sec==='calidad' && typeof vistosRegistrarApertura === 'function'\) vistosRegistrarApertura\(\);/);
  const v = leer('js/vistos.js');
  assert.match(v, /currentUser\.rol !== 'ASESOR'\) return;/);
  assert.match(v, /verComoActivo\(\)\) return;/);
});
