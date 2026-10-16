// fase147-b-encuesta.test.js — Fase 147, Parte B: Encuesta de satisfaccion
// de Mobilize. Cubre lector (encabezado en la fila 2, "-"/"--", fuera de
// rango con aviso, columnas extra ignoradas, Date con getters locales),
// contrato navegador/servidor, migraciones (tabla y pestaña antes de
// Calidad), API (impacto, reemplazo por rango, agregados con todos los
// valores, comentarios, FCR con las 2 bases), permisos (nombres solo con
// puedeVerAsesores, cliente de otra campaña 403), Zod, plan de carga y la
// vista. Todo SINTETICO.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('../../public/js/encuesta-logic.js');
const { CAMPOS_FILA, PREGUNTAS } = require('../encuestas');
const { cargasPlanConsolidado } = require('../../public/js/cargas-logic.js');
const { CONFIGS } = require('../dashboard-config-seed');
const { request, app, tokenFor, MASTER_PASSWORD, SEED, db } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const HEADER = ['AGENT_NAME', 'SKILL_NAME', 'DATE', 'Q01', 'Q02', 'Q03', 'Q04', 'VOICE_MESSAGE'];

// ── Lector ────────────────────────────────────────────────────────────────

test('contrato: payload [fecha, agente, skill, q1..q4, comentario] y rangos iguales en navegador y servidor', () => {
  assert.deepEqual(L.ENCUESTA_ORDEN_ARRAY, ['fecha', 'agente', 'skill', 'q1', 'q2', 'q3', 'q4', 'comentario']);
  assert.deepEqual(CAMPOS_FILA, L.ENCUESTA_ORDEN_ARRAY);
  assert.deepEqual(PREGUNTAS.map((p) => [p.key, p.min, p.max]), L.ENCUESTA_PREGUNTAS.map((p) => [p.key, p.min, p.max]));
  assert.deepEqual(L.encuestaValoresPosibles(L.ENCUESTA_PREGUNTAS[0]), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(L.encuestaEtiquetaValor(L.ENCUESTA_PREGUNTAS[2], 1), 'Sí');
  assert.equal(L.encuestaEtiquetaValor(L.ENCUESTA_PREGUNTAS[2], 2), 'No');
  assert.match(L.ENCUESTA_PREGUNTAS[0].texto, /^En una escala de 0 a 10, donde 0 significa nada probable/);
  assert.match(L.ENCUESTA_PREGUNTA_COMENTARIOS, /^¿Tiene algún comentario o sugerencia/);
});

test('el encabezado se encuentra aunque venga en la fila 2 (fila 1 con textos sueltos, como el archivo real)', () => {
  const aoa = [
    ['Estos como filtros', null, null, 'Resultado encuesta'],
    HEADER.concat([null, 'Q01', 'texto de la pregunta']),
    ['Asesor Uno', 'SKILL A', new Date(2026, 8, 1, 23, 50), 9, '-', '--', '-', '--'],
    ['Asesor Dos', 'SKILL B', new Date(2026, 8, 2, 8, 0), '10', 5, 1, 4, 'Muy buena atencion'],
  ];
  assert.equal(L.encuestaBuscarEncabezado(aoa, 20), 1);
  const r = L.encuestaParseFilas(aoa);
  assert.equal(r.error, undefined);
  assert.deepEqual(r.filas, [
    ['2026-09-01', 'Asesor Uno', 'SKILL A', 9, null, null, null, ''],
    ['2026-09-02', 'Asesor Dos', 'SKILL B', 10, 5, 1, 4, 'Muy buena atencion'],
  ]);
  assert.equal(r.dias, 2);
  assert.equal(r.desde, '2026-09-01');
  assert.equal(r.hasta, '2026-09-02');
  assert.equal(r.conteos.preguntas.q1.valores[9], 1);
  assert.equal(r.conteos.preguntas.q2.sinRespuesta, 1);
  assert.equal(r.conteos.comentarios, 1);
});

test('fuera de rango = sin respuesta con aviso; columnas extra (telefono) se ignoran y nunca viajan', () => {
  const r = L.encuestaParseFilas([
    HEADER.concat(['TELEPHONE']),
    ['A', 'S', '2026-09-03', 11, 0, 3, 2.5, '', '3001234567'],
    [null, null, null, null, null, null, null, null, null],
    ['A', 'S', 'no es fecha', 1, 1, 1, 1, '', ''],
  ]);
  assert.deepEqual(r.filas, [['2026-09-03', 'A', 'S', null, null, null, null, '']]);
  assert.equal(r.avisos.length, 5);
  assert.match(r.avisos[0], /Fila 2: Q01 fuera de rango \(0 a 10\)/);
  assert.match(r.avisos[4], /Fila 4: DATE invalida/);
  assert.ok(!JSON.stringify(r.filas).includes('3001234567'));
});

test('DATE: Date con getters locales (las 23:50 no pasan al dia siguiente), serial y texto', () => {
  assert.equal(L.encuestaParseFecha(new Date(2026, 8, 22, 23, 50)), '2026-09-22');
  assert.equal(L.encuestaParseFecha(46267.75), '2026-09-02');
  assert.equal(L.encuestaParseFecha('22/09/2026 10:00'), '2026-09-22');
  assert.equal(L.encuestaParseFecha('2026-09-22'), '2026-09-22');
  assert.equal(L.encuestaParseFecha('x'), null);
});

test('comentario de mas de 1000 caracteres se recorta con aviso; falta columna obligatoria = error', () => {
  const r = L.encuestaParseFilas([HEADER, ['A', 'S', '2026-09-03', 1, 1, 1, 1, 'x'.repeat(1200)]]);
  assert.equal(r.filas[0][7].length, 1000);
  assert.match(r.avisos[0], /se recorto/);
  const e = L.encuestaParseFilas([['AGENT_NAME', 'SKILL_NAME', 'DATE', 'Q01', 'Q02', 'Q03'], ['A', 'S', '2026-09-03', 1, 1, 1]]);
  assert.match(e.error, /Faltan columnas obligatorias: Q04/);
});

test('resumen de la vista previa: conteos por pregunta en texto simple', () => {
  const c = L.encuestaConteos([['2026-09-01', 'A', 'S', 9, 5, 1, 4, 'x'], ['2026-09-01', 'A', 'S', null, null, 2, null, '']]);
  assert.equal(L.encuestaResumenTexto(c), 'P1: 9→1, sin respuesta 1 · P2: 5→1, sin respuesta 1 · P3: Sí→1, No→1, sin respuesta 0 · P4: 4→1, sin respuesta 1 · 1 comentario(s)');
});

test('FCR: base total (pedido de Edwin) o solo los que respondieron Q03', () => {
  assert.deepEqual(L.encuestaFcr(3, 45, 4, 'total'), { num: 3, den: 45, pct: 6.7 });
  assert.deepEqual(L.encuestaFcr(3, 45, 4, 'respondieron'), { num: 3, den: 4, pct: 75 });
  assert.equal(L.encuestaFcr(0, 0, 0, 'total').pct, null);
});

// ── Migraciones ───────────────────────────────────────────────────────────

test('migracion: tabla encuestas con sus columnas e indice, sin telefono; el bloque solo crea', () => {
  const cols = db.prepare('PRAGMA table_info(encuestas)').all().map((c) => c.name).sort();
  assert.deepEqual(cols, ['agente', 'archivoNombre', 'campana', 'cargadoPorNombre', 'comentario', 'createdAt', 'fecha', 'id', 'q1', 'q2', 'q3', 'q4', 'skill']);
  assert.ok(!cols.some((c) => /tel/i.test(c)));
  const idx = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='encuestas'").all().map((r) => r.name);
  assert.ok(idx.includes('idx_encuestas_campana_fecha'));
  const src = fs.readFileSync(path.join(__dirname, '..', 'db.js'), 'utf8');
  const bloque = src.slice(src.indexOf("runOnceMigration('fase147_encuestas_tabla_v1'"), src.indexOf('function migrarMobilizeEncuestaTab'));
  assert.ok(bloque.length > 50);
  assert.ok(!/DROP|DELETE|UPDATE|ALTER|INSERT/i.test(bloque), 'la migracion solo crea');
});

test('seed y migracion: Encuesta va justo antes de Calidad (Calidad al final); idempotente; forma desconocida no se toca', () => {
  const seedTabs = CONFIGS.find((c) => c.cliente === 'MOBILIZE').layout.tabs.map((t) => t.key);
  assert.deepEqual(seedTabs.slice(-2), ['encuesta', 'calidad']);
  const leer = () => JSON.parse(db.prepare("SELECT layout FROM dashboards_config WHERE cliente='MOBILIZE'").get().layout);
  const original = leer();
  // forma de produccion: sin encuesta
  const prod = JSON.parse(JSON.stringify(original));
  prod.tabs = prod.tabs.filter((t) => t.key !== 'encuesta');
  db.prepare("UPDATE dashboards_config SET layout=? WHERE cliente='MOBILIZE'").run(JSON.stringify(prod));
  db.migrarMobilizeEncuestaTab();
  const l = leer();
  assert.deepEqual(l.tabs.map((t) => t.key).slice(-2), ['encuesta', 'calidad']);
  assert.deepEqual(l.tabs.find((t) => t.key === 'encuesta'), { key: 'encuesta', label: 'Encuesta', panels: [{ tipo: 'encuesta_panel', campana: 'MOBILIZE' }] });
  const antes = db.prepare("SELECT layout, updatedAt FROM dashboards_config WHERE cliente='MOBILIZE'").get();
  db.migrarMobilizeEncuestaTab();
  assert.deepEqual(db.prepare("SELECT layout, updatedAt FROM dashboards_config WHERE cliente='MOBILIZE'").get(), antes, 'idempotente');
  const rara = { kpis: [], tabs: [{ key: 'calidad', label: 'Calidad', panels: [] }] };
  db.prepare("UPDATE dashboards_config SET layout=? WHERE cliente='MOBILIZE'").run(JSON.stringify(rara));
  db.migrarMobilizeEncuestaTab();
  assert.deepEqual(leer(), rara, 'sin llamadas_unicas no es la forma de produccion: no se toca');
  db.prepare("UPDATE dashboards_config SET layout=? WHERE cliente='MOBILIZE'").run(JSON.stringify(original));
});

// ── API ───────────────────────────────────────────────────────────────────

// 6 encuestas de septiembre: FCR 2 de 6 (total) o 2 de 3 (respondieron).
const SEPT = [
  ['2026-09-01', 'Asesor Uno', 'SKILL A', 9, 5, 1, 4, 'Comentario sintetico uno'],
  ['2026-09-01', 'Asesor Uno', 'SKILL A', 10, 5, 1, 5, ''],
  ['2026-09-02', 'Asesor Dos', 'SKILL B', null, null, 2, null, '<b>sintetico</b>'],
  ['2026-09-03', 'Asesor Dos', 'SKILL B', null, null, null, null, ''],
  ['2026-09-04', 'Asesor Tres', 'SKILL A', 0, 1, null, 1, ''],
  ['2026-09-22', 'Asesor Tres', 'SKILL B', null, null, null, null, ''],
];

test('API: impacto (no escribe) + carga + recargar la base corregida reemplaza; otro mes intacto', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const imp = await request(app).post('/api/calidad/encuestas/carga/impacto').set(auth(admin)).send({ campana: 'MOBILIZE', filas: SEPT });
  assert.equal(imp.status, 200, JSON.stringify(imp.body));
  assert.equal(imp.body.filasExistentes, 0);
  assert.equal(imp.body.filasNuevas, 6);
  assert.equal(imp.body.dias, 5);
  assert.deepEqual([imp.body.desde, imp.body.hasta], ['2026-09-01', '2026-09-22']);
  assert.equal(imp.body.conteos.preguntas.q3.valores[1], 2);
  assert.equal(imp.body.conteos.comentarios, 2);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM encuestas WHERE campana='MOBILIZE'").get().n, 0, 'el impacto no escribe');

  const ago = [['2026-08-20', 'Asesor Uno', 'SKILL A', 8, 4, 1, 4, '']];
  assert.equal((await request(app).post('/api/calidad/encuestas/carga').set(auth(admin)).send({ campana: 'MOBILIZE', filas: ago })).status, 201);
  const c1 = await request(app).post('/api/calidad/encuestas/carga').set(auth(admin)).send({ campana: 'MOBILIZE', archivoNombre: 'sintetico.xlsx', filas: SEPT });
  assert.equal(c1.status, 201, JSON.stringify(c1.body));
  assert.equal(c1.body.borradas, 0, 'cargar septiembre no borra agosto');
  const imp2 = await request(app).post('/api/calidad/encuestas/carga/impacto').set(auth(admin)).send({ campana: 'MOBILIZE', filas: SEPT });
  assert.equal(imp2.body.filasExistentes, 6);
  const c2 = await request(app).post('/api/calidad/encuestas/carga').set(auth(admin)).send({ campana: 'MOBILIZE', archivoNombre: 'sintetico.xlsx', filas: SEPT });
  assert.equal(c2.body.borradas, 6, 'recargar el mismo rango reemplaza, no duplica');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM encuestas WHERE campana='MOBILIZE'").get().n, 7);
});

