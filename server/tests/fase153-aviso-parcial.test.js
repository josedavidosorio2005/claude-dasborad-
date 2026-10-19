// fase153-aviso-parcial.test.js — Fase 153 (Centro de cargas): aviso de
// reemplazo parcial en la vista previa. El lector reemplaza SOLO las fechas
// que trae el archivo; el aviso dice cuales y cuantos registros del mes
// quedan igual ("El archivo trae del 5 al 7 de agosto. Se reemplazan esos
// dias; el resto de agosto (143 registros) queda igual.").
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { app, db, request, tokenFor, MASTER_PASSWORD, SEED, cleanup } = require('./helpers');
const L = require('../../public/js/centro-cargas-logic.js');
const { cargarLlamadasUnicas } = require('../llamadas-unicas');
const { cargarTipificaciones } = require('../tipificaciones');

after(cleanup);
const auth = (t) => ({ Authorization: 'Bearer ' + t });
const C = 'MOBILIZE';

test('texto del aviso: rango, resto del mes y mes vacio', () => {
  assert.equal(L.centroTextoReemplazoParcial('2026-08', { desde: '2026-08-05', hasta: '2026-08-07' }, { enMes: 155, enRango: 12 }),
    'El archivo trae del 5 al 7 de agosto. Se reemplazan esos días; el resto de agosto (143 registros) queda igual.');
  assert.equal(L.centroTextoReemplazoParcial('2026-08', { desde: '2026-08-05', hasta: '2026-08-05' }, { enMes: 1, enRango: 0 }),
    'El archivo trae solo el 5 de agosto. Se reemplazan esos días; el resto de agosto (1 registro) queda igual.');
  assert.equal(L.centroTextoReemplazoParcial('2026-08', { desde: '2026-08-01', hasta: '2026-08-31' }, { enMes: 40, enRango: 40 }),
    'El archivo trae del 1 al 31 de agosto. Se reemplazan esos días; agosto no tiene registros fuera de ellos.');
  assert.equal(L.centroTextoReemplazoParcial('2026-09', { desde: '2026-09-02', hasta: '2026-09-03' }, { enMes: 0, enRango: 0 }),
    'El archivo trae del 2 al 3 de septiembre. Septiembre no tiene datos todavía.');
});

test('centroRangoFilas: primera y ultima fecha segun el lector', () => {
  assert.deepEqual(L.centroRangoFilas('llamadas_unicas', [['a', '2026-08-07'], ['b', '2026-08-05'], ['c', '2026-08-06']]), { desde: '2026-08-05', hasta: '2026-08-07' });
  assert.deepEqual(L.centroRangoFilas('encuesta', [['2026-08-10'], ['2026-08-02']]), { desde: '2026-08-02', hasta: '2026-08-10' });
  assert.deepEqual(L.centroRangoFilas('tipificacion_llamadas', [{ fecha: '2026-08-03' }]), { desde: '2026-08-03', hasta: '2026-08-03' });
  assert.equal(L.centroRangoFilas('llamadas_unicas', []), null);
});

test('GET conteo: registros del mes y en el rango; Tipificacion por canal; permisos y validaciones', async () => {
  const filas = [];
  for (let d = 1; d <= 9; d++) filas.push(['A' + d, '2026-08-0' + d, 'CONTESTADA', 'S']);
  filas.push(['X', '2026-07-31', 'CONTESTADA', 'S']);
  cargarLlamadasUnicas(db, { campana: C, archivoNombre: 'a.xlsx', cargadoPorNombre: 'P', filas });
  const fila = (ag, f) => [ag, f, null, null, 'Consulta', 'SKILL', null, null, null, null, null];
  cargarTipificaciones(db, { campana: C, canal: 'WHATSAPP', archivoNombre: 'w.xlsx', cargadoPorNombre: 'P', filas: [fila('W', '2026-08-05')] });
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const url = (carga, mes, q) => '/api/centro-cargas/' + C + '/' + carga + '/' + mes + '/conteo' + q;
  const r = await request(app).get(url('llamadas_unicas', '2026-08', '?desde=2026-08-05&hasta=2026-08-07')).set(auth(t));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.enMes, 9);
  assert.equal(r.body.enRango, 3);
  const tl = await request(app).get(url('tipificacion_llamadas', '2026-08', '?desde=2026-08-01&hasta=2026-08-31')).set(auth(t));
  assert.equal(tl.body.enMes, 0, 'WhatsApp no cuenta como Tipificacion de llamadas');
  assert.equal((await request(app).get(url('llamadas_unicas', '2026-08', '?desde=2026-08-07&hasta=2026-08-05')).set(auth(t))).status, 400);
  assert.equal((await request(app).get(url('llamadas_unicas', '2026-08', '?desde=x&hasta=2026-08-05')).set(auth(t))).status, 400);
  assert.equal((await request(app).get(url('no_existe', '2026-08', '?desde=2026-08-01&hasta=2026-08-02')).set(auth(t))).status, 404);
  for (const [u, p] of [['agomez', SEED.agomez], ['crodriguez', SEED.crodriguez]]) {
    const tu = await tokenFor(u, p);
    assert.equal((await request(app).get(url('llamadas_unicas', '2026-08', '?desde=2026-08-05&hasta=2026-08-07')).set(auth(tu))).status, 403, u);
  }
});

test('cableado: la vista previa del Centro antepone el aviso con el conteo del servidor', () => {
  const cargas = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'cargas.js'), 'utf8');
  assert.match(cargas, /\/conteo\?desde='\+rango\.desde\+'&hasta='\+rango\.hasta/);
  assert.match(cargas, /rr\.avisos = \[centroTextoReemplazoParcial\(focoArch\.mes, rango, conteo\)\]/);
});
