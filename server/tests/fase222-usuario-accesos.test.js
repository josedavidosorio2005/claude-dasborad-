// fase222-usuario-accesos.test.js — Fase 222 (revision del 3-nov, H1):
//  - quien no es admin completo solo da acceso a clientes o campanas que el
//    mismo tiene (POST /users, PUT /users/:id, PUT /users/:id/perms);
//  - el formulario de usuario nuevo (buildPerms y las casillas) ya no marca
//    todos los clientes ni todas las campanas por defecto.
// Cada bloqueo va con su contraparte de "sigue pudiendo".
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const PW = 'Clave#Fase222x';
const ERROR = 'Solo puedes dar acceso a clientes o campañas a los que tú tienes acceso';
let admin;
let aux;
const ids = {};

async function crearComo(token, user, rol, perms) {
  return request(app).post('/api/users').set(auth(token)).send({ nombre: 'Persona ' + user, user, password: PW, rol, perms });
}

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  const r = await crearComo(admin, 'f222aux', 'AUX_ADMIN', { crearUsuarios: true, editarUsuarios: true, gestionPermisos: true, cliente_ORLANT: true, campana_ORLANT: true });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  aux = await tokenFor('f222aux', PW);
  const m = await crearComo(admin, 'f222mob', 'CLIENTES_DASH', { ClientesDash: true, cliente_MOBILIZE: true });
  assert.equal(m.status, 201);
  ids.f222mob = m.body.id;
});

test('un Auxiliar Admin con solo cliente_ORLANT no puede crear un usuario con cliente_MOBILIZE', async () => {
  const r = await crearComo(aux, 'f222x1', 'CLIENTES_DASH', { ClientesDash: true, cliente_MOBILIZE: true });
  assert.equal(r.status, 403);
  assert.equal(r.body.error, ERROR);
  const c = await crearComo(aux, 'f222x2', 'CALIDAD', { Calidad: true, campana_MOBILIZE: true });
  assert.equal(c.status, 403);
});

test('el mismo Auxiliar Admin si crea un usuario con solo cliente_ORLANT', async () => {
  const r = await crearComo(aux, 'f222ok', 'CLIENTES_DASH', { ClientesDash: true, cliente_ORLANT: true, cliente_MOBILIZE: false });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  ids.f222ok = r.body.id;
});

test('un admin completo puede dar cualquier cliente', async () => {
  const r = await crearComo(admin, 'f222adm', 'CLIENTES_DASH', { ClientesDash: true, cliente_ORLANT: true, cliente_MOBILIZE: true, cliente_SURA: true });
  assert.equal(r.status, 201);
});

test('editar un usuario que ya tenia cliente_MOBILIZE sin tocarlo no falla', async () => {
  const r = await request(app).put(`/api/users/${ids.f222mob}`).set(auth(aux)).send({ nombre: 'Persona editada', perms: { ClientesDash: true, cliente_MOBILIZE: true } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  // ...y quitarle el acceso tambien se puede
  const q = await request(app).put(`/api/users/${ids.f222mob}/perms`).set(auth(aux)).send({ perms: { ClientesDash: true, cliente_MOBILIZE: false } });
  assert.equal(q.status, 200);
});

test('editar para dar un cliente que el actor no tiene: 403 (PUT /users/:id y PUT /users/:id/perms)', async () => {
  const r1 = await request(app).put(`/api/users/${ids.f222ok}`).set(auth(aux)).send({ perms: { ClientesDash: true, cliente_ORLANT: true, cliente_SURA: true } });
  assert.equal(r1.status, 403);
  assert.equal(r1.body.error, ERROR);
  const r2 = await request(app).put(`/api/users/${ids.f222ok}/perms`).set(auth(aux)).send({ perms: { ClientesDash: true, cliente_ORLANT: true, cliente_SURA: true } });
  assert.equal(r2.status, 403);
});

// ── Navegador: buildPerms y casillas sin marcar ──
function sandboxNavegador() {
  const sb = {
    DASH_MODULES: [{ key: 'Calidad' }, { key: 'ClientesDash' }],
    ROLE_DEFAULT: { CALIDAD: 'Calidad', CLIENTES_DASH: 'ClientesDash', REPORTES: 'Calidad' },
    CLIENTES_LIST: ['ORLANT', 'MOBILIZE', 'SURA'],
    CAMPANAS_CALIDAD: ['ORLANT', 'MOBILIZE'],
    ADMIN_ACTIONS: [],
    REGULAR_ROLES: [],
  };
  sb.window = sb;
  sb.addEventListener = () => {};
  vm.createContext(sb);
  const js = path.join(__dirname, '..', '..', 'public', 'js');
  vm.runInContext(fs.readFileSync(path.join(js, 'state.js'), 'utf8'), sb);
  return sb;
}

test('buildPerms sin casillas deja todos los cliente_ y campana_ en false', () => {
  const sb = sandboxNavegador();
  for (const rol of ['CLIENTES_DASH', 'SUPERVISOR', 'CALIDAD', 'REPORTES', 'GERENCIA']) {
    const p = sb.buildPerms(rol, null, null);
    const accesos = Object.keys(p).filter((k) => /^(cliente|campana)_/.test(k));
    assert.ok(accesos.length > 0, rol);
    for (const k of accesos) assert.equal(p[k], false, rol + ' ' + k);
  }
  // Con casillas, respeta lo marcado
  const p = sb.buildPerms('CLIENTES_DASH', { SURA: true }, null);
  assert.equal(p.cliente_SURA, true);
  assert.equal(p.cliente_ORLANT, false);
});

test('el formulario arma las casillas sin marcar para un usuario nuevo y respeta las de uno existente', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'users.js'), 'utf8');
  for (const fn of ['buildClientCheckboxes', 'buildCampaignCheckboxes']) {
    const cuerpo = src.slice(src.indexOf('function ' + fn), src.indexOf('function ' + fn) + 400);
    assert.match(cuerpo, /existingPerms\?existingPerms\['(cliente|campana)_'\+c\]===true:false/, fn);
  }
  assert.match(src, /Marca al menos un cliente/);
  assert.match(src, /Marca al menos una campaña/);
});
