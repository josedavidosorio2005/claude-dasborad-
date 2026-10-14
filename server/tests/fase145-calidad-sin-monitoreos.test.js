// fase145-calidad-sin-monitoreos.test.js — Fase 145: la pestaña Calidad de
// una campaña SIN NINGUN monitoreo (Mobilize hoy) dice "Todavia no hay
// monitoreos de calidad para Mobilize" (mismo aviso .gd-aviso-mes de A6),
// en vez de "Sin datos de Calidad para <mes>", que culpaba al mes elegido.
'use strict';

const fs = require('fs');
const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calDashTextoSinMonitoreos } = require('../../public/js/calidad-dashboard-logic');

const GD = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'dashboard-generic.js'), 'utf8');

test('calDashTextoSinMonitoreos: nombre de la campaña como se lee en la interfaz', () => {
  assert.equal(calDashTextoSinMonitoreos('MOBILIZE'), 'Todavía no hay monitoreos de calidad para Mobilize.');
  assert.equal(calDashTextoSinMonitoreos('ORLANT'), 'Todavía no hay monitoreos de calidad para Orlant.');
  assert.equal(calDashTextoSinMonitoreos('clinica aurora'), 'Todavía no hay monitoreos de calidad para Clinica Aurora.');
  assert.equal(calDashTextoSinMonitoreos(''), 'Todavía no hay monitoreos de calidad.');
  assert.equal(calDashTextoSinMonitoreos(null), 'Todavía no hay monitoreos de calidad.');
});

test('_gdRenderCalidad: con 0 monitoreos (y la carga terminada) muestra el aviso de A6 con el texto nuevo, antes que el aviso del mes', () => {
  const cuerpo = GD.slice(GD.indexOf('function _gdRenderCalidad('), GD.indexOf('function _gdRenderCalidad(') + 2500);
  const iVacio = cuerpo.indexOf('if(!todos.length && _gdCalCargada[camp])');
  const iMes = cuerpo.indexOf('_calDashMesSincronizado[camp] !== _gd.mesSel');
  assert.ok(iVacio !== -1, 'falta la rama de "sin ningun monitoreo"');
  assert.ok(iVacio < iMes, 'la rama de 0 monitoreos va antes de la del mes sin datos');
  const rama = cuerpo.slice(iVacio, iMes);
  assert.match(rama, /<div class="gd-aviso-mes" role="status">'\+esc\(calDashTextoSinMonitoreos\(camp\)\)\+'<\/div>/);
  assert.match(rama, /_gdPanelVacioEnCanvas\(i, 'Sin monitoreos todavía\.'\)/, 'torta/barras: una linea de texto, sin canvas vacio');
});

test('el aviso de 0 monitoreos solo sale si loadCalData termino bien (nunca por un error de red)', () => {
  assert.match(GD, /_gdCalCargada\[camp\] = false;\s*\n\s*tareasBootstrap\.push\(\(async function\(\)\{ try\{ await loadCalData\(camp\); _gdCalCargada\[camp\] = true; \}catch\(e\)\{\} \}\)\(\)\);/);
});
