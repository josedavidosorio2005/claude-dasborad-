// faseAU1-wolkvox-aurora.test.js — Fase AU1 (autorización escrita del usuario, 26/11/2026,
// CLAUDE.md): réplica oculta «CLINICA AURORA PRUEBAS API» y la operación AURORA con «Diagnóstico de
// red» y «Probar». SIN consulta automática (no es un destino) y nunca el Aurora real.
// Red y fetch FALSOS inyectados; datos y token INVENTADOS; nunca sale a internet.
'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const dbMod = require('../db');
const wv = require('../wolkvox');
const D = require('../wolkvox-destinos');
const rutaWv = require('../routes/wolkvox');

const R = 'CLINICA AURORA PRUEBAS API';
const AU = 'CLINICA AURORA';
const SERVIDOR = 'servidorfalsoau1';
const TOKEN = 'TOKEN-FALSO-AU1-no-es-real';
const SKILL = 'SKILL INVENTADA AU1';
const H = (t) => ({ Authorization: 'Bearer ' + t });
let admin, cliente;
const fila = (tabla, nombre) => db.prepare(`SELECT * FROM ${tabla} WHERE ${tabla === 'dashboards_config' ? 'cliente' : 'nombre'} = ?`).get(nombre);

const red = { llamadas: [] };
const redFalsa = {
  lookup: (host) => { red.llamadas.push(['lookup', host]); return Promise.resolve([{ address: '192.0.2.55', family: 4 }]); },
  tcp: (address, family) => { red.llamadas.push(['tcp', address, family]); return Promise.resolve(); },
  tls: (address, family, servername) => { red.llamadas.push(['tls', address, family, servername]); return Promise.resolve({ protocolo: 'TLSv1.3' }); },
};
const fetchLlamadas = [];
const fetchFalso = (url, opts) => {
  const u = new URL(url);
  fetchLlamadas.push({ host: u.hostname, api: u.searchParams.get('api'), token: opts && opts.headers && opts.headers['wolkvox-token'] });
  return Promise.resolve({ status: 200, json: () => Promise.resolve({ code: 200, msg: '1 records were found', data: [{ skill_name: SKILL, inbound_calls: '7', answer_calls: '6' }] }) });
};

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  const r = await request(app).post('/api/users').set(H(admin)).send({ nombre: 'Persona Ficticia au1', user: 'cliau1', password: 'Clave#FaseAU1xy', rol: 'CLIENTES_DASH', perms: { ClientesDash: true, ['cliente_' + AU]: true } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  // El permiso de la réplica metido DIRECTO en la base (como si alguien lo marcara por error).
  const row = db.prepare('SELECT perms FROM users WHERE id = ?').get(r.body.id);
  db.prepare('UPDATE users SET perms = ? WHERE id = ?').run(JSON.stringify(Object.assign(JSON.parse(row.perms), { ['cliente_' + R]: true })), r.body.id);
  cliente = await tokenFor('cliau1', 'Clave#FaseAU1xy');
  app.locals.wolkvoxRed = redFalsa;
  app.locals.wolkvoxFetch = fetchFalso;
});
after(() => {
  delete app.locals.wolkvoxRed;
  delete app.locals.wolkvoxFetch;
  delete process.env.WOLKVOX_AURORA_TOKEN;
  delete process.env.WOLKVOX_AURORA_SERVIDOR;
});
beforeEach(() => {
  rutaWv._reiniciarEspera();
  red.llamadas = [];
  fetchLlamadas.length = 0;
  delete process.env.WOLKVOX_AURORA_TOKEN;
  process.env.WOLKVOX_AURORA_SERVIDOR = SERVIDOR; // como quedará en SSM; el token todavía no
});

