// fase165-whatsapp-tiempos.test.js — Fase 165 (pedido de Edwin del
// 23/10/2026): "WhatsApp por rangos de tiempo" de ORLANT. Al subir el reporte
// de octubre salian miles de avisos "ANSWER_TIME invalido o vacio": el lector
// solo aceptaba un numero limpio, y Wolkvox puede traer ANSWER_TIME como texto
// con apostrofo ('5742) o como duracion (00:01:35). Cubre: lectura de esos
// formatos (tambien ida y vuelta por un .xlsx real con SheetJS), avisos
// agrupados (uno por motivo), filas vacias contadas, columna con formato de
// hora de Excel, cortes <180/<300/<480/<600 en el navegador y en SQL, la
// consulta por cola y por mes, la vista, los titulos de salida mas grandes,
// la plantilla, el manual y el pendiente del filtro de meses. Todo SINTETICO.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('../../public/js/whatsapp-tiempos-logic.js');
const XLSX = require('../../public/js/vendor/xlsx-0.20.3.full.min.js');
const { gdGraficaHtml } = require('../../public/js/secciones-logic.js');
const { libro } = require('../../scripts/plantillas/generar-plantillas.js');
const { CARGAS } = require('../../scripts/plantillas/modulos.js');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const RAIZ = path.join(__dirname, '..', '..');
const HEADER7 = ['CONN_ID', 'SKILL_ID', 'SKILL_NAME', 'DATE', 'RESULT', 'ANI', 'ANSWER_TIME'];
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const fila = (skill, at, extra) => Object.assign(["'0000.2856.0108", 4327, skill, new Date(2026, 8, 3, 10, 5), 'ANSWER', null, at], extra || {});

// ── Lectura de ANSWER_TIME ────────────────────────────────────────────────

test('ANSWER_TIME en los formatos de Wolkvox: numero, texto, apostrofo, hh:mm:ss, mm:ss, miles y coma decimal', () => {
  const casos = [[95, 95], ['95', 95], ["'5742", 5742], [" '5742 ", 5742], ['00:01:35', 95], ['01:35:42', 5742], ['01:35', 95],
    ['5.742', 5742], ['5,742', 5742], ['12,5', 13], [0, 0], [new Date(1899, 11, 30, 0, 1, 35), 95]];
  const r = L.wppTiemposParseFilas([HEADER7].concat(casos.map(([v]) => fila('WHATSAPP ORLANT GENERAL', v))));
  assert.deepEqual(r.avisos, []);
  assert.deepEqual(r.filas.map((f) => f[3]), casos.map(([, s]) => s));
});

test('el error real: 5.000 filas con ANSWER_TIME como texto con apostrofo se cargan TODAS (antes: 5.000 avisos)', () => {
  const aoa = [HEADER7];
  for (let k = 0; k < 5000; k++) aoa.push(fila(k % 3 ? 'WHATSAPP ORLANT GENERAL' : 'CALL INBOUND ORLANT 3P', "'" + (k * 7 % 900)));
  const r = L.wppTiemposParseFilas(aoa);
  assert.equal(r.avisos.length, 0);
  assert.equal(r.filas.length + r.ignoradasNoWhatsapp, 5000);
  assert.equal(r.ignoradasNoWhatsapp, 1667);
});

test('ida y vuelta por un .xlsx real (SheetJS de la app): apostrofo y hh:mm:ss se leen igual que un numero', () => {
  for (const formato of [(s) => s, (s) => "'" + s, (s) => [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((x) => String(x).padStart(2, '0')).join(':')]) {
    const aoa = [HEADER7, fila('WHATSAPP ORLANT 3P', formato(179)), fila('WHATSAPP ORLANT 3P', formato(180)), fila('CONFIRMACIONES', formato(10)), fila('WHATSAPP ORLANT 3P', formato(5742))];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'HistQueue20261023-104621');
    const leido = XLSX.read(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer', sheetStubs: true, cellNF: true });
    const ws = leido.Sheets[leido.SheetNames[0]];
    const r = L.wppTiemposParseFilas(XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null }), ws);
    assert.deepEqual(r.avisos, []);
    assert.deepEqual(r.filas.map((f) => f[3]), [179, 180, 5742]);
    assert.deepEqual(r.porRango, { r0_3: 1, r3_5: 1, r5_8: 0, r8_10: 0, r10: 1 });
    assert.equal(r.ignoradasNoWhatsapp, 1);
  }
});

