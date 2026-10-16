// fase142-whatsapp-tiempos.test.js — Fase 142 (punto 4, reunion con Edwin del
// 13/10/2026): ORLANT WhatsApp, Nivel de Servicio por RANGOS de minutos a
// partir del detalle por conversacion. Cubre parser (Date, columna TIEMPO
// equivocada ignorada, colas no WhatsApp ignoradas, fronteras 180/181,
// 300/301, 480/481, 600/601, filas vacias, RESULT != ANSWER), migracion,
// API (agregados, filtros mes/cola, reemplazo por rango, otro mes intacto,
// campaignAccess, Zod), plan de carga y la vista. Todo SINTETICO.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('../../public/js/whatsapp-tiempos-logic.js');
const { CAMPOS_FILA, RANGOS } = require('../whatsapp-tiempos');
const { cargasPlanConsolidado } = require('../../public/js/cargas-logic.js');
const { request, app, tokenFor, MASTER_PASSWORD, SEED, db } = require('./helpers');

const HEADER = ['SKILL_NAME', 'DATE', 'RESULT', 'ANSWER_TIME', 'TIEMPO'];
const auth = (t) => ({ Authorization: `Bearer ${t}` });

// ── Parser ────────────────────────────────────────────────────────────────

test('contrato: payload [skill, fecha, hora, segundos] igual en navegador y servidor; mismos cortes', () => {
  assert.deepEqual(L.WPP_TIEMPOS_ORDEN_ARRAY, ['skill', 'fecha', 'hora', 'segundos']);
  assert.deepEqual(CAMPOS_FILA, L.WPP_TIEMPOS_ORDEN_ARRAY);
  assert.deepEqual(RANGOS.map((r) => [r.key, r.label, r.hasta]), L.WPP_TIEMPOS_RANGOS.map((r) => [r.key, r.label, r.hasta]));
  assert.deepEqual(L.WPP_TIEMPOS_RANGOS.map((r) => r.label), ['0-3 minutos', '3-5 minutos', '5-8 minutos', '8-10 minutos', '10 minutos en adelante']);
});

test('fronteras de Edwin: <=180, <=300, <=480, <=600, >600 (limite superior incluido)', () => {
  const esperado = { 0: 'r0_3', 180: 'r0_3', 181: 'r3_5', 300: 'r3_5', 301: 'r5_8', 480: 'r5_8', 481: 'r8_10', 600: 'r8_10', 601: 'r10', 82176: 'r10' };
  Object.keys(esperado).forEach((s) => assert.equal(L.wppTiemposRangoDe(Number(s)), esperado[s], 'segundos ' + s));
});

test('DATE como Date (getters locales, como entrega SheetJS), serial con hora y texto', () => {
  assert.deepEqual(L.wppTiemposParseFechaHora(new Date(2026, 8, 2, 17, 59, 30)), { fecha: '2026-09-02', hora: 17 });
  assert.deepEqual(L.wppTiemposParseFechaHora(46267.75), { fecha: '2026-09-02', hora: 18 });
  assert.deepEqual(L.wppTiemposParseFechaHora('02/09/2026 06:05'), { fecha: '2026-09-02', hora: 6 });
  assert.deepEqual(L.wppTiemposParseFechaHora('2026-09-02 13:00:00'), { fecha: '2026-09-02', hora: 13 });
  assert.equal(L.wppTiemposParseFechaHora('no es fecha'), null);
});

test('la columna TIEMPO del Excel se IGNORA (formula equivocada de agosto): el rango sale de ANSWER_TIME', () => {
  const r = L.wppTiemposParseFilas([HEADER,
    ['WHATSAPP ORLANT 3P', new Date(2026, 7, 4, 9, 0), 'ANSWER', 30, '10 minutos en adelante'],
    ['WHATSAPP ORLANT 3P', new Date(2026, 7, 4, 9, 5), 'ANSWER', 250, '10 minutos en adelante'],
  ]);
  assert.deepEqual(r.porRango, { r0_3: 1, r3_5: 1, r5_8: 0, r8_10: 0, r10: 0 });
});