test('migración: réplica interna de Aurora con 3 pestañas copiadas de Aurora, vacía; Aurora intacta; idempotente', () => {
  const reg = fila('clientes_registro', R);
  assert.ok(reg, 'la réplica está en el registro');
  const par = JSON.parse(reg.parametros);
  assert.equal(par.interno, true);
  assert.equal(par.replicaDe, AU);
  assert.deepEqual(JSON.parse(reg.modulos), ['flujo_llamadas', 'flujo_whatsapp', 'whatsapp_tiempos', 'tipificacion']);
  const cfg = fila('dashboards_config', R);
  assert.ok(cfg, 'tiene tablero');
  const layout = JSON.parse(cfg.layout);
  assert.deepEqual(layout.tabs.map((t) => t.key), ['trafico', 'trafico_whatsapp', 'tipificacion'], 'solo Tráfico de Llamadas, de WhatsApp y Tipificación');
  assert.ok(layout.tabs.every((t) => t.panels.every((p) => p.campana === R)), 'cada panel lee de la réplica');
  assert.ok(!cfg.layout.includes('"' + AU + '"'), 'ningún panel lee filas de Aurora');
  // Las mismas pestañas que Aurora (mismos paneles y opciones), salvo la campaña.
  const auTabs = JSON.parse(fila('dashboards_config', AU).layout).tabs.filter((t) => ['trafico', 'trafico_whatsapp', 'tipificacion'].includes(t.key));
  assert.equal(JSON.stringify(auTabs).split('"' + AU + '"').join('"' + R + '"'), JSON.stringify(layout.tabs));
  for (const t of ['calidad_nivel_servicio_diario', 'trafico_whatsapp', 'whatsapp_tiempos', 'tipificaciones']) {
    assert.equal(db.prepare(`SELECT COUNT(*) n FROM ${t} WHERE campana = ?`).get(R).n, 0, 'sin datos en ' + t);
  }
  const auReg = JSON.stringify(fila('clientes_registro', AU));
  const auCfg = JSON.stringify(fila('dashboards_config', AU));
  const repReg = JSON.stringify(reg);
  const repCfg = JSON.stringify(cfg);
  dbMod.crearReplicaAuroraApi();
  assert.equal(JSON.stringify(fila('clientes_registro', AU)), auReg);
  assert.equal(JSON.stringify(fila('dashboards_config', AU)), auCfg);
  assert.equal(JSON.stringify(fila('clientes_registro', R)), repReg);
  assert.equal(JSON.stringify(fila('dashboards_config', R)), repCfg);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM clientes_registro WHERE nombre = ?').get(R).n, 1);
  assert.notEqual(JSON.parse(fila('clientes_registro', AU).parametros || '{}').interno, true, 'Aurora real no es interna');
});

test('operación por campaña: la réplica de Aurora es AURORA; Aurora real y los demás reales, nunca', () => {
  assert.equal(wv.operacionDeCampana(R), 'AURORA');
  assert.equal(wv.operacionDeCampana(AU), null);
  assert.equal(wv.operacionDeCampana('ORLANT PRUEBAS API'), 'ORLANT');
  assert.equal(wv.operacionDeCampana('MOBILIZE PRUEBAS API'), null); // Fase W10: borrada
  assert.ok(Object.isFrozen(wv.OPERACION_DE_CAMPANA));
});

// Fase AU2 (autorización escrita del usuario, 26/11): la réplica de Aurora pasa a ser un destino (apagado); el real no.
test('la réplica de Aurora es un destino interno (AU2, apagado); el Aurora real nunca; MOBILIZE y ORLANT no cambian', () => {
  assert.deepEqual(Object.keys(D.DESTINOS), ['real', 'orlant_replica', 'aurora_replica']); // Fase W10
  assert.ok(D.CAMPANAS_PERMITIDAS.includes(R) && !D.CAMPANAS_PERMITIDAS.includes(AU));
  assert.equal(D.destinoInterno(R), D.DESTINOS.aurora_replica);
  assert.equal(D.destinoInterno(AU), null);
});

test('estado de la réplica de Aurora: sin token, sin consulta automática, servidor encontrado y nunca su valor', async () => {
  const r = await request(app).get('/api/wolkvox/estado').query({ campana: R }).set(H(admin));
  assert.equal(r.status, 200);
  assert.equal(r.body.configurado, false);
  assert.equal(r.body.diagnostico.tokenEncontrado, false);
  assert.equal(r.body.diagnostico.servidorEncontrado, true);
  assert.equal(r.body.servidorEncontrado, true);
  assert.equal(r.body.autoDisponible, true); // Fase AU2: con consulta automática, apagada
  assert.equal(r.body.auto.activoAlArrancar, false);
  assert.ok(!JSON.stringify(r.body).includes(SERVIDOR), 'nunca el servidor');
});

test('«Diagnóstico de red» de Aurora sin token: corre con el servidor, sin fetch y sin gastar consultas', async () => {
  const antes = wv.usoDelDia(db, 'AURORA');
  const r = await request(app).post('/api/wolkvox/diagnostico-red').set(H(admin)).send({ campana: R });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.wolkvox.dns.ok, true);
  assert.deepEqual(red.llamadas[0], ['lookup', SERVIDOR + '.wolkvox.com']);
  assert.equal(fetchLlamadas.length, 0, 'ninguna petición HTTP');
  assert.equal(wv.usoDelDia(db, 'AURORA'), antes, 'no gasta consultas');
  assert.ok(!JSON.stringify(r.body).includes(SERVIDOR));
  const h = db.prepare("SELECT detalle FROM historial WHERE accion = 'WOLKVOX_DIAGNOSTICO_RED' ORDER BY id DESC").get();
  assert.match(h.detalle, /^AURORA · dns ok/);
  assert.ok(!h.detalle.includes(SERVIDOR));
});

