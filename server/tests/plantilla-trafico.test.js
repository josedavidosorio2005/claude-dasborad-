// plantilla-trafico.test.js — Plantilla oficial de Tráfico (pedido explícito
// del cliente, 2026-09-15): UNA sola plantilla, publicada tal cual desde
// server/plantillas/PLANTILLA_TRAFICO_INCONEXION_VACIA.xlsx (nunca
// regenerada por código), descargable solo con canLoadData, y que debe
// pasar la validación real del sistema sin fricción una vez llena.
//
// Cubre dos cosas distintas:
//  1) GET /calidad/trafico/plantilla sirve EXACTAMENTE ese archivo (byte a
//     byte) y exige el mismo permiso que cargar la base.
//  2) El archivo real, llenado con datos de prueba respetando los formatos
//     que su propia hoja INSTRUCCIONES describe (fecha nativa, horas
//     h:mm:ss, NIVEL DE ATENCION/TASA DE ABNDONO como fracción), pasa la
//     carga real de punta a punta sin errores ni avisos — el fixture
//     `plantilla-trafico-con-datos-prueba.xlsx` se generó a partir del
//     archivo publicado (ver scratchpad/build-fixture.js del PR), nunca de
//     una plantilla inventada aparte.
'use strict';

const fs = require('fs');
const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const { leerHojaXlsxComoAoA } = require('./helpers/xlsx-lite');
const { traficoParseFilas } = require('../../public/js/trafico-logic.js');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

const PLANTILLA_OFICIAL = path.join(__dirname, '..', 'plantillas', 'PLANTILLA_TRAFICO_INCONEXION_VACIA.xlsx');
const FIXTURE_LLENA = path.join(__dirname, 'fixtures', 'plantilla-trafico-con-datos-prueba.xlsx');

test('GET /calidad/trafico/plantilla: sirve el archivo real publicado, byte a byte, con canLoadData', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app)
    .get('/api/calidad/trafico/plantilla')
    .set(auth(admin))
    .buffer(true)
    .parse((response, callback) => {
      const chunks = [];
      response.on('data', (c) => chunks.push(c));
      response.on('end', () => callback(null, Buffer.concat(chunks)));
    });
  assert.equal(res.status, 200);
  assert.match(res.headers['content-disposition'] || '', /PLANTILLA_TRAFICO_INCONEXION_VACIA\.xlsx/);

  const real = fs.readFileSync(PLANTILLA_OFICIAL);
  assert.equal(Buffer.compare(res.body, real), 0, 'el archivo servido debe ser byte a byte identico al publicado en server/plantillas/');
});

test('GET /calidad/trafico/plantilla: sin el permiso Cargar Datos -> 403 (no descargable por un usuario de solo visualizacion)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const create = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send({
      nombre: 'Solo lectura',
      user: 'plantilla_sololectura_' + Math.random().toString(36).slice(2, 7),
      password: 'ClavePlantilla123',
      rol: 'CLIENTES_DASH',
      perms: { ClientesDash: true, ['cliente_ORLANT']: true },
    });
  const token = await tokenFor(create.body.user, 'ClavePlantilla123');
  const res = await request(app).get('/api/calidad/trafico/plantilla').set(auth(token));
  assert.equal(res.status, 403);
});

test('GET /calidad/trafico/plantilla: sin autenticar -> 401 (no es un archivo estatico publico)', async () => {
  const res = await request(app).get('/api/calidad/trafico/plantilla');
  assert.equal(res.status, 401);
});

test('la plantilla oficial, llenada respetando los formatos de su hoja INSTRUCCIONES, pasa la carga real sin errores ni avisos', async () => {
  // El fixture es el archivo REAL publicado + 2 filas de datos de prueba
  // (ver server/tests/fixtures/plantilla-trafico-con-datos-prueba.xlsx) —
  // nunca una plantilla recreada a mano.
  const aoa = leerHojaXlsxComoAoA(FIXTURE_LLENA, 'DATA');
  const parseo = traficoParseFilas(aoa);
  assert.ok(!parseo.error, 'la plantilla oficial no debe producir ningun error de columnas faltantes: ' + parseo.error);
  assert.equal(parseo.avisos.length, 0, 'no debe haber ninguna fila descartada: ' + JSON.stringify(parseo.avisos));
  assert.equal(parseo.filas.length, 2);

  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app)
    .post('/api/calidad/trafico/carga')
    .set(auth(admin))
    .send({ archivoNombre: 'PLANTILLA_TRAFICO_INCONEXION_VACIA.xlsx', filas: parseo.filas });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.insertadas, 2);

  // Los valores llegan intactos a la base (round-trip completo, no solo el parseo).
  const rows = await request(app)
    .get('/api/calidad/nivel-servicio/diario?campana=' + encodeURIComponent('(SIN ASIGNAR)'))
    .set(auth(admin));
  const fila1 = rows.body.find((r) => r.skillName === 'SKILL PRUEBA PLANTILLA 1');
  assert.ok(fila1);
  assert.equal(fila1.totalLlamadas, 120);
  assert.equal(fila1.contestadas, 108);
  assert.equal(fila1.nivelAtencionPct, 90);
  assert.equal(fila1.ahtSegundos, 195);
});
