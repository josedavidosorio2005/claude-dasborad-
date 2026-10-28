// fase209-flujo-hora-consolidado.test.js — Fase 209 (Mobilize, pedido de
// Edwin): Flujo por hora con UNA tabla por metrica que suma los meses de
// MESES (Todos = todos los cargados; un mes = solo ese mes), el titulo con los
// meses elegidos, y la escala de color de Abandonadas en rojo (Ingresadas y
// Contestadas sin cambio). Reemplaza "una tabla por mes" de la Fase 207 solo
// en este panel.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('../../public/js/flujo-hora-logic.js');

const JS = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');
const CSS = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'css', 'styles.css'), 'utf8');
const NOMBRE = { '2026-08': 'Agosto 2026', '2026-09': 'Septiembre 2026', '2026-10': 'Octubre 2026' };

// Datos por mes como los devuelve GET /calidad/flujo-hora/mes (sumados por dia + hora).
const DATOS = {
  '2026-08': [{ dia: '2026-08-31', hora: 8, ingresadas: 4, contestadas: 3, abandonadas: 1 }],
  '2026-09': [{ dia: '2026-09-05', hora: 8, ingresadas: 6, contestadas: 5, abandonadas: 1 },
    { dia: '2026-09-05', hora: 14, ingresadas: 2, contestadas: 2, abandonadas: 0 }],
  '2026-10': [{ dia: '2026-10-05', hora: 8, ingresadas: 10, contestadas: 7, abandonadas: 3 }],
};

function panel(mesesSel) {
  const host = { innerHTML: '', dataset: {} };
  const pedidos = [];
  const ctx = {
    console,
    esc: (s) => String(s),
    _gd: { cliente: 'MOBILIZE', mesesSel },
    document: { getElementById: () => host },
    mesNombreLargo: (m) => NOMBRE[m] || m,
    gdGraficaHtml: (t, cuerpo) => '<h3>' + t + '</h3>' + cuerpo,
    showToast: () => {},
    canLoadData: () => false,
    _gdAvisoSinDatosMesHtml: () => 'AVISO',
    apiRequest: async (metodo, url) => {
      if (url.includes('/opciones')) return { meses: ['2026-08', '2026-09', '2026-10'], skills: [] };
      const mes = /mes=([0-9-]+)/.exec(url)[1];
      pedidos.push(mes);
      return DATOS[mes];
    },
  };
  vm.createContext(ctx);
  vm.runInContext(JS('mes-global-logic.js') + '\n' + JS('flujo-hora-logic.js') + '\n' + JS('flujo-hora.js'), ctx);
  return { ctx, host, pedidos };
}
const tarjetas = (html) => html.match(/class="aurora-card fh-card"/g) || [];
const titulos = (html) => [...html.matchAll(/<h3>([^<]+) <span class="fh-total-titulo">\(([\d.]+)\)<\/span><\/h3>/g)].map((m) => [m[1], m[2]]);

test('matriz consolidada: el dia N suma el dia N de cada mes; columnas hasta el mes mas largo', () => {
  const filas = [].concat(DATOS['2026-09'], DATOS['2026-10'], DATOS['2026-08']);
  const m = L.flujoHoraMatrizMeses(filas, ['2026-09', '2026-10', '2026-08'], 'ingresadas');
  assert.equal(m.dias.length, 31, 'agosto y octubre tienen 31 dias');
  assert.deepEqual(m.horas, [8, 14]);
  assert.equal(m.celdas[8][5], 16, '5 de septiembre (6) + 5 de octubre (10)');
  assert.equal(m.celdas[8][31], 4);
  assert.equal(m.total, 22);
  assert.equal(m.max, 16);
  assert.equal(L.flujoHoraMatrizMeses(filas, ['2026-09'], 'ingresadas').dias.length, 30, 'solo septiembre: 30 dias');
  assert.equal(L.flujoHoraMatrizMeses(filas, ['2026-10'], 'abandonadas').total, 3, 'filas de otros meses no entran');
  assert.deepEqual(JSON.parse(JSON.stringify(L.flujoHoraMatriz(filas, '2026-10', 'ingresadas'))),
    JSON.parse(JSON.stringify(L.flujoHoraMatrizMeses(filas, ['2026-10'], 'ingresadas'))), 'la de un mes es la consolidada con ese mes');
});

