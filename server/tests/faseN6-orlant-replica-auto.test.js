// faseN6-orlant-replica-auto.test.js — Fase N6 (autorización escrita del usuario, 23/11/2026):
// consulta automática de la réplica «ORLANT PRUEBAS API», APAGADA hasta WOLKVOX_ORLANT_AUTO_ACTIVO=1,
// solo Flujo (skill_1), Flujo por hora (skill_7), Tipificación (cdr_1) y No conectadas (cdr_5), con
// el token y el contador de ORLANT, nunca el ORLANT real; y el mapa de skills a línea, editable por el
// administrador. Wolkvox FALSO y datos INVENTADOS; nunca sale a la red.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { db, app, request, tokenFor, MASTER_PASSWORD } = require('./helpers');
const auto = require('../wolkvox-auto');
const M = require('../wolkvox-modulos');
const D = require('../wolkvox-destinos');
const wv = require('../wolkvox');
const skillLinea = require('../skill-linea');
const front = require('../../public/js/orlant-tablero.js');

const R = 'ORLANT PRUEBAS API';
const SK = 'SKILL INVENTADA N6 3P';
const TOKEN_ORL = 'TOKEN-FALSO-N6-ORLANT-no-es-real';
const TOKEN_MOB = 'TOKEN-FALSO-N6-MOBILIZE-no-es-real';
const ENV = { NODE_ENV: 'test', WOLKVOX_ORLANT_TOKEN: TOKEN_ORL, WOLKVOX_ORLANT_SERVIDOR: 'servidorfalson6', WOLKVOX_MOBILIZE_TOKEN: TOKEN_MOB, WOLKVOX_MOBILIZE_SERVIDOR: 'servidorfalsomob6' };
const H = (t) => ({ Authorization: 'Bearer ' + t });
const n = (sql, ...a) => db.prepare(sql).get(...a).n;
const ok = (cuerpo) => Promise.resolve({ status: 200, json: () => Promise.resolve(cuerpo) });

const cdr = (extra) => ({ agent_id: '12319', agent_name: 'ASESORA INVENTADA N6', description_cod_act: 'CITA INVENTADA', skill_name: SK, skill_id: '9', telephone: '3000000066', customer_id: 'CLIENTE-INVENTADO', comment: 'COMENTARIO INVENTADO', type_interaction: 'inbound', date: '2026-11-02 10:11:12', time_min: 1, time_seg: 60, cod_act: '1', hang_up: 'agent', ...extra });
const fh = (hour) => ({ date: '20261102', hour, skill_id: '9', skill_name: SK, inbound_calls: '2', answer_calls: '2', abandon_calls: '0', wait_time: '0:0:10', aht: '0:3:0' });
function crearFalso() {
  const f = { llamadas: [] };
  f.fetch = (url, opts) => {
    const u = new URL(url);
    const api = u.searchParams.get('api');
    f.llamadas.push({ api, host: u.hostname, token: opts && opts.headers && opts.headers['wolkvox-token'] });
    if (api === 'skill_1') return ok({ code: 200, msg: '1 records were found', data: [{ skill_name: SK, inbound_calls: '3', answer_calls: '2', abandon_calls: '1', service_level_20seg: '80.0 %' }] });
    if (api === 'skill_7') return ok({ code: 200, msg: '1 records were found', data: [fh(8)] });
    // agent_id 12319 es la cuenta de pruebas de MOBILIZE: en ORLANT NO se quita (puede ser otra persona).
    if (api === 'cdr_1') return ok({ code: 200, msg: '2 records were found', data: [cdr(), cdr({ agent_name: 'OTRA ASESORA INVENTADA N6', date: '2026-11-03 09:00:00', description_cod_act: '' })] });
    return ok({ code: 200, msg: '0 records were found', data: [] });
  };
  return f;
}
// 05/11/2026 07:05 Colombia: pide del 1 al 4 de noviembre (los lectores rechazan fechas futuras).
const AHORA = new Date('2026-11-05T12:05:00Z');
async function tick(env, falso) {
  const p = auto.iniciar(db, { reloj: () => AHORA, cadaMs: 3600 * 1000, env, fetchImpl: falso.fetch, logEvent: require('../routes/shared').logEvent });
  try { return await p.tick(); } finally { p.detener(); }
}
function huellaOrlantReal() {
  return ['calidad_nivel_servicio_diario', 'flujo_hora', 'tipificaciones', 'llamadas_no_conectadas'].map((t) => t + ':' + n('SELECT COUNT(*) n FROM ' + t + ' WHERE campana = ?', 'ORLANT')).join(' ');
}
auto.asegurarTablas(db);
let admin;
before(async () => { admin = await tokenFor('admin', MASTER_PASSWORD); });

