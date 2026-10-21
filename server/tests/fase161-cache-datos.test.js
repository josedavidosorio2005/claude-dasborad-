// fase161-cache-datos.test.js — Fase 161: cache de respuestas de datos
// (cache-datos.js). La segunda lectura sale de la cache con el mismo cuerpo;
// una carga la invalida; iniciar sesion no; la clave es por usuario (rol y
// permisos), asi un usuario nunca recibe la respuesta guardada de otro.
// Datos 100% sinteticos.
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, db, request, tokenFor, MASTER_PASSWORD, cleanup } = require('./helpers');
const { RUTAS, claveDe } = require('../cache-datos');
const { llamadasUnicasResumen } = require('../llamadas-unicas');

after(cleanup);
const auth = (t) => ({ Authorization: 'Bearer ' + t });
const C = 'MOBILIZE';

async function subir(t, fecha, skill) {
  const r = await request(app).post('/api/calidad/llamadas-unicas/carga').set(auth(t))
    .send({ campana: C, archivoNombre: 'f161.xlsx', filas: [['Asesor F161', fecha, 'CONTESTADA', skill]] });
  assert.equal(r.status, 201, JSON.stringify(r.body));
}

test('solo rutas de datos; opciones, cargas y administracion quedan fuera', () => {
  const entra = (p) => RUTAS.some((r) => r.test(p));
  assert.ok(entra('/calidad/llamadas-unicas/resumen'));
  assert.ok(entra('/calidad/agendas/linea'));
  for (const p of ['/calidad/llamadas-unicas/opciones', '/calidad/llamadas-unicas/carga', '/monitoreos', '/metas', '/admin/borrado-rango', '/users', '/dashboard/ORLANT']) {
    assert.ok(!entra(p), p);
  }
});

test('la clave cambia con el usuario, el rol, los permisos y los filtros (orden de la query no importa)', () => {
  const u = { id: 7, rol: 'SUPERVISOR', token_version: 0, active: 1, perms: { cliente_MOBILIZE: true } };
  const k = claveDe('/x', { b: '2', a: '1' }, u);
  assert.equal(claveDe('/x', { a: '1', b: '2' }, u), k);
  assert.notEqual(claveDe('/x', { a: '1', b: '3' }, u), k);
  assert.notEqual(claveDe('/x', { a: '1', b: '2' }, { ...u, id: 8 }), k);
  assert.notEqual(claveDe('/x', { a: '1', b: '2' }, { ...u, rol: 'REPORTES' }), k);
  assert.notEqual(claveDe('/x', { a: '1', b: '2' }, { ...u, perms: { cliente_MOBILIZE: true, verAsesores: true } }), k);
  assert.notEqual(claveDe('/x', { a: '1', b: '2' }, { isMasterAdmin: true }), k);
});

test('segunda lectura igual (desde la cache); una carga invalida; iniciar sesion no', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const leer = async () => {
    const r = await request(app).get('/api/calidad/llamadas-unicas/resumen?campana=' + C).set(auth(t));
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body;
  };
  await subir(t, '2026-02-03', 'SKILL F161 A');
  const a = await leer();
  assert.deepEqual(a, JSON.parse(JSON.stringify(llamadasUnicasResumen(db, { campana: C }))), 'igual que la consulta directa');

  const n0 = a.total;
  await tokenFor('admin', MASTER_PASSWORD); // iniciar sesion
  assert.deepEqual(await leer(), a, 'iniciar sesion no cambia nada');

  await subir(t, '2026-02-04', 'SKILL F161 B');
  const b = await leer();
  assert.equal(b.total, n0 + 1, 'la carga invalida la cache');
  assert.deepEqual(b, JSON.parse(JSON.stringify(llamadasUnicasResumen(db, { campana: C }))));
});

test('un usuario sin acceso sigue recibiendo 403 aunque otro ya haya llenado la cache', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const ok = await request(app).get('/api/calidad/llamadas-unicas/resumen?campana=' + C).set(auth(t));
  assert.equal(ok.status, 200);
  const crear = await request(app).post('/api/users').set(auth(t))
    .send({ nombre: 'F161 Sin Acceso', user: 'f161_sin_acceso', password: 'Clave#F161x', rol: 'SUPERVISOR', perms: {} });
  assert.ok([200, 201].includes(crear.status), JSON.stringify(crear.body));
  const sin = await tokenFor('f161_sin_acceso', 'Clave#F161x');
  const r = await request(app).get('/api/calidad/llamadas-unicas/resumen?campana=' + C).set(auth(sin));
  assert.equal(r.status, 403, JSON.stringify(r.body));
});
