// fase378-inventario-i3.test.js — Fase 378 (I3 del plan con el diseño de Edwin): gestión desde el
// elemento: asignar (a un agente existente o a uno nuevo con nombre y cédula), reasignar, cambiar y
// quitar; un elemento asignado cambia de estado registrando la devolución; técnico en reparación.
// Datos INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor } = require('./helpers');
const { completar } = require('./helpers-activos'); // Fase INV2: registrar exige todos los campos

const H = (t) => ({ Authorization: 'Bearer ' + t });
let tk;
const ids = {};
before(async () => {
  for (const [u, rol] of [['f378_sis', 'SISTEMAS'], ['f378_sup', 'SUPERVISOR']]) {
    db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
      .run('Persona Inventada ' + u, u, rol, bcrypt.hashSync('Clave#2026x', 4), '{}', new Date().toISOString());
  }
  tk = { sis: await tokenFor('f378_sis', 'Clave#2026x'), sup: await tokenFor('f378_sup', 'Clave#2026x') };
  for (const [tipo, codigo] of [['MOUSE', 'I3-M1'], ['MOUSE', 'I3-M2'], ['TORRE', 'I3-T1'], ['SILLA', 'I3-S1'], ['ADMINISTRABLE', 'I3-SW']]) {
    const r = await request(app).post('/api/activos').set(H(tk.sis)).send(completar({ tipo, codigo }));
    assert.equal(r.status, 201, JSON.stringify(r.body));
    ids[codigo] = r.body.activo.id;
  }
  const g = await request(app).post('/api/activos/agentes').set(H(tk.sis)).send({ nombre: 'Agente Inventado Tres', documento: '3000001' });
  ids.ag1 = g.body.agente.id;
});
const P = (url, b, t) => request(app).post('/api/activos' + url).set(H(t || tk.sis)).send(b);
const hist = (id) => db.prepare('SELECT accion, estadoAntes, estadoDespues, motivo FROM activos_historial WHERE activoId = ? ORDER BY id DESC').all(id);
const agentesN = () => db.prepare('SELECT COUNT(*) n FROM activos_agentes').get().n;

