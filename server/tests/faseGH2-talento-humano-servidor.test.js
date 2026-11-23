// faseGH2-talento-humano-servidor.test.js — Fase GH2 (docs/gestion-humana/plan.md): «Talento humano»
// guarda en el servidor (/api/gh/estado), un documento por clave con versión, bitácora sin contenido,
// administrador siempre y GESTION_HUMANA solo con GH_ROL_ACTIVO=1. Datos SINTÉTICOS.
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const G = require('../gh-estado');
const { ghCrearAlmacen, GH_CLAVES } = require('../../public/gestion-humana/talento-humano-api.js');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const K = 'inconexion_gh_empleados_v1';
const tk = {};
function crear(user, rol) {
  db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
    .run('Persona ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), '{}', new Date().toISOString());
  return tokenFor(user, 'Clave#2026x');
}
before(async () => {
  delete process.env.GH_ROL_ACTIVO;
  tk.admin = await tokenFor('admin', MASTER_PASSWORD);
  tk.gh = await crear('gh2_gh', 'GESTION_HUMANA');
  tk.sis = await crear('gh2_sis', 'SISTEMAS');
  tk.ger = await crear('gh2_ger', 'GERENCIA');
  tk.aux = await crear('gh2_aux', 'AUX_ADMIN');
});
after(() => { delete process.env.GH_ROL_ACTIVO; });

const put = (t, clave, body) => request(app).put('/api/gh/estado/' + clave).set(H(t)).send(body);
const ficticio = (n) => JSON.stringify(Array.from({ length: n }, (_, i) => ({ id: 'e' + i, nombre: 'Persona Ficticia ' + i })));

test('claves: la lista cerrada es la misma en el servidor y en el navegador', () => {
  assert.deepEqual([...G.CLAVES], GH_CLAVES);
  assert.deepEqual(GH_CLAVES, [K, K + '_vac', K + '_nov', K + '_aus', K + '_auscfg', K + '_cfg']);
  assert.ok(require('../secrets').SSM_KEYS.includes('GH_ROL_ACTIVO'));
});

test('permisos: sin GH_ROL_ACTIVO solo el administrador; con «1» también GESTION_HUMANA; nadie más', async () => {
  delete process.env.GH_ROL_ACTIVO;
  assert.equal((await request(app).get('/api/gh/estado').set(H(tk.admin))).status, 200);
  assert.equal((await request(app).get('/api/gh/estado').set(H(tk.gh))).status, 403);
  assert.deepEqual((await request(app).get('/api/gh/acceso').set(H(tk.gh))).body, { puede: false });
  assert.deepEqual((await request(app).get('/api/gh/acceso').set(H(tk.admin))).body, { puede: true });
  assert.equal((await put(tk.gh, K + '_cfg', { valor: '{}', version: 0 })).status, 403);
  process.env.GH_ROL_ACTIVO = 'si'; // solo «1» lo enciende
  assert.equal((await request(app).get('/api/gh/estado').set(H(tk.gh))).status, 403);
  process.env.GH_ROL_ACTIVO = '1';
  assert.equal((await request(app).get('/api/gh/estado').set(H(tk.gh))).status, 200);
  assert.deepEqual((await request(app).get('/api/gh/acceso').set(H(tk.gh))).body, { puede: true });
  for (const t of [tk.sis, tk.ger, tk.aux]) {
    assert.equal((await request(app).get('/api/gh/estado').set(H(t))).status, 403);
    assert.equal((await put(t, K, { valor: '[]', version: 0 })).status, 403);
    assert.deepEqual((await request(app).get('/api/gh/acceso').set(H(t))).body, { puede: false });
  }
  assert.equal((await request(app).get('/api/gh/estado')).status, 401);
  delete process.env.GH_ROL_ACTIVO;
  assert.equal((await request(app).get('/api/gh/estado').set(H(tk.gh))).status, 403, 'apagado otra vez: sin acceso, sin redesplegar');
});

test('guardar: versión que sube, conflicto 409 sin pisar, sin caché', async () => {
  let r = await put(tk.admin, K, { valor: ficticio(3), version: 0 });
  assert.deepEqual([r.status, r.body], [200, { version: 1 }]);
  r = await put(tk.admin, K, { valor: ficticio(4), version: 1 });
  assert.deepEqual([r.status, r.body], [200, { version: 2 }]);
  r = await put(tk.admin, K, { valor: ficticio(9), version: 1 }); // pestaña vieja
  assert.equal(r.status, 409);
  assert.equal(r.body.version, 2);
  const g = await request(app).get('/api/gh/estado').set(H(tk.admin));
  assert.equal(g.headers['cache-control'], 'no-store');
  assert.equal(JSON.parse(g.body.claves[K].valor).length, 4, 'el 409 no pisó nada');
  assert.equal(g.body.claves[K].version, 2);
});

test('guardar: valida clave, versión, JSON y tamaño', async () => {
  assert.equal((await put(tk.admin, 'inventario_activos_inconexion_v1', { valor: '[]', version: 0 })).status, 400, 'el inventario no entra aquí');
  assert.equal((await put(tk.admin, K + '_init', { valor: '"1"', version: 0 })).status, 400, 'las marcas se quedan en el navegador');
  assert.equal((await put(tk.admin, K + '_vac', { valor: '[]' })).status, 400);
  assert.equal((await put(tk.admin, K + '_vac', { valor: '[]', version: -1 })).status, 400);
  assert.equal((await put(tk.admin, K + '_vac', { valor: [], version: 0 })).status, 400);
  assert.equal((await put(tk.admin, K + '_vac', { valor: '{no es json', version: 0 })).status, 400);
  assert.equal((await put(tk.admin, K + '_vac', { valor: '"texto"', version: 0 })).status, 400);
  const grande = '[' + '"' + 'x'.repeat(G.MAX_BYTES) + '"]';
  assert.equal((await put(tk.admin, K + '_vac', { valor: grande, version: 0 })).status, 413);
  assert.equal((await put(tk.admin, K + '_vac', { valor: '[]', version: 0 })).status, 200);
});

test('bitácora: quién, cuándo, tamaño y cantidad — nunca el contenido; solo el administrador la lee', async () => {
  const cols = db.prepare('PRAGMA table_info(gh_bitacora)').all().map((c) => c.name);
  assert.deepEqual(cols, ['id', 'clave', 'version', 'usuario', 'fecha', 'bytes', 'elementos']);
  const b = (await request(app).get('/api/gh/bitacora').set(H(tk.admin))).body;
  const fila = b.find((x) => x.clave === K && x.version === 2);
  assert.equal(fila.elementos, 4);
  assert.ok(fila.bytes > 0 && fila.usuario);
  assert.ok(!JSON.stringify(b).includes('Persona Ficticia'), 'sin contenido');
  process.env.GH_ROL_ACTIVO = '1';
  assert.equal((await request(app).get('/api/gh/bitacora').set(H(tk.gh))).status, 403);
  delete process.env.GH_ROL_ACTIVO;
});

// ── Almacén del navegador (GH_STORE), con una API falsa ──
function apiFalsa() {
  const llamadas = [];
  const servidor = { version: {} };
  let modo = 'ok';
  const api = (m, p, b) => {
    llamadas.push([m, p, b && b.version, b && b.valor]);
    const k = decodeURIComponent(p.split('/').pop());
    if (modo === 'red') return Promise.reject(Object.assign(new Error('sin red'), { status: 0 }));
    const v = servidor.version[k] || 0;
    if (modo === '409' || b.version !== v) return Promise.reject(Object.assign(new Error('conflicto'), { status: 409 }));
    servidor.version[k] = v + 1;
    return Promise.resolve({ version: v + 1 });
  };
  return { api, llamadas, servidor, set modo(x) { modo = x; } };
}
function localFalso() { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, m }; }

