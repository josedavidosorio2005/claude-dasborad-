// fase248-orden-tarjetas.test.js — Fase 248 (pedido del usuario, 04/11):
// mismo orden de tarjetas que ORLANT (Fase 246) en
//   - Mobilize > Flujo de Llamadas: Ingresadas, Contestadas, Abandonadas,
//     Nivel de servicio (20 s), Nivel de atencion, Tasa de abandono, y al
//     final Eficacia y FCR;
//   - Trafico de WhatsApp (todos los clientes): Total, Contestados,
//     Abandonados, Nivel de servicio, Nivel de atencion, Tasa de abandono; la
//     2a tarjeta de nivel de servicio (20 s, solo si hay 5 min) sigue al final.
// Solo cambia el orden: mismas tarjetas, mismas cifras. Datos sinteticos.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { db } = require('./helpers');

const JS = path.join(__dirname, '..', '..', 'public', 'js');
const { traficoOrdenTarjetas, TRAFICO_ORDEN_TARJETAS, TRAFICO_ORDEN_TARJETAS_LLAMADAS } = require(path.join(JS, 'trafico-logic.js'));
const seed = require('../dashboard-config-seed');

const ORDEN_227 = ['total', 'contestadas', 'nivelServicio', 'tasaAbandono', 'eficacia', 'abandonadas', 'nivelAtencion'];
const ORDEN_248 = ['total', 'contestadas', 'abandonadas', 'nivelServicio', 'nivelAtencion', 'tasaAbandono', 'eficacia'];

function extraer(src, firma) {
  const ini = src.indexOf(firma);
  assert.ok(ini >= 0, firma);
  return src.slice(ini, src.indexOf('\n}\n', ini) + 2);
}

// _traficoDibujarKpis (trafico.js) en un sandbox con sus dependencias reales.
function dibujar(prefijo, totales, labels, campana, contexto) {
  const el = { innerHTML: '' };
  const ctx = {
    document: { getElementById: (id) => (id === prefijo + '-kpis-0' ? el : null) },
    esc: (s) => String(s == null ? '' : s),
    traficoOrdenTarjetas,
    _gdUmbralPara: () => null,
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(JS, 'kpi-tarjeta-logic.js'), 'utf8'), ctx);
  vm.runInContext(extraer(fs.readFileSync(path.join(JS, 'trafico.js'), 'utf8'), 'function _traficoDibujarKpis('), ctx);
  ctx._traficoDibujarKpis(prefijo, 0, totales, labels, campana, null, contexto);
  return el.innerHTML;
}
const titulos = (html) => [...html.matchAll(/<div class="kl">([^<]+)/g)].map((m) => m[1].trim());
const cifras = (html) => [...html.matchAll(/<div class="kv">([^<]+)/g)].map((m) => m[1].trim()).sort();

const LLAM_TOT = { total: 1200, contestadas: 1104, abandonadas: 96, nivelAtencion: 92, tasaAbandono: 8, nivelServicio: 81.3 };
const LLAM_LBL = { total: 'Llamadas ingresadas', contestadas: 'Llamadas contestadas', abandonadas: 'Llamadas abandonadas', nivelServicioLabel: 'Nivel de servicio (20 s)', nivelServicioMetrica: 'service_level' };

