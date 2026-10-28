// fase203-tarjetas-siguen-meses.test.js — Fase 203 (pedido de Edwin, audios
// del 27 y 28/10): las tarjetas de resumen obedecen SOLO a MESES. Todos =
// suma de todos los meses cargados; un mes = ese mes; varios = la suma de
// esos meses (numerador y denominador sumados), nunca un "mes actual".
// Cifras SINTETICAS con la forma de lo cargado en Mobilize.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const G = require('../../public/js/mes-global-logic.js');
const T = require('../../public/js/trafico-logic.js');
const E = require('../../public/js/encuesta-logic.js');
const C = require('../../public/js/calidad-resumen-logic.js');

const JS = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');
const PERIODOS = ['2026-10', '2026-09', '2026-08']; // como _gd.periodos (mas reciente primero)
const NOMBRE = { '2026-08': 'Agosto 2026', '2026-09': 'Septiembre 2026', '2026-10': 'Octubre 2026' };
const nombre = (m) => NOMBRE[m] || m;
// Las funciones de mes-global-logic.js leen `_gd` del sandbox: se cargan dentro.
function contexto(extra, otros) {
  const ctx = Object.assign({}, extra);
  vm.createContext(ctx);
  vm.runInContext(JS('mes-global-logic.js'), ctx);
  (otros || []).forEach((f) => vm.runInContext(JS(f), ctx));
  return ctx;
}
const plano = (o) => JSON.parse(JSON.stringify(o));
function extraer(src, firma) {
  const ini = src.indexOf(firma);
  assert.ok(ini >= 0, firma);
  const cortes = ['\nfunction ', '\nasync function ', '\nvar '].map((s) => src.indexOf(s, ini + 1)).filter((x) => x > 0);
  return src.slice(ini, cortes.length ? Math.min(...cortes) : undefined);
}

// ── Logica comun (mes-global-logic.js) ────────────────────────────────────

test('gdMesesTarjetas: Todos = todos los meses con datos; un mes; dos meses; meses sin datos se ignoran', () => {
  assert.deepEqual(G.gdMesesTarjetas([], PERIODOS), ['2026-08', '2026-09', '2026-10']);
  assert.deepEqual(G.gdMesesTarjetas(['2026-09'], PERIODOS), ['2026-09']);
  assert.deepEqual(G.gdMesesTarjetas(['2026-10', '2026-08'], PERIODOS), ['2026-08', '2026-10']);
  assert.deepEqual(G.gdMesesTarjetas(['2026-07'], PERIODOS), ['2026-08', '2026-09', '2026-10'], 'un mes sin datos no deja las tarjetas vacias');
  assert.deepEqual(G.gdMesesTarjetas([], []), []);
});

test('gdRangoDeMeses y gdMesesTarjetasTexto: rango que cubre los meses y el texto del subtitulo', () => {
  assert.deepEqual(G.gdRangoDeMeses(['2026-10', '2026-08']), { desde: '2026-08-01', hasta: '2026-10-31' });
  assert.deepEqual(G.gdRangoDeMeses(['2026-09']), { desde: '2026-09-01', hasta: '2026-09-30' });
  assert.deepEqual(G.gdRangoDeMeses([]), { desde: '', hasta: '' });
  assert.equal(G.gdMesesTarjetasTexto(['2026-08', '2026-09', '2026-10'], true, nombre), 'Todos los meses (Ago 2026 – Oct 2026)');
  assert.equal(G.gdMesesTarjetasTexto(['2026-09'], false, nombre), 'Septiembre 2026');
  assert.equal(G.gdMesesTarjetasTexto(['2026-08', '2026-10'], false, nombre), 'Ago 2026, Oct 2026');
  assert.equal(G.gdMesesTarjetasTexto([], true, nombre), 'Sin datos');
});

