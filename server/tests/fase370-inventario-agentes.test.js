// fase370-inventario-agentes.test.js — Fase 370 (pedido de Edwin 18/11, E2): agentes y asignación
// por elemento en el «Inventario de sistemas». Cada elemento por separado; asignar lo pone «En uso»;
// devolver y cambiar piden motivo. Solo ADMIN y SISTEMAS. Datos INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const tk = {};
const ids = {};
before(async () => {
  for (const [u, rol] of [['f370_sis', 'SISTEMAS'], ['f370_sup', 'SUPERVISOR']]) {
    db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
      .run('Persona Inventada ' + u, u, rol, bcrypt.hashSync('Clave#2026x', 4), '{}', new Date().toISOString());
  }
  tk.admin = await tokenFor('admin', MASTER_PASSWORD);
  tk.sis = await tokenFor('f370_sis', 'Clave#2026x');
  tk.sup = await tokenFor('f370_sup', 'Clave#2026x');
  await request(app).put('/api/activos/listas/sedes').set(H(tk.sis)).send({ valores: ['Sede Inventada E2'] });
  for (const [tipo, codigo] of [['DIADEMA', 'E2-D1'], ['DIADEMA', 'E2-D2'], ['MONITOR', 'E2-M1'], ['ADMINISTRABLE', 'E2-SW']]) {
    const r = await request(app).post('/api/activos').set(H(tk.sis)).send({ tipo, codigo });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    ids[codigo] = r.body.activo.id;
  }
});
const P = (url, b, t) => request(app).post('/api/activos' + url).set(H(t || tk.sis)).send(b);

test('agentes: solo ADMIN y SISTEMAS; validaciones; documento único', async () => {
  assert.equal((await request(app).get('/api/activos/agentes').set(H(tk.sup))).status, 403);
  assert.equal((await P('/agentes', { nombre: 'Agente Inventado Uno' }, tk.sup)).status, 403);
  for (const malo of [{ nombre: 'AB' }, { nombre: 'Agente Inventado', documento: '1 2' }, { nombre: 'Agente Inventado', sede: 'No existe' }, { nombre: 'Agente Inventado', otro: 1 }]) {
    assert.equal((await P('/agentes', malo)).status, 400, JSON.stringify(malo));
  }
  const a = await P('/agentes', { nombre: '  Agente   Inventado Uno ', documento: '900001', sede: 'Sede Inventada E2' });
  assert.equal(a.status, 201, JSON.stringify(a.body));
  assert.equal(a.body.agente.nombre, 'Agente Inventado Uno');
  ids.ag1 = a.body.agente.id;
  assert.equal((await P('/agentes', { nombre: 'Otro Inventado', documento: '900001' })).status, 409);
  ids.ag2 = (await P('/agentes', { nombre: 'Agente Inventado Dos' }, tk.admin)).body.agente.id;
  const l = (await request(app).get('/api/activos/agentes?q=Inventado').set(H(tk.sis))).body.agentes;
  assert.deepEqual(l.map((g) => [g.nombre, g.elementos]), [['Agente Inventado Dos', 0], ['Agente Inventado Uno', 0]]);
});

test('asignar: solo libres, no administrables, agente activo; queda «En uso» con historial', async () => {
  assert.equal((await P('/' + ids['E2-SW'] + '/asignar', { agenteId: ids.ag1 })).status, 400, 'administrable no');
  assert.equal((await P('/' + ids['E2-D1'] + '/asignar', { agenteId: 99999 })).status, 400, 'agente inexistente');
  assert.equal((await P('/' + ids['E2-D1'] + '/asignar', { agenteId: String(ids.ag1) })).status, 400, 'id como texto');
  const r = await P('/' + ids['E2-D1'] + '/asignar', { agenteId: ids.ag1 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.activo.estado, r.body.activo.agente.nombre], ['en_uso', 'Agente Inventado Uno']);
  assert.equal((await P('/' + ids['E2-D1'] + '/asignar', { agenteId: ids.ag2 })).status, 400, 'ya asignado');
  assert.equal((await P('/' + ids['E2-M1'] + '/asignar', { agenteId: ids.ag1 })).status, 200);
  // Asignado: no cambia de estado por la vía normal.
  assert.equal((await P('/' + ids['E2-D1'] + '/estado', { estado: 'malo', motivo: 'Se dañó' })).status, 400);
  // No se desactiva un agente con elementos.
  assert.equal((await request(app).put('/api/activos/agentes/' + ids.ag1).set(H(tk.sis)).send({ activo: false })).status, 400);
  const d = (await request(app).get('/api/activos/agentes/' + ids.ag1).set(H(tk.sis))).body;
  assert.deepEqual(d.elementos.map((e) => e.codigo), ['E2-D1', 'E2-M1']);
  const lista = (await request(app).get('/api/activos?q=Agente%20Inventado%20Uno').set(H(tk.sis))).body.activos;
  assert.deepEqual(lista.map((e) => e.codigo).sort(), ['E2-D1', 'E2-M1'], 'se busca por el agente');
  const res = (await request(app).get('/api/activos/resumen').set(H(tk.sis))).body;
  assert.ok(res.agentes.activos >= 2 && res.agentes.conElementos >= 1);
  const h = db.prepare("SELECT detalle FROM historial WHERE accion = 'ACTIVO_ASIGNACION'").all().map((x) => x.detalle).join(' ');
  assert.ok(!/Inventado/.test(h), 'el Historial general no lleva el nombre del agente');
});

