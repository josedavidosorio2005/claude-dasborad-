// fase207-meses-todas-campanas.test.js — Fase 207 (OK del usuario): la regla
// de MESES de Mobilize (Fase 203) en TODAS las campañas, en el codigo comun.
// Al entrar = todos los meses cargados; 1 mes = ese mes; varios = suma de
// los marcados; los porcentajes salen de los totales sumados; el subtitulo
// dice los meses. Incluye la GUARDIA: falla si un modulo vuelve a leer un
// "mes de las tarjetas" o si se agrega un tipo de panel que no sigue a MESES.
// Datos SINTETICOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const G = require('../../public/js/mes-global-logic.js');

const PUB = path.join(__dirname, '..', '..', 'public', 'js');
const JS = (f) => fs.readFileSync(path.join(PUB, f), 'utf8');
const sinComentarios = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|[^:'"\\])\/\/.*$/, '$1')).join('\n');
const PERIODOS = ['2026-10', '2026-09', '2026-08'];
function contexto(extra) {
  const ctx = Object.assign({}, extra);
  vm.createContext(ctx);
  vm.runInContext(JS('mes-global-logic.js'), ctx);
  vm.runInContext('function _gdMeses(){ return (_gd && _gd.mesesSel) || []; }', ctx);
  return ctx;
}
const plano = (o) => JSON.parse(JSON.stringify(o));
function extraer(src, firma) {
  const ini = src.indexOf(firma);
  assert.ok(ini >= 0, firma);
  const cortes = ['\nfunction ', '\nasync function ', '\nvar '].map((s) => src.indexOf(s, ini + 1)).filter((x) => x > 0);
  return src.slice(ini, Math.min(...cortes));
}

// ── GUARDIA ───────────────────────────────────────────────────────────────

test('GUARDIA: ningun modulo lee un "mes de las tarjetas" (_gd.mesSel) ni elige el "ultimo mes" por defecto', () => {
  const archivos = fs.readdirSync(PUB).filter((f) => f.endsWith('.js'));
  for (const f of archivos) {
    const src = sinComentarios(JS(f));
    assert.doesNotMatch(src, /_gd\.mesSel\b/, f + ' vuelve a leer _gd.mesSel: use gdMesesTarjetasActual()');
    if (f !== 'mes-global-logic.js') {
      assert.doesNotMatch(src, /gdMesDeMeses\(/, f + ' usa gdMesDeMeses (ultimo mes marcado): use gdMesesTarjetasActual()');
    }
    // El mes por defecto (mas reciente con datos) se calcula una sola vez y no lo lee ninguna tarjeta.
    if (f === 'dashboard-generic.js') {
      assert.equal((src.match(/gdMesPorDefecto\(/g) || []).length, 1, 'gdMesPorDefecto solo en el arranque');
      assert.equal((src.match(/_gd\.mesDefecto/g) || []).length, 2, '_gd.mesDefecto: se asigna y se limpia, nadie lo lee');
    } else if (f !== 'mes-global-logic.js') {
      assert.doesNotMatch(src, /gdMesPorDefecto\(|_gd\.mesDefecto/, f + ' usa el mes por defecto');
    }
  }
});

test('GUARDIA: todo tipo de panel que dibuja el tablero esta en la lista cerrada de los que siguen a MESES', () => {
  const gd = JS('dashboard-generic.js');
  const render = extraer(gd, 'function _gdRenderPanel(p, i)');
  const tipos = Array.from(new Set((gd.match(/p\.tipo === '([a-z_]+)'/g) || []).map((x) => x.slice(12, -1))));
  assert.ok(tipos.length >= 20);
  tipos.forEach((t) => assert.ok(G.GD_TIPOS_SIGUEN_MESES.includes(t), 'tipo de panel "' + t + '" sin declarar en GD_TIPOS_SIGUEN_MESES (mes-global-logic.js)'));
  assert.match(render, /trafico_combo/);
  // Los modulos de panel leen los meses de MESES por el codigo comun.
  for (const f of ['trafico.js', 'trafico-whatsapp.js', 'agendas.js', 'efectividad-agendamiento.js', 'efectividad-citas.js', 'inasistencia.js', 'salida.js', 'whatsapp-tiempos.js', 'tipificacion.js', 'encuesta.js', 'calidad-resumen.js', 'flujo-hora.js']) {
    assert.match(JS(f), /gdMesesTarjetasActual\(\)|gdMesesTarjetas\(|_gdMeses\(\)/, f + ' no lee MESES');
  }
});

// ── Codigo comun ──────────────────────────────────────────────────────────

test('gdMesUnicoMarcado y gdRotuloParcialMeses: comparar solo con un mes; "parcial" si el mes en curso esta entre los meses', () => {
  assert.equal(G.gdMesUnicoMarcado(['2026-09']), '2026-09');
  assert.equal(G.gdMesUnicoMarcado([]), '');
  assert.equal(G.gdMesUnicoMarcado(['2026-08', '2026-09']), '');
  const n = (m) => ({ '2026-10': 'Octubre 2026', '2026-09': 'Septiembre 2026' })[m];
  assert.equal(G.gdRotuloParcialMeses(['2026-10'], '2026-10-28', n), 'Octubre 2026 — mes en curso, parcial');
  assert.equal(G.gdRotuloParcialMeses(['2026-09', '2026-10'], '2026-10-28', n), 'Oct 2026 parcial');
  assert.equal(G.gdRotuloParcialMeses(['2026-08', '2026-09'], '2026-10-28', n), '');
});

test('fuentes genericas (cargas): un mes = esa carga; varios = suma; formula con terminos sumados; % sin formula pide un solo mes', () => {
  const cargas = [
    { periodo: '2026-08', filas: [{ llamadas: 100, contestadas: 90, pct: 90, cat: 'A' }, { llamadas: 10, contestadas: 5, pct: 50, cat: 'B' }] },
    { periodo: '2026-09', filas: [{ llamadas: 200, contestadas: 150, pct: 75, cat: 'A' }] },
    { periodo: '2026-10', filas: [{ llamadas: 300, contestadas: 270, pct: 90, cat: 'B' }] },
  ];
  const gd = JS('dashboard-generic.js');
  const ctx = contexto({ _gd: { mesesSel: [], periodos: PERIODOS, cargas: { resumen: cargas }, config: {} } });
  vm.runInContext(['function _gdNum', 'function _gdUp', 'function _gdSeccionCargas', 'function _gdCargasDeMeses', 'function _gdCargaMes', 'var GD_FORMATOS_SUMABLES', 'function _gdSumarCargas', 'function _gdVistaFiltro', 'function _gdFilaMatch', 'function _gdPickFila', 'function _gdEvalCampo', 'function _gdResolverComp', 'function _gdResolver(']
    .map((f) => extraer(gd, f)).join('\n') + '\nfunction _gdMesLargo(p){ return p; } function _gdDiaLbl(f){ return f; } function gdAnioDeMes(m){ return m ? m.slice(0,4) : null; } function gdCargasDelAnio(c){ return c; }', ctx);
  const ult = (campo, extra) => ({ s: 'resumen', modo: 'ultimo', campo, ...(extra || {}) });
  // Todos: suma de los 3 meses (fila elegida = la primera de cada carga).
  assert.equal(ctx._gdResolver(ult('llamadas'), { formato: 'entero' }).scalar, 600);
  assert.equal(ctx._gdResolver({ s: 'resumen', modo: 'ultimo', formula: 'a/b*100', a: 'contestadas', b: 'llamadas' }, { formato: 'porcentaje' }).scalar, 85, '(90+150+270)/600');
  const pct = ctx._gdResolver(ult('pct'), { formato: 'porcentaje' });
  assert.equal(pct.scalar, null);
  assert.equal(pct.unMes, true, 'un % sin formula no se promedia: pide un solo mes');
  // Un mes: esa carga tal cual (tambien el %).
  ctx._gd.mesesSel = ['2026-09'];
  assert.equal(ctx._gdResolver(ult('llamadas'), { formato: 'entero' }).scalar, 200);
  assert.equal(ctx._gdResolver(ult('pct'), { formato: 'porcentaje' }).scalar, 75);
  // Dos meses (Ago + Oct): sin septiembre.
  ctx._gd.mesesSel = ['2026-08', '2026-10'];
  assert.equal(ctx._gdResolver(ult('llamadas'), { formato: 'entero' }).scalar, 400);
  // Filas por categoria de varias cargas: agrupadas y sumadas.
  const filas = plano(ctx._gdResolver({ s: 'resumen', modo: 'filas', x: 'cat', campo: 'llamadas' }));
  assert.deepEqual(filas, { labels: ['A', 'B'], values: [100, 310] });
  // Comparar contra: solo con UN mes marcado.
  assert.equal(ctx._gdResolverComp(ult('llamadas')).scalar, null);
  ctx._gd.mesesSel = ['2026-09'];
  assert.equal(ctx._gdResolverComp(ult('llamadas')).scalar, 100, 'septiembre contra agosto');
});

test('tablero: Comparar contra se oculta con Todos o varios meses; subtitulo y nombre del archivo con los meses de MESES', () => {
  const gd = JS('dashboard-generic.js');
  assert.match(extraer(gd, 'function _gdActualizarCompararContra()'), /var sinComparar = todosAutonomos \|\| !gdMesUnicoMarcado\(\);/);
  assert.match(extraer(gd, 'function _gdPintarCompararContra()'), /var verMes = gdMesUnicoMarcado\(\);/);
  const ctx = contexto({ _gd: { mesesSel: [], periodos: PERIODOS } });
  vm.runInContext(extraer(gd, 'var _GD_MESES') + extraer(gd, 'function _gdMesesLblExport()') + extraer(gd, 'function _gdMesLbl(p)'), ctx);
  assert.equal(ctx._gdMesesLblExport(), 'Ago-26_a_Oct-26');
  ctx._gd.mesesSel = ['2026-09'];
  assert.equal(ctx._gdMesesLblExport(), 'Sep-26');
});

// ── Pantallas de ORLANT (y de cualquier campaña con esos paneles) ─────────

test('Efectividad de Agendamiento: el servidor suma gestiones y agendas por asesor en los meses de MESES y recalcula el puesto', () => {
  const Database = require('better-sqlite3');
  const { efectividadAgendamientoRanking } = require('../efectividad-agendamiento');
  const mem = new Database(':memory:');
  mem.exec('CREATE TABLE efectividad_agendamiento (campana TEXT, mes TEXT, asesor TEXT, gestiones INTEGER, agendas INTEGER)');
  const ins = mem.prepare('INSERT INTO efectividad_agendamiento VALUES (?, ?, ?, ?, ?)');
  [['2026-08', 'A', 100, 50], ['2026-08', 'B', 100, 40], ['2026-09', 'A', 100, 10], ['2026-09', 'B', 100, 60], ['2026-10', 'A', 50, 25]].forEach((f) => ins.run('ORLANT', ...f));
  const uno = efectividadAgendamientoRanking(mem, { campana: 'ORLANT', mes: '2026-09' });
  assert.deepEqual(uno.filas.map((f) => [f.puesto, f.asesor]), [[1, 'B'], [2, 'A']]);
  const dos = efectividadAgendamientoRanking(mem, { campana: 'ORLANT', meses: '2026-08,2026-09' });
  assert.deepEqual(dos.filas.map((f) => [f.puesto, f.asesor, f.gestiones, f.agendas]), [[1, 'B', 200, 100], [2, 'A', 200, 60]]);
  assert.equal(dos.equipo.efectividad, 160 / 400, 'ponderada: agendas / gestiones sumadas');
  mem.close();
  const { schemas } = require('../validation');
  assert.equal(schemas.efectividadAgendamientoRankingQuery.safeParse({ campana: 'ORLANT', meses: '2026-08,2026-10' }).success, true);
  assert.equal(schemas.efectividadAgendamientoRankingQuery.safeParse({ campana: 'ORLANT' }).success, false, 'mes o meses requerido');
  assert.match(JS('efectividad-agendamiento.js'), /'&meses='\+encodeURIComponent\(mesesEa\.join\(','\)\)/);
});

test('Inasistencia: el servidor suma los meses de MESES; una sola tarjeta ponderada; "Por especialidad" con la base baja sobre la suma', () => {
  const Database = require('better-sqlite3');
  const { inasistenciaPorEspecialidad } = require('../inasistencia');
  const mem = new Database(':memory:');
  mem.exec('CREATE TABLE inasistencias (campana TEXT, mes TEXT, sede TEXT, especialidad TEXT, entidad TEXT, cancelada INTEGER, inasistencia INTEGER, pendiente INTEGER, atendidas INTEGER, total INTEGER)');
  const ins = mem.prepare("INSERT INTO inasistencias VALUES ('ORLANT', ?, 'S', ?, 'E', 0, ?, ?, 0, ?)");
  [['2026-08', 'X', 5, 1, 100], ['2026-09', 'X', 10, 0, 100], ['2026-10', 'X', 1, 1, 50]].forEach((f) => ins.run(...f));
  const dos = inasistenciaPorEspecialidad(mem, { campana: 'ORLANT', meses: '2026-08,2026-10' });
  assert.deepEqual(plano(dos).map((f) => [f.especialidad, f.inasistencia, f.pendiente, f.total]), [['X', 6, 2, 150]]);
  mem.close();
  const ina = JS('inasistencia.js');
  assert.match(ina, /var agregadoTarj = agregado\.filter\(function\(a\)\{ return mesesIna\.indexOf\(a\.mes\) !== -1; \}\);/);
  assert.match(ina, /params\.set\('meses', mesesEsp\.join\(','\)\);/);
  assert.equal((ina.match(/_inasistenciaTarjetaHtml\('% de inasistencia · '/g) || []).length, 1, 'una sola tarjeta');
});

test('Efectividad de Citas: UNA tarjeta, % ponderado de los meses de MESES', () => {
  const ec = JS('efectividad-citas.js');
  assert.match(ec, /var filasEc = filas\.filter\(function\(f\)\{ return mesesEc\.indexOf\(f\.mes\) !== -1; \}\);/);
  assert.equal((ec.match(/aurora-kpi gd-kpi/g) || []).length, 1, 'una sola tarjeta');
  const L = require('../../public/js/citas-atendidas-logic.js');
  const filas = [{ mes: '2026-08', agendas: 100, atendidas: 70 }, { mes: '2026-09', agendas: 200, atendidas: 150 }, { mes: '2026-10', agendas: 100, atendidas: 80 }];
  const pond = (meses) => L.citasAtendidasPonderado(filas.filter((f) => meses.includes(f.mes))).pct;
  assert.equal(pond(['2026-08', '2026-09', '2026-10']), 300 / 400);
  assert.equal(pond(['2026-09']), 0.75);
  assert.equal(pond(['2026-08', '2026-10']), 150 / 200, 'Ago + Oct sin septiembre; nunca promedio de 70 % y 80 %... (aqui coincide en 75 %)');
});

test('Agendas: el servidor recibe los meses de MESES (un rango por mes) y el panel los manda', () => {
  const { schemas } = require('../validation');
  assert.equal(schemas.agendasFiltrosQuery.safeParse({ campana: 'ORLANT', meses: '2026-08,2026-10' }).success, true);
  const ag = fs.readFileSync(path.join(__dirname, '..', 'agendas.js'), 'utf8');
  assert.match(ag, /\} else if \(incluirMes && q\.meses\) \{/);
  const { agendasWhereClausulas } = (() => { const m = require('../agendas'); return m; })();
  if (typeof agendasWhereClausulas === 'function') {
    const w = agendasWhereClausulas({ campana: 'ORLANT', meses: '2026-08,2026-10' }, true);
    assert.match(w.where, /\(\(fechaSolicitud >= @mesDesde0 AND fechaSolicitud <= @mesHasta0\) OR \(fechaSolicitud >= @mesDesde1 AND fechaSolicitud <= @mesHasta1\)\)/);
  }
  const pa = JS('agendas.js');
  assert.match(pa, /else if\(incluirMes && filtros\.meses && filtros\.meses\.length\) params\.set\('meses', filtros\.meses\.join\(','\)\);/);
  assert.match(pa, /else _agendasEstado\[campana\] = \{ mes: '', meses: meses \};/);
});

test('WhatsApp por rangos: el servidor suma los meses de MESES', () => {
  const Database = require('better-sqlite3');
  const W = require('../whatsapp-tiempos');
  const mem = new Database(':memory:');
  mem.exec('CREATE TABLE whatsapp_tiempos (campana TEXT, fecha TEXT, skill TEXT, segundos INTEGER, minutos REAL, tiempoRespuesta REAL, espera REAL)');
  const cols = mem.prepare('PRAGMA table_info(whatsapp_tiempos)').all().map((c) => c.name);
  assert.ok(cols.includes('fecha'));
  const { schemas } = require('../validation');
  assert.equal(schemas.whatsappTiemposRangosQuery.safeParse({ campana: 'ORLANT', meses: '2026-08,2026-10' }).success, true);
  assert.equal(schemas.whatsappTiemposRangosQuery.safeParse({ campana: 'ORLANT' }).success, false);
  const src = fs.readFileSync(path.join(__dirname, '..', 'whatsapp-tiempos.js'), 'utf8');
  assert.match(src, /return 'substr\(fecha,1,7\) IN \(' \+ lista\.map\(\(m, k\) => '@mes' \+ k\)\.join\(', '\) \+ '\)';/);
  assert.equal(typeof W.whatsappTiemposRangos, 'function');
  mem.close();
  assert.match(JS('whatsapp-tiempos.js'), /'&meses=' \+ encodeURIComponent\(estado\.meses\.join\(','\)\)/);
});

test('Salida (ORLANT): las tarjetas suman los meses de MESES; "vs. mes anterior" solo con un mes', () => {
  const s = JS('salida.js');
  const L = require('../../public/js/salida-logic.js');
  const ctx = contexto(Object.assign({}, L, { _gd: { mesesSel: [], periodos: PERIODOS } }));
  const filas = [{ mes: '2026-08', llamadas3p: 10, llamadasGeneral: 20, llamadasSinAsignar: 0, wpp3p: 1, wppGeneral: 2, wppSinAsignar: 0 },
    { mes: '2026-09', llamadas3p: 30, llamadasGeneral: 40, llamadasSinAsignar: 5, wpp3p: 3, wppGeneral: 4, wppSinAsignar: 0 },
    { mes: '2026-10', llamadas3p: 50, llamadasGeneral: 60, llamadasSinAsignar: 0, wpp3p: 5, wppGeneral: 6, wppSinAsignar: 1 }];
  const suma = (meses, linea) => filas.filter((f) => meses.includes(f.mes)).reduce((a, f) => a + L.salidaValorLinea(f, 'llamadas', linea), 0);
  assert.equal(suma(['2026-08', '2026-09', '2026-10'], 'TOTAL'), 215);
  assert.equal(suma(['2026-09'], 'TOTAL'), 75);
  assert.equal(suma(['2026-08', '2026-10'], '3P'), 60);
  assert.match(s, /var delMeses = filas\.filter\(function\(f\)\{ return meses\.indexOf\(f\.mes\) !== -1; \}\);/);
  assert.match(s, /variacion: unico \? kpiVariacion\(totalLlam, totalLlamAnt, optsSal\) : null/);
  assert.ok(ctx);
});

test('Tráfico de WhatsApp: el rango arranca con MESES (Todos = todo lo cargado) y las tarjetas suman solo esos meses', () => {
  const w = JS('trafico-whatsapp.js');
  assert.match(w, /meses: mesesTWpp,\n    todos: !_gdMeses\(\)\.length,/);
  assert.match(w, /if\(mesesTarjWpp\) filtradas = gdFiltrarPorMes\(filtradas, function\(f\)\{ return f\.fechaInicio; \}, mesesTarjWpp\);/);
});

test('Calidad por monitoreos: el rango y los monitoreos siguen a MESES; el puntaje sale de cada monitoreo (no promedio de meses)', () => {
  const gd = JS('dashboard-generic.js');
  const cal = extraer(gd, 'function _gdRenderCalidad(p, i)');
  assert.match(cal, /var claveCal = marcadosCal\.length \? marcadosCal\.join\(','\) : 'todos';/);
  assert.match(cal, /if\(estado\.meses && estado\.meses\.length\) arr = gdFiltrarPorMes\(arr, function\(m\)\{ return m\.fecha; \}, estado\.meses\);/);
  const C = require('../../public/js/calidad-dashboard-logic.js');
  const mon = [{ fecha: '2026-08-05', puntaje: 100 }, { fecha: '2026-08-06', puntaje: 80 }, { fecha: '2026-10-01', puntaje: 60 }];
  const r = C.calDashResumen(G.gdFiltrarPorMes(mon, (m) => m.fecha, ['2026-08', '2026-10']));
  assert.equal(r.total, 3);
  assert.equal(r.promedio, 80, '(100 + 80 + 60) / 3, no el promedio de 90 y 60');
});

test('Nivel de servicio de Llamadas: sigue siendo el promedio simple de los dias, ahora de los meses marcados (decision del usuario)', () => {
  const T = require('../../public/js/trafico-logic.js');
  const dias = [{ fecha: '2026-08-01', serviceLevel20secPct: 90 }, { fecha: '2026-08-02', serviceLevel20secPct: 80 }, { fecha: '2026-10-01', serviceLevel20secPct: 50 }];
  const agoOct = G.gdFiltrarPorMes(dias, (f) => f.fecha, ['2026-08', '2026-10']);
  assert.equal(T.traficoServiceLevelPromedioPeriodo(agoOct, 'serviceLevel20secPct'), Math.round((90 + 80 + 50) / 3 * 100) / 100);
});
