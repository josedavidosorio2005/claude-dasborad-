// fase280-usuario-reglas-claras.test.js — Fase 280 (pedido de Edwin, 06/11): no se
// pudo crear «maria_gonzalez». La regla (3 a 32, letras sin tilde, numeros, . - _)
// ya lo permitia; el aviso no decia que sobraba (tilde, espacio...). Ahora el
// navegador dice exactamente que corregir, con la MISMA regla del servidor.
// Usuarios SINTETICOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const R = require('../../public/js/usuario-regla-logic.js');
const { app, request, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: 'Bearer ' + t });
const crear = async (admin, user) => request(app).post('/api/users').set(auth(admin))
  .send({ nombre: 'Prueba Sintética', user, password: 'ClavePrueba1234', rol: 'CALIDAD', perms: { Calidad: true, campana_ORLANT: true } });

test('«maria_gonzalez» y un usuario de 30 y de 32 caracteres sirven, en el navegador y en el servidor', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  for (const u of ['maria_gonzalez', 'nombre.apellido_segundo_ab1234', 'a'.repeat(32), 'Orlant', 'k.ramirez-2']) {
    assert.equal(R.usuarioProblema(u), null, u);
    const r = await crear(admin, u);
    assert.equal(r.status, 201, u + ' ' + JSON.stringify(r.body));
  }
  assert.equal('nombre.apellido_segundo_ab1234'.length, 30);
});

test('cada error con su aviso exacto (y el servidor tambien lo rechaza)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const casos = [
    ['maria_gonzález', /tildes ni ñ.*«maria_gonzalez»/],
    ['peña.ruiz', /tildes ni ñ.*«pena\.ruiz»/],
    ['maria gonzalez', /espacios.*«maria_gonzalez»/],
    ['ab', /al menos 3/],
    ['a'.repeat(33), /hasta 32 caracteres \(tiene 33\)/],
    ['maria@gonzalez', /no puede tener «@»/],
  ];
  for (const [u, aviso] of casos) {
    assert.match(R.usuarioProblema(u), aviso, u);
    const r = await crear(admin, u);
    assert.equal(r.status, 400, u);
  }
});

test('el navegador y el servidor aceptan exactamente lo mismo (usuarios inventados)', () => {
  const { schemas } = require('../validation');
  const servidor = (u) => schemas.createUserBody.safeParse({ nombre: 'X', user: u, password: 'ClavePrueba1234', rol: 'CALIDAD' }).success;
  const letras = 'aZ09._-ñáé @#/'.split('');
  let s = 7; const rnd = (n) => { s = (s * 16807) % 2147483647; return s % n; };
  for (let k = 0; k < 400; k++) {
    const u = Array.from({ length: 1 + rnd(36) }, () => letras[rnd(letras.length)]).join('');
    assert.equal(R.usuarioProblema(u) === null, servidor(u), JSON.stringify(u));
  }
});

test('el formulario muestra la regla y no deja escribir mas de 32', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  assert.match(html, /id="mu-user" placeholder="Ej: maria_gonzalez" maxlength="32"/);
  assert.match(html, /id="mu-user-ayuda"[^>]*>3 a 32 caracteres: letras sin tilde, números, punto \(\.\), guion \(-\) y guion bajo \(_\)\./);
  assert.ok(html.indexOf('js/usuario-regla-logic.js') < html.indexOf('js/users.js'));
  const users = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'users.js'), 'utf8');
  assert.match(users, /var problemaUsuario = usuarioProblema\(user\);/);
});
