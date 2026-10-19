// fase153-eliminar.test.js — Fase 153 (Centro de cargas, PR 3): Eliminar un
// mes. Guarda el mes completo 30 dias (Deshacer), lo borra en la misma
// transaccion, recalcula lo que depende de el y queda en el Historial.
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('zlib');
const { app, db, request, tokenFor, MASTER_PASSWORD, SEED, cleanup } = require('./helpers');
const V = require('../cargas-versiones');
const { cargaPorId } = require('../centro-cargas');
const { cargarLlamadasUnicas } = require('../llamadas-unicas');
const { cargarTipificaciones } = require('../tipificaciones');
const { cargarNivelServicioDiario } = require('../nivel-servicio-diario');

after(cleanup);
const auth = (t) => ({ Authorization: 'Bearer ' + t });
const C = 'MOBILIZE';
const sinId = (filas) => filas.map(({ id, ...r }) => r);
const filasLU = (mes) => db.prepare('SELECT * FROM llamadas_unicas WHERE campana = ? AND substr(fecha,1,7) = ? ORDER BY fecha, agente').all(C, mes);
const subirLU = (filas, quien) => cargarLlamadasUnicas(db, { campana: C, archivoNombre: quien + '.xlsx', cargadoPorNombre: quien, filas });

test('eliminar borra SOLO ese mes, lo guarda como version y Deshacer lo devuelve exacto', () => {
  subirLU([['Uno', '2026-08-01', 'CONTESTADA', 'S'], ['Dos', '2026-08-02', 'CONTESTADA', 'S'], ['Uno', '2026-07-31', 'CONTESTADA', 'S'], ['Uno', '2026-09-01', 'CONTESTADA', 'S']], 'Persona A');
  const antes = sinId(filasLU('2026-08'));
  const r = V.eliminarMes(db, cargaPorId('llamadas_unicas'), C, '2026-08', { actorNombre: 'Quien Elimina' });
  assert.equal(r.eliminadas, 2);
  assert.equal(r.version.motivo, 'eliminacion');
  assert.equal(r.version.registros, 2);
  assert.equal(r.version.guardadoPorNombre, 'Quien Elimina');
  assert.equal(filasLU('2026-08').length, 0);
  assert.equal(filasLU('2026-07').length, 1, 'julio no se toca');
  assert.equal(filasLU('2026-09').length, 1, 'septiembre no se toca');
  V.deshacer(db, r.version.id, {});
  assert.deepEqual(sinId(filasLU('2026-08')), antes);
});

test('un mes vacio no se elimina (409) y Calidad no entra (400)', () => {
  assert.throws(() => V.eliminarMes(db, cargaPorId('llamadas_unicas'), C, '2026-01'), (e) => e.status === 409);
  assert.throws(() => V.eliminarMes(db, cargaPorId('calidad'), C, '2026-08'), (e) => e.status === 400);
});

test('Tipificacion: eliminar llamadas no toca WhatsApp', () => {
  const fila = (ag) => [ag, '2026-05-03', null, null, 'Consulta', 'SKILL', null, null, null, null, null];
  cargarTipificaciones(db, { campana: C, canal: 'WHATSAPP', archivoNombre: 'w.xlsx', cargadoPorNombre: 'P', filas: [fila('W1')] });
  cargarTipificaciones(db, { campana: C, canal: 'LLAMADAS', archivoNombre: 'l.xlsx', cargadoPorNombre: 'P', filas: [fila('L1')] });
  V.eliminarMes(db, cargaPorId('tipificacion_llamadas'), C, '2026-05');
  const canales = db.prepare("SELECT canal FROM tipificaciones WHERE campana = ? AND substr(fecha,1,7) = '2026-05'").all(C).map((f) => f.canal);
  assert.deepEqual(canales, ['WHATSAPP']);
});

