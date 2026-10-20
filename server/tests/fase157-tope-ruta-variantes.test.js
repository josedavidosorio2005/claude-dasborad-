// fase157-tope-ruta-variantes.test.js — Fase 157: el tope de cargas
// simultaneas reconoce la ruta de carga como la reconoce Express (sin
// distinguir mayusculas y con barra final opcional). Antes, otra forma de
// escribir la misma ruta llegaba a la carga sin pedir turno.
'use strict';
process.env.CARGAS_SIMULTANEAS_MAX = '1'; // solo en este proceso de prueba
const http = require('http');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, db, request, tokenFor, MASTER_PASSWORD, cleanup } = require('./helpers');
const { signToken } = require('../auth');
const { esRutaDeCarga } = require('../cargas-simultaneas');

let server;
let base;
let token;
let tokenOtro;
before(async () => {
  token = await tokenFor('admin', MASTER_PASSWORD);
  db.prepare("INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt) VALUES ('Otro', 'f157otro', 'REPORTES', 1, 'x', ?, '2026-10-20')").run(JSON.stringify({ cargarDatos: true, campana_ORLANT: true }));
  const o = db.prepare("SELECT * FROM users WHERE user = 'f157otro'").get();
  tokenOtro = signToken({ isMasterAdmin: false, userId: o.id, rol: o.rol, tokenVersion: o.token_version });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = 'http://127.0.0.1:' + server.address().port;
});
after(() => { server.closeAllConnections(); server.close(); cleanup(); });

// Otra persona ocupa el unico turno con una carga a medio subir.
function cargaEnCurso() {
  const cuerpo = Buffer.from(JSON.stringify({ campana: 'ORLANT', canal: 'LLAMADAS', filas: [] }));
  const req = http.request(base + '/api/calidad/tipificacion/carga', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tokenOtro, 'Content-Type': 'application/json', 'Content-Length': cuerpo.length },
  });
  const respuesta = new Promise((resolve) => req.on('response', (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); }));
  req.write(cuerpo.subarray(0, 5));
  return { terminar: () => { req.end(cuerpo.subarray(5)); return respuesta; } };
}
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const conToken = (r) => r.set('Authorization', 'Bearer ' + token);

test('con el tope lleno, la misma carga escrita de otra forma tambien espera su turno', async () => {
  const primera = cargaEnCurso();
  await pausa(150);
  const cuerpo = { campana: 'ORLANT', canal: 'LLAMADAS', filas: [] };
  for (const ruta of ['/api/calidad/tipificacion/Carga', '/api/calidad/tipificacion/carga/', '/API/Calidad/Tipificacion/CARGA/']) {
    const res = await conToken(request(base).post(ruta)).send(cuerpo);
    assert.equal(res.status, 503, 'POST ' + ruta);
    assert.equal(res.body.codigo, 'CARGAS_EN_CURSO', 'POST ' + ruta);
  }
  for (const ruta of ['/api/Centro-Cargas/ORLANT/agendas/2026-08', '/api/centro-cargas/ORLANT/agendas/2026-08/']) {
    assert.equal((await conToken(request(base).delete(ruta))).status, 503, 'DELETE ' + ruta);
  }
  assert.equal((await conToken(request(base).post('/api/Centro-Cargas/versiones/1/Deshacer')).send({})).status, 503, 'Deshacer');
  await primera.terminar();
});

test('esRutaDeCarga reconoce las variantes y sigue sin confundir otras rutas', () => {
  for (const [method, path] of [['POST', '/api/Gerencia/Carga'], ['POST', '/api/admin/borrado-rango/'], ['DELETE', '/api/dashboard/cargas/7/'], ['POST', '/api/MONITOREOS/BULK']]) {
    assert.equal(esRutaDeCarga({ method, path }), true, method + ' ' + path);
  }
  for (const [method, path] of [['POST', '/api/Monitoreos'], ['GET', '/api/Calidad/Tipificacion/Carga'], ['POST', '/api/auth/login/']]) {
    assert.equal(esRutaDeCarga({ method, path }), false, method + ' ' + path);
  }
});

test('una ruta de 8 MB escrita de otra forma conserva su limite de 8 MB', async () => {
  // 3 MB: pasa el limite normal (2 MB) pero no el mayor (8 MB).
  const filas = 'x'.repeat(3 * 1024 * 1024);
  const res = await conToken(request(base).post('/api/calidad/encuestas/Carga/')).send({ campana: 'ORLANT', relleno: filas });
  assert.notEqual(res.status, 413);
});
