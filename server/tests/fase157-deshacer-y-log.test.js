// fase157-deshacer-y-log.test.js — Fase 157 (pendientes S-06 y S-07 de la
// Fase 154):
//  - Deshacer una version de un cliente ajeno responde EXACTAMENTE lo mismo
//    que una version que no existe (antes: 403 vs 404, se podia saber que
//    ids existian).
//  - El log de un error 500 no imprime la query de la URL (puede traer
//    nombres, ej. ?agente=...).
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, db, request, cleanup } = require('./helpers');
const { signToken } = require('../auth');
const { cargarLlamadasUnicas } = require('../llamadas-unicas');
const V = require('../cargas-versiones');

after(cleanup);
const auth = (t) => ({ Authorization: 'Bearer ' + t });

test('Deshacer: version de otro cliente = misma respuesta que una que no existe', async () => {
  // Una version de MOBILIZE (reemplazar un mes la guarda).
  const subir = (ag) => cargarLlamadasUnicas(db, { campana: 'MOBILIZE', archivoNombre: ag + '.xlsx', cargadoPorNombre: ag, filas: [[ag, '2026-02-03', 'CONTESTADA', 'S']] });
  subir('F157 Uno');
  subir('F157 Dos');
  const ajena = V.listar(db, 'MOBILIZE', { carga: 'llamadas_unicas', mes: '2026-02' })[0].id;
  // Quien carga, pero solo de ORLANT.
  db.prepare("INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt) VALUES ('Solo Orlant', 'f157orlant', 'REPORTES', 1, 'x', ?, '2026-10-20')").run(JSON.stringify({ cargarDatos: true, campana_ORLANT: true }));
  const u = db.prepare("SELECT * FROM users WHERE user = 'f157orlant'").get();
  const t = signToken({ isMasterAdmin: false, userId: u.id, rol: u.rol, tokenVersion: u.token_version });
  const deAjena = await request(app).post('/api/centro-cargas/versiones/' + ajena + '/deshacer').set(auth(t));
  const inexistente = await request(app).post('/api/centro-cargas/versiones/999999/deshacer').set(auth(t));
  assert.equal(inexistente.status, 404);
  assert.equal(deAjena.status, inexistente.status);
  assert.deepEqual(deAjena.body, inexistente.body);
  assert.equal(V.obtener(db, ajena).restauradoEn, null, 'la version ajena no se toco');
});

test('el log de un error 500 no imprime la query de la URL', async () => {
  const prepareOriginal = db.prepare.bind(db);
  const errorOriginal = console.error;
  const lineas = [];
  db.prepare = (sql) => { if (/FROM historial ORDER BY/.test(sql)) throw new Error('falla de prueba'); return prepareOriginal(sql); };
  console.error = (...a) => { lineas.push(a.map(String).join(' ')); };
  try {
    const t = signToken({ isMasterAdmin: true });
    const res = await request(app).get('/api/historial?agente=Nombre%20Persona&x=1').set(auth(t));
    assert.equal(res.status, 500);
  } finally {
    db.prepare = prepareOriginal;
    console.error = errorOriginal;
  }
  const log = lineas.find((l) => l.startsWith('[error]'));
  assert.ok(log, 'se registro el error');
  assert.match(log, /\/api\/historial/);
  assert.doesNotMatch(log, /agente|Nombre/);
});