test('API: resumen con TODOS los valores posibles (aunque sean 0), respondieron/sin respuesta, filtros', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const r = await request(app).get('/api/calidad/encuestas/resumen').query({ campana: 'MOBILIZE', desde: '2026-09-01', hasta: '2026-09-30' }).set(auth(admin));
  assert.equal(r.status, 200);
  assert.equal(r.body.total, 6);
  const q1 = r.body.preguntas.find((p) => p.key === 'q1');
  assert.equal(q1.valores.length, 11);
  assert.deepEqual(q1.valores.map((x) => x.valor), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual([q1.valores[0].cantidad, q1.valores[9].cantidad, q1.valores[10].cantidad, q1.valores[5].cantidad], [1, 1, 1, 0]);
  assert.deepEqual([q1.respondieron, q1.sinRespuesta], [3, 3]);
  const q3 = r.body.preguntas.find((p) => p.key === 'q3');
  assert.deepEqual(q3.valores, [{ valor: 1, cantidad: 2 }, { valor: 2, cantidad: 1 }]);
  const skill = await request(app).get('/api/calidad/encuestas/resumen').query({ campana: 'MOBILIZE', skill: 'SKILL B' }).set(auth(admin));
  assert.equal(skill.body.total, 3);
  const agente = await request(app).get('/api/calidad/encuestas/resumen').query({ campana: 'MOBILIZE', agente: 'Asesor Uno' }).set(auth(admin));
  assert.equal(agente.body.total, 3, '2 de septiembre + 1 de agosto');
  const op = await request(app).get('/api/calidad/encuestas/opciones').query({ campana: 'MOBILIZE' }).set(auth(admin));
  assert.deepEqual(op.body.skills, ['SKILL A', 'SKILL B']);
  assert.deepEqual(op.body.agentes, ['Asesor Dos', 'Asesor Tres', 'Asesor Uno']);
  assert.deepEqual([op.body.desde, op.body.hasta, op.body.total], ['2026-08-20', '2026-09-22', 7]);
});

