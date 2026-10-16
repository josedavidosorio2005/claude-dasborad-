// fase151-endurecimiento.test.js — Fase 151 (medios y bajos): query
// validada de verdad en Express 5, 404 para archivos inexistentes y rutas
// ocultas, Permissions-Policy, umbrales en el Historial, cuentas de ejemplo
// que no se reactivan con su contrasena publica y logs sin datos de mas.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { z } = require('zod');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const config = require('../config');
const { validate } = require('../validation');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
let admin;

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
});

test('validate(..., "query") deja al handler la query YA validada (trim, sin claves extra)', async () => {
  const mini = express();
  mini.get('/x', validate(z.object({ a: z.string().trim() }), 'query'), (req, res) => res.json(req.query));
  const res = await request(mini).get('/x?a=%20hola%20&extra=1');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { a: 'hola' });
});

test('archivos inexistentes y rutas ocultas responden 404, no el index de la SPA', async () => {
  for (const ruta of ['/.env', '/.git/config', '/package.json', '/server/data/inconexion.db', '/backups/x.sqlite', '/js/no-existe.js']) {
    const res = await request(app).get(ruta);
    assert.equal(res.status, 404, ruta);
    assert.doesNotMatch(res.text, /<html/i, ruta);
  }
});

test('la SPA y los estaticos reales siguen respondiendo igual', async () => {
  for (const ruta of ['/', '/index.html', '/cualquier-ruta-de-la-spa']) {
    const res = await request(app).get(ruta);
    assert.equal(res.status, 200, ruta);
    assert.match(res.text, /<html/i, ruta);
  }
  assert.equal((await request(app).get('/js/api.js')).status, 200);
});

test('Permissions-Policy niega camara, microfono, ubicacion, pagos y USB', async () => {
  const res = await request(app).get('/api/health');
  const pp = res.headers['permissions-policy'] || '';
  for (const f of ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()', 'usb=()']) assert.ok(pp.includes(f), f);
  assert.doesNotMatch(pp, /fullscreen=\(\)/, 'pantalla completa sigue permitida');
});

test('crear, editar y eliminar un umbral queda en el Historial', async () => {
  const base = { metrica: 'F151_METRICA', campana: 'ORLANT', verde: 90, amarillo: 80, direccion: 'mayor_es_mejor' };
  const creado = await request(app).post('/api/umbrales').set(auth(admin)).send(base);
  assert.equal(creado.status, 201);
  await request(app).put('/api/umbrales/' + creado.body.id).set(auth(admin)).send({ verde: 95 });
  await request(app).delete('/api/umbrales/' + creado.body.id).set(auth(admin));
  const filas = db.prepare("SELECT detalle FROM historial WHERE accion = 'UMBRAL' AND detalle LIKE '%F151_METRICA%' ORDER BY id").all();
  assert.deepEqual(filas.map((f) => f.detalle.split(' ')[0]), ['Creado', 'Actualizado', 'Eliminado']);
});

test('cuenta de ejemplo: se detecta su contrasena publica y deja de detectarse al cambiarla', async () => {
  const row = db.prepare("SELECT * FROM users WHERE user = 'agomez'").get();
  assert.equal(db.tieneContrasenaDeEjemplo(row), true);
  assert.equal(db.tieneContrasenaDeEjemplo({ ...row, user: 'otra_persona' }), false);
  try {
    const r = await request(app).put(`/api/users/${row.id}/password`).set(auth(admin)).send({ password: 'OtraClave#151xx' });
    assert.equal(r.status, 200);
    assert.equal(db.tieneContrasenaDeEjemplo(db.prepare('SELECT * FROM users WHERE id = ?').get(row.id)), false);
  } finally {
    // deja la cuenta como estaba para el resto de archivos de prueba
    db.prepare('UPDATE users SET password_hash = ?, active = 1, debe_cambiar_password = 0 WHERE id = ?').run(row.password_hash, row.id);
  }
});

test('reactivar: el bloqueo de cuentas de ejemplo es solo de produccion (fuera de produccion se reactiva igual que antes)', async () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'usuarios.js'), 'utf8');
  assert.ok(src.includes('newActive === 1 && config.isProduction && db.tieneContrasenaDeEjemplo(row)'));
  assert.equal(config.isProduction, false);
  const row = db.prepare("SELECT * FROM users WHERE user = 'agomez'").get();
  await request(app).put(`/api/users/${row.id}/active`).set(auth(admin)); // suspende
  const reactivada = await request(app).put(`/api/users/${row.id}/active`).set(auth(admin));
  assert.equal(reactivada.status, 200);
  assert.equal(reactivada.body.active, true);
});

test('la verificacion de restauracion no imprime el error crudo de AWS', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'verificar-restore-backup.js'), 'utf8');
  assert.doesNotMatch(src, /err\.stack/);
});

test('el aviso "ultimo mes con datos" no arma el mes dentro de un string JS del onclick', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'dashboard-generic.js'), 'utf8');
  assert.doesNotMatch(src, /onclick="_gdIrAMes\(\\'/);
  assert.match(src, /data-mes="'\+esc\(ultimoMesConDatos\)\+'" onclick="_gdIrAMes\(this\.dataset\.mes\)"/);
});
