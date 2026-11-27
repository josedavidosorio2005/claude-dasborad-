// faseW3-diagnostico-red.test.js — Fase W3 (17/11): código de causa en los errores de red de
// Wolkvox y «Diagnóstico de red» (DNS, TCP 443 y saludo TLS; sin token, sin petición HTTP, sin
// gastar consultas). Red FALSA inyectada (app.locals.wolkvoxRed) y datos INVENTADOS.
'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const wv = require('../wolkvox');
const rutaWv = require('../routes/wolkvox');
const { wvRedFilas } = require('../../public/js/wolkvox-prueba.js');

const R = 'MOBILIZE'; // Fase W10: antes la réplica «MOBILIZE PRUEBAS API» (borrada); ahora el destino real
const TOKEN = 'TOKEN-FALSO-W3-no-es-real-0987654321';
const SERVIDOR = 'servidorfalso03';
const H = (t) => ({ Authorization: 'Bearer ' + t });
let admin, cliente;

// Red falsa: registra lo que se pidió y responde según el escenario.
const red = { llamadas: [], escenario: 'ok' };
const err = (code) => Promise.reject(Object.assign(new Error('falla con ' + SERVIDOR + '.wolkvox.com'), { code }));
const redFalsa = {
  lookup: (host) => {
    red.llamadas.push(['lookup', host]);
    if (red.escenario === 'dns' && host.includes('wolkvox')) return err('ENOTFOUND');
    if (host.includes('wolkvox')) return Promise.resolve([{ address: '192.0.2.10', family: 4 }]);
    return Promise.resolve([{ address: '192.0.2.20', family: 4 }, { address: '2001:db8::20', family: 6 }]);
  },
  tcp: (address, family) => {
    red.llamadas.push(['tcp', address, family]);
    if (red.escenario === 'cuelga' && address === '192.0.2.10') return err('TIEMPO_AGOTADO');
    return Promise.resolve();
  },
  tls: (address, family, servername) => {
    red.llamadas.push(['tls', address, family, servername]);
    return Promise.resolve({ protocolo: 'TLSv1.3' });
  },
};

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  const r = await request(app).post('/api/users').set(H(admin)).send({ nombre: 'Persona Ficticia w3', user: 'cliw3', password: 'Clave#FaseW3xy', rol: 'CLIENTES_DASH', perms: { ClientesDash: true, cliente_MOBILIZE: true } });
  assert.equal(r.status, 201);
  const row = db.prepare('SELECT perms FROM users WHERE id = ?').get(r.body.id);
  db.prepare('UPDATE users SET perms = ? WHERE id = ?').run(JSON.stringify(Object.assign(JSON.parse(row.perms), { ['cliente_' + R]: true })), r.body.id);
  cliente = await tokenFor('cliw3', 'Clave#FaseW3xy');
  process.env.WOLKVOX_MOBILIZE_TOKEN = TOKEN;
  process.env.WOLKVOX_MOBILIZE_SERVIDOR = SERVIDOR;
  app.locals.wolkvoxRed = redFalsa;
});
after(() => {
  delete app.locals.wolkvoxRed;
  delete app.locals.wolkvoxFetch;
  delete process.env.WOLKVOX_MOBILIZE_TOKEN;
  delete process.env.WOLKVOX_MOBILIZE_SERVIDOR;
});
beforeEach(() => { rutaWv._reiniciarEspera(); red.llamadas = []; red.escenario = 'ok'; });

test('causaDeRed: solo el código (también anidado en cause/errors); nunca el mensaje', () => {
  const undici = Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('Connect Timeout Error (' + SERVIDOR + '.wolkvox.com:443)'), { code: 'UND_ERR_CONNECT_TIMEOUT' }) });
  assert.equal(wv.causaDeRed(undici), 'UND_ERR_CONNECT_TIMEOUT');
  const agg = Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new AggregateError([Object.assign(new Error('x'), { code: 'ENETUNREACH' })]), {}) });
  assert.equal(wv.causaDeRed(agg), 'ENETUNREACH');
  assert.equal(wv.causaDeRed(Object.assign(new Error('x'), { code: 'EAI_AGAIN' })), 'EAI_AGAIN');
  assert.equal(wv.causaDeRed(Object.assign(new Error('x'), { code: 'servidor.wolkvox.com' })), 'DESCONOCIDO');
  assert.equal(wv.causaDeRed(new Error(SERVIDOR)), 'DESCONOCIDO');
  assert.equal(wv.causaDeRed(null), 'DESCONOCIDO');
});

