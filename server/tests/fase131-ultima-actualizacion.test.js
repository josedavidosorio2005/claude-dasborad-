// fase131-ultima-actualizacion.test.js — Fase 131 (Parte 4). "Ultima
// actualizacion" por cliente: junta 10 fuentes (cada tabla de datos reales
// + dashboard_cargas) y devuelve la mas reciente, en hora Colombia.
// Datos SIEMPRE inventados.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseFechaProcesoComoUtc, obtenerUltimaActualizacion } = require('../ultima-actualizacion');
const { db, app, request, tokenFor, MASTER_PASSWORD } = require('./helpers');
const auth = (t) => ({ Authorization: `Bearer ${t}` });

test('parseFechaProcesoComoUtc: "DD/MM/AAAA HH:MM:SS" se interpreta como UTC', () => {
  const d = parseFechaProcesoComoUtc('05/10/2026 14:30:00');
  assert.equal(d.toISOString(), '2026-10-05T14:30:00.000Z');
});

test('parseFechaProcesoComoUtc: formato invalido o vacio -> null, nunca revienta', () => {
  assert.equal(parseFechaProcesoComoUtc('2026-10-05'), null);
  assert.equal(parseFechaProcesoComoUtc(''), null);
  assert.equal(parseFechaProcesoComoUtc(null), null);
  assert.equal(parseFechaProcesoComoUtc(undefined), null);
});

test('obtenerUltimaActualizacion: cliente sin ninguna carga en ninguna de las 10 fuentes -> fechaColombia null', () => {
  const campana = 'FASE131_UA_SINDATOS_' + Math.random().toString(36).slice(2, 8);
  const r = obtenerUltimaActualizacion(db, campana);
  assert.deepEqual(r, { fechaColombia: null });
});

test('obtenerUltimaActualizacion: una sola fuente con datos -> se convierte a hora Colombia (UTC-5)', () => {
  const campana = 'FASE131_UA_TIPIF_' + Math.random().toString(36).slice(2, 8);
  db.prepare(
    `INSERT INTO tipificaciones (campana, canal, agente, fecha, tipificacion, skill, archivoNombre, cargadoPorNombre, createdAt)
     VALUES (?, 'LLAMADAS', 'A', '2026-09-01', 'T', 'S', '', '-', ?)`
  ).run(campana, '05/10/2026 14:30:00');

  const r = obtenerUltimaActualizacion(db, campana);
  assert.equal(r.fechaColombia, '05/10/2026 09:30:00');
});

// El hallazgo real que esta prueba fija: 'DD/MM/AAAA HH:MM:SS' NO ordena
// lexicograficamente por fecha real (ej. "05/10/2026..." < "20/09/2026..."
// como texto, aunque octubre sea DESPUES de septiembre) -- usar MAX(fecha)
// en SQL daria la fila EQUIVOCADA. El id autoincremental (orden real de
// insercion) es la fuente de verdad.
test('obtenerUltimaActualizacion: NUNCA usa MAX(fecha) como texto -- usa el orden real de insercion (id), dentro de una misma tabla', () => {
  const campana = 'FASE131_UA_ORDEN_' + Math.random().toString(36).slice(2, 8);
  // Insertada PRIMERO (id menor), pero su string de fecha "gana" en texto.
  db.prepare(
    `INSERT INTO tipificaciones (campana, canal, agente, fecha, tipificacion, skill, archivoNombre, cargadoPorNombre, createdAt)
     VALUES (?, 'LLAMADAS', 'A', '2026-09-20', 'T', 'S', '', '-', ?)`
  ).run(campana, '20/09/2026 09:00:00');
  // Insertada DESPUES (id mayor, es la carga REAL mas reciente), con un
  // string que pierde comparado como texto puro.
  db.prepare(
    `INSERT INTO tipificaciones (campana, canal, agente, fecha, tipificacion, skill, archivoNombre, cargadoPorNombre, createdAt)
     VALUES (?, 'WHATSAPP', 'B', '2026-10-05', 'T', 'S', '', '-', ?)`
  ).run(campana, '05/10/2026 10:00:00');

  const r = obtenerUltimaActualizacion(db, campana);
  assert.equal(r.fechaColombia, '05/10/2026 05:00:00', 'debe ganar la fila insertada DESPUES (id mayor), no la que "gana" como texto');
});

test('obtenerUltimaActualizacion: compara entre VARIAS fuentes distintas y elige la mas reciente de todas', () => {
  const campana = 'FASE131_UA_MULTI_' + Math.random().toString(36).slice(2, 8);
  db.prepare(
    `INSERT INTO agendas (campana, asesor, sede, examen, especialidad, profesional, fechaSolicitud, tipoLinea, entidad, archivoNombre, cargadoPorNombre, createdAt)
     VALUES (?, 'A', 'S', 'E', 'ESP', 'P', '2026-08-01', '3P', 'ENT', '', '-', ?)`
  ).run(campana, '01/08/2026 08:00:00');
  db.prepare(
    `INSERT INTO salida_mensual (campana, mes, llamadas3p, llamadasGeneral, wpp3p, wppGeneral, archivoNombre, cargadoPorNombre, createdAt)
     VALUES (?, '2026-09', 1, 1, 1, 1, '', '-', ?)`
  ).run(campana, '02/09/2026 09:00:00');

  const r = obtenerUltimaActualizacion(db, campana);
  assert.equal(r.fechaColombia, '02/09/2026 04:00:00', 'salida_mensual (02/09, mas reciente) debe ganarle a agendas (01/08)');
});

test('obtenerUltimaActualizacion: nunca mezcla clientes -- un cliente ajeno con datos mas recientes no afecta el resultado de este', () => {
  const campanaPropia = 'FASE131_UA_PROPIA_' + Math.random().toString(36).slice(2, 8);
  const campanaAjena = 'FASE131_UA_AJENA_' + Math.random().toString(36).slice(2, 8);
  db.prepare(
    `INSERT INTO tipificaciones (campana, canal, agente, fecha, tipificacion, skill, archivoNombre, cargadoPorNombre, createdAt)
     VALUES (?, 'LLAMADAS', 'A', '2026-01-01', 'T', 'S', '', '-', ?)`
  ).run(campanaPropia, '01/01/2026 08:00:00');
  db.prepare(
    `INSERT INTO tipificaciones (campana, canal, agente, fecha, tipificacion, skill, archivoNombre, cargadoPorNombre, createdAt)
     VALUES (?, 'LLAMADAS', 'A', '2026-10-08', 'T', 'S', '', '-', ?)`
  ).run(campanaAjena, '08/10/2026 23:00:00');

  const r = obtenerUltimaActualizacion(db, campanaPropia);
  assert.equal(r.fechaColombia, '01/01/2026 03:00:00');
});

// ── Ruta HTTP ────────────────────────────────────────────────────────────
test('GET /dashboard/ultima-actualizacion: 404 si el cliente no tiene dashboard configurado', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).get('/api/dashboard/ultima-actualizacion?campana=CLIENTE QUE NO EXISTE XYZ').set(auth(admin));
  assert.equal(res.status, 404);
});

test('GET /dashboard/ultima-actualizacion: ADMIN ve fechaColombia null para ORLANT si no se le inserto nada (forma correcta de la respuesta)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).get('/api/dashboard/ultima-actualizacion?campana=ORLANT').set(auth(admin));
  assert.equal(res.status, 200);
  assert.ok('fechaColombia' in res.body);
});

test('GET /dashboard/ultima-actualizacion: sin el parametro campana -> 400 (zod)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).get('/api/dashboard/ultima-actualizacion').set(auth(admin));
  assert.equal(res.status, 400);
});
