// faseAU2-aurora-replica-auto.test.js — Fase AU2 (autorización escrita del usuario, 26/11/2026, CLAUDE.md): consulta
// automática de la réplica «CLINICA AURORA PRUEBAS API» (operación AURORA), APAGADA hasta WOLKVOX_AURORA_AUTO_ACTIVO=1,
// con la lista WOLKVOX_AURORA_AUTO_MODULOS (flujo, cdr, whatsapp) y el mapeo de Edwin: Flujo solo LINEA DE ENTRADA;
// CDR solo LINEA DE ENTRADA y «-» y solo los agentes de Inconexión elegidos; WhatsApp solo 3 skills (tráfico sin
// filtro de agente; Tipificación con filtro). Nunca el Aurora real. Wolkvox FALSO, token y datos INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { db, app, request, tokenFor, MASTER_PASSWORD } = require('./helpers');
const auto = require('../wolkvox-auto');
const D = require('../wolkvox-destinos');
const wv = require('../wolkvox');
const AG = require('../wolkvox-agentes');

const R = 'CLINICA AURORA PRUEBAS API';
const AU = 'CLINICA AURORA';
const TOKEN = 'TOKEN-FALSO-AU2-AURORA-no-es-real';
const ENV = { NODE_ENV: 'test', WOLKVOX_AURORA_TOKEN: TOKEN, WOLKVOX_AURORA_SERVIDOR: 'servidorfalsoau2' };
const ENC = Object.assign({}, ENV, { WOLKVOX_AURORA_AUTO_ACTIVO: '1', WOLKVOX_AURORA_AUTO_MODULOS: 'flujo,cdr,whatsapp' });
const H = (t) => ({ Authorization: 'Bearer ' + t });
const n = (sql, ...a) => db.prepare(sql).get(...a).n;
const ok = (cuerpo) => Promise.resolve({ status: 200, json: () => Promise.resolve(cuerpo) });
const UNO = 'AGENTE INVENTADO UNO', DOS = 'AGENTE INVENTADO DOS';
const TEL = '3009998877', CLIENTE = 'PACIENTE INVENTADO AU2', NOTA = 'COMENTARIO INVENTADO AU2';

function crearFalso() {
  const f = { llamadas: [] };
  f.fetch = (url, opts) => {
    const u = new URL(url);
    const api = u.searchParams.get('api');
    f.llamadas.push({ api, token: opts && opts.headers && opts.headers['wolkvox-token'] });
    if (api === 'skill_1') return ok({ code: 200, msg: '4 records were found', data: [
      { skill_id: '4009', skill_name: 'LINEA DE ENTRADA', inbound_calls: '10', answer_calls: '9', abandon_calls: '1', service_level_20seg: '90.0 %' },
      { skill_id: '50', skill_name: 'WHATSAPP', inbound_calls: '0', answer_calls: '0', abandon_calls: '0' },
      { skill_id: '51', skill_name: 'CONFIRMACIONES WHATSAPP', inbound_calls: '0', answer_calls: '0', abandon_calls: '0' },
      { skill_id: '60', skill_name: 'AREA PATOLOGIA', inbound_calls: '7', answer_calls: '7', abandon_calls: '0' },
    ] });
    const cdr = (x) => Object.assign({ agent_id: '1', agent_name: UNO, description_cod_act: 'CITA INVENTADA', skill_name: 'LINEA DE ENTRADA', skill_id: '4009', telephone: TEL, customer_id: CLIENTE, comment: NOTA, type_interaction: 'inbound', date: '2026-11-02 10:11:12', time_min: 1, time_seg: 60, cod_act: '1', hang_up: 'agent' }, x);
    if (api === 'cdr_1') return ok({ code: 200, msg: '4 records were found', data: [
      cdr(), cdr({ skill_name: 'AREA PATOLOGIA', skill_id: '60' }), cdr({ type_interaction: 'outbound_ma', skill_name: '', skill_id: '', date: '2026-11-03 09:00:00', description_cod_act: 'LLAMADA DE SALIDA INVENTADA' }), cdr({ agent_name: DOS }),
    ] });
    const chat = (x) => Object.assign({ conn_id: 'c1', channel: 'whatsapp', date: '2026-11-02 08:00:00', date_close: '2026-11-02 08:30:00', customer_name: CLIENTE, customer_phone: TEL, customer_email: 'x@inventado.test', comment: NOTA, comments: NOTA, extra_field: NOTA, agent_id: '1', agent_name: UNO, skill_id: '50', first_response_time: '30', cod_act: '7', description_cod_act: 'CONFIRMA CITA INVENTADA' }, x);
    if (api === 'chat_1') return ok({ code: 200, msg: '4 records were found', data: [
      chat(), chat({ skill_id: '51', agent_id: '0', agent_name: '' }), chat({ skill_id: '60' }), chat({ agent_name: DOS, skill_id: '51' }),
    ] });
    return ok({ code: 200, msg: '0 records were found', data: [] });
  };
  return f;
}
// 05/11/2026 07:05 Colombia → pide del 1 al 4 de noviembre.
async function tick(env, falso, iso) {
  const p = auto.iniciar(db, { reloj: () => new Date(iso || '2026-11-05T12:05:00Z'), cadaMs: 3600 * 1000, env, fetchImpl: falso.fetch, logEvent: require('../routes/shared').logEvent });
  try { return await p.tick(); } finally { p.detener(); }
}
function huellaReal() {
  return ['calidad_nivel_servicio_diario', 'tipificaciones', 'trafico_whatsapp', 'whatsapp_tiempos'].map((t) => t + ':' + n('SELECT COUNT(*) n FROM ' + t + ' WHERE campana = ?', AU)).join(' ');
}
auto.asegurarTablas(db);
let admin;
before(async () => { admin = await tokenFor('admin', MASTER_PASSWORD); });

