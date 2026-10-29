// fase213-ocultar-cargas-orlant.test.js — Fase 213 (pedido de Edwin, 29/10).
// En "Cargar Datos" (Centro de cargas) ORLANT ya no ve "Llamadas y WhatsApp de
// salida" ni la de citas atendidas (Efectividad de Citas). No se borra nada:
// lo guardado sigue ahi y se puede descargar. Los demas clientes no cambian.
// Datos SIEMPRE inventados.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD, db } = require('./helpers');
const { cargaRetiradaPara, CARGAS_POR_MODULO } = require('../centro-cargas');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

test('solo ORLANT: salida y efectividad_citas retiradas; el resto de cargas igual', () => {
  const salida = CARGAS_POR_MODULO.salida[0];
  const citas = CARGAS_POR_MODULO.efectividad_citas[0];
  assert.equal(cargaRetiradaPara('ORLANT', salida), true);
  assert.equal(cargaRetiradaPara('ORLANT', citas), true);
  assert.equal(cargaRetiradaPara('ORLANT', CARGAS_POR_MODULO.agendas[0]), false);
  assert.equal(cargaRetiradaPara('CLINICA AURORA', salida), false);
  assert.equal(cargaRetiradaPara('CLINICA AURORA', citas), false);
  // Las retiradas de siempre (Fase 194) siguen retiradas para todos.
  assert.equal(cargaRetiradaPara('MOBILIZE', CARGAS_POR_MODULO.llamadas_unicas[0]), true);
});

test('Centro de cargas de ORLANT sin esos 2 modulos; los datos guardados quedan y se descargan', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  db.prepare(`INSERT INTO efectividad_citas (campana, mes, agendas, atendidas, archivoNombre, cargadoPorNombre, createdAt)
    VALUES ('ORLANT', '2026-08', 100, 70, 'citas.xlsx', 'Persona A', '2026-09-02T10:00:00Z')`).run();
  const r = await request(app).get('/api/centro-cargas/ORLANT?anio=2026').set(auth(admin));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const ids = r.body.modulos.map((m) => m.id);
  assert.ok(!ids.includes('salida'), 'sin Llamadas y WhatsApp de salida');
  assert.ok(!ids.includes('efectividad_citas'), 'sin citas atendidas');
  assert.ok(ids.includes('agendas') && ids.includes('flujo_llamadas'), 'las demas cargas siguen');
  assert.ok(r.body.modulos.every((m) => m.cargas.length > 0));
  // Nada se borro: la fila sigue y "Descargar lo cargado" la trae.
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM efectividad_citas WHERE campana = 'ORLANT' AND mes = '2026-08'").get().n, 1);
  const d = await request(app).get('/api/centro-cargas/ORLANT/efectividad_citas/2026-08/datos').set(auth(admin));
  assert.equal(d.status, 200, JSON.stringify(d.body));
});