test('API: comentarios solo con texto, mas recientes primero; el texto viaja tal cual (la vista lo escapa)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const r = await request(app).get('/api/calidad/encuestas/comentarios').query({ campana: 'MOBILIZE' }).set(auth(admin));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.map((c) => [c.fecha, c.comentario]), [['2026-09-02', '<b>sintetico</b>'], ['2026-09-01', 'Comentario sintetico uno']]);
  assert.equal(r.body[0].agente, 'Asesor Dos');
});

test('API: FCR por mes con base total (por defecto) o respondieron', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const t = await request(app).get('/api/calidad/encuestas/fcr').query({ campana: 'MOBILIZE' }).set(auth(admin));
  assert.equal(t.status, 200);
  assert.deepEqual(t.body.map((m) => [m.periodo, m.si, m.den, m.pct]), [['2026-08', 1, 1, 100], ['2026-09', 2, 6, 33.3]]);
  const r = await request(app).get('/api/calidad/encuestas/fcr').query({ campana: 'MOBILIZE', base: 'respondieron', desde: '2026-09-01' }).set(auth(admin));
  assert.deepEqual(r.body.map((m) => [m.periodo, m.si, m.den, m.pct]), [['2026-09', 2, 3, 66.7]]);
  const mal = await request(app).get('/api/calidad/encuestas/fcr').query({ campana: 'MOBILIZE', base: 'otra' }).set(auth(admin));
  assert.equal(mal.status, 400);
});

