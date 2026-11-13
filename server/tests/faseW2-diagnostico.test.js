// faseW2-diagnostico.test.js — Fase W2 (diagnostico): /wolkvox/estado dice SOLO si/no si encontro
// el token, si encontro el servidor y si el servidor tiene formato valido. Nunca un valor ni su
// largo, y solo para el administrador. Valores INVENTADOS.
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const wv = require('../wolkvox');

const R = 'MOBILIZE PRUEBAS API';
const TOKEN = 'TOKEN-FALSO-DIAG-0987654321';
const H = (t) => ({ Authorization: 'Bearer ' + t });
let admin, supervisor;

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  const r = await request(app).post('/api/users').set(H(admin)).send({ nombre: 'Persona Ficticia Diag', user: 'supdiag', password: 'Clave#Diagxy1', rol: 'SUPERVISOR', perms: { supervisa_MOBILIZE: true } });
  assert.equal(r.status, 201);
  const row = db.prepare('SELECT perms FROM users WHERE id = ?').get(r.body.id);
  db.prepare('UPDATE users SET perms = ? WHERE id = ?').run(JSON.stringify(Object.assign(JSON.parse(row.perms || '{}'), { ['cliente_' + R]: true, ['campana_' + R]: true })), r.body.id);
  supervisor = await tokenFor('supdiag', 'Clave#Diagxy1');
});
after(() => { delete process.env.WOLKVOX_MOBILIZE_TOKEN; delete process.env.WOLKVOX_MOBILIZE_SERVIDOR; });

const env = (t, s) => { const e = { NODE_ENV: 'test' }; if (t !== undefined) e.WOLKVOX_MOBILIZE_TOKEN = t; if (s !== undefined) e.WOLKVOX_MOBILIZE_SERVIDOR = s; return e; };

test('diagnostico: los tres si/no segun lo que falte', () => {
  const casos = [
    [env(), [false, false, false], false],
    [env(TOKEN), [true, false, false], false],
    [env(undefined, 'servidor01'), [false, true, true], false],
    [env(TOKEN, 'servidor01'), [true, true, true], true],
    [env(TOKEN, 'https://servidor01.wolkvox.com'), [true, true, false], false],
    [env(TOKEN, 'servidor01.wolkvox.com'), [true, true, false], false],
    [env(TOKEN, 'servidor 01'), [true, true, false], false],
    [env('   ', 'servidor01'), [false, true, true], false],
  ];
  for (const [e, [t, s, f], conf] of casos) {
    assert.deepEqual(wv.diagnostico('MOBILIZE', e), { tokenEncontrado: t, servidorEncontrado: s, servidorFormatoValido: f }, JSON.stringify(e));
    assert.equal(wv.estaConfigurado('MOBILIZE', e), conf, JSON.stringify(e));
  }
});

test('espacios o saltos de linea al principio o al final no cuentan (se quitan)', () => {
  const e = env('  ' + TOKEN + '\n', ' servidor01\r\n');
  assert.deepEqual(wv.diagnostico('MOBILIZE', e), { tokenEncontrado: true, servidorEncontrado: true, servidorFormatoValido: true });
  assert.deepEqual(wv.credenciales('MOBILIZE', e), { token: TOKEN, servidor: 'servidor01' });
});

test('estado: el admin recibe solo los tres si/no (booleanos), nunca valores', async () => {
  process.env.WOLKVOX_MOBILIZE_TOKEN = TOKEN;
  process.env.WOLKVOX_MOBILIZE_SERVIDOR = 'https://servidorfalso99.wolkvox.com';
  const r = await request(app).get('/api/wolkvox/estado?campana=' + encodeURIComponent(R)).set(H(admin));
  assert.equal(r.status, 200);
  assert.equal(r.body.configurado, false);
  assert.deepEqual(r.body.diagnostico, { tokenEncontrado: true, servidorEncontrado: true, servidorFormatoValido: false });
  for (const v of Object.values(r.body.diagnostico)) assert.equal(typeof v, 'boolean');
  for (const x of [TOKEN, 'servidorfalso99', 'wolkvox.com', String(TOKEN.length)]) assert.ok(!r.text.includes(x), 'no trae ' + x);
});

test('estado: el diagnostico no sale para nadie mas (403) ni para el Mobilize real (404)', async () => {
  const s = await request(app).get('/api/wolkvox/estado?campana=' + encodeURIComponent(R)).set(H(supervisor));
  assert.equal(s.status, 403);
  assert.ok(!s.text.includes('diagnostico'));
  const m = await request(app).get('/api/wolkvox/estado?campana=MOBILIZE').set(H(admin));
  assert.equal(m.status, 404);
  assert.ok(!m.text.includes('diagnostico'));
});
