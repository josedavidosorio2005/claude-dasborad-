// fase147-c-fcr.test.js — Fase 147, Parte C: "Solucion en primer contacto
// (FCR)" en Mobilize → Flujo de Llamadas, calculado desde la Encuesta
// (Q03 = 1 sobre la base del panel, `fcrBase`). Todo SINTETICO.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('../../public/js/encuesta-logic.js');
const { CONFIGS } = require('../dashboard-config-seed');
const { db } = require('./helpers');

test('tarjeta: mes objetivo con su fraccion; otros meses aparte; mes sin encuestas', () => {
  const porMes = [
    { periodo: '2026-09', base: 'total', si: 3, total: 45, respondieron: 4, den: 45, pct: 6.7 },
    { periodo: '2026-08', base: 'total', si: 1, total: 2, respondieron: 1, den: 2, pct: 50 },
  ];
  const t = L.encuestaFcrTarjeta(porMes, '2026-09');
  assert.equal(t.sinEncuestas, false);
  assert.deepEqual([t.pct, t.si, t.den], [6.7, 3, 45]);
  assert.deepEqual(t.otros.map((m) => m.periodo), ['2026-08']);
  assert.equal(L.encuestaFmtPct(t.pct), '6,7 %');
  assert.equal(L.encuestaFcrFraccion(3, 45, 'total'), '3 de 45 encuestas');
  assert.equal(L.encuestaFcrFraccion(3, 4, 'respondieron'), '3 de 4 que respondieron la pregunta 3');
  const vacio = L.encuestaFcrTarjeta(porMes, '2026-10');
  assert.equal(vacio.sinEncuestas, true);
  assert.equal(vacio.otros.length, 2);
  assert.equal(L.encuestaFmtPct(null), '—');
});

test('seed: el trafico_combo de Flujo de Llamadas de Mobilize trae fcrBase "empezaron" (Fase 200; antes "total"); ORLANT no', () => {
  const panelM = CONFIGS.find((c) => c.cliente === 'MOBILIZE').layout.tabs.find((t) => t.key === 'flujo').panels.find((p) => p.tipo === 'trafico_combo');
  assert.equal(panelM.fcrBase, 'empezaron'); // Fase 200
  const orlant = JSON.stringify(CONFIGS.find((c) => c.cliente === 'ORLANT').layout);
  assert.ok(!orlant.includes('fcrBase'));
});

test('migracion: agrega fcrBase "total" solo si falta; nunca pisa una base elegida; forma desconocida intacta', () => {
  const leer = () => JSON.parse(db.prepare("SELECT layout FROM dashboards_config WHERE cliente='MOBILIZE'").get().layout);
  const original = leer();
  const sin = JSON.parse(JSON.stringify(original));
  const panel = (l) => l.tabs.find((t) => t.key === 'flujo').panels.find((p) => p.tipo === 'trafico_combo');
  delete panel(sin).fcrBase;
  db.prepare("UPDATE dashboards_config SET layout=? WHERE cliente='MOBILIZE'").run(JSON.stringify(sin));
  db.migrarMobilizeFlujoFcr();
  assert.equal(panel(leer()).fcrBase, 'total');
  const elegida = leer(); panel(elegida).fcrBase = 'respondieron';
  db.prepare("UPDATE dashboards_config SET layout=?, updatedAt='Z' WHERE cliente='MOBILIZE'").run(JSON.stringify(elegida));
  db.migrarMobilizeFlujoFcr();
  assert.equal(panel(leer()).fcrBase, 'respondieron', 'no pisa la base elegida');
  const rara = { kpis: [], tabs: [{ key: 'flujo', label: 'Flujo', panels: [{ tipo: 'trafico_combo', campana: 'MOBILIZE' }] }] };
  db.prepare("UPDATE dashboards_config SET layout=? WHERE cliente='MOBILIZE'").run(JSON.stringify(rara));
  db.migrarMobilizeFlujoFcr();
  assert.deepEqual(leer(), rara);
  db.prepare("UPDATE dashboards_config SET layout=? WHERE cliente='MOBILIZE'").run(JSON.stringify(original));
});

