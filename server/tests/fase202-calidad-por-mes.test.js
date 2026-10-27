// Fase 202 (Mobilize, Calidad): el archivo de Edwin trae una hoja por mes
// (AGOSTO, SEPTIEMBRE, OCTUBRE) con las columnas de la plantilla de la Fase
// 172. La carga lo recibe tal cual y cada hoja va a su mes. El panel muestra
// la torta con el % de monitoreos por asesor y las barras con el Prom.
// puntaje (%) por asesor; la tabla sigue con clasificación y fallos críticos.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');
const L = require('../../public/js/calidad-resumen-logic.js');
const XLSX = require('../../public/js/vendor/xlsx-0.20.3.full.min.js');

const RAIZ = path.join(__dirname, '..', '..');
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const ENC = ['Nombre del Asesor ← Escribir aquí', '# Monitoreos', 'Prom. Puntaje (%)', 'Clasificación', 'Alerta Críticos', 'Total Fallos Críticos'];

test('mes de cada hoja: nombre del mes con o sin tildes/año; otras hojas no', () => {
  assert.deepEqual(L.calidadResumenMesDeHoja('AGOSTO'), { mes: 8, anio: null });
  assert.deepEqual(L.calidadResumenMesDeHoja(' Septiembre '), { mes: 9, anio: null });
  assert.deepEqual(L.calidadResumenMesDeHoja('setiembre'), { mes: 9, anio: null });
  assert.deepEqual(L.calidadResumenMesDeHoja('OCTUBRE 2025'), { mes: 10, anio: 2025 });
  for (const otro of ['Hoja1', 'CALIDAD_RESUMEN', 'Monitoreos', '', null]) assert.equal(L.calidadResumenMesDeHoja(otro), null, String(otro));
});

test('año: el del mes de referencia; un mes posterior es del año anterior; el año de la hoja manda', () => {
  assert.equal(L.calidadResumenPeriodoDeHoja({ mes: 8, anio: null }, '2026-10'), '2026-08');
  assert.equal(L.calidadResumenPeriodoDeHoja({ mes: 10, anio: null }, '2026-10'), '2026-10');
  assert.equal(L.calidadResumenPeriodoDeHoja({ mes: 12, anio: null }, '2027-01'), '2026-12');
  assert.equal(L.calidadResumenPeriodoDeHoja({ mes: 10, anio: 2025 }, '2026-10'), '2025-10');
  assert.equal(L.calidadResumenPeriodoDeHoja({ mes: 8, anio: null }, ''), null);
});

test('torta: % de monitoreos por asesor, suma 100', () => {
  assert.deepEqual(L.calidadResumenPctMonitoreos([{ monitoreos: 9 }, { monitoreos: 9 }, { monitoreos: 9 }]), [33.3, 33.3, 33.3]);
  assert.deepEqual(L.calidadResumenPctMonitoreos([{ monitoreos: 3 }, { monitoreos: 1 }]), [75, 25]);
  assert.deepEqual(L.calidadResumenPctMonitoreos([{ monitoreos: 0 }]), [null]);
});

test('libro con 3 hojas de mes: cada hoja se lee con la plantilla (sin nombres en la prueba: asesores ficticios)', () => {
  const wb = XLSX.utils.book_new();
  const hojas = { AGOSTO: [['Asesor A', 5, 98, '', '', 0], ['Asesor B', 6, 98, '', '', 0]], SEPTIEMBRE: [['Asesor A', 12, 97, '', '', 1], ['Asesor B', 11, 98, '', '', 1], ['Asesor C', 11, 97.06, '', '', 0]], OCTUBRE: [['Asesor A', 9, 97, '', '', 2], ['Asesor B', 9, 97.33, '', '', 0], ['Asesor C', 9, 97.33, '', '', 0]] };
  for (const [n, filas] of Object.entries(hojas)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([ENC, ...filas]), n);
  const leido = XLSX.read(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' });
  const r = leido.SheetNames.map((n) => {
    const ws = leido.Sheets[n];
    const p = L.calidadResumenParseFilas(XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null }), ws);
    return [L.calidadResumenPeriodoDeHoja(L.calidadResumenMesDeHoja(n), '2026-10'), p.filas.length, p.monitoreos, p.promedio];
  });
  assert.deepEqual(r, [['2026-08', 2, 11, 98], ['2026-09', 3, 34, 97.34], ['2026-10', 3, 27, 97.22]]);
});

test('API: guardar mes por mes reemplaza solo ese mes (octubre corregido, agosto y septiembre nuevos)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const post = (url, body) => request(app).post('/api' + url).set(auth(admin)).send(body);
  // Octubre "viejo" (el de antes, 34 monitoreos).
  await post('/calidad/calidad-resumen/carga', { campana: 'MOBILIZE', mes: '2025-10', archivoNombre: 'viejo.xlsx', filas: [['Asesor A', 12, 97, 1], ['Asesor B', 11, 98, 1], ['Asesor C', 11, 97.06, 0]] });
  const meses = { '2025-08': [['Asesor A', 5, 98, 0], ['Asesor B', 6, 98, 0]], '2025-10': [['Asesor A', 9, 97, 2], ['Asesor B', 9, 97.33, 0], ['Asesor C', 9, 97.33, 0]] };
  const imp = (await post('/calidad/calidad-resumen/carga/impacto', { campana: 'MOBILIZE', mes: '2025-10', filas: meses['2025-10'] })).body;
  assert.deepEqual([imp.filasExistentes, imp.filasNuevas, imp.monitoreos], [3, 3, 27]);
  for (const [mes, filas] of Object.entries(meses)) assert.equal((await post('/calidad/calidad-resumen/carga', { campana: 'MOBILIZE', mes, archivoNombre: 'por-mes.xlsx', filas })).status, 201);
  const res = (await request(app).get('/api/calidad/calidad-resumen/mensual').query({ campana: 'MOBILIZE' }).set(auth(admin))).body;
  const m = (p) => res.meses.find((x) => x.mes === p);
  assert.deepEqual([m('2025-08').monitoreos, m('2025-08').promedio], [11, 98]);
  assert.deepEqual([m('2025-10').monitoreos, m('2025-10').promedio, m('2025-10').fallos], [27, 97.22, 2]);
});

test('carga y panel: hojas por mes en cargas.js; torta y barras en el panel; tabla con clasificación y fallos', () => {
  const cargas = fs.readFileSync(path.join(RAIZ, 'public', 'js', 'cargas.js'), 'utf8');
  assert.match(cargas, /if\(r\.porMes\) return _cargasGuardarCalidadResumenPorMes\(cliente, r\);/);
  assert.match(cargas, /El archivo trae dos hojas del mismo mes/);
  assert.match(cargas, /confirm\('El archivo trae una hoja por mes\. Se va a guardar:\\n\\n'/);
  const panel = fs.readFileSync(path.join(RAIZ, 'public', 'js', 'calidad-resumen.js'), 'utf8');
  assert.match(panel, /_gdChart\('calres-c-pie-'\+i, \{ type: 'pie'/);
  assert.match(panel, /_gdChart\('calres-c-bar-'\+i, \{ type: 'bar'/);
  assert.match(panel, /<th>Clasificación<\/th><th>Alerta críticos<\/th><th>Fallos críticos<\/th>/);
  assert.match(panel, /'% de monitoreos': pctsExp\[k\]/);
});
