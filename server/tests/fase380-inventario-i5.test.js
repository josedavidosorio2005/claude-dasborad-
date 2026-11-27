// fase380-inventario-i5.test.js — Fase 380 (I5 del plan con el diseño de Edwin): equipos administrables
// (red e infraestructura): subtipos nuevos, ubicación, precio y renta; código automático por subtipo;
// aviso de IP repetida; actas de mantenimiento sin «devolución» falsa; vista propia. Datos INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor } = require('./helpers');
const { completar, completarEdicion, crearIncompleto } = require('./helpers-activos'); // Fase INV2: registrar exige todos los campos
const A = require('../activos');

const H = (t) => ({ Authorization: 'Bearer ' + t });
let tk;
before(async () => {
  db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
    .run('Persona Inventada f380', 'f380_sis', 'SISTEMAS', bcrypt.hashSync('Clave#2026x', 4), '{}', new Date().toISOString());
  tk = await tokenFor('f380_sis', 'Clave#2026x');
});
const P = (url, b) => request(app).post('/api' + url).set(H(tk)).send(url === '/activos' ? completar(b) : b);
const nuevo = (subtipo, extra) => P('/activos', Object.assign({ tipo: 'ADMINISTRABLE', datos: Object.assign({ subtipo }, (extra || {}).datos || {}) }, extra && extra.codigo ? { codigo: extra.codigo } : {}));

test('subtipos y campos nuevos del administrable (migración aditiva)', async () => {
  assert.ok(db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'fase380_inventario_administrables_v1'").get());
  const t = (await request(app).get('/api/activos/config').set(H(tk))).body.tipos.find((x) => x.codigo === 'ADMINISTRABLE');
  assert.deepEqual(t.campos.map((c) => c.k), ['subtipo', 'ip', 'ubicacion', 'responsable', 'precio', 'renta_mensual']);
  assert.deepEqual(t.campos[0].o, ['Servidor', 'Switch', 'Router', 'DVR / NVR', 'Firewall', 'Access Point', 'UPS', 'Otro']);
  const antes = db.prepare("SELECT campos FROM activos_tipos WHERE codigo = 'ADMINISTRABLE'").get().campos;
  A.agregarCamposI5(db);
  assert.equal(db.prepare("SELECT campos FROM activos_tipos WHERE codigo = 'ADMINISTRABLE'").get().campos, antes, 'idempotente');
});

test('código automático por subtipo, único; el código escrito a mano se respeta', async () => {
  const s1 = await nuevo('Servidor');
  assert.equal(s1.status, 201, JSON.stringify(s1.body));
  assert.equal(s1.body.activo.codigo, '5001');
  assert.equal((await nuevo('Servidor')).body.activo.codigo, '5002');
  assert.equal((await nuevo('Switch')).body.activo.codigo, '6001');
  assert.equal((await nuevo('UPS')).body.activo.codigo, '4001');
  assert.equal((await nuevo('Access Point')).body.activo.codigo, '9001');
  assert.equal(crearIncompleto({ tipo: 'ADMINISTRABLE', datos: {} }).body.activo.codigo, '4501', 'sin subtipo (importación): «Otro»');
  assert.equal((await nuevo('Router', { codigo: 'RT-PRINCIPAL' })).body.activo.codigo, 'RT-PRINCIPAL');
  assert.equal((await nuevo('Router')).body.activo.codigo, '8001');
  assert.equal((await nuevo('Firewall')).body.activo.codigo, '8002', 'router y firewall comparten rango');
  assert.equal((await P('/activos', { tipo: 'MOUSE' })).status, 400, 'otros tipos siguen pidiendo código');
});

test('IP repetida: aviso al crear y al editar, sin bloquear', async () => {
  const a = await nuevo('Switch', { datos: { ip: '10.0.0.5', ubicacion: 'Rack inventado' } });
  assert.equal(a.body.aviso, undefined);
  assert.equal(a.body.activo.datos.ubicacion, 'Rack inventado');
  const b = await nuevo('Switch', { datos: { ip: '10.0.0.5' } });
  assert.equal(b.status, 201);
  assert.match(b.body.aviso, /10\.0\.0\.5 ya está registrada en el equipo 6002/);
  const e = await request(app).put('/api/activos/' + a.body.activo.id).set(H(tk)).send(completarEdicion('ADMINISTRABLE', { datos: { subtipo: 'Switch', ip: '10.0.0.5' } }));
  assert.match(e.body.aviso, /6003/);
});

test('mantenimiento y vuelta: actas de reparación y recibo; activo → disponible sin acta de devolución', async () => {
  const s = (await nuevo('DVR / NVR')).body.activo;
  assert.equal(s.codigo, '7001');
  const act = (await P('/activos/' + s.id + '/estado', { estado: 'en_uso', motivo: 'Instalado inventado' })).body;
  assert.deepEqual(act.actas, []);
  assert.deepEqual((await P('/activos/' + s.id + '/estado', { estado: 'libre', motivo: 'Desinstalado' })).body.actas, [], 'sin agente no hay devolución');
  assert.deepEqual((await P('/activos/' + s.id + '/estado', { estado: 'en_reparacion', motivo: 'Disco inventado', tecnico: 'Proveedor X' })).body.actas.map((a) => a.tipo), ['reparacion']);
  assert.deepEqual((await P('/activos/' + s.id + '/estado', { estado: 'libre', motivo: 'Reparado' })).body.actas.map((a) => a.tipo), ['retorno']);
});

test('interfaz: tabla, conteos y subtipos con los nombres de red (escapados)', () => {
  global.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  try {
    const UI = require(path.join(__dirname, '..', '..', 'public', 'js', 'activos.js'));
    const l = [{ id: 1, codigo: '5001', estado: 'en_uso', marca: '<m>', modelo: '', serial: '', sede: '', datos: { subtipo: 'Servidor', ip: '10.0.0.1', responsable: 'R' } },
      { id: 2, codigo: '6001', estado: 'en_reparacion', marca: '', modelo: '', serial: '', sede: '', datos: { subtipo: 'Switch' } }];
    const t = UI.activosAdminHtml(l);
    assert.ok(t.includes('Activo') && t.includes('En mantenimiento') && t.includes('10.0.0.1') && !t.includes('<m>'));
    const k = UI.activosAdminKpisHtml(l);
    assert.ok(k.includes('<b>2</b><span>Registrados') && k.includes('Fuera de servicio'));
    const s = UI.activosAdminSubtiposHtml(l, ['Servidor', 'Switch', 'UPS'], 'Switch');
    assert.ok(s.includes('Todos (2)') && s.includes('UPS (0)') && s.includes('aria-pressed="true" onclick="activosAdminSubtipo(this.dataset.s)" data-s="Switch"'));
    assert.ok(UI.activosMenuHtml('sistemas', 'admin', null).includes('Equipos administrables'));
    assert.ok(!UI.activosMenuHtml('inmuebles', 'panel', null).includes('Equipos administrables'));
  } finally { delete global.esc; }
});
