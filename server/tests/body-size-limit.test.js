// body-size-limit.test.js — Fase 72 (hallazgo N2): el limite global de
// express.json() subio de 100kb a 2mb (traficoCargaBody admite hasta 5000
// filas, que en JSON real ya pasan de 100kb). Sigue habiendo un limite --
// esto solo confirma que el nuevo tope es el correcto: un body real de
// carga grande (entre 100kb y 2mb) ya NO se rechaza por tamano, y un body
// que de verdad se pasa de 2mb SI se sigue rechazando con 413.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

function filaTrafico(i) {
  return {
    fecha: '2026-09-01',
    skillName: 'SKILL_DE_PRUEBA_TAMANO_' + i,
    totalLlamadas: 10,
    contestadas: 8,
    llamadasAbandonadas: 2,
    serviceLevel10secPct: 80,
    serviceLevel20secPct: 90,
    serviceLevel30secPct: 95,
    asaSegundos: 12.5,
    ataSegundos: 15.2,
    ahtSegundos: 180.5,
  };
}

test('N2: un body de carga real (~150kb, entre el limite viejo y el nuevo) ya NO se rechaza por tamano', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  // ~150kb de JSON (mas de las 100kb viejas, muy por debajo de las 2mb nuevas).
  const filas = Array.from({ length: 900 }, (_, i) => filaTrafico(i));
  const body = JSON.stringify({ archivoNombre: 'prueba.xlsx', filas });
  assert.ok(body.length > 100 * 1024, 'el body de prueba debe superar 100kb: ' + body.length);
  assert.ok(body.length < 2 * 1024 * 1024, 'el body de prueba debe quedar bajo 2mb: ' + body.length);

  const res = await request(app)
    .post('/api/calidad/trafico/carga')
    .set(auth(admin))
    .set('Content-Type', 'application/json')
    .send(body);

  assert.notEqual(res.status, 413, 'no debe rechazarse por tamano de body: ' + JSON.stringify(res.body));
});

test('N2: un body que de verdad supera 2mb sigue devolviendo 413', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  // Relleno de un solo campo de texto para pasar de 2mb sin miles de filas.
  const relleno = 'X'.repeat(3 * 1024 * 1024);
  const res = await request(app)
    .post('/api/calidad/trafico/carga')
    .set(auth(admin))
    .set('Content-Type', 'application/json')
    .send(JSON.stringify({ archivoNombre: relleno, filas: [filaTrafico(0)] }));

  assert.equal(res.status, 413);
  assert.equal(res.body.error, 'Cuerpo de la peticion demasiado grande');
});
