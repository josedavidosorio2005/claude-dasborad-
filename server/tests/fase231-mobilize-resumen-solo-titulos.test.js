// fase231-mobilize-resumen-solo-titulos.test.js — Fase 231 (pedido de Edwin,
// reunion 04/11, SOLO Mobilize): en la fila de tarjetas del resumen de Flujo
// de Llamadas cada tarjeta muestra solo la cifra (.kv) y el titulo (.kl): sin
// "?", sin la linea de encuestas / contestadas de ingreso, sin variacion ni
// meta, pero con el borde de color del semaforo. FCR se titula "Solución en
// primer contacto". Opcion del panel `resumenSoloTitulos`. ORLANT, Aurora y
// HLM no cambian. Migracion idempotente.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { db } = require('./helpers');

const JS = path.join(__dirname, '..', '..', 'public', 'js');
const { traficoOrdenTarjetas } = require(path.join(JS, 'trafico-logic.js'));
const seed = require('../dashboard-config-seed');

const ORDEN_MOBILIZE = ['total', 'contestadas', 'nivelServicio', 'tasaAbandono', 'eficacia', 'abandonadas', 'nivelAtencion'];
const UMBRALES = { nivel_atencion: { verde: 90, amarillo: 80 }, tasa_abandono: { verde: 3, amarillo: 10, direccion: 'menor_es_mejor' }, service_level: { verde: 80, amarillo: 70 } };

function extraer(src, firma) {
  const ini = src.indexOf(firma);
  assert.ok(ini >= 0, firma);
  return src.slice(ini, src.indexOf('\n}\n', ini) + 2);
}

// _traficoDibujarKpis (trafico.js) con sus dependencias reales, con umbrales
// (semaforo + meta) y mes anterior (variacion), como en produccion.
function dibujar({ soloTitulos, nsNull, orden, eficacia }) {
  const el = { innerHTML: '' };
  const ctx = {
    document: { getElementById: (id) => (id === 'tv-kpis-3' ? el : null) },
    esc: (s) => String(s == null ? '' : s),
    traficoOrdenTarjetas,
    canLoadData: () => true,
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(JS, 'kpi-tarjeta-logic.js'), 'utf8'), ctx);
  ctx._gdUmbralPara = (m) => UMBRALES[m] || null;
  vm.runInContext(extraer(fs.readFileSync(path.join(JS, 'trafico.js'), 'utf8'), 'function _traficoDibujarKpis('), ctx);
  const totales = { total: 1000, contestadas: 950, abandonadas: 50, nivelAtencion: 95, tasaAbandono: 5, nivelServicio: nsNull ? null : 88.4 };
  ctx._traficoDibujarKpis('tv', 3, totales,
    { total: 'Llamadas ingresadas', contestadas: 'Llamadas contestadas', abandonadas: 'Llamadas abandonadas',
      nivelServicioLabel: 'Nivel de servicio (20 s)', nivelServicioMetrica: 'service_level',
      nivelServicioNota: 'Promedio simple de SERVICE_LEVEL_20SEC', nivelServicioSinDatoMsg: { principal: 'Sin dato de nivel de servicio', detalle: 'Cargue el reporte' } },
    'MOBILIZE', null,
    { orden, eficaciaEnResumen: eficacia, soloTitulos, mesAnteriorLbl: 'sep',
      anteriores: { total: 900, contestadas: 860, abandonadas: 40, nivelAtencion: 95.6, tasaAbandono: 4.4, nivelServicio: 86 } });
  return el.innerHTML;
}

