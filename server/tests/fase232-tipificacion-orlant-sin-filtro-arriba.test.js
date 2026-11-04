// fase232-tipificacion-orlant-sin-filtro-arriba.test.js — Fase 232 (pedido de
// Edwin, reunion 04/11, ORLANT): pestaña Tipificacion sin la fila de filtros
// de arriba (Mes, Desde/Hasta, Linea, "Aplicar filtros") ni su nota; el mes
// sale de MESES (con meses no seguidos, suma solo esos); la Linea (General /
// 3P) pasa a los filtros de cada mitad; sin la nota "Salida de llamadas: N".
// Mobilize (sin clasificacion de asesores) conserva su fila (guardiana).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JSDIR = path.join(__dirname, '..', '..', 'public', 'js');
const JS = (f) => fs.readFileSync(path.join(JSDIR, f), 'utf8');
const L = require(path.join(JSDIR, 'tipificacion-logic.js'));

test('tramos de meses: seguidos en un solo Desde/Hasta; no seguidos, uno por tramo (sin el mes del medio)', () => {
  assert.deepEqual(L.tipificacionTramosMeses(['2026-08', '2026-09', '2026-10']), [{ desde: '2026-08-01', hasta: '2026-10-31' }]);
  assert.deepEqual(L.tipificacionTramosMeses(['2026-10', '2026-08']), [{ desde: '2026-08-01', hasta: '2026-08-31' }, { desde: '2026-10-01', hasta: '2026-10-31' }]);
  assert.deepEqual(L.tipificacionTramosMeses(['2026-12', '2027-01', '2027-03']), [{ desde: '2026-12-01', hasta: '2027-01-31' }, { desde: '2027-03-01', hasta: '2027-03-31' }]);
  assert.deepEqual(L.tipificacionTramosMeses(['2028-02']), [{ desde: '2028-02-01', hasta: '2028-02-29' }]);
  assert.deepEqual(L.tipificacionTramosMeses([]), []);
});

test('suma de /por-tipo por tramos: por tipificacion, de mayor a menor, total sumado; sin "Otras"', () => {
  const r = L.tipificacionSumarPorTipo([
    { total: 10, todas: [{ tipificacion: 'A', cantidad: 6 }, { tipificacion: 'B', cantidad: 4 }] },
    { total: 9, todas: [{ tipificacion: 'B', cantidad: 5 }, { tipificacion: 'C', cantidad: 4 }] },
  ]);
  assert.equal(r.total, 19);
  assert.deepEqual(r.todas, [{ tipificacion: 'B', cantidad: 9 }, { tipificacion: 'A', cantidad: 6 }, { tipificacion: 'C', cantidad: 4 }]);
  assert.deepEqual(L.tipificacionSumarCampos([{ canal: 'LLAMADAS', general: 2, p3: 1 }, { canal: 'LLAMADAS', general: 3, p3: 0 }], ['general', 'p3']), { canal: 'LLAMADAS', general: 5, p3: 1 });
});

// _tipificacionRenderPanel de verdad, en un sandbox. `clasif` = lo que dice
// /opciones (ORLANT true, Mobilize false). Se guarda cada pedido a la API.
async function render({ clasif, admin = true, mesesSel = [], periodos = ['2026-10', '2026-09', '2026-08'], panel = {} }) {
  const host = { innerHTML: '' };
  const pedidos = [];
  const ctx = {
    console, URLSearchParams, encodeURIComponent,
    document: { getElementById: (id) => (id === 'gd-p0' ? host : null) },
    esc: (s) => String(s == null ? '' : s),
    isFullAdmin: () => admin,
    _gd: { mesesSel, periodos },
    showToast: () => {},
    textoFormatoNombre: (s) => String(s),
    apiRequest: async (m, url) => {
      pedidos.push(url);
      if (url.includes('/opciones')) return { meses: ['2026-08', '2026-09', '2026-10'], agentes: ['ANA'], skills: ['-'], clasificacionAsesores: clasif };
      return { total: 0, todas: [] };
    },
  };
  vm.createContext(ctx);
  vm.runInContext(JS('mes-global-logic.js'), ctx);
  vm.runInContext(JS('tipificacion-logic.js'), ctx);
  vm.runInContext(JS('clasificacion-asesores-logic.js'), ctx);
  vm.runInContext('function _gdMeses(){ return (_gd && _gd.mesesSel) || []; }', ctx);
  vm.runInContext(JS('tipificacion.js'), ctx);
  vm.runInContext('var __dibujos = []; _tipificacionDibujarTodos = async function(c, i){ __dibujos.push(i); };', ctx);
  await ctx._tipificacionRenderPanel(Object.assign({ tipo: 'tipificacion_panel', campana: clasif ? 'ORLANT' : 'MOBILIZE', mostrarFiltroTipo: true }, panel), 0);
  return { html: host.innerHTML, ctx, pedidos };
}