test('columna con formato de hora de Excel: la fraccion de dia se pasa a segundos (antes caia todo en 0 a 3 minutos)', () => {
  const ws = { '!ref': 'A1:D3', D2: { t: 'n', v: 95 / 86400, z: '[h]:mm:ss' }, D3: { t: 'n', v: 700 / 86400, z: '[h]:mm:ss' } };
  const aoa = [['SKILL_NAME', 'DATE', 'RESULT', 'ANSWER_TIME'], ['WHATSAPP X', '2026-09-01 09:00', 'ANSWER', 95 / 86400], ['WHATSAPP X', '2026-09-01 09:00', 'ANSWER', 700 / 86400]];
  assert.deepEqual(L.wppTiemposParseFilas(aoa, ws).filas.map((f) => f[3]), [95, 700]);
  const wsGeneral = { '!ref': 'A1:D2', D2: { t: 'n', v: 95, z: 'General' } };
  assert.deepEqual(L.wppTiemposParseFilas([aoa[0], ['WHATSAPP X', '2026-09-01 09:00', 'ANSWER', 95]], wsGeneral).filas[0][3], 95);
});

test('solo se omiten las filas vacias (y se cuentan); lo ilegible va en UN aviso agrupado con las primeras filas', () => {
  const aoa = [HEADER7, fila('WHATSAPP A', 30), [null, null, null, null, null, null, null], ['', ' ', "'", null, null, null, null], fila('WHATSAPP A', null), fila('WHATSAPP A', "'")];
  for (let k = 0; k < 8; k++) aoa.push(fila('WHATSAPP A', 'abc'));
  const r = L.wppTiemposParseFilas(aoa);
  assert.equal(r.filas.length, 1);
  assert.equal(r.vacias, 4, '2 filas totalmente vacias + 2 de WhatsApp con la celda ANSWER_TIME vacia');
  assert.deepEqual(r.avisos, [
    '8 fila(s) de WhatsApp con un ANSWER_TIME que no se pudo leer como segundos, se omitieron (filas 7, 8, 9, 10, 11 y 3 más).',
    '2 fila(s) de WhatsApp sin ANSWER_TIME (celda vacia), se omitieron (filas 5, 6).',
  ]);
  // Filas en blanco que SheetJS ya no entrega (blankrows:false) tambien cuentan.
  const ws = { '!ref': 'A1:G20' };
  assert.equal(L.wppTiemposParseFilas([HEADER7, fila('WHATSAPP A', 30)], ws).vacias, 18);
});

// ── Cortes en SQL y consulta por cola / por mes ───────────────────────────

test('API: cortes <180/<300/<480/<600 en SQL y /resumen con conteo y % por cola (del mes) y por mes (de la cola)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const filas = [];
  [179, 180, 299, 300, 479, 480, 599, 600].forEach((s, k) => filas.push(['WHATSAPP ORLANT GENERAL', '2025-05-' + String(1 + k).padStart(2, '0'), 9, s]));
  [10, 20, 700].forEach((s, k) => filas.push(['WHATSAPP ORLANT 3P', '2025-05-1' + k, 9, s]));
  [10, 900].forEach((s, k) => filas.push(['WHATSAPP ORLANT GENERAL', '2025-06-0' + (k + 1), 9, s]));
  const c = await request(app).post('/api/calidad/whatsapp-tiempos/carga').set(auth(admin)).send({ campana: 'ORLANT', filas });
  assert.equal(c.status, 201, JSON.stringify(c.body));

  const r = await request(app).get('/api/calidad/whatsapp-tiempos/rangos').query({ campana: 'ORLANT', mes: '2025-05', skill: 'WHATSAPP ORLANT GENERAL' }).set(auth(admin));
  assert.deepEqual(r.body.rangos.map((x) => [x.label, x.cantidad]), [['0 a 3 minutos', 1], ['3 a 5 minutos', 2], ['5 a 8 minutos', 2], ['8 a 10 minutos', 2], ['10 minutos en adelante', 1]]);

  const s = await request(app).get('/api/calidad/whatsapp-tiempos/resumen').query({ campana: 'ORLANT', mes: '2025-05' }).set(auth(admin));
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.deepEqual(s.body.porSkill.map((g) => [g.skill, g.total, g.rangos.map((x) => x.cantidad)]), [
    ['WHATSAPP ORLANT 3P', 3, [2, 0, 0, 0, 1]],
    ['WHATSAPP ORLANT GENERAL', 8, [1, 2, 2, 2, 1]],
  ]);
  assert.equal(s.body.porSkill[0].rangos[0].pct, 66.7);
  const meses = s.body.porMes.filter((g) => g.mes.startsWith('2025'));
  assert.deepEqual(meses.map((g) => [g.mes, g.total]), [['2025-05', 11], ['2025-06', 2]]);

  const sCola = await request(app).get('/api/calidad/whatsapp-tiempos/resumen').query({ campana: 'ORLANT', mes: '2025-05', skill: 'WHATSAPP ORLANT 3P' }).set(auth(admin));
  assert.deepEqual(sCola.body.porMes.map((g) => [g.mes, g.total]), [['2025-05', 3]], 'por mes respeta la cola elegida');
  assert.equal(sCola.body.porSkill.length, 2, 'por cola siempre muestra todas las colas del mes');

  const sinAcceso = await request(app).get('/api/calidad/whatsapp-tiempos/resumen').query({ campana: 'ORLANT', mes: '05-2025' }).set(auth(admin));
  assert.equal(sinAcceso.status, 400);
});

