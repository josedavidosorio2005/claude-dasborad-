// fase332-orlant-calidad-solo-nueva.test.js — Fase 332 (reporte del supervisor, 11/11):
// ORLANT › Calidad mostraba a la vez el bloque de antes (indicadores, torta, barras) y
// «Resultado de los monitoreos». Los dos leen los mismos monitoreos; queda solo el nuevo,
// con los 3 de antes OCULTOS por configuracion (no borrados). Ademas: el promedio del
// equipo con ▲/▼ pasa al bloque nuevo, un nombre guardado como "Invalid Date" se muestra
// como "Sin nombre (revisar carga)" y la carga masiva ya no lo puede volver a guardar.
// Datos SINTETICOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { db } = require('./helpers');
const dbMod = require('../db');
const CE = require('../../public/js/calidad-equipo-logic.js');
const CM = require('../../public/js/calidad-carga-masiva-logic.js');

const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');
const layoutDe = (c) => JSON.parse(db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(c).layout);
const calidadDe = (c) => layoutDe(c).tabs.find((t) => t.key === 'calidad');

test('migracion: en ORLANT › Calidad los 3 de antes quedan ocultos (no borrados) y el de monitoreos visible', () => {
  const tab = calidadDe('ORLANT');
  assert.deepEqual(tab.panels.map((p) => [p.tipo, !!p.oculto]), [
    ['calidad_kpis', true], ['calidad_pie', true], ['calidad_bar_asesores', true], ['calidad_monitoreos_panel', false]]);
  assert.ok(!tab.oculta, 'la pestaña sigue visible');
});

test('migracion: idempotente, solo ORLANT y solo su Calidad; Mobilize, Aurora y HLM quedan como estaban', () => {
  const todos = () => JSON.stringify(db.prepare('SELECT cliente, layout FROM dashboards_config ORDER BY cliente').all());
  const antes = todos();
  dbMod.orlantCalidadSoloNueva();
  assert.equal(todos(), antes, 'segunda corrida: nada cambia');
  for (const c of ['MOBILIZE', 'CLINICA AURORA', 'HOSPITAL LA MARIA']) {
    const t = calidadDe(c);
    if (!t) continue;
    assert.deepEqual(t.panels.map((p) => p.tipo), ['calidad_monitoreos_panel'], c + ' ya tenia solo el bloque nuevo (Fase 269)');
    assert.ok(!t.panels.some((p) => p.oculto), c + ' sin tocar');
  }
  // Las demas pestañas de ORLANT no tienen paneles ocultos.
  layoutDe('ORLANT').tabs.filter((t) => t.key !== 'calidad').forEach((t) => assert.ok(!(t.panels || []).some((p) => p.oculto), t.key));
});

test('dashboard: un panel `oculto` no se dibuja ni se exporta (y sin rejilla, el bloque nuevo va en su lugar)', () => {
  const js = PUB('js/dashboard-generic.js');
  assert.ok(js.includes('function gdPanelOculto(p){ return !!(p && p.oculto === true); }'));
  assert.ok(js.includes(".filter(function(i){ return !gdPanelOculto(panels[i]); }); // Fase 332"), 'renderGenericTab salta los ocultos');
  assert.ok(js.includes('if(gdPanelOculto(p)) continue; // Fase 332: lo oculto tampoco se exporta'));
  assert.ok(js.includes("return indicesVisibles.indexOf(i) !== -1 && !gdPanelOculto(p); }); // Fase 332"), 'comparar contra mes anterior');
  // tieneRejilla mira solo los indices visibles: con los 3 ocultos no hay rejilla vacia ni hueco.
  assert.ok(js.includes('var tieneRejilla = panels.some(function(p, i){ return indicesVisibles.indexOf(i) !== -1 && GD_TIPOS_SIN_LIENZO.indexOf(p.tipo) === -1; });'));
});

test('bloque nuevo: promedio del equipo con ▲ por encima / ▼ por debajo, igual criterio que el de antes', () => {
  assert.deepEqual(CE.ceVsEquipo([{ avg: 100 }, { avg: 95.52 }, { avg: 90 }], 95.52), { equipo: 95.52, encima: 2, debajo: 1 });
  assert.deepEqual(CE.ceVsEquipo([], 90), { equipo: null, encima: 0, debajo: 0 });
  // Con todos los meses, el promedio del bloque nuevo es el mismo de las tarjetas de antes (puntaje).
  const mons = [{ asesor: 'Uno Ficticio', fecha: '2026-09-02', puntaje: 100 }, { asesor: 'Dos Ficticio', fecha: '2026-10-02', puntaje: 91.04 }];
  const r = CE.ceResultado(mons, { meses: ['2026-09', '2026-10'], asesores: null, plantilla: null });
  assert.equal(r.kpis.total, 2);
  assert.equal(Math.round(r.kpis.promedio * 100) / 100, 95.52);
  const panel = PUB('js/calidad-panel.js');
  assert.ok(panel.includes("var vsEq = ceVsEquipo(v.porAsesor, k.promedio);"));
  assert.ok(panel.includes("' por encima · ▼ '"));
  assert.ok(panel.includes("<span>Promedio general' + (k.promedio === null ? '' : ' · <em class=\"cmp-clase-txt\">' + esc(k.clase.t) + '</em>')"), 'la clasificacion general, en texto');
});

test('"Invalid Date": se muestra "Sin asesor" (Fase 333) en todo el bloque nuevo; los nombres reales no cambian', () => {
  assert.equal(CE.ceNombreAsesor('Invalid Date'), 'Sin asesor');
  assert.equal(CE.ceNombreAsesor(' invalid date '), 'Sin asesor');
  assert.equal(CE.ceNombreAsesor('Persona Ficticia', (s) => s.toUpperCase()), 'PERSONA FICTICIA');
  assert.equal(CE.ceNombreAsesor('Invalid Dates'), 'Invalid Dates', 'solo el texto exacto de la fecha invalida');
  const panel = PUB('js/calidad-panel.js');
  assert.equal(panel.split('textoFormatoNombre(').length - 1, 0, 'ningun nombre del panel se formatea sin pasar por _cmpNombre');
  assert.ok(panel.includes('function _cmpNombre(n) { return ceNombreAsesor(n, textoFormatoNombre); }'));
});

test('carga masiva: una celda de nombre que llega como fecha se omite con aviso (nunca se guarda "Invalid Date")', () => {
  const items = [{ n: 1, label: 'Saludo' }];
  const aoa = [
    ['ASESOR', 'FECHA', 'Saludo'],
    [new Date(NaN), '2026-10-06', 'SI'],
    [new Date(2026, 0, 5), '2026-10-06', 'SI'],
    ['Invalid Date', '2026-10-06', 'SI'],
    ['Persona Ficticia', '2026-10-06', 'SI'],
  ];
  const r = CM.cmParseRows(aoa, items);
  assert.deepEqual(r.filas.map((f) => f.asesor), ['Persona Ficticia']);
  assert.equal(r.avisos.filter((a) => /el nombre del asesor viene como fecha/.test(a)).length, 3);
});

test('estilos: la tabla por asesor no corta la clasificacion ni la nota, solo tokens', () => {
  const css = PUB('css/styles.css');
  const b = css.slice(css.indexOf('/* Fase 332: «Resultado por asesor» sin textos cortados'));
  assert.ok(b.includes('.cmp-tabla .cc2-pill{white-space:nowrap}'));
  assert.ok(b.includes('.cmp-tabla td:nth-child(2){white-space:normal;min-width:9em;overflow-wrap:anywhere}'));
  assert.ok(!/#[0-9a-f]{3,6}\b/i.test(b));
});