test('cambio de elemento: mismo tipo, libre, con motivo; el anterior queda como se diga', async () => {
  const url = '/' + ids['E2-D1'] + '/cambiar';
  assert.equal((await P(url, { nuevoId: ids['E2-D2'], estado: 'malo' })).status, 400, 'sin motivo');
  assert.equal((await P(url, { nuevoId: ids['E2-D2'], estado: 'de_baja', motivo: 'Se rompió' })).status, 400, 'estado no permitido');
  assert.equal((await P(url, { nuevoId: ids['E2-M1'], estado: 'malo', motivo: 'Se rompió' })).status, 400, 'otro tipo');
  const r = await P(url, { nuevoId: ids['E2-D2'], estado: 'malo', motivo: 'Se rompió la diadema' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.anterior.estado, r.body.anterior.agente], ['malo', null]);
  assert.deepEqual([r.body.activo.estado, r.body.activo.agente.id], ['en_uso', ids.ag1]);
  const h = (await request(app).get('/api/activos/' + ids['E2-D1'] + '/historial').set(H(tk.sis))).body.historial;
  assert.deepEqual(h.map((x) => [x.accion, x.estadoDespues]), [['Cambio de elemento', 'malo'], ['Asignación', 'en_uso'], ['Ingreso', 'libre']]);
  assert.match(h[0].motivo, /Se rompió la diadema · de Agente Inventado Uno/);
});

test('devolver: con motivo; el agente sin elementos ya se puede desactivar', async () => {
  for (const codigo of ['E2-D2', 'E2-M1']) {
    assert.equal((await P('/' + ids[codigo] + '/devolver', { estado: 'libre' })).status, 400, 'sin motivo');
    const r = await P('/' + ids[codigo] + '/devolver', { estado: 'libre', motivo: 'Retiro del agente' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual([r.body.activo.estado, r.body.activo.agente], ['libre', null]);
  }
  assert.equal((await P('/' + ids['E2-M1'] + '/devolver', { estado: 'libre', motivo: 'otra vez' })).status, 400, 'ya no está asignado');
  const d = (await request(app).get('/api/activos/agentes/' + ids.ag1).set(H(tk.sis))).body;
  assert.equal(d.elementos.length, 0);
  assert.equal(d.asignaciones.length, 3);
  assert.ok(d.asignaciones.every((s) => s.hasta && s.motivoFin));
  const off = await request(app).put('/api/activos/agentes/' + ids.ag1).set(H(tk.sis)).send({ activo: false });
  assert.equal(off.status, 200, JSON.stringify(off.body));
  assert.ok(!(await request(app).get('/api/activos/agentes').set(H(tk.sis))).body.agentes.some((g) => g.id === ids.ag1), 'inactivo fuera de la lista');
  assert.ok((await request(app).get('/api/activos/agentes?todos=1').set(H(tk.sis))).body.agentes.some((g) => g.id === ids.ag1));
  assert.equal((await P('/' + ids['E2-M1'] + '/asignar', { agenteId: ids.ag1 })).status, 400, 'agente inactivo');
});

test('interfaz: agentes escapan los textos', () => {
  global.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  try {
    const UI = require(path.join(__dirname, '..', '..', 'public', 'js', 'activos.js'));
    const html = UI.activosAgentesHtml([{ id: 1, nombre: '<i>X</i>', documento: '', sede: '', operacion: '', activo: 1, elementos: 2 }]);
    assert.ok(html.includes('&lt;i&gt;X&lt;/i&gt;') && !html.includes('<i>X'));
    assert.match(UI.activosAgentesHtml([]), /Aún no hay agentes/);
  } finally { delete global.esc; }
});
