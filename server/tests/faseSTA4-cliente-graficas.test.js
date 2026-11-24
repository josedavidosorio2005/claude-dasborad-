// faseSTA4-cliente-graficas.test.js — pedido de Edwin (reunión 23/11/2026): la pestaña STA del
// Dashboard del CLIENTE de ORLANT muestra la MISMA visual de «Gráficas» del panel de Gestión STA (el
// código de Edwin), de solo lectura. El servidor manda los casos RECORTADOS (GET /estado?vista=cliente):
// solo los campos que grafica, sin número de autorización, otras columnas, observaciones ni historial.
// Los nombres de las asesoras sí (decisión del usuario, 23/11). Datos INVENTADOS.
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
const RAIZ = path.join(__dirname, '..', '..');
const SECRETO = 'NUM-AUT-INVENTADO-STA4';
const PACIENTE = 'PACIENTE INVENTADO STA4';
const OBS = 'OBSERVACION INVENTADA STA4';
let admin, sup, cli, cliOtro, as1, id1;

function crear(user, rol, perms, asesorCampana) {
  const r = db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, asesorCampana, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,?,0)`)
    .run('Asesora Inventada ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), asesorCampana || null, new Date().toISOString());
  return r.lastInsertRowid;
}
const tok = (u) => tokenFor(u, 'Clave#2026x');

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  crear('sta4_sup', 'SUPERVISOR', { campana_ORLANT: true, cliente_ORLANT: true });
  crear('sta4_cli', 'CLIENTES_DASH', { ClientesDash: true, cliente_ORLANT: true });
  crear('sta4_cliotro', 'CLIENTES_DASH', { ClientesDash: true, cliente_MOBILIZE: true });
  id1 = Number(crear('sta4_as1', 'ASESOR', { campana_ORLANT: true }, 'ORLANT'));
  [sup, cli, cliOtro, as1] = await Promise.all(['sta4_sup', 'sta4_cli', 'sta4_cliotro', 'sta4_as1'].map(tok));
  // Base con una columna extra (nombre del paciente) que NUNCA debe llegar al cliente.
  const filas = [1, 2, 3].map((n) => ({ 'Fecha Ingreso Sta': '2026-11-0' + n + ' 08:00:00', Entidad: 'ENTIDAD INVENTADA', 'Numero Autorizacion': SECRETO + n, Estado: 'AUTORIZADA', 'Descripcion Cups': 'CUPS INVENTADO', 'Fecha Autorizacion': '2026-10-01 00:00:00', 'Fecha Expiracion': '2027-01-01 00:00:00', Servicio: 'SERVICIO INVENTADO', Paciente: PACIENTE }));
  const r = await request(app).post(B + '/cargas').set(H(admin)).send({ archivo: 'base-inventada.xlsx', columnas: STA.CAMPOS.concat(['Paciente']), filas });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal((await request(app).post(B + '/asignar').set(H(admin)).send({ agenteId: id1, cantidad: 2 })).status, 200);
  const est = (await request(app).get(B + '/estado').set(H(as1))).body;
  const num = est.casos[0]._id;
  const c = await request(app).post(B + '/casos/' + encodeURIComponent(num) + '/codificar').set(H(as1)).send({ tipi: 'No contesta', obs: OBS });
  assert.equal(c.status, 200, JSON.stringify(c.body));
});

test('vista cliente: el cliente de ORLANT y quienes gestionan; nadie más', async () => {
  for (const t of [cli, sup, admin]) {
    const r = await request(app).get(B + '/estado?vista=cliente').set(H(t));
    assert.equal(r.status, 200);
    assert.equal(r.body.vista, 'cliente');
  }
  for (const t of [cliOtro, as1]) assert.equal((await request(app).get(B + '/estado?vista=cliente').set(H(t))).status, 403);
  // Sin «vista=cliente», el cliente sigue sin acceso al estado completo.
  assert.equal((await request(app).get(B + '/estado').set(H(cli))).status, 403);
});

test('casos recortados: solo lo que grafica; nunca número de autorización, otras columnas, observaciones ni historial', async () => {
  const r = (await request(app).get(B + '/estado?vista=cliente').set(H(cli))).body;
  const txt = JSON.stringify(r);
  for (const x of [SECRETO, PACIENTE, OBS, 'Numero Autorizacion', '_obs', '_hist', '_prev', '_rell', '_cargaId']) assert.ok(!txt.includes(x), 'no debe salir: ' + x);
  const permitidas = new Set(['_id', '_agente', '_estado', '_tipi', '_fg', '_citas'].concat(STA.CAMPOS_CLIENTE));
  for (const c of r.casos) for (const k of Object.keys(c)) assert.ok(permitidas.has(k), 'clave no permitida: ' + k);
  assert.ok(r.casos.length >= 3);
  assert.ok(r.casos.every((c) => /^c\d+$/.test(c._id)), 'el id es un consecutivo, no el número del caso');
  const g = r.casos.filter((c) => c._estado === 'gestionado');
  assert.equal(g.length, 1);
  assert.equal(g[0]._tipi, 'No contesta');
  assert.equal(g[0]._agente, id1);
  // Nombres de las asesoras (decisión del usuario, 23/11) y la configuración de tipificaciones.
  assert.ok(r.agentes.some((a) => a.id === id1 && /Asesora Inventada/.test(a.nombre)));
  assert.ok(Array.isArray(r.config.tipis) && Array.isArray(r.config.efectivas));
  assert.equal(r.cargas, undefined, 'sin histórico de cargas');
});

test('solo lectura: el cliente sigue sin poder escribir nada', async () => {
  assert.equal((await request(app).post(B + '/asignar').set(H(cli)).send({ agenteId: id1, cantidad: 1 })).status, 403);
  assert.equal((await request(app).post(B + '/devolver').set(H(cli)).send({ agenteId: id1, numeros: [SECRETO + '3'] })).status, 403);
  assert.equal((await request(app).put(B + '/config/tipis').set(H(cli)).send({ tipis: ['X'], efectivas: [] })).status, 403);
  assert.equal((await request(app).get(B + '/cargas').set(H(cli))).status, 403);
});

test('navegador: la app generada tiene la vista cliente (solo «Gráficas») y la pestaña del Dashboard la monta', () => {
  const appJs = fs.readFileSync(path.join(RAIZ, 'public/js/orlant-sta-app.js'), 'utf8');
  assert.match(appJs, /if\(VISTA==='cliente'\)\{ mostrar\('vSupervisor'\); tabSup\('graficas'\); \}/);
  assert.match(appJs, /classList\.toggle\('sta-cliente', VISTA==='cliente'\)/);
  assert.match(appJs, /activar: function\(\)\{ if \(typeof window !== 'undefined'\) window\.STAapp = STAapp; \}/);
  const css = fs.readFileSync(path.join(RAIZ, 'public/css/orlant-sta-app.css'), 'utf8');
  assert.match(css, /\.sta-app\.sta-cliente #vSupervisor > header\.top,\.sta-app\.sta-cliente #vSupervisor nav\.tabs\{display:none\}/);
  const mont = fs.readFileSync(path.join(RAIZ, 'public/js/orlant-sta.js'), 'utf8');
  assert.match(mont, /'\?vista=cliente'/);
  assert.match(mont, /async function staMontarCliente\(contenedor\)/);
  const dash = fs.readFileSync(path.join(RAIZ, 'public/js/orlant-sta-dashboard.js'), 'utf8');
  assert.match(dash, /await staMontarCliente\(cont\)/);
});
