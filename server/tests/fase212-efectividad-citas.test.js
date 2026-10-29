// fase212-efectividad-citas.test.js — Fase 212 (pedido de Edwin, 29/10, solo ORLANT).
// Efectividad de Citas = agendas del mes (3P + General) / (llamadas
// contestadas de Trafico de Llamadas + WhatsApp contestados de Trafico de
// WhatsApp) del mismo mes; varios meses = totales sumados. Los demas clientes
// siguen con el archivo CITAS_ATENDIDAS. Datos SIEMPRE inventados.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD, db } = require('./helpers');
const { citasEfectividadFraccion, citasEfectividadPonderado, citasAtendidasFmtPct } = require('../../public/js/citas-atendidas-logic');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

test('ORLANT: agendas / (llamadas + WhatsApp contestados) por mes, sin contactos = "—"', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const fila = (fecha, linea) => ['ASESOR DEMO', 'SEDE DEMO', 'EX', 'ESP', 'PROF', fecha + ' 08:00:00', linea, 'EPS DEMO'];
  const filas = [];
  for (let k = 0; k < 6; k++) filas.push(fila('2026-08-0' + (k + 1), k % 2 ? '3P' : 'GENERAL'));
  for (let k = 0; k < 4; k++) filas.push(fila('2026-09-0' + (k + 1), '3P'));
  filas.push(fila('2026-10-01', 'GENERAL'));
  const c = await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({ campana: 'ORLANT', filas });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  const ts = '01/01/2026 00:00:00';
  const voz = db.prepare('INSERT INTO calidad_nivel_servicio_diario (campana, fecha, skillName, totalLlamadas, contestadas, createdAt) VALUES (?,?,?,?,?,?)');
  voz.run('ORLANT', '2026-08-01', 'CALL INBOUND ORLANT GENERAL', 9, 5, ts);
  voz.run('ORLANT', '2026-08-02', 'CALL INBOUND ORLANT 3P', 4, 3, ts);
  voz.run('ORLANT', '2026-09-01', 'CALL INBOUND ORLANT 3P', 10, 6, ts);
  voz.run('MOBILIZE', '2026-08-01', 'OTRO', 99, 99, ts); // otro cliente: no cuenta
  const wpp = db.prepare('INSERT INTO trafico_whatsapp (campana, colaWhatsapp, fechaInicio, fechaFin, totalWhatsapp, contestados, createdAt) VALUES (?,?,?,?,?,?,?)');
  wpp.run('ORLANT', 'WHATSAPP ORLANT 3P', '2026-08-01', '2026-08-31', 5, 4, ts);
  wpp.run('ORLANT', 'WHATSAPP ORLANT GENERAL', '2026-09-01', '2026-09-30', 3, 2, ts);

  const m = await request(app).get('/api/calidad/efectividad-citas/mensual?campana=ORLANT').set(auth(admin));
  assert.equal(m.status, 200);
  assert.deepEqual(m.body, [
    { mes: '2026-08', agendas: 6, llamadasContestadas: 8, whatsappContestados: 4, contactos: 12 },
    { mes: '2026-09', agendas: 4, llamadasContestadas: 6, whatsappContestados: 2, contactos: 8 },
    { mes: '2026-10', agendas: 1, llamadasContestadas: 0, whatsappContestados: 0, contactos: 0 },
  ]);
  const op = await request(app).get('/api/calidad/efectividad-citas/opciones?campana=ORLANT').set(auth(admin));
  assert.deepEqual(op.body.meses, ['2026-08', '2026-09', '2026-10']);

  const [ago, sep, oct] = m.body;
  assert.equal(citasAtendidasFmtPct(citasEfectividadFraccion(ago).pct), '50,00 %');
  assert.equal(citasAtendidasFmtPct(citasEfectividadFraccion(sep).pct), '50,00 %');
  assert.equal(citasEfectividadFraccion(oct).pct, null);
  // Varios meses: totales sumados (10 / 20), nunca el promedio de los %.
  assert.deepEqual(citasEfectividadPonderado([ago, sep]), { num: 10, den: 20, pct: 0.5 });
  assert.deepEqual(citasEfectividadPonderado([ago, sep, oct]), { num: 11, den: 20, pct: 0.55 });
  // La formula de archivo (otros clientes) no cambia.
  assert.deepEqual(citasEfectividadFraccion({ mes: '2026-08', agendas: 200, atendidas: 150 }), { num: 150, den: 200, pct: 0.75 });
});
