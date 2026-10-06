// fase122-agendas-body-size-limit.test.js — Fase 122 (hallazgo real en
// produccion): Agendas se diseño para ~7.500 filas/mes (AGENDAS.xlsx de
// abril 2025, Fase 78: "en arrays el mismo archivo pesa ~35% menos, con
// margen comodo") -- el archivo real de agosto-septiembre/2026 (2 meses
// juntos) trae 24.186 filas y pesa 4.91mb, mas del doble del limite GLOBAL
// de 2mb (Fase 72) y por encima del limite de 20.000 filas que tenia
// agendasCargaBody (validation.js). Confirmado al intentar la carga real
// contra produccion: 413 "Cuerpo de la peticion demasiado grande", la
// carga NUNCA llego a escribir nada.
//
// Mismo tratamiento que Tipificacion (Fase 77, ver
// tipificacion-body-size-limit.test.js): estas 2 rutas de Agendas se
// agregan a RUTAS_LIMITE_MAYOR (server.js, 8mb) y el limite de filas de
// agendasCargaBody sube a 50.000 (igual que tipificacionCargaBody).
// Datos SIEMPRE inventados.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

// [asesor, sede, examen, especialidad, profesional, fechaSolicitud, tipoLinea, entidad]
function filaAgendas(i) {
  const dia = String((i % 28) + 1).padStart(2, '0');
  return [
    'ASESOR_DE_PRUEBA_TAMANO_' + (i % 21), 'SEDE_PRUEBA', 'EXAMEN_DE_PRUEBA_' + (i % 19),
    'ESPECIALIDAD_DE_PRUEBA_' + (i % 19), 'PROFESIONAL_DE_PRUEBA_' + (i % 30),
    '2021-01-' + dia + ' 08:00:00', i % 2 === 0 ? '3P' : 'GENERAL', 'ENTIDAD_DE_PRUEBA_' + (i % 15),
  ];
}

test('Fase 122: 24.186 filas de Agendas (~4.9mb, supera el limite GLOBAL de 2mb) se aceptan sin 413 ni 400 por limite de filas', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const filas = Array.from({ length: 24186 }, (_, i) => filaAgendas(i));
  const body = JSON.stringify({ campana: 'ORLANT', archivoNombre: 'prueba24186.xlsx', filas });
  assert.ok(body.length > 2 * 1024 * 1024, 'el body de prueba debe superar 2mb: ' + body.length);
  assert.ok(body.length < 8 * 1024 * 1024, 'el body de prueba debe quedar bajo el limite de esta ruta (8mb): ' + body.length);

  const res = await request(app)
    .post('/api/calidad/agendas/carga')
    .set(auth(admin))
    .set('Content-Type', 'application/json')
    .send(body);

  assert.notEqual(res.status, 413, 'no debe rechazarse por tamano de body: ' + JSON.stringify(res.body));
  assert.notEqual(res.status, 400, 'no debe rechazarse por limite de filas: ' + JSON.stringify(res.body));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.insertadas, 24186);
});

test('Fase 122: un body que de verdad supera el limite de esta ruta (8mb) sigue devolviendo 413', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const relleno = 'X'.repeat(9 * 1024 * 1024);
  const res = await request(app)
    .post('/api/calidad/agendas/carga')
    .set(auth(admin))
    .set('Content-Type', 'application/json')
    .send(JSON.stringify({ campana: 'ORLANT', archivoNombre: relleno, filas: [filaAgendas(0)] }));

  assert.equal(res.status, 413);
  assert.equal(res.body.error, 'Cuerpo de la peticion demasiado grande');
});

test('Fase 122: otras rutas de la API (fuera de la lista) siguen exactamente en el limite GLOBAL de 2mb, sin cambios', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const relleno = 'X'.repeat(3 * 1024 * 1024);
  const res = await request(app)
    .post('/api/calidad/inasistencia/carga')
    .set(auth(admin))
    .set('Content-Type', 'application/json')
    .send(JSON.stringify({ archivoNombre: relleno, filas: [] }));

  assert.equal(res.status, 413, 'el resto de la API no debe heredar el limite mayor de Agendas/Tipificacion');
});