test('gdSumarMeses: suma solo los meses pedidos; un null deja el campo en null (Pendiente)', () => {
  const porMes = [
    { periodo: '2026-08', total: 30, noConectadas: null },
    { periodo: '2026-09', total: 64, noConectadas: 15 },
    { periodo: '2026-10', total: 86, noConectadas: 41 },
  ];
  const todos = G.gdSumarMeses(porMes, (m) => m.periodo, ['2026-08', '2026-09', '2026-10'], ['total', 'noConectadas']);
  assert.deepEqual(todos, { filas: 3, total: 180, noConectadas: null });
  assert.deepEqual(G.gdSumarMeses(porMes, (m) => m.periodo, ['2026-09'], ['total', 'noConectadas']), { filas: 1, total: 64, noConectadas: 15 });
  assert.deepEqual(G.gdSumarMeses(porMes, (m) => m.periodo, ['2026-09', '2026-10'], ['total', 'noConectadas']), { filas: 2, total: 150, noConectadas: 56 });
});

// ── Flujo de Llamadas: rango Desde/Hasta y tarjetas ───────────────────────

test('traficoDecidirRango con MESES: Todos = todo lo cargado; un mes = ese mes; dos meses = del primero al ultimo', () => {
  const base = { minDisp: '2026-08-11', maxDisp: '2026-10-23', estadoURL: {}, tieneDatosMes: true };
  const todos = T.traficoDecidirRango(Object.assign({}, base, { meses: ['2026-08', '2026-09', '2026-10'], todos: true }));
  assert.deepEqual([todos.estado.desde, todos.estado.hasta, todos.clave, todos.sinDatosMes], ['2026-08-11', '2026-10-31', 'todos', false]);
  const uno = T.traficoDecidirRango(Object.assign({}, base, { meses: ['2026-09'], todos: false }));
  assert.deepEqual([uno.estado.desde, uno.estado.hasta, uno.clave], ['2026-09-01', '2026-09-30', '2026-09']);
  const dos = T.traficoDecidirRango(Object.assign({}, base, { meses: ['2026-10', '2026-08'], todos: false }));
  assert.deepEqual([dos.estado.desde, dos.estado.hasta, dos.clave], ['2026-08-01', '2026-10-31', '2026-08,2026-10']);
  // Un rango puesto a mano se respeta mientras MESES no cambie.
  const mano = T.traficoDecidirRango(Object.assign({}, base, { meses: ['2026-09'], todos: false, mesSincronizado: '2026-09', estadoPrevio: { desde: '2026-09-10', hasta: '2026-09-20' } }));
  assert.deepEqual([mano.estado.desde, mano.estado.hasta, mano.sincronizar], ['2026-09-10', '2026-09-20', false]);
  // Meses marcados sin filas de trafico: aviso, no los datos de otro mes.
  assert.equal(T.traficoDecidirRango(Object.assign({}, base, { meses: ['2026-07'], todos: false, tieneDatosMes: false })).sinDatosMes, true);
});

test('Flujo de Llamadas: las tarjetas suman las filas de los meses de MESES (Ago + Oct no cuenta septiembre)', () => {
  const src = JS('trafico.js');
  assert.match(src, /var mesesTarj = _gdMeses\(\)\.length \? gdMesesTarjetasActual\(\) : null;/);
  assert.match(src, /var tot = _traficoTotalesLlamadas\(filasTarj\);/);
  assert.match(src, /meses: mesesT,\n    todos: !_gdMeses\(\)\.length,/, 'el rango arranca con MESES');
  assert.doesNotMatch(extraer(src, 'async function _traficoRenderPanel'), /_gd\.mesSel/);
  const filas = [
    { fecha: '2026-08-11', totalLlamadas: 67, contestadas: 64, llamadasAbandonadas: 3 },
    { fecha: '2026-09-15', totalLlamadas: 104, contestadas: 104, llamadasAbandonadas: 0 },
    { fecha: '2026-10-20', totalLlamadas: 106, contestadas: 104, llamadasAbandonadas: 2 },
  ];
  const ctx = Object.assign({}, T, G);
  vm.createContext(ctx);
  vm.runInContext(extraer(src, 'function _traficoTotalesLlamadas(filas)'), ctx);
  const tarjetas = (sel) => ctx._traficoTotalesLlamadas(sel.length ? G.gdFiltrarPorMes(filas, (f) => f.fecha, sel) : filas);
  const todos = tarjetas([]);
  assert.deepEqual([todos.total, todos.contestadas, todos.abandonadas, todos.nivelAtencion], [277, 272, 5, 98.2]);
  const sep = tarjetas(['2026-09']);
  assert.deepEqual([sep.total, sep.contestadas, sep.abandonadas, sep.nivelAtencion], [104, 104, 0, 100]);
  const agoOct = tarjetas(['2026-08', '2026-10']);
  assert.deepEqual([agoOct.total, agoOct.contestadas, agoOct.abandonadas], [173, 168, 5]);
  assert.equal(agoOct.nivelAtencion, 97.1, '168 / 173, no el promedio de 95,5 % y 98,1 %');
});

