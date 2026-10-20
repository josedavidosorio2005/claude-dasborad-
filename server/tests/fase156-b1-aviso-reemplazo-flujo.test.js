// fase156-b1-aviso-reemplazo-flujo.test.js — Fase 156 (B1): el aviso de
// "va a REEMPLAZAR N registros" del Flujo de Llamadas cuenta solo los dias
// que trae el archivo (los que de verdad se reemplazan), no el mes entero de
// esa skill. Antes, un archivo de 4 dias sobre un mes ya cargado (31 dias)
// avisaba "REEMPLAZAR 31" aunque solo se reemplazaban 4 y el resto quedaba.
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, tokenFor, MASTER_PASSWORD, cleanup } = require('./helpers');

after(cleanup);
const auth = (t) => ({ Authorization: 'Bearer ' + t });
const SKILL = 'SKILL B1 AVISO';
const dia = (d) => '2026-08-' + String(d).padStart(2, '0');
const fila = (d) => ({ fecha: dia(d), skillName: SKILL, totalLlamadas: 100, contestadas: 90 });
const dias = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

test('archivo parcial sobre un mes completo: el aviso cuenta solo los dias del archivo', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const carga = await request(app).post('/api/calidad/trafico/carga').set(auth(t)).send({ filas: dias(1, 31).map(fila) });
  assert.equal(carga.status, 201, JSON.stringify(carga.body));

  const imp = await request(app).post('/api/calidad/trafico/carga/impacto').set(auth(t)).send({ filas: dias(28, 31).map(fila) });
  assert.equal(imp.status, 200, JSON.stringify(imp.body));
  const par = imp.body.find((p) => p.skillName === SKILL && p.mes === '2026-08');
  assert.equal(par.filasExistentes, 4, 'se reemplazan los 4 dias del archivo, no los 31 del mes');
  assert.equal(par.filasABorrar, 0);
});

test('con un hueco en el archivo: reemplaza los dias que trae y avisa el que se borra', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const imp = await request(app).post('/api/calidad/trafico/carga/impacto').set(auth(t)).send({ filas: [28, 29, 31].map(fila) });
  const par = imp.body.find((p) => p.skillName === SKILL && p.mes === '2026-08');
  assert.equal(par.filasExistentes, 3);
  assert.equal(par.filasABorrar, 1, 'el 30 esta dentro del rango y no viene');
});

test('un mes completo nuevo sobre uno completo: reemplaza todo el mes (sin cambios)', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const imp = await request(app).post('/api/calidad/trafico/carga/impacto').set(auth(t)).send({ filas: dias(1, 31).map(fila) });
  const par = imp.body.find((p) => p.skillName === SKILL && p.mes === '2026-08');
  assert.equal(par.filasExistentes, 31);
  assert.equal(par.filasABorrar, 0);
});
