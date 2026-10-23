// fase153-centro-cargas.test.js — Fase 153: datos del Centro
// de cargas (solo lectura). Conteos por mes reales, fechas de carga en
// formatos mezclados, lista cerrada de plantillas y logica de la cuadricula.
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { app, db, request, tokenFor, MASTER_PASSWORD, cleanup } = require('./helpers');
const CC = require('../centro-cargas');
const { CATALOGO } = require('../plantillas-cliente');
const { CARGAS } = require('../../scripts/plantillas/modulos');
const L = require('../../public/js/centro-cargas-logic.js');

after(cleanup);
const auth = (t) => ({ Authorization: 'Bearer ' + t });

// Fase 173: "dd/mm/aaaa hh:mm:ss" es la hora local del proceso (la de nowStr).
test('instanteCarga: ISO en UTC y "dd/mm/aaaa hh:mm:ss" en la hora local del proceso', () => {
  assert.equal(CC.instanteCarga('16/10/2026 08:13:37'), new Date(2026, 9, 16, 8, 13, 37).getTime());
  assert.equal(CC.instanteCarga('2026-10-16T13:13:37.000Z'), Date.parse('2026-10-16T13:13:37Z'));
  assert.equal(CC.instanteCarga('basura'), null);
});

test('resumen por mes: registros, ultima carga (la mas reciente aunque el formato sea dd/mm), quien y archivo', () => {
  const ins = db.prepare(`INSERT INTO calidad_nivel_servicio_diario (campana, fecha, skillName, totalLlamadas, contestadas, archivoNombre, cargadoPorNombre, createdAt)
    VALUES ('ORLANT', ?, 'SKILL X', 10, 9, ?, ?, ?)`);
  ins.run('2026-08-01', 'viejo.xlsx', 'Persona A', '02/09/2026 10:00:00');
  ins.run('2026-08-02', 'nuevo.xlsx', 'Persona B', '15/09/2026 09:00:00');
  ins.run('2026-08-03', 'medio.xlsx', 'Persona C', '09/09/2026 23:00:00');
  const carga = CC.CARGAS_POR_MODULO.flujo_llamadas[0];
  const meses = CC.resumenCarga(db, 'ORLANT', carga, 2026);
  assert.equal(meses.length, 12);
  const ago = meses.find((m) => m.mes === '2026-08');
  assert.equal(ago.registros, 3);
  assert.equal(ago.archivo, 'nuevo.xlsx', 'la carga mas reciente, no la mayor como texto');
  assert.equal(ago.cargadoPor, 'Persona B');
  assert.equal(ago.ultimaCarga, new Date(2026, 8, 15, 9, 0, 0).toISOString());
  assert.equal(meses.find((m) => m.mes === '2026-07').registros, 0);
  db.prepare("DELETE FROM calidad_nivel_servicio_diario WHERE skillName = 'SKILL X'").run();
});

test('Tipificacion: un conteo por canal; los modulos salen del registro, en el orden del catalogo', () => {
  const mods = CC.resumenCliente(db, 'MOBILIZE', 2026, CATALOGO);
  assert.deepEqual(mods.map((m) => m.id), ['llamadas_unicas', 'tipificacion', 'encuesta', 'calidad', 'calidad_resumen', 'flujo_llamadas'].sort((a, b) => CATALOGO.findIndex((x) => x.id === a) - CATALOGO.findIndex((x) => x.id === b)));
  assert.deepEqual(mods.find((m) => m.id === 'tipificacion').cargas.map((c) => c.id), ['tipificacion_llamadas', 'tipificacion_whatsapp']);
  assert.equal(CC.resumenCliente(db, 'NO EXISTE', 2026, CATALOGO), null);
});

test('plantillas descargables = las de P1 (scripts/plantillas/modulos.js) y existen', () => {
  assert.deepEqual(CC.PLANTILLAS_DESCARGABLES.slice().sort(), CARGAS.map((c) => c.archivo).sort());
  CC.PLANTILLAS_DESCARGABLES.forEach((p) => assert.ok(fs.existsSync(path.join(__dirname, '..', 'plantillas', p)), p));
});

test('descarga de plantilla: lista cerrada (nunca una ruta armada por el navegador)', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const ok = await request(app).get('/api/centro-cargas-plantillas/PLANTILLA_ENCUESTA.xlsx').set(auth(t));
  assert.equal(ok.status, 200);
  for (const malo of ['..%2Fdb.js', 'PLANTILLA_LLAMADAS_UNICAS_MOBILIZE.xlsx', 'x.xlsx']) {
    const r = await request(app).get('/api/centro-cargas-plantillas/' + malo).set(auth(t));
    assert.equal(r.status, 404, malo);
  }
  const anio = await request(app).get('/api/centro-cargas/ORLANT?anio=1999').set(auth(t));
  assert.equal(anio.status, 400);
});

