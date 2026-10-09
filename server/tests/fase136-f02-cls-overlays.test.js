// fase136-f02-cls-overlays.test.js — Fase 136 (F02, corrige el numero
// real de la Fase 135). docs/auditoria-ui-fase135.md reporto CLS 0.8131
// "al abrir ORLANT", pero esa medicion nunca reseteaba el contador antes
// de abrir el dashboard -- arrastraba el CLS de toda la sesion. Medido
// bien (PerformanceObserver/layout-shift, reset justo antes de cada
// accion, server/tests no puede correr un navegador real asi que esto
// solo guarda la regla CSS -- la medicion real vive en el PR): abrir
// ORLANT ya media 0.014 (bien, no hacia falta tocarlo); los saltos
// reales eran abrir el overlay de Calidad (0.67 -- #cal-kpis-strip
// empieza vacio y crece 108px cuando el fetch llega) y el modal de
// Cargar Datos (0.14 -- #cargas-modal crece de ~501px a pantalla
// completa cuando la tabla de "Cargas registradas" se puebla). Con
// min-height reservando ese espacio de antemano: Calidad baja a 0.056,
// Cargar Datos a 0.064 -- los dos por debajo de la meta (0.1) y del
// minimo aceptable (0.25) que pidio el usuario.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { request, app } = require('./helpers');

async function css() {
  const res = await request(app).get('/css/styles.css');
  assert.equal(res.status, 200);
  return res.text;
}

test('#cal-kpis-strip reserva min-height (evita el salto de 108px cuando el fetch de monitoreos llega)', async () => {
  const texto = await css();
  const m = texto.match(/#cal-kpis-strip\{([^}]*)\}/);
  assert.ok(m, 'deberia existir una regla propia para #cal-kpis-strip');
  assert.match(m[1], /min-height:\s*108px/);
});

test('#cargas-modal reserva min-height (reduce el salto cuando la tabla de cargas se puebla)', async () => {
  const texto = await css();
  const m = texto.match(/#cargas-modal\{([^}]*)\}/);
  assert.ok(m, 'deberia existir una regla propia para #cargas-modal, ADEMAS de la que comparte con los otros 4 modales');
  assert.match(m[1], /min-height:\s*70vh/);
});

test('#cargas-modal sigue compartiendo la regla de ventana flotante con los otros 4 modales (width/max-width/max-height/border-radius sin cambios)', async () => {
  const texto = await css();
  const selector = texto.match(/(#calidad-modal,[^{]*)\{/)[1];
  ['#calidad-modal', '#detalle-monitoreo-modal', '#supervisar-lider-modal', '#cargas-modal', '#dashcfg-modal'].forEach((id) => {
    assert.ok(selector.includes(id), `${id} deberia seguir en la regla compartida`);
  });
  const reglaCompartida = texto.match(/#calidad-modal,[^{]*\{([^}]*)\}/)[1];
  assert.match(reglaCompartida, /max-width:\s*1180px/);
  assert.match(reglaCompartida, /max-height:\s*93vh/);
});
