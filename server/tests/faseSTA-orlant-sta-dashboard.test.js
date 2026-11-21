// faseSTA-orlant-sta-dashboard.test.js — Fase STA (parte 2, usuario 21/11/2026): las gráficas de
// «Gestión STA» dentro del Dashboard de ORLANT (pestaña «Gestión de la base STA», panel
// sta_resumen_panel), que es lo que ve el cliente de ORLANT. Datos SIEMPRE inventados.
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { db, cleanup } = require('./helpers');
const L = require('../../public/js/orlant-sta-dashboard.js');
const { GD_EXPORT_TIPOS_SOPORTADOS } = require('../../public/js/dashboard-export-tipos.js');

after(cleanup);
const REPO = path.join(__dirname, '..', '..');

test('migración faseSTA_orlant_gestion_base_v1: pestaña oculta después de «sta», idempotente, solo ORLANT', () => {
  const fila = () => JSON.parse(db.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'ORLANT'").get().layout);
  const original = fila();
  const sin = JSON.parse(JSON.stringify(original));
  sin.tabs = sin.tabs.filter((t) => t.key !== 'sta_gestion');
  db.prepare("UPDATE dashboards_config SET layout = ? WHERE cliente = 'ORLANT'").run(JSON.stringify(sin));
  db.agregarStaGestionOrlant();
  db.agregarStaGestionOrlant();
  const keys = fila().tabs.map((t) => t.key);
  assert.equal(keys.filter((k) => k === 'sta_gestion').length, 1, 'no la duplica');
  assert.equal(keys.indexOf('sta_gestion'), keys.indexOf('sta') + 1);
  const tab = fila().tabs.find((t) => t.key === 'sta_gestion');
  assert.equal(tab.label, 'Gestión de la base STA');
  assert.equal(tab.oculta, true);
  assert.deepEqual(tab.panels, [{ tipo: 'sta_resumen_panel', campana: 'ORLANT', titulo: 'Gestión de la base STA' }]);
  // la pestaña vieja «Gestión STA» (sta_categorias) queda igual
  assert.deepEqual(fila().tabs.find((t) => t.key === 'sta'), original.tabs.find((t) => t.key === 'sta'));
  const mob = db.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'MOBILIZE'").get();
  if (mob) assert.ok(!JSON.parse(mob.layout).tabs.some((t) => t.key === 'sta_gestion'), 'Mobilize no cambia');
  db.prepare("UPDATE dashboards_config SET layout = ? WHERE cliente = 'ORLANT'").run(JSON.stringify(original));
});

test('lógica del panel: indicadores, categorías con «Otros», tipificaciones y días ordenados', () => {
  const r = { total: 12, gestionados: 5, pendientes: 4, sinAsignar: 3, agendas: 2, citas: 3, efectividad: 60, efectivas: ['Agendado'],
    porTipi: { Agendado: 2, 'No contesta': 3 }, porDia: { '2026-11-21': { gestiones: 2, citas: 1 }, '2026-11-20': { gestiones: 3, citas: 2 } },
    porEntidad: {}, porServicio: { A: { gestionado: 1, pendiente: 0, sinAsignar: 0 } }, porEstado: {} };
  for (let k = 0; k < 13; k++) r.porEntidad['E' + String(k).padStart(2, '0')] = { gestionado: 0, pendiente: 0, sinAsignar: 13 - k };
  const kp = L.staResumenKpis(r);
  assert.deepEqual(kp.map((k) => k.v), ['12', '5', '2', '3', '60 %', '4', '3']);
  assert.equal(L.staResumenKpis({ efectividad: 12.5 })[4].v, '12,5 %');
  const ent = L.staResumenCategorias(r.porEntidad, 10);
  assert.equal(ent.length, 11);
  assert.equal(ent[0].nombre, 'E00');
  assert.deepEqual(ent[10], { nombre: 'Otros', gestionado: 0, pendiente: 0, sinAsignar: 3 + 2 + 1, total: 6 });
  assert.equal(L.staResumenCategorias({ a: {}, b: {} }, 1).length, 2, 'con uno de más no se junta');
  assert.deepEqual(L.staResumenTipis(r.porTipi).map((t) => t.nombre), ['No contesta', 'Agendado']);
  assert.deepEqual(L.staResumenDias(r.porDia).map((d) => d.dia), ['2026-11-20', '2026-11-21']);
  const ex = L.staResumenFilasExport(r);
  assert.ok(ex.length >= 4);
  assert.ok(!JSON.stringify(ex).match(/agenteId|autoriz/i), 'export sin datos individuales');
});

test('el panel está registrado: dibujo, exportar, script en index.html', () => {
  const gen = fs.readFileSync(path.join(REPO, 'public/js/dashboard-generic.js'), 'utf8');
  assert.match(gen, /p\.tipo === 'sta_resumen_panel'\)\{ _staResumenRenderPanel\(p, i\)/);
  assert.match(gen, /'sta_resumen_panel'\]; \/\/ Fase STA/);
  assert.match(gen, /_gdExportarStaResumen/);
  assert.ok(GD_EXPORT_TIPOS_SOPORTADOS.includes('sta_resumen_panel'));
  const html = fs.readFileSync(path.join(REPO, 'public/index.html'), 'utf8');
  assert.ok(html.indexOf('js/orlant-sta-dashboard.js') !== -1);
});
