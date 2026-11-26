// faseN5-wolkvox-orlant.test.js — Fase N5 (23/11/2026, docs/orlant/nuevo-dashboard/plan.md §4):
// motor de Wolkvox por operación SIN cambiar MOBILIZE, réplica oculta «ORLANT PRUEBAS API»
// APAGADA (sin consulta automática) y «Diagnóstico de red» que solo necesita el servidor (no el
// token). Red y fetch FALSOS inyectados; datos INVENTADOS; nunca sale a internet.
'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const dbMod = require('../db');
const wv = require('../wolkvox');
const D = require('../wolkvox-destinos');
const wvAuto = require('../wolkvox-auto');
const rutaWv = require('../routes/wolkvox');

const R = 'ORLANT PRUEBAS API';
const SERVIDOR = 'servidorfalson5';
const H = (t) => ({ Authorization: 'Bearer ' + t });
let admin, cliente;
const fila = (tabla, cliente) => db.prepare(`SELECT * FROM ${tabla} WHERE ${tabla === 'dashboards_config' ? 'cliente' : 'nombre'} = ?`).get(cliente);

const red = { llamadas: [] };
const redFalsa = {
  lookup: (host) => { red.llamadas.push(['lookup', host]); return Promise.resolve([{ address: '192.0.2.34', family: 4 }]); },
  tcp: (address, family) => { red.llamadas.push(['tcp', address, family]); return Promise.resolve(); },
  tls: (address, family, servername) => { red.llamadas.push(['tls', address, family, servername]); return Promise.resolve({ protocolo: 'TLSv1.3' }); },
};
const fetchLlamadas = [];

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  const r = await request(app).post('/api/users').set(H(admin)).send({ nombre: 'Persona Ficticia n5', user: 'clin5', password: 'Clave#FaseN5xy', rol: 'CLIENTES_DASH', perms: { ClientesDash: true, cliente_ORLANT: true } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  // El permiso de la réplica metido DIRECTO en la base (como si alguien lo marcara por error).
  const row = db.prepare('SELECT perms FROM users WHERE id = ?').get(r.body.id);
  db.prepare('UPDATE users SET perms = ? WHERE id = ?').run(JSON.stringify(Object.assign(JSON.parse(row.perms), { ['cliente_' + R]: true })), r.body.id);
  cliente = await tokenFor('clin5', 'Clave#FaseN5xy');
  app.locals.wolkvoxRed = redFalsa;
  app.locals.wolkvoxFetch = (...a) => { fetchLlamadas.push(a); return Promise.reject(new Error('no debe llamarse')); };
});
after(() => {
  delete app.locals.wolkvoxRed;
  delete app.locals.wolkvoxFetch;
  delete process.env.WOLKVOX_ORLANT_TOKEN;
  delete process.env.WOLKVOX_ORLANT_SERVIDOR;
});
beforeEach(() => {
  rutaWv._reiniciarEspera();
  red.llamadas = [];
  fetchLlamadas.length = 0;
  delete process.env.WOLKVOX_ORLANT_TOKEN;
  process.env.WOLKVOX_ORLANT_SERVIDOR = SERVIDOR; // como quedará en SSM; el token todavía no
});

test('migración: crea la réplica interna de ORLANT con su tablero, vacía; ORLANT intacto; idempotente', () => {
  const reg = fila('clientes_registro', R);
  assert.ok(reg, 'la réplica está en el registro');
  const par = JSON.parse(reg.parametros);
  assert.equal(par.interno, true);
  assert.equal(par.replicaDe, 'ORLANT');
  assert.deepEqual(JSON.parse(reg.modulos), ['flujo_llamadas', 'tipificacion']);
  const cfg = fila('dashboards_config', R);
  assert.ok(cfg, 'tiene tablero');
  assert.ok(!/"(campana|cliente)":"ORLANT"/.test(cfg.layout), 'ningún panel lee filas de ORLANT');
  assert.deepEqual(JSON.parse(cfg.layout).tabs.map((t) => t.key), ['trafico', 'tipificacion'], 'solo Tráfico y Tipificación');
  for (const t of ['calidad_nivel_servicio_diario', 'tipificaciones']) {
    assert.equal(db.prepare(`SELECT COUNT(*) n FROM ${t} WHERE campana = ?`).get(R).n, 0, 'sin datos en ' + t);
  }
  const orlReg = JSON.stringify(fila('clientes_registro', 'ORLANT'));
  const orlCfg = JSON.stringify(fila('dashboards_config', 'ORLANT'));
  const repCfg = JSON.stringify(cfg);
  dbMod.crearReplicaOrlantApi();
  assert.equal(JSON.stringify(fila('clientes_registro', 'ORLANT')), orlReg);
  assert.equal(JSON.stringify(fila('dashboards_config', 'ORLANT')), orlCfg);
  assert.equal(JSON.stringify(fila('dashboards_config', R)), repCfg);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM clientes_registro WHERE nombre = ?').get(R).n, 1);
  const orl = fila('clientes_registro', 'ORLANT');
  if (orl) assert.notEqual(JSON.parse(orl.parametros || '{}').interno, true, 'ORLANT real no es interno');
});

