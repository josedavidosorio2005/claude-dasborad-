// faseW2-wolkvox.test.js — Fase W2 (docs/plan-api-wolkvox.md): cliente de Wolkvox y «Probar
// conexión», solo administrador y solo la replica oculta. Todo con un Wolkvox FALSO (fetch
// inyectado) y datos INVENTADOS: ningun token, servidor, nombre ni telefono real.
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const wv = require('../wolkvox');
const rutaWv = require('../routes/wolkvox');

const R = 'MOBILIZE PRUEBAS API';
const TOKEN = 'TOKEN-FALSO-W2-no-es-real-1234567890';
const SERVIDOR = 'servidorfalso01';
const CENTINELA_NOMBRE = 'Persona Inventada W2';
const CENTINELA_TEL = '3000000099';
const H = (t) => ({ Authorization: 'Bearer ' + t });
const PW = 'Clave#FaseW2xy';
let admin;
const actores = {};

// Wolkvox falso: guarda la ultima peticion y responde lo que se le pida.
const falso = { ultima: null, llamadas: 0, responder: null };
function fetchFalso(url, opts) {
  falso.llamadas++;
  falso.ultima = { url, opts };
  return falso.responder ? falso.responder(url, opts) : respuestaOk();
}
function respuestaOk() {
  const data = [
    { agent_name: CENTINELA_NOMBRE, date: '2025-06-02 08:10:00', telephone: CENTINELA_TEL, destiny: CENTINELA_TEL, cost: '0', time_seg: '61', cod_act: '7', description_cod_act: 'Inventada' },
    { agent_name: CENTINELA_NOMBRE, date: '2025-06-02 08:20:00', telephone: CENTINELA_TEL, time_min: '1', 'campo raro<script>': 'x' },
  ];
  return Promise.resolve({ status: 200, json: () => Promise.resolve({ code: 200, error: false, msg: '2 records were found', data }) });
}

async function crear(user, rol, perms) {
  const r = await request(app).post('/api/users').set(H(admin)).send({ nombre: 'Persona Ficticia ' + user, user, password: PW, rol, perms });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  // Permiso de la replica metido DIRECTO en la base (como si alguien lo marcara por error).
  const row = db.prepare('SELECT perms FROM users WHERE id = ?').get(r.body.id);
  const p = Object.assign(JSON.parse(row.perms || '{}'), { ['cliente_' + R]: true, ['campana_' + R]: true, ['supervisa_' + R]: true });
  db.prepare('UPDATE users SET perms = ? WHERE id = ?').run(JSON.stringify(p), r.body.id);
  return tokenFor(user, PW);
}

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  actores.SUPERVISOR = await crear('supw2', 'SUPERVISOR', { supervisa_MOBILIZE: true });
  actores.CALIDAD = await crear('calw2', 'CALIDAD', { Calidad: true, campana_MOBILIZE: true });
  actores.CLIENTES_DASH = await crear('cliw2', 'CLIENTES_DASH', { ClientesDash: true, cliente_MOBILIZE: true });
  actores.AUX_ADMIN = await crear('auxw2', 'AUX_ADMIN', { gestionPermisos: true, crearUsuarios: true, editarUsuarios: true, cargarDatos: true });
  app.locals.wolkvoxFetch = fetchFalso;
});
after(() => {
  delete app.locals.wolkvoxFetch;
  delete process.env.WOLKVOX_MOBILIZE_TOKEN;
  delete process.env.WOLKVOX_MOBILIZE_SERVIDOR;
});