test('GH_STORE: lee lo del servidor; las marcas van al navegador; junta cambios y no gasta versión sin cambios', async () => {
  const f = apiFalsa(); const local = localFalso(); const avisos = [];
  f.servidor.version[K] = 5;
  const s = ghCrearAlmacen({ api: f.api, local, esperaMs: 5, alAviso: (t) => avisos.push(t) });
  s.cargar({ [K]: { valor: '[1]', version: 5 }, otra: { valor: 'x', version: 1 } });
  assert.equal(s.getItem(K), '[1]');
  assert.equal(s.getItem('otra'), null, 'claves fuera de la lista no se cargan');
  assert.equal(s.getItem(K + '_vac'), null);
  s.setItem(K + '_init', '1');
  assert.deepEqual(local.m, { [K + '_init']: '1' });
  assert.equal(s.getItem(K + '_init'), '1');
  s.setItem(K, '[1]'); // igual a lo que hay: no se manda
  s.setItem(K, '[1,2]'); s.setItem(K, '[1,2,3]'); // dos cambios seguidos: un solo PUT con el último
  await s.vaciar();
  assert.deepEqual(f.llamadas, [['PUT', '/gh/estado/' + K, 5, '[1,2,3]']]);
  assert.equal(s._version(K), 6);
  assert.equal(s.hayPendientes(), false);
  assert.equal(local.m[K], undefined, 'los datos nunca van al navegador');
});

