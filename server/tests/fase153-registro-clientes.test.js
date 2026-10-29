// fase153-registro-clientes.test.js — Fase 153 (Paso 1): registro de
// clientes en la base. Sin cambio visible: las listas que salen del
// registro son IDENTICAS a las fijas de antes.
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { app, db, request, tokenFor, MASTER_PASSWORD, cleanup } = require('./helpers');
const reg = require('../clientes-registro');

after(cleanup);

const PUB = path.join(__dirname, '..', '..', 'public', 'js');
const leer = (f) => fs.readFileSync(path.join(PUB, f), 'utf8');
const auth = (t) => ({ Authorization: 'Bearer ' + t });

// Las listas fijas tal como estaban antes de la Fase 153.
const ANTES = ['ORLANT', 'MOBILIZE'];
// Fase 153 (P3): CLINICA AURORA se agrega al registro por su propia
// migracion (fase153-crear-aurora.test.js), al final de las listas. Lo de
// ORLANT y MOBILIZE sigue identico.
const AURORA = 'CLINICA AURORA';
// Fase 160: + HOSPITAL LA MARIA, por su propia migracion (fase160-crear-hlm.test.js).
const CON_AURORA = ANTES.concat([AURORA, 'HOSPITAL LA MARIA']);
// Fase 215: SURA tiene tablero propio (Televentas) y no tiene Calidad.
const CON_SURA = CON_AURORA.concat(['SURA']);

function listaDeConstants(nombre) {
  const m = leer('constants.js').match(new RegExp('var ' + nombre + " = \\[([^\\]]*)\\];"));
  assert.ok(m, nombre);
  return m[1].split(',').map((x) => x.trim().replace(/^'|'$/g, ''));
}

test('el registro sembrado da exactamente las listas de antes', () => {
  assert.deepEqual(reg.listaClientes(db), CON_SURA);
  assert.deepEqual(reg.campanasCalidad(db), CON_AURORA);
  assert.deepEqual(reg.REGISTRO_INICIAL.map((c) => c.nombre), ANTES, 'la semilla sigue siendo solo ORLANT y MOBILIZE');
  // El respaldo de constants.js sigue igual a la semilla.
  assert.deepEqual(listaDeConstants('CLIENTES_LIST'), ANTES);
  assert.deepEqual(listaDeConstants('CAMPANAS_CALIDAD'), ANTES);
  const m = db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'clientes_registro_v1'").get();
  assert.ok(m, 'la semilla quedo registrada como migracion de una sola vez');
});

test('la semilla describe los modulos y parametros reales de ORLANT y MOBILIZE', () => {
  const r = Object.fromEntries(reg.leerRegistro(db).map((c) => [c.nombre, c]));
  assert.deepEqual(Object.keys(r), CON_SURA);
  assert.ok(r.ORLANT.modulos.includes('whatsapp_tiempos'));
  assert.ok(!r.ORLANT.modulos.includes('llamadas_unicas'));
  assert.ok(r.MOBILIZE.modulos.includes('llamadas_unicas') && r.MOBILIZE.modulos.includes('encuesta'));
  assert.equal(r.MOBILIZE.parametros.asesorVisibleCliente, true);
  assert.equal(r.ORLANT.parametros.asesorVisibleCliente, false);
  assert.deepEqual(r.ORLANT.parametros.sedes, [], 'sedes previstas (Calidad por sede)');
  assert.equal(r.ORLANT.logo.src, 'img/clientes/orlant-logo-blanco.png');
  assert.equal(r.MOBILIZE.logo.width, 140);
});

test('ningun cliente borrado en la Fase 134 entra en la semilla', () => {
  const nombres = reg.REGISTRO_INICIAL.map((c) => c.nombre);
  for (const borrado of ['CLINICA AURORA', 'HOSPITAL LA MARIA']) {
    assert.ok(!nombres.includes(borrado), borrado);
  }
});

test('sembrar es idempotente y nunca pisa una fila editada', () => {
  const mem = new Database(':memory:');
  reg.crearTablaRegistro(mem);
  assert.equal(reg.sembrarRegistro(mem), 2);
  mem.prepare("UPDATE clientes_registro SET modulos = '[\"calidad\"]' WHERE nombre = 'ORLANT'").run();
  assert.equal(reg.sembrarRegistro(mem), 0);
  assert.deepEqual(reg.leerRegistro(mem)[0].modulos, ['calidad']);
  // Un cliente desactivado sale de las listas.
  mem.prepare("UPDATE clientes_registro SET activo = 0 WHERE nombre = 'MOBILIZE'").run();
  assert.deepEqual(reg.listaClientes(mem), ['ORLANT']);
  mem.close();
});

test('GET /api/dashboard/clientes expone las listas del registro (y sigue igual lo de antes)', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const r = await request(app).get('/api/dashboard/clientes').set(auth(t));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.clientes.slice().sort(), [AURORA, 'HOSPITAL LA MARIA', 'MOBILIZE', 'ORLANT']);
  assert.deepEqual(r.body.listaClientes, CON_SURA);
  assert.deepEqual(r.body.campanasCalidad, CON_AURORA);
  assert.deepEqual(Object.keys(r.body).sort(), ['campanasCalidad', 'clientes', 'listaClientes', 'registro']);
  const sin = await request(app).get('/api/dashboard/clientes');
  assert.equal(sin.status, 401);
});

test('el navegador toma las listas del servidor ANTES de armar los permisos', () => {
  const core = leer('dashboards-core.js');
  assert.match(core, /CLIENTES_LIST = r\.listaClientes/);
  assert.match(core, /CAMPANAS_CALIDAD = r\.campanasCalidad/);
  const ses = leer('session.js');
  const lineas = ses.split('\n').filter((l) => l.includes('await loadData()'));
  assert.equal(lineas.length, 2);
  lineas.forEach((l) => assert.ok(l.indexOf('loadDashboardClientes()') < l.indexOf('loadData()'), l.trim()));
});
