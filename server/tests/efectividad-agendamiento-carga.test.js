// efectividad-agendamiento-carga.test.js — POST /api/calidad/efectividad-agendamiento/carga(/impacto)
// + GET /api/calidad/efectividad-agendamiento/(ranking|opciones) (Fase 111,
// ORLANT, pedido textual de Edwin: "el ranking va a ser efectividad por
// agendamiento"). Mismo patron que inasistencia-carga.test.js: reemplazo
// por MES, impacto/confirmacion, permisos, % ponderado, orden y empates
// del ranking. Datos SIEMPRE inventados -- los 2 valores de control reales
// (1er y ultimo puesto, Sep-26, ya dados por Edwin/InCo como control de
// verificacion) se usan como EJEMPLO numerico en UNA prueba dedicada,
// nunca el archivo real ni el resto de los 20 nombres.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

// [mes, asesor, gestiones, agendas]
function fila(over) {
  const base = ['2025-04', 'ASESOR UNO', 100, 50];
  return Object.assign([], base, over);
}

test('POST /calidad/efectividad-agendamiento/carga: solo quien tiene el permiso Cargar Datos puede subir', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const create = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send({ nombre: 'X', user: 'ea_noadmin_' + Math.random().toString(36).slice(2, 7), password: 'ClaveEa12345', rol: 'CALIDAD', perms: { Calidad: true, campana_ORLANT: true } });
  assert.equal(create.status, 201);
  const token = await tokenFor(create.body.user, 'ClaveEa12345');
  const res = await request(app)
    .post('/api/calidad/efectividad-agendamiento/carga')
    .set(auth(token))
    .send({ campana: 'ORLANT', filas: [fila()] });
  assert.equal(res.status, 403);
});

test('carga valida: se guarda y GET /ranking trae el asesor con su efectividad recalculada', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const asesor = 'ASESOR TEST ' + Math.random().toString(36).slice(2, 8);
  const mes = '2025-05';
  const res = await request(app)
    .post('/api/calidad/efectividad-agendamiento/carga')
    .set(auth(admin))
    .send({ campana: 'ORLANT', archivoNombre: 'EFECTIVIDAD_AGENDAMIENTO_test.xlsx', filas: [fila({ 0: mes, 1: asesor, 2: 200, 3: 50 })] });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.insertadas, 1);
  assert.deepEqual(res.body.meses, [mes]);

  const ranking = await request(app).get(`/api/calidad/efectividad-agendamiento/ranking?campana=ORLANT&mes=${mes}`).set(auth(admin));
  assert.equal(ranking.status, 200, JSON.stringify(ranking.body));
  const f = ranking.body.filas.find((r) => r.asesor === asesor);
  assert.ok(f, 'el asesor cargado debe aparecer en el ranking');
  assert.equal(f.gestiones, 200);
  assert.equal(f.agendas, 50);
  assert.equal(f.efectividad, 0.25); // 50/200
});

test('efectividad del EQUIPO: PONDERADA (Σagendas/Σgestiones), nunca el promedio simple de los % por asesor', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const mesValido = '2025-06';
  const a1 = 'ASESOR POND A ' + Math.random().toString(36).slice(2, 6);
  const a2 = 'ASESOR POND B ' + Math.random().toString(36).slice(2, 6);
  await request(app).post('/api/calidad/efectividad-agendamiento/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [
      fila({ 0: mesValido, 1: a1, 2: 100, 3: 50 }), // 50%
      fila({ 0: mesValido, 1: a2, 2: 200, 3: 10 }), // 5%
    ],
  });
  const ranking = await request(app).get(`/api/calidad/efectividad-agendamiento/ranking?campana=ORLANT&mes=${mesValido}`).set(auth(admin));
  const propios = ranking.body.filas.filter((r) => r.asesor === a1 || r.asesor === a2);
  const sumGest = propios.reduce((s, f) => s + f.gestiones, 0);
  const sumAg = propios.reduce((s, f) => s + f.agendas, 0);
  assert.equal(sumGest, 300);
  assert.equal(sumAg, 60);
  // El equipo del mes incluye TODO lo cargado en ese mes (no solo estos 2),
  // asi que se verifica la formula ponderada aislando un mes 100% propio.
  const mesAislado = '2026-01';
  await request(app).post('/api/calidad/efectividad-agendamiento/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [fila({ 0: mesAislado, 1: a1, 2: 100, 3: 50 }), fila({ 0: mesAislado, 1: a2, 2: 200, 3: 10 })],
  });
  const rankingAislado = await request(app).get(`/api/calidad/efectividad-agendamiento/ranking?campana=ORLANT&mes=${mesAislado}`).set(auth(admin));
  assert.equal(rankingAislado.body.equipo.gestiones, 300);
  assert.equal(rankingAislado.body.equipo.agendas, 60);
  const ponderado = 60 / 300; // 20%
  assert.equal(rankingAislado.body.equipo.efectividad, ponderado);
  const promedioSimple = (0.5 + 0.05) / 2; // 27.5%
  assert.notEqual(rankingAislado.body.equipo.efectividad, promedioSimple);
});

