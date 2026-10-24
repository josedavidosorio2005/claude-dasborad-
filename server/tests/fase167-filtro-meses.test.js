// fase167-filtro-meses.test.js — Fase 167 (pedido de Edwin): filtro "Meses"
// del tablero para ver varios meses SUELTOS lado a lado (ej. septiembre y
// octubre, sin agosto) en las graficas y tablas que van por mes. Decision del
// usuario (23/10/2026): no suma meses ni cambia el MES de arriba -- las
// tarjetas y la comparacion siguen igual. Cubre la regla pura, el control
// del encabezado (accesible, Escape no cierra el tablero), la serie generica
// (el incremento se sigue midiendo contra el mes anterior real) y que cada
// modulo filtra SOLO su serie por mes, nunca sus tarjetas. Todo SINTETICO.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('../../public/js/mes-global-logic.js');

const JS = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');
const NOMBRE = { '2026-08': 'Agosto 2026', '2026-09': 'Septiembre 2026', '2026-10': 'Octubre 2026' };

// Fuente de una funcion de nivel superior (hasta su llave de cierre).
function extraer(src, firma) {
  const i = src.indexOf(firma);
  assert.ok(i !== -1, 'no esta: ' + firma);
  let prof = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') prof++;
    if (src[k] === '}' && --prof === 0) return src.slice(i, k + 1);
  }
  throw new Error('sin cierre: ' + firma);
}

// ── Regla pura ────────────────────────────────────────────────────────────

test('gdFiltrarPorMes: solo los meses elegidos (AAAA-MM o AAAA-MM-DD); sin eleccion, todo igual', () => {
  const filas = [{ m: '2026-08' }, { m: '2026-09' }, { m: '2026-09-15' }, { m: '2026-10' }, { m: null }];
  assert.deepEqual(L.gdFiltrarPorMes(filas, (x) => x.m, ['2026-09', '2026-10']).map((x) => x.m), ['2026-09', '2026-09-15', '2026-10']);
  assert.equal(L.gdFiltrarPorMes(filas, (x) => x.m, []), filas, 'vacio = todos (la misma lista)');
  assert.equal(L.gdFiltrarPorMes(filas, (x) => x.m, null), filas);
  assert.deepEqual(L.gdFiltrarPorMes(null, (x) => x.m, ['2026-09']), []);
});

test('gdMesesTexto: "Todos" o los meses elegidos en orden y cortos', () => {
  assert.equal(L.gdMesesTexto([], (m) => NOMBRE[m]), 'Todos');
  assert.equal(L.gdMesesTexto(['2026-10', '2026-09'], (m) => NOMBRE[m]), 'Sep 2026, Oct 2026');
});

test('gdAplicarFiltroMeses lee _gd.mesesSel del tablero abierto; sin tablero, la lista tal cual', () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(JS('mes-global-logic.js'), ctx);
  const lista = [{ mes: '2026-08' }, { mes: '2026-09' }, { mes: '2026-10' }];
  assert.equal(ctx.gdAplicarFiltroMeses(lista, (x) => x.mes), lista);
  ctx._gd = { mesesSel: ['2026-09', '2026-10'] };
  assert.deepEqual(ctx.gdAplicarFiltroMeses(lista, (x) => x.mes).map((x) => x.mes), ['2026-09', '2026-10']);
});

// ── Control del encabezado ────────────────────────────────────────────────

test('index.html: control "MESES" junto al MES, con ayuda y "Ver todos los meses"', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  const i = html.indexOf('id="gd-mes-sel"');
  const j = html.indexOf('id="gd-meses-wrap"');
  const k = html.indexOf('id="gd-comp-wrap"');
  assert.ok(i < j && j < k, 'entre MES y COMPARAR CONTRA');
  assert.match(html, /<summary id="gd-meses-btn" class="gd-meses-btn" aria-describedby="gd-meses-ayuda">Todos<\/summary>/);
  assert.match(html, /<div class="gd-meses-pop" role="group" aria-labelledby="gd-meses-label">/);
  assert.match(html, /Las tarjetas siguen el MES de la izquierda\./);
  assert.match(html, /onclick="gdMesesTodos\(\)">Ver todos los meses<\/button>/);
});

