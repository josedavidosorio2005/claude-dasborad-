// fase163-llamadas-unicas.test.js — Fase 163, punto 3 (reunion con Edwin,
// 21/10). Llamadas Unicas de ingreso (Mobilize): el asesor NO es
// obligatorio. Edwin arma el archivo con las contestadas del CDR (con
// asesor) y las abandonadas de "Skill y servicios, numeral 2" (sin asesor):
// una fila sin asesor es una abandonada y se carga con el asesor vacio
// (antes se omitia, y por eso Total = Contestadas y Abandonadas = 0).
// Contestadas y abandonadas se cuentan por separado (unica = dia + telefono
// + tipo). Datos SINTETICOS.
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, db, request, tokenFor, MASTER_PASSWORD, cleanup } = require('./helpers');
const L = require('../../public/js/llamadas-unicas-logic.js');

after(cleanup);
const auth = (t) => ({ Authorization: 'Bearer ' + t });
const H = ['AGENT_NAME', 'DATE', 'TELEPHONE', 'SKILL_NAME'];

test('fila sin asesor: se carga como abandonada (antes se omitia)', () => {
  const r = L.llamadasUnicasParseFilas([
    H,
    ['Asesor Uno', '2026-08-03', '3000000001', 'SKILL SAC'],
    ['', '2026-08-03', '3000000002', 'SKILL SAC'],
    [null, '2026-08-04', '3000000003', 'Skill Key Account'],
    ['Asesor Uno', '2026-08-04', '3000000004', ''],
  ]);
  assert.deepEqual(r.filas, [
    ['Asesor Uno', '2026-08-03', 'CONTESTADA', 'SKILL SAC'],
    ['', '2026-08-03', 'ABANDONADA', 'SKILL SAC'],
    ['', '2026-08-04', 'ABANDONADA', 'Skill Key Account'],
  ]);
  assert.equal(r.contestadas, 1);
  assert.equal(r.abandonadas, 2);
  assert.equal(r.avisos.length, 1, 'solo la fila sin skill se omite');
  assert.match(r.avisos[0], /falta un dato obligatorio \(skill\)/);
});

test('unica = dia + telefono + tipo; informa cuantos dia+telefono estan en los dos tipos', () => {
  const r = L.llamadasUnicasParseFilas([
    H,
    ['', '2026-08-03', '3000000001', 'SKILL SAC'],
    ['', '2026-08-03', '300 000 0001', 'SKILL SAC'],
    ['Asesor Uno', '2026-08-03', '3000000001', 'SKILL SAC'],
    ['Asesor Uno', '2026-08-04', '3000000001', 'SKILL SAC'],
  ]);
  assert.deepEqual(r.filas.map((f) => f[2]), ['ABANDONADA', 'CONTESTADA', 'CONTESTADA']);
  assert.equal(r.duplicadosQuitados, 1);
  assert.equal(r.telefonosEnAmbosTipos, 1);
});

test('servidor: guarda el asesor vacio y el resumen separa contestadas y abandonadas; el asesor vacio no es una opcion de filtro', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const filas = [
    ['Asesor F163', '2026-07-01', 'CONTESTADA', 'SKILL F163'],
    ['', '2026-07-02', 'ABANDONADA', 'SKILL F163'],
    ['', '2026-07-03', 'ABANDONADA', 'SKILL F163'],
  ];
  const g = await request(app).post('/api/calidad/llamadas-unicas/carga').set(auth(t)).send({ campana: 'MOBILIZE', archivoNombre: 'f163.xlsx', filas });
  assert.equal(g.status, 201, JSON.stringify(g.body));
  const q = 'campana=MOBILIZE&desde=2026-07-01&hasta=2026-07-03&skill=SKILL%20F163';
  const res = await request(app).get('/api/calidad/llamadas-unicas/resumen?' + q).set(auth(t));
  assert.deepEqual(res.body, { contestadas: 1, abandonadas: 2, total: 3 });
  const vacio = db.prepare("SELECT COUNT(*) AS n FROM llamadas_unicas WHERE campana = 'MOBILIZE' AND skill = 'SKILL F163' AND agente = ''").get().n;
  assert.equal(vacio, 2);
  const op = await request(app).get('/api/calidad/llamadas-unicas/opciones?campana=MOBILIZE').set(auth(t));
  assert.ok(!op.body.agentes.includes(''), 'el asesor vacio no aparece como asesor');
});