// Divide la fila en tarjetas (cada una empieza con <div class="aurora-kpi ...">).
const tarjetas = (html) => html.split(/(?=<div class="aurora-kpi)/).filter((t) => t.startsWith('<div class="aurora-kpi'));
const hijos = (t) => [...t.matchAll(/<div class="([^"]+)"/g)].slice(1).map((m) => m[1]);

test('Mobilize (resumenSoloTitulos): cada tarjeta solo con .kv y .kl, sin "?", variacion ni meta', () => {
  const html = dibujar({ soloTitulos: true, orden: ORDEN_MOBILIZE, eficacia: true });
  const ts = tarjetas(html);
  assert.equal(ts.length, 7);
  for (const t of ts) {
    if (t.includes('ef-res')) continue; // la de Eficacia la llena eficacia.js (prueba aparte)
    assert.deepEqual(hijos(t), ['kv', 'kl'], t);
  }
  assert.doesNotMatch(html, /kpi-var|kpi-meta|cursor:help|>\?</);
  assert.doesNotMatch(html, /vs\. sep|Meta /);
});

test('Mobilize: el borde de color del semaforo se queda', () => {
  const con = dibujar({ soloTitulos: true, orden: ORDEN_MOBILIZE, eficacia: true });
  const sin = dibujar({ soloTitulos: false, orden: ORDEN_MOBILIZE, eficacia: true });
  const clases = (h) => tarjetas(h).map((t) => t.match(/^<div class="([^"]+)"/)[1]);
  assert.deepEqual(clases(con), clases(sin));
  assert.ok(clases(con).some((c) => /kpi-(green|org|red)/.test(c)), 'hay tarjetas con semaforo');
});

test('Mobilize: sin dato de nivel de servicio no sale el aviso debajo de la fila', () => {
  const html = dibujar({ soloTitulos: true, nsNull: true, orden: ORDEN_MOBILIZE, eficacia: true });
  assert.doesNotMatch(html, /Sin dato de nivel de servicio|Cargue el reporte/);
  assert.match(html, /<div class="kv">—<\/div><div class="kl">Nivel de servicio \(20 s\)<\/div>/);
});

test('ORLANT (sin la opcion): conserva "?", variacion, meta y aviso de sin dato (guardiana)', () => {
  const html = dibujar({});
  assert.match(html, /cursor:help/);
  assert.match(html, /kpi-var/);
  assert.match(html, /vs\. sep/);
  assert.match(html, /kpi-meta/);
  assert.match(dibujar({ nsNull: true }), /Sin dato de nivel de servicio/);
});

// ── FCR (encuesta.js) ──
async function dibujarFcr({ soloTitulos, porMes }) {
  const el = { innerHTML: '' };
  const kpis = { insertAdjacentHTML: () => {} };
  const ctx = {
    document: { getElementById: (id) => (id === 'tv-kpis-2' ? kpis : id === 'tv-fcr-2' ? el : null) },
    esc: (s) => String(s == null ? '' : s), encodeURIComponent, _gd: { mesesSel: [] },
    apiRequest: async () => porMes,
    mesNombreLargo: (m) => ({ '2026-09': 'Septiembre 2026', '2026-10': 'Octubre 2026' }[m] || m),
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(JS, 'mes-global-logic.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(JS, 'encuesta-logic.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(JS, 'encuesta.js'), 'utf8'), ctx);
  await ctx._encuestaDibujarFcr(2, 'MOBILIZE', '2026-09-01', '2026-10-31', 'empezaron', soloTitulos);
  return el.innerHTML;
}
const DOS_MESES = [
  { periodo: '2026-09', total: 15, si: 3, den: 5, pct: 60, base: 'empezaron' },
  { periodo: '2026-10', total: 45, si: 19, den: 28, pct: 67.9, base: 'empezaron' },
];

test('FCR en Mobilize: solo la cifra y "Solución en primer contacto" (sin "?", sin linea, sin "Por mes")', async () => {
  const html = await dibujarFcr({ soloTitulos: true, porMes: DOS_MESES });
  assert.equal(html, '<div class="kv">66,7 %</div><div class="kl">Solución en primer contacto</div>'); // 22 / 33
  assert.doesNotMatch(html, /FCR\)|enc-fcr-sub|enc-fcr-otros|Por mes|\?/);
  const vacio = await dibujarFcr({ soloTitulos: true, porMes: [] });
  assert.equal(vacio, '<div class="kv">—</div><div class="kl">Solución en primer contacto</div>');
});

test('FCR sin la opcion: titulo nuevo, pero conserva su nota, su linea y el "Por mes"', async () => {
  const html = await dibujarFcr({ soloTitulos: false, porMes: DOS_MESES });
  assert.match(html, /<div class="kl">Solución en primer contacto <span/);
  assert.doesNotMatch(html, /\(FCR\)/);
  assert.match(html, /enc-fcr-sub/);
  assert.match(html, /Por mes/);
});

// ── Eficacia (eficacia.js) ──
async function dibujarEficacia(soloTitulos, meses) {
  const el = { innerHTML: '' };
  const ctx = {
    document: { getElementById: () => el }, esc: (s) => String(s), encodeURIComponent, _gd: { mesesSel: [] },
    apiRequest: async () => ({ codigos: ['Agenda'], meses }),
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(JS, 'mes-global-logic.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(JS, 'eficacia.js'), 'utf8'), ctx);
  await ctx._eficaciaDibujarTarjetaResumen(1, 'MOBILIZE', '', '', soloTitulos);
  return el.innerHTML;
}

test('Eficacia en Mobilize: solo la cifra y "Eficacia"; sin CDR, "—"', async () => {
  const html = await dibujarEficacia(true, [{ periodo: '2026-10', positivas: 42, contestadas: 89, pct: 47.2 }]);
  assert.equal(html, '<div class="kv">47,2 %</div><div class="kl">Eficacia</div>');
  assert.equal(await dibujarEficacia(true, []), '<div class="kv">—</div><div class="kl">Eficacia</div>');
  // sin la opcion, como antes (la sub-pestaña y cualquier otro uso no cambian)
  assert.match(await dibujarEficacia(false, [{ periodo: '2026-10', positivas: 42, contestadas: 89, pct: 47.2 }]), /42 de 89 contestadas de ingreso/);
});

// ── Configuracion ──
function panelFlujo(layout, campana) {
  const tab = layout.tabs.find((t) => t.key === 'flujo');
  return tab && tab.panels.find((p) => p.tipo === 'trafico_combo' && p.campana === campana);
}

test('la opcion esta solo en Mobilize (semilla, plantilla) y la pasa trafico.js a FCR y Eficacia', () => {
  assert.equal(panelFlujo(seed.CONFIGS.find((c) => c.cliente === 'MOBILIZE').layout, 'MOBILIZE').resumenSoloTitulos, true);
  const plantilla = fs.readFileSync(path.join(__dirname, '..', 'plantillas-cliente.js'), 'utf8');
  assert.equal(plantilla.split('resumenSoloTitulos: true').length - 1, 1);
  for (const cli of ['ORLANT', 'CLINICA AURORA', 'HOSPITAL LA MARIA']) {
    const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(cli);
    if (row) assert.ok(!row.layout.includes('resumenSoloTitulos'), cli + ' no cambia');
  }
  const src = fs.readFileSync(path.join(JS, 'trafico.js'), 'utf8');
  assert.match(src, /contextoKpis\.soloTitulos = !!pCfgKpis\.resumenSoloTitulos;/);
  assert.match(src, /_encuestaDibujarFcr\(i, campana, estado\.desde, estado\.hasta, pCfgKpis\.fcrBase, !!pCfgKpis\.resumenSoloTitulos\)/);
  assert.match(src, /_eficaciaDibujarTarjetaResumen\(i, campana, estado\.desde, estado\.hasta, !!pCfgKpis\.resumenSoloTitulos\)/);
});

test('migracion: forma de la Fase 227 -> resumenSoloTitulos; idempotente; otra forma intacta; respeta false', () => {
  const leer = () => JSON.parse(db.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'MOBILIZE'").get().layout);
  const guardar = (l) => db.prepare("UPDATE dashboards_config SET layout = ? WHERE cliente = 'MOBILIZE'").run(JSON.stringify(l));
  const original = leer();
  try {
    const prod = leer();
    const p = panelFlujo(prod, 'MOBILIZE');
    delete p.resumenSoloTitulos;
    guardar(prod);
    db.migrarMobilizeResumenSoloTitulos();
    const a = panelFlujo(leer(), 'MOBILIZE');
    assert.equal(a.resumenSoloTitulos, true);
    assert.deepEqual(a.resumenOrden, ORDEN_MOBILIZE, 'lo demas del panel no se toca');
    assert.deepEqual(a.subtabs, p.subtabs);
    const antes = JSON.stringify(leer());
    db.migrarMobilizeResumenSoloTitulos();
    assert.equal(JSON.stringify(leer()), antes);
    // alguien la apago a mano (Edwin quiere los textos de vuelta): no se pisa
    const apagada = leer();
    panelFlujo(apagada, 'MOBILIZE').resumenSoloTitulos = false;
    guardar(apagada);
    db.migrarMobilizeResumenSoloTitulos();
    assert.equal(panelFlujo(leer(), 'MOBILIZE').resumenSoloTitulos, false);
    // otra forma (sin resumenOrden): intacta
    const otra = leer();
    const q = panelFlujo(otra, 'MOBILIZE');
    delete q.resumenSoloTitulos; delete q.resumenOrden;
    guardar(otra);
    const antesOtra = JSON.stringify(leer());
    db.migrarMobilizeResumenSoloTitulos();
    assert.equal(JSON.stringify(leer()), antesOtra);
  } finally {
    guardar(original);
  }
});