test('colas que no empiezan por WHATSAPP se ignoran y se cuentan (sin error); vacias se ignoran; RESULT != ANSWER con aviso', () => {
  const r = L.wppTiemposParseFilas([HEADER,
    ['WHATSAPP GENERAL', new Date(2026, 7, 4, 9, 0), 'ANSWER', 30, ''],
    ['CALL INBOUND ORLANT 3P', new Date(2026, 7, 4, 9, 0), 'ANSWER', 30, ''],
    ['CONFIRMACIONES', new Date(2026, 7, 4, 9, 0), 'ANSWER', 30, ''],
    [null, null, null, null, null],
    ['WhatsApp Citas', new Date(2026, 7, 5, 10, 0), 'ANSWER', 700, ''],
    ['WHATSAPP GENERAL', new Date(2026, 7, 5, 10, 0), 'ABANDON', 10, ''],
  ]);
  assert.equal(r.filas.length, 2);
  assert.equal(r.ignoradasNoWhatsapp, 2);
  assert.equal(r.avisos.length, 1);
  assert.match(r.avisos[0], /Fila 7: RESULT "ABANDON" no es ANSWER/);
  assert.equal(r.dias, 2);
  assert.deepEqual(r.filas[1], ['WhatsApp Citas', '2026-08-05', 10, 700]);
});

test('encabezados sin importar mayusculas/espacios; columna faltante = error sin filas', () => {
  assert.deepEqual(L.wppTiemposColIndexMap([' skill_name ', 'Date', 'result', 'Answer_Time']), { skill: 0, fecha: 1, resultado: 2, segundos: 3 });
  const e = L.wppTiemposParseFilas([['SKILL_NAME', 'DATE', 'RESULT'], ['WHATSAPP X', '2026-09-01', 'ANSWER']]);
  assert.match(e.error, /Faltan columnas obligatorias: ANSWER_TIME/);
  assert.equal(e.filas, undefined);
});

test('mes por defecto: el elegido si tiene datos; si no, el ultimo con datos no futuro', () => {
  const meses = ['2026-08', '2026-09'];
  assert.equal(L.wppTiemposMesPorDefecto(meses, '2026-08', '2026-10'), '2026-08');
  assert.equal(L.wppTiemposMesPorDefecto(meses, '2026-10', '2026-10'), '2026-09');
  assert.equal(L.wppTiemposMesPorDefecto(['2026-09', '2027-01'], '2026-10', '2026-10'), '2026-09');
  assert.equal(L.wppTiemposMesPorDefecto([], '2026-10', '2026-10'), null);
});

// ── Migracion ─────────────────────────────────────────────────────────────

test('migracion: tabla whatsapp_tiempos con sus columnas e indice, registrada una vez; no toca trafico_whatsapp', () => {
  const cols = db.prepare('PRAGMA table_info(whatsapp_tiempos)').all().map((c) => c.name).sort();
  assert.deepEqual(cols, ['archivoNombre', 'campana', 'cargadoPorNombre', 'createdAt', 'fecha', 'hora', 'id', 'segundos', 'skill']);
  assert.ok(!cols.some((c) => /tel|nombre_?contacto|cliente/i.test(c)));
  const idx = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='whatsapp_tiempos'").all().map((r) => r.name);
  assert.ok(idx.includes('idx_whatsapp_tiempos_campana_fecha'));
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM schema_migrations WHERE name='fase142_whatsapp_tiempos_tabla_v1'").get().n, 1);
  const src = fs.readFileSync(path.join(__dirname, '..', 'db.js'), 'utf8');
  const bloque = src.slice(src.indexOf("runOnceMigration('fase142_whatsapp_tiempos_tabla_v1'"), src.indexOf("runOnceMigration('fase141_llamadas_salida_tabla_v1'"));
  assert.ok(!/DROP|DELETE|UPDATE|ALTER|INSERT/i.test(bloque), 'la migracion solo crea');
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='trafico_whatsapp'").get(), 'trafico_whatsapp sigue existiendo');
});

// ── API ───────────────────────────────────────────────────────────────────

