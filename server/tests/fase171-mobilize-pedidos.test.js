// fase171-mobilize-pedidos.test.js — Fase 171 (pedidos de Edwin para
// Mobilize, reunion del lunes). Todo SINTETICO.
//   1. Tipificacion: SKILL_NAME "-" de salida (outbound_ma) = "Llamadas de salida".
//   2. Llamadas de salida: cada fila cuenta; solo se omiten las vacias o las
//      que no se pueden ubicar; sin agente = "Sin asesor"; TIPO con variaciones;
//      sin el aviso de "mes incompleto" que salia siempre.
//   3. Encuesta: cada mes muestra solo sus datos (sigue el MES de arriba).
//   4. Cerrar sesion: el tablero vuelve a arrancar sin filtros.
//   5. Conectadas y no conectadas en colores bien distintos.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const S = require('../../public/js/llamadas-salida-logic.js');
const CC = require('../../public/js/centro-cargas-logic.js');
const { request, app, tokenFor, MASTER_PASSWORD, db } = require('./helpers');

const RAIZ = path.join(__dirname, '..', '..');
const JS = (f) => fs.readFileSync(path.join(RAIZ, 'public', 'js', f), 'utf8');
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const HEADER = ['AGENT_NAME', 'DATE', 'TELEPHONE', 'DESCRIPTION_COD_ACT', 'TIPO'];

// ── 1. Tipificacion de Mobilize ───────────────────────────────────────────

test('Tipificacion de Mobilize: "-" de salida sale y se filtra como "Llamadas de salida"; el "-" de internalcall sigue aparte', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const fila = (fecha, skill, tipo) => ['Asesor Uno', fecha, '09:00:00', null, 'Agendada', skill, null, null, tipo, null, null];
  const r = await request(app).post('/api/calidad/tipificacion/carga').set(auth(admin)).send({ campana: 'MOBILIZE', canal: 'LLAMADAS', filas: [
    fila('2025-06-02', '-', 'outbound_ma'), fila('2025-06-03', '-', 'outbound_ma'), fila('2025-06-04', '-', 'otro'),
    fila('2025-06-05', 'LINEA ENTRADA', 'inbound'),
  ] });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const op = await request(app).get('/api/calidad/tipificacion/opciones').query({ campana: 'MOBILIZE', canal: 'LLAMADAS' }).set(auth(admin));
  assert.ok(op.body.skills.includes('LLAMADAS DE SALIDA'));
  assert.ok(op.body.skills.includes('-'), 'queda el "-" que no es salida');
  const q = async (skill) => (await request(app).get('/api/calidad/tipificacion/por-tipo').query({ campana: 'MOBILIZE', canal: 'LLAMADAS', mes: '2025-06', skill }).set(auth(admin))).body.total;
  assert.equal(await q('LLAMADAS DE SALIDA'), 2);
  assert.equal(await q('-'), 1, 'internalcall');
  const salida = await request(app).get('/api/calidad/tipificacion/resumen-salida').query({ campana: 'MOBILIZE', mes: '2025-06', skill: 'LLAMADAS DE SALIDA' }).set(auth(admin));
  assert.equal(salida.body.total, 2);
  // No se toca ningun dato guardado.
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM tipificaciones WHERE campana='MOBILIZE' AND skill='-' AND fecha LIKE '2025-06%'").get().n, 3);
});

// ── 2. Llamadas de salida ─────────────────────────────────────────────────

test('Llamadas de salida: cada fila cuenta, sin agente = "Sin asesor", TIPO con variaciones; solo se omiten vacias o no ubicables', () => {
  const r = S.llamadasSalidaParseFilas([HEADER,
    ['Asesor Uno', '2026-09-01', '3001', 'A', 'CONECTADA'],
    ['Asesor Uno', '2026-09-01', '3001', 'A', 'CONECTADA'], // mismo dia y numero: cuenta igual
    [null, '2026-09-01', '3002', 'B', 'NO CONECTADA'],
    ['  ', '2026-09-01', '3003', 'B', 'No-Conectada'],
    ['Asesor Dos', '2026-09-02', '3004', 'C', ' no_conectadas '],
    ['Asesor Dos', '2026-09-02', '3005', 'C', 'NoConectada'],
    ['Asesor Dos', '2026-09-02', '', 'C', 'conectadas'],
    [null, null, null, null, null], ['', ' ', '', '', ''],
    ['Asesor Dos', '', '3006', 'C', 'CONECTADA'],
    ['Asesor Dos', '2026-09-02', '3007', 'C', 'otra cosa'],
  ]);
  assert.deepEqual(r.filas.map((f) => [f[0], f[2]]), [
    ['Asesor Uno', 'CONECTADA'], ['Asesor Uno', 'CONECTADA'], ['Sin asesor', 'NO_CONECTADA'], ['Sin asesor', 'NO_CONECTADA'],
    ['Asesor Dos', 'NO_CONECTADA'], ['Asesor Dos', 'NO_CONECTADA'], ['Asesor Dos', 'CONECTADA'],
  ]);
  assert.deepEqual(r.avisos, [
    '1 fila(s) con un TIPO que no es "Conectada" ni "No conectada", se omitieron (filas 12).',
    '1 fila(s) con DATE invalida o vacia, se omitieron (filas 11).',
    '2 fila(s) sin AGENT_NAME: se cargan como "Sin asesor" (filas 4, 5).',
  ]);
  assert.ok(!JSON.stringify(r.filas).includes('3001'), 'el telefono nunca sale del parser');
});

