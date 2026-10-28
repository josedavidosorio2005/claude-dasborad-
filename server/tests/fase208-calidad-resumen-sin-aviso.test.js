// fase208-calidad-resumen-sin-aviso.test.js — Fase 208 (pedido del usuario):
// en la pestaña Calidad de Mobilize, con el resumen de calidad ya cargado,
// los paneles de monitoreos vacios NO dicen "Todavía no hay monitoreos de
// calidad para Mobilize" (ni la torta "Sin monitoreos todavía."): se
// esconden. Sin resumen cargado (o en una campaña sin panel de resumen), el
// aviso de la Fase 145 sigue igual.
'use strict';

const fs = require('fs');
const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calDashResumenCubreSinMonitoreos } = require('../../public/js/calidad-dashboard-logic');

const GD = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'dashboard-generic.js'), 'utf8');

const TAB_MOBILIZE = [
  { tipo: 'calidad_resumen_panel', campana: 'MOBILIZE' },
  { tipo: 'calidad_kpis', campana: 'MOBILIZE' },
  { tipo: 'calidad_pie', campana: 'MOBILIZE' },
];

test('con resumen cargado en la misma pestaña, el aviso de 0 monitoreos no hace falta', () => {
  assert.equal(calDashResumenCubreSinMonitoreos(TAB_MOBILIZE, 'MOBILIZE', [{ mes: '2026-10' }]), true);
});

test('sin meses de resumen, el aviso sigue (Fase 145)', () => {
  assert.equal(calDashResumenCubreSinMonitoreos(TAB_MOBILIZE, 'MOBILIZE', []), false);
  assert.equal(calDashResumenCubreSinMonitoreos(TAB_MOBILIZE, 'MOBILIZE', null), false);
});

test('sin panel de resumen en la pestaña (ORLANT, Aurora, HLM), el aviso sigue', () => {
  const tabOrlant = [{ tipo: 'calidad_kpis', campana: 'ORLANT' }, { tipo: 'calidad_pie', campana: 'ORLANT' }];
  assert.equal(calDashResumenCubreSinMonitoreos(tabOrlant, 'ORLANT', [{ mes: '2026-09' }]), false);
  assert.equal(calDashResumenCubreSinMonitoreos(null, 'ORLANT', [{ mes: '2026-09' }]), false);
});

test('el resumen de OTRA campaña no esconde el aviso', () => {
  assert.equal(calDashResumenCubreSinMonitoreos(TAB_MOBILIZE, 'ORLANT', [{ mes: '2026-10' }]), false);
});

test('_gdRenderCalidad: la rama del resumen va dentro de la de 0 monitoreos y ANTES del aviso', () => {
  const ini = GD.indexOf('function _gdRenderCalidad(');
  const cuerpo = GD.slice(ini, GD.indexOf('_calDashMesSincronizado[camp] !== claveCal', ini));
  const iVacio = cuerpo.indexOf('if(!todos.length && _gdCalCargada[camp])');
  const iResumen = cuerpo.indexOf('calDashResumenCubreSinMonitoreos(tabCal.panels, camp');
  const iAviso = cuerpo.indexOf('calDashTextoSinMonitoreos(camp)');
  assert.ok(iVacio !== -1 && iResumen !== -1 && iAviso !== -1);
  assert.ok(iVacio < iResumen && iResumen < iAviso, 'primero se mira el resumen, despues el aviso');
  const rama = cuerpo.slice(iResumen, iAviso);
  assert.match(rama, /style\.display = 'none'/, 'el panel se esconde (no queda una tarjeta vacia)');
  assert.match(rama, /return;/, 'no sigue al aviso');
});