test('logica de la cuadricula: estados, textos y pestana -> modulo', () => {
  assert.equal(L.centroEstadoMes({ mes: '2026-08', registros: 668 }, '2026-10'), 'cargado');
  assert.equal(L.centroEstadoMes({ mes: '2026-08', registros: 0 }, '2026-10'), 'vacio');
  assert.equal(L.centroEstadoMes({ mes: '2026-10', registros: 5 }, '2026-10'), 'en_curso');
  assert.equal(L.centroEstadoMes({ mes: '2026-11', registros: 0 }, '2026-10'), 'futuro');
  assert.equal(L.centroTextoRegistros(668), '668 registros');
  assert.equal(L.centroTextoRegistros(15230), '15.230 registros');
  assert.equal(L.centroTextoRegistros(1), '1 registro');
  assert.equal(L.centroNombreMes('2026-08'), 'Agosto 2026');
  assert.equal(L.centroFechaCorta('2026-10-16T13:13:37Z'), '16/10/2026 08:13');
  assert.equal(L.centroModuloDeTab({ panels: [{ tipo: 'trafico_combo' }] }), 'flujo_llamadas');
  assert.equal(L.centroModuloDeTab({ panels: [{ tipo: 'combo' }] }), null, 'pestana manual: sin modulo');
  const carga = { meses: ['2026-04', '2026-05', '2026-06', '2026-07'].map((m, i) => ({ mes: m, registros: i === 1 ? 0 : 10 })) };
  assert.deepEqual(L.centroHuecos(carga, '2026-10'), ['2026-05']);
  // Todo modulo del catalogo tiene sus cargas en el Centro, y todo panel con datos su modulo.
  CATALOGO.forEach((m) => assert.ok(CC.CARGAS_POR_MODULO[m.id], m.id));
  Object.values(L.CENTRO_PANEL_A_MODULO).forEach((id) => assert.ok(CATALOGO.some((m) => m.id === id), id));
});

test('Descargar lo cargado: filas del mes, sin columnas internas ni de contacto; Calidad no se descarga aqui', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const ins = db.prepare(`INSERT INTO llamadas_salida (campana, fecha, tipo, agente, tipificacion, archivoNombre, cargadoPorNombre, createdAt)
    VALUES ('MOBILIZE', ?, 'CONECTADA', 'Asesor Ficticio', 'Seguimiento', 'salida.xlsx', 'Persona A', '2026-09-02T10:00:00Z')`);
  ins.run('2026-08-05'); ins.run('2026-08-20'); ins.run('2026-09-01');
  const r = await request(app).get('/api/centro-cargas/MOBILIZE/llamadas_salida/2026-08/datos').set(auth(t));
  assert.equal(r.status, 200);
  assert.equal(r.body.filas.length, 2, 'solo agosto');
  assert.deepEqual(r.body.filas.map((f) => f.fecha), ['2026-08-05', '2026-08-20']);
  CC.COLUMNAS_EXCLUIDAS.forEach((c) => assert.ok(!r.body.columnas.includes(c), c));
  assert.ok(r.body.columnas.includes('agente') && r.body.columnas.includes('archivoNombre'));
  for (const [url, st] of [['/MOBILIZE/calidad/2026-08/datos', 404], ['/MOBILIZE/no_existe/2026-08/datos', 404], ['/MOBILIZE/llamadas_salida/2026-13/datos', 400], ['/MOBILIZE/llamadas_salida/x/datos', 400]]) {
    assert.equal((await request(app).get('/api/centro-cargas' + url).set(auth(t))).status, st, url);
  }
  // Tipificacion: cada canal descarga solo sus filas.
  const tip = db.prepare(`INSERT INTO tipificaciones (campana, canal, agente, fecha, tipificacion, skill, archivoNombre, cargadoPorNombre, createdAt)
    VALUES ('MOBILIZE', ?, 'Asesor Ficticio', '2026-08-03', 'Consulta', 'SKILL', 'cdr.xlsx', 'Persona A', '2026-09-02T10:00:00Z')`);
  tip.run('LLAMADAS'); tip.run('WHATSAPP'); tip.run('WHATSAPP');
  const w = await request(app).get('/api/centro-cargas/MOBILIZE/tipificacion_whatsapp/2026-08/datos').set(auth(t));
  assert.equal(w.body.filas.length, 2);
  assert.ok(w.body.filas.every((f) => f.canal === 'WHATSAPP'));
  db.prepare("DELETE FROM llamadas_salida WHERE agente = 'Asesor Ficticio'").run();
  db.prepare("DELETE FROM tipificaciones WHERE agente = 'Asesor Ficticio'").run();
});

test('nombre del Excel descargado: cliente, mes y carga, sin caracteres raros', () => {
  assert.equal(L.centroNombreArchivoDescarga('MOBILIZE', 'llamadas_unicas', '2026-08'), 'MOBILIZE_2026-08_LLAMADAS_UNICAS.xlsx');
  assert.equal(L.centroNombreArchivoDescarga('CLINICA AURORA', 'flujo_llamadas', '2026-08'), 'CLINICA_AURORA_2026-08_FLUJO_LLAMADAS.xlsx');
});

test('PR 1: Subir/Reemplazar abren la pantalla de carga de siempre y al cerrarla se vuelve al Centro; no hay acciones simuladas', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'centro-cargas.js'), 'utf8');
  assert.doesNotMatch(js, /Maqueta|no se guardó|no se eliminó/i);
  assert.match(js, /await openCargas\(\);/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'cargas.js'), 'utf8'), /centroVolverTrasCarga\(\)/);
  // PR 3: Eliminar ya es real (DELETE con confirmacion y Deshacer; fase153-eliminar.test.js).
  assert.match(js, /apiRequest\('DELETE', '\/centro-cargas\//);
});