test('«Probar conexión» con falla de red: la causa va al log, al Historial y a la respuesta, sin servidor ni token', async () => {
  const logs = [];
  const orig = console.log;
  console.log = (...a) => { logs.push(a.join(' ')); };
  app.locals.wolkvoxFetch = () => Promise.reject(Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('Connect Timeout Error ' + SERVIDOR + '.wolkvox.com'), { code: 'UND_ERR_CONNECT_TIMEOUT' }) }));
  let r;
  try {
    r = await request(app).post('/api/wolkvox/probar').set(H(admin)).send({ campana: R, fecha: '2026-11-16' });
  } finally { console.log = orig; delete app.locals.wolkvoxFetch; }
  assert.equal(r.status, 502);
  assert.equal(r.body.codigo, 'red');
  assert.equal(r.body.causa, 'UND_ERR_CONNECT_TIMEOUT');
  assert.match(r.body.error, /No se pudo conectar con Wolkvox \(UND_ERR_CONNECT_TIMEOUT\)/);
  const linea = logs.find((l) => l.startsWith('[wolkvox]'));
  assert.match(linea, /sin conexión \(UND_ERR_CONNECT_TIMEOUT\)/);
  const h = db.prepare("SELECT detalle FROM historial WHERE accion = 'WOLKVOX_PRUEBA' ORDER BY id DESC").get();
  assert.match(h.detalle, /error red \(UND_ERR_CONNECT_TIMEOUT\)/);
  const todo = JSON.stringify(r.body) + logs.join('\n') + h.detalle;
  assert.ok(!todo.includes(SERVIDOR) && !todo.includes(TOKEN));
});

test('diagnóstico: solo administrador y solo la réplica (cliente 403, otra campaña 404)', async () => {
  assert.equal((await request(app).post('/api/wolkvox/diagnostico-red').set(H(cliente)).send({ campana: R })).status, 403);
  assert.equal((await request(app).post('/api/wolkvox/diagnostico-red').set(H(admin)).send({ campana: 'ORLANT' })).status, 404); // Fase W10: el panel pasó al MOBILIZE real; el ORLANT real sigue sin él
  assert.equal((await request(app).post('/api/wolkvox/diagnostico-red').send({ campana: R })).status, 401);
  assert.equal(red.llamadas.length, 0, 'sin permiso no se toca la red');
});

test('diagnóstico: DNS, TCP 443 y TLS por familia; sin token, sin HTTP, sin gastar consultas', async () => {
  const usoAntes = wv.usoDelDia(db, 'MOBILIZE');
  let fetchs = 0;
  app.locals.wolkvoxFetch = () => { fetchs++; return Promise.reject(new Error('no debe llamarse')); };
  const r = await request(app).post('/api/wolkvox/diagnostico-red').set(H(admin)).send({ campana: R });
  delete app.locals.wolkvoxFetch;
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const w = r.body.wolkvox;
  assert.deepEqual({ ok: w.dns.ok, v4: w.dns.ipv4, v6: w.dns.ipv6 }, { ok: true, v4: 1, v6: 0 });
  assert.equal(w.ipv4.tcp.ok, true);
  assert.equal(w.ipv4.tls.ok, true);
  assert.equal(w.ipv4.tls.protocolo, 'TLSv1.3');
  assert.deepEqual(w.ipv6, { omitido: 'sin dirección' });
  assert.equal(r.body.control.ipv4.tcp.ok, true);
  assert.equal(fetchs, 0, 'ninguna petición HTTP a Wolkvox');
  assert.equal(wv.usoDelDia(db, 'MOBILIZE'), usoAntes, 'no gasta consultas del día');
  // A Wolkvox: nombre <servidor>.wolkvox.com y TLS con ese servername; nunca el token.
  assert.ok(red.llamadas.some((l) => l[0] === 'lookup' && l[1] === SERVIDOR + '.wolkvox.com'));
  assert.ok(red.llamadas.some((l) => l[0] === 'tls' && l[3] === SERVIDOR + '.wolkvox.com'));
  assert.ok(!JSON.stringify(red.llamadas).includes(TOKEN));
  // Lo que vuelve al navegador: ni el servidor, ni una IP, ni el token.
  const s = JSON.stringify(r.body);
  for (const x of [SERVIDOR, TOKEN, '192.0.2.10', '192.0.2.20', '2001:db8']) assert.ok(!s.includes(x), x);
  const h = db.prepare("SELECT detalle FROM historial WHERE accion = 'WOLKVOX_DIAGNOSTICO_RED' ORDER BY id DESC").get();
  assert.match(h.detalle, /^MOBILIZE · dns ok \(1 v4, 0 v6\) · ipv4 tcp ok, tls ok · ipv6 sin dirección · control tcp ok, tls ok$/);
});