test('85 filas como el archivo de octubre (45 conectadas, 40 no conectadas, 3 sin agente, numeros repetidos): entran las 85', () => {
  const aoa = [HEADER];
  for (let k = 0; k < 85; k++) aoa.push([k >= 24 && k < 27 ? null : 'Asesor ' + (k % 4), '2026-10-' + String(2 + (k % 20)).padStart(2, '0'), String(3000 + (k % 30)), 'X', k < 45 ? 'CONECTADA' : 'NO CONECTADA']);
  const r = S.llamadasSalidaParseFilas(aoa);
  assert.equal(r.filas.length, 85);
  assert.equal(r.filas.filter((f) => f[2] === 'CONECTADA').length, 45);
  assert.equal(r.filas.filter((f) => f[2] === 'NO_CONECTADA').length, 40);
  assert.deepEqual(r.avisos, ['3 fila(s) sin AGENT_NAME: se cargan como "Sin asesor" (filas 26, 27, 28).']);
});

test('Centro de cargas: llamadas de salida sin el aviso de "mes incompleto" (sale siempre); las demas cargas lo conservan', () => {
  assert.equal(CC.centroOmiteCobertura('llamadas_salida'), true);
  assert.equal(CC.centroOmiteCobertura('flujo_llamadas'), false);
  assert.match(JS('cargas.js'), /if\(cobertura && !centroOmiteCobertura\(focoArch\.carga\)\) rr\.avisos = \[cobertura\]\.concat\(rr\.avisos \|\| \[\]\);/);
});

// ── 3. Encuesta ───────────────────────────────────────────────────────────