// ── FCR / One & Done ──────────────────────────────────────────────────────

const ENC = [
  { periodo: '2026-08', base: 'empezaron', si: 5, total: 21, respondieron: 6, empezaron: 6, den: 6, pct: 83.3 },
  { periodo: '2026-09', base: 'empezaron', si: 3, total: 45, respondieron: 5, empezaron: 5, den: 5, pct: 60 },
  { periodo: '2026-10', base: 'empezaron', si: 19, total: 82, respondieron: 28, empezaron: 28, den: 28, pct: 67.9 },
];

test('encuestaFcrTarjetaMeses: Todos 27/39, un mes 3/5, dos meses 24/34 (si y den sumados)', () => {
  const todos = E.encuestaFcrTarjetaMeses(ENC, ['2026-08', '2026-09', '2026-10']);
  assert.deepEqual([todos.si, todos.den, todos.pct, todos.porMes.length], [27, 39, 69.2, 3]);
  const sep = E.encuestaFcrTarjetaMeses(ENC, ['2026-09']);
  assert.deepEqual([sep.si, sep.den, sep.pct], [3, 5, 60]);
  const agoOct = E.encuestaFcrTarjetaMeses(ENC, ['2026-08', '2026-10']);
  assert.deepEqual([agoOct.si, agoOct.den, agoOct.pct], [24, 34, 70.6]);
  assert.deepEqual(agoOct.porMes.map((m) => m.periodo), ['2026-08', '2026-10']);
  assert.equal(E.encuestaFcrTarjetaMeses(ENC, ['2026-07']).sinEncuestas, true);
});

async function dibujarFcr(mesesSel, desde, hasta) {
  const el = { 'tv-kpis-0': { innerHTML: '' } };
  el['tv-kpis-0'].insertAdjacentHTML = () => { el['tv-fcr-0'] = { innerHTML: '' }; };
  const ctx = contexto({
    _gd: { mesesSel, periodos: PERIODOS },
    document: { getElementById: (id) => el[id] || null },
    apiRequest: async () => ENC,
    esc: (s) => String(s),
    mesNombreLargo: nombre,
  }, ['encuesta-logic.js', 'encuesta.js']);
  await ctx._encuestaDibujarFcr(0, 'MOBILIZE', desde, hasta, 'empezaron');
  return el['tv-fcr-0'].innerHTML.replace(/<span title="[^"]*"[^>]*>\?<\/span>/, '');
}

