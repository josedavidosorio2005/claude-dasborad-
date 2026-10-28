// fase206-tope15-orlant-ingresadas.test.js — Fase 206 (OK del usuario):
// (1) Tipificacion a 1440 px: la torta va junto a la tabla (~660 px) y ahora
// caben 15 porciones (Mobilize, octubre: 15 tipificaciones, sin "Otras").
// (2) Trafico de Llamadas de ORLANT: el total se llama "Llamadas ingresadas",
// igual que en Mobilize. Solo texto.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('../../public/js/tipificacion-logic.js');
const { CONFIGS } = require('../dashboard-config-seed');
const { db } = require('./helpers');

test('torta: 15 porciones en un contenedor de 600-899 px (1440 px junto a la tabla); 15 tipificaciones sin "Otras"', () => {
  assert.equal(L.tipificacionMaxPorciones(663), 15);
  assert.equal(L.tipificacionMaxPorciones(900), 20);
  assert.equal(L.tipificacionMaxPorciones(599), 10);
  const quince = Array.from({ length: 15 }, (_, k) => ({ tipificacion: 'T' + k, cantidad: 20 - k }));
  const p = L.tipificacionPorcionesTorta(quince, L.tipificacionMaxPorciones(663));
  assert.equal(p.length, 15);
  assert.ok(!p.some((x) => x.esOtras));
  assert.ok(L.tipificacionPorcionesTorta(quince.concat([{ tipificacion: 'T15', cantidad: 1 }]), 15).some((x) => x.esOtras), '16 en 15: aparece "Otras"');
});

test('seed: el trafico_combo de ORLANT trae etiquetaTotal "Llamadas ingresadas"', () => {
  const panel = CONFIGS.find((c) => c.cliente === 'ORLANT').layout.tabs.find((t) => t.key === 'trafico').panels[0];
  assert.deepEqual(panel, { tipo: 'trafico_combo', campana: 'ORLANT', etiquetaTotal: 'Llamadas ingresadas' });
});

test('migracion ORLANT: agrega etiquetaTotal solo si falta; nunca pisa uno puesto; sin panel, intacto; MOBILIZE intacto', () => {
  const leer = (c) => JSON.parse(db.prepare('SELECT layout FROM dashboards_config WHERE cliente=?').get(c).layout);
  const panel = (l) => l.tabs.find((t) => t.key === 'trafico').panels.find((p) => p.tipo === 'trafico_combo');
  const original = leer('ORLANT');
  const mobilize = leer('MOBILIZE');
  assert.equal(panel(original).etiquetaTotal, 'Llamadas ingresadas');
  const sin = JSON.parse(JSON.stringify(original));
  delete panel(sin).etiquetaTotal;
  db.prepare("UPDATE dashboards_config SET layout=? WHERE cliente='ORLANT'").run(JSON.stringify(sin));
  db.migrarOrlantTraficoEtiquetaTotal();
  assert.equal(panel(leer('ORLANT')).etiquetaTotal, 'Llamadas ingresadas');
  db.migrarOrlantTraficoEtiquetaTotal();
  assert.deepEqual(leer('ORLANT'), original, 'idempotente e igual al seed');
  const otro = JSON.parse(JSON.stringify(original));
  panel(otro).etiquetaTotal = 'Entrantes';
  db.prepare("UPDATE dashboards_config SET layout=? WHERE cliente='ORLANT'").run(JSON.stringify(otro));
  db.migrarOrlantTraficoEtiquetaTotal();
  assert.equal(panel(leer('ORLANT')).etiquetaTotal, 'Entrantes', 'no pisa');
  const rara = { kpis: [], tabs: [{ key: 'otro', label: 'Otro', panels: [] }] };
  db.prepare("UPDATE dashboards_config SET layout=? WHERE cliente='ORLANT'").run(JSON.stringify(rara));
  db.migrarOrlantTraficoEtiquetaTotal();
  assert.deepEqual(leer('ORLANT'), rara);
  db.prepare("UPDATE dashboards_config SET layout=? WHERE cliente='ORLANT'").run(JSON.stringify(original));
  assert.deepEqual(leer('MOBILIZE'), mobilize);
});