// Fase 203: ya no hay MES; Desde/Hasta siguen a MESES (Todos = todas).
test('Encuesta: sigue a MESES (Desde/Hasta de los meses marcados) y meses sin encuestas muestran el aviso, no los datos de otro mes', () => {
  const src = JS('encuesta.js');
  assert.match(src, /if \(hayTablero && _encuestaMesSincronizado\[campana\] !== claveMeses\) \{/);
  assert.match(src, /var r = gdRangoDeMeses\(mesesT\);\n    estado\.desde = r\.desde;\n    estado\.hasta = r\.hasta;/);
  assert.match(src, /_gdAvisoSinDatosMesHtml\('Encuesta', marcados\[marcados\.length - 1\], mesesEnc\[mesesEnc\.length - 1\]\)/);
  assert.doesNotMatch(src, /_gd\.mesSel/);
});

// ── 4. Cerrar sesion: sin filtros ─────────────────────────────────────────

test('cerrar sesion borra los filtros de todos los paneles, el MES, la URL de filtros y cierra el tablero', () => {
  const dg = JS('dashboard-generic.js');
  const ini = dg.indexOf('var GD_ESTADO_A_REINICIAR');
  const fin = dg.indexOf('// ── Fase 167: filtro "Meses"');
  const urls = [];
  const ctx = {
    _gd: { cliente: 'MOBILIZE', mesSel: '2026-10', compSel: '2026-09', mesesSel: ['2026-09'], tab: 'flujo', subtab: 'x', periodos: ['2026-10'] },
    _traficoEstado: { 'MOBILIZE::': { skills: ['A'], desde: '2026-10-01' } }, _tipificacionEstadoCanal: { '0::LLAMADAS': { skill: 'X' } },
    _encuestaEstado: { MOBILIZE: { desde: '2026-09-01' } }, _llamadasSalidaEstado: { MOBILIZE: { tipo: 'CONECTADA' } }, _calDashFiltro: { MOBILIZE: {} },
    location: { search: '?tv_desde=2026-10-01&tv_skills=A', pathname: '/', hash: '' },
    history: { replaceState: (a, b, u) => urls.push(u) },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(dg.slice(ini, fin), ctx);
  // Todos los nombres de la lista existen en algun modulo (no hay nombres inventados).
  const todo = fs.readdirSync(path.join(RAIZ, 'public', 'js')).filter((f) => f.endsWith('.js')).map(JS).join('\n');
  ctx.GD_ESTADO_A_REINICIAR.forEach((n) => assert.match(todo, new RegExp('var ' + n + ' = \\{\\}'), n));
  ctx.gdReiniciarFiltros();
  for (const n of ['_traficoEstado', '_tipificacionEstadoCanal', '_encuestaEstado', '_llamadasSalidaEstado']) assert.deepEqual(Object.keys(ctx[n]), [], n);
  assert.equal(ctx._gd.mesDefecto, ''); // Fase 207: ya no hay _gd.mesSel
  assert.equal(ctx._gd.cliente, null);
  assert.deepEqual(Array.from(ctx._gd.mesesSel), []);
  assert.deepEqual(urls, ['/'], 'sin parametros de filtros en la URL');
  const ses = JS('session.js');
  const logout = ses.slice(ses.indexOf('function doLogout(){'), ses.indexOf('function doLogout(){') + 1200);
  assert.match(logout, /closeGenericDashboard\(\)/);
  assert.match(logout, /gdReiniciarFiltros\(\)/);
});

// ── 5. Colores ────────────────────────────────────────────────────────────

test('conectadas (azul) y no conectadas (magenta) en colores bien distintos, en claro y oscuro, sin verde/rojo de semaforo', () => {
  const ctx = { temaActual: () => 'light' };
  vm.createContext(ctx);
  // Solo el bloque de colores de charts.js (sin Chart.js ni el DOM).
  const ch = JS('charts.js');
  const iniCol = ch.indexOf("var CD='#0d4a5e'");
  const finCol = ch.indexOf('aplicarTemaCharts();', ch.indexOf('function aplicarTemaCharts')) + 'aplicarTemaCharts();'.length;
  const iniFn = ch.indexOf('function colorSerie(rol){');
  vm.runInContext(ch.slice(iniCol, finCol) + '\n' + ch.slice(iniFn, ch.indexOf('\n}', iniFn) + 2), ctx);
  const hex = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  const dist = (a, b) => Math.sqrt(hex(a).reduce((s, v, k) => s + (v - hex(b)[k]) ** 2, 0));
  for (const tema of ['light', 'dark']) {
    ctx.temaActual = () => tema;
    ctx.aplicarTemaCharts();
    const con = vm.runInContext("colorSerie('secundaria')", ctx);
    const no = vm.runInContext("colorSerie('noConectada')", ctx);
    assert.ok(dist(con, no) > 150, tema + ': ' + con + ' vs ' + no);
    assert.ok(![ctx.CG, ctx.CR, ctx.CO].includes(no), 'no es un color de semaforo');
  }
  const lu = JS('llamadas-unicas.js');
  const fnDe = (src, firma) => { const i = src.indexOf(firma); return src.slice(i, src.indexOf('\n}\n', i) + 2); };
  const salida = fnDe(lu, 'function _llamadasSalidaDibujarBarras(i, porMes) {');
  assert.match(salida, /var COl = \(typeof colorSerie==='function' \? colorSerie\('noConectada'\) : '#d22d80'\);/);
  assert.match(salida, /label: 'No conectadas', data: porMes\.map\(function \(m\) \{ return m\.noConectadas; \}\), backgroundColor: COl/);
  assert.match(salida, /label: 'Conectadas', data: porMes\.map\(function \(m\) \{ return m\.conectadas; \}\), borderRadius: 3 \}, \(typeof estiloBarraSecundaria/);
  // La grafica de Llamadas Unicas de ingreso no cambia.
  const { execSync } = require('child_process');
  let main = null;
  try { main = execSync('git show origin/main:public/js/llamadas-unicas.js', { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { /* sin git (p. ej. imagen de CI sin historia): se omite */ }
  if (main && !/noConectada/.test(fnDe(main, 'function _llamadasSalidaDibujarBarras(i, porMes) {'))) {
    assert.equal(fnDe(lu, 'function _llamadasUnicasDibujarBarras(i, porMes, soloTotal) {'), fnDe(main, 'function _llamadasUnicasDibujarBarras(i, porMes, soloTotal) {'));
  }
});