test('orden del ranking: efectividad de mayor a menor; empate -> mas gestiones primero; el siguiente puesto SALTA tras un empate', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const mes = '2026-02';
  const alto = 'ASESOR ALTO ' + Math.random().toString(36).slice(2, 6);
  const empateMas = 'ASESOR EMPATE MAS GESTIONES ' + Math.random().toString(36).slice(2, 6);
  const empateMenos = 'ASESOR EMPATE MENOS GESTIONES ' + Math.random().toString(36).slice(2, 6);
  const bajo = 'ASESOR BAJO ' + Math.random().toString(36).slice(2, 6);
  await request(app).post('/api/calidad/efectividad-agendamiento/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [
      fila({ 0: mes, 1: alto, 2: 100, 3: 90 }), // 90%
      fila({ 0: mes, 1: empateMas, 2: 200, 3: 100 }), // 50%, 200 gestiones
      fila({ 0: mes, 1: empateMenos, 2: 100, 3: 50 }), // 50%, 100 gestiones (empate de %, menos gestiones)
      fila({ 0: mes, 1: bajo, 2: 100, 3: 10 }), // 10%
    ],
  });
  const ranking = await request(app).get(`/api/calidad/efectividad-agendamiento/ranking?campana=ORLANT&mes=${mes}`).set(auth(admin));
  const porNombre = {};
  ranking.body.filas.forEach((f) => { porNombre[f.asesor] = f; });
  assert.equal(porNombre[alto].puesto, 1);
  assert.equal(porNombre[empateMas].puesto, 2, 'con el mismo % de efectividad, mas gestiones va primero');
  assert.equal(porNombre[empateMenos].puesto, 3, 'el empate se rompe por gestiones -- nunca comparten puesto si gestiones difiere');
  assert.equal(porNombre[bajo].puesto, 4);
});

test('empate EXACTO (mismo % y mismas gestiones) comparte puesto, y el siguiente puesto SALTA', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const mes = '2026-03';
  const a = 'ASESOR EMPATE EXACTO A ' + Math.random().toString(36).slice(2, 6);
  const b = 'ASESOR EMPATE EXACTO B ' + Math.random().toString(36).slice(2, 6);
  const c = 'ASESOR EMPATE EXACTO C ' + Math.random().toString(36).slice(2, 6);
  await request(app).post('/api/calidad/efectividad-agendamiento/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [
      fila({ 0: mes, 1: a, 2: 100, 3: 50 }),
      fila({ 0: mes, 1: b, 2: 100, 3: 50 }),
      fila({ 0: mes, 1: c, 2: 100, 3: 10 }),
    ],
  });
  const ranking = await request(app).get(`/api/calidad/efectividad-agendamiento/ranking?campana=ORLANT&mes=${mes}`).set(auth(admin));
  const porNombre = {};
  ranking.body.filas.forEach((f) => { porNombre[f.asesor] = f; });
  assert.equal(porNombre[a].puesto, 1);
  assert.equal(porNombre[b].puesto, 1, 'mismo % y mismas gestiones -> comparten el puesto 1');
  assert.equal(porNombre[c].puesto, 3, 'el puesto 2 se salta -- el siguiente real es el 3 (competicion, no serial)');
});

test('control real Sep-26 (dado por Edwin/InCo): 1er puesto 97,36 % (369/379), ultimo 12,18 % (254/2.086), equipo ponderado 44,81 %', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const mes = '2026-04';
  const top = 'ASESOR CONTROL TOP';
  const bottom = 'ASESOR CONTROL BOTTOM';
  const resto = 'ASESOR CONTROL RESTO'; // 1 fila que agrupa el resto de los otros 18 asesores reales, mismos totales agregados
  await request(app).post('/api/calidad/efectividad-agendamiento/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [
      fila({ 0: mes, 1: top, 2: 379, 3: 369 }),
      fila({ 0: mes, 1: bottom, 2: 2086, 3: 254 }),
      fila({ 0: mes, 1: resto, 2: 16101, 3: 7696 }), // 18.566-379-2.086=16.101 gestiones, 8.319-369-254=7.696 agendas
    ],
  });
  const ranking = await request(app).get(`/api/calidad/efectividad-agendamiento/ranking?campana=ORLANT&mes=${mes}`).set(auth(admin));
  assert.equal(ranking.body.equipo.gestiones, 18566);
  assert.equal(ranking.body.equipo.agendas, 8319);
  assert.equal(Math.round(ranking.body.equipo.efectividad * 10000) / 100, 44.81);

  const porNombre = {};
  ranking.body.filas.forEach((f) => { porNombre[f.asesor] = f; });
  assert.equal(porNombre[top].puesto, 1);
  assert.equal(Math.round(porNombre[top].efectividad * 10000) / 100, 97.36);
  assert.equal(porNombre[bottom].puesto, ranking.body.filas.length);
  assert.equal(Math.round(porNombre[bottom].efectividad * 10000) / 100, 12.18);
});

