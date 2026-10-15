// fase149-encuestas-body-size-limit.test.js — Fase 149 (auditoria 148,
// hallazgo bajo): el navegador valida la carga de la Encuesta de Mobilize
// con el limite mayor (CARGAS_LIMITE_MAYOR_BYTES, 8mb) pero el servidor la
// dejaba en el limite global de 2mb -- un archivo de 2-8mb pasaba el aviso
// del navegador y luego recibia 413. Ahora /calidad/encuestas/carga (y su
// /impacto, que manda el mismo body) estan en RUTAS_LIMITE_MAYOR (server.js).
// Datos SIEMPRE inventados.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CARGAS_LIMITE_MAYOR_BYTES } = require('../../public/js/cargas-logic.js');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

// [fecha, agente, skill, q1, q2, q3, q4, comentario]
function filaEncuesta(i) {
  const dia = String((i % 28) + 1).padStart(2, '0');
  return ['2026-08-' + dia, 'Asesor Prueba ' + (i % 9), 'SKILL PRUEBA', i % 11, (i % 5) + 1, (i % 2) + 1, (i % 5) + 1, 'Comentario sintetico de prueba de tamano '.repeat(4)];
}

for (const ruta of ['/api/calidad/encuestas/carga/impacto', '/api/calidad/encuestas/carga']) {
  test(`Fase 149: ${ruta} acepta un body de mas de 2mb (y menos de 8mb, el limite del navegador) sin 413`, async () => {
    const admin = await tokenFor('admin', MASTER_PASSWORD);
    const body = JSON.stringify({ campana: 'MOBILIZE', archivoNombre: 'prueba-f149.xlsx', filas: Array.from({ length: 18000 }, (_, i) => filaEncuesta(i)) });
    assert.ok(body.length > 2 * 1024 * 1024, 'el body de prueba debe superar 2mb: ' + body.length);
    assert.ok(body.length < CARGAS_LIMITE_MAYOR_BYTES, 'y quedar bajo el limite del navegador: ' + body.length);
    const res = await request(app).post(ruta).set(auth(admin)).set('Content-Type', 'application/json').send(body);
    assert.notEqual(res.status, 413, JSON.stringify(res.body));
    assert.ok(res.status === 200 || res.status === 201, `vino ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`);
  });
}

test('Fase 149: la Encuesta por encima de 8mb sigue devolviendo 413', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app)
    .post('/api/calidad/encuestas/carga')
    .set(auth(admin))
    .set('Content-Type', 'application/json')
    .send(JSON.stringify({ campana: 'MOBILIZE', archivoNombre: 'X'.repeat(9 * 1024 * 1024), filas: [filaEncuesta(0)] }));
  assert.equal(res.status, 413);
  assert.equal(res.body.error, 'Cuerpo de la peticion demasiado grande');
});