// ── Vista: tablas por cola y por mes ──────────────────────────────────────

test('Vista: debajo de la tabla del mes, tablas "Por cola" y "Por mes" con conteo y % de cada rango', async () => {
  const el = {};
  const rangos = (c) => L.WPP_TIEMPOS_RANGOS.map((x, k) => ({ key: x.key, label: x.label, cantidad: c[k], pct: Math.round(c[k] / c.reduce((a, b) => a + b, 0) * 1000) / 10 }));
  const resumen = { mes: '2026-09', porSkill: [{ skill: 'WHATSAPP ORLANT 3P', total: 10, rangos: rangos([5, 1, 1, 1, 2]) }], porMes: [{ mes: '2026-08', total: 4, rangos: rangos([1, 1, 1, 1, 0]) }, { mes: '2026-09', total: 10, rangos: rangos([5, 1, 1, 1, 2]) }] };
  const sandbox = {
    document: { getElementById: (id) => (el[id] = el[id] || { id, innerHTML: '', value: '', dataset: id === 'gd-p0' ? { campana: 'ORLANT' } : {} }), querySelector: () => null },
    apiRequest: async (m, url) => {
      if (url.indexOf('/opciones') !== -1) return { meses: ['2026-08', '2026-09'], skills: ['WHATSAPP ORLANT 3P'] };
      if (url.indexOf('/resumen') !== -1) return resumen;
      return { mes: '2026-09', total: 10, dias: 3, rangos: rangos([5, 1, 1, 1, 2]) };
    },
    _gd: { mesSel: '2026-09' }, _traficoWppSubtabActivo: { ORLANT: 'sl' }, _gdChart: () => {}, esc: (s) => String(s),
    mesNombreLargo: (m) => ({ '2026-08': 'Agosto 2026', '2026-09': 'Septiembre 2026' }[m] || m),
    fechaLimitesFinDeMesActual: () => '2026-10-31', wppTiemposMesPorDefecto: L.wppTiemposMesPorDefecto,
    WPP_TIEMPOS_RANGOS: L.WPP_TIEMPOS_RANGOS, gdGraficaHtml, canLoadData: () => true,
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'public', 'js', 'whatsapp-tiempos.js'), 'utf8'), sandbox);
  await sandbox._wppTiemposRender(0, 'ORLANT');
  const html = el['wtt-resumen-0'].innerHTML;
  assert.match(html, /<h3 class="gd-grafica-titulo">Por cola — Septiembre 2026<\/h3>/);
  assert.match(html, /<h3 class="gd-grafica-titulo">Por mes — todas las colas<\/h3>/);
  assert.match(html, /<th>0 a 3 minutos<\/th><th>3 a 5 minutos<\/th><th>5 a 8 minutos<\/th><th>8 a 10 minutos<\/th><th>10 minutos en adelante<\/th><th>Total<\/th>/);
  assert.match(html, /<td>WHATSAPP ORLANT 3P<\/td><td>5 <span class="wtt-pct">\(50 %\)<\/span><\/td>/);
  assert.match(html, /<td>Agosto 2026<\/td><td>1 <span class="wtt-pct">\(25 %\)<\/span><\/td>/);
  assert.match(el['wtt-kpis-0'].innerHTML, /% contestado en 0 a 3 minutos/);
  const porCola = sandbox._wppTiemposDatosPorCola('ORLANT');
  assert.deepEqual(Object.keys(porCola[0]).slice(0, 4), ['Mes', 'Cola', '0 a 3 minutos', '0 a 3 minutos (%)']);
  assert.equal(sandbox._wppTiemposDatosPorMes('ORLANT').length, 2);
});