test('asignar a un agente nuevo (nombre y cédula); la misma cédula usa el agente que ya existe', async () => {
  const n0 = agentesN();
  const r = await P('/' + ids['I3-M1'] + '/asignar', { agenteNuevo: { nombre: 'Agente Inventado Cuatro', documento: '4000001' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.activo.estado, r.body.activo.agente.nombre, r.body.agenteCreado], ['en_uso', 'Agente Inventado Cuatro', true]);
  assert.equal(agentesN(), n0 + 1);
  const r2 = await P('/' + ids['I3-T1'] + '/asignar', { agenteNuevo: { nombre: 'Otro nombre inventado', documento: '3000001' } });
  assert.equal(r2.status, 200, JSON.stringify(r2.body));
  assert.deepEqual([r2.body.activo.agente.id, r2.body.agenteCreado], [ids.ag1, false]);
  assert.equal(agentesN(), n0 + 1);
  // Sin cédula, o si la asignación falla, no queda un agente nuevo creado.
  assert.match((await P('/' + ids['I3-M2'] + '/asignar', { agenteNuevo: { nombre: 'Agente Sin Cédula' } })).body.error, /cédula/);
  assert.equal((await P('/' + ids['I3-SW'] + '/asignar', { agenteNuevo: { nombre: 'Agente Que No Queda', documento: '5000001' } })).status, 400);
  assert.equal(agentesN(), n0 + 1, 'la transacción deshace el agente nuevo');
  assert.equal((await P('/' + ids['I3-M2'] + '/asignar', { agenteNuevo: 'x' })).status, 400);
  assert.equal((await P('/' + ids['I3-M2'] + '/asignar', { agenteId: ids.ag1 }, tk.sup)).status, 403);
});

test('reasignar a otro agente: sigue en uso, con motivo e historial', async () => {
  const id = ids['I3-M1'];
  assert.match((await P('/' + id + '/reasignar', { agenteId: ids.ag1 })).body.error, /motivo/);
  assert.match((await P('/' + ids['I3-M2'] + '/reasignar', { agenteId: ids.ag1, motivo: 'Cambio de puesto' })).body.error, /no está asignado/);
  const r = await P('/' + id + '/reasignar', { agenteId: ids.ag1, motivo: 'Cambio de puesto' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.activo.estado, r.body.activo.agente.id], ['en_uso', ids.ag1]);
  assert.match((await P('/' + id + '/reasignar', { agenteId: ids.ag1, motivo: 'Otra vez' })).body.error, /Ya está asignado/);
  assert.deepEqual(hist(id)[0], { accion: 'Reasignación', estadoAntes: 'en_uso', estadoDespues: 'en_uso', motivo: 'Cambio de puesto · de Agente Inventado Cuatro a Agente Inventado Tres' });
  assert.equal(db.prepare('SELECT COUNT(*) n FROM activos_asignaciones WHERE activoId = ? AND hasta IS NULL').get(id).n, 1);
  const d = (await request(app).get('/api/activos/agentes/' + ids.ag1).set(H(tk.sis))).body;
  assert.ok(d.elementos.some((x) => x.id === id));
  // Reasignar a un agente nuevo también funciona.
  const r2 = await P('/' + id + '/reasignar', { agenteNuevo: { nombre: 'Agente Inventado Cinco', documento: '5000002' }, motivo: 'Ingreso a la campaña' });
  assert.equal(r2.status, 200, JSON.stringify(r2.body));
  assert.equal(r2.body.agenteCreado, true);
});

test('un elemento asignado cambia de estado: se registra la devolución; técnico en reparación', async () => {
  const id = ids['I3-T1'];
  const r = await P('/' + id + '/estado', { estado: 'en_reparacion', motivo: 'No enciende', tecnico: 'Soporte inventado' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.activo.estado, r.body.activo.agente, r.body.devuelto], ['en_reparacion', null, true]);
  assert.deepEqual(hist(id)[0], { accion: 'Devolución por cambio de estado', estadoAntes: 'en_uso', estadoDespues: 'en_reparacion', motivo: 'No enciende · Técnico: Soporte inventado · de Agente Inventado Tres' });
  // El técnico solo cuenta en reparación.
  const m = await P('/' + ids['I3-M2'] + '/estado', { estado: 'malo', motivo: 'Cable roto', tecnico: 'No va' });
  assert.equal(hist(ids['I3-M2'])[0].motivo, 'Cable roto');
  assert.equal(m.body.activo.estado, 'malo');
});

test('interfaz: botones según el estado; selector de agente y cuerpo de la petición (escapados)', () => {
  global.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  global._acOpciones = (l) => l.map((o) => '<option>' + global.esc(o) + '</option>').join('');
  try {
    const UI = require(path.join(__dirname, '..', '..', 'public', 'js', 'activos.js'));
    const libre = UI.activosGestionHtml({ tipo: 'MOUSE', estado: 'libre', agente: null }, 'sistemas');
    assert.ok(libre.includes('Asignar a un agente'));
    const asig = UI.activosGestionHtml({ tipo: 'MOUSE', estado: 'en_uso', agente: { id: 7, nombre: '<x>' } }, 'sistemas');
    for (const t of ['Reasignar a otro agente', 'Cambiar elemento', 'Quitar asignación', 'Ver agente', 'activosIrAgente(7)']) assert.ok(asig.includes(t), t);
    assert.ok(!asig.includes('<x>') && asig.includes('&lt;x&gt;'));
    assert.equal(UI.activosGestionHtml({ tipo: 'SILLA', estado: 'libre', agente: null }, 'inmuebles'), '');
    assert.equal(UI.activosGestionHtml({ tipo: 'ADMINISTRABLE', estado: 'libre', agente: null }, 'sistemas'), '');
    assert.ok(UI.activosGestionHtml({ tipo: 'MOUSE', estado: 'malo', agente: null }, 'sistemas').includes('márcalo como «Libre»'));
    const sel = UI.activosAgenteSelectHtml([{ id: 1, nombre: 'Uno <b>', documento: '1' }, { id: 2, nombre: 'Dos', documento: '' }], 2, ['Op']);
    assert.ok(sel.includes('Uno &lt;b&gt; · 1') && !sel.includes('>Dos<') && sel.includes('__nuevo'));
    assert.deepEqual(UI.activosAgenteBody('3', {}), { agenteId: 3 });
    assert.deepEqual(UI.activosAgenteBody('__nuevo', { nombre: 'N', documento: 'D', operacion: '' }), { agenteNuevo: { nombre: 'N', documento: 'D', operacion: '' } });
    assert.equal(UI.activosAgenteBody('', {}), null);
  } finally { delete global.esc; delete global._acOpciones; }
});
