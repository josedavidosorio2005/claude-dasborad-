// fase358-malla-interfaz.test.js — Fase 358: interfaz de «Malla de turnos».
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const L = require('../../public/js/malla-logic.js');
Object.assign(global, L, { esc: (v) => String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]) });
const UI = require('../../public/js/malla.js');
const PUB = path.join(__dirname, '..', '..', 'public');
const leer = (r) => fs.readFileSync(path.join(PUB, r), 'utf8');

test('«Mi malla»: dos semanas, días con fecha, descanso, sin turno; todo escapado', () => {
  const html = UI.mallaMiaHtml({ semanas: [
    { semana: '2026-11-16', turno: { grupo: '<b>Mañana</b>', horario: { 1: { entrada: '07:00', salida: '16:00' }, 6: { entrada: '08:00', salida: '12:00' }, 7: null } } },
    { semana: '2026-11-23', turno: null },
  ] });
  assert.match(html, /Esta semana · del 16 al 22 de nov de 2026/);
  assert.match(html, /Lunes 16\/11<\/th><td>07:00 – 16:00/);
  assert.match(html, /Sábado 21\/11<\/th><td>08:00 – 12:00/);
  assert.match(html, /class="ml-descanso"><th scope="row">Domingo 22\/11<\/th><td>Descanso/);
  assert.match(html, /&lt;b&gt;Mañana&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>Mañana/);
  assert.match(html, /Semana siguiente[\s\S]*Todavía no tienes turno asignado/);
  assert.match(UI.mallaMiaHtml({ semanas: [] }), /No tienes malla asignada/);
});

test('cableado: tarjeta de entrada, portal del supervisor, Portal Asesor, ventana, Escape e ícono', () => {
  const i = leer('index.html');
  assert.match(i, /id="supervisor-menu-malla" role="button" tabindex="0" onclick="mallaAbrir\(\)"/);
  assert.match(i, /id="asesor-menu-malla" role="button" tabindex="0" onclick="showAsesorSection\('malla'\)"/);
  assert.match(i, /id="asesor-section-malla" style="display:none"/);
  assert.match(i, /id="modal-malla"/);
  assert.ok(i.indexOf('js/malla-logic.js') < i.indexOf('js/malla.js'));
  assert.match(leer('js/session.js'), /\['calidad','malla'\]\.forEach/);
  assert.match(leer('js/motion-helpers.js'), /'modal-malla':/);
  assert.match(leer('img/iconos/lucide.svg'), /<symbol id="i-calendar" viewBox="0 0 24 24">/);
  assert.match(leer('js/dashboards-logic.js'), /key: 'malla', label: 'Malla de turnos'[^}]*accion: 'mallaAbrir'/);
  const css = leer('css/styles.css');
  assert.match(css, /\.ml-acciones\.hidden,\.ml-confirmar\.hidden\{display:none\}/);
});