test('«Diagnóstico de red» y «Probar» de Aurora sin servidor o sin token: 409 y nada sale', async () => {
  const p = await request(app).post('/api/wolkvox/probar').set(H(admin)).send({ campana: R, fecha: '2026-11-20' });
  assert.equal(p.status, 409, 'sin token');
  delete process.env.WOLKVOX_AURORA_SERVIDOR;
  rutaWv._reiniciarEspera();
  const d = await request(app).post('/api/wolkvox/diagnostico-red').set(H(admin)).send({ campana: R });
  assert.equal(d.status, 409, 'sin servidor');
  assert.equal(red.llamadas.length, 0);
  assert.equal(fetchLlamadas.length, 0);
});

test('«Probar» de Aurora con token: 1 consulta con el token y el servidor de Aurora, su propio contador; solo nombres', async () => {
  process.env.WOLKVOX_AURORA_TOKEN = TOKEN;
  const usoMob = wv.usoDelDia(db, 'MOBILIZE');
  const usoOrl = wv.usoDelDia(db, 'ORLANT');
  const usoAu = wv.usoDelDia(db, 'AURORA');
  const r = await request(app).post('/api/wolkvox/probar').set(H(admin)).send({ campana: R, fecha: '2026-11-20' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.filas, 1);
  assert.deepEqual(r.body.skills, [SKILL]);
  assert.deepEqual(fetchLlamadas.map((x) => [x.host, x.api, x.token]), [[SERVIDOR + '.wolkvox.com', 'skill_1', TOKEN]]);
  assert.equal(wv.usoDelDia(db, 'AURORA'), usoAu + 1);
  assert.equal(wv.usoDelDia(db, 'MOBILIZE'), usoMob);
  assert.equal(wv.usoDelDia(db, 'ORLANT'), usoOrl);
  const txt = JSON.stringify(r.body);
  assert.ok(!txt.includes(TOKEN) && !txt.includes(SERVIDOR) && !txt.includes('"7"'), 'ni token, ni servidor, ni valores');
  // Nada se guardó en la réplica ni en Aurora.
  for (const c of [R, AU]) assert.equal(db.prepare('SELECT COUNT(*) n FROM calidad_nivel_servicio_diario WHERE campana = ?').get(c).n, 0, c);
});

test('«Ejecutar ahora»: la réplica de Aurora apagada da 409 (AU2); el Aurora real 404; nada consulta', async () => {
  process.env.WOLKVOX_AURORA_TOKEN = TOKEN;
  rutaWv._reiniciarEspera();
  const r = await request(app).post('/api/wolkvox/auto/ejecutar').set(H(admin)).send({ campana: R });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /WOLKVOX_AURORA_AUTO_ACTIVO/);
  rutaWv._reiniciarEspera();
  assert.equal((await request(app).post('/api/wolkvox/auto/ejecutar').set(H(admin)).send({ campana: AU })).status, 404);
  assert.equal(fetchLlamadas.length, 0);
});

test('solo el administrador: el cliente con el permiso marcado recibe 403; Aurora real no tiene Wolkvox (404)', async () => {
  for (const [m, url, body] of [['get', '/api/wolkvox/estado?campana=' + encodeURIComponent(R)], ['post', '/api/wolkvox/diagnostico-red', { campana: R }], ['post', '/api/wolkvox/probar', { campana: R }]]) {
    const r = await request(app)[m](url).set(H(cliente)).send(body);
    assert.equal(r.status, 403, m + ' ' + url);
  }
  for (const [m, url, body] of [['get', '/api/wolkvox/estado?campana=' + encodeURIComponent(AU)], ['post', '/api/wolkvox/diagnostico-red', { campana: AU }], ['post', '/api/wolkvox/probar', { campana: AU }]]) {
    const r = await request(app)[m](url).set(H(admin)).send(body);
    assert.equal(r.status, 404, 'Aurora real: ' + m + ' ' + url);
  }
  assert.equal(red.llamadas.length, 0);
  assert.equal(fetchLlamadas.length, 0);
});

test('el cliente de Aurora no ve la réplica (es interna)', async () => {
  const r = await request(app).get('/api/dashboard/clientes').set(H(cliente));
  assert.equal(r.status, 200);
  assert.ok(JSON.stringify(r.body).includes(AU), 'el cliente ve Aurora');
  assert.ok(!JSON.stringify(r.body).includes(R), 'la réplica no aparece para el cliente');
  const a = await request(app).get('/api/dashboard/clientes').set(H(admin));
  assert.ok(JSON.stringify(a.body).includes(R), 'el administrador sí la ve');
});
