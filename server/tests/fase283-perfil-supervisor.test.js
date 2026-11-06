// fase283-perfil-supervisor.test.js — Fase 283 (pedido de Edwin, 06/11): perfil propio
// del SUPERVISOR con "Clientes que supervisa" (supervisa_<C>): abre los tableros de
// sus clientes desde su portal, carga sus bases (todos los modulos, solo de sus
// clientes) y hace Calidad; no crea usuarios. Un supervisor sin supervisa_ sigue
// como antes. Cuentas y datos SINTETICOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { app, db, request, tokenFor, MASTER_PASSWORD } = require('./helpers'); // primero: prepara el entorno de prueba
const P = require('../../public/js/perfil-supervisor-logic.js');
const auth = require('../auth');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const CLAVE = 'ClavePrueba1234';
async function crear(perms, rol = 'SUPERVISOR') {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const user = 'sup_' + Math.random().toString(36).slice(2, 8);
  const r = await request(app).post('/api/users').set(H(admin)).send({ nombre: 'Supervisor Sintético', user, password: CLAVE, rol, perms });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { user, id: r.body.id, token: await tokenFor(user, CLAVE) };
}

test('regla: sin supervisa_ igual que antes; con supervisa_ solo esa lista (los cliente_/campana_ viejos se ignoran, no se borran)', () => {
  const viejo = { Calidad: true, cliente_ORLANT: true, campana_MOBILIZE: true, plantilla_9: true };
  assert.deepEqual(P.permisosEfectivos('SUPERVISOR', viejo), viejo, 'cuenta sin migrar: identica');
  const nuevo = { ...viejo, supervisa_ORLANT: false, supervisa_SURA: true, 'supervisa_CLINICA AURORA': true };
  const ef = P.permisosEfectivos('SUPERVISOR', nuevo);
  assert.equal(ef.cliente_ORLANT, undefined, 'el cliente_ viejo ya no da acceso');
  assert.equal(ef.campana_MOBILIZE, undefined);
  assert.deepEqual([ef.cliente_SURA, ef.campana_SURA, ef['cliente_CLINICA AURORA'], ef['campana_CLINICA AURORA']], [true, true, true, true]);
  assert.equal(ef.plantilla_9, true, 'las plantillas siguen');
  assert.equal(nuevo.cliente_ORLANT, true, 'lo guardado no se toca');
  assert.deepEqual(P.permisosEfectivos('CLIENTES_DASH', nuevo), nuevo, 'solo aplica al SUPERVISOR');
  // Al abrir la cuenta en Usuarios (la "migracion"): se marca lo que hoy le da acceso.
  assert.deepEqual(P.supervisorClientesIniciales('SUPERVISOR', viejo, ['ORLANT', 'MOBILIZE', 'SURA']), ['ORLANT', 'MOBILIZE']);
  assert.deepEqual(P.supervisorClientesIniciales('SUPERVISOR', nuevo, ['ORLANT', 'MOBILIZE', 'SURA']), ['SURA', 'CLINICA AURORA']);
});

test('supervisor SIN migrar: todo igual que antes (abre sus tableros, no carga)', async () => {
  const s = await crear({ Calidad: true, cliente_ORLANT: true, campana_ORLANT: true });
  assert.equal((await request(app).get('/api/dashboard/ORLANT').set(H(s.token))).status, 200);
  assert.equal((await request(app).get('/api/dashboard/MOBILIZE').set(H(s.token))).status, 403);
  assert.equal((await request(app).get('/api/centro-cargas/ORLANT').set(H(s.token))).status, 403, 'sin cargarDatos no cargaba, igual que antes');
});

test('supervisor en el perfil nuevo: abre y carga SOLO sus clientes; el cliente_ viejo ya no cuenta', async () => {
  const s = await crear({ Calidad: true, cliente_MOBILIZE: true, campana_MOBILIZE: true, supervisa_ORLANT: true, supervisa_MOBILIZE: false });
  assert.equal((await request(app).get('/api/dashboard/ORLANT').set(H(s.token))).status, 200);
  assert.equal((await request(app).get('/api/dashboard/MOBILIZE').set(H(s.token))).status, 403, 'MOBILIZE no lo supervisa (aunque tenga cliente_ viejo)');
  const cc = await request(app).get('/api/centro-cargas/ORLANT').set(H(s.token));
  assert.equal(cc.status, 200, JSON.stringify(cc.body));
  assert.ok(cc.body.modulos.length > 0, 'todos los modulos del cliente');
  assert.equal((await request(app).get('/api/centro-cargas/MOBILIZE').set(H(s.token))).status, 403);
  // Inicio de sesion: el navegador recibe los permisos efectivos.
  const login = await request(app).post('/api/auth/login').send({ user: s.user, password: CLAVE });
  assert.equal(login.body.user.perms.cliente_ORLANT, true);
  assert.equal(login.body.user.perms.cliente_MOBILIZE, undefined);
});