test('destinos: la réplica de ORLANT es interna, de la operación ORLANT y con módulos cerrados', () => {
  const d = D.DESTINOS.orlant_replica;
  assert.equal(d.campana, R);
  assert.equal(d.operacion, 'ORLANT');
  assert.equal(d.interna, true);
  assert.equal(d.interruptor, 'WOLKVOX_ORLANT_AUTO_ACTIVO');
  assert.equal(d.modulos, 'WOLKVOX_ORLANT_AUTO_MODULOS');
  for (const m of ['flujo', 'flujo_hora', 'cdr', 'no_conectadas']) assert.equal(D.moduloPermitido(d, m), true, m);
  for (const m of ['encuesta', 'abandonadas']) assert.equal(D.moduloPermitido(d, m), false, m + ' no está autorizado para ORLANT');
  assert.equal(D.destinoInterno(R), d);
  assert.equal(D.destinoInterno('ORLANT'), null, 'nunca el ORLANT real');
  assert.equal(D.destinoInterno('MOBILIZE'), null);
  assert.equal(D.destinoInterno('MOBILIZE PRUEBAS API'), D.DESTINOS.replica);
  assert.equal(D.campanaLista(db, d), true, 'la réplica existe (migración N5) y es interna');
});

test('programador APAGADO (sin WOLKVOX_ORLANT_AUTO_ACTIVO, o con otro valor que «1»): ni una consulta ni rastro', async () => {
  for (const valor of [undefined, '0', 'true', ' 1x']) {
    const falso = crearFalso();
    const env = Object.assign({}, ENV, valor === undefined ? {} : { WOLKVOX_ORLANT_AUTO_ACTIVO: valor }, { WOLKVOX_ORLANT_AUTO_MODULOS: 'cdr,flujo_hora' });
    const antes = n("SELECT COUNT(*) n FROM wolkvox_auto_corridas WHERE franja LIKE '% orlant%'");
    db.prepare("DELETE FROM wolkvox_auto_corridas WHERE franja = '2026-11-05 07'").run();
    await tick(env, falso);
    assert.equal(falso.llamadas.length, 0, 'valor ' + valor);
    assert.equal(n("SELECT COUNT(*) n FROM wolkvox_auto_corridas WHERE franja LIKE '% orlant%'"), antes);
  }
});

