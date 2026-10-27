// fase178-arreglos-preventivos.test.js — Fase 178: puntos 4 y 9 de la
// auditoria de v1.72.1 y el refresco tras Deshacer / Eliminar. Todo SINTETICO.
//   - Deshacer / Eliminar del Centro de cargas (y la carga) vacian las caches
//     de los paneles y vuelven a armar el tablero abierto con el mismo MES,
//     MESES y pestaña.
//   4. Los meses que solo tienen Resumen de calidad, Encuesta, WhatsApp por
//      rangos o Llamadas de salida entran en el MES y en MESES.
//   9. GET /umbrales devuelve los globales y los de los clientes a los que el
//      usuario tiene acceso, no los de todos.
// (El punto 6, limite de login por usuario, va en su propio archivo porque
// baja el limite antes de cargar la app: fase178-login-por-usuario.test.js.)
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const bcrypt = require('bcryptjs');
const { request, app, tokenFor, MASTER_PASSWORD, db } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const JS = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');
const GD = JS('dashboard-generic.js');

function bloque(txt, desde) {
  let i = txt.indexOf('{', desde) + 1, prof = 1;
  while (prof && i < txt.length) { if (txt[i] === '{') prof++; else if (txt[i] === '}') prof--; i++; }
  return txt.slice(desde, i);
}
function fn(src, nombre) {
  const i = src.search(new RegExp('(async )?function ' + nombre + '\\('));
  assert.ok(i >= 0, 'falta ' + nombre);
  return bloque(src, i);
}

function entorno({ abierto = true, cliente = 'ORLANT' } = {}) {
  const llamadas = { bootstrap: [], api: [] };
  const ctx = {
    _tipificacionOpciones: { 'ORLANT::LLAMADAS': { meses: ['2026-09'] } },
    _calResOpciones: { MOBILIZE: { meses: [] } },
    _trafico: { ORLANT: { filas: [1] } },
    _traficoEstado: { ORLANT: { skill: 'X' } }, // filtro: NO se toca
    _gd: { cliente, mesSel: '2026-09', mesesSel: ['2026-09', '2026-08'], compSel: '2026-08', vistaSel: '', tab: 'salida', config: {}, cargas: {} },
    document: { getElementById: (id) => (id === 'gd-overlay' ? { classList: { contains: (c) => c === 'show' && abierto } } : null) },
    apiRequest: async (m, url) => { llamadas.api.push(m + ' ' + url); return { config: { layout: {} }, secciones: { s: [] } }; },
    _gdBootstrap: async (conservar) => { llamadas.bootstrap.push(conservar); },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  const lista = GD.slice(GD.indexOf('var GD_ESTADO_A_REINICIAR'), GD.indexOf('];', GD.indexOf('var GD_ESTADO_A_REINICIAR')) + 2);
  vm.runInContext([lista, fn(GD, '_gdMeses'), fn(GD, 'gdCachesDatos'), fn(GD, 'gdDatosCambiaron')].join('\n'), ctx);
  return { ctx, llamadas };
}

test('tras Deshacer / Eliminar: se vacian las caches y el tablero abierto se vuelve a armar con el mismo MES, MESES y pestaña', async () => {
  const { ctx, llamadas } = entorno();
  await ctx.gdDatosCambiaron('ORLANT');
  assert.deepEqual(Object.keys(ctx._tipificacionOpciones), []);
  assert.deepEqual(Object.keys(ctx._calResOpciones), []);
  assert.deepEqual(Object.keys(ctx._trafico), []);
  assert.deepEqual(Object.keys(ctx._traficoEstado), ['ORLANT'], 'los filtros del panel no se borran');
  assert.deepEqual(llamadas.api, ['GET /dashboard/ORLANT']);
  assert.equal(llamadas.bootstrap.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(llamadas.bootstrap[0])), { mesesSel: ['2026-09', '2026-08'], compSel: '2026-08', vistaSel: '', tab: 'salida' }); // Fase 201: el mes sale de MESES
  assert.deepEqual(JSON.parse(JSON.stringify(ctx._gd.cargas)), { s: [] });
});

test('sin el tablero abierto, o con el tablero de otro cliente, solo se vacian las caches', async () => {
  for (const caso of [{ abierto: false }, { abierto: true, cliente: 'MOBILIZE' }]) {
    const { ctx, llamadas } = entorno(caso);
    await ctx.gdDatosCambiaron('ORLANT');
    assert.deepEqual(Object.keys(ctx._tipificacionOpciones), []);
    assert.equal(llamadas.api.length, 0);
    assert.equal(llamadas.bootstrap.length, 0);
  }
});

