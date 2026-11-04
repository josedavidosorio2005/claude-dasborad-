// fase236-calidad-aviso-sondeo.test.js — Fase 236: "tiempo real" de Calidad
// sin conexiones abiertas (plan de Calidad, sección 6, opción B + C). El
// aviso del asesor se consulta cada 3 min con la pestaña visible y al volver
// a ella; el dashboard con la pestaña Calidad abierta, cada 5 min, y solo se
// redibuja si llegaron cambios. Datos SINTETICOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JSDIR = path.join(__dirname, '..', '..', 'public', 'js');
const L = require(path.join(JSDIR, 'calidad-sondeo-logic.js'));

test('cuándo toca consultar', () => {
  const b = { conSesion: true, visible: true, ahora: 1000000, intervalo: 180000 };
  assert.equal(L.calSondeoToca(Object.assign({ ultima: 0 }, b)), true, 'primera vez');
  assert.equal(L.calSondeoToca(Object.assign({ ultima: 1000000 - 60000 }, b)), false, 'hace 1 min');
  assert.equal(L.calSondeoToca(Object.assign({ ultima: 1000000 - 180000 }, b)), true, 'hace 3 min');
  assert.equal(L.calSondeoToca(Object.assign({ ultima: 1000000 - 60000, forzar: true }, b)), true, 'al volver a la pestaña');
  assert.equal(L.calSondeoToca(Object.assign({ ultima: 0 }, b, { visible: false })), false, 'pestaña oculta: nunca');
  assert.equal(L.calSondeoToca(Object.assign({ ultima: 0, forzar: true }, b, { conSesion: false })), false, 'sin sesión: nunca');
  assert.equal(L.CAL_SONDEO_ASESOR_MS, 180000);
  assert.equal(L.CAL_SONDEO_DASH_MS, 300000);
});

test('firma de monitoreos: cambia al agregar, editar o borrar; no por el orden', () => {
  const a = [{ id: 1, createdAt: 'x' }, { id: 2, createdAt: 'y' }];
  assert.equal(L.calSondeoFirma(a), L.calSondeoFirma([a[1], a[0]]));
  assert.notEqual(L.calSondeoFirma(a), L.calSondeoFirma(a.concat({ id: 3, createdAt: 'z' })));
  assert.notEqual(L.calSondeoFirma(a), L.calSondeoFirma([a[0], { id: 2, createdAt: 'y', updatedAt: 'w' }]));
  assert.notEqual(L.calSondeoFirma(a), L.calSondeoFirma([a[0]]));
});

// calidad-sondeo.js real, en un sandbox.
function sandbox(extra) {
  const pedidos = [];
  const dibujos = [];
  const els = { 'gd-overlay': { classList: { contains: () => true } }, 'asesor-section-calidad': { style: { display: 'block' } } };
  const ctx = Object.assign({
    console,
    document: { visibilityState: 'visible', getElementById: (id) => els[id] || null, addEventListener() {} },
    authToken: 't', currentUser: { rol: 'ASESOR' },
    _misMonitoreosNuevos: 0,
    encodeURIComponent,
    setInterval: () => 1,
    CAL_DB: {},
  }, extra);
  ctx.calCampCache = (c) => (ctx.CAL_DB[c] = ctx.CAL_DB[c] || { monitoreos: [] });
  ctx.calCargarAlertaNuevos = async () => { pedidos.push('/monitoreos/mios/nuevos'); ctx._misMonitoreosNuevos = ctx.__nuevos || 0; };
  ctx.renderMisResultados = async () => dibujos.push('mis-resultados');
  ctx.renderGenericTab = (t) => dibujos.push('tab ' + t);
  ctx.apiRequest = async (m, url) => { pedidos.push(url); return ctx.__monitoreos || []; };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(JSDIR, 'calidad-sondeo-logic.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(JSDIR, 'calidad-sondeo.js'), 'utf8'), ctx);
  return { ctx, pedidos, dibujos };
}

test('asesor: consulta el aviso; si hay nuevos y está en Mis Resultados, la redibuja; respeta los 3 min', async () => {
  const { ctx, pedidos, dibujos } = sandbox({});
  ctx.__nuevos = 1;
  await ctx.calSondeoTick(false);
  assert.deepEqual(pedidos, ['/monitoreos/mios/nuevos']);
  assert.deepEqual(dibujos, ['mis-resultados']);
  await ctx.calSondeoTick(false);
  assert.equal(pedidos.length, 1, 'menos de 3 min: no vuelve a pedir');
  await ctx.calSondeoTick(true);
  assert.equal(pedidos.length, 2, 'al volver a la pestaña: pide enseguida');
  assert.equal(dibujos.length, 1, 'sin nuevos de más: no redibuja');
});

test('pestaña oculta o sin sesión: ninguna consulta', async () => {
  const a = sandbox({});
  a.ctx.document.visibilityState = 'hidden';
  await a.ctx.calSondeoTick(true);
  const b = sandbox({ authToken: null });
  await b.ctx.calSondeoTick(true);
  assert.equal(a.pedidos.length + b.pedidos.length, 0);
});

test('dashboard con la pestaña Calidad: pide los monitoreos y redibuja solo si cambiaron', async () => {
  const _gd = { cliente: 'ORLANT', tab: 'calidad', config: { layout: { tabs: [{ key: 'calidad', panels: [{ tipo: 'calidad_kpis', campana: 'ORLANT' }, { tipo: 'calidad_pie', campana: 'ORLANT' }, { tipo: 'calidad_resumen_panel', campana: 'ORLANT' }] }] } } };
  const { ctx, pedidos, dibujos } = sandbox({ currentUser: { rol: 'ADMIN' }, _gd });
  ctx.CAL_DB.ORLANT = { monitoreos: [{ id: 1, createdAt: 'a' }] };
  ctx.__monitoreos = [{ id: 1, createdAt: 'a' }];
  await ctx.calSondeoTick(false);
  assert.deepEqual(pedidos, ['/monitoreos?campana=ORLANT'], 'una vez por campaña, sin el aviso del asesor');
  assert.deepEqual(dibujos, [], 'sin cambios no redibuja');
  ctx.__monitoreos = [{ id: 1, createdAt: 'a' }, { id: 2, createdAt: 'b' }];
  await ctx.calSondeoTick(true);
  assert.deepEqual(dibujos, ['tab calidad']);
  assert.equal(ctx.CAL_DB.ORLANT.monitoreos.length, 2);
  // otra pestaña abierta: no pide nada
  _gd.tab = 'trafico';
  pedidos.length = 0;
  await ctx.calSondeoTick(true);
  assert.deepEqual(pedidos, []);
});

test('index.html carga los 2 archivos y el cierre de sesión reinicia el sondeo; nada escribe', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  assert.ok(html.indexOf('js/calidad-sondeo-logic.js') > -1 && html.indexOf('js/calidad-sondeo-logic.js') < html.indexOf('js/calidad-sondeo.js'));
  assert.match(fs.readFileSync(path.join(JSDIR, 'session.js'), 'utf8'), /calSondeoReiniciar\(\); \/\/ Fase 236/);
  assert.doesNotMatch(fs.readFileSync(path.join(JSDIR, 'calidad-sondeo.js'), 'utf8'), /apiRequest\('(POST|PUT|DELETE)'/);
});