test('programador ENCENDIDO: Flujo + módulos autorizados, con el token de ORLANT, solo en la réplica; ni encuesta ni abandonadas; MOBILIZE apagado intacto', async () => {
  const falso = crearFalso();
  const realAntes = huellaOrlantReal();
  const usoMob = wv.usoDelDia(db, 'MOBILIZE', AHORA);
  const usoOrl = wv.usoDelDia(db, 'ORLANT', AHORA);
  db.prepare("DELETE FROM wolkvox_auto_corridas WHERE franja LIKE '2026-11-05 07%'").run();
  await tick(Object.assign({}, ENV, { WOLKVOX_ORLANT_AUTO_ACTIVO: '1', WOLKVOX_ORLANT_AUTO_MODULOS: 'encuesta,cdr,abandonadas,flujo_hora,nada' }), falso);
  const apis = falso.llamadas.map((x) => x.api);
  assert.deepEqual(apis, ['skill_1', 'skill_1', 'skill_1', 'skill_1', 'skill_7', 'cdr_1'], 'Flujo (1–4/11) y después flujo_hora y cdr; encuesta y abandonadas nunca');
  assert.ok(falso.llamadas.every((x) => x.token === TOKEN_ORL && x.host === 'servidorfalson6.wolkvox.com'), 'siempre el token y el servidor de ORLANT');
  // Escribió en la réplica de ORLANT, nunca en el ORLANT real.
  assert.equal(n("SELECT COUNT(*) n FROM calidad_nivel_servicio_diario WHERE campana = ? AND fecha LIKE '2026-11%'", R), 4);
  assert.equal(n("SELECT COUNT(*) n FROM flujo_hora WHERE campana = ? AND fecha LIKE '2026-11%'", R), 1);
  assert.equal(huellaOrlantReal(), realAntes);
  // CDR como la carga manual de ORLANT: la fila del agent_id 12319 se queda; la que no trae tipificación
  // no se convierte en «Otros_motivos» (eso es de MOBILIZE).
  const tip = db.prepare("SELECT tipificacion FROM tipificaciones WHERE campana = ? AND fecha LIKE '2026-11%' AND canal = 'LLAMADAS'").all(R).map((r) => r.tipificacion);
  assert.ok(tip.includes('CITA INVENTADA'), JSON.stringify(tip));
  assert.ok(!tip.includes('Otros_motivos'));
  // Ningún dato sensible guardado en ninguna columna de la réplica.
  const txt = JSON.stringify(db.prepare('SELECT * FROM tipificaciones WHERE campana = ?').all(R));
  for (const x of ['3000000066', 'CLIENTE-INVENTADO', 'COMENTARIO INVENTADO']) assert.ok(!txt.includes(x), x);
  // Contadores: el de ORLANT sube 6; el de MOBILIZE no cambia.
  assert.equal(wv.usoDelDia(db, 'ORLANT', AHORA), usoOrl + 6);
  assert.equal(wv.usoDelDia(db, 'MOBILIZE', AHORA), usoMob);
  // Historial: solo la réplica de ORLANT, sin token ni servidor.
  const h = db.prepare("SELECT detalle FROM historial WHERE accion IN ('WOLKVOX_AUTO', 'WOLKVOX_MODULO') AND detalle LIKE ? ORDER BY id").all('%' + R + ' ·%').map((r) => r.detalle).join('\n');
  assert.match(h, /ORLANT PRUEBAS API · skill_1/);
  assert.ok(!h.includes(TOKEN_ORL) && !h.includes('servidorfalson6'));
});

test('«Ejecutar ahora»: la réplica de ORLANT exige SU interruptor; módulos no autorizados rechazados; un destino real, nunca', async () => {
  const falso = crearFalso();
  const base = { db, env: ENV, ahora: AHORA, fetchImpl: falso.fetch, logEvent: () => {} };
  assert.equal((await auto.ejecutarAhora(Object.assign({}, base, { destino: 'orlant_replica', leerInterruptor: async () => false }))).estado, 'apagada');
  const leidos = [];
  const encendido = async (e, nombre) => { leidos.push(nombre); return nombre === 'WOLKVOX_ORLANT_AUTO_ACTIVO'; };
  assert.equal((await auto.ejecutarAhora(Object.assign({}, base, { destino: 'orlant_replica', modulo: 'encuesta', leerInterruptor: encendido }))).estado, 'no_permitido');
  assert.equal((await auto.ejecutarAhora(Object.assign({}, base, { destino: 'orlant_replica', modulo: 'abandonadas', leerInterruptor: encendido }))).estado, 'no_permitido');
  assert.deepEqual([...new Set(leidos)], ['WOLKVOX_ORLANT_AUTO_ACTIVO'], 'lee el interruptor de ORLANT, no el de MOBILIZE');
  assert.equal((await auto.ejecutarAhora(Object.assign({}, base, { destino: 'real', leerInterruptor: async () => true }))).estado, 'no_permitido');
  assert.equal(falso.llamadas.length, 0);
  // correrModulo directo con un módulo no autorizado: se omite sin consultar.
  const r = await M.correrModulo('encuesta', Object.assign({}, base, { destino: 'orlant_replica', franja: 'prueba n6 directo' }));
  assert.equal(r.estado, 'omitida');
  assert.equal(falso.llamadas.length, 0);
});