test('Deshacer, Eliminar y la carga llaman al refresco; el bootstrap conserva MES y pestaña solo si siguen existiendo', () => {
  const cc = JS('centro-cargas.js');
  assert.match(fn(cc, '_ccConfirmarDeshacer'), /_ccDatosCambiaron\(\);/);
  assert.match(fn(cc, '_ccConfirmarEliminar'), /_ccDatosCambiaron\(\);\n  await _ccCargar\(\);/);
  assert.match(fn(cc, '_ccDatosCambiaron'), /gdDatosCambiaron\(_cc\.cliente\)/);
  assert.match(fn(JS('cargas.js'), 'guardarCarga'), /gdDatosCambiaron\(cliente\)/);
  const boot = fn(GD, '_gdBootstrap');
  // Fase 201: el mes de las tarjetas = ultimo marcado en MESES (conservado) o el de siempre.
  assert.match(boot, /_gd\.mesSel = gdMesDeMeses\(_gd\.mesesSel, _gd\.mesDefecto, _gd\.periodos\);/);
  assert.match(boot, /visibles\.some\(function\(t\)\{ return t\.key === conservar\.tab; \}\)/);
  // Abrir el tablero sigue igual: sin `conservar`, filtros en blanco.
  assert.match(fn(GD, 'openGenericDashboard'), /await _gdBootstrap\(\);/);
});

test('4. los meses de Resumen de calidad, Encuesta, WhatsApp por rangos y Llamadas de salida entran en el MES', () => {
  const boot = fn(GD, '_gdBootstrap');
  assert.match(boot, /mesesLlamadasUnicas, mesesSoloPanel\]\);/);
  for (const [tipo, cargador] of [
    ['calidad_resumen_panel', '_calResCargar'],
    ['encuesta_panel', '_encuestaCargarOpciones'],
    ['trafico_whatsapp_combo', '_wppTiemposCargarOpciones'],
    ['llamadas_unicas_panel', '_llamadasSalidaCargarOpciones'],
  ]) {
    assert.match(boot, new RegExp("p\\.tipo === '" + tipo + "'[^\\n]*" + cargador + '\\(camp\\)'), tipo);
  }
  // WhatsApp por rangos solo en las campañas que tienen esa vista.
  assert.match(boot, /wppTiemposUsa\(camp\)\) fuentesSoloPanel/);
  // Son los cargadores reales de cada panel (comparten la cache).
  assert.match(JS('calidad-resumen.js'), /^async function _calResCargar\(campana\)/m);
  assert.match(JS('encuesta.js'), /^async function _encuestaCargarOpciones\(campana\)/m);
  assert.match(JS('whatsapp-tiempos.js'), /^async function _wppTiemposCargarOpciones\(campana\)/m);
  assert.match(JS('llamadas-unicas.js'), /^async function _llamadasSalidaCargarOpciones\(campana\)/m);
});

test('4. un mes que solo tiene esas fuentes queda en la union de meses (orden del selector)', () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fn(JS('mes-global-logic.js'), 'gdMesesUnion'), ctx);
  assert.deepEqual([...ctx.gdMesesUnion([['2026-08-15', '2026-09-01'], [], ['2026-10']])], ['2026-10', '2026-09', '2026-08']); // arreglo de otro contexto (vm)
});

test('9. GET /umbrales: cada quien ve los globales y los de sus clientes; el administrador ve todos', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  for (const campana of ['ORLANT', 'MOBILIZE']) {
    const r = await request(app).post('/api/umbrales').set(auth(admin)).send({ metrica: 'fase178_prueba', campana, verde: 90, amarillo: 70, direccion: 'mayor_es_mejor' });
    assert.ok(r.status === 201 || r.status === 200, JSON.stringify(r.body));
  }
  const g = await request(app).post('/api/umbrales').set(auth(admin)).send({ metrica: 'fase178_prueba', campana: '', verde: 80, amarillo: 60, direccion: 'mayor_es_mejor' });
  assert.ok(g.status === 201 || g.status === 200, JSON.stringify(g.body));

  db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt) VALUES (?,?,?,?,?,?,?)`)
    .run('Solo Orlant', 'f178orlant', 'CLIENTES_DASH', 1, bcrypt.hashSync('clave-f178', 4), JSON.stringify({ ClientesDash: true, cliente_ORLANT: true }), '01/10/2026 00:00:00');
  const t = await tokenFor('f178orlant', 'clave-f178');
  const lo = await request(app).get('/api/umbrales').set(auth(t));
  assert.equal(lo.status, 200);
  const propias = lo.body.filter((u) => u.metrica === 'fase178_prueba').map((u) => u.campana).sort();
  assert.deepEqual(propias, ['', 'ORLANT']);
  assert.ok(!lo.body.some((u) => u.campana === 'MOBILIZE'), 'nada de MOBILIZE');

  const todo = await request(app).get('/api/umbrales').set(auth(admin));
  assert.deepEqual(todo.body.filter((u) => u.metrica === 'fase178_prueba').map((u) => u.campana).sort(), ['', 'MOBILIZE', 'ORLANT']);
});
