// fase150-limite-8mb-unicas-whatsapp.test.js — Fase 150: Llamadas Unicas y
// WhatsApp por rangos de minutos se validan en el navegador con el limite
// mayor (CARGAS_LIMITE_MAYOR_BYTES, 8mb) pero el servidor las dejaba en 2mb
// (mismo desfase que la Encuesta, arreglado en la Fase 149). Ahora sus 4
// rutas (carga + impacto) estan en RUTAS_LIMITE_MAYOR (server.js).
// Datos SIEMPRE inventados.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CARGAS_LIMITE_MAYOR_BYTES } = require('../../public/js/cargas-logic.js');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const dia = (i) => '2026-08-' + String((i % 28) + 1).padStart(2, '0');

const CASOS = {
  'llamadas-unicas': {
    campana: 'MOBILIZE',
    // [agente, fecha, tipo, skill]
    filas: () => Array.from({ length: 40000 }, (_, i) => ['Asesor Sintetico De Prueba Para Tamano Numero ' + (i % 37), dia(i), i % 5 ? 'CONTESTADA' : 'ABANDONADA', 'SKILL SINTETICO DE PRUEBA']),
  },
  'whatsapp-tiempos': {
    campana: 'ORLANT',
    // [skill, fecha, hora, segundos]
    filas: () => Array.from({ length: 60000 }, (_, i) => ['WHATSAPP SKILL SINTETICO DE PRUEBA ' + (i % 7), dia(i), i % 24, (i * 37) % 3600]),
  },
};

for (const [base, caso] of Object.entries(CASOS)) {
  for (const sufijo of ['/carga/impacto', '/carga']) {
    const ruta = '/api/calidad/' + base + sufijo;
    test(`Fase 150: ${ruta} acepta un body de mas de 2mb (y menos de 8mb) sin 413`, async () => {
      const admin = await tokenFor('admin', MASTER_PASSWORD);
      const body = JSON.stringify({ campana: caso.campana, archivoNombre: 'prueba-f150.xlsx', filas: caso.filas() });
      assert.ok(body.length > 2 * 1024 * 1024, 'el body de prueba debe superar 2mb: ' + body.length);
      assert.ok(body.length < CARGAS_LIMITE_MAYOR_BYTES, 'y quedar bajo el limite del navegador: ' + body.length);
      const res = await request(app).post(ruta).set(auth(admin)).set('Content-Type', 'application/json').send(body);
      assert.notEqual(res.status, 413, JSON.stringify(res.body));
      assert.ok(res.status === 200 || res.status === 201, `vino ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`);
    });
  }
  test(`Fase 150: ${base} por encima de 8mb sigue devolviendo 413`, async () => {
    const admin = await tokenFor('admin', MASTER_PASSWORD);
    const res = await request(app)
      .post('/api/calidad/' + base + '/carga')
      .set(auth(admin))
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ campana: caso.campana, archivoNombre: 'X'.repeat(9 * 1024 * 1024), filas: caso.filas().slice(0, 1) }));
    assert.equal(res.status, 413);
  });
}