test('ORLANT: sin la fila de arriba (Mes, Desde, Hasta, Línea, Aplicar filtros) ni su nota; botón de clasificación en la cabecera', async () => {
  const { html } = await render({ clasif: true });
  for (const fuera of ['tipif-f-mes-0"', 'tipif-f-desde-0"', 'tipif-f-hasta-0"', 'tipif-f-linea-0"', 'Aplicar filtros', 'Con una línea', 'tipif-linea-nota', 'Línea de salida']) {
    assert.ok(!html.includes(fuera), 'no debe estar: ' + fuera);
  }
  assert.match(html, /<div class="aurora-card-title tipif-cabecera">Tipificación<button type="button" class="btn-sm" onclick="tipifAbrirClasificacion\(0\)">Clasificación de asesores<\/button><\/div>/);
  // cada mitad: Agente, Skill/Cola, Entrada o salida, Línea y Aplicar
  for (const canal of ['LLAMADAS', 'WHATSAPP']) {
    for (const id of ['agente', 'skill', 'tipo', 'linea']) assert.ok(html.includes(`id="tipif-f-${id}-0-${canal}"`), canal + ' ' + id);
    assert.ok(html.includes(`_tipificacionAplicarFiltroCanal(0,'${canal}')`));
  }
  assert.match(html, /<label for="tipif-f-linea-0-LLAMADAS">Línea \(General \/ 3P\)<\/label>/);
  assert.match(html, /<option value="" selected>Todas<\/option><option value="GENERAL">Salida General<\/option>/);
  assert.match(html, />Entrada o salida</);
});

test('ORLANT: el usuario del cliente no ve el botón de clasificación', async () => {
  const { html } = await render({ clasif: true, admin: false });
  assert.ok(!html.includes('Clasificación de asesores'));
  assert.match(html, /<div class="aurora-card-title tipif-cabecera">Tipificación<\/div>/);
});

test('Mobilize (sin clasificación): conserva su fila de filtros de siempre (guardiana)', async () => {
  const { html } = await render({ clasif: false, panel: { soloCanal: 'LLAMADAS' } });
  for (const queda of ['id="tipif-f-mes-0"', 'id="tipif-f-desde-0"', 'id="tipif-f-hasta-0"', 'Aplicar filtros', '>Tipo<']) assert.ok(html.includes(queda), queda);
  assert.ok(!html.includes('tipif-f-linea'), 'Mobilize no tiene Línea');
  assert.ok(!html.includes('tipif-cabecera'));
});

test('la Línea es de cada mitad: va en la consulta de esa mitad y no en la otra', async () => {
  const { ctx } = await render({ clasif: true });
  const q = (deCanal) => ctx._tipificacionQueryString('ORLANT', 'LLAMADAS', { mes: '2026-10' }, deCanal);
  assert.match(q({ linea: '3P' }), /linea=3P/);
  assert.doesNotMatch(q({ linea: '' }), /linea=/);
  // compartido.linea ya no filtra (no hay filtro de arriba)
  assert.doesNotMatch(ctx._tipificacionQueryString('ORLANT', 'WHATSAPP', { mes: '2026-10', linea: 'GENERAL' }, {}), /linea=/);
});

