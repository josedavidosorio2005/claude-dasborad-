// fase153-centro-cargas.test.js — Fase 153 (P2, maqueta): datos del Centro
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

test('instanteCarga: ISO en UTC y "dd/mm/aaaa hh:mm:ss" hora Colombia dan el mismo instante', () => {
  assert.equal(CC.instanteCarga('16/10/2026 08:13:37'), Date.parse('2026-10-16T13:13:37Z'));
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
  assert.equal(ago.ultimaCarga, '2026-09-15T14:00:00.000Z');
  assert.equal(meses.find((m) => m.mes === '2026-07').registros, 0);
  db.prepare("DELETE FROM calidad_nivel_servicio_diario WHERE skillName = 'SKILL X'").run();
});

test('Tipificacion: un conteo por canal; los modulos salen del registro, en el orden del catalogo', () => {
  const mods = CC.resumenCliente(db, 'MOBILIZE', 2026, CATALOGO);
  assert.deepEqual(mods.map((m) => m.id), ['llamadas_unicas', 'tipificacion', 'encuesta', 'calidad', 'flujo_llamadas'].sort((a, b) => CATALOGO.findIndex((x) => x.id === a) - CATALOGO.findIndex((x) => x.id === b)));
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