test('dashboard-generic.js: marcar un mes no redibuja la lista (el foco sigue en la casilla) y Escape cierra SOLO la lista', () => {
  const src = JS('dashboard-generic.js');
  assert.doesNotMatch(extraer(src, 'function onGdMesesChange()'), /_gdPintarMeses\(\)/, 'no redibuja la lista al marcar');
  assert.match(extraer(src, 'function onGdMesesChange()'), /_gdMesesBoton\(\);\s*renderGenericTab\(_gd\.tab\);/);
  // Escape en fase de captura: llega antes que el de los modales (motion-helpers.js).
  assert.match(src, /if\(e\.key !== 'Escape' \|\| !det \|\| !det\.open\) return;\s*e\.stopPropagation\(\);[\s\S]*?\}, true\);/);
  assert.match(extraer(src, 'async function _gdBootstrap()'), /_gd\.mesesSel = \[\];/, 'cada tablero abre con todos los meses');
  assert.doesNotMatch(extraer(src, 'function onGdMesesChange()'), /renderGenericKpis/, 'las tarjetas de arriba no cambian');
});

test('_gdPintarMeses: una casilla por mes (del mas nuevo al mas viejo), marca los elegidos y descarta meses que ya no existen', () => {
  const src = JS('dashboard-generic.js');
  const el = {};
  const ctx = {
    _gd: { periodos: ['2026-10', '2026-09', '2026-08'], mesesSel: ['2026-09', '2025-01'] }, // como gdMesesUnion: del mas nuevo al mas viejo
    document: { getElementById: (id) => (el[id] = el[id] || { id, innerHTML: '', textContent: '', classList: { toggle: (c, v) => { el[id].activo = v; } } }) },
    esc: (s) => String(s), mesNombreLargo: (m) => NOMBRE[m] || m,
    gdMesesTexto: L.gdMesesTexto,
    _gdFiltrosHeaderTexto: () => {}, // Fase 175: texto del boton "Filtros" (probado en fase175-tablero-celular)
  };
  vm.createContext(ctx);
  vm.runInContext(['function _gdMeses()', 'function _gdPintarMeses()', 'function _gdMesesBoton()'].map((f) => extraer(src, f)).join('\n'), ctx);
  ctx._gdPintarMeses();
  const lista = el['gd-meses-lista'].innerHTML;
  assert.deepEqual([...lista.matchAll(/value="([\d-]+)"/g)].map((m) => m[1]), ['2026-10', '2026-09', '2026-08']);
  assert.match(lista, /value="2026-09" checked onchange="onGdMesesChange\(\)"> Septiembre 2026/);
  assert.deepEqual(ctx._gd.mesesSel, ['2026-09'], 'el mes que ya no existe se descarta');
  assert.equal(el['gd-meses-btn'].textContent, 'Sep 2026');
  assert.equal(el['gd-meses-wrap'].activo, true);
});

// ── Serie generica: incremento antes de filtrar ───────────────────────────

test('serie generica (_gdResolver): filtra los meses DESPUES del incremento, que se mide contra el mes anterior real', () => {
  const src = JS('dashboard-generic.js');
  const ctx = {
    _gd: { mesSel: '2026-10', mesesSel: ['2026-08', '2026-10'] },
    _gdVistaFiltro: () => null,
    _gdSeccionCargas: () => [{ periodo: '2026-08', v: 100 }, { periodo: '2026-09', v: 200 }, { periodo: '2026-10', v: 300 }],
    _gdMesLargo: (p) => NOMBRE[p], _gdPickFila: (f) => f, _gdEvalCampo: (_, f) => null, _gdNum: (v) => Number(v),
    gdFiltrarPorMes: L.gdFiltrarPorMes,
  };
  ctx._gdSeccionCargas = () => [{ periodo: '2026-08', filas: 100 }, { periodo: '2026-09', filas: 200 }, { periodo: '2026-10', filas: 300 }];
  ctx._gdPickFila = (f) => f;
  ctx._gdEvalCampo = (fila) => fila;
  vm.createContext(ctx);
  vm.runInContext(extraer(src, 'function _gdMeses()') + '\n' + extraer(src, 'function _gdResolver(f, extra)'), ctx);
  const r = ctx._gdResolver({ modo: 'serie', s: 'x' });
  assert.deepEqual(Array.from(r.labels), ['Agosto 2026', 'Octubre 2026']);
  assert.deepEqual(Array.from(r.values), [100, 300]);
  const inc = ctx._gdResolver({ modo: 'serie', s: 'x', transform: 'incremento' });
  assert.deepEqual(Array.from(inc.values), [null, 50], 'octubre +50 % contra SEPTIEMBRE (no contra agosto)');
  ctx._gd.mesesSel = [];
  assert.equal(ctx._gdResolver({ modo: 'serie', s: 'x' }).labels.length, 3, 'sin eleccion: todos los meses');
});

// ── Cada modulo filtra solo su serie por mes ──────────────────────────────

