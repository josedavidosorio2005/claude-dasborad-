// fase376-inventario-i1.test.js — Fase 376 (I1 del plan con el diseño de Edwin, OK del usuario 19/11):
// menú lateral con el ciclo (Registrar, Libres, Asignados, En reparación, Malos), vistas por estado,
// dos inventarios con el mismo motor («sistemas» y «inmuebles», este vacío) y precarga de sedes y
// operaciones del diseño. Datos INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const tk = {};
before(async () => {
  db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
    .run('Persona Inventada f376', 'f376_sis', 'SISTEMAS', bcrypt.hashSync('Clave#2026x', 4), '{}', new Date().toISOString());
  tk.admin = await tokenFor('admin', MASTER_PASSWORD);
  tk.sis = await tokenFor('f376_sis', 'Clave#2026x');
});
const get = (url) => request(app).get('/api' + url).set(H(tk.sis));
const post = (url, b) => request(app).post('/api' + url).set(H(tk.sis)).send(b);

test('dos inventarios con el mismo motor: tipos, lista y resumen por ámbito', async () => {
  const sis = (await get('/activos/config')).body, inm = (await get('/activos/config?ambito=inmuebles')).body;
  assert.equal(sis.ambito, 'sistemas');
  assert.equal(sis.tipos.length, 7);
  assert.deepEqual(inm.tipos.map((t) => t.codigo), ['SILLA', 'MESA', 'PAPELERA']);
  assert.equal((await get('/activos/config?ambito=otra')).body.ambito, 'sistemas', 'un ámbito desconocido cae en sistemas');
  assert.equal((await post('/activos', { tipo: 'MOUSE', codigo: 'M-376' })).status, 201);
  const silla = await post('/activos', { tipo: 'SILLA', codigo: 'S-376', estado: 'en_reparacion' });
  assert.equal(silla.status, 201, JSON.stringify(silla.body));
  assert.deepEqual((await get('/activos?ambito=sistemas')).body.activos.map((a) => a.codigo), ['M-376']);
  assert.deepEqual((await get('/activos?ambito=inmuebles')).body.activos.map((a) => a.codigo), ['S-376']);
  assert.deepEqual((await get('/activos?ambito=inmuebles&estado=en_reparacion')).body.activos.map((a) => a.codigo), ['S-376']);
  assert.equal((await get('/activos?ambito=inmuebles&estado=libre')).body.activos.length, 0);
  const rs = (await get('/activos/resumen?ambito=sistemas')).body, ri = (await get('/activos/resumen?ambito=inmuebles')).body;
  assert.deepEqual([rs.total, rs.porEstado.libre, ri.total, ri.porEstado.en_reparacion], [1, 1, 1, 1]);
  // Un tipo nuevo queda en el inventario desde el que se crea.
  const t = await post('/activos/config/tipos?ambito=inmuebles', { nombre: 'Locker inventado', plural: 'Lockers inventados', campos: [] });
  assert.equal(t.status, 201, JSON.stringify(t.body));
  assert.equal(t.body.tipo.ambito, 'inmuebles');
  assert.ok(!(await get('/activos/config')).body.tipos.some((x) => x.codigo === t.body.tipo.codigo));
});

test('filtro por operación', async () => {
  assert.equal((await post('/activos', { tipo: 'TECLADO', codigo: 'T-376', operacion: 'Mobilize' })).status, 201);
  assert.deepEqual((await get('/activos?ambito=sistemas&operacion=Mobilize')).body.activos.map((a) => a.codigo), ['T-376']);
});

test('sedes y operaciones precargadas del diseño, sin repetir lo que ya estaba', () => {
  const l = (n) => db.prepare('SELECT valor FROM activos_listas WHERE lista = ? ORDER BY orden').all(n).map((r) => r.valor);
  assert.deepEqual(l('sedes'), ['Jericó', 'Sonsón', 'Medellín']);
  assert.equal(l('operaciones').length, 9);
  assert.ok(l('operaciones').includes('Mobilize'));
  assert.ok(db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'fase376_inventario_listas_v1'").get());
});

test('interfaz: menú con el ciclo y conteos; inmuebles sin agentes ni asignados; tarjeta nueva', () => {
  global.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  try {
    const UI = require(path.join(__dirname, '..', '..', 'public', 'js', 'activos.js'));
    const m = UI.activosMenuHtml('sistemas', 'libres', { total: 9, porEstado: { libre: 4, en_uso: 3, en_reparacion: 1, malo: 1 } });
    for (const x of ['Panel general', 'Registrar ingreso', 'Libres', 'Asignados', 'En reparación', 'Malos', 'Inventario', 'Agentes', 'Ajustes y datos']) assert.ok(m.includes(x), x);
    assert.match(m, /data-ac-vista="libres" aria-current="page"/);
    assert.match(m, /Libres<\/span><span class="ac-menu-n">4</);
    const mi = UI.activosMenuHtml('inmuebles', 'panel', null);
    assert.ok(!mi.includes('Agentes') && !mi.includes('Asignados'));
    assert.deepEqual(UI.AC_VISTA_ESTADO, { libres: 'libre', asignados: 'en_uso', reparacion: 'en_reparacion', malos: 'malo' });
    assert.ok(UI.activosFlujoHtml('sistemas').includes('Asignar a un agente'));
    assert.ok(!UI.activosFlujoHtml('inmuebles').includes('Asignar a un agente'));
  } finally { delete global.esc; }
  const L = require(path.join(__dirname, '..', '..', 'public', 'js', 'dashboards-logic.js'));
  const t = L.dashTarjetasEntrada('SISTEMAS', false, false).find((x) => x.key === 'inmuebles');
  assert.deepEqual([t.label, t.accion, t.icon], ['Inventario de inmuebles', 'activosAbrirInmuebles', 'i-armchair']);
  assert.ok(require('fs').readFileSync(path.join(__dirname, '..', '..', 'public', 'img', 'iconos', 'lucide.svg'), 'utf8').includes('<symbol id="i-armchair"'));
});