test('GH_STORE: con 409 deja de guardar esa sección y avisa; con error de red avisa y reintenta solo con el próximo cambio', async () => {
  const f = apiFalsa(); const avisos = [];
  const s = ghCrearAlmacen({ api: f.api, local: localFalso(), esperaMs: 5, alAviso: (t, txt) => avisos.push([t, txt]) });
  s.cargar({});
  f.modo = 'red';
  s.setItem(K + '_nov', '[1]');
  await s.vaciar();
  assert.equal(avisos.at(-1)[0], 'error');
  assert.equal(s.hayPendientes(), true, 'queda pendiente');
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(f.llamadas.length, 1, 'sin reintentos en bucle');
  f.modo = 'ok';
  s.setItem(K + '_nov', '[1,2]');
  await s.vaciar();
  assert.equal(f.llamadas.length, 2);
  assert.equal(f.llamadas[1][3], '[1,2]');
  assert.equal(avisos.at(-1)[0], 'guardado');
  f.servidor.version[K + '_cfg'] = 7; // otra persona ya guardó
  s.setItem(K + '_cfg', '{"a":1}');
  await s.vaciar();
  assert.equal(avisos.at(-1)[0], 'conflicto');
  assert.equal(s._bloqueada(K + '_cfg'), true);
  const antes = f.llamadas.length;
  s.setItem(K + '_cfg', '{"a":2}');
  await s.vaciar();
  assert.equal(f.llamadas.length, antes, 'bloqueada: no vuelve a mandar ni pisa');
  assert.equal(avisos.at(-1)[0], 'conflicto');
});

test('generado: la app usa GH_STORE (ningún localStorage) y la página carga el adaptador', () => {
  const PUB = path.join(__dirname, '..', '..', 'public', 'gestion-humana');
  const app = fs.readFileSync(path.join(PUB, 'talento-humano-app.js'), 'utf8');
  assert.doesNotMatch(app, /localStorage/);
  assert.equal(app.split('GH_STORE.getItem(').length - 1, 11);
  assert.equal(app.split('GH_STORE.setItem(').length - 1, 11);
  const pag = fs.readFileSync(path.join(PUB, 'talento-humano.html'), 'utf8');
  assert.ok(pag.indexOf('xlsx-0.20.3.full.min.js') < pag.indexOf('talento-humano-api.js'));
  assert.ok(!pag.includes('talento-humano-app.js"'), 'la app la carga el adaptador después de leer el servidor');
  assert.ok(pag.includes('Los datos se guardan en la plataforma (SinCo).'));
  const api = fs.readFileSync(path.join(PUB, 'talento-humano-api.js'), 'utf8');
  assert.ok(api.includes("s.src = 'talento-humano-app.js' + (location.search || '');"));
  assert.doesNotMatch(api, /#[0-9a-f]{3,6}\b/i, 'colores con los tokens de la app de Edwin');
  const L = require('../../public/js/talento-humano.js');
  assert.equal(L.talentoHumanoRolPide('GESTION_HUMANA', false), true);
  assert.equal(L.talentoHumanoRolPide('GESTION_HUMANA', true), false, 'el admin ya la tiene');
  assert.equal(L.talentoHumanoRolPide('SISTEMAS', false), false);
  const core = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'dashboards-core.js'), 'utf8');
  assert.ok(core.includes("talentoHumanoTarjetaRol(rolActual, isFullAdmin(), grid, tarjetaEntrada);"));
});