test('reemplaza por MES: subir el MISMO archivo 2 veces no duplica', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const asesor = 'ASESOR DUP ' + Math.random().toString(36).slice(2, 8);
  const payload = { campana: 'ORLANT', archivoNombre: 'EFECTIVIDAD_AGENDAMIENTO_dup.xlsx', filas: [fila({ 0: '2026-05', 1: asesor })] };
  const uno = await request(app).post('/api/calidad/efectividad-agendamiento/carga').set(auth(admin)).send(payload);
  assert.equal(uno.status, 201);
  const dos = await request(app).post('/api/calidad/efectividad-agendamiento/carga').set(auth(admin)).send(payload);
  assert.equal(dos.status, 201);
  assert.equal(dos.body.borradas, 1, 'la segunda carga debe borrar la fila de la primera antes de reinsertar');

  const ranking = await request(app).get('/api/calidad/efectividad-agendamiento/ranking?campana=ORLANT&mes=2026-05').set(auth(admin));
  assert.equal(ranking.body.filas.filter((f) => f.asesor === asesor).length, 1, 'no debe duplicar');
});

test('reemplaza por MES: un archivo de un mes DISTINTO no toca las filas de otro mes', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const asesor = 'ASESOR MES ' + Math.random().toString(36).slice(2, 6);
  await request(app).post('/api/calidad/efectividad-agendamiento/carga').set(auth(admin)).send({ campana: 'ORLANT', filas: [fila({ 0: '2026-06', 1: asesor })] });
  await request(app).post('/api/calidad/efectividad-agendamiento/carga').set(auth(admin)).send({ campana: 'ORLANT', filas: [fila({ 0: '2026-07', 1: asesor })] });
  const op = await request(app).get('/api/calidad/efectividad-agendamiento/opciones?campana=ORLANT').set(auth(admin));
  assert.ok(op.body.meses.includes('2026-06') && op.body.meses.includes('2026-07'));
});

test('POST /carga/impacto: cuenta cuantas filas se reemplazarian SIN escribir nada', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const mes = '2026-08';
  await request(app).post('/api/calidad/efectividad-agendamiento/carga').set(auth(admin)).send({
    campana: 'ORLANT', filas: [fila({ 0: mes, 1: 'ASESOR IMPACTO A' }), fila({ 0: mes, 1: 'ASESOR IMPACTO B' })],
  });
  const impacto = await request(app).post('/api/calidad/efectividad-agendamiento/carga/impacto').set(auth(admin)).send({
    campana: 'ORLANT', filas: [fila({ 0: mes, 1: 'ASESOR IMPACTO C' })],
  });
  assert.equal(impacto.status, 200, JSON.stringify(impacto.body));
  assert.equal(impacto.body.filasExistentes, 2);
  assert.equal(impacto.body.filasNuevas, 1);

  const ranking = await request(app).get(`/api/calidad/efectividad-agendamiento/ranking?campana=ORLANT&mes=${mes}`).set(auth(admin));
  assert.equal(ranking.body.filas.length, 2, '/carga/impacto no debe escribir nada en la base');
});

test('GET /ranking respeta el acceso por campana', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const create = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send({ nombre: 'X', user: 'ea_sincamp_' + Math.random().toString(36).slice(2, 7), password: 'ClaveEa12345', rol: 'CALIDAD', perms: { Calidad: true } });
  const token = await tokenFor(create.body.user, 'ClaveEa12345');
  const res = await request(app).get('/api/calidad/efectividad-agendamiento/ranking?campana=ORLANT&mes=2026-08').set(auth(token));
  assert.equal(res.status, 403);
});

test('GET /ranking: mes sin datos -> 200 con lista vacia (nunca error)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).get('/api/calidad/efectividad-agendamiento/ranking?campana=ORLANT&mes=2019-01').set(auth(admin));
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.filas, []);
  assert.equal(res.body.equipo.gestiones, 0);
  assert.equal(res.body.equipo.efectividad, 0);
});

test('validacion: numero negativo -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/calidad/efectividad-agendamiento/carga').set(auth(admin)).send({ campana: 'ORLANT', filas: [fila({ 2: -5 })] });
  assert.equal(res.status, 400);
});

test('validacion: mes con formato invalido -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/calidad/efectividad-agendamiento/carga').set(auth(admin)).send({ campana: 'ORLANT', filas: [fila({ 0: 'SEPTIEMBRE-2025' })] });
  assert.equal(res.status, 400);
});

test('validacion: mes futuro -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const futuro = new Date();
  futuro.setUTCFullYear(futuro.getUTCFullYear() + 5);
  const mesFuturo = futuro.getUTCFullYear() + '-01';
  const res = await request(app).post('/api/calidad/efectividad-agendamiento/carga').set(auth(admin)).send({ campana: 'ORLANT', filas: [fila({ 0: mesFuturo })] });
  assert.equal(res.status, 400);
});

test('validacion: asesor vacio -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/calidad/efectividad-agendamiento/carga').set(auth(admin)).send({ campana: 'ORLANT', filas: [fila({ 1: '' })] });
  assert.equal(res.status, 400);
});

test('validacion: fila con menos de 4 campos -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/calidad/efectividad-agendamiento/carga').set(auth(admin)).send({ campana: 'ORLANT', filas: [['2025-04', 'ASESOR', 100]] });
  assert.equal(res.status, 400);
});