function filasMes(mes, segundos, skill) {
  return segundos.map((s, k) => [skill || 'WHATSAPP ORLANT 3P', `2026-${mes}-${String(1 + (k % 20)).padStart(2, '0')}`, 6 + (k % 12), s]);
}

test('API: impacto + carga + reemplazo por rango; otro mes no se borra; agregados por mes y cola', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const ago = filasMes('08', [10, 180, 181, 300, 301, 480, 481, 600, 601, 5000]);
  const imp = await request(app).post('/api/calidad/whatsapp-tiempos/carga/impacto').set(auth(admin)).send({ campana: 'ORLANT', filas: ago });
  assert.equal(imp.status, 200, JSON.stringify(imp.body));
  assert.deepEqual(imp.body.porRango, { r0_3: 2, r3_5: 2, r5_8: 2, r8_10: 2, r10: 2 });
  assert.equal(imp.body.filasExistentes, 0);
  const c1 = await request(app).post('/api/calidad/whatsapp-tiempos/carga').set(auth(admin)).send({ campana: 'ORLANT', archivoNombre: 'ago.xlsx', filas: ago });
  assert.equal(c1.status, 201, JSON.stringify(c1.body));
  const c2 = await request(app).post('/api/calidad/whatsapp-tiempos/carga').set(auth(admin)).send({ campana: 'ORLANT', archivoNombre: 'ago.xlsx', filas: ago });
  assert.equal(c2.body.borradas, 10, 'recargar el mismo archivo reemplaza, no duplica');
  const sep = filasMes('09', [5, 6, 7, 200], 'WHATSAPP ORLANT 3P').concat(filasMes('09', [900], 'WHATSAPP ORLANT GENERAL'));
  const c3 = await request(app).post('/api/calidad/whatsapp-tiempos/carga').set(auth(admin)).send({ campana: 'ORLANT', filas: sep });
  assert.equal(c3.body.borradas, 0, 'cargar septiembre no borra agosto');

  const rAgo = await request(app).get('/api/calidad/whatsapp-tiempos/rangos').query({ campana: 'ORLANT', mes: '2026-08' }).set(auth(admin));
  assert.equal(rAgo.status, 200);
  assert.equal(rAgo.body.total, 10);
  assert.deepEqual(rAgo.body.rangos.map((x) => [x.label, x.cantidad, x.pct]), [
    ['0-3 minutos', 2, 20], ['3-5 minutos', 2, 20], ['5-8 minutos', 2, 20], ['8-10 minutos', 2, 20], ['10 minutos en adelante', 2, 20]]);
  const rSep = await request(app).get('/api/calidad/whatsapp-tiempos/rangos').query({ campana: 'ORLANT', mes: '2026-09' }).set(auth(admin));
  assert.equal(rSep.body.total, 5);
  assert.equal(rSep.body.rangos[0].cantidad, 3);
  assert.equal(rSep.body.rangos[0].pct, 60);
  const rCola = await request(app).get('/api/calidad/whatsapp-tiempos/rangos').query({ campana: 'ORLANT', mes: '2026-09', skill: 'WHATSAPP ORLANT GENERAL' }).set(auth(admin));
  assert.equal(rCola.body.total, 1);
  assert.equal(rCola.body.rangos[4].cantidad, 1);
  const op = await request(app).get('/api/calidad/whatsapp-tiempos/opciones').query({ campana: 'ORLANT' }).set(auth(admin));
  assert.deepEqual(op.body.meses, ['2026-08', '2026-09']);
  assert.deepEqual(op.body.skills, ['WHATSAPP ORLANT 3P', 'WHATSAPP ORLANT GENERAL']);
  const vacio = await request(app).get('/api/calidad/whatsapp-tiempos/rangos').query({ campana: 'ORLANT', mes: '2026-07' }).set(auth(admin));
  assert.equal(vacio.body.total, 0);
});