test('_traficoFiltroMeses (Trafico de Llamadas y WhatsApp): por dia y por mes filtra; por año no aplica', () => {
  const ctx = { _gd: { mesesSel: ['2026-07', '2026-09'] } };
  vm.createContext(ctx);
  vm.runInContext(JS('mes-global-logic.js') + '\n' + extraer(JS('trafico.js'), 'function _traficoFiltroMeses(agregado, granularidad)'), ctx);
  const porMes = [{ periodo: '2026-07' }, { periodo: '2026-08' }, { periodo: '2026-09' }];
  assert.deepEqual(ctx._traficoFiltroMeses(porMes, 'mes').map((a) => a.periodo), ['2026-07', '2026-09']);
  const porDia = [{ periodo: '2026-07-01' }, { periodo: '2026-08-15' }, { periodo: '2026-09-12' }];
  assert.deepEqual(ctx._traficoFiltroMeses(porDia, 'dia').map((a) => a.periodo), ['2026-07-01', '2026-09-12']);
  const porAnio = [{ periodo: '2026' }];
  assert.equal(ctx._traficoFiltroMeses(porAnio, 'anio'), porAnio);
});

test('los modulos filtran SOLO la serie por mes (graficas/tablas/export), nunca las tarjetas', () => {
  const t = JS('trafico.js');
  assert.match(t, /var agregado = _traficoFiltroMeses\(traficoAgregar\(filtradas,/);
  assert.match(t, /var tot = _traficoTotalesLlamadas\(filtradas\);/, 'tarjetas desde las filas, no del agregado filtrado');
  assert.match(t, /var agregadoComb = estado\.combinar \? agregado : _traficoFiltroMeses\(traficoAgregar\(/);
  const w = JS('trafico-whatsapp.js');
  assert.match(w, /var agregado = _traficoFiltroMeses\(traficoWppAgregarPorPeriodo\(filtradas,/);
  assert.match(w, /var agregadoComb = estado\.combinar \? agregado : _traficoFiltroMeses\(traficoWppAgregarPorPeriodo\(/);
  assert.match(w, /var totalWpp = filtradas\.reduce/);
  const s = extraer(JS('salida.js'), 'async function _salDibujar(campana, i, opciones)');
  assert.match(s, /var filasMeses = \(typeof gdAplicarFiltroMeses === 'function' \? gdAplicarFiltroMeses\(filas, function\(f\)\{ return f\.mes; \}\) : filas\);/);
  assert.match(s, /_salDibujarGrafica\('sal-llam-'\+i, filasMeses,/);
  assert.match(s, /_salTablaHtml\(filasMeses, mesSel\)/);
  assert.match(s, /var idx = filas\.map\(function\(f\)\{ return f\.mes; \}\)\.indexOf\(mesSel\);/, 'tarjetas con todas las filas');
  const ina = extraer(JS('inasistencia.js'), 'async function _inasistenciaDibujarPorMes(campana, i, opciones)');
  assert.match(ina, /_inasistenciaDibujarLineaPorMes\('inasist-c-pormes-'\+i, agregadoMeses,/);
  assert.match(ina, /_inasistenciaTablaHtml\(agregadoMeses,/);
  assert.match(ina, /var ponderado = inasistenciaPonderadoTotal\(agregado\);/, 'tarjeta del rango sin filtrar');
  const ec = extraer(JS('efectividad-citas.js'), 'async function _ecDibujar(campana, i, opciones)');
  assert.match(ec, /_ecDibujarGrafica\(i, filasMeses\);/);
  assert.match(ec, /var ponderado = citasAtendidasPonderado\(filas\);/);
  const ag = JS('agendas.js');
  assert.equal((ag.match(/datos = \(typeof gdAplicarFiltroMeses === 'function' \? gdAplicarFiltroMeses\(datos, function\(r\)\{ return r\.mes; \}\) : datos\); \/\/ Fase 167/g) || []).length, 2, 'Agendas por mes y por linea');
  const lu = JS('llamadas-unicas.js');
  assert.equal((lu.match(/porMes = \(typeof gdAplicarFiltroMeses === 'function' \? gdAplicarFiltroMeses\(porMes, function \(m\) \{ return m\.periodo; \}\) : porMes\);/g) || []).length, 2, 'Unicas y Salida de Mobilize');
  assert.match(JS('whatsapp-tiempos.js'), /resumen\.porMes = \(typeof gdAplicarFiltroMeses === 'function' \? gdAplicarFiltroMeses\(resumen\.porMes,/);
});

test('mes-global-logic.js se carga antes que los modulos que lo usan', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  const pos = (f) => html.indexOf('js/' + f);
  for (const f of ['dashboard-generic.js', 'trafico.js', 'trafico-whatsapp.js', 'salida.js', 'inasistencia.js', 'efectividad-citas.js', 'agendas.js', 'llamadas-unicas.js', 'whatsapp-tiempos.js']) {
    assert.ok(pos('mes-global-logic.js') !== -1 && pos('mes-global-logic.js') < pos(f), f);
  }
});