test('diagnóstico: se cuelga al abrir la conexión → TIEMPO_AGOTADO sin TLS; DNS que falla → ENOTFOUND', async () => {
  red.escenario = 'cuelga';
  let r = await request(app).post('/api/wolkvox/diagnostico-red').set(H(admin)).send({ campana: R });
  assert.equal(r.body.wolkvox.ipv4.tcp.ok, false);
  assert.equal(r.body.wolkvox.ipv4.tcp.codigo, 'TIEMPO_AGOTADO');
  assert.equal(r.body.wolkvox.ipv4.tls, null);
  assert.equal(r.body.control.ipv4.tcp.ok, true);
  const filas = wvRedFilas(r.body);
  assert.deepEqual(filas.find((f) => f[0] === 'Conexión IPv4 (puerto 443)')[1].slice(0, 19), 'No (TIEMPO_AGOTADO,');
  assert.equal(filas.find((f) => f[0] === 'Conexión segura IPv4 (TLS)')[1], 'No se probó: no abrió la conexión');
  assert.match(filas.find((f) => f[0].startsWith('Control'))[1], /^Sí \(/);
  // Una vez cada 30 s.
  assert.equal((await request(app).post('/api/wolkvox/diagnostico-red').set(H(admin)).send({ campana: R })).status, 429);
  rutaWv._reiniciarEspera();
  red.escenario = 'dns';
  r = await request(app).post('/api/wolkvox/diagnostico-red').set(H(admin)).send({ campana: R });
  assert.equal(r.body.wolkvox.dns.ok, false);
  assert.equal(r.body.wolkvox.dns.codigo, 'ENOTFOUND');
  assert.deepEqual(r.body.wolkvox.ipv4, { omitido: 'sin DNS' });
});

// Fase N5 (23/11): el diagnóstico solo necesita el SERVIDOR (no usa el token); sin token corre
// igual (ver faseN5-wolkvox-orlant.test.js). Sin servidor: 409 y no toca la red.
test('diagnóstico sin servidor configurado: 409 y no toca la red', async () => {
  delete process.env.WOLKVOX_MOBILIZE_SERVIDOR;
  const r = await request(app).post('/api/wolkvox/diagnostico-red').set(H(admin)).send({ campana: R });
  process.env.WOLKVOX_MOBILIZE_SERVIDOR = SERVIDOR;
  assert.equal(r.status, 409);
  assert.equal(red.llamadas.length, 0);
});

test('en pruebas, la red por defecto nunca sale a internet', async () => {
  const d = await wv.diagnosticarRed({ operacion: 'MOBILIZE', env: { NODE_ENV: 'test' }, credenciales: { token: 'x', servidor: 'nada' } });
  assert.equal(d.wolkvox.dns.ok, false);
  assert.equal(d.wolkvox.dns.codigo, 'SIN_RED_EN_PRUEBAS');
});

test('página: botón «Diagnóstico de red» en la ventana de Wolkvox; resultado con textContent', () => {
  const pub = path.join(__dirname, '..', '..', 'public');
  const index = fs.readFileSync(path.join(pub, 'index.html'), 'utf8');
  const modal = index.slice(index.indexOf('id="modal-wolkvox"'), index.indexOf('<!-- Fase 356'));
  assert.match(modal, /id="wv-red-btn" onclick="wvDiagnosticoRed\(\)">Diagnóstico de red<\/button>/);
  assert.match(modal, /id="wv-red-dl"/);
  const js = fs.readFileSync(path.join(pub, 'js', 'wolkvox-prueba.js'), 'utf8');
  const fn = js.slice(js.indexOf('async function wvDiagnosticoRed'), js.indexOf('// Esc, Tab dentro'));
  assert.ok(!/innerHTML/.test(fn));
  assert.match(fn, /dd\.textContent = f\[1\]/);
});
