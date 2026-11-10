// fase315-li-privacidad-cliente.test.js — Fase 315 (revision del 10/11/2026): Gestión
// líneas internas de Aurora. Datos SINTETICOS (agentes y cifras inventados).
//  - La cuenta cliente (Aurora oculta asesores, Fase 287) recibe las tortas SIN agente,
//    con los mismos conteos; los roles internos reciben todo.
//  - SUPERVISOR solo carga en sus campañas; ASESOR y CLIENTE, 403.
//  - Un HistCDR en la casilla de WhatsApp (o al reves) se rechaza.
//  - Al abrir/actualizar el tablero se vacian las caches de Aurora (datos frescos).
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const L = require('../../public/js/lineas-internas-logic.js');

const AURORA = 'CLINICA AURORA';
const H = (t) => ({ Authorization: 'Bearer ' + t });
let admin, cliente, asesor, supAurora, supOtra;
function crear(user, rol, perms) {
  db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
    .run('Prueba ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), new Date().toISOString());
  return tokenFor(user, 'Clave#2026x');
}
const FILAS = [
  { mes: '2026-10', agente: 'Agente Ficticio Uno', skill: '0', tipo: 'entrada', tipificacion: 'CONFIRMA_FICTICIA', n: 5 },
  { mes: '2026-10', agente: 'Agente Ficticio Dos', skill: '0', tipo: 'entrada', tipificacion: 'CONFIRMA_FICTICIA', n: 3 },
  { mes: '2026-10', agente: 'Agente Ficticio Dos', skill: '4166', tipo: 'entrada', tipificacion: 'OTRA_FICTICIA', n: 2 },
];
before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  cliente = await crear('f315_cliente', 'CLIENTES_DASH', { ClientesDash: true, ['cliente_' + AURORA]: true });
  asesor = await crear('f315_asesor', 'ASESOR', { ['campana_' + AURORA]: true });
  supAurora = await crear('f315_sup_aurora', 'SUPERVISOR', { ClientesDash: true, ['supervisa_' + AURORA]: true });
  supOtra = await crear('f315_sup_otra', 'SUPERVISOR', { ClientesDash: true, supervisa_MOBILIZE: true });
  for (const ruta of ['aurora-li-whatsapp', 'aurora-li-cdr']) {
    const r = await request(app).post('/api/calidad/' + ruta + '/carga').set(H(admin)).send({ campana: AURORA, filas: FILAS });
    assert.equal(r.status, 201, JSON.stringify(r.body));
  }
});

test('cuenta cliente de Aurora: tortas sin agente (sin nombres) y mismos conteos; interno: todo', async () => {
  for (const ruta of ['aurora-li-whatsapp', 'aurora-li-cdr']) {
    const url = '/api/calidad/' + ruta + '/datos?campana=' + encodeURIComponent(AURORA);
    const c = await request(app).get(url).set(H(cliente));
    assert.equal(c.status, 200);
    assert.ok(!JSON.stringify(c.body).includes('Ficticio'), ruta + ': ningun nombre de agente');
    c.body.filas.forEach((f) => assert.equal(f.agente, ''));
    assert.deepEqual(L.liTorta(c.body.filas, [], {}).todas, [{ tipificacion: 'CONFIRMA_FICTICIA', cantidad: 8 }, { tipificacion: 'OTRA_FICTICIA', cantidad: 2 }], 'mismos conteos');
    assert.equal(L.liTorta(c.body.filas, [], { skill: '0' }).total, 8);
    const a = await request(app).get(url).set(H(admin));
    assert.equal(a.body.filas.filter((f) => f.agente).length, 3, 'el administrador ve los agentes');
    const s = await request(app).get(url).set(H(supAurora));
    assert.equal(s.body.filas.filter((f) => f.agente).length, 3, 'el supervisor ve los agentes');
  }
  // El flujo no tiene agentes: igual para todos.
  assert.equal((await request(app).get('/api/calidad/aurora-li-flujo/datos?campana=' + encodeURIComponent(AURORA)).set(H(cliente))).status, 200);
});

test('permisos de carga: SUPERVISOR solo en sus campañas; ASESOR y CLIENTE 403', async () => {
  const cuerpo = { campana: AURORA, filas: FILAS };
  assert.equal((await request(app).post('/api/calidad/aurora-li-cdr/carga/impacto').set(H(supAurora)).send(cuerpo)).status, 200, 'supervisor de Aurora');
  assert.equal((await request(app).post('/api/calidad/aurora-li-cdr/carga').set(H(supOtra)).send(cuerpo)).status, 403, 'supervisor de otra campaña');
  for (const t of [asesor, cliente]) assert.equal((await request(app).post('/api/calidad/aurora-li-whatsapp/carga').set(H(t)).send(cuerpo)).status, 403);
  assert.equal((await request(app).get('/api/calidad/aurora-li-cdr/datos?campana=' + encodeURIComponent(AURORA)).set(H(supOtra))).status, 403);
});

test('base equivocada: el HistCDR en la casilla de WhatsApp (y al reves) se rechaza', () => {
  const aoa = (enc) => [{ nombre: 'h', aoa: [enc, enc.map(() => 'x')] }];
  const cdr = ['AGENT_NAME', 'DATE', 'TELEPHONE', 'DESCRIPTION_COD_ACT', 'TYPE_INTERACTION', 'SKILL_ID', 'SKILL_NAME'];
  const chat = ['CONN_ID', 'CHANNEL', 'DATE', 'DATE_CLOSE', 'AGENT_NAME', 'DESCRIPTION_COD_ACT', 'SKILL_ID'];
  assert.match(L.liWhatsappParse(aoa(cdr), 'cdr.xlsx').error, /CDR líneas internas/);
  assert.match(L.liCdrParse(aoa(chat), 'chat.xlsx').error, /WhatsApp líneas internas/);
  assert.ok(L.liFlujoParse(aoa(cdr), 'cdr.xlsx').error, 'el CDR tampoco pasa como flujo');
  assert.ok(L.liWhatsappParse([{ nombre: 'vacia', aoa: [] }], 'vacio.xlsx').error, 'archivo vacio');
});

test('al abrir/actualizar el tablero se vacian las caches de Aurora; el cliente sin agentes no ve el filtro de agente', () => {
  const g = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'dashboard-generic.js'), 'utf8');
  const boot = g.slice(g.indexOf('async function _gdBootstrap('), g.indexOf('async function _gdBootstrap(') + 900);
  for (const c of ['_auCache = {}', '_abCache = {}', '_liCache = {}', '_liEstado = {}']) assert.ok(boot.includes(c), c);
  const li = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'lineas-internas.js'), 'utf8');
  assert.match(li, /datos\.filas\.some\(function \(f\) \{ return f\.agente; \}\) \? _liSelect\('agente'/);
});