test('Mobilize: orden como ORLANT y al final Eficacia; mismas tarjetas y cifras que antes', () => {
  const nuevo = dibujar('tv', LLAM_TOT, LLAM_LBL, 'MOBILIZE', { orden: ORDEN_248, eficaciaEnResumen: true, soloTitulos: true });
  const viejo = dibujar('tv', LLAM_TOT, LLAM_LBL, 'MOBILIZE', { orden: ORDEN_227, eficaciaEnResumen: true, soloTitulos: true });
  assert.deepEqual(titulos(nuevo), [
    'Llamadas ingresadas', 'Llamadas contestadas', 'Llamadas abandonadas',
    'Nivel de servicio (20 s)', 'Nivel de atención', 'Tasa de abandono', 'Eficacia',
  ]);
  assert.deepEqual(titulos(nuevo).slice().sort(), titulos(viejo).slice().sort(), 'ni quita ni agrega tarjetas');
  assert.deepEqual(cifras(nuevo), cifras(viejo), 'mismas cifras');
  // las primeras 6 son exactamente las de ORLANT
  assert.deepEqual(ORDEN_248.slice(0, 6), TRAFICO_ORDEN_TARJETAS_LLAMADAS);
  // FCR va despues de todo: encuesta.js la agrega al final de la fila
  const enc = fs.readFileSync(path.join(JS, 'encuesta.js'), 'utf8');
  assert.match(extraer(enc, 'async function _encuestaDibujarFcr('), /insertAdjacentHTML\('beforeend', '<div class="aurora-kpi enc-fcr"/);
});

test('ORLANT, Aurora y HLM (sin orden propio) quedan como en 1.122.0', () => {
  const src = fs.readFileSync(path.join(JS, 'trafico.js'), 'utf8');
  assert.match(src, /contextoKpis\.orden = pCfgKpis\.resumenOrden \|\| TRAFICO_ORDEN_TARJETAS_LLAMADAS;/);
  assert.deepEqual(TRAFICO_ORDEN_TARJETAS_LLAMADAS, ['total', 'contestadas', 'abandonadas', 'nivelServicio', 'nivelAtencion', 'tasaAbandono']);
  assert.deepEqual(titulos(dibujar('tv', LLAM_TOT, LLAM_LBL, 'ORLANT', { orden: TRAFICO_ORDEN_TARJETAS_LLAMADAS })), [
    'Llamadas ingresadas', 'Llamadas contestadas', 'Llamadas abandonadas',
    'Nivel de servicio (20 s)', 'Nivel de atención', 'Tasa de abandono',
  ]);
  for (const cli of ['ORLANT', 'CLINICA AURORA', 'HOSPITAL LA MARIA']) {
    const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(cli);
    if (!row) continue;
    assert.ok(!row.layout.includes('resumenOrden'), cli + ' sin orden propio');
  }
});

const WPP_TOT = { total: 640, contestadas: 600, abandonadas: 40, nivelAtencion: 93.8, tasaAbandono: 6.3 };
const WPP_LBL = { total: 'Total de WhatsApp', contestadas: 'WhatsApp contestados', abandonadas: 'WhatsApp abandonados' };

test('WhatsApp pasa el orden de Llamadas a la fila de tarjetas', () => {
  const wpp = fs.readFileSync(path.join(JS, 'trafico-whatsapp.js'), 'utf8');
  assert.match(wpp, /contextoKpis\.orden = TRAFICO_ORDEN_TARJETAS_LLAMADAS;\n {2}_traficoDibujarKpis\('tww', i, kpiTotales, kpiLabels, campana, null, contextoKpis\);/);
});

test('WhatsApp con un solo nivel de servicio (20 s): orden nuevo, mismas tarjetas y cifras', () => {
  const tot = Object.assign({ nivelServicio: 71.2 }, WPP_TOT);
  const lbl = Object.assign({ nivelServicioLabel: 'Nivel de servicio (20 s)' }, WPP_LBL);
  const nuevo = dibujar('tww', tot, lbl, 'ORLANT', { orden: TRAFICO_ORDEN_TARJETAS_LLAMADAS });
  const viejo = dibujar('tww', tot, lbl, 'ORLANT', {});
  assert.deepEqual(titulos(nuevo), [
    'Total de WhatsApp', 'WhatsApp contestados', 'WhatsApp abandonados',
    'Nivel de servicio (20 s)', 'Nivel de atención', 'Tasa de abandono',
  ]);
  assert.deepEqual(titulos(viejo), [
    'Total de WhatsApp', 'WhatsApp contestados', 'WhatsApp abandonados',
    'Nivel de atención', 'Tasa de abandono', 'Nivel de servicio (20 s)',
  ]);
  assert.deepEqual(cifras(nuevo), cifras(viejo));
});

test('WhatsApp con 5 min y 20 s: 5 min en el lugar de Nivel de servicio, 20 s sigue al final', () => {
  const tot = Object.assign({ nivelServicio: 90.1, nivelServicio2: 71.2 }, WPP_TOT);
  const lbl = Object.assign({ nivelServicioLabel: 'Nivel de servicio (5 min)', nivelServicio2Label: 'Nivel de servicio (20 s)' }, WPP_LBL);
  const nuevo = dibujar('tww', tot, lbl, 'MOBILIZE', { orden: TRAFICO_ORDEN_TARJETAS_LLAMADAS });
  const viejo = dibujar('tww', tot, lbl, 'MOBILIZE', {});
  assert.deepEqual(titulos(nuevo), [
    'Total de WhatsApp', 'WhatsApp contestados', 'WhatsApp abandonados',
    'Nivel de servicio (5 min)', 'Nivel de atención', 'Tasa de abandono', 'Nivel de servicio (20 s)',
  ]);
  assert.deepEqual(titulos(nuevo).slice().sort(), titulos(viejo).slice().sort());
  assert.deepEqual(cifras(nuevo), cifras(viejo));
  // el orden por defecto (sin orden) sigue igual para quien no pase uno
  assert.deepEqual(TRAFICO_ORDEN_TARJETAS, ['total', 'contestadas', 'abandonadas', 'nivelAtencion', 'tasaAbandono', 'nivelServicio']);
});

function panelFlujo(layout) {
  const tab = layout.tabs.find((t) => t.key === 'flujo');
  return tab && tab.panels.find((p) => p.tipo === 'trafico_combo' && p.campana === 'MOBILIZE');
}

test('semilla, plantilla y base de prueba de Mobilize con el orden nuevo', () => {
  assert.deepEqual(panelFlujo(seed.CONFIGS.find((c) => c.cliente === 'MOBILIZE').layout).resumenOrden, ORDEN_248);
  const src = fs.readFileSync(path.join(__dirname, '..', 'plantillas-cliente.js'), 'utf8');
  assert.ok(src.includes("resumenOrden: ['total', 'contestadas', 'abandonadas', 'nivelServicio', 'nivelAtencion', 'tasaAbandono', 'eficacia']"));
  const row = db.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'MOBILIZE'").get();
  if (row) assert.deepEqual(panelFlujo(JSON.parse(row.layout)).resumenOrden, ORDEN_248);
});

test('migracion: orden de la Fase 227 -> orden nuevo; idempotente; otra forma intacta; nada mas cambia', () => {
  const leer = () => JSON.parse(db.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'MOBILIZE'").get().layout);
  const guardar = (l) => db.prepare("UPDATE dashboards_config SET layout = ? WHERE cliente = 'MOBILIZE'").run(JSON.stringify(l));
  const original = leer();
  try {
    // forma de produccion (1.122.0)
    const prod = leer();
    panelFlujo(prod).resumenOrden = ORDEN_227.slice();
    guardar(prod);
    db.migrarMobilizeResumenOrdenComoOrlant();
    const despues = leer();
    assert.deepEqual(panelFlujo(despues).resumenOrden, ORDEN_248);
    // fuera de resumenOrden, el layout es identico
    panelFlujo(despues).resumenOrden = ORDEN_227.slice();
    assert.equal(JSON.stringify(despues), JSON.stringify(prod));
    // idempotente
    panelFlujo(despues).resumenOrden = ORDEN_248.slice();
    guardar(despues);
    const antes = JSON.stringify(leer());
    db.migrarMobilizeResumenOrdenComoOrlant();
    assert.equal(JSON.stringify(leer()), antes);
    // otra forma (alguien cambio el orden a mano): intacta
    const otra = leer();
    panelFlujo(otra).resumenOrden = ['contestadas', 'total'];
    guardar(otra);
    const antesOtra = JSON.stringify(leer());
    db.migrarMobilizeResumenOrdenComoOrlant();
    assert.equal(JSON.stringify(leer()), antesOtra);
  } finally {
    guardar(original);
  }
});