test('destino: réplica interna de Aurora, operación AURORA, apagada, con su lista y los filtros de Edwin; nunca el real', () => {
  const d = D.DESTINOS.aurora_replica;
  assert.equal(d.campana, R);
  assert.equal(d.operacion, 'AURORA');
  assert.equal(d.interna, true);
  assert.equal(d.interruptor, 'WOLKVOX_AURORA_AUTO_ACTIVO');
  assert.equal(d.modulos, 'WOLKVOX_AURORA_AUTO_MODULOS');
  assert.equal(d.flujoPorModulos, true);
  for (const m of ['flujo', 'cdr', 'whatsapp']) assert.equal(D.moduloPermitido(d, m), true, m);
  for (const m of ['flujo_hora', 'encuesta', 'no_conectadas', 'abandonadas']) assert.equal(D.moduloPermitido(d, m), false, m);
  assert.deepEqual([...d.filtros.flujoSkills], ['LINEA DE ENTRADA']);
  assert.deepEqual([...d.filtros.cdrSkills], ['LINEA DE ENTRADA', '-']);
  assert.deepEqual([...d.filtros.waSkills], ['CONFIRMACIONES WHATSAPP', 'RECORDACIONES 3 DIAS', 'WHATSAPP']);
  assert.equal(D.destinoInterno(R), d);
  assert.equal(D.destinoInterno(AU), null, 'nunca el Aurora real');
  assert.ok(D.CAMPANAS_PERMITIDAS.includes(R) && !D.CAMPANAS_PERMITIDAS.includes(AU));
  assert.equal(D.campanaLista(db, d), true, 'la réplica existe (migración AU1) y es interna');
});

test('programador APAGADO (sin interruptor, o con otro valor): ni una consulta', async () => {
  for (const v of [undefined, '0', 'true']) {
    const f = crearFalso();
    await tick(Object.assign({}, ENV, v === undefined ? {} : { WOLKVOX_AURORA_AUTO_ACTIVO: v }, { WOLKVOX_AURORA_AUTO_MODULOS: 'flujo,cdr,whatsapp' }), f, '2026-11-05T12:05:00Z');
    assert.equal(f.llamadas.length, 0, String(v));
    db.prepare("DELETE FROM wolkvox_auto_corridas WHERE franja LIKE '2026-11-05 07%'").run();
  }
});