test('API/Zod: valores fuera de rango, elemento de mas o comentario largo = 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  for (const fila of [
    ['2026-09-01', 'A', 'S', 11, null, null, null, ''],
    ['2026-09-01', 'A', 'S', null, 0, null, null, ''],
    ['2026-09-01', 'A', 'S', null, null, 3, null, ''],
    ['2026-09-01', 'A', 'S', null, null, null, 1.5, ''],
    ['2026-09-01', 'A', 'S', null, null, null, null, '', '3001234567'],
    ['2026-09-01', 'A', 'S', null, null, null, null, 'x'.repeat(1001)],
  ]) {
    const r = await request(app).post('/api/calidad/encuestas/carga').set(auth(admin)).send({ campana: 'MOBILIZE', filas: [fila] });
    assert.equal(r.status, 400, JSON.stringify(fila).slice(0, 80));
  }
});

test('API: cliente de MOBILIZE ve y filtra por asesor (OK nombres para cliente) pero no carga', async () => {
  const cli = await tokenFor('agomez', SEED.agomez);
  const op = await request(app).get('/api/calidad/encuestas/opciones').query({ campana: 'MOBILIZE' }).set(auth(cli));
  assert.equal(op.status, 200);
  assert.ok(Array.isArray(op.body.agentes) && op.body.agentes.length === 3);
  const f = await request(app).get('/api/calidad/encuestas/resumen').query({ campana: 'MOBILIZE', agente: 'Asesor Dos' }).set(auth(cli));
  assert.equal(f.status, 200);
  const com = await request(app).get('/api/calidad/encuestas/comentarios').query({ campana: 'MOBILIZE' }).set(auth(cli));
  assert.equal(com.body[0].agente, 'Asesor Dos');
  const carga = await request(app).post('/api/calidad/encuestas/carga').set(auth(cli)).send({ campana: 'MOBILIZE', filas: SEPT });
  assert.equal(carga.status, 403);
});