test('MESES manda: un mes = ese mes; Todos = un rango; Ago + Oct = un pedido por mes y la suma (sin septiembre)', async () => {
  const { ctx } = await render({ clasif: true });
  const meses = ['2026-08', '2026-09', '2026-10'];
  const sinc = (sel) => { ctx._gd.mesesSel = sel; ctx._tipificacionSincronizarConMesGlobal(0, meses); return ctx._tipificacionEstadoCompartido[0]; };
  assert.deepEqual(JSON.parse(JSON.stringify(sinc(['2026-09']))), { mes: '2026-09', desde: '', hasta: '', linea: '', deMeses: true });
  const todos = sinc([]);
  assert.deepEqual([todos.desde, todos.hasta, todos.tramos], ['2026-08-01', '2026-10-31', undefined]);
  const dos = sinc(['2026-08', '2026-10']);
  assert.deepEqual(JSON.parse(JSON.stringify(dos.tramos)), [{ desde: '2026-08-01', hasta: '2026-08-31' }, { desde: '2026-10-01', hasta: '2026-10-31' }]);
  // la torta pide un tramo por mes y suma
  const pedidos = [];
  ctx.apiRequest = async (m, url) => {
    pedidos.push(url);
    return url.includes('desde=2026-08-01') ? { total: 5, todas: [{ tipificacion: 'AGENDA', cantidad: 5 }] } : { total: 7, todas: [{ tipificacion: 'AGENDA', cantidad: 3 }, { tipificacion: 'BUZON', cantidad: 4 }] };
  };
  const r = await ctx._tipificacionPorTipo('ORLANT', 'LLAMADAS', dos, { linea: 'GENERAL' });
  assert.equal(pedidos.length, 2);
  assert.ok(pedidos.every((u) => u.startsWith('/calidad/tipificacion/por-tipo?') && u.includes('linea=GENERAL')));
  assert.ok(!pedidos.some((u) => u.includes('2026-09')), 'septiembre no se pide');
  assert.equal(r.total, 12);
  assert.deepEqual(JSON.parse(JSON.stringify(r.todas)), [{ tipificacion: 'AGENDA', cantidad: 8 }, { tipificacion: 'BUZON', cantidad: 4 }]);
  // con meses seguidos, un solo pedido
  pedidos.length = 0;
  await ctx._tipificacionPorTipo('ORLANT', 'LLAMADAS', sinc([]), {});
  assert.equal(pedidos.length, 1);
});

test('las tarjetas por línea suman por tramos y no llevan la nota "Salida de ..."', async () => {
  const { ctx } = await render({ clasif: true });
  ctx._gd.mesesSel = ['2026-08', '2026-10'];
  ctx._tipificacionSincronizarConMesGlobal(0, ['2026-08', '2026-09', '2026-10']);
  const host = { innerHTML: '' };
  ctx.document.getElementById = (id) => (id === 'tipif-lineas-0-LLAMADAS' ? host : null);
  const pedidos = [];
  ctx.apiRequest = async (m, url) => { pedidos.push(url); return { canal: 'LLAMADAS', total: 100, salida: 10, general: 6, p3: 3, sinClasificar: 1 }; };
  const r = await ctx._tipificacionDibujarLineas('ORLANT', 0, 'LLAMADAS', ctx._tipificacionEstadoCompartido[0], { linea: '3P', tipo: 'salida' });
  assert.equal(pedidos.length, 2);
  assert.ok(pedidos.every((u) => !u.includes('linea=') && !u.includes('sentido=')), 'las tarjetas nunca se filtran por línea ni por sentido');
  assert.deepEqual([r.total, r.salida, r.general, r.p3, r.sinClasificar], [200, 20, 12, 6, 2]);
  assert.match(host.innerHTML, /tipif-linea-activa"><div class="kv">6<\/div><div class="kl">Salida 3P/);
  assert.doesNotMatch(host.innerHTML, /Salida de llamadas/);
});

test('Exportar usa los mismos meses que la pantalla (_tipificacionPorTipo)', () => {
  const g = JS('dashboard-generic.js');
  assert.match(g, /resultado = await _tipificacionPorTipo\(campana, def\.canal, compartido, deCanal\) \|\| resultado;/);
  // y en ningun filtro de ORLANT queda "Línea de salida"
  assert.ok(!JS('tipificacion.js').includes('Línea de salida'));
  assert.ok(!fs.readFileSync(path.join(__dirname, '..', 'paginas', 'guia-uso.html'), 'utf8').includes('"Línea de salida"'));
});
