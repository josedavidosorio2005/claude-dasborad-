// fase246-orden-tarjetas-llamadas.test.js — Fase 246 (pedido de Edwin, 04/11):
// en Trafico de Llamadas > Flujo de Llamadas, la fila de tarjetas queda
//   Ingresadas, Contestadas, Abandonadas, Nivel de servicio (20 s),
//   Nivel de atencion, Tasa de abandono.
// Aplica a los paneles de Llamadas sin `resumenOrden` propio (ORLANT, Aurora,
// HLM). Mobilize ya tiene Nivel de servicio antes de Nivel de atencion (Fase
// 227) y no cambia. Trafico de WhatsApp no cambia.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS = path.join(__dirname, '..', '..', 'public', 'js');
const { traficoOrdenTarjetas, TRAFICO_ORDEN_TARJETAS, TRAFICO_ORDEN_TARJETAS_LLAMADAS } = require(path.join(JS, 'trafico-logic.js'));
const seed = require('../dashboard-config-seed');
const plantillas = require('../plantillas-cliente');

const ORDEN_MOBILIZE = ['total', 'contestadas', 'nivelServicio', 'tasaAbandono', 'eficacia', 'abandonadas', 'nivelAtencion'];

function extraer(src, firma) {
  const ini = src.indexOf(firma);
  assert.ok(ini >= 0, firma);
  return src.slice(ini, src.indexOf('\n}\n', ini) + 2);
}

// _traficoDibujarKpis (trafico.js) en un sandbox con sus dependencias reales.
function titulosCon(orden) {
  const el = { innerHTML: '' };
  const ctx = {
    document: { getElementById: (id) => (id === 'tv-kpis-0' ? el : null) },
    esc: (s) => String(s == null ? '' : s),
    traficoOrdenTarjetas,
    _gdUmbralPara: () => null,
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(JS, 'kpi-tarjeta-logic.js'), 'utf8'), ctx);
  vm.runInContext(extraer(fs.readFileSync(path.join(JS, 'trafico.js'), 'utf8'), 'function _traficoDibujarKpis('), ctx);
  ctx._traficoDibujarKpis('tv', 0,
    { total: 1000, contestadas: 950, abandonadas: 50, nivelAtencion: 95, tasaAbandono: 5, nivelServicio: 88.4 },
    { total: 'Llamadas ingresadas', contestadas: 'Llamadas contestadas', abandonadas: 'Llamadas abandonadas', nivelServicioLabel: 'Nivel de servicio (20 s)', nivelServicioMetrica: 'service_level' },
    'ORLANT', null, { orden });
  return [...el.innerHTML.matchAll(/<div class="kl">([^<]+)/g)].map((m) => m[1].trim());
}

test('Llamadas: Nivel de servicio (20 s) antes de Nivel de atención, el resto igual', () => {
  assert.deepEqual(TRAFICO_ORDEN_TARJETAS_LLAMADAS, ['total', 'contestadas', 'abandonadas', 'nivelServicio', 'nivelAtencion', 'tasaAbandono']);
  assert.deepEqual(traficoOrdenTarjetas(TRAFICO_ORDEN_TARJETAS_LLAMADAS, false), TRAFICO_ORDEN_TARJETAS_LLAMADAS);
  assert.deepEqual(titulosCon(TRAFICO_ORDEN_TARJETAS_LLAMADAS), [
    'Llamadas ingresadas', 'Llamadas contestadas', 'Llamadas abandonadas',
    'Nivel de servicio (20 s)', 'Nivel de atención', 'Tasa de abandono',
  ]);
});

test('Tráfico de Llamadas usa ese orden solo si el panel no trae el suyo', () => {
  const src = fs.readFileSync(path.join(JS, 'trafico.js'), 'utf8');
  assert.match(src, /contextoKpis\.orden = pCfgKpis\.resumenOrden \|\| TRAFICO_ORDEN_TARJETAS_LLAMADAS;/);
});

test('Tráfico de WhatsApp no cambia: sin orden, el de siempre', () => {
  assert.deepEqual(TRAFICO_ORDEN_TARJETAS, ['total', 'contestadas', 'abandonadas', 'nivelAtencion', 'tasaAbandono', 'nivelServicio']);
  const wpp = fs.readFileSync(path.join(JS, 'trafico-whatsapp.js'), 'utf8');
  assert.doesNotMatch(wpp, /TRAFICO_ORDEN_TARJETAS_LLAMADAS|contextoKpis\.orden/);
  assert.deepEqual(titulosCon(undefined), [
    'Llamadas ingresadas', 'Llamadas contestadas', 'Llamadas abandonadas',
    'Nivel de atención', 'Tasa de abandono', 'Nivel de servicio (20 s)',
  ]);
});

test('Mobilize no cambia y ya cumple el criterio (Nivel de servicio antes de Nivel de atención)', () => {
  const ordenes = [];
  const buscar = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o.resumenOrden)) ordenes.push(o.resumenOrden);
    Object.values(o).forEach(buscar);
  };
  buscar(seed);
  buscar(plantillas);
  assert.ok(ordenes.length >= 1);
  ordenes.forEach((o) => {
    assert.deepEqual(o, ORDEN_MOBILIZE);
    assert.ok(o.indexOf('nivelServicio') < o.indexOf('nivelAtencion'));
  });
});