test('API/Zod: cola que no es WhatsApp, hora fuera de 0-23, segundos negativos, 5to elemento o mes mal formado = 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  for (const fila of [['CALL INBOUND X', '2026-09-01', 9, 10], ['WHATSAPP X', '2026-09-01', 24, 10], ['WHATSAPP X', '2026-09-01', 9, -1], ['WHATSAPP X', '2026-09-01', 9, 10, 'extra']]) {
    const r = await request(app).post('/api/calidad/whatsapp-tiempos/carga').set(auth(admin)).send({ campana: 'ORLANT', filas: [fila] });
    assert.equal(r.status, 400, JSON.stringify(fila));
  }
  const m = await request(app).get('/api/calidad/whatsapp-tiempos/rangos').query({ campana: 'ORLANT', mes: '09-2026' }).set(auth(admin));
  assert.equal(m.status, 400);
});

test('API: campaignAccess y permiso de Cargar Datos', async () => {
  const inv = await tokenFor('mlopez', SEED.mlopez);
  const r = await request(app).get('/api/calidad/whatsapp-tiempos/rangos').query({ campana: 'ORLANT', mes: '2026-09' }).set(auth(inv));
  assert.equal(r.status, 403);
  const cli = await tokenFor('agomez', SEED.agomez);
  const lect = await request(app).get('/api/calidad/whatsapp-tiempos/rangos').query({ campana: 'ORLANT', mes: '2026-09' }).set(auth(cli));
  assert.equal(lect.status, 200, 'el cliente con acceso a ORLANT ve los agregados');
  const carga = await request(app).post('/api/calidad/whatsapp-tiempos/carga').set(auth(cli)).send({ campana: 'ORLANT', filas: [['WHATSAPP X', '2026-09-01', 9, 10]] });
  assert.equal(carga.status, 403);
});

// ── Plan de carga ─────────────────────────────────────────────────────────

test('Cargar Datos: la hoja "WhatsApp tiempos de respuesta" solo aparece cuando se pasan sus columnas (ORLANT)', () => {
  const cols = L.WPP_TIEMPOS_COLUMNAS.map((c) => ({ label: c.label, opcional: !c.obligatoria }));
  const args = [{}, null, null, null, null, null, null, null, null, null, undefined, null, null];
  assert.ok(!cargasPlanConsolidado(...args, null).some((h) => h.tipo === 'whatsapp_tiempos'));
  const slot = cargasPlanConsolidado(...args, cols).find((h) => h.tipo === 'whatsapp_tiempos');
  assert.equal(slot.hoja, 'WHATSAPP_TIEMPOS');
  const cargasJs = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'cargas.js'), 'utf8');
  // Fase 153 (Paso 2): la lista sale del registro de clientes.
  assert.match(cargasJs, /LISTAS_REGISTRO\.whatsappTiempos\.indexOf\(cliente\)/);
  assert.deepEqual(require('../../public/js/registro-clientes.js').derivarListasRegistro(require('../../public/js/registro-clientes.js').REGISTRO_CLIENTES).whatsappTiempos, ['ORLANT']);
});

// ── Vista ─────────────────────────────────────────────────────────────────

const VISTA_JS = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'whatsapp-tiempos.js'), 'utf8');

async function renderVista({ meses, mesGlobal, rangos }) {
  const el = {};
  const pedidos = [];
  const graficas = [];
  const sandbox = {
    document: {
      getElementById: (id) => (el[id] = el[id] || { id, innerHTML: '', value: '', dataset: id === 'gd-p0' ? { campana: 'ORLANT' } : {} }),
      querySelector: () => null,
    },
    apiRequest: async (m, url) => {
      pedidos.push(url);
      if (url.indexOf('/opciones') !== -1) return { meses, skills: ['WHATSAPP ORLANT 3P'] };
      return rangos;
    },
    _gd: { mesSel: mesGlobal },
    _traficoWppSubtabActivo: { ORLANT: 'sl' },
    _gdChart: (id, cfg) => graficas.push({ id, cfg }),
    esc: (s) => String(s),
    mesNombreLargo: (m) => ({ '2026-08': 'Agosto 2026', '2026-09': 'Septiembre 2026', '2026-10': 'Octubre 2026' }[m] || m),
    fechaLimitesFinDeMesActual: () => '2026-10-31',
    wppTiemposMesPorDefecto: L.wppTiemposMesPorDefecto,
    canLoadData: () => true,
  };
  vm.createContext(sandbox);
  vm.runInContext(VISTA_JS, sandbox);
  await sandbox._wppTiemposRender(0, 'ORLANT');
  return { sandbox, el, pedidos, graficas };
}