test('operación por campaña: solo las réplicas; los reales nunca', () => {
  assert.equal(wv.operacionDeCampana(R), 'ORLANT');
  assert.equal(wv.operacionDeCampana('MOBILIZE PRUEBAS API'), 'MOBILIZE');
  assert.equal(wv.operacionDeCampana('ORLANT'), null);
  assert.equal(wv.operacionDeCampana('MOBILIZE'), null);
  assert.ok(Object.isFrozen(wv.OPERACION_DE_CAMPANA));
});

// Fase N6 (23/11): la réplica de ORLANT pasa a ser un destino (apagado); MOBILIZE sigue igual.
test('MOBILIZE sin cambios: sus dos destinos siguen de MOBILIZE; ORLANT solo como réplica', () => {
  assert.deepEqual(Object.keys(D.DESTINOS), ['replica', 'real', 'orlant_replica', 'aurora_replica']); // Fase AU2: + la réplica de Aurora (apagada)
  assert.equal(D.operacionDe(), 'MOBILIZE');
  assert.equal(D.operacionDe('replica'), 'MOBILIZE');
  assert.equal(D.operacionDe('real'), 'MOBILIZE');
  assert.equal(D.operacionDe('orlant_replica'), 'ORLANT');
  assert.equal(wvAuto.OPERACION, 'MOBILIZE');
  assert.equal(wvAuto.CAMPANA, 'MOBILIZE PRUEBAS API');
  assert.throws(() => D.destino('orlant'), /no permitido/);
  assert.ok(!D.CAMPANAS_PERMITIDAS.includes('ORLANT'), 'nunca el ORLANT real');
});

test('contador del día por operación: gastar de ORLANT no toca el de MOBILIZE', () => {
  const ahora = new Date('2026-11-23T15:00:00Z');
  const antesMob = wv.usoDelDia(db, 'MOBILIZE', ahora);
  const antesOrl = wv.usoDelDia(db, 'ORLANT', ahora);
  assert.equal(wv.reservarConsulta(db, 'ORLANT', ahora, {}), true);
  assert.equal(wv.usoDelDia(db, 'ORLANT', ahora), antesOrl + 1);
  assert.equal(wv.usoDelDia(db, 'MOBILIZE', ahora), antesMob);
  db.prepare('UPDATE wolkvox_uso SET consultas = consultas - 1 WHERE operacion = ? AND dia = ?').run('ORLANT', '2026-11-23');
});

test('estado de la réplica de ORLANT: sin token, consulta automática apagada, servidor encontrado', async () => {
  const r = await request(app).get('/api/wolkvox/estado').query({ campana: R }).set(H(admin));
  assert.equal(r.status, 200);
  assert.equal(r.body.configurado, false);
  assert.equal(r.body.diagnostico.tokenEncontrado, false);
  assert.equal(r.body.diagnostico.servidorEncontrado, true);
  assert.equal(r.body.servidorEncontrado, true);
  assert.equal(r.body.autoDisponible, true); // Fase N6
  assert.equal(r.body.auto.interruptor, 'WOLKVOX_ORLANT_AUTO_ACTIVO');
  assert.equal(r.body.auto.activoAlArrancar, false);
  assert.ok(!JSON.stringify(r.body).includes(SERVIDOR), 'nunca el servidor');
  // La de MOBILIZE sigue con su consulta automática.
  const m = await request(app).get('/api/wolkvox/estado').query({ campana: 'MOBILIZE PRUEBAS API' }).set(H(admin));
  assert.equal(m.status, 200);
  assert.equal(m.body.autoDisponible, true);
  assert.ok(m.body.auto);
});