test('Flujo de Llamadas: eliminar deja el total mensual en 0 (como el lector) y Deshacer lo devuelve', () => {
  cargarNivelServicioDiario(db, { campana: C, sede: null, archivoNombre: 't.xlsx', cargadoPorNombre: 'P', filas: [{ skillName: 'SKILL E', fecha: '2026-04-02', totalLlamadas: 40, contestadas: 38, serviceLevel20secPct: 90 }] });
  const mensual = () => db.prepare("SELECT llamadasTotales FROM calidad_nivel_servicio WHERE campana = ? AND mes = '2026-04' AND sede IS NULL").get(C).llamadasTotales;
  assert.equal(mensual(), 40);
  const r = V.eliminarMes(db, cargaPorId('flujo_llamadas'), C, '2026-04');
  assert.equal(mensual(), 0);
  V.deshacer(db, r.version.id, {});
  assert.equal(mensual(), 40);
});

test('si el respaldo falla, no se borra nada', () => {
  subirLU([['Tres', '2026-06-05', 'CONTESTADA', 'S']], 'P');
  const antes = sinId(filasLU('2026-06'));
  const original = zlib.gzipSync;
  zlib.gzipSync = () => { throw new Error('disco lleno (simulado)'); };
  try {
    assert.throws(() => V.eliminarMes(db, cargaPorId('llamadas_unicas'), C, '2026-06'), /disco lleno/);
  } finally { zlib.gzipSync = original; }
  assert.deepEqual(sinId(filasLU('2026-06')), antes);
});

test('ruta DELETE: permisos, validaciones e Historial', async () => {
  subirLU([['R1', '2026-03-05', 'CONTESTADA', 'S'], ['R2', '2026-03-06', 'CONTESTADA', 'S']], 'P');
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const url = (carga, mes) => '/api/centro-cargas/' + C + '/' + carga + '/' + mes;
  for (const [u, p] of [['agomez', SEED.agomez], ['crodriguez', SEED.crodriguez]]) {
    const tu = await tokenFor(u, p);
    assert.equal((await request(app).delete(url('llamadas_unicas', '2026-03')).set(auth(tu))).status, 403, u);
  }
  assert.equal(filasLU('2026-03').length, 2, 'un 403 no borra nada');
  assert.equal((await request(app).delete(url('llamadas_unicas', '2026-13')).set(auth(t))).status, 400);
  assert.equal((await request(app).delete(url('no_existe', '2026-03')).set(auth(t))).status, 404);
  assert.equal((await request(app).delete(url('agendas', '2026-03')).set(auth(t))).status, 404, 'MOBILIZE no tiene Agendas');
  assert.equal((await request(app).delete(url('calidad', '2026-03')).set(auth(t))).status, 400);
  assert.equal((await request(app).delete(url('llamadas_unicas', '2026-02')).set(auth(t))).status, 409);

  const d = await request(app).delete(url('llamadas_unicas', '2026-03')).set(auth(t));
  assert.equal(d.status, 200, JSON.stringify(d.body));
  assert.equal(d.body.eliminadas, 2);
  assert.equal(d.body.version.filas, undefined, 'la respuesta nunca trae las filas');
  assert.equal(filasLU('2026-03').length, 0);
  const h = db.prepare("SELECT detalle FROM historial WHERE accion = 'CENTRO_CARGAS_ELIMINAR' ORDER BY rowid DESC").get();
  assert.match(h.detalle, /Eliminó la base de Marzo 2026 de Llamadas Únicas \(ingreso\) \(MOBILIZE\): 2 registros/);
  const vs = (await request(app).get('/api/centro-cargas/' + C + '/versiones?carga=llamadas_unicas&mes=2026-03').set(auth(t))).body.versiones;
  assert.equal(vs[0].motivo, 'eliminacion');
  assert.equal((await request(app).post('/api/centro-cargas/versiones/' + vs[0].id + '/deshacer').set(auth(t))).status, 200);
  assert.equal(filasLU('2026-03').length, 2);
});
