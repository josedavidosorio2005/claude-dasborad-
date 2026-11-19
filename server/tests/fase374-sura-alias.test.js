// fase374-sura-alias.test.js — Fase 374 (reunión con Edwin, 19/11): «Alias de asesores» de SURA.
// Solo el administrador; los nombres se normalizan como en el tablero (minúsculas, sin tildes, «_»);
// sin cadenas ni un nombre apuntando a sí mismo; el Historial dice qué cambió. Las bases no se tocan.
// Datos SINTÉTICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const bcrypt = require('bcryptjs');
const { app, db, request, tokenFor, MASTER_PASSWORD } = require('./helpers');
const sura = require('../sura-televentas');

const API = '/api/sura-televentas/SURA';
const H = (t) => ({ Authorization: 'Bearer ' + t });
let tAdmin, tSup;
before(async () => {
  tAdmin = await tokenFor('admin', MASTER_PASSWORD);
  db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
    .run('Supervisor Sintetico 374', 'f374_sup', 'SUPERVISOR', bcrypt.hashSync('Clave#2026x', 4), JSON.stringify({ ClientesDash: true, supervisa_SURA: true }), new Date().toISOString());
  tSup = await tokenFor('f374_sup', 'Clave#2026x');
});
const put = (valor, t = tAdmin) => request(app).put(`${API}/config/agalias`).set(H(t)).send({ valor });
const hist = () => db.prepare("SELECT detalle FROM historial WHERE accion = 'SURA_ALIAS_ASESOR' ORDER BY id DESC").all();

test('normalizado igual al del tablero', () => {
  assert.equal(sura.normAsesor('  Lina   Piedrahita '), 'lina_piedrahita');
  assert.equal(sura.normAsesor('LÍNA MARÍA Piedrahíta'), 'lina_maria_piedrahita');
  assert.deepEqual(sura.difAlias({ a: 'b', c: 'd' }, { a: 'x', e: 'f' }), ['+ a → x', '+ e → f', '− c']);
});

test('solo el administrador; normaliza; sin cadenas ni autoalias; Historial con el cambio', async () => {
  assert.equal((await put({ asesora_sintetica_uno: 'asesora_sintetica_final' }, tSup)).status, 403, 'el supervisor ya no cambia alias');
  assert.equal((await request(app).put(`${API}/config/metas`).set(H(tSup)).send({ valor: {} })).status, 200, 'lo demás de la config sigue igual');
  const r = await put({ 'ASESORA Sintética Uno': 'Asesora Sintetica Final', asesora_sintetica_dos: 'asesora_sintetica_final' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.valor, { asesora_sintetica_uno: 'asesora_sintetica_final', asesora_sintetica_dos: 'asesora_sintetica_final' });
  assert.equal(hist()[0].detalle, '2 alias · + asesora_sintetica_uno → asesora_sintetica_final · + asesora_sintetica_dos → asesora_sintetica_final');
  assert.deepEqual((await request(app).get(`${API}/resumen`).set(H(tAdmin))).body.config.agalias, r.body.valor);
  assert.match((await put({ x_y: 'X Y' })).body.error, /sí mismo/);
  assert.match((await put({ a_b: 'c_d', c_d: 'e_f' })).body.error, /ya es un alias/);
  assert.equal((await put({ a: 5 })).status, 400);
  // Quitar uno.
  assert.equal((await put({ asesora_sintetica_uno: 'asesora_sintetica_final' })).status, 200);
  assert.equal(hist()[0].detalle, '1 alias · − asesora_sintetica_dos');
});

test('interfaz: tabla y sugerencias escapadas, nombres bonitos', () => {
  global.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  try {
    const UI = require(path.join(__dirname, '..', '..', 'public', 'js', 'sura-alias.js'));
    assert.equal(UI.suraAliasBonito('lina_maria_x'), 'Lina Maria X');
    assert.equal(UI.suraAliasNorm(' Lína  María '), 'lina_maria');
    const h = UI.suraAliasHtml({ 'a_<b>': 'c_d' }, ['n_<i>']);
    assert.ok(h.includes('A &lt;b&gt;') && !h.includes('<b>') && h.includes('N &lt;i&gt;') && h.includes('C D'));
    assert.ok(UI.suraAliasHtml({}, []).includes('Sin alias todavía'));
  } finally { delete global.esc; }
});
