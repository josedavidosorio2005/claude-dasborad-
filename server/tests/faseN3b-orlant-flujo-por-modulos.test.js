// faseN3b-orlant-flujo-por-modulos.test.js — Fase N3b (pedido del usuario, 26/11/2026): en la réplica
// «ORLANT PRUEBAS API» el Flujo (skill_1) se enciende como un módulo más: solo corre si «flujo» está en
// WOLKVOX_ORLANT_AUTO_MODULOS (además de WOLKVOX_ORLANT_AUTO_ACTIVO=1). Así WhatsApp puede correr solo.
// MOBILIZE (réplica y real) no cambia: su Flujo sigue yendo solo con su interruptor.
// Wolkvox FALSO y datos INVENTADOS; nunca sale a la red.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { db, app, request, tokenFor, MASTER_PASSWORD } = require('./helpers');
const auto = require('../wolkvox-auto');
const D = require('../wolkvox-destinos');
const wv = require('../wolkvox');

const R = 'ORLANT PRUEBAS API';
const TOKEN_ORL = 'TOKEN-FALSO-N3B-ORLANT-no-es-real';
const TOKEN_MOB = 'TOKEN-FALSO-N3B-MOBILIZE-no-es-real';
const ENV = { NODE_ENV: 'test', WOLKVOX_ORLANT_TOKEN: TOKEN_ORL, WOLKVOX_ORLANT_SERVIDOR: 'servidorfalson3b', WOLKVOX_MOBILIZE_TOKEN: TOKEN_MOB, WOLKVOX_MOBILIZE_SERVIDOR: 'servidorfalsomob3b' };
const H = (t) => ({ Authorization: 'Bearer ' + t });
const ok = (cuerpo) => Promise.resolve({ status: 200, json: () => Promise.resolve(cuerpo) });

function crearFalso() {
  const f = { llamadas: [] };
  f.fetch = (url, opts) => {
    const u = new URL(url);
    const api = u.searchParams.get('api');
    f.llamadas.push({ api, token: opts && opts.headers && opts.headers['wolkvox-token'] });
    if (api === 'skill_1') return ok({ code: 200, msg: '1 records were found', data: [{ skill_name: 'SKILL INVENTADA N3B', inbound_calls: '3', answer_calls: '2', abandon_calls: '1', service_level_20seg: '80.0 %' }] });
    return ok({ code: 200, msg: '0 records were found', data: [] }); // chat_1 y los demás: sin datos
  };
  return f;
}
// 05/11/2026 07:05 Colombia: el Flujo pediría del 1 al 4 de noviembre.
const AHORA = new Date('2026-11-05T12:05:00Z');
async function tick(env, falso) {
  db.prepare("DELETE FROM wolkvox_auto_corridas WHERE franja LIKE '2026-11-05 07%'").run();
  const p = auto.iniciar(db, { reloj: () => AHORA, cadaMs: 3600 * 1000, env, fetchImpl: falso.fetch, logEvent: () => {} });
  try { return await p.tick(); } finally { p.detener(); }
}
auto.asegurarTablas(db);
let admin;
before(async () => { admin = await tokenFor('admin', MASTER_PASSWORD); });

test('flujoEnLista: ORLANT solo con «flujo» en la lista; MOBILIZE (réplica y real) siempre, como antes', () => {
  const o = D.DESTINOS.orlant_replica;
  assert.equal(o.flujoPorModulos, true);
  for (const v of [undefined, null, '', 'whatsapp', 'flujo_hora,cdr', 'flujos', 'no_flujo']) assert.equal(D.flujoEnLista(o, v), false, String(v));
  for (const v of ['flujo', ' Flujo ', 'whatsapp,flujo', 'cdr , FLUJO']) assert.equal(D.flujoEnLista(o, v), true, v);
  for (const d of ['replica', 'real']) {
    assert.ok(!D.DESTINOS[d].flujoPorModulos, d);
    for (const v of [undefined, '', 'cdr', 'flujo']) assert.equal(D.flujoEnLista(d, v), true, d + ' ' + v);
  }
});

test('programador ORLANT con solo «whatsapp»: ni un skill_1, solo chat_1 con el token de ORLANT', async () => {
  const falso = crearFalso();
  const usoMob = wv.usoDelDia(db, 'MOBILIZE', AHORA);
  await tick(Object.assign({}, ENV, { WOLKVOX_ORLANT_AUTO_ACTIVO: '1', WOLKVOX_ORLANT_AUTO_MODULOS: 'whatsapp' }), falso);
  assert.deepEqual(falso.llamadas.map((x) => x.api), ['chat_1']);
  assert.ok(falso.llamadas.every((x) => x.token === TOKEN_ORL));
  assert.equal(wv.usoDelDia(db, 'MOBILIZE', AHORA), usoMob, 'MOBILIZE no gasta');
});

