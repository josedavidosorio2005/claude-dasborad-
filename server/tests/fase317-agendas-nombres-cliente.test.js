// fase317-agendas-nombres-cliente.test.js — Fase 317 (10/11/2026, pedido del
// supervisor): la cuenta cliente de Clinica Aurora ve los nombres reales en Agendas
// («Usuario que registra»), como el administrador y el supervisor, por una opcion POR
// MODULO del registro (parametros.asesorVisibleClienteModulos). En las demas rutas de
// Aurora sigue sin nombres. Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const reg = require('../clientes-registro');
const priv = require('../privacidad-cliente');

const AURORA = 'CLINICA AURORA', HLM = 'HOSPITAL LA MARIA', MES = '2026-10';
const H = (t) => ({ Authorization: 'Bearer ' + t });
const q = '?campana=' + encodeURIComponent(AURORA);
let admin, cliente, sup;
function crear(user, rol, perms) {
  db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
    .run('Persona ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), new Date().toISOString());
  return tokenFor(user, 'Clave#2026x');
}
const insertar = (tabla, o) => { const k = Object.keys(o); db.prepare(`INSERT INTO ${tabla} (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`).run(...k.map((x) => o[x])); };
before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  cliente = await crear('f317_cliente', 'CLIENTES_DASH', { ClientesDash: true, ['cliente_' + AURORA]: true });
  sup = await crear('f317_sup', 'SUPERVISOR', { ClientesDash: true, ['supervisa_' + AURORA]: true });
  db.prepare("INSERT OR IGNORE INTO alias_asesores (campana, alias, canonico, createdAt) VALUES (?, 'usr317a', 'Asesora Ficticia Uno', '2026-11-10')").run(AURORA);
  db.prepare("INSERT OR IGNORE INTO alias_asesores (campana, alias, canonico, createdAt) VALUES (?, 'usr317b', 'Asesora Ficticia Dos', '2026-11-10')").run(AURORA);
  insertar('agendas_usuaria', { campana: AURORA, mes: MES, sede: 'Sede', usuario: 'usr317a', canal: 'Llamada', tipoCita: 'Cita', tipoPaciente: 'Nuevo', rol: 'confirma', n: 6, createdAt: '2026-11-10' });
  insertar('agendas_usuaria', { campana: AURORA, mes: MES, sede: 'Sede', usuario: 'usr317b', canal: 'Llamada', tipoCita: 'Cita', tipoPaciente: 'Nuevo', rol: 'confirma', n: 2, createdAt: '2026-11-10' });
  for (const ruta of ['aurora-li-cdr', 'aurora-li-whatsapp']) {
    const r = await request(app).post('/api/calidad/' + ruta + '/carga').set(H(admin)).send({ campana: AURORA, filas: [{ mes: MES, agente: 'Agente Ficticio 317', skill: '4166', tipo: 'entrada', tipificacion: 'X', n: 3 }] });
    assert.equal(r.status, 201);
  }
  insertar('tipificaciones', { campana: AURORA, canal: 'LLAMADAS', agente: 'Agente Ficticio 317', fecha: MES + '-02', tipificacion: 'Cita asignada', skill: '-', createdAt: '2026-11-10' });
});

test('registro: la opcion es POR MODULO y solo Aurora tiene Agendas abierta', () => {
  assert.equal(reg.asesorVisibleClienteEnModulo(db, AURORA, 'agendas_usuaria'), true);
  for (const m of ['tipificacion', 'calidad', 'salida', 'cdr_li', 'whatsapp_li', 'calidad_resumen', undefined]) assert.equal(reg.asesorVisibleClienteEnModulo(db, AURORA, m), false, String(m));
  assert.equal(reg.asesorVisibleClienteEnModulo(db, HLM, 'agendas_usuaria'), false, 'HLM sigue igual');
  assert.equal(reg.asesorVisibleClienteEnModulo(db, 'ORLANT', 'agendas_usuaria'), false, 'ORLANT no se toca');
  const actor = { rol: 'CLIENTES_DASH' };
  assert.equal(priv.ocultaAsesores(db, actor, AURORA, 'agendas_usuaria'), false);
  assert.equal(priv.ocultaAsesores(db, actor, AURORA), true, 'sin modulo, la regla de siempre');
  assert.equal(priv.ocultaAsesores(db, actor, HLM, 'agendas_usuaria'), true);
  // Idempotente: correrla otra vez no duplica el modulo.
  require('../db').agendasNombresClienteAurora();
  const p = JSON.parse(db.prepare('SELECT parametros FROM clientes_registro WHERE nombre = ?').get(AURORA).parametros);
  assert.deepEqual(p.asesorVisibleClienteModulos, ['agendas_usuaria']);
  assert.equal(p.asesorOcultoCliente, true, 'la regla general sigue activa');
});

test('Agendas: el cliente de Aurora recibe los nombres reales, igual que administrador y supervisor (mismas filas, orden y cifras)', async () => {
  const c = (await request(app).get('/api/calidad/agendas-usuaria/datos' + q).set(H(cliente))).body;
  const a = (await request(app).get('/api/calidad/agendas-usuaria/datos' + q).set(H(admin))).body;
  const s = (await request(app).get('/api/calidad/agendas-usuaria/datos' + q).set(H(sup))).body;
  assert.ok(c.filas.some((f) => f.asesora === 'Asesora Ficticia Uno') && c.filas.some((f) => f.asesora === 'Asesora Ficticia Dos'));
  assert.ok(!c.filas.some((f) => /^Asesor \d+$/.test(f.asesora)));
  assert.deepEqual(c, a); assert.deepEqual(s, a);
});

test('las demas rutas de Aurora siguen SIN nombres para el cliente; admin y supervisor, igual que antes', async () => {
  const cdr = (await request(app).get('/api/calidad/aurora-li-cdr/datos' + q).set(H(cliente))).body;
  assert.ok(!JSON.stringify(cdr).includes('Agente Ficticio 317'), 'líneas internas (PR #743)');
  const wpp = (await request(app).get('/api/calidad/aurora-li-whatsapp/datos' + q).set(H(cliente))).body;
  assert.ok(!JSON.stringify(wpp).includes('Agente Ficticio 317'));
  const op = (await request(app).get('/api/calidad/tipificacion/opciones' + q + '&canal=LLAMADAS').set(H(cliente))).body;
  assert.deepEqual(op.agentes, [], 'Tipificación');
  const sal = (await request(app).get('/api/calidad/salida/asesores' + q + '&mes=' + MES).set(H(cliente))).body;
  assert.deepEqual(sal.asesores, [], 'Salida');
  assert.ok((await request(app).get('/api/calidad/aurora-li-cdr/datos' + q).set(H(admin))).body.filas.some((f) => f.agente === 'Agente Ficticio 317'), 'admin ve el agente');
  assert.ok((await request(app).get('/api/calidad/aurora-li-cdr/datos' + q).set(H(sup))).body.filas.some((f) => f.agente === 'Agente Ficticio 317'), 'supervisor ve el agente');
  assert.ok((await request(app).get('/api/calidad/tipificacion/opciones' + q + '&canal=LLAMADAS').set(H(admin))).body.agentes.includes('Agente Ficticio 317'));
});