// ── Fechas ──
test('fechas: AAAAMMDDHHMMSS reales, en orden y dentro del mismo mes', () => {
  assert.equal(wv.errorRango('20250601000000', '20250630235959'), null);
  assert.equal(wv.errorRango('20250602080000', '20250602085959'), null);
  assert.match(wv.errorRango('20250630000000', '20250701000000'), /mismo mes/);
  assert.match(wv.errorRango('20241231000000', '20250101000000'), /mismo mes/);
  assert.match(wv.errorRango('20250602090000', '20250602080000'), /posterior/);
  assert.match(wv.errorRango('20250230000000', '20250230010000'), /AAAAMMDDHHMMSS/, '30 de febrero no existe');
  assert.match(wv.errorRango('2025-06-02', '20250602010000'), /AAAAMMDDHHMMSS/);
  assert.match(wv.errorRango('20250602240000', '20250602240000'), /AAAAMMDDHHMMSS/, 'hora 24 no');
  assert.equal(wv.fechaWolkvox('2025-06-02', '08:59:59'), '20250602085959');
});

// ── Credenciales ──
test('credenciales: solo de las variables WOLKVOX_<OP>_*, servidor como nombre corto (nunca una URL)', () => {
  const env = { NODE_ENV: 'test', WOLKVOX_MOBILIZE_TOKEN: TOKEN, WOLKVOX_MOBILIZE_SERVIDOR: SERVIDOR };
  assert.deepEqual(wv.credenciales('MOBILIZE', env), { token: TOKEN, servidor: SERVIDOR });
  assert.equal(wv.credenciales('ORLANT', env), null, 'otra operacion, sin credenciales');
  for (const malo of ['otro.dominio.com', 'x/y', 'a b', 'https://x', 'srv?x=1', '']) {
    assert.equal(wv.credenciales('MOBILIZE', Object.assign({}, env, { WOLKVOX_MOBILIZE_SERVIDOR: malo })), null, malo);
  }
  assert.equal(wv.credenciales('../X', env), null);
  // En pruebas nunca se lee el archivo local (server/data/wolkvox.local.env): solo en development.
  const src = fs.readFileSync(path.join(__dirname, '..', 'wolkvox.js'), 'utf8');
  assert.match(src, /if \(\(env\.NODE_ENV \|\| 'development'\) !== 'development'\) return;/);
});

test('el archivo local del token esta ignorado por git (server/data/ y *.env)', () => {
  const gi = fs.readFileSync(path.join(__dirname, '..', '..', '.gitignore'), 'utf8').split(/\r?\n/);
  assert.ok(gi.includes('server/data/'));
  assert.ok(gi.includes('*.env'));
  assert.equal(path.relative(path.join(__dirname, '..'), wv.ARCHIVO_LOCAL).replace(/\\/g, '/'), 'data/wolkvox.local.env');
});

// ── Cliente ──
function consultar(extra) {
  return wv.consultarReporte(Object.assign({ db, operacion: 'PRUEBA', api: 'cdr_1', dateIni: '20250602080000', dateEnd: '20250602085959', credenciales: { token: TOKEN, servidor: SERVIDOR }, fetchImpl: fetchFalso, env: { NODE_ENV: 'test' } }, extra || {}));
}
function capturarConsola(fn) {
  const orig = { log: console.log, error: console.error, warn: console.warn };
  const out = [];
  console.log = console.error = console.warn = (...a) => out.push(a.join(' '));
  return Promise.resolve().then(fn).finally(() => Object.assign(console, orig)).then((v) => ({ v, out: out.join('\n') }), (e) => { e.consola = out.join('\n'); throw e; });
}

test('cliente: GET al servidor de la operacion, token SOLO en el encabezado wolkvox-token, y el log sin secretos', async () => {
  falso.responder = null;
  const { v, out } = await capturarConsola(() => consultar());
  const u = new URL(falso.ultima.url);
  assert.equal(u.protocol, 'https:');
  assert.equal(u.host, SERVIDOR + '.wolkvox.com');
  assert.equal(u.pathname, '/api/v2/reports_manager.php');
  assert.deepEqual(Object.fromEntries(u.searchParams), { api: 'cdr_1', date_ini: '20250602080000', date_end: '20250602085959' });
  assert.ok(!falso.ultima.url.includes(TOKEN), 'el token no va en la URL');
  assert.equal(falso.ultima.opts.method, 'GET');
  assert.equal(falso.ultima.opts.headers['wolkvox-token'], TOKEN);
  assert.ok(falso.ultima.opts.signal, 'con tiempo maximo de espera');
  assert.equal(v.httpStatus, 200);
  assert.match(out, /\[wolkvox\] PRUEBA cdr_1 200 2 filas/);
  for (const secreto of [TOKEN, SERVIDOR, 'wolkvox.com', CENTINELA_TEL, CENTINELA_NOMBRE]) assert.ok(!out.includes(secreto), 'el log no trae ' + secreto);
});