test('ruta «Ejecutar ahora»: módulo no autorizado para ORLANT da 400; el ORLANT real 404', async () => {
  process.env.WOLKVOX_ORLANT_TOKEN = TOKEN_ORL; process.env.WOLKVOX_ORLANT_SERVIDOR = 'servidorfalson6';
  try {
    require('../routes/wolkvox')._reiniciarEspera();
    const r = await request(app).post('/api/wolkvox/auto/ejecutar').set(H(admin)).send({ campana: R, modulo: 'encuesta' });
    assert.equal(r.status, 400);
    const real = await request(app).post('/api/wolkvox/auto/ejecutar').set(H(admin)).send({ campana: 'ORLANT' });
    assert.equal(real.status, 404);
  } finally { delete process.env.WOLKVOX_ORLANT_TOKEN; delete process.env.WOLKVOX_ORLANT_SERVIDOR; }
});

test('perfil del CDR: ORLANT sin teléfono, sin opciones y sin «Otros_motivos»; MOBILIZE igual que antes', () => {
  const o = M.perfilCdr('orlant_replica');
  assert.equal(o.opciones(), undefined);
  const hoja = M.hojaCdr([cdr()], o);
  assert.ok(!hoja[0].includes('TELEPHONE'));
  assert.ok(!JSON.stringify(hoja).includes('3000000066'));
  const m = M.perfilCdr('replica');
  assert.deepEqual(m.opciones(), M.opcionesCdrMobilize());
  assert.ok(M.hojaCdr([cdr()])[0].includes('TELEPHONE'), 'MOBILIZE sigue leyendo el teléfono en memoria (únicas del día)');
  assert.equal(M.hojaCdr([cdr({ description_cod_act: '' })])[1][2], 'Otros_motivos');
  assert.equal(M.hojaCdr([cdr({ description_cod_act: '' })], o)[1][2], '');
  // La cuenta de pruebas de MOBILIZE: se quita en MOBILIZE, no en ORLANT.
  assert.equal(M.quitarCuentasPrueba([cdr()], 'replica').quitadas, 1);
  assert.equal(M.quitarCuentasPrueba([cdr()], 'orlant_replica').quitadas, 0);
  assert.equal(M.quitarCuentasPrueba([cdr()]).quitadas, 1, 'sin destino: como siempre');
});

test('estado de la réplica de ORLANT: su interruptor, sus módulos y su última corrida (no la de MOBILIZE)', () => {
  const e = auto.estado(db, { WOLKVOX_ORLANT_AUTO_ACTIVO: '0' }, 'orlant_replica');
  assert.equal(e.campana, R);
  assert.equal(e.interruptor, 'WOLKVOX_ORLANT_AUTO_ACTIVO');
  assert.deepEqual(e.modulosPermitidos, ['flujo_hora', 'cdr', 'no_conectadas']);
  assert.equal(e.activoAlArrancar, false);
  assert.ok(!e.ultimaCorrida || e.ultimaCorrida.detalle.includes(R));
  assert.ok(auto.estado(db).real, 'el de MOBILIZE sigue igual');
});

