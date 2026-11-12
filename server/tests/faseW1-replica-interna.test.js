// faseW1-replica-interna.test.js — Fase W1 (docs/plan-api-wolkvox.md, sec. 1.1 y 1.2): replica
// OCULTA «MOBILIZE PRUEBAS API» para probar la API de Wolkvox, sin conexion a Wolkvox.
//  - La crea una migracion idempotente con el tablero de Mobilize, vacio, sin tocar MOBILIZE.
//  - Es INTERNA: la ve y la usa SOLO el administrador completo, aunque un usuario tenga el
//    permiso marcado (incluso metido directo en la base). Matriz sobre TODAS las rutas GET del
//    app (router.stack): una ruta nueva entra sola. Con una prueba de control que demuestra que la
//    matriz detecta la fuga si la marca `interno` se apaga.
//  - Crear o editar un usuario con acceso a la replica da 400.
// Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const dbMod = require('../db');
const { generarLayout, PERFILES_ACTUALES } = require('../plantillas-cliente');

const R = 'MOBILIZE PRUEBAS API';
const CENTINELA = 'CENTINELA-W1-NO-DEBE-SALIR';
const H = (t) => ({ Authorization: 'Bearer ' + t });
const PW = 'Clave#FaseW1xy';
let admin;
const actores = {};

const fila = (tabla, cliente) => db.prepare(`SELECT * FROM ${tabla} WHERE ${tabla === 'dashboards_config' ? 'cliente' : 'nombre'} = ?`).get(cliente);