test('API: cliente SIN acceso a MOBILIZE no ve nada; en ORLANT no recibe nombres; Inventario 403', async () => {
  const base = db.prepare("SELECT * FROM users WHERE user = 'agomez'").get();
  const perms = JSON.parse(base.perms);
  Object.keys(perms).forEach((k) => { if (/MOBILIZE/.test(k)) perms[k] = false; });
  const cols = Object.keys(base).filter((c) => c !== 'id');
  db.prepare('DELETE FROM users WHERE user = ?').run('cli_solo_orlant_f147b');
  db.prepare('INSERT INTO users (' + cols.join(',') + ') VALUES (' + cols.map((c) => '@' + c).join(',') + ')').run(Object.assign({}, base, { user: 'cli_solo_orlant_f147b', perms: JSON.stringify(perms) }));
  const cli = await tokenFor('cli_solo_orlant_f147b', SEED.agomez);
  for (const ruta of ['opciones', 'resumen', 'comentarios', 'fcr']) {
    const r = await request(app).get('/api/calidad/encuestas/' + ruta).query({ campana: 'MOBILIZE' }).set(auth(cli));
    assert.equal(r.status, 403, 'MOBILIZE ' + ruta);
    assert.ok(!JSON.stringify(r.body).includes('Asesor'));
  }
  const opO = await request(app).get('/api/calidad/encuestas/opciones').query({ campana: 'ORLANT' }).set(auth(cli));
  assert.equal(opO.status, 200);
  assert.equal(opO.body.agentes, undefined);
  const agO = await request(app).get('/api/calidad/encuestas/resumen').query({ campana: 'ORLANT', agente: 'X' }).set(auth(cli));
  assert.equal(agO.status, 403);
  const comO = await request(app).get('/api/calidad/encuestas/comentarios').query({ campana: 'ORLANT' }).set(auth(cli));
  assert.equal(comO.status, 200);
  db.prepare('DELETE FROM users WHERE user = ?').run('cli_solo_orlant_f147b');
  const inv = await tokenFor('mlopez', SEED.mlopez);
  assert.equal((await request(app).get('/api/calidad/encuestas/resumen').query({ campana: 'MOBILIZE' }).set(auth(inv))).status, 403);
});

// ── Plan de carga ─────────────────────────────────────────────────────────

test('Cargar Datos: la hoja "Encuesta de satisfacción" solo aparece con sus columnas (Mobilize)', () => {
  const cols = L.ENCUESTA_COLUMNAS.map((c) => ({ label: c.label, opcional: !c.obligatoria }));
  const args = [{}, null, null, null, null, null, null, null, null, null, undefined, null, null, null];
  assert.ok(!cargasPlanConsolidado(...args, null).some((h) => h.tipo === 'encuesta'));
  const slot = cargasPlanConsolidado(...args, cols).find((h) => h.tipo === 'encuesta');
  assert.equal(slot.hoja, 'ENCUESTA');
  assert.deepEqual(slot.columnas.map((c) => c.label), HEADER);
  const cargasJs = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'cargas.js'), 'utf8');
  // Fase 153 (Paso 2): la lista sale del registro de clientes.
  assert.match(cargasJs, /LISTAS_REGISTRO\.encuesta\.indexOf\(cliente\)/);
  assert.deepEqual(require('../../public/js/registro-clientes.js').derivarListasRegistro(require('../../public/js/registro-clientes.js').REGISTRO_CLIENTES).encuesta, ['MOBILIZE']);
  assert.match(cargasJs, /encuestaBuscarEncabezado\(_cargasPrimerasFilas\(wsCandidata, 20\), 20\)/);
});