test('cliente: tiempo agotado, sin conexion, 401/403, 429, 500 y JSON invalido dan errores fijos sin secretos', async () => {
  const casos = [
    [(u, o) => new Promise((res, rej) => o.signal.addEventListener('abort', () => rej(o.signal.reason))), 'tiempo_agotado', { timeoutMs: 30 }],
    [() => Promise.reject(new TypeError('fetch failed: getaddrinfo ENOTFOUND ' + SERVIDOR + '.wolkvox.com ' + TOKEN)), 'red'],
    [() => Promise.resolve({ status: 401, json: () => Promise.resolve({}) }), 'autorizacion'],
    [() => Promise.resolve({ status: 403, json: () => Promise.resolve({}) }), 'autorizacion'],
    [() => Promise.resolve({ status: 429, json: () => Promise.resolve({}) }), 'limite_wolkvox'],
    [() => Promise.resolve({ status: 500, json: () => Promise.resolve({ msg: TOKEN }) }), 'http'],
    [() => Promise.resolve({ status: 200, json: () => Promise.reject(new SyntaxError('x')) }), 'respuesta_invalida'],
    [() => Promise.resolve({ status: 200, json: () => Promise.resolve([1, 2]) }), 'respuesta_invalida'],
  ];
  for (const [resp, codigo, extra] of casos) {
    falso.responder = resp;
    const e = await capturarConsola(() => consultar(extra)).then(() => null, (err) => err);
    assert.ok(e instanceof wv.WolkvoxError, codigo);
    assert.equal(e.codigo, codigo);
    for (const secreto of [TOKEN, SERVIDOR, 'wolkvox.com']) {
      assert.ok(!e.message.includes(secreto), codigo + ': el mensaje no trae ' + secreto);
      assert.ok(!(e.consola || '').includes(secreto), codigo + ': el log no trae ' + secreto);
    }
  }
  falso.responder = null;
});

test('cliente: valida antes de gastar una consulta; sin fetch inyectado en pruebas nunca sale a la red', async () => {
  const antes = falso.llamadas;
  await assert.rejects(consultar({ dateEnd: '20250701000000' }), (e) => e.codigo === 'rango');
  await assert.rejects(consultar({ api: 'reporte_inventado' }), (e) => e.codigo === 'reporte');
  await assert.rejects(consultar({ credenciales: null, operacion: 'SINCONFIG' }), (e) => e.codigo === 'sin_configurar');
  assert.equal(falso.llamadas, antes, 'ninguna llego a Wolkvox');
  await assert.rejects(consultar({ operacion: 'SINRED', fetchImpl: undefined }), (e) => e.codigo === 'red' && /pruebas/.test(e.message));
});