// ── Mapa de skills a línea ──
test('mapa de skills: sin definir hasta que se guarda; la réplica usa el de ORLANT; valida línea y nombre', () => {
  const ts = new Date().toISOString();
  db.prepare("INSERT INTO calidad_nivel_servicio_diario (campana, fecha, skillName, totalLlamadas, contestadas, createdAt) VALUES ('ORLANT', '2026-10-01', 'CALL INBOUND ORLANT GENERAL', 5, 5, ?)").run(ts);
  const l = skillLinea.listar(db, 'ORLANT');
  assert.equal(l.campana, 'ORLANT');
  assert.ok(l.replicas.includes(R));
  const gen = l.skills.find((s) => s.skill === 'CALL INBOUND ORLANT GENERAL');
  assert.equal(gen.linea, null, 'nunca se aplica la propuesta sola');
  assert.equal(gen.propuesta, 'GENERAL');
  assert.ok(gen.diasManual >= 1);
  const deApi = l.skills.find((s) => s.skill === SK);
  assert.ok(deApi && deApi.diasApi >= 1 && deApi.propuesta === '3P', 'los skills de la réplica también aparecen');
  const g = skillLinea.guardar(db, 'ORLANT', [{ skill: 'CALL INBOUND ORLANT GENERAL', linea: 'GENERAL' }, { skill: '  SKILL   NUEVO N6 ', linea: 'NO_CUENTA' }], 'Prueba N6');
  assert.deepEqual([g.guardados, g.quitados], [2, 0]);
  assert.equal(skillLinea.mapa(db, R).get('CALL INBOUND ORLANT GENERAL'), 'GENERAL', 'la réplica lee el mapa de ORLANT');
  assert.equal(skillLinea.mapa(db, 'ORLANT').get('SKILL NUEVO N6'), 'NO_CUENTA', 'espacios normalizados');
  assert.equal(skillLinea.guardar(db, 'ORLANT', [{ skill: 'SKILL NUEVO N6', linea: null }], 'Prueba N6').quitados, 1);
  assert.throws(() => skillLinea.guardar(db, 'ORLANT', [{ skill: 'X', linea: 'OTRA' }]), /Línea no válida/);
  assert.throws(() => skillLinea.guardar(db, 'ORLANT', [{ skill: '', linea: '3P' }]), /no válido/);
  assert.throws(() => skillLinea.guardar(db, 'ORLANT', []), /de 1 a 500/);
  assert.throws(() => skillLinea.guardar(db, 'MOBILIZE', [{ skill: 'X', linea: '3P' }]), /no tiene mapa/);
  assert.equal(skillLinea.listar(db, 'MOBILIZE'), null);
});

test('rutas del mapa: el administrador lee y guarda (queda en el Historial); un 400 claro con datos malos', async () => {
  const g = await request(app).get('/api/orlant/skills-linea').set(H(admin));
  assert.equal(g.status, 200);
  assert.ok(Array.isArray(g.body.skills));
  const p = await request(app).put('/api/orlant/skills-linea').set(H(admin)).send({ cambios: [{ skill: SK, linea: '3P' }] });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.equal(p.body.skills.find((s) => s.skill === SK).linea, '3P');
  const h = db.prepare("SELECT detalle FROM historial WHERE accion = 'SKILL_LINEA' ORDER BY id DESC").get();
  assert.match(h.detalle, /^ORLANT · mapa de skills a línea · 1 guardados/);
  const mal = await request(app).put('/api/orlant/skills-linea').set(H(admin)).send({ cambios: [{ skill: SK, linea: 'LINEA RARA' }] });
  assert.equal(mal.status, 400);
});

test('pantalla del mapa: «Sin definir» por defecto, cambios marcados y contados; agregar a mano no elige línea', () => {
  const m = { skills: [{ skill: 'A GENERAL', linea: null, propuesta: 'GENERAL', diasManual: 3, diasApi: 0 }, { skill: 'B', linea: '3P', propuesta: null, diasManual: 0, diasApi: 2 }] };
  const html = front.otSkillsHtml(m, {});
  assert.match(html, /1 de 2 sin definir/);
  assert.match(html, /Guardar \(sin cambios\)/);
  assert.match(html, /<label for="ot-sk-0">A GENERAL<\/label>/);
  assert.match(html, /id="ot-sk-0" data-ot-skill="A GENERAL"><option value="" selected>Sin definir/);
  const conCambio = front.otSkillsHtml(m, { 'A GENERAL': 'GENERAL' });
  assert.match(conCambio, /Guardar 1 cambio/);
  assert.match(conCambio, /class="ot-sk-cambiado"/);
  assert.match(conCambio, /0 de 2 sin definir/);
  const xss = front.otSkillsHtml({ skills: [{ skill: '<img src=x onerror=alert(1)>', linea: null, propuesta: null, diasManual: 1, diasApi: 0 }] }, {});
  assert.ok(!xss.includes('<img'), 'el nombre se escapa');
});