// ── Colores: una torta de 15 (o 20) porciones no repite colores ──
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const C = require('../../public/js/contraste-logic.js');
const CHARTS = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'charts.js'), 'utf8');
const lista = (nombre) => {
  const ini = CHARTS.indexOf('var ' + nombre + '=[');
  assert.ok(ini >= 0, nombre);
  const txt = CHARTS.slice(ini + ('var ' + nombre + '=').length, CHARTS.indexOf(']', ini) + 1);
  return JSON.parse(txt.replace(/'/g, '"'));
};

test('PC_EXTRA: 8 colores por tema, >=3:1 contra las superficies, sin semaforo y distintos (deltaE >= 12) de PC y entre si', () => {
  const casos = [[lista('PC'), lista('PC_EXTRA_CLARO'), ['#ffffff', '#f7fbfd']], [lista('PC_DARK'), lista('PC_EXTRA_DARK'), ['#132c35', '#17343e']]];
  for (const [base, extra, superficies] of casos) {
    assert.equal(extra.length, 8);
    const todos = base.slice();
    for (const h of extra) {
      superficies.forEach((s) => assert.ok(C.contrasteRazon(h, s) >= 3, h + ' contra ' + s));
      assert.ok(Math.min(...todos.map((b) => C.contrasteDeltaE(h, b))) >= 12, h + ' muy parecido a otro');
      todos.push(h);
    }
  }
  assert.match(CHARTS, /PC=PC_DARK; PC_EXTRA=PC_EXTRA_DARK;/);
  assert.match(CHARTS, /PC_EXTRA=PC_EXTRA_CLARO;\n    CHART_GRID=/);
});

test('tipificacionSinRepetirConExtra: los repetidos toman un color extra libre; los demas no cambian', () => {
  assert.deepEqual(L.tipificacionSinRepetirConExtra(['a', 'b', 'a', 'c', 'b'], ['x', 'y', 'a']), ['a', 'b', 'x', 'c', 'y']);
  assert.deepEqual(L.tipificacionSinRepetirConExtra(['a', 'b'], ['x']), ['a', 'b']);
});

test('vista: torta de 15 tipificaciones (contenedor de 663 px) con 15 colores distintos', async () => {
  const P = require('../../public/js/paleta-logic.js');
  const PC = lista('PC');
  const elementos = {}, graficas = [];
  const todas = Array.from({ length: 15 }, (_, k) => ({ tipificacion: 'Codigo_' + (k + 1), cantidad: 40 - k }));
  const sandbox = Object.assign({}, L, {
    document: { getElementById: (id) => (elementos[id] = elementos[id] || { id, innerHTML: '', value: '', clientWidth: 663 }) },
    apiRequest: async (m, url) => (url.indexOf('/resumen-salida') !== -1 ? { total: 0, conectadas: 0, noConectadas: 0 } : { total: todas.reduce((a, r) => a + r.cantidad, 0), datos: todas.slice(0, 10), todas }),
    _gdChart: (id, cfg) => graficas.push({ id, cfg }),
    loPie: () => ({ plugins: { legend: { position: 'right' } } }),
    tipificacionEtiqueta: (t) => t,
    paletaColorPara: (e) => P.paletaColorPara(e, PC),
    paletaColoresSinRepetir: (l) => P.paletaColoresSinRepetir(l, PC),
    PC_EXTRA: lista('PC_EXTRA_CLARO'),
    showToast: () => {}, esc: (s) => String(s), textoFormatoNombre: (v) => v, URLSearchParams,
  });
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'tipificacion.js'), 'utf8'), sandbox);
  vm.runInContext("_tipificacionPanelConfig[0] = { mostrarTablaDetalle: true }; _tipificacionEstadoCompartido[0] = { mes: '2026-10', desde: '', hasta: '' };", sandbox);
  await sandbox._tipificacionDibujarCanal('MOBILIZE', 0, 'LLAMADAS', { meses: ['2026-10'] });
  const torta = graficas.find((g) => g.cfg.type === 'pie');
  assert.equal(torta.cfg.data.labels.length, 15, '15 porciones, sin "Otras"');
  const colores = torta.cfg.data.datasets[0].backgroundColor;
  assert.equal(new Set(colores).size, 15, 'ningun color repetido');
});
