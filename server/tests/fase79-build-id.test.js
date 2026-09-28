// fase79-build-id.test.js — Fase 79 (bug real de produccion): una pestana
// abierta desde ANTES de un deploy sigue con el JS viejo en memoria y no
// reconoce hojas nuevas del archivo consolidado. GET /api/health ahora
// expone `buildId` (server.js) para que el navegador pueda comparar su
// propia version contra la del servidor (cargas.js,
// _cargasAvisarSiVersionVieja) y avisar antes de que alguien intente una
// carga que va a fallar.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app } = require('./helpers');

test('GET /api/health: expone buildId (string no vacio) ademas de ok:true, sin necesitar sesion', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(typeof res.body.buildId, 'string');
  assert.ok(res.body.buildId.length > 0);
});