test('programador ORLANT: sin lista (o vacía) no corre nada, ni el Flujo; con «flujo» corre el Flujo', async () => {
  for (const extra of [{}, { WOLKVOX_ORLANT_AUTO_MODULOS: '' }, { WOLKVOX_ORLANT_AUTO_MODULOS: 'nada' }]) {
    const falso = crearFalso();
    await tick(Object.assign({}, ENV, { WOLKVOX_ORLANT_AUTO_ACTIVO: '1' }, extra), falso);
    assert.equal(falso.llamadas.length, 0, JSON.stringify(extra));
  }
  const falso = crearFalso();
  await tick(Object.assign({}, ENV, { WOLKVOX_ORLANT_AUTO_ACTIVO: '1', WOLKVOX_ORLANT_AUTO_MODULOS: 'flujo,whatsapp' }), falso);
  assert.deepEqual(falso.llamadas.map((x) => x.api), ['skill_1', 'skill_1', 'skill_1', 'skill_1', 'chat_1']);
  // Con el interruptor apagado, ni con «flujo» en la lista.
  const apagado = crearFalso();
  await tick(Object.assign({}, ENV, { WOLKVOX_ORLANT_AUTO_MODULOS: 'flujo,whatsapp' }), apagado);
  assert.equal(apagado.llamadas.length, 0);
});

test('MOBILIZE sin cambios: su réplica corre el Flujo con el interruptor aunque su lista de módulos esté vacía', async () => {
  const falso = crearFalso();
  await tick(Object.assign({}, ENV, { WOLKVOX_AUTO_ACTIVO: '1' }), falso);
  assert.deepEqual(falso.llamadas.map((x) => x.api), ['skill_1', 'skill_1', 'skill_1', 'skill_1'], 'Flujo de la réplica de MOBILIZE (1–4/11), sin lista');
  assert.ok(falso.llamadas.every((x) => x.token === TOKEN_MOB));
});

test('«Ejecutar ahora» ORLANT: el Flujo exige «flujo» en la lista (suelto y en «todos»); MOBILIZE igual que antes', async () => {
  const falso = crearFalso();
  const base = { db, env: ENV, ahora: AHORA, fetchImpl: falso.fetch, logEvent: () => {}, destino: 'orlant_replica', leerInterruptor: async () => true };
  const lista = (v) => async (e, nombre) => (nombre === 'WOLKVOX_ORLANT_AUTO_MODULOS' ? v : undefined);
  const r1 = await auto.ejecutarAhora(Object.assign({}, base, { leerValor: lista('whatsapp') }));
  assert.equal(r1.estado, 'apagada');
  assert.equal(r1.porLista, true);
  const r2 = await auto.ejecutarAhora(Object.assign({}, base, { modulo: 'flujo', leerValor: lista(undefined) }));
  assert.equal(r2.estado, 'apagada');
  const r3 = await auto.ejecutarAhora(Object.assign({}, base, { modulo: 'flujo', leerValor: async () => { throw new Error('SSM caído'); } }));
  assert.equal(r3.estado, 'sin_interruptor');
  assert.equal(falso.llamadas.length, 0);
  const r4 = await auto.ejecutarAhora(Object.assign({}, base, { modulo: 'todos', mes: '2026-10', leerValor: lista('whatsapp') }));
  assert.equal(r4.partes.find((p) => p.modulo === 'flujo').estado, 'apagado');
  assert.deepEqual(falso.llamadas.map((x) => x.api), ['chat_1'], '«todos» con solo whatsapp: sin skill_1');
  const r5 = await auto.ejecutarAhora(Object.assign({}, base, { modulo: 'flujo', maxConsultas: 10, leerValor: lista('flujo') }));
  assert.notEqual(r5.estado, 'apagada', JSON.stringify(r5));
  assert.ok(falso.llamadas.some((x) => x.api === 'skill_1'), 'con «flujo» sí corre: ' + JSON.stringify(r5));
  // MOBILIZE: el Flujo no lee la lista (corre solo con el interruptor).
  const mob = crearFalso();
  const leidos = [];
  await auto.ejecutarAhora({ db, env: ENV, ahora: AHORA, fetchImpl: mob.fetch, logEvent: () => {}, maxConsultas: 10, leerInterruptor: async () => true, leerValor: async (e, n) => { leidos.push(n); return undefined; } });
  assert.deepEqual(leidos, []);
  assert.deepEqual(mob.llamadas.map((x) => x.api), ['skill_1', 'skill_1', 'skill_1', 'skill_1']);
});

test('ruta «Ejecutar ahora»: Flujo de ORLANT sin «flujo» en la lista da 409 con un mensaje claro y 0 consultas', async () => {
  const L = app.locals;
  const antes = { f: L.wolkvoxFetch, i: L.wolkvoxInterruptor, v: L.wolkvoxValor };
  const falso = crearFalso();
  process.env.WOLKVOX_ORLANT_TOKEN = TOKEN_ORL; process.env.WOLKVOX_ORLANT_SERVIDOR = 'servidorfalson3b';
  L.wolkvoxFetch = falso.fetch;
  L.wolkvoxInterruptor = async () => true;
  L.wolkvoxValor = async (e, nombre) => (nombre === 'WOLKVOX_ORLANT_AUTO_MODULOS' ? 'whatsapp' : undefined);
  try {
    require('../routes/wolkvox')._reiniciarEspera();
    const r = await request(app).post('/api/wolkvox/auto/ejecutar').set(H(admin)).send({ campana: R, modulo: 'flujo' });
    assert.equal(r.status, 409);
    assert.match(r.body.error, /«flujo» en WOLKVOX_ORLANT_AUTO_MODULOS/);
    assert.equal(falso.llamadas.length, 0);
  } finally {
    L.wolkvoxFetch = antes.f; L.wolkvoxInterruptor = antes.i; L.wolkvoxValor = antes.v;
    delete process.env.WOLKVOX_ORLANT_TOKEN; delete process.env.WOLKVOX_ORLANT_SERVIDOR;
  }
});