// ── Titulos de salida, plantilla, manual y pendiente ──────────────────────

test('"Llamadas de salida" y "WhatsApp de salida" van con el titulo destacado (--fs-h3); las demas graficas no cambian', () => {
  assert.equal(gdGraficaHtml('X', '<p></p>'), '<section class="gd-grafica"><h3 class="gd-grafica-titulo">X</h3><p></p></section>');
  assert.match(gdGraficaHtml('X', '', { destacado: true }), /<h3 class="gd-grafica-titulo gd-grafica-titulo-destacado">X<\/h3>/);
  const salida = fs.readFileSync(path.join(RAIZ, 'public', 'js', 'salida.js'), 'utf8');
  assert.match(salida, /gdGraficaHtml\('Llamadas de salida', [^\n]*, \{ destacado: true \}\);/);
  assert.match(salida, /gdGraficaHtml\('WhatsApp de salida', [^\n]*, \{ destacado: true \}\);/);
  const css = fs.readFileSync(path.join(RAIZ, 'public', 'css', 'styles.css'), 'utf8');
  assert.match(css, /\.gd-grafica-titulo-destacado\{ font-size:var\(--fs-h3\); font-weight:var\(--fw-bold\); \}/);
});

test('plantilla, manual y Cargar Datos dicen de donde se descarga (Wolkvox > ... > 10. Detalle de llamadas contestadas) y los rangos', () => {
  const ruta = 'Wolkvox > Reportes > Skills & Servicios > 10. Detalle de llamadas contestadas';
  const c = CARGAS.find((x) => x.modulo === 'whatsapp_tiempos');
  const wb = libro(c);
  assert.deepEqual(XLSX.utils.sheet_to_json(wb.Sheets.WHATSAPP_TIEMPOS, { header: 1 })[0], ['SKILL_NAME', 'DATE', 'RESULT', 'ANSWER_TIME']);
  const ins = XLSX.utils.sheet_to_json(wb.Sheets.INSTRUCCIONES, { header: 1 }).map((r) => r.join(' | ')).join('\n');
  assert.ok(ins.includes(ruta), 'INSTRUCCIONES dice de donde sale');
  assert.match(ins, /menos de 180 s = 0 a 3 minutos; menos de 300 s = 3 a 5 minutos; menos de 480 s = 5 a 8 minutos; menos de 600 s = 8 a 10 minutos; 600 s o más = 10 minutos en adelante/);
  // El archivo commiteado es el que sale del generador.
  const commiteado = XLSX.read(fs.readFileSync(path.join(RAIZ, 'server', 'plantillas', 'PLANTILLA_WHATSAPP_TIEMPOS.xlsx')), { type: 'buffer' });
  assert.ok(XLSX.utils.sheet_to_json(commiteado.Sheets.INSTRUCCIONES, { header: 1 }).map((r) => r.join(' | ')).join('\n').includes(ruta));
  for (const archivo of [path.join(RAIZ, 'docs', 'guia-uso-orlant.md'), path.join(RAIZ, 'server', 'paginas', 'guia-uso.html')]) {
    const t = fs.readFileSync(archivo, 'utf8').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/<\/?strong>/g, '').replace(/\*\*/g, '').replace(/\s+/g, ' ');
    assert.ok(t.includes(ruta), archivo + ' dice de donde se descarga');
    for (const x of ['menos de 180 s', '0 a 3 minutos', 'menos de 600 s', '8 a 10 minutos', '600 s o más', '10 minutos en adelante']) assert.ok(t.includes(x), archivo + ': ' + x);
  }
  const plan = fs.readFileSync(path.join(RAIZ, 'public', 'js', 'cargas-logic.js'), 'utf8').replace(/' \+\s*'/g, '');
  assert.ok(plan.includes(ruta), 'la pantalla de Cargar Datos tambien lo dice');
});

test('pendiente del filtro de meses (Edwin, Fase 165): resuelto en la Fase 167 -- sale de pendientes y la guia lo explica', () => {
  const p = fs.readFileSync(path.join(RAIZ, 'docs', 'pendientes.md'), 'utf8');
  assert.doesNotMatch(p, /Filtro de meses más dinámico/);
  const guia = fs.readFileSync(path.join(RAIZ, 'docs', 'guia-uso-orlant.md'), 'utf8');
  assert.ok(guia.includes('El filtro **MESES** — para ver varios meses sueltos lado a lado'));
});