test('ENCENDIDO sin agentes elegidos: Flujo solo LINEA DE ENTRADA; tráfico de WhatsApp de los 3 skills; Tipificación no se escribe y los agentes quedan vistos', async () => {
  const real = huellaReal();
  const usoMob = wv.usoDelDia(db, 'MOBILIZE', new Date('2026-11-05T12:05:00Z'));
  const f = crearFalso();
  await tick(ENC, f, '2026-11-05T12:05:00Z');
  assert.deepEqual(f.llamadas.map((x) => x.api), ['skill_1', 'skill_1', 'skill_1', 'skill_1', 'cdr_1', 'chat_1']);
  assert.ok(f.llamadas.every((x) => x.token === TOKEN), 'siempre el token de Aurora');
  // Flujo: 4 días × solo LINEA DE ENTRADA (AREA PATOLOGIA fuera; WhatsApp sin llamadas).
  assert.equal(n("SELECT COUNT(*) n FROM calidad_nivel_servicio_diario WHERE campana = ? AND fecha LIKE '2026-11%'", R), 4);
  assert.equal(n("SELECT COUNT(*) n FROM calidad_nivel_servicio_diario WHERE campana = ? AND skillName <> 'LINEA DE ENTRADA'", R), 0);
  // Tráfico de WhatsApp: los chats de los skills 50 y 51 (con y sin agente), no el 60.
  const tr = db.prepare('SELECT colaWhatsapp, SUM(totalWhatsapp) t FROM trafico_whatsapp WHERE campana = ? GROUP BY colaWhatsapp ORDER BY colaWhatsapp').all(R);
  assert.deepEqual(tr.map((r) => [r.colaWhatsapp, r.t]), [['CONFIRMACIONES WHATSAPP', 2], ['WHATSAPP', 1]]);
  // Sin agentes elegidos: ninguna Tipificación; los agentes vistos quedan anotados (sin elegir).
  assert.equal(n('SELECT COUNT(*) n FROM tipificaciones WHERE campana = ?', R), 0);
  assert.deepEqual(AG.listar(db, R).map((a) => [a.nombre, a.incluido]), [[DOS, false], [UNO, false]]);
  const h = db.prepare("SELECT detalle FROM historial WHERE accion IN ('WOLKVOX_AUTO', 'WOLKVOX_MODULO') AND detalle LIKE ? ORDER BY id").all('%' + R + ' ·%').map((r) => r.detalle).join('\n');
  assert.match(h, /ninguno elegido como de Inconexión/);
  assert.match(h, /tipificación: 2 agentes vistos y ninguno elegido, sin escribir/);
  // Nada en el Aurora real, nada en el contador de MOBILIZE.
  assert.equal(huellaReal(), real);
  assert.equal(wv.usoDelDia(db, 'MOBILIZE', new Date('2026-11-05T12:05:00Z')), usoMob);
});

test('con el agente UNO elegido: Tipificación de llamadas (entrada + salida) y de WhatsApp solo de UNO; sin datos sensibles', async () => {
  const g = await request(app).put('/api/wolkvox/agentes').set(H(admin)).send({ campana: R, incluidos: [UNO] });
  assert.equal(g.status, 200, JSON.stringify(g.body));
  assert.equal(g.body.incluidos, 1);
  const f = crearFalso();
  await tick(ENC, f, '2026-11-05T18:05:00Z'); // 13:05, otra franja
  const tl = db.prepare("SELECT agente, skill, tipificacion FROM tipificaciones WHERE campana = ? AND canal = 'LLAMADAS' ORDER BY fecha").all(R);
  assert.equal(tl.length, 2, JSON.stringify(tl));
  assert.ok(tl.every((t) => t.agente === UNO));
  assert.deepEqual(tl.map((t) => t.skill), ['LINEA DE ENTRADA', 'LLAMADAS DE SALIDA'], 'entrada y la salida («-», que el lector guarda como en ORLANT); AREA PATOLOGIA fuera');
  const tw = db.prepare("SELECT agente, skill, tipificacion FROM tipificaciones WHERE campana = ? AND canal = 'WHATSAPP'").all(R);
  assert.deepEqual(tw.map((t) => [t.agente, t.skill]), [[UNO, 'WHATSAPP']], 'el de DOS y el sin agente fuera; el skill 60 fuera');
  // Ningún dato sensible guardado en la réplica.
  const txt = JSON.stringify([db.prepare('SELECT * FROM tipificaciones WHERE campana = ?').all(R), db.prepare('SELECT * FROM trafico_whatsapp WHERE campana = ?').all(R), db.prepare('SELECT * FROM whatsapp_tiempos WHERE campana = ?').all(R)]);
  for (const x of [TEL, CLIENTE, NOTA, 'x@inventado.test']) assert.ok(!txt.includes(x), x);
});