const RANGOS_SEP = { mes: '2026-09', total: 7953, dias: 26, rangos: [
  { key: 'r0_3', label: '0-3 minutos', cantidad: 3553, pct: 44.7 }, { key: 'r3_5', label: '3-5 minutos', cantidad: 255, pct: 3.2 },
  { key: 'r5_8', label: '5-8 minutos', cantidad: 287, pct: 3.6 }, { key: 'r8_10', label: '8-10 minutos', cantidad: 146, pct: 1.8 },
  { key: 'r10', label: '10 minutos en adelante', cantidad: 3712, pct: 46.7 }] };

test('Vista: mes global sin datos (octubre) -> muestra el ultimo con datos (septiembre) y lo dice; tarjeta 0-3, total y 5 franjas en orden', async () => {
  const { el, pedidos, graficas } = await renderVista({ meses: ['2026-08', '2026-09'], mesGlobal: '2026-10', rangos: RANGOS_SEP });
  const html = el['tww-content-0'].innerHTML;
  assert.match(html, /Porcentaje de conversaciones de WhatsApp según el tiempo que tardaron en ser contestadas\./);
  assert.match(html, /<option value="2026-09" selected>Septiembre 2026<\/option>/);
  assert.match(html, /No hay tiempos de respuesta cargados para Octubre 2026; se muestra Septiembre 2026\./);
  assert.ok(pedidos.some((u) => /\/rangos\?campana=ORLANT&mes=2026-09$/.test(u)));
  assert.match(el['wtt-kpis-0'].innerHTML, /44,7 %<\/div><div class="kl">% contestado en 0–3 minutos/);
  assert.match(el['wtt-kpis-0'].innerHTML, /7\.953<\/div><div class="kl">Conversaciones contestadas del mes/);
  assert.deepEqual(Array.from(graficas[0].cfg.data.labels), ['0-3 minutos', '3-5 minutos', '5-8 minutos', '8-10 minutos', '10 minutos en adelante']);
  assert.equal(graficas[0].cfg.options.indexAxis, 'y');
  assert.match(el['wtt-tabla-0'].innerHTML, /Total del mes<\/strong><\/td><td><strong>7\.953/);
});

test('Vista: mes global con datos (agosto) -> usa ese mes, sin nota', async () => {
  const { el } = await renderVista({ meses: ['2026-08', '2026-09'], mesGlobal: '2026-08', rangos: Object.assign({}, RANGOS_SEP, { mes: '2026-08' }) });
  assert.match(el['tww-content-0'].innerHTML, /<option value="2026-08" selected>/);
  assert.ok(!/No hay tiempos de respuesta cargados/.test(el['tww-content-0'].innerHTML));
});

test('Vista: sin ningun mes cargado -> estado vacio claro, sin cifras ni grafica', async () => {
  const { el, pedidos, graficas } = await renderVista({ meses: [], mesGlobal: '2026-10', rangos: null });
  assert.match(el['tww-content-0'].innerHTML, /Sin tiempos de respuesta de WhatsApp cargados todavía/);
  assert.ok(!pedidos.some((u) => u.indexOf('/rangos') !== -1));
  assert.equal(graficas.length, 0);
});

test('Integracion: solo ORLANT usa esta vista y los botones Excel/PDF del panel exportan los rangos cuando esta activa', () => {
  assert.match(VISTA_JS, /return LISTAS_REGISTRO\.whatsappTiempos\.indexOf\(campana\) !== -1;/); // Fase 153: del registro
  const wpp = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'trafico-whatsapp.js'), 'utf8');
  assert.match(wpp, /if \(activo === 'sl' && typeof wppTiemposUsa === 'function' && wppTiemposUsa\(campana\)\)/);
  assert.match(wpp, /_wppTiemposActivo\(i\)\)\{ _wppTiemposExportExcel\(i\); return; \}/);
  assert.match(wpp, /_wppTiemposActivo\(i\)\)\{ _wppTiemposExportPrint\(i\); return; \}/);
});
