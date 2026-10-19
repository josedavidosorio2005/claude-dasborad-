// fase153-versiones.test.js — Fase 153 (Centro de cargas, PR 2): Deshacer
// durante 30 dias. Antes de que un lector cambie un mes, se guarda el mes
// completo (misma transaccion); Deshacer lo devuelve EXACTO a como estaba.
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('zlib');
const { app, db, request, tokenFor, MASTER_PASSWORD, SEED, cleanup } = require('./helpers');
const V = require('../cargas-versiones');
const { cargarLlamadasUnicas } = require('../llamadas-unicas');
const { cargarTipificaciones } = require('../tipificaciones');
const { cargarNivelServicioDiario } = require('../nivel-servicio-diario');

after(cleanup);
const auth = (t) => ({ Authorization: 'Bearer ' + t });
const C = 'MOBILIZE';
const sinId = (filas) => filas.map(({ id, ...r }) => r);
const filasLU = (mes) => db.prepare("SELECT * FROM llamadas_unicas WHERE campana = ? AND substr(fecha,1,7) = ? ORDER BY fecha, agente").all(C, mes);
const subirLU = (filas, quien) => cargarLlamadasUnicas(db, { campana: C, archivoNombre: quien + '.xlsx', cargadoPorNombre: quien, filas });

test('mesesEntre y cargaDeTabla', () => {
  assert.deepEqual(V.mesesEntre('2026-07-15', '2026-09-02'), ['2026-07', '2026-08', '2026-09']);
  assert.deepEqual(V.mesesEntre('2025-12', '2026-01'), ['2025-12', '2026-01']);
  assert.equal(V.cargaDeTabla('tipificaciones', { canal: 'WHATSAPP' }).id, 'tipificacion_whatsapp');
  assert.equal(V.cargaDeTabla('monitoreos'), null, 'Calidad no tiene versiones');
});

test('reemplazar guarda el mes completo de antes; Deshacer lo devuelve EXACTO (y guarda lo de ahora)', () => {
  subirLU([['Asesor Uno', '2026-08-01', 'CONTESTADA', 'SKILL A'], ['Asesor Dos', '2026-08-02', 'CONTESTADA', 'SKILL A'], ['Asesor Uno', '2026-07-31', 'CONTESTADA', 'SKILL A']], 'Persona A');
  const antes = sinId(filasLU('2026-08'));
  assert.equal(antes.length, 2);
  assert.equal(V.listar(db, C, { carga: 'llamadas_unicas' }).length, 0, 'subir a un mes vacio no deja version');

  // El lector reemplaza el rango de fechas del archivo (1 y 2 de agosto).
  subirLU([['Asesor Tres', '2026-08-01', 'CONTESTADA', 'SKILL B'], ['Asesor Tres', '2026-08-02', 'CONTESTADA', 'SKILL B']], 'Persona B');
  assert.equal(filasLU('2026-08').length, 2);
  assert.ok(filasLU('2026-08').every((f) => f.agente === 'Asesor Tres'));
  const vs = V.listar(db, C, { carga: 'llamadas_unicas', mes: '2026-08' });
  assert.equal(vs.length, 1);
  assert.equal(vs[0].registros, 2);
  assert.equal(vs[0].motivo, 'reemplazo');
  assert.equal(vs[0].archivoNombre, 'Persona A.xlsx', 'la version dice de que archivo venian esas filas');
  assert.equal(filasLU('2026-07').length, 1, 'julio no se toco');

  const r = V.deshacer(db, vs[0].id, { actorNombre: 'Quien Deshace' });
  assert.equal(r.restauradas, 2);
  assert.equal(r.reemplazadas, 2);
  assert.deepEqual(sinId(filasLU('2026-08')), antes, 'el mes queda exactamente como estaba');
  const despues = V.listar(db, C, { carga: 'llamadas_unicas', mes: '2026-08' });
  assert.equal(despues[0].motivo, 'antes de deshacer', 'lo que habia antes de deshacer tambien queda guardado');
  assert.equal(despues[0].registros, 2);
  assert.throws(() => V.deshacer(db, vs[0].id, {}), /ya se restaur/);
  // Deshacer el deshacer.
  V.deshacer(db, despues[0].id, {});
  assert.deepEqual(filasLU('2026-08').map((f) => f.agente), ['Asesor Tres', 'Asesor Tres']);
});

test('un archivo de varios meses deja una version por mes; Tipificacion separa canales', () => {
  subirLU([['A', '2026-05-10', 'CONTESTADA', 'S'], ['B', '2026-06-10', 'CONTESTADA', 'S']], 'P1');
  subirLU([['C', '2026-05-11', 'CONTESTADA', 'S'], ['D', '2026-06-11', 'CONTESTADA', 'S']], 'P2');
  assert.equal(V.listar(db, C, { carga: 'llamadas_unicas', mes: '2026-05' }).length, 1);
  assert.equal(V.listar(db, C, { carga: 'llamadas_unicas', mes: '2026-06' }).length, 1);

  const fila = (ag) => [ag, '2026-04-03', null, null, 'Consulta', 'SKILL', null, null, null, null, null];
  cargarTipificaciones(db, { campana: C, canal: 'WHATSAPP', archivoNombre: 'w.xlsx', cargadoPorNombre: 'P', filas: [fila('W1')] });
  cargarTipificaciones(db, { campana: C, canal: 'LLAMADAS', archivoNombre: 'l.xlsx', cargadoPorNombre: 'P', filas: [fila('L1')] });
  cargarTipificaciones(db, { campana: C, canal: 'LLAMADAS', archivoNombre: 'l2.xlsx', cargadoPorNombre: 'P', filas: [fila('L2')] });
  assert.equal(V.listar(db, C, { carga: 'tipificacion_llamadas', mes: '2026-04' }).length, 1);
  assert.equal(V.listar(db, C, { carga: 'tipificacion_whatsapp', mes: '2026-04' }).length, 0, 'reemplazar llamadas no toca WhatsApp');
});

