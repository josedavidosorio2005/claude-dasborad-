// tipificacion-body-size-limit.test.js — Fase 77: Tipificacion de ORLANT
// tiene ~2x el volumen de Agendas (~15.000 filas/mes solo Llamadas, en
// crecimiento) -- medido contra datos reales, 14.940 filas en formato
// array ya pesan ~1.4mb y 30.000 filas ~2.8mb, superando el limite GLOBAL
// de 2mb (Fase 72). server.js le da a /calidad/tipificacion/carga(/impacto)
// un limite mayor (8mb) SOLO a esas 2 rutas -- el resto de la API sigue en
// 2mb (ver body-size-limit.test.js, sin tocar). Datos SIEMPRE inventados.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

// [agente, fecha, hora, duracionMin, tipificacion, skill]
function filaTipificacion(i) {
  const dia = String((i % 28) + 1).padStart(2, '0');
  return ['ASESOR_DE_PRUEBA_TAMANO_' + (i % 21), '2027-01-' + dia, '18:06:08', 3, 'TIPIFICACION_DE_PRUEBA_' + (i % 62), 'LLAMADAS DE SALIDA'];
}

test('Fase 77: 15.000 filas de Tipificacion (~1.4mb, supera el limite GLOBAL de 2mb solo si el body fuera objeto, aqui en array) se aceptan sin 413', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const filas = Array.from({ length: 15000 }, (_, i) => filaTipificacion(i));
  const body = JSON.stringify({ campana: 'ORLANT', canal: 'LLAMADAS', archivoNombre: 'prueba15000.xlsx', filas });
  // Confirma que este body de prueba de verdad pone a prueba el limite
  // especifico de esta ruta (mayor al global de 2mb que usa el resto de la API).
  assert.ok(body.length > 1 * 1024 * 1024, 'el body de prueba debe superar 1mb: ' + body.length);

  const res = await request(app)
    .post('/api/calidad/tipificacion/carga')
    .set(auth(admin))
    .set('Content-Type', 'application/json')
    .send(body);

  assert.notEqual(res.status, 413, 'no debe rechazarse por tamano de body: ' + JSON.stringify(res.body));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.insertadas, 15000);
});

test('Fase 77: 30.000 filas (stress-test pedido, ~2.8mb -- ya supera el limite GLOBAL de 2mb) se aceptan bajo el limite mayor de esta ruta (8mb)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const filas = Array.from({ length: 30000 }, (_, i) => filaTipificacion(i));
  const body = JSON.stringify({ campana: 'ORLANT', canal: 'WHATSAPP', archivoNombre: 'prueba30000.xlsx', filas });
  assert.ok(body.length > 2 * 1024 * 1024, 'el body de prueba debe superar 2mb (el limite GLOBAL de la API): ' + body.length);
  assert.ok(body.length < 8 * 1024 * 1024, 'el body de prueba debe quedar bajo el limite de esta ruta (8mb): ' + body.length);

  const res = await request(app)
    .post('/api/calidad/tipificacion/carga')
    .set(auth(admin))
    .set('Content-Type', 'application/json')
    .send(body);

  assert.notEqual(res.status, 413, 'no debe rechazarse por tamano de body: ' + JSON.stringify(res.body));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.insertadas, 30000);
});

test('Fase 77: un body que de verdad supera el limite de esta ruta (8mb) sigue devolviendo 413', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const relleno = 'X'.repeat(9 * 1024 * 1024);
  const res = await request(app)
    .post('/api/calidad/tipificacion/carga')
    .set(auth(admin))
    .set('Content-Type', 'application/json')
    .send(JSON.stringify({ campana: 'ORLANT', canal: 'LLAMADAS', archivoNombre: relleno, filas: [filaTipificacion(0)] }));

  assert.equal(res.status, 413);
  assert.equal(res.body.error, 'Cuerpo de la peticion demasiado grande');
});

test('Fase 77: otras rutas de la API (fuera de la lista) siguen exactamente en el limite GLOBAL de 2mb, sin cambios', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const relleno = 'X'.repeat(3 * 1024 * 1024);
  const res = await request(app)
    .post('/api/calidad/trafico/carga')
    .set(auth(admin))
    .set('Content-Type', 'application/json')
    .send(JSON.stringify({ archivoNombre: relleno, filas: [] }));

  assert.equal(res.status, 413, 'el resto de la API no debe heredar el limite mayor de Tipificacion');
});