test('rutas de agentes: solo el administrador; solo la réplica de Aurora; datos malos dan 400; queda en el Historial', async () => {
  const sup = await (async () => {
    const r = await request(app).post('/api/users').set(H(admin)).send({ nombre: 'Persona Ficticia au2', user: 'supau2', password: 'Clave#FaseAU2xy', rol: 'SUPERVISOR', perms: { campana_ORLANT: true } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return tokenFor('supau2', 'Clave#FaseAU2xy');
  })();
  assert.equal((await request(app).get('/api/wolkvox/agentes').query({ campana: R }).set(H(sup))).status, 403);
  assert.equal((await request(app).put('/api/wolkvox/agentes').set(H(sup)).send({ campana: R, incluidos: [] })).status, 403);
  assert.equal((await request(app).get('/api/wolkvox/agentes').query({ campana: 'ORLANT PRUEBAS API' }).set(H(admin))).status, 404, 'ORLANT no tiene lista');
  assert.equal((await request(app).get('/api/wolkvox/agentes').query({ campana: AU }).set(H(admin))).status, 404, 'el Aurora real no');
  assert.equal((await request(app).put('/api/wolkvox/agentes').set(H(admin)).send({ campana: R, incluidos: 'UNO' })).status, 400);
  assert.equal((await request(app).put('/api/wolkvox/agentes').set(H(admin)).send({ campana: R, incluidos: [''] })).status, 400);
  const a = await request(app).put('/api/wolkvox/agentes').set(H(admin)).send({ campana: R, incluidos: [UNO], agregar: ['AGENTE AGREGADO A MANO'] });
  assert.equal(a.status, 200);
  assert.deepEqual(a.body.agentes.filter((x) => x.incluido).map((x) => x.nombre).sort(), ['AGENTE AGREGADO A MANO', UNO]);
  const l = await request(app).get('/api/wolkvox/agentes').query({ campana: R }).set(H(admin));
  assert.equal(l.status, 200);
  assert.equal(l.body.agentes.length, 3);
  assert.match(db.prepare("SELECT detalle FROM historial WHERE accion = 'WOLKVOX_AGENTES' ORDER BY id DESC").get().detalle, /CLINICA AURORA PRUEBAS API · 2 de 3 agentes elegidos/);
});

test('estado: la réplica de Aurora tiene consulta automática (apagada) y lista de agentes; la de ORLANT no tiene lista', async () => {
  process.env.WOLKVOX_AURORA_SERVIDOR = 'servidorfalsoau2';
  try {
    const r = await request(app).get('/api/wolkvox/estado').query({ campana: R }).set(H(admin));
    assert.equal(r.status, 200);
    assert.equal(r.body.autoDisponible, true);
    assert.equal(r.body.agentesDisponible, true);
    assert.equal(r.body.auto.interruptor, 'WOLKVOX_AURORA_AUTO_ACTIVO');
    assert.equal(r.body.auto.activoAlArrancar, false);
    const o = await request(app).get('/api/wolkvox/estado').query({ campana: 'ORLANT PRUEBAS API' }).set(H(admin));
    assert.equal(o.body.agentesDisponible, false);
  } finally { delete process.env.WOLKVOX_AURORA_SERVIDOR; }
});

test('sin el mapa de skills (Flujo apagado y sin «Skills de WhatsApp»): WhatsApp no escribe y lo dice', async () => {
  db.prepare('DELETE FROM wolkvox_skills_vistas WHERE operacion = ?').run('AURORA');
  const antes = n('SELECT COUNT(*) n FROM trafico_whatsapp WHERE campana = ?', R);
  const f = crearFalso();
  await tick(Object.assign({}, ENV, { WOLKVOX_AURORA_AUTO_ACTIVO: '1', WOLKVOX_AURORA_AUTO_MODULOS: 'whatsapp' }), f, '2026-11-06T12:05:00Z');
  assert.deepEqual(f.llamadas.map((x) => x.api), ['chat_1'], 'solo WhatsApp: sin Flujo');
  assert.equal(n('SELECT COUNT(*) n FROM trafico_whatsapp WHERE campana = ?', R), antes);
  const h = db.prepare("SELECT detalle FROM historial WHERE accion = 'WOLKVOX_MODULO' AND detalle LIKE ? ORDER BY id DESC").get('%' + R + ' ·%').detalle;
  assert.match(h, /no se conoce el skill_id de CONFIRMACIONES WHATSAPP, RECORDACIONES 3 DIAS, WHATSAPP/);
});

test('pantalla: filas de agentes (vistos + agregados, sin repetir, por nombre)', () => {
  const W = require('../../public/js/wolkvox-prueba.js');
  assert.deepEqual(W.wvAgentesFilas([{ nombre: 'B', incluido: true }, { nombre: 'A', incluido: false }], ['C', 'b']),
    [{ nombre: 'A', incluido: false, nuevo: false }, { nombre: 'B', incluido: true, nuevo: false }, { nombre: 'C', incluido: true, nuevo: true }]);
});