// ── Vista (_encuestaDibujarFcr con un DOM minimo) ──
const VISTA_JS = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'encuesta.js'), 'utf8');
async function dibujar(respuesta, hasta, base) {
  const el = { 'tv-kpis-0': { innerHTML: '' } };
  const pedidos = [];
  el['tv-kpis-0'].insertAdjacentHTML = () => { el['tv-fcr-0'] = { innerHTML: '' }; };
  const sandbox = {
    document: { getElementById: (id) => el[id] || null },
    apiRequest: async (m, url) => { pedidos.push(url); return respuesta; },
    esc: (s) => String(s),
    mesNombreLargo: (m) => ({ '2026-08': 'Agosto 2026', '2026-09': 'Septiembre 2026', '2026-10': 'Octubre 2026' }[m] || m),
  };
  Object.keys(L).forEach((k) => { sandbox[k] = L[k]; });
  vm.createContext(sandbox);
  vm.runInContext(VISTA_JS, sandbox);
  await sandbox._encuestaDibujarFcr(0, 'MOBILIZE', '2026-08-01', hasta, base);
  return { html: el['tv-fcr-0'].innerHTML, pedidos };
}

// Fase 203: la tarjeta SUMA los meses del rango (si y den sumados) y, con
// mas de un mes, trae el detalle "Por mes" (antes: solo el mes del final).
test('Vista: tarjeta con la suma de los meses ("4 de 46 encuestas") y su detalle por mes; la base viaja al servidor', async () => {
  const { html, pedidos } = await dibujar([
    { periodo: '2026-08', base: 'total', si: 1, total: 1, respondieron: 1, den: 1, pct: 100 },
    { periodo: '2026-09', base: 'total', si: 3, total: 45, respondieron: 4, den: 45, pct: 6.7 },
  ], '2026-09-30', 'total');
  assert.match(pedidos[0], /\/calidad\/encuestas\/fcr\?campana=MOBILIZE&base=total&desde=2026-08-01&hasta=2026-09-30$/);
  assert.match(html, /Solución en primer contacto \(FCR\)/);
  assert.match(html, /8,7 %/); // 4 / 46, no el promedio de 100 % y 6,7 %
  assert.match(html, /Agosto 2026, Septiembre 2026: 4 de 46 encuestas/);
  // Detalle compacto en la tarjeta; las fracciones van en el title.
  assert.match(html, /title="Agosto 2026 100 % \(1 de 1 encuestas\) · Septiembre 2026 6,7 % \(3 de 45 encuestas\)">Por mes: Agosto 2026 100 % · Septiembre 2026 6,7 %</);
  assert.doesNotMatch(html, /Otros meses/);
});

test('Vista: rango sin encuestas -> "Sin encuestas"; base respondieron se explica', async () => {
  const a = await dibujar([], '2026-10-31', 'total');
  assert.match(a.html, /Agosto 2026, Septiembre 2026, Octubre 2026: Sin encuestas/);
  const b = await dibujar([{ periodo: '2026-09', base: 'respondieron', si: 3, total: 45, respondieron: 4, den: 4, pct: 75 }], '2026-09-30', 'respondieron');
  assert.match(b.pedidos[0], /base=respondieron/);
  assert.match(b.html, /75 %/);
  assert.match(b.html, /3 de 4 que respondieron la pregunta 3/);
});

test('Integracion: trafico.js dibuja el FCR solo cuando el panel trae fcrBase', () => {
  const t = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'trafico.js'), 'utf8');
  assert.match(t, /if\(pCfgKpis\.fcrBase && typeof _encuestaDibujarFcr === 'function'\) _encuestaDibujarFcr\(i, campana, estado\.desde, estado\.hasta, pCfgKpis\.fcrBase\);/);
});