test('contador: cuenta por operacion y dia (hora Colombia) y se detiene en el tope, sin llamar a Wolkvox', async () => {
  const env = { NODE_ENV: 'test', WOLKVOX_MAX_CONSULTAS_DIA: '3' };
  const ahora = new Date('2025-06-02T15:00:00Z');
  assert.equal(wv.topeDiario({}), wv.TOPE_POR_DEFECTO);
  assert.ok(wv.TOPE_POR_DEFECTO < wv.LIMITE_LICENCIA_DIA);
  assert.equal(wv.topeDiario({ WOLKVOX_MAX_CONSULTAS_DIA: '99999' }), 3000, 'nunca por encima del limite de la licencia');
  for (let i = 0; i < 3; i++) await consultar({ operacion: 'TOPE', env, ahora });
  assert.equal(wv.usoDelDia(db, 'TOPE', ahora), 3);
  const antes = falso.llamadas;
  await assert.rejects(consultar({ operacion: 'TOPE', env, ahora }), (e) => e.codigo === 'tope');
  assert.equal(falso.llamadas, antes, 'al tope no se llama');
  assert.equal(wv.usoDelDia(db, 'OTRA', ahora), 0, 'otra operacion tiene su propio contador');
  // 04:59 UTC del 3 de junio sigue siendo el 2 de junio en Colombia; 05:00 UTC ya es el 3.
  assert.equal(wv.usoDelDia(db, 'TOPE', new Date('2025-06-03T04:59:00Z')), 3);
  assert.equal(wv.usoDelDia(db, 'TOPE', new Date('2025-06-03T05:00:00Z')), 0);
});

test('resumen: solo code, msg, cuantas filas y los NOMBRES de los campos; ningun valor', () => {
  const s = wv.resumenSinValores({ code: 200, error: false, msg: '2 records were found <b>', data: [
    { agent_name: CENTINELA_NOMBRE, telephone: CENTINELA_TEL, date: 'x' },
    { telephone: CENTINELA_TEL, cod_act: '1', 'malo<script>': 1 }, null, 'texto',
  ] });
  assert.deepEqual(s, { code: '200', msg: '2 records were found b', filas: 4, campos: ['agent_name', 'cod_act', 'date', 'telephone'] });
  const txt = JSON.stringify(s);
  assert.ok(!txt.includes(CENTINELA_NOMBRE) && !txt.includes(CENTINELA_TEL));
  assert.deepEqual(wv.resumenSinValores({}), { code: null, msg: null, filas: 0, campos: [] });
  assert.equal(wv.resumenSinValores({ code: { x: 1 }, msg: 5 }).code, null);
});

// ── Rutas ──
test('rutas: solo el administrador completo; otros roles 403 aunque tengan el permiso de la replica', async () => {
  for (const [rol, t] of Object.entries(actores)) {
    const e = await request(app).get('/api/wolkvox/estado?campana=' + encodeURIComponent(R)).set(H(t));
    assert.equal(e.status, 403, rol + ' estado');
    const p = await request(app).post('/api/wolkvox/probar').set(H(t)).send({ campana: R });
    assert.equal(p.status, 403, rol + ' probar');
  }
  const sin = await request(app).get('/api/wolkvox/estado?campana=' + encodeURIComponent(R));
  assert.equal(sin.status, 401);
});

test('rutas: el Mobilize real y los demas clientes no tienen conexion (404), ni para el admin', async () => {
  const antes = falso.llamadas;
  for (const c of ['MOBILIZE', 'ORLANT', 'SURA', 'CLINICA AURORA', 'NO EXISTE', '']) {
    const e = await request(app).get('/api/wolkvox/estado?campana=' + encodeURIComponent(c)).set(H(admin));
    assert.equal(e.status, 404, c);
    const p = await request(app).post('/api/wolkvox/probar').set(H(admin)).send({ campana: c });
    assert.equal(p.status, 404, c);
  }
  assert.equal(falso.llamadas, antes);
});

test('rutas: sin token guardado, el estado lo dice y probar no llama a Wolkvox (409)', async () => {
  delete process.env.WOLKVOX_MOBILIZE_TOKEN;
  delete process.env.WOLKVOX_MOBILIZE_SERVIDOR;
  rutaWv._reiniciarEspera();
  const e = await request(app).get('/api/wolkvox/estado?campana=' + encodeURIComponent(R)).set(H(admin));
  assert.equal(e.status, 200);
  assert.equal(e.body.configurado, false);
  assert.equal(e.body.limiteLicencia, 3000);
  assert.match(e.body.fechaSugerida, /^\d{4}-\d{2}-\d{2}$/);
  const antes = falso.llamadas;
  const p = await request(app).post('/api/wolkvox/probar').set(H(admin)).send({ campana: R, fecha: '2025-06-02' });
  assert.equal(p.status, 409);
  assert.equal(p.body.codigo, 'sin_configurar');
  assert.equal(falso.llamadas, antes);
});

