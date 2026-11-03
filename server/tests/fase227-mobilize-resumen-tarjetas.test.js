// fase227-mobilize-resumen-tarjetas.test.js — Fase 227 (pedido de Edwin,
// reunion 03/11, SOLO Mobilize): en el resumen de Flujo de Llamadas, despues
// de "Llamadas contestadas", Nivel de servicio, Tasa de abandono y Eficacia:
//   Llamadas ingresadas, Llamadas contestadas, Nivel de servicio, Tasa de
//   abandono, Eficacia, Llamadas abandonadas, Nivel de atencion (FCR al final).
// ORLANT, Aurora y HLM no cambian. Migracion idempotente.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { db } = require('./helpers');

const JS = path.join(__dirname, '..', '..', 'public', 'js');
const { traficoOrdenTarjetas, TRAFICO_ORDEN_TARJETAS } = require(path.join(JS, 'trafico-logic.js'));
const { eficaciaSumarMeses } = require(path.join(JS, 'eficacia.js'));
const seed = require('../dashboard-config-seed');

const ORDEN_MOBILIZE = ['total', 'contestadas', 'nivelServicio', 'tasaAbandono', 'eficacia', 'abandonadas', 'nivelAtencion'];

function extraer(src, firma) {
  const ini = src.indexOf(firma);
  assert.ok(ini >= 0, firma);
  return src.slice(ini, src.indexOf('\n}\n', ini) + 2);
}

// _traficoDibujarKpis (trafico.js) en un sandbox con sus dependencias reales.
function dibujar({ orden, eficacia, ocultar }) {
  const el = { innerHTML: '' };
  const ctx = {
    document: { getElementById: (id) => (id === 'tv-kpis-3' ? el : null) },
    esc: (s) => String(s == null ? '' : s),
    traficoOrdenTarjetas,
    _gdUmbralPara: () => null,
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(JS, 'kpi-tarjeta-logic.js'), 'utf8'), ctx);
  vm.runInContext(extraer(fs.readFileSync(path.join(JS, 'trafico.js'), 'utf8'), 'function _traficoDibujarKpis('), ctx);
  ctx._traficoDibujarKpis('tv', 3,
    { total: 1000, contestadas: 950, abandonadas: 50, nivelAtencion: 95, tasaAbandono: 5, nivelServicio: 88.4 },
    { total: 'Llamadas ingresadas', contestadas: 'Llamadas contestadas', abandonadas: 'Llamadas abandonadas', nivelServicioLabel: 'Nivel de servicio (20 s)', nivelServicioMetrica: 'service_level' },
    'MOBILIZE', ocultar, { orden, eficaciaEnResumen: eficacia });
  return el.innerHTML;
}
const titulos = (html) => [...html.matchAll(/<div class="kl">([^<]+)/g)].map((m) => m[1].trim());

test('traficoOrdenTarjetas: sin orden, el de siempre; con orden, ese; nada se pierde ni se repite', () => {
  assert.deepEqual(traficoOrdenTarjetas(undefined, false), TRAFICO_ORDEN_TARJETAS);
  assert.deepEqual(TRAFICO_ORDEN_TARJETAS, ['total', 'contestadas', 'abandonadas', 'nivelAtencion', 'tasaAbandono', 'nivelServicio']);
  assert.deepEqual(traficoOrdenTarjetas(ORDEN_MOBILIZE, true), ORDEN_MOBILIZE);
  // eficacia solo si el panel la pide
  assert.deepEqual(traficoOrdenTarjetas(ORDEN_MOBILIZE, false), ORDEN_MOBILIZE.filter((k) => k !== 'eficacia'));
  // claves desconocidas o repetidas se ignoran; las que faltan van al final
  assert.deepEqual(traficoOrdenTarjetas(['contestadas', 'xyz', 'contestadas', 'total'], false),
    ['contestadas', 'total', 'abandonadas', 'nivelAtencion', 'tasaAbandono', 'nivelServicio']);
});