test('Todos: UNA tabla por metrica con todos los meses sumados y el titulo con los meses', async () => {
  const { ctx, host, pedidos } = panel([]);
  await ctx._flujoHoraRenderPanel({ tipo: 'flujo_hora_panel', campana: 'MOBILIZE' }, 0);
  assert.equal(tarjetas(host.innerHTML).length, 3, 'una por metrica, no una por mes');
  assert.deepEqual(pedidos.sort(), ['2026-08', '2026-09', '2026-10']);
  assert.deepEqual(titulos(host.innerHTML), [
    ['Ingresadas — Ago 2026, Sep 2026, Oct 2026', '22'],
    ['Contestadas — Ago 2026, Sep 2026, Oct 2026', '17'],
    ['Abandonadas — Ago 2026, Sep 2026, Oct 2026', '5'],
  ]);
  assert.match(host.innerHTML, /cada día suma ese día de todos los meses/);
  assert.match(host.innerHTML, /data-meses="2026-08,2026-09,2026-10"/);
});

test('un mes marcado: solo ese mes; dos meses: su suma', async () => {
  const uno = panel(['2026-10']);
  await uno.ctx._flujoHoraRenderPanel({ campana: 'MOBILIZE' }, 0);
  assert.deepEqual(titulos(uno.host.innerHTML).map((t) => t.join(' ')), ['Ingresadas — Octubre 2026 10', 'Contestadas — Octubre 2026 7', 'Abandonadas — Octubre 2026 3']);
  assert.doesNotMatch(uno.host.innerHTML, /cada día suma/, 'con un mes no hace falta la nota');
  const dos = panel(['2026-08', '2026-09']);
  await dos.ctx._flujoHoraRenderPanel({ campana: 'MOBILIZE' }, 0);
  assert.deepEqual(titulos(dos.host.innerHTML).map((t) => t[1]), ['12', '10', '2']);
  assert.equal(tarjetas(dos.host.innerHTML).length, 3);
});

test('exportar: una tabla por metrica con los meses sumados', async () => {
  const { ctx } = panel([]);
  const out = await ctx._gdExportarFlujoHora({ campana: 'MOBILIZE' });
  assert.equal(out.length, 3);
  assert.equal(out[0].titulo, 'Flujo por hora — Ingresadas — Ago 2026, Sep 2026, Oct 2026');
  assert.equal(out[2].filas[out[2].filas.length - 1].Total, 5);
});

test('Abandonadas en escala roja; Ingresadas y Contestadas sin cambio; contraste >= 4.5', () => {
  const ab = L.FLUJO_HORA_METRICAS.filter((m) => m.escala === 'rojo').map((m) => m.key);
  assert.deepEqual(ab, ['abandonadas']);
  const ctx = { esc: (s) => String(s), console };
  vm.createContext(ctx);
  vm.runInContext(JS('flujo-hora-logic.js') + '\n' + JS('flujo-hora.js'), ctx);
  const m = L.flujoHoraMatriz(DATOS['2026-10'], '2026-10', 'abandonadas');
  assert.match(ctx._flujoHoraTablaHtml(m, L.FLUJO_HORA_METRICAS[2]), /class="aurora-table fh-tabla fh-escala-rojo"/);
  assert.match(ctx._flujoHoraTablaHtml(m, L.FLUJO_HORA_METRICAS[0]), /class="aurora-table fh-tabla"/);
  assert.match(CSS, /\.fh-escala-rojo \.fh-celda\.fh-alto,\.fh-muestra\.fh-rojo-alto\{background:var\(--c-calor-rojo-alto\)/);
  assert.match(CSS, /\.fh-escala-rojo \.fh-celda\.fh-medio,\.fh-muestra\.fh-rojo-medio\{background:var\(--c-calor-rojo-medio\)/);
  assert.match(CSS, /--c-calor-alto:#74B859;/, 'el verde de Ingresadas/Contestadas sigue igual');
  const C = require('../../public/js/contraste-logic.js');
  for (const [bg, tx] of [['#C0392B', '#FFFFFF'], ['#F08A78', '#4A0D06'], ['#B3362A', '#FFFFFF'], ['#6E2A24', '#FFD9D4']]) {
    assert.ok(C.contrasteRazon(bg, tx) >= 4.5, bg + ' / ' + tx);
    assert.ok(CSS.includes(bg) && CSS.includes(tx), 'el token existe: ' + bg);
  }
  assert.match(ctx._flujoHoraLeyendaHtml(), /Abandonadas:<\/span> <span class="fh-muestra fh-rojo-alto">/);
});

test('celular/tablet: el encabezado del dia 1 no queda blanco sobre blanco ni pegado', () => {
  assert.match(CSS, /\.gd-tabla-scroll \.fh-tabla thead tr:nth-child\(2\) th:first-child\{position:static;background:var\(--c-brand\);/);
});