test('rutas: probar conexion responde solo code, msg, filas y nombres de campos; nada de token, servidor ni valores', async () => {
  process.env.WOLKVOX_MOBILIZE_TOKEN = TOKEN;
  process.env.WOLKVOX_MOBILIZE_SERVIDOR = SERVIDOR;
  rutaWv._reiniciarEspera();
  falso.responder = null;
  const uso0 = wv.usoDelDia(db, 'MOBILIZE');
  const { v: p, out } = await capturarConsola(() => request(app).post('/api/wolkvox/probar').set(H(admin)).send({ campana: R, fecha: '2025-06-02' }));
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.equal(p.body.code, '200');
  assert.equal(p.body.msg, '2 records were found');
  assert.equal(p.body.filas, 2);
  assert.deepEqual(p.body.campos, ['agent_name', 'cod_act', 'cost', 'date', 'description_cod_act', 'destiny', 'telephone', 'time_min', 'time_seg']);
  assert.equal(p.body.usoHoy, uso0 + 1);
  const u = new URL(falso.ultima.url);
  assert.equal(u.searchParams.get('date_ini'), '20250602080000');
  assert.equal(u.searchParams.get('date_end'), '20250602085959');
  const txt = p.text + JSON.stringify(p.headers);
  for (const x of [TOKEN, SERVIDOR, 'wolkvox.com', 'wolkvox-token', CENTINELA_NOMBRE, CENTINELA_TEL, 'Inventada']) {
    assert.ok(!txt.includes(x), 'la respuesta no trae ' + x);
    assert.ok(!out.includes(x) || x === 'wolkvox-token', 'el log no trae ' + x);
  }
  // Historial: una linea corta, sin secretos ni valores.
  const h = db.prepare("SELECT detalle FROM historial WHERE accion = 'WOLKVOX_PRUEBA' ORDER BY id DESC LIMIT 1").get();
  assert.match(h.detalle, /^MOBILIZE · cdr_1 · 2025-06-02 · 200 · 2 filas$/);
  // Espera minima entre pruebas (cuida las consultas del dia).
  const antes = falso.llamadas;
  const p2 = await request(app).post('/api/wolkvox/probar').set(H(admin)).send({ campana: R, fecha: '2025-06-02' });
  assert.equal(p2.status, 429);
  assert.equal(p2.body.codigo, 'espera');
  assert.equal(falso.llamadas, antes);
});

test('rutas: un error de Wolkvox llega al admin como texto fijo (502) y una fecha futura se rechaza', async () => {
  rutaWv._reiniciarEspera();
  falso.responder = () => Promise.reject(new TypeError('fetch failed ' + TOKEN + ' ' + SERVIDOR));
  const { v: p } = await capturarConsola(() => request(app).post('/api/wolkvox/probar').set(H(admin)).send({ campana: R, fecha: '2025-06-02' }));
  assert.equal(p.status, 502);
  assert.equal(p.body.codigo, 'red');
  assert.ok(!p.text.includes(TOKEN) && !p.text.includes(SERVIDOR));
  falso.responder = null;
  rutaWv._reiniciarEspera();
  const f = await request(app).post('/api/wolkvox/probar').set(H(admin)).send({ campana: R, fecha: '2999-01-01' });
  assert.equal(f.status, 400);
});

test('la replica sigue sin verse para nadie mas: la lista de clientes no la trae', async () => {
  for (const [rol, t] of Object.entries(actores)) {
    const l = await request(app).get('/api/dashboard/clientes').set(H(t));
    assert.ok(!JSON.stringify(l.body).includes(R), rol);
  }
});

