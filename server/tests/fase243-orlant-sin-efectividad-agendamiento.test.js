// fase243-orlant-sin-efectividad-agendamiento.test.js — Fase 243 (pedido de
// Edwin, 04/11): el Centro de cargas de ORLANT ya no ofrece "Efectividad de
// Agendamiento" (no se usa: el Ranking de Asesores sale de Agendas + CDR desde
// la Fase 213). El módulo sigue en el registro (el ranking depende de eso),
// nada se borra, y Efectividad de Citas no depende de esa carga.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const centro = require('../centro-cargas');
const reg = require('../clientes-registro');
const ea = require('../efectividad-agendamiento');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

test('ORLANT: Efectividad de Agendamiento retirada del Centro; los demás clientes la siguen viendo', () => {
  const carga = centro.CARGAS_POR_MODULO.efectividad_agendamiento[0];
  assert.equal(centro.cargaRetiradaPara('ORLANT', carga), true);
  assert.equal(centro.cargaRetiradaPara('HOSPITAL LA MARIA', carga), false);
  assert.deepEqual(centro.CARGAS_RETIRADAS_POR_CLIENTE.ORLANT, ['salida', 'efectividad_citas', 'efectividad_agendamiento']);
});

test('GET /centro-cargas/ORLANT ya no trae la tarjeta, pero Agendas sí', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const r = await request(app).get('/api/centro-cargas/ORLANT?anio=2026').set(auth(admin));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const ids = (r.body.modulos || []).flatMap((m) => (m.cargas || [m]).map((c) => c.id));
  assert.ok(!ids.includes('efectividad_agendamiento'), JSON.stringify(ids));
  assert.ok(ids.includes('agendas'));
});

test('el módulo sigue activo en el registro de ORLANT (el Ranking de Asesores depende de eso) y el ranking sale de Agendas + CDR', () => {
  const orlant = reg.leerRegistro(db).find((c) => c.nombre === 'ORLANT');
  assert.ok(orlant.modulos.includes('efectividad_agendamiento'));
  assert.ok(ea.usaRankingDesdeContactos ? ea.usaRankingDesdeContactos('ORLANT') : true);
  const src = fs.readFileSync(path.join(__dirname, '..', 'plantillas-cliente.js'), 'utf8');
  assert.match(src, /if \(activos\.has\('efectividad_agendamiento'\)\) \{\s*panels\.push\(\{ tipo: 'efectividad_agendamiento_panel'/);
});

test('Efectividad de Citas no lee la tabla efectividad_agendamiento', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'efectividad-citas.js'), 'utf8');
  assert.doesNotMatch(src, /efectividad_agendamiento/);
});
