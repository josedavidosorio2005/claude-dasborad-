// fase244-abandono-etiquetas.test.js — Fase 244 (pedido de Edwin, 04/11):
// en Abandono (Tráfico de Llamadas y de WhatsApp, todos los clientes), CADA
// barra muestra la cantidad y el % de abandono; antes las etiquetas de la
// barra y de la línea chocaban y el plugin ('auto') dejaba solo la última.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS = path.join(__dirname, '..', '..', 'public', 'js');
const L = require(path.join(JS, 'trafico-logic.js'));

const AGREGADO = [
  { periodo: 'Ago 2026', llamadasAbandonadas: 3, tasaAbandonoPct: 4.48, totalLlamadas: 67 },
  { periodo: 'Sep 2026', llamadasAbandonadas: 0, tasaAbandonoPct: 0, totalLlamadas: 104 },
  { periodo: 'Oct 2026', llamadasAbandonadas: 1234, tasaAbandonoPct: 1.9, totalLlamadas: 106 },
  { periodo: 'Nov 2026', llamadasAbandonadas: null, tasaAbandonoPct: null, totalLlamadas: 0 },
];

test('etiqueta de cada barra: cantidad y % (es-CO); sin dato, vacía', () => {
  const et = L.traficoAbandonoEtiquetaBarra(AGREGADO);
  assert.deepEqual(et(0), ['3', '4,5 %']);
  assert.deepEqual(et(1), ['0', '0 %'], 'una barra en 0 también se rotula');
  assert.deepEqual(et(2), ['1.234', '1,9 %']);
  assert.equal(et(3), '');
  assert.equal(L.TRAFICO_ABANDONO_ETIQUETAS_MAX, 12);
});

function dibujar(agregado) {
  let cfg = null;
  const ctx = {
    colorSerie: () => '#000', loBar: () => ({ plugins: { datalabels: { display: true } }, layout: { padding: { top: 20 } } }),
    loDatalabelsAuto: (o, f) => { o.plugins.datalabels.display = 'auto'; o.plugins.datalabels.formatter = f; },
    gdFmtValor: (v) => String(v), CHART_GRID: '#eee', agregarLineaMeta: () => {}, _traficoUmbral: () => null,
    _gdChart: (id, c) => { cfg = c; },
    traficoAbandonoEtiquetaBarra: L.traficoAbandonoEtiquetaBarra, TRAFICO_ABANDONO_ETIQUETAS_MAX: L.TRAFICO_ABANDONO_ETIQUETAS_MAX,
  };
  vm.createContext(ctx);
  const src = fs.readFileSync(path.join(JS, 'trafico.js'), 'utf8');
  const i = src.indexOf('function _traficoDibujarAbandono(');
  vm.runInContext(src.slice(i, src.indexOf('\n}\n', i) + 2), ctx);
  ctx._traficoDibujarAbandono('tww', 0, agregado, 'ORLANT');
  return cfg;
}

test('la gráfica: barras siempre rotuladas (cantidad y %), la línea sin etiqueta propia', () => {
  const cfg = dibujar(AGREGADO.slice(0, 3));
  const [barra, linea] = cfg.data.datasets;
  assert.equal(barra.datalabels.display({ dataIndex: 0 }), true);
  assert.equal(dibujar(AGREGADO).data.datasets[0].datalabels.display({ dataIndex: 3 }), false, 'sin dato: sin cajita vacía');
  assert.deepEqual(barra.datalabels.formatter(3, { dataIndex: 0 }), ['3', '4,5 %']);
  assert.equal(linea.datalabels.display, false);
  assert.equal(cfg.options.layout.padding.top, 36);
});

test('con muchas barras (vista por día) vuelve a "auto" para que no se monten', () => {
  const dias = Array.from({ length: 31 }, (_, k) => ({ periodo: String(k + 1), llamadasAbandonadas: k, tasaAbandonoPct: 1, totalLlamadas: 100 }));
  assert.equal(dibujar(dias).data.datasets[0].datalabels.display({ dataIndex: 5 }), 'auto');
});

test('la misma función dibuja Llamadas y WhatsApp', () => {
  assert.match(fs.readFileSync(path.join(JS, 'trafico.js'), 'utf8'), /_traficoDibujarAbandono\('tv', i, agregadoComb, campana\);/);
  assert.match(fs.readFileSync(path.join(JS, 'trafico-whatsapp.js'), 'utf8'), /_traficoDibujarAbandono\('tww', i, agregadoComb, campana\);/);
});