// ── Vista ─────────────────────────────────────────────────────────────────

const VISTA_JS = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'encuesta.js'), 'utf8');

async function renderVista({ opciones, resumen, comentarios, rol }) {
  const el = {};
  const pedidos = [];
  const graficas = [];
  const sandbox = {
    document: { getElementById: (id) => (el[id] = el[id] || { id, innerHTML: '', textContent: '', value: '', dataset: {} }) },
    apiRequest: async (m, url) => {
      pedidos.push(url);
      if (url.indexOf('/opciones') !== -1) return opciones;
      if (url.indexOf('/comentarios') !== -1) return comentarios;
      return resumen;
    },
    _gd: { cliente: 'MOBILIZE' },
    currentUser: { rol: rol || 'ADMIN' },
    _gdChart: (id, cfg) => graficas.push({ id, cfg }),
    esc: (s) => String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    fechaDiaCorta: (f) => f,
    canLoadData: () => true,
  };
  Object.keys(L).forEach((k) => { sandbox[k] = L[k]; });
  vm.createContext(sandbox);
  vm.runInContext(VISTA_JS, sandbox);
  await sandbox._encuestaRenderPanel({ tipo: 'encuesta_panel', campana: 'MOBILIZE' }, 0);
  return { el, pedidos, graficas, sandbox };
}

test('Vista: 4 preguntas con todas las barras, "N respondieron · M sin respuesta", comentarios escapados, boton de preguntas', async () => {
  const resumen = { total: 6, preguntas: PREGUNTAS.map((p) => {
    const valores = []; for (let v = p.min; v <= p.max; v++) valores.push({ valor: v, cantidad: v === p.max ? 2 : 0 });
    return { key: p.key, respondieron: 2, sinRespuesta: 4, valores };
  }) };
  const { el, graficas } = await renderVista({
    opciones: { total: 6, skills: ['SKILL A'], agentes: ['Asesor Uno'] }, resumen,
    comentarios: [{ fecha: '2026-09-02', skill: 'SKILL A', agente: 'Asesor Uno', comentario: '<img src=x>' }],
  });
  const html = el['gd-p0'].innerHTML;
  for (const n of [1, 2, 3, 4]) assert.match(html, new RegExp('Pregunta ' + n + '<'));
  assert.match(html, /Preguntas de la encuesta/);
  assert.match(html, /enc-f-agente-0/);
  assert.equal(graficas.length, 4);
  assert.deepEqual(graficas[0].cfg.data.labels, ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
  assert.deepEqual(graficas[2].cfg.data.labels, ['Sí', 'No']);
  assert.equal(el['enc-pie-q1-0'].textContent, '2 respondieron · 4 sin respuesta');
  assert.ok(!el['enc-comentarios-0'].innerHTML.includes('<img'), 'el comentario se escapa');
  assert.match(el['enc-comentarios-0'].innerHTML, /&lt;img src=x&gt;/);
  assert.match(el['enc-comentarios-0'].innerHTML, /Asesor/);
});

test('Vista: sin encuestas -> estado vacio claro, sin graficas', async () => {
  const { el, graficas, pedidos } = await renderVista({ opciones: { total: 0, skills: [] } });
  assert.match(el['gd-p0'].innerHTML, /Sin encuestas cargadas todavía/);
  assert.equal(graficas.length, 0);
  assert.equal(pedidos.length, 1);
});

test('Integracion: tipo de panel registrado en el tablero, exportacion, mes global y el dialogo accesible', () => {
  const gen = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'dashboard-generic.js'), 'utf8');
  assert.match(gen, /if\(p\.tipo === 'encuesta_panel'\)\{ _encuestaRenderPanel\(p, i\); return; \}/);
  assert.ok(require('../../public/js/dashboard-export-tipos.js').GD_EXPORT_TIPOS_SOPORTADOS.includes('encuesta_panel'));
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'mes-global-logic.js'), 'utf8'), /'encuesta_panel'\]/);
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  assert.match(html, /role="dialog" aria-modal="true" aria-labelledby="modal-encuesta-preguntas-title" id="modal-encuesta-preguntas"/);
  assert.ok(html.indexOf('js/encuesta-logic.js') < html.indexOf('js/encuesta.js'));
  assert.ok(require('../../public/js/motion-helpers.js').MOTION_DIALOGOS_SIMPLES['modal-encuesta-preguntas']);
});