test('Vista FCR: Todos suma los tres meses; un mes; Ago + Oct no cuenta septiembre aunque este en el rango', async () => {
  const todos = await dibujarFcr([], '2026-08-11', '2026-10-23');
  assert.match(todos, /<div class="kv">69,2 %<\/div>/);
  assert.match(todos, /Todos los meses \(Ago 2026 – Oct 2026\): 27 de 39 que contestaron la pregunta 1/);
  assert.match(todos, />Por mes: Ago 2026 83,3 % · Sep 2026 60 % · Oct 2026 67,9 %</); // compacto en la tarjeta
  assert.match(todos, /title="Agosto 2026 83,3 % \(5 de 6 que contestaron la pregunta 1\) · Septiembre 2026 60 %/);
  assert.doesNotMatch(todos, /Otros meses/);
  const sep = await dibujarFcr(['2026-09'], '2026-09-01', '2026-09-30');
  assert.match(sep, /<div class="kv">60 %<\/div>/);
  assert.match(sep, /Septiembre 2026: 3 de 5 que contestaron la pregunta 1/);
  assert.doesNotMatch(sep, /Por mes/);
  const agoOct = await dibujarFcr(['2026-08', '2026-10'], '2026-08-01', '2026-10-31');
  assert.match(agoOct, /<div class="kv">70,6 %<\/div>/);
  assert.match(agoOct, /Ago 2026, Oct 2026: 24 de 34/);
  assert.doesNotMatch(agoOct, /Septiembre/);
});

test('One & Done y Eficacia: barras, tarjeta y desglose solo con los meses de MESES; nada lee el MES', () => {
  const enc = JS('encuesta.js');
  const oad = extraer(enc, 'async function _encuestaDibujarOneAndDone');
  assert.match(oad, /var mesesT = _encuestaMesesTarjeta\(desde, hasta, porMes\);/);
  assert.match(oad, /var t = encuestaFcrTarjetaMeses\(porMes, mesesT\);/);
  assert.doesNotMatch(enc, /encuestaFcrTarjeta\(porMes, mesFin\)|_gd\.mesSel/);
  const ef = JS('eficacia.js');
  assert.match(ef, /meses = gdAplicarFiltroMeses\(meses, function \(m\) \{ return m\.periodo; \}\);/);
  assert.match(ef, /suma\.positivas \/ suma\.contestadas/);
  assert.doesNotMatch(ef, /mesFin/);
});

// ── Llamadas Unicas y de Salida ───────────────────────────────────────────

test('Llamadas Unicas y de Salida: Todos = resumen del servidor; meses marcados = suma de esos meses; Pendiente se conserva', () => {
  const src = JS('llamadas-unicas.js');
  const ctx = contexto({ _gd: { mesesSel: [], periodos: PERIODOS } });
  vm.runInContext(extraer(src, 'function _llamadasResumenMeses'), ctx);
  const servidor = { total: 208, contestadas: 204, abandonadas: 4 };
  const porMes = [
    { periodo: '2026-08', total: 60, contestadas: 59, abandonadas: 1 },
    { periodo: '2026-09', total: 84, contestadas: 83, abandonadas: 1 },
    { periodo: '2026-10', total: 64, contestadas: 62, abandonadas: 2 },
  ];
  const campos = ['total', 'contestadas', 'abandonadas'];
  assert.deepEqual(ctx._llamadasResumenMeses(servidor, porMes, campos), servidor, 'Todos: todo lo cargado');
  ctx._gd.mesesSel = ['2026-09'];
  assert.deepEqual(plano(ctx._llamadasResumenMeses(servidor, porMes.filter((m) => m.periodo === '2026-09'), campos)), { total: 84, contestadas: 83, abandonadas: 1 });
  ctx._gd.mesesSel = ['2026-08', '2026-10'];
  const dos = porMes.filter((m) => m.periodo !== '2026-09');
  assert.deepEqual(plano(ctx._llamadasResumenMeses(servidor, dos, campos)), { total: 124, contestadas: 121, abandonadas: 3 });
  const salida = ctx._llamadasResumenMeses({ total: 320, noConectadas: 184, conectadas: 136, noConectadasPendiente: false },
    [{ periodo: '2026-08', total: null, noConectadas: null, conectadas: 27 }, { periodo: '2026-10', total: 86, noConectadas: 41, conectadas: 45 }],
    ['total', 'noConectadas', 'conectadas']);
  assert.deepEqual(plano(salida), { total: null, noConectadas: null, conectadas: 72, noConectadasPendiente: true });
  assert.equal((src.match(/resumen = _llamadasResumenMeses\(resumen, porMes,/g) || []).length, 2, 'Unicas y Salida');
});

// ── Calidad ───────────────────────────────────────────────────────────────

const CAL = [
  { mes: '2026-08', monitoreos: 11, promedio: 98, fallos: 0, asesores: [{ agente: 'ASESOR A', monitoreos: 6, puntaje: 98, fallos: 0, clasificacion: 'Sobresaliente', alerta: 'Sin fallos críticos' }, { agente: 'ASESOR B', monitoreos: 5, puntaje: 98, fallos: 0, clasificacion: 'Sobresaliente', alerta: 'Sin fallos críticos' }] },
  { mes: '2026-09', monitoreos: 34, promedio: 97.35, fallos: 2, asesores: [{ agente: 'ASESOR A', monitoreos: 34, puntaje: 97.35, fallos: 2, clasificacion: 'Sobresaliente', alerta: 'Crítico frecuente' }] },
  { mes: '2026-10', monitoreos: 27, promedio: 97.22, fallos: 2, asesores: [{ agente: 'ASESOR B', monitoreos: 27, puntaje: 97.22, fallos: 1, clasificacion: 'Sobresaliente', alerta: 'Alerta' }, { agente: 'ASESOR C', monitoreos: 0, puntaje: null, fallos: 1, clasificacion: null, alerta: 'Alerta' }] },
];

test('calidadResumenSumarMeses: Todos 72 monitoreos / 4 fallos / promedio ponderado; un mes tal cual; dos meses', () => {
  const todos = C.calidadResumenSumarMeses(CAL, ['2026-08', '2026-09', '2026-10']);
  assert.deepEqual([todos.monitoreos, todos.fallos], [72, 4]);
  assert.equal(Math.round(todos.promedio * 100) / 100, 97.4, '(98·11 + 97,35·34 + 97,22·27) / 72');
  const a = todos.asesores.find((x) => x.agente === 'ASESOR A');
  assert.deepEqual([a.monitoreos, a.fallos, a.alerta], [40, 2, 'Crítico frecuente']);
  const sep = C.calidadResumenSumarMeses(CAL, ['2026-09']);
  assert.deepEqual([sep.monitoreos, sep.promedio, sep.fallos, sep.meses], [34, 97.35, 2, ['2026-09']]);
  const agoOct = C.calidadResumenSumarMeses(CAL, ['2026-08', '2026-10']);
  assert.deepEqual([agoOct.monitoreos, agoOct.fallos], [38, 2]);
  assert.equal(Math.round(agoOct.promedio * 100) / 100, 97.45);
  assert.equal(C.calidadResumenSumarMeses(CAL, ['2026-07']), null);
});

test('Calidad: el panel y su exportacion usan los meses de MESES, nunca _gd.mesSel', () => {
  const src = JS('calidad-resumen.js');
  assert.match(src, /var delMes = calidadResumenSumarMeses\(datos\.meses \|\| \[\], mesesT\);/);
  assert.match(src, /Promedio general · '\+esc\(lblMes\)/);
  assert.doesNotMatch(src, /_gd\.mesSel/);
});

// ── Tipificacion, Encuesta y Flujo por hora ───────────────────────────────

test('Tipificacion: un mes = ese mes; varios/Todos = Desde/Hasta; las tarjetas de salida suman mes a mes', async () => {
  const src = JS('tipificacion.js');
  const pedidos = [];
  const ctx = contexto({
    _gd: { mesesSel: [], periodos: PERIODOS },
    URLSearchParams,
    apiRequest: async (m, url) => { pedidos.push(url); const mes = /mes=(\d{4}-\d{2})/.exec(url); return { '2026-09': { total: 64, conectadas: 49, noConectadas: 15 }, '2026-10': { total: 45, conectadas: 28, noConectadas: 17 }, '2026-08': { total: 30, conectadas: 20, noConectadas: 10 } }[mes && mes[1]] || { total: 139, conectadas: 97, noConectadas: 42 }; },
  });
  vm.runInContext('var _tipificacionEstadoCompartido = {}; var _tipificacionMesSincronizado = {}; var _tipificacionSinDatosMesGlobal = {};\n' +
    extraer(JS('dashboard-generic.js'), 'function _gdMeses()') + '\n' +
    src.slice(src.indexOf('// Fase 203: el filtro del panel sigue a MESES'), src.indexOf('var TIPIFICACION_CANALES')) +
    extraer(src, 'function _tipificacionQueryStringSalida'), ctx);
  const meses = ['2026-08', '2026-09', '2026-10'];
  assert.equal(ctx._tipificacionSincronizarConMesGlobal(0, meses), false);
  assert.deepEqual([ctx._tipificacionEstadoCompartido[0].desde, ctx._tipificacionEstadoCompartido[0].hasta], ['2026-08-01', '2026-10-31'], 'Todos');
  const r = await ctx._tipificacionResumenSalidaMeses(0, 'MOBILIZE', ctx._tipificacionEstadoCompartido[0], {});
  assert.deepEqual([r.total, r.conectadas, r.noConectadas], [139, 97, 42]);
  ctx._gd.mesesSel = ['2026-09'];
  ctx._tipificacionSincronizarConMesGlobal(0, meses);
  assert.deepEqual([ctx._tipificacionEstadoCompartido[0].mes, ctx._tipificacionEstadoCompartido[0].desde], ['2026-09', '']);
  ctx._gd.mesesSel = ['2026-08', '2026-10'];
  ctx._tipificacionSincronizarConMesGlobal(0, meses);
  pedidos.length = 0;
  const dos = await ctx._tipificacionResumenSalidaMeses(0, 'MOBILIZE', ctx._tipificacionEstadoCompartido[0], {});
  assert.deepEqual([dos.total, dos.conectadas, dos.noConectadas], [75, 48, 27], 'agosto + octubre, sin septiembre');
  assert.equal(pedidos.length, 2);
  // Julio tiene otros datos (esta en MESES) pero no tipificacion: aviso.
  ctx._gd.periodos = ['2026-10', '2026-09', '2026-08', '2026-07'];
  ctx._gd.mesesSel = ['2026-07'];
  assert.equal(ctx._tipificacionSincronizarConMesGlobal(0, meses), true, 'mes sin tipificacion: aviso');
});

test('Flujo por hora: una tabla por cada mes de MESES con datos (Todos = todos); Encuesta sin el MES', () => {
  const src = JS('flujo-hora.js');
  const ctx = contexto({ _gd: { mesesSel: [] } });
  vm.runInContext(extraer(src, 'function _flujoHoraMeses'), ctx);
  assert.deepEqual(Array.from(ctx._flujoHoraMeses(['2026-09', '2026-10'])), ['2026-10', '2026-09']);
  ctx._gd.mesesSel = ['2026-09'];
  assert.deepEqual(Array.from(ctx._flujoHoraMeses(['2026-09', '2026-10'])), ['2026-09']);
  ctx._gd.mesesSel = ['2026-08', '2026-10'];
  assert.deepEqual(Array.from(ctx._flujoHoraMeses(['2026-09', '2026-10'])), ['2026-10']);
  assert.doesNotMatch(src, /_gd\.mesSel/);
});

test('Subtitulo "Informe ...": dice los meses de MESES, nunca el mes por defecto', () => {
  const dg = JS('dashboard-generic.js');
  const els = { 'gd-sub': { innerHTML: '' } };
  const ctx = contexto({
    _gd: { mesSel: '2026-10', mesesSel: [], periodos: PERIODOS, cliente: 'MOBILIZE' },
    document: { getElementById: (id) => els[id] || null },
    mesNombreLargo: nombre,
    esc: (s) => String(s),
    gdHoyLocal: () => '2026-10-28',
    _gdFiltrosHeaderTexto: () => {},
  });
  ctx.gdHoyLocal = () => '2026-10-28'; // despues de cargar mes-global-logic.js (que la define)
  vm.runInContext(extraer(dg, 'function _gdMeses()') + '\n' + extraer(dg, 'function _gdPintarSubtitulo()'), ctx);
  ctx._gdPintarSubtitulo();
  assert.match(els['gd-sub'].innerHTML, /^Informe Todos los meses \(Ago 2026 – Oct 2026\)/);
  // Fase 207: octubre (en curso) esta entre los meses -> "Oct 2026 parcial".
  assert.match(els['gd-sub'].innerHTML, /^Informe Todos los meses \(Ago 2026 – Oct 2026\) — Oct 2026 parcial</);
  ctx._gd.mesesSel = ['2026-09'];
  ctx._gdPintarSubtitulo();
  assert.match(els['gd-sub'].innerHTML, /^Informe Septiembre 2026</);
  ctx._gd.mesesSel = ['2026-10'];
  ctx._gdPintarSubtitulo();
  assert.match(els['gd-sub'].innerHTML, /^Informe Octubre 2026 — mes en curso, parcial/);
  ctx._gd.mesesSel = ['2026-08', '2026-09'];
  ctx._gdPintarSubtitulo();
  assert.match(els['gd-sub'].innerHTML, /^Informe Ago 2026, Sep 2026</);
});

// ── Encuesta: parametro `meses` (Ago + Oct sin septiembre) ────────────────

test('Encuesta: `meses` valida AAAA-MM separados por coma y el SQL cuenta solo esos meses', () => {
  const { schemas } = require('../validation');
  const ok = (q) => schemas.encuestasFiltrosQuery.safeParse(Object.assign({ campana: 'MOBILIZE' }, q)).success;
  assert.equal(ok({ meses: '2026-08,2026-10' }), true);
  assert.equal(ok({ meses: '2026-13' }), false);
  assert.equal(ok({ meses: "2026-08') OR 1=1 --" }), false);
  assert.equal(ok({}), true);
  const Database = require('better-sqlite3');
  const mem = new Database(':memory:');
  mem.exec("CREATE TABLE encuestas (id INTEGER PRIMARY KEY, campana TEXT, fecha TEXT, agente TEXT DEFAULT '', skill TEXT DEFAULT '', q1 INTEGER, q2 INTEGER, q3 INTEGER, q4 INTEGER, comentario TEXT DEFAULT '', connId TEXT DEFAULT '')");
  const ins = mem.prepare('INSERT INTO encuestas (campana, fecha, q1, q3) VALUES (?, ?, ?, ?)');
  [['2026-08-12', 9, 1], ['2026-09-03', 8, 2], ['2026-09-20', 10, 1], ['2026-10-05', 7, 1]].forEach((f) => ins.run('MOBILIZE', f[0], f[1], f[2]));
  const { encuestasResumen, encuestasFcrPorMes } = require('../encuestas');
  assert.equal(encuestasResumen(mem, { campana: 'MOBILIZE', desde: '2026-08-01', hasta: '2026-10-31' }).total, 4);
  assert.equal(encuestasResumen(mem, { campana: 'MOBILIZE', desde: '2026-08-01', hasta: '2026-10-31', meses: '2026-08,2026-10' }).total, 2);
  assert.deepEqual(encuestasFcrPorMes(mem, { campana: 'MOBILIZE', meses: '2026-08,2026-10', base: 'empezaron' }).map((m) => m.periodo), ['2026-08', '2026-10']);
  mem.close();
  const src = JS('encuesta.js');
  assert.match(src, /estado\.meses = mesesT\.length > 1 \? mesesT\.join\(','\) : '';/);
  assert.match(src, /\(e\.meses \? '&meses=' \+ encodeURIComponent\(e\.meses\) : ''\)/);
});
