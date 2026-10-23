// fase172-calidad-resumen.test.js — Fase 172 (pedido de Edwin): "Calidad:
// resumen por asesor" de Mobilize con la plantilla de Edwin (una fila por
// asesor; # Monitoreos, Puntaje y Fallos son formulas a un libro externo y
// se leen sus valores ya calculados). Todo SINTETICO (nombres y puntajes
// inventados).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const XLSX = require('../../public/js/vendor/xlsx-0.20.3.full.min.js');
const L = require('../../public/js/calidad-resumen-logic.js');
const CC = require('../../public/js/centro-cargas-logic.js');
const { generarLayout, PERFILES_ACTUALES } = require('../plantillas-cliente');
const reg = require('../clientes-registro');
const { request, app, tokenFor, MASTER_PASSWORD, SEED, db } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const ENC = ['Nombre del Asesor ← Escribir aquí', '# Monitoreos', 'Prom. Puntaje (%)', 'Clasificación', 'Alerta Críticos', 'Total Fallos Críticos'];

// Hoja como la de Edwin: B, C y F son formulas a un libro externo con su valor calculado.
function hojaEdwin(filas) {
  const ws = {};
  ENC.forEach((h, c) => { ws[XLSX.utils.encode_cell({ r: 0, c })] = { t: 's', v: h }; });
  filas.forEach((f, k) => {
    const r = k + 1;
    ws[XLSX.utils.encode_cell({ r, c: 0 })] = { t: 's', v: f.nombre };
    const num = (c, v, formula) => {
      ws[XLSX.utils.encode_cell({ r, c })] = v === 'ERR' ? { t: 'e', v: 0x17, w: '#REF!', f: formula } : { t: 'n', v, f: formula };
    };
    num(1, f.mon, 'IF(A2="","",COUNTIF([1]Monitoreos!$A$5:$A$500,A2))');
    num(2, f.pun, 'IFERROR(AVERAGEIF([1]Monitoreos!$A$5:$A$500,A2,[1]Monitoreos!$N$5:$N$500),"")');
    ws[XLSX.utils.encode_cell({ r, c: 3 })] = { t: 's', v: '🟢 SOBRESALIENTE' };
    ws[XLSX.utils.encode_cell({ r, c: 4 })] = { t: 's', v: '✅ SIN FALLOS CRÍTICOS' };
    num(5, f.fal, 'IFERROR(SUMIF([1]Monitoreos!$A$5:$A$500,A2,[1]Monitoreos!$P$5:$P$500),"")');
  });
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas.length, c: 5 } });
  return ws;
}
function leer(ws) {
  // Ida y vuelta por un .xlsx real, como lo lee el navegador.
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
  const rd = XLSX.read(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer', sheetStubs: true, cellNF: true });
  const h = rd.Sheets.Hoja1;
  return L.calidadResumenParseFilas(XLSX.utils.sheet_to_json(h, { header: 1, blankrows: false, defval: null }), h);
}

test('encabezado con "← Escribir aquí", espacios y mayusculas distintas se reconoce', () => {
  assert.deepEqual(L.calidadResumenColIndexMap(ENC), { agente: 0, monitoreos: 1, puntaje: 2, clasificacion: 3, alerta: 4, fallos: 5 });
  assert.deepEqual(L.calidadResumenColIndexMap(['  nombre del ASESOR  ', '#monitoreos', 'prom. puntaje(%)', 'CLASIFICACION', 'alerta criticos', 'total fallos criticos']),
    { agente: 0, monitoreos: 1, puntaje: 2, clasificacion: 3, alerta: 4, fallos: 5 });
});

test('formulas con valor calculado + nombres con espacios al final: se leen los valores; clasificacion y alerta se recalculan', () => {
  const r = leer(hojaEdwin([
    { nombre: 'Asesor Uno ', mon: 11, pun: 99.36363636, fal: 0 },
    { nombre: 'Asesor Dos  ', mon: 12, pun: 85.5, fal: 1 },
    { nombre: 'Asesor Tres ', mon: 11, pun: 64.2, fal: 3 },
    { nombre: '', mon: null, pun: null, fal: null },
  ].filter((f) => f.nombre !== '')));
  assert.deepEqual(r.avisos, []);
  assert.deepEqual(r.filas, [['Asesor Uno', 11, 99.36, 0], ['Asesor Dos', 12, 85.5, 1], ['Asesor Tres', 11, 64.2, 3]]);
  assert.equal(r.monitoreos, 34);
  assert.equal(r.promedio, Math.round(((11 * 99.36 + 12 * 85.5 + 11 * 64.2) / 34) * 100) / 100, 'ponderado por monitoreos');
  assert.deepEqual(r.filas.map((f) => L.calidadResumenClasificacion(f[2])), ['Sobresaliente', 'No crítico', 'Crítico']);
  assert.deepEqual(r.filas.map((f) => L.calidadResumenAlerta(f[3])), ['Sin fallos críticos', 'Alerta', 'Crítico frecuente']);
  // Bordes de las reglas (las mismas formulas del archivo).
  assert.deepEqual([69.99, 70, 89.99, 90].map(L.calidadResumenClasificacion), ['Crítico', 'No crítico', 'No crítico', 'Sobresaliente']);
  assert.deepEqual([0, 1, 2].map(L.calidadResumenAlerta), ['Sin fallos críticos', 'Alerta', 'Crítico frecuente']);
});

test('celda en error (#REF!) o sin valor: UN aviso agrupado que dice que abra el libro de Monitoreos', () => {
  const r = leer(hojaEdwin([
    { nombre: 'Asesor Uno', mon: 'ERR', pun: 'ERR', fal: 'ERR' },
    { nombre: 'Asesor Dos', mon: 10, pun: 92, fal: 0 },
    { nombre: 'Asesor Tres', mon: 'ERR', pun: 90, fal: 0 },
  ]));
  assert.deepEqual(r.filas.map((f) => f[0]), ['Asesor Dos']);
  assert.equal(r.avisos.length, 1);
  assert.match(r.avisos[0], /^2 asesor\(es\) con # Monitoreos, Puntaje o Fallos en error o sin valor, se omitieron \(filas 2, 4\)\. /);
  assert.ok(r.avisos[0].endsWith(L.CALIDAD_RESUMEN_MSG_FORMULAS));
  assert.equal(L.CALIDAD_RESUMEN_MSG_FORMULAS, 'Abra la plantilla junto con el libro de Monitoreos, deje que calcule y guárdela antes de subirla.');
  // Texto de error (sin hoja cruda) tambien cuenta.
  const t = L.calidadResumenParseFilas([ENC, ['X', '#¡REF!', 90, 0], ['Y', 5, '#REF!', 0]]);
  assert.equal(t.filas.length, 0);
  assert.equal(t.avisos.length, 1);
});

test('API: la carga reemplaza SOLO el mes elegido; el resumen sale por mes con promedio ponderado; permisos', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const sep = [['Asesor Uno', 10, 90, 0], ['Asesor Dos', 10, 80, 1]];
  const oct = [['Asesor Uno', 11, 99.36, 0], ['Asesor Dos', 12, 96.33, 1], ['Asesor Tres', 11, 96.45, 1]];
  const post = (mes, filas) => request(app).post('/api/calidad/calidad-resumen/carga').set(auth(admin)).send({ campana: 'MOBILIZE', mes, filas });
  assert.equal((await post('2025-09', sep)).status, 201);
  assert.equal((await post('2025-10', oct)).status, 201);
  const otra = await post('2025-10', oct); // recargar octubre
  assert.equal(otra.body.borradas, 3, 'reemplaza octubre');
  const r = await request(app).get('/api/calidad/calidad-resumen/mensual').query({ campana: 'MOBILIZE' }).set(auth(admin));
  const porMes = Object.fromEntries(r.body.meses.map((m) => [m.mes, m]));
  assert.equal(porMes['2025-09'].monitoreos, 20, 'septiembre intacto');
  assert.equal(porMes['2025-10'].monitoreos, 34);
  assert.equal(porMes['2025-10'].fallos, 2);
  assert.equal(porMes['2025-10'].promedio, Math.round(((11 * 99.36 + 12 * 96.33 + 11 * 96.45) / 34) * 100) / 100);
  assert.deepEqual(Object.fromEntries(porMes['2025-10'].asesores.map((a) => [a.agente, [a.clasificacion, a.alerta]])), { 'Asesor Uno': ['Sobresaliente', 'Sin fallos críticos'], 'Asesor Dos': ['Sobresaliente', 'Alerta'], 'Asesor Tres': ['Sobresaliente', 'Alerta'] });
  // Validacion y permisos.
  assert.equal((await request(app).post('/api/calidad/calidad-resumen/carga').set(auth(admin)).send({ campana: 'MOBILIZE', filas: oct })).status, 400, 'sin mes');
  assert.equal((await request(app).post('/api/calidad/calidad-resumen/carga').set(auth(admin)).send({ campana: 'MOBILIZE', mes: '2025-10', filas: [['A', 1, 130, 0]] })).status, 400, 'puntaje > 100');
  const inv = await tokenFor('mlopez', SEED.mlopez);
  assert.equal((await request(app).post('/api/calidad/calidad-resumen/carga').set(auth(inv)).send({ campana: 'MOBILIZE', mes: '2025-10', filas: oct })).status, 403);
  // Respaldo para Deshacer (Fase 153).
  assert.ok(db.prepare("SELECT COUNT(*) AS n FROM cargas_versiones WHERE carga = 'calidad_resumen' AND campana = 'MOBILIZE' AND mes = '2025-10'").get().n >= 1);
});

test('registro y tablero: MOBILIZE tiene el modulo y el panel va primero en Calidad; ORLANT no cambia', () => {
  const mob = reg.leerRegistro(db).find((c) => c.nombre === 'MOBILIZE');
  assert.ok(mob.modulos.includes('calidad_resumen'));
  assert.ok(!reg.leerRegistro(db).find((c) => c.nombre === 'ORLANT').modulos.includes('calidad_resumen'));
  const lay = JSON.parse(db.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'MOBILIZE'").get().layout);
  assert.equal(lay.tabs.find((t) => t.key === 'calidad').panels[0].tipo, 'calidad_resumen_panel');
  const orl = generarLayout(PERFILES_ACTUALES.ORLANT).layout.tabs.find((t) => t.key === 'calidad');
  assert.ok(!orl.panels.some((p) => p.tipo === 'calidad_resumen_panel'));
  // Idempotente.
  db.crearCalidadResumen();
  const lay2 = JSON.parse(db.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'MOBILIZE'").get().layout);
  assert.equal(lay2.tabs.find((t) => t.key === 'calidad').panels.filter((p) => p.tipo === 'calidad_resumen_panel').length, 1);
  assert.equal(reg.leerRegistro(db).find((c) => c.nombre === 'MOBILIZE').modulos.filter((m) => m === 'calidad_resumen').length, 1);
});

test('Centro de cargas: carga mensual sin fecha por fila (el mes es el de la tarjeta); el panel se registra en el tablero', () => {
  assert.equal(CC.centroEsMensual('calidad_resumen'), true);
  const r = { tipo: 'calidad_resumen', filas: [['A', 1, 90, 0]], avisos: [] };
  assert.equal(CC.centroFiltrarResultado(r, 'calidad_resumen', '2026-10'), r, 'no se quitan filas por fecha');
  const gen = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'dashboard-generic.js'), 'utf8');
  assert.match(gen, /if\(p\.tipo === 'calidad_resumen_panel'\)\{ _calidadResumenRenderPanel\(p, i\); return; \}/);
  assert.match(gen, /if\(p\.tipo === 'calidad_resumen_panel'\)\{ out = out\.concat\(await _gdExportarCalidadResumen\(p, i\)\); continue; \}/);
  assert.ok(require('../../public/js/dashboard-export-tipos.js').GD_EXPORT_TIPOS_SOPORTADOS.includes('calidad_resumen_panel'));
  assert.ok(require('../../public/js/mes-global-logic.js').GD_TIPOS_AUTONOMOS.includes('calidad_resumen_panel'));
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  assert.ok(html.indexOf('js/calidad-resumen-logic.js') < html.indexOf('js/calidad-resumen.js'));
  const vista = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'calidad-resumen.js'), 'utf8');
  assert.match(vista, /gdAplicarFiltroMeses\(datos\.meses \|\| \[\], function\(m\)\{ return m\.mes; \}\)/, 'la tabla por mes respeta el filtro MESES');
  assert.match(vista, /semaforoClaseCss\(nivel\)/, 'colores del semaforo');
});
