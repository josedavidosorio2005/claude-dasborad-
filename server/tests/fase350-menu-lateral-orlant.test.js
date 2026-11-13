// fase350-menu-lateral-orlant.test.js — Fase 350 (excepcion al congelamiento de ORLANT aprobada por
// el usuario el 13/11, solo navegacion): el menu lateral plegable tambien en ORLANT. Un icono propio
// por pestaña; los iconos de Mobilize, Aurora y HLM no cambian; ORLANT no cambia nada mas (el menu
// se arma con las pestañas ya dibujadas: mismas, mismo orden, mismos permisos).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const L = require('../../public/js/gd-menu-lateral.js');

const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');

// Las 9 pestañas de ORLANT en produccion (13/11), en su orden.
const ORLANT = {
  'Tráfico de Llamadas': 'i-phone',
  'Tráfico de WhatsApp': 'i-message-circle',
  'Total tráfico': 'i-gauge',
  'Llamadas y WhatsApp de salida': 'i-contact',
  'Agendamiento': 'i-target',
  'Inasistencia': 'i-ban',
  'Efectividad de Citas': 'i-trending-up',
  'Tipificación': 'i-layout-dashboard',
  'Calidad': 'i-circle-check',
};

test('350: ORLANT tiene el menu lateral', () => {
  assert.equal(L.gdMenuLateralActivo('ORLANT'), true);
  assert.equal(L.gdMenuLateralActivo('SURA'), false);
});

test('350: cada pestaña de ORLANT con su icono propio del sprite', () => {
  const sprite = PUB('img/iconos/lucide.svg');
  for (const [t, ico] of Object.entries(ORLANT)) {
    assert.equal(L.gdMenuIcono(t), ico, t);
    assert.ok(sprite.includes('id="' + ico + '"'), ico + ' existe en el sprite');
  }
  assert.equal(new Set(Object.values(ORLANT)).size, Object.keys(ORLANT).length, 'ningun icono repetido entre las pestañas de ORLANT');
});

test('350: los iconos de Mobilize y de Aurora/HLM no cambian', () => {
  const antes = {
    'Flujo de Llamadas': 'i-phone', 'Llamadas Únicas y de Salida': 'i-contact', 'Flujo por hora': 'i-chart-column', 'Encuesta': 'i-message-circle',
    'Agendas': 'i-target', 'Encuestas': 'i-message-circle', 'Errores': 'i-triangle-alert',
  };
  for (const [t, ico] of Object.entries(antes)) assert.equal(L.gdMenuIcono(t), ico, t);
});

test('350: el menu no toca el contenido ni el orden de las pestañas (solo las mueve a la columna)', () => {
  const src = PUB('js/gd-menu-lateral.js');
  // Solo envuelve el texto de cada boton ya dibujado con un icono; no agrega, quita ni reordena botones.
  assert.ok(src.includes("tabs.querySelectorAll('button[data-gdtab]')"));
  assert.doesNotMatch(src, /appendChild\(|removeChild\(|\.sort\(/);
});
