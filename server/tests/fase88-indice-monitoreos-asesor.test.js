// fase88-indice-monitoreos-asesor.test.js — Fase 88, tema rendimiento.
//
// GET /monitoreos/mios (portal personal del rol ASESOR, "Mis Resultados de
// Calidad") filtra con `WHERE lower(trim(asesor)) = ?`, sin cota de
// campana ni de fecha -- confirmado con EXPLAIN QUERY PLAN en el barrido
// de la Fase 88 que sin un indice de expresion sobre esa misma expresion
// hace SCAN completo de toda la tabla `monitoreos`, en cada visita de
// cada asesor. Fix: `idx_monitoreos_asesor_lower` (server/db.js, bloque
// de schema con CREATE INDEX IF NOT EXISTS -- se autoaplica en cualquier
// base ya sembrada, incluida produccion, con el proximo deploy).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db, request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

test('idx_monitoreos_asesor_lower existe en el esquema', () => {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_monitoreos_asesor_lower'").get();
  assert.ok(row, 'el indice de expresion sobre lower(trim(asesor)) debe existir');
});

test('EXPLAIN QUERY PLAN: la consulta EXACTA de GET /monitoreos/mios usa el indice, nunca un SCAN completo de la tabla', () => {
  const plan = db.prepare("EXPLAIN QUERY PLAN SELECT * FROM monitoreos WHERE lower(trim(asesor)) = ? ORDER BY fecha DESC, id DESC").all('cualquier asesor');
  const detalle = plan.map((p) => p.detail).join(' | ');
  assert.ok(/USING INDEX idx_monitoreos_asesor_lower/.test(detalle), `deberia usar el indice, plan real: ${detalle}`);
  assert.ok(!/^SCAN monitoreos/m.test(detalle), `no deberia hacer SCAN completo, plan real: ${detalle}`);
});

test('GET /monitoreos/mios sigue devolviendo exactamente los monitoreos del asesor (case/espacios insensible), nada mas y nada menos', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const asesor = 'Asesor Indice ' + Math.random().toString(36).slice(2, 8);
  const asesorLogin = 'asesor_indice_' + Math.random().toString(36).slice(2, 7);

  const create = await request(app)
    .post('/api/users')
    .set(auth(admin))
    // asesorCampana: la pantalla de Usuarios SIEMPRE lo manda para un ASESOR
    // (select obligatorio, ver buildAsesorCampanaSelect en users.js) -- se
    // fija aca tal cual lo haria un alta real (Fase 102: el fallback por
    // nombre de /monitoreos/mios ahora exige que coincida la campana).
    .send({ nombre: asesor, user: asesorLogin, password: 'ClaveAsesor1234', rol: 'ASESOR', perms: {}, asesorCampana: 'ORLANT' });
  assert.equal(create.status, 201, JSON.stringify(create.body));

  // Un monitoreo guardado con espacios/mayusculas distintas al nombre exacto del usuario.
  const answers = JSON.stringify({ 1: 'SI' });
  db.prepare(
    `INSERT INTO monitoreos (campana, asesor, fecha, mes, canal, evaluador, answers, puntaje, createdAt)
     VALUES (?, ?, '2026-09-01', '2026-09', 'LLAMADA', 'EVALUADOR X', ?, 90, '01/09/2026 10:00:00')`
  ).run('ORLANT', '  ' + asesor.toUpperCase() + '  ', answers);
  // Monitoreo de OTRO asesor -- no debe aparecer.
  db.prepare(
    `INSERT INTO monitoreos (campana, asesor, fecha, mes, canal, evaluador, answers, puntaje, createdAt)
     VALUES (?, ?, '2026-09-02', '2026-09', 'LLAMADA', 'EVALUADOR X', ?, 80, '02/09/2026 10:00:00')`
  ).run('ORLANT', 'OTRO ASESOR COMPLETAMENTE DISTINTO', answers);

  const token = await tokenFor(asesorLogin, 'ClaveAsesor1234');
  const res = await request(app).get('/api/monitoreos/mios').set(auth(token));
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1, 'solo el monitoreo de ESTE asesor, sin importar mayusculas/espacios de mas al guardarlo');
  assert.equal(res.body[0].puntaje, 90);
});