test('Mobilize: tarjetas en el orden pedido, con "Tasa de abandono" y la Eficacia en su lugar', () => {
  const html = dibujar({ orden: ORDEN_MOBILIZE, eficacia: true });
  assert.deepEqual(titulos(html), ['Llamadas ingresadas', 'Llamadas contestadas', 'Nivel de servicio (20 s)', 'Tasa de abandono', 'Eficacia', 'Llamadas abandonadas', 'Nivel de atención']);
  assert.match(html, /id="tv-ef-res-3"/);
  assert.doesNotMatch(html, /% Abandono del periodo/);
  assert.match(html, /88,4 %/);
  assert.match(html, /5 %/);
});

test('ORLANT (sin opciones nuevas): mismas tarjetas y mismo orden de antes, sin Eficacia', () => {
  const html = dibujar({});
  assert.deepEqual(titulos(html), ['Llamadas ingresadas', 'Llamadas contestadas', 'Llamadas abandonadas', 'Nivel de atención', 'Tasa de abandono', 'Nivel de servicio (20 s)']);
  assert.doesNotMatch(html, /ef-res/);
  // y resumenOcultar sigue funcionando para quien lo use
  assert.deepEqual(titulos(dibujar({ ocultar: ['tasaAbandono', 'nivelServicio'] })), ['Llamadas ingresadas', 'Llamadas contestadas', 'Llamadas abandonadas', 'Nivel de atención']);
});

test('Eficacia: suma positivas y contestadas de los meses (Todos / 1 mes / 2 meses), nunca promedio de %', () => {
  const MESES = [
    { periodo: '2026-08', positivas: 30, contestadas: 80, pct: 37.5 },
    { periodo: '2026-09', positivas: 40, contestadas: 90, pct: 44.4 },
    { periodo: '2026-10', positivas: 42, contestadas: 89, pct: 47.2 },
  ];
  assert.deepEqual(eficaciaSumarMeses(MESES), { positivas: 112, contestadas: 259, pct: 43.2 });
  assert.deepEqual(eficaciaSumarMeses(MESES.slice(2)), { positivas: 42, contestadas: 89, pct: 47.2 });
  const dos = eficaciaSumarMeses([MESES[0], MESES[2]]);
  assert.equal(dos.pct, 42.6); // 72 / 169 = 42,60; el promedio de 37,5 y 47,2 daria 42,35
  assert.deepEqual(eficaciaSumarMeses([]), { positivas: 0, contestadas: 0, pct: null });
});

test('la tarjeta del resumen usa el mismo endpoint, Desde/Hasta y MESES que la sub-pestaña', async () => {
  const src = fs.readFileSync(path.join(JS, 'eficacia.js'), 'utf8');
  for (const [mesesSel, valor, texto] of [[[], '43,2 %', '112 de 259'], [['2026-10'], '47,2 %', '42 de 89'], [['2026-08', '2026-10'], '42,6 %', '72 de 169']]) {
    const el = { innerHTML: '' };
    const pedidos = [];
    const ctx = {
      document: { getElementById: (id) => (id === 'tv-ef-res-5' ? el : null) },
      esc: (s) => String(s), encodeURIComponent, _gd: { mesesSel },
      apiRequest: async (m, url) => { pedidos.push(url); return { codigos: ['Agenda'], meses: [
        { periodo: '2026-08', positivas: 30, contestadas: 80, pct: 37.5 },
        { periodo: '2026-09', positivas: 40, contestadas: 90, pct: 44.4 },
        { periodo: '2026-10', positivas: 42, contestadas: 89, pct: 47.2 }] }; },
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(JS, 'mes-global-logic.js'), 'utf8'), ctx);
    vm.runInContext(src, ctx);
    await ctx._eficaciaDibujarTarjetaResumen(5, 'MOBILIZE', '2026-08-01', '2026-10-31');
    assert.deepEqual(pedidos, ['/calidad/tipificacion/eficacia?campana=MOBILIZE&desde=2026-08-01&hasta=2026-10-31']);
    assert.match(el.innerHTML, new RegExp('<div class="kv">' + valor + '</div>'), mesesSel.join('+') || 'Todos');
    assert.match(el.innerHTML, new RegExp(texto));
  }
  // la sub-pestaña usa las mismas funciones
  assert.match(extraer(src, 'async function _eficaciaDibujar('), /meses = _eficaciaMesesFiltrados\(r\);\n  var suma = eficaciaSumarMeses\(meses\);/);
});