test('cargas genericas (dashboard_cargas): el supervisor ve y carga solo las de sus clientes; cargarDatos sigue global', async () => {
  const ins = db.prepare("INSERT OR REPLACE INTO dashboard_cargas (cliente, seccion, cadencia, periodo, filas, cargadoEn) VALUES (?, 'sec_sintetica', 'mensual', '2026-10', '[]', '2026-11-06')");
  ins.run('ORLANT'); ins.run('MOBILIZE');
  const s = await crear({ supervisa_ORLANT: true });
  const r = await request(app).get('/api/dashboard/cargas').set(H(s.token));
  assert.equal(r.status, 200);
  assert.ok(r.body.length >= 1 && r.body.every((x) => x.cliente === 'ORLANT'), JSON.stringify(r.body.map((x) => x.cliente)));
  const otro = db.prepare("SELECT id FROM dashboard_cargas WHERE cliente = 'MOBILIZE' AND seccion = 'sec_sintetica'").get();
  assert.equal((await request(app).delete('/api/dashboard/cargas/' + otro.id).set(H(s.token))).status, 403, 'no borra la de otro cliente');
  const sinNada = await crear({ Calidad: true }, 'CALIDAD');
  assert.equal((await request(app).get('/api/dashboard/cargas').set(H(sinNada.token))).status, 403, 'sin permiso, como antes');
});

test('Calidad: califica y ve resultados de sus clientes; no de los otros', async () => {
  const s = await crear({ Calidad: true, supervisa_MOBILIZE: true });
  const actor = { rol: 'SUPERVISOR', perms: P.permisosEfectivos('SUPERVISOR', { supervisa_MOBILIZE: true }) };
  assert.equal(auth.canEvaluateCampaign(actor, 'MOBILIZE'), true);
  assert.equal(auth.campaignAccess(actor, 'MOBILIZE'), true);
  assert.equal(auth.canEvaluateCampaign(actor, 'ORLANT'), false);
  assert.equal((await request(app).get('/api/monitoreos?campana=MOBILIZE').set(H(s.token))).status, 200);
  assert.equal((await request(app).get('/api/monitoreos?campana=ORLANT').set(H(s.token))).status, 403);
});

test('el supervisor no crea usuarios ni cambia contraseñas de otros', async () => {
  const s = await crear({ supervisa_ORLANT: true });
  const r = await request(app).post('/api/users').set(H(s.token)).send({ nombre: 'X', user: 'otro_' + Date.now(), password: CLAVE, rol: 'CLIENTES_DASH', perms: {} });
  assert.equal(r.status, 403);
  const victima = await crear({ supervisa_ORLANT: true });
  const p = await request(app).put('/api/users/' + victima.id + '/password').set(H(s.token)).send({ password: 'OtraClave12345' });
  assert.equal(p.status, 403, 'sin el permiso cambiarPassword (solo del administrador)');
});

test('navegador: formulario "Clientes que supervisa", portal con "Cargar bases" y "Vista de supervisor"', () => {
  const pub = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');
  const html = pub('index.html');
  assert.match(html, /id="mu-supervisa-perms"[\s\S]*?<h4>Clientes que supervisa<\/h4>/);
  assert.match(html, /id="supervisor-menu-cargas-li" class="hidden"><a id="supervisor-menu-cargas"[^>]*onclick="openCentroCargas\(\)"/);
  assert.match(html, /id="gd-vista-sup" class="navbar-role gd-vista-sup hidden">Vista de supervisor</);
  assert.ok(html.indexOf('js/perfil-supervisor-logic.js') < html.indexOf('js/state.js'));
  const users = pub('js/users.js');
  assert.match(users, /var show=\(rol==='CLIENTES_DASH'\);/, '"Acceso a clientes" solo para cuentas de cliente');
  assert.match(users, /aplicarSupervisa\(newPerms, rol\);/);
  assert.match(users, /Marca al menos un cliente que supervisa/);
});