async function crearCon(user, rol, perms, extra) {
  const r = await request(app).post('/api/users').set(H(admin)).send(Object.assign({ nombre: 'Persona Ficticia ' + user, user, password: PW, rol, perms }, extra || {}));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  // El permiso de la replica, metido DIRECTO en la base (como si alguien lo marcara por error).
  const row = db.prepare('SELECT perms FROM users WHERE id = ?').get(r.body.id);
  const p = Object.assign(JSON.parse(row.perms || '{}'), { ['cliente_' + R]: true, ['campana_' + R]: true, ['supervisa_' + R]: true });
  db.prepare('UPDATE users SET perms = ? WHERE id = ?').run(JSON.stringify(p), r.body.id);
  if (extra && extra.asesorCampana === 'MOBILIZE') db.prepare('UPDATE users SET asesorCampana = ? WHERE id = ?').run(R, r.body.id);
  return { id: r.body.id, token: await tokenFor(user, PW) };
}

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  const base = { Calidad: true, cargarDatos: true, Dashboards: true, ClientesDash: true };
  actores.ASESOR = await crearCon('asw1', 'ASESOR', {}, { asesorCampana: 'MOBILIZE' });
  actores.CALIDAD = await crearCon('calw1', 'CALIDAD', Object.assign({}, base, { campana_MOBILIZE: true }));
  actores.SUPERVISOR = await crearCon('supw1', 'SUPERVISOR', { supervisa_MOBILIZE: true });
  actores.SUPERVISOR_VIEJO = await crearCon('supvw1', 'SUPERVISOR', Object.assign({}, base, { cliente_MOBILIZE: true, campana_MOBILIZE: true }));
  actores.REPORTES = await crearCon('repw1', 'REPORTES', Object.assign({}, base, { campana_MOBILIZE: true }));
  actores.GERENCIA = await crearCon('gerw1', 'GERENCIA', Object.assign({}, base, { campana_MOBILIZE: true }));
  actores.CLIENTES_DASH = await crearCon('cliw1', 'CLIENTES_DASH', { ClientesDash: true, cliente_MOBILIZE: true });
  actores.AUX_ADMIN = await crearCon('auxw1', 'AUX_ADMIN', { gestionPermisos: true, crearUsuarios: true, editarUsuarios: true, cargarDatos: true });
  // Filas centinela en la replica (si una ruta las devuelve a alguien que no es admin, es una fuga).
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO encuestas (campana, fecha, agente, skill, q1, q2, q3, q4, comentario, connId, hora, archivoNombre, cargadoPorNombre, createdAt)
    VALUES (?, '2025-06-02', ?, ?, 1, 1, 2, 1, ?, ?, '09:00', 'w1.xlsx', '-', ?)`).run(R, CENTINELA, CENTINELA, CENTINELA, CENTINELA, now);
  db.prepare(`INSERT INTO monitoreos (campana, asesor, fecha, mes, canal, idLlamada, evaluador, answers, puntaje, clasificacion, fallos, nivelCritico, observaciones, createdAt)
    VALUES (?, ?, '2025-06-02', '2025-06', 'LLAMADA', ?, ?, '{}', 50, 'REGULAR', 0, 'NO', ?, ?)`).run(R, CENTINELA, CENTINELA, CENTINELA, CENTINELA, now);
});

test('migracion: crea la replica interna con el tablero de Mobilize, vacio; MOBILIZE intacto; idempotente', () => {
  const reg = fila('clientes_registro', R);
  assert.ok(reg, 'la replica esta en el registro');
  const par = JSON.parse(reg.parametros);
  assert.equal(par.interno, true);
  assert.deepEqual(JSON.parse(reg.modulos), ['flujo_llamadas', 'tipificacion', 'llamadas_unicas', 'flujo_hora', 'encuesta'], 'sin Calidad ni el resumen por asesor');
  const cfg = fila('dashboards_config', R);
  assert.ok(cfg);
  const layout = JSON.parse(cfg.layout);
  assert.ok(layout.tabs.length >= 4);
  assert.ok(!layout.tabs.some((t) => t.key === 'calidad'), 'sin pestaña Calidad');
  const txt = cfg.layout;
  assert.ok(!/"(campana|cliente)":"MOBILIZE"/.test(txt), 'ningun panel lee filas de MOBILIZE');
  // Mismo tablero que la plantilla de Mobilize con el nombre de la replica.
  const esperado = generarLayout(Object.assign({}, PERFILES_ACTUALES.MOBILIZE, { nombre: R, titulo: 'Mobilize pruebas API', modulos: JSON.parse(reg.modulos), visibles: PERFILES_ACTUALES.MOBILIZE.visibles.filter((m) => JSON.parse(reg.modulos).includes(m)) }));
  assert.deepEqual(layout, esperado.layout);
  // MOBILIZE real no cambia al correrla de nuevo (idempotente) y la replica no se duplica.
  const mobReg = JSON.stringify(fila('clientes_registro', 'MOBILIZE'));
  const mobCfg = JSON.stringify(fila('dashboards_config', 'MOBILIZE'));
  const repCfg = JSON.stringify(fila('dashboards_config', R));
  dbMod.crearReplicaMobilizeApi();
  assert.equal(JSON.stringify(fila('clientes_registro', 'MOBILIZE')), mobReg);
  assert.equal(JSON.stringify(fila('dashboards_config', 'MOBILIZE')), mobCfg);
  assert.equal(JSON.stringify(fila('dashboards_config', R)), repCfg);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM clientes_registro WHERE nombre = ?').get(R).n, 1);
  assert.equal(JSON.parse(fila('clientes_registro', 'MOBILIZE').parametros).interno, undefined, 'Mobilize real no es interno');
});

// ── Matriz: todas las rutas GET del app, con el nombre de la replica en params y query ──
function rutasGet() {
  const router = app.router || app._router;
  const out = [];
  (function walk(stack, pre) {
    stack.forEach((l) => {
      if (l.route && l.route.methods.get) out.push(l.route.path);
      else if (l.name === 'router' && l.handle.stack) walk(l.handle.stack, pre);
    });
  })(router.stack, '');
  return [...new Set(out)].filter((p) => typeof p === 'string' && p !== '/' && !p.includes('*') && p !== '/index.html');
}
const PARAM = { cliente: R, campana: R, mes: '2025-06', carga: 'encuesta', modulo: 'encuesta' };
function urlDe(p) {
  const path = p.replace(/:([A-Za-z]+)/g, (m, k) => encodeURIComponent(PARAM[k] || '1'));
  const q = new URLSearchParams({ campana: R, cliente: R, mes: '2025-06', meses: '2025-06', desde: '2025-06-01', hasta: '2025-06-30', estado: 'todas' });
  return '/api' + path + '?' + q.toString();
}
async function fugas(token, rutas) {
  const out = [];
  for (const p of rutas) {
    const r = await request(app).get(urlDe(p)).set(H(token));
    const txt = r.text || '';
    if (txt.includes(CENTINELA)) out.push(p + ' (' + r.status + ')');
  }
  return out;
}

test('matriz: ningun rol que no sea administrador ve datos de la replica en ninguna ruta GET, aunque tenga el permiso', async () => {
  const rutas = rutasGet();
  assert.ok(rutas.length > 50, 'inventario de rutas del app: ' + rutas.length);
  for (const [rol, a] of Object.entries(actores)) {
    assert.deepEqual(await fugas(a.token, rutas), [], 'fuga para ' + rol);
  }
});

test('control: la matriz SI detecta la fuga si se apaga la marca interno (la prueba tiene dientes)', async () => {
  const reg = fila('clientes_registro', R);
  const par = JSON.parse(reg.parametros);
  db.prepare('UPDATE clientes_registro SET parametros = ? WHERE nombre = ?').run(JSON.stringify(Object.assign({}, par, { interno: false })), R);
  try {
    const f = await fugas(actores.CALIDAD.token, rutasGet());
    assert.ok(f.length > 0, 'sin la marca, el permiso marcado da acceso (y la matriz lo ve)');
  } finally {
    db.prepare('UPDATE clientes_registro SET parametros = ? WHERE nombre = ?').run(reg.parametros, R);
  }
  assert.equal(JSON.parse(fila('clientes_registro', R).parametros).interno, true);
});

test('listas y enlace directo: solo el administrador la ve; quien gestiona usuarios tampoco', async () => {
  for (const [rol, a] of Object.entries(actores)) {
    const l = await request(app).get('/api/dashboard/clientes').set(H(a.token));
    assert.equal(l.status, 200, rol);
    assert.ok(!JSON.stringify(l.body).includes(R), 'la lista de ' + rol + ' no la trae');
    const d = await request(app).get('/api/dashboard/' + encodeURIComponent(R)).set(H(a.token));
    assert.ok([403, 404].includes(d.status), rol + ' enlace directo: ' + d.status);
  }
  const la = (await request(app).get('/api/dashboard/clientes').set(H(admin))).body;
  assert.ok(la.clientes.includes(R) && la.listaClientes.includes(R) && la.registro.some((c) => c.nombre === R && c.parametros.interno === true));
  assert.ok(!la.campanasCalidad.includes(R), 'sin Calidad');
  assert.equal((await request(app).get('/api/dashboard/' + encodeURIComponent(R)).set(H(admin))).status, 200, 'el administrador la abre');
  // Mobilize real sigue igual para su cliente.
  const mob = await request(app).get('/api/dashboard/MOBILIZE').set(H(actores.CLIENTES_DASH.token));
  assert.equal(mob.status, 200);
});

test('usuarios: crear o editar con acceso a la replica da 400, tambien desde el administrador', async () => {
  for (const perms of [{ ['cliente_' + R]: true }, { ['campana_' + R]: true }, { ['supervisa_' + R]: true }]) {
    const r = await request(app).post('/api/users').set(H(admin)).send({ nombre: 'Persona Ficticia W1', user: 'w1x' + Object.keys(perms)[0].length, password: PW, rol: 'SUPERVISOR', perms });
    assert.equal(r.status, 400, JSON.stringify(r.body));
    assert.match(r.body.error, /interna/);
  }
  const as = await request(app).post('/api/users').set(H(admin)).send({ nombre: 'Persona Ficticia W1 A', user: 'w1asesor', password: PW, rol: 'ASESOR', perms: {}, asesorCampana: R });
  assert.ok([400].includes(as.status), JSON.stringify(as.body));
  const ok = await request(app).post('/api/users').set(H(admin)).send({ nombre: 'Persona Ficticia W1 B', user: 'w1ok', password: PW, rol: 'CALIDAD', perms: { Calidad: true, campana_MOBILIZE: true } });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  const pp = await request(app).put('/api/users/' + ok.body.id + '/perms').set(H(admin)).send({ perms: { Calidad: true, campana_MOBILIZE: true, ['campana_' + R]: true } });
  assert.equal(pp.status, 400, JSON.stringify(pp.body));
  const ed = await request(app).put('/api/users/' + ok.body.id).set(H(admin)).send({ nombre: 'Persona Ficticia W1 B', user: 'w1ok', rol: 'CALIDAD', perms: { Calidad: true, ['cliente_' + R]: true } });
  assert.equal(ed.status, 400, JSON.stringify(ed.body));
  // Un usuario que ya la tenia (metida a mano) se puede seguir editando sin ella.
  const sigue = await request(app).put('/api/users/' + actores.REPORTES.id + '/perms').set(H(admin)).send({ perms: { Calidad: true, campana_MOBILIZE: true } });
  assert.equal(sigue.status, 200, JSON.stringify(sigue.body));
});

test('pantallas: Usuarios y la matriz de roles no muestran la casilla de la replica', () => {
  const RC = require('../../public/js/registro-clientes.js');
  const reg = [{ nombre: 'MOBILIZE', parametros: {} }, { nombre: R, parametros: { interno: true } }];
  assert.deepEqual(RC.clientesAsignables(['ORLANT', 'MOBILIZE', R], reg), ['ORLANT', 'MOBILIZE']);
  const fs = require('fs');
  const path = require('path');
  const js = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');
  assert.match(js('users.js'), /mu-supervisa-grid'\)\.innerHTML=clientesAsignables\(CLIENTES_LIST\)/);
  assert.match(js('users.js'), /grid\.innerHTML=clientesAsignables\(CLIENTES_LIST\)\.map/);
  assert.equal((js('roles-perms.js').match(/clientesAsignables\(CLIENTES_LIST\)/g) || []).length, 3);
});
