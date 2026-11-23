// faseSTA5-regresar-gestionados.test.js — pedido 2 de Edwin (reunión 23/11/2026): «Regresar a
// disponibles» desde Gestionados, (a) por codificación y (b) por casos marcados, para TODAS las
// codificaciones (también las efectivas, como Agendado). Los casos vuelven a la bolsa libre; la gestión
// queda en «Gestiones anteriores»; el Historial dice quién lo hizo. Datos INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const STA = require('../orlant-sta');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const B = '/api/orlant/sta';
let admin, sup, cli, as1, as2, id1, id2;
function crear(user, rol, perms, asesorCampana) {
  return Number(db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, asesorCampana, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,?,0)`)
    .run('Prueba ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), asesorCampana || null, new Date().toISOString()).lastInsertRowid);
}
const tok = (u) => tokenFor(u, 'Clave#2026x');
const caso = (n) => db.prepare('SELECT * FROM sta_casos WHERE campana = ? AND numero = ?').get('ORLANT', n);
async function codificar(t, numero, tipi, citas) {
  const cfg = STA.config(db);
  const r = await request(app).post(B + '/casos/' + encodeURIComponent(numero) + '/codificar').set(H(t)).send(Object.assign({ tipi, obs: 'Obs inventada ' + numero }, cfg.efectivas.includes(tipi) ? { citas: citas || 1 } : {}));
  assert.equal(r.status, 200, JSON.stringify(r.body));
}

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  crear('sta5_sup', 'SUPERVISOR', { campana_ORLANT: true, cliente_ORLANT: true });
  crear('sta5_cli', 'CLIENTES_DASH', { ClientesDash: true, cliente_ORLANT: true });
  id1 = crear('sta5_as1', 'ASESOR', { campana_ORLANT: true }, 'ORLANT');
  id2 = crear('sta5_as2', 'ASESOR', { campana_ORLANT: true }, 'ORLANT');
  [sup, cli, as1, as2] = await Promise.all(['sta5_sup', 'sta5_cli', 'sta5_as1', 'sta5_as2'].map(tok));
  const filas = Array.from({ length: 6 }, (_, n) => ({ 'Fecha Ingreso Sta': '2026-11-0' + (n + 1) + ' 08:00:00', Entidad: 'ENTIDAD INVENTADA', 'Numero Autorizacion': 'RG' + (100 + n), Estado: 'AUTORIZADA', 'Descripcion Cups': 'CUPS', 'Fecha Autorizacion': '2026-10-01 00:00:00', 'Fecha Expiracion': '2027-01-01 00:00:00', Servicio: 'SERV' }));
  assert.equal((await request(app).post(B + '/cargas').set(H(admin)).send({ archivo: 'rg.xlsx', columnas: STA.CAMPOS, filas })).status, 200);
  // El agendado tiene que ser efectivo (pide citas).
  const cfg = STA.config(db);
  if (!cfg.efectivas.includes('Agendado')) assert.equal((await request(app).put(B + '/config/tipis').set(H(admin)).send({ tipis: cfg.tipis, efectivas: cfg.efectivas.concat(['Agendado']) })).status, 200);
  assert.equal((await request(app).post(B + '/asignar').set(H(admin)).send({ agenteId: id1, cantidad: 6 })).status, 200);
  await codificar(as1, 'RG100', 'No contesta');
  await codificar(as1, 'RG101', 'No contesta');
  await codificar(as1, 'RG102', 'Agendado', 3);
  await codificar(as1, 'RG103', 'Rechaza');
});

test('permisos: solo quien gestiona el STA; asesora y cliente 403', async () => {
  for (const t of [as1, cli]) assert.equal((await request(app).post(B + '/gestionados/regresar').set(H(t)).send({ tipi: 'No contesta' })).status, 403);
  assert.equal(caso('RG100').estado, 'gestionado');
});

test('validación: una codificación O una lista, no las dos ni ninguna', async () => {
  for (const body of [{}, { tipi: 'No contesta', numeros: ['RG100'] }, { numeros: [] }, { tipi: '   ' }]) {
    assert.equal((await request(app).post(B + '/gestionados/regresar').set(H(sup)).send(body)).status, 400, JSON.stringify(body));
  }
});

test('(a) por codificación: todos los «No contesta» vuelven libres; la gestión queda en «Gestiones anteriores»; Historial con quién', async () => {
  const r = await request(app).post(B + '/gestionados/regresar').set(H(sup)).send({ tipi: 'No contesta' });
  assert.equal(r.status, 200);
  assert.equal(r.body.regresados, 2);
  for (const n of ['RG100', 'RG101']) {
    const c = caso(n);
    assert.equal(c.estado, 'pendiente');
    assert.equal(c.agenteId, null, 'libre, sin asesor');
    assert.deepEqual([c.tipi, c.obs, c.fg, c.citas], ['', '', '', 0]);
    const prev = JSON.parse(c.prev);
    assert.equal(prev.length, 1);
    assert.equal(prev[0].tipi, 'No contesta');
    assert.equal(prev[0].obs, 'Obs inventada ' + n);
    assert.equal(prev[0].agente, id1);
    assert.match(prev[0].regresado, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    assert.match(prev[0].por, /sta5_sup|Prueba sta5_sup/);
  }
  assert.equal(caso('RG102').estado, 'gestionado', 'las demás codificaciones no se tocan');
  const h = db.prepare("SELECT actor, detalle FROM historial WHERE accion = 'STA_REGRESAR' ORDER BY id DESC").get();
  assert.match(h.detalle, /2 gestionados regresados a disponibles · codificación «No contesta»/);
  assert.match(String(h.actor), /sta5_sup/);
  // Vuelven a la bolsa: se pueden asignar a otra asesora, que ve la gestión anterior.
  assert.equal((await request(app).post(B + '/asignar').set(H(sup)).send({ agenteId: id2, cantidad: 2 })).status, 200);
  const de2 = (await request(app).get(B + '/estado').set(H(as2))).body.casos;
  const r100 = de2.find((c) => c._id === 'RG100');
  assert.ok(r100, 'la otra asesora lo recibe');
  assert.equal(r100._prev[0].tipi, 'No contesta');
});

test('(b) marcados uno a uno, también una efectiva (Agendado); los no gestionados o inexistentes no cuentan', async () => {
  const r = await request(app).post(B + '/gestionados/regresar').set(H(admin)).send({ numeros: ['RG102', 'RG103', 'RG105', 'NO-EXISTE'] });
  assert.equal(r.status, 200);
  assert.equal(r.body.regresados, 2, 'RG105 está pendiente y NO-EXISTE no existe');
  const c = caso('RG102');
  assert.equal(c.estado, 'pendiente');
  assert.equal(JSON.parse(c.prev)[0].citas, 3, 'las citas de la gestión quedan en el historial');
  assert.match(db.prepare("SELECT detalle FROM historial WHERE accion = 'STA_REGRESAR' ORDER BY id DESC").get().detalle, /marcados uno a uno/);
});

test('navegador: barra «Regresar a disponibles» y casillas en Gestionados (por el generador)', () => {
  const appJs = fs.readFileSync(path.join(__dirname, '..', '..', 'public/js/orlant-sta-app.js'), 'utf8');
  for (const x of ['id=\\"gsRegTi\\"', 'STAapp.regresarPorTipi()', 'STAapp.regresarSel()', 'STAapp.marcarGestTodos(this.checked)', 'API.regresar({tipi:t})', 'API.regresar({numeros:ids})']) assert.ok(appJs.includes(x), x);
  const mont = fs.readFileSync(path.join(__dirname, '..', '..', 'public/js/orlant-sta.js'), 'utf8');
  assert.match(mont, /regresar: function \(cuerpo\) \{ return apiRequest\('POST', STA_BASE \+ '\/gestionados\/regresar', cuerpo\); \}/);
});