test('Flujo de Llamadas (actualiza filas, no solo borra): la version es la de ANTES del cambio', () => {
  const carga = (total) => cargarNivelServicioDiario(db, { campana: C, sede: null, archivoNombre: 't.xlsx', cargadoPorNombre: 'P', filas: [{ skillName: 'SKILL Z', fecha: '2026-03-02', totalLlamadas: total, contestadas: total - 1, serviceLevel20secPct: null }] });
  carga(50);
  carga(80);
  const v = V.listar(db, C, { carga: 'flujo_llamadas', mes: '2026-03' })[0];
  const guardadas = JSON.parse(zlib.gunzipSync(V.obtener(db, v.id).filas).toString());
  assert.equal(guardadas[0].totalLlamadas, 50);
  V.deshacer(db, v.id, {});
  assert.equal(db.prepare("SELECT totalLlamadas FROM calidad_nivel_servicio_diario WHERE campana = ? AND skillName = 'SKILL Z'").get(C).totalLlamadas, 50);
});

test('si el respaldo falla, la carga no cambia nada (misma transaccion)', () => {
  const antes = sinId(filasLU('2026-08'));
  const original = zlib.gzipSync;
  zlib.gzipSync = () => { throw new Error('disco lleno (simulado)'); };
  try {
    assert.throws(() => subirLU([['X', '2026-08-09', 'CONTESTADA', 'S']], 'P'), /disco lleno/);
  } finally { zlib.gzipSync = original; }
  assert.deepEqual(sinId(filasLU('2026-08')), antes);
});

test('tope de 5 versiones por mes; vencen a los 30 dias y purgar las borra', () => {
  for (let i = 0; i < 7; i++) subirLU([['T' + i, '2026-02-0' + (i + 1), 'CONTESTADA', 'S']], 'P' + i);
  assert.equal(V.listar(db, C, { carga: 'llamadas_unicas', mes: '2026-02' }).length, V.TOPE_POR_MES);
  const id = V.listar(db, C, { carga: 'llamadas_unicas', mes: '2026-02' })[0].id;
  const en31 = new Date(Date.now() + 31 * 86400000);
  assert.equal(V.listar(db, C, { carga: 'llamadas_unicas', mes: '2026-02', ahora: en31 }).length, 0);
  assert.throws(() => V.deshacer(db, id, { ahora: en31 }), /venci/);
  assert.ok(V.purgar(db, en31) >= V.TOPE_POR_MES);
  assert.equal(V.obtener(db, id), null);
});

test('rutas: listar y deshacer exigen poder cargar Y acceso al cliente; queda en el Historial', async () => {
  subirLU([['R1', '2026-01-05', 'CONTESTADA', 'S']], 'P');
  subirLU([['R2', '2026-01-06', 'CONTESTADA', 'S']], 'P');
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const l = await request(app).get('/api/centro-cargas/' + C + '/versiones?carga=llamadas_unicas&mes=2026-01').set(auth(t));
  assert.equal(l.status, 200);
  assert.equal(l.body.versiones.length, 1);
  assert.equal(l.body.versiones[0].filas, undefined, 'la lista nunca trae las filas');
  for (const [u, p] of [['agomez', SEED.agomez], ['crodriguez', SEED.crodriguez]]) {
    const tu = await tokenFor(u, p);
    assert.equal((await request(app).get('/api/centro-cargas/' + C + '/versiones').set(auth(tu))).status, 403, u);
    assert.equal((await request(app).post('/api/centro-cargas/versiones/' + l.body.versiones[0].id + '/deshacer').set(auth(tu))).status, 403, u);
  }
  const d = await request(app).post('/api/centro-cargas/versiones/' + l.body.versiones[0].id + '/deshacer').set(auth(t));
  assert.equal(d.status, 200, JSON.stringify(d.body));
  assert.equal(d.body.restauradas, 1);
  assert.deepEqual(filasLU('2026-01').map((f) => f.agente), ['R1']);
  const h = db.prepare("SELECT detalle FROM historial WHERE accion = 'CENTRO_CARGAS_DESHACER' ORDER BY rowid DESC").get();
  assert.match(h.detalle, /Llamadas Únicas \(ingreso\) de 2026-01: volvieron 1 registros/);
  assert.equal((await request(app).post('/api/centro-cargas/versiones/' + l.body.versiones[0].id + '/deshacer').set(auth(t))).status, 409);
  assert.equal((await request(app).post('/api/centro-cargas/versiones/999999/deshacer').set(auth(t))).status, 404);
});