// ── SSM ──
test('secrets: desde SSM carga tambien WOLKVOX_*, sin pisar lo que ya esta en el entorno', async () => {
  const resuelto = require.resolve('@aws-sdk/client-ssm');
  const previo = require.cache[resuelto];
  class GetParametersByPathCommand { constructor(i) { this.input = i; } }
  class SSMClient { async send(cmd) { assert.equal(cmd.input.WithDecryption, true); return { Parameters: [
    { Name: '/pruebas/w2/WOLKVOX_MOBILIZE_TOKEN', Value: 'valor-ssm-falso' },
    { Name: '/pruebas/w2/WOLKVOX_MOBILIZE_SERVIDOR', Value: 'servidorssm' },
    { Name: '/pruebas/w2/OTRA_COSA', Value: 'no-debe-cargarse' },
  ] }; } }
  require.cache[resuelto] = { id: resuelto, filename: resuelto, loaded: true, exports: { SSMClient, GetParametersByPathCommand } };
  const guardado = { p: process.env.SSM_PARAM_PREFIX, t: process.env.WOLKVOX_MOBILIZE_TOKEN, s: process.env.WOLKVOX_MOBILIZE_SERVIDOR };
  try {
    process.env.SSM_PARAM_PREFIX = '/pruebas/w2/';
    delete process.env.WOLKVOX_MOBILIZE_TOKEN;
    process.env.WOLKVOX_MOBILIZE_SERVIDOR = 'ya-estaba';
    const { hydrateEnv, esClaveWolkvox } = require('../secrets');
    const r = await hydrateEnv();
    assert.ok(r.loaded.includes('WOLKVOX_MOBILIZE_TOKEN'));
    assert.ok(!r.loaded.includes('OTRA_COSA'));
    assert.equal(process.env.WOLKVOX_MOBILIZE_TOKEN, 'valor-ssm-falso');
    assert.equal(process.env.WOLKVOX_MOBILIZE_SERVIDOR, 'ya-estaba', 'lo explicito gana');
    assert.equal(process.env.OTRA_COSA, undefined);
    assert.equal(esClaveWolkvox('WOLKVOX_X_TOKEN'), true);
    assert.equal(esClaveWolkvox('wolkvox_x'), false);
  } finally {
    if (previo) require.cache[resuelto] = previo; else delete require.cache[resuelto];
    for (const [k, v] of [['SSM_PARAM_PREFIX', guardado.p], ['WOLKVOX_MOBILIZE_TOKEN', guardado.t], ['WOLKVOX_MOBILIZE_SERVIDOR', guardado.s]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});

// ── Navegador ──
test('navegador: el boton solo para el administrador completo y solo en una campaña interna', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'wolkvox-prueba.js'), 'utf8');
  const prueba = (admin, interno) => new Function('isFullAdmin', 'esClienteInterno', 'document', 'module', src + '; return wvPruebaVisible("X");')(
    () => admin, () => interno, { addEventListener() {}, getElementById() { return null; } }, undefined);
  assert.equal(prueba(true, true), true);
  assert.equal(prueba(false, true), false);
  assert.equal(prueba(true, false), false);
  assert.doesNotMatch(src, /innerHTML/, 'todo lo del servidor se pinta con textContent');
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  assert.match(html, /<button class="aurora-close hidden" id="gd-wolkvox-btn"/, 'oculto por defecto');
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'dashboard-generic.js'), 'utf8'), /wvPruebaPintarBoton\(_gd\.cliente\)/);
});

test('ningun archivo de public/ menciona el encabezado del token', () => {
  const pub = path.join(__dirname, '..', '..', 'public');
  const malos = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) walk(p);
      else if (/\.(js|html|css)$/.test(f.name) && fs.readFileSync(p, 'utf8').includes('wolkvox-token')) malos.push(path.relative(pub, p));
    }
  })(pub);
  assert.deepEqual(malos, []);
});