test('«Diagnóstico de red» de ORLANT sin token: corre con el servidor, sin fetch y sin gastar consultas', async () => {
  const antes = wv.usoDelDia(db, 'ORLANT');
  const r = await request(app).post('/api/wolkvox/diagnostico-red').set(H(admin)).send({ campana: R });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.wolkvox.dns.ok, true);
  assert.equal(r.body.wolkvox.ipv4.tcp.ok, true);
  assert.equal(r.body.wolkvox.ipv4.tls.ok, true);
  assert.deepEqual(red.llamadas[0], ['lookup', SERVIDOR + '.wolkvox.com']);
  assert.equal(fetchLlamadas.length, 0, 'ninguna petición HTTP');
  assert.equal(wv.usoDelDia(db, 'ORLANT'), antes, 'no gasta consultas');
  assert.ok(!JSON.stringify(r.body).includes(SERVIDOR));
  const h = db.prepare("SELECT detalle FROM historial WHERE accion = 'WOLKVOX_DIAGNOSTICO_RED' ORDER BY id DESC").get();
  assert.match(h.detalle, /^ORLANT · dns ok/);
  assert.ok(!h.detalle.includes(SERVIDOR));
});

test('«Diagnóstico de red» de ORLANT sin servidor: 409 y no toca la red', async () => {
  delete process.env.WOLKVOX_ORLANT_SERVIDOR;
  const r = await request(app).post('/api/wolkvox/diagnostico-red').set(H(admin)).send({ campana: R });
  assert.equal(r.status, 409);
  assert.equal(red.llamadas.length, 0);
});

test('«Probar» de ORLANT sin token: 409 y nunca llama a Wolkvox', async () => {
  const r = await request(app).post('/api/wolkvox/probar').set(H(admin)).send({ campana: R, fecha: '2026-11-20' });
  assert.equal(r.status, 409);
  assert.equal(fetchLlamadas.length, 0);
});

// Fase N6: ahora la tiene, pero APAGADA (sin WOLKVOX_ORLANT_AUTO_ACTIVO): 409 y ninguna consulta.
test('«Ejecutar ahora» en la réplica de ORLANT apagada: 409 y ninguna consulta', async () => {
  process.env.WOLKVOX_ORLANT_TOKEN = 'TOKEN-FALSO-N5-no-es-real';
  const r = await request(app).post('/api/wolkvox/auto/ejecutar').set(H(admin)).send({ campana: R });
  assert.equal(r.status, 409);
  assert.equal(r.body.codigo, 'apagada');
  assert.match(r.body.error, /WOLKVOX_ORLANT_AUTO_ACTIVO/);
  assert.equal(fetchLlamadas.length, 0);
});

test('solo el administrador: el cliente con el permiso marcado recibe 403; el ORLANT real no tiene Wolkvox (404)', async () => {
  for (const [m, url, body] of [['get', '/api/wolkvox/estado?campana=' + encodeURIComponent(R)], ['post', '/api/wolkvox/diagnostico-red', { campana: R }], ['post', '/api/wolkvox/probar', { campana: R }]]) {
    const r = await request(app)[m](url).set(H(cliente)).send(body);
    assert.equal(r.status, 403, m + ' ' + url);
  }
  const real = await request(app).post('/api/wolkvox/diagnostico-red').set(H(admin)).send({ campana: 'ORLANT' });
  assert.equal(real.status, 404);
  assert.equal(red.llamadas.length, 0);
  assert.equal(fetchLlamadas.length, 0);
});

test('servidorDe: solo nombre corto válido; nunca una URL', () => {
  assert.equal(wv.servidorDe('ORLANT', { NODE_ENV: 'test', WOLKVOX_ORLANT_SERVIDOR: ' wv0034 ' }), 'wv0034');
  assert.equal(wv.servidorDe('ORLANT', { NODE_ENV: 'test', WOLKVOX_ORLANT_SERVIDOR: 'evil.com/x' }), null);
  assert.equal(wv.servidorDe('ORLANT', { NODE_ENV: 'test' }), null);
  assert.equal(wv.servidorDe('orlant minúscula', { NODE_ENV: 'test', WOLKVOX_ORLANT_SERVIDOR: 'wv0034' }), null);
});