test('sin CDR: la tarjeta dice "—" con su texto', async () => {
  const el = { innerHTML: '' };
  const ctx = { document: { getElementById: () => el }, esc: (s) => String(s), encodeURIComponent, _gd: { mesesSel: [] }, apiRequest: async () => ({ codigos: [], meses: [] }) };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(JS, 'mes-global-logic.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(JS, 'eficacia.js'), 'utf8'), ctx);
  await ctx._eficaciaDibujarTarjetaResumen(1, 'MOBILIZE', '', '');
  assert.match(el.innerHTML, /<div class="kv">—<\/div>/);
  assert.match(el.innerHTML, /Sin CDR de llamadas en el período/);
});

function panelFlujo(layout, campana) {
  const tab = layout.tabs.find((t) => t.key === 'flujo');
  return tab && tab.panels.find((p) => p.tipo === 'trafico_combo' && p.campana === campana);
}

test('semilla y plantilla de Mobilize con el orden nuevo; ORLANT, Aurora y HLM sin las opciones nuevas', () => {
  const m = panelFlujo(seed.CONFIGS.find((c) => c.cliente === 'MOBILIZE').layout, 'MOBILIZE');
  assert.deepEqual(m.resumenOrden, ORDEN_MOBILIZE);
  assert.equal(m.eficaciaEnResumen, true);
  assert.equal(m.resumenOcultar, undefined);
  // el perfil de plantillas (fuente de la foto de la Fase 153) lleva lo mismo
  const src = fs.readFileSync(path.join(__dirname, '..', 'plantillas-cliente.js'), 'utf8');
  assert.ok(src.includes("resumenOrden: ['total', 'contestadas', 'nivelServicio', 'tasaAbandono', 'eficacia', 'abandonadas', 'nivelAtencion']"));
  assert.ok(src.includes('eficaciaEnResumen: true'));
  assert.ok(!src.includes('resumenOcultar'));
  for (const cli of ['ORLANT', 'CLINICA AURORA', 'HOSPITAL LA MARIA']) {
    const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(cli);
    if (!row) continue;
    const texto = row.layout;
    assert.ok(!texto.includes('resumenOrden') && !texto.includes('eficaciaEnResumen'), cli + ' no cambia');
  }
});

test('migracion: forma de produccion -> orden nuevo; idempotente; otra forma se deja intacta', () => {
  const leer = () => JSON.parse(db.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'MOBILIZE'").get().layout);
  const guardar = (l) => db.prepare("UPDATE dashboards_config SET layout = ? WHERE cliente = 'MOBILIZE'").run(JSON.stringify(l));
  const original = leer();
  try {
    // forma de produccion (antes de esta fase)
    const prod = leer();
    const p = panelFlujo(prod, 'MOBILIZE');
    delete p.resumenOrden; delete p.eficaciaEnResumen;
    p.resumenOcultar = ['tasaAbandono', 'nivelServicio'];
    guardar(prod);
    db.migrarMobilizeResumenTarjetas();
    const a = panelFlujo(leer(), 'MOBILIZE');
    assert.deepEqual(a.resumenOrden, ORDEN_MOBILIZE);
    assert.equal(a.eficaciaEnResumen, true);
    assert.equal(a.resumenOcultar, undefined);
    assert.equal(a.fcrBase, p.fcrBase, 'lo demas del panel no se toca');
    assert.deepEqual(a.subtabs, p.subtabs);
    // idempotente
    const antes = JSON.stringify(leer());
    db.migrarMobilizeResumenTarjetas();
    assert.equal(JSON.stringify(leer()), antes);
    // otra forma (alguien cambio el ocultar a mano): se deja intacta
    const otra = leer();
    const q = panelFlujo(otra, 'MOBILIZE');
    delete q.resumenOrden; delete q.eficaciaEnResumen;
    q.resumenOcultar = ['tasaAbandono'];
    guardar(otra);
    const antesOtra = JSON.stringify(leer());
    db.migrarMobilizeResumenTarjetas();
    assert.equal(JSON.stringify(leer()), antesOtra);
  } finally {
    guardar(original);
  }
});
