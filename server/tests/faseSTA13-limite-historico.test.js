// faseSTA13-limite-historico.test.js — «Cargar histórico (con gestión)» del STA mandaba más de 2 MB con el
// archivo de septiembre (4.933 filas) y el servidor respondía 413 sin leerlo. Ahora /api/orlant/sta/historico
// está en RUTAS_LIMITE_MAYOR (8 MB), como la carga de la base del STA. Datos INVENTADOS; solo revisión (dryRun).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const fila = (i) => ({
  'Fecha Ingreso Sta': '2026-09-02 08:00:00', Entidad: 'ENTIDAD INVENTADA DE PRUEBA', 'Numero Autorizacion': 'STA13-' + i, Estado: 'Facturado',
  'Descripcion Cups': 'CUPS INVENTADO DE PRUEBA PARA TAMANO', 'Fecha Autorizacion': '2026-09-01 00:00:00', 'Fecha Expiracion': '2026-12-31 00:00:00',
  Servicio: 'SERVICIO INVENTADO', fechaGestion: '2026-09-03', codificacion: 'Paciente atendido', observacion: 'Observación inventada '.repeat(6), asesor: 'Persona Inventada',
});

test('STA13: /historico acepta un cuerpo de más de 2 MB (y menos de 8 MB) sin 413', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const body = JSON.stringify({ archivo: 'STA - INVENTADO.xlsx', filas: Array.from({ length: 6000 }, (_, i) => fila(i)), dryRun: true });
  assert.ok(body.length > 2 * 1024 * 1024 && body.length < 8 * 1024 * 1024, 'tamaño de prueba: ' + body.length);
  const res = await request(app).post('/api/orlant/sta/historico').set(auth(admin)).set('Content-Type', 'application/json').send(body);
  assert.equal(res.status, 200, JSON.stringify(res.body).slice(0, 200));
  assert.equal(res.body.dryRun, true);
});

test('STA13: /historico por encima de 8 MB sigue devolviendo 413', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/orlant/sta/historico').set(auth(admin)).set('Content-Type', 'application/json')
    .send(JSON.stringify({ archivo: 'X'.repeat(9 * 1024 * 1024), filas: [fila(0)], dryRun: true }));
  assert.equal(res.status, 413);
});
