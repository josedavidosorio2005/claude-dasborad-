// faseA30-wolkvox-hueco-real.test.js — Fase A30 (20/11/2026): llenar a mano un HUECO del MOBILIZE real
// (lista cerrada HUECOS_REAL: solo julio de 2026 y solo Flujo, Flujo por hora, Tipificación y
// Abandonadas). Solo si la pestaña está vacía en el real (antes de consultar y justo antes de escribir);
// nunca toca una carga manual (tampoco el AHT de un Flujo manual); una vez por pestaña; exige
// WOLKVOX_REAL_ACTIVO=1; la cuenta de pruebas fuera; los demás meses intactos. Wolkvox FALSO, datos
// INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, tokenFor, MASTER_PASSWORD, SEED } = require('./helpers');
const auto = require('../wolkvox-auto');
const D = require('../wolkvox-destinos');
const rutaWv = require('../routes/wolkvox');
const { cargarNivelServicioDiario } = require('../nivel-servicio-diario');

const REAL = 'MOBILIZE';
const SK = 'SKILL INVENTADA A30 MAPEADA';
const ENV = { NODE_ENV: 'test', WOLKVOX_MOBILIZE_TOKEN: 'TOKEN-FALSO-A30-no-es-real-0123456789', WOLKVOX_MOBILIZE_SERVIDOR: 'servidorfalsoa30' };
const AHORA = new Date('2026-11-20T20:00:00Z');
const n = (sql, ...a) => db.prepare(sql).get(...a).n;
const ok = (cuerpo) => Promise.resolve({ status: 200, json: () => Promise.resolve(cuerpo) });
const nada = () => ok({ code: 200, msg: '0 records were found', data: [] });

const cdr = (extra) => ({ agent_id: '1001', agent_name: 'ASESORA INVENTADA A30', description_cod_act: 'VENTA INVENTADA', skill_name: SK, skill_id: '7', telephone: '3000000030', type_interaction: 'inbound', date: '2026-07-05 10:11:12', time_min: 1, time_seg: 60, cod_act: '1', hang_up: 'agent', ...extra });
const fh = (hour, inb, ans, ab) => ({ date: '20260705', hour, skill_id: '7', skill_name: SK, inbound_calls: String(inb), answer_calls: String(ans), abandon_calls: String(ab), wait_time: '0:0:10', aht: '0:3:0' });
const ab = (date) => ({ abandon_time: '00:00:41', ani: '3000000031', conn_id: 'C', customer_id: 'X', date, result: 'ABANDON', skill_id: '7', skill_name: SK, type_interaction: 'inbound' });

function crearFalso(antesDe) {
  const f = { apis: [] };
  f.fetch = (url) => {
    const api = new URL(url).searchParams.get('api');
    f.apis.push(api);
    if (antesDe && antesDe[api]) antesDe[api]();
    if (api === 'skill_1') return ok({ code: 200, msg: '1 records were found', data: [{ skill_name: SK, inbound_calls: '3', answer_calls: '2', abandon_calls: '1', service_level_20seg: '80.0 %' }] });
    if (api === 'skill_7') return ok({ code: 200, msg: '2 records were found', data: [fh(8, 2, 1, 1), fh(9, 1, 1, 0)] });
    if (api === 'cdr_1') return ok({ code: 200, msg: '2 records were found', data: [cdr(), cdr({ agent_id: '12319', agent_name: 'CUENTA DE PRUEBA INVENTADA', date: '2026-07-05 11:00:00' })] });
    if (api === 'skill_2') return ok({ code: 200, msg: '1 records were found', data: [ab('2026-07-05 10:00:00')] });
    return nada();
  };
  return f;
}
const encendido = async (e, nombre) => nombre === 'WOLKVOX_REAL_ACTIVO';
const correr = (falso, extra) => auto.rellenarHuecoReal(Object.assign({ db, env: ENV, mes: '2026-07', ahora: AHORA, fetchImpl: falso.fetch, leerInterruptor: encendido, logEvent: require('../routes/shared').logEvent }, extra || {}));

// Huella de julio del real, de los demás meses del real y de la réplica (no deben cambiar salvo julio).
const TABLAS = ['calidad_nivel_servicio_diario', 'flujo_hora', 'tipificaciones', 'encuestas', 'llamadas_no_conectadas', 'llamadas_abandonadas'];
const huella = (campana, cond) => TABLAS.map((t) => t + ':' + JSON.stringify(db.prepare('SELECT * FROM ' + t + ' WHERE campana = ? AND ' + cond + ' ORDER BY id').all(campana).map((r) => { const x = Object.assign({}, r); delete x.id; return x; }))).join('|');
const otrosMeses = () => huella(REAL, "substr(fecha, 1, 7) <> '2026-07'") + '#' + huella(D.CAMPANA_REPLICA, '1=1');
function limpiarJulio() {
  for (const t of TABLAS) db.prepare("DELETE FROM " + t + " WHERE campana = ? AND substr(fecha, 1, 7) = '2026-07'").run(REAL);
  db.prepare("DELETE FROM wolkvox_auto_corridas WHERE franja LIKE 'hueco real%'").run();
  db.prepare("DELETE FROM llamadas_no_conectadas_meses WHERE campana = ? AND mes = '2026-07'").run(REAL); // Fase A32
}
function tipificacionManual(fecha) {
  db.prepare("INSERT INTO tipificaciones (campana, canal, agente, fecha, hora, duracionMin, tipificacion, skill, archivoNombre, cargadoPorNombre, createdAt) VALUES (?, 'LLAMADAS', 'ASESOR MANUAL A30', ?, '09:00', 1, 'MANUAL A30', ?, 'manual inventado A30', 'Prueba A30', ?)").run(REAL, fecha, SK, new Date().toISOString());
}

auto.asegurarTablas(db);
const ts0 = new Date().toISOString();
db.prepare('INSERT INTO trafico_skill_mapeo (skillName, campana, sede, createdAt, updatedAt) VALUES (?, ?, NULL, ?, ?)').run(SK, REAL, ts0, ts0);
// Agosto, octubre y noviembre del real ya cargados a mano: nunca se tocan.
for (const fecha of ['2026-08-10', '2026-10-10', '2026-11-10']) {
  cargarNivelServicioDiario(db, { campana: REAL, sede: null, archivoNombre: 'manual inventado A30', cargadoPorNombre: 'Prueba A30', filas: [{ fecha, skillName: SK, totalLlamadas: 5, contestadas: 5, ahtSegundos: 111 }] });
  tipificacionManual(fecha);
}

test('lista cerrada: solo julio de 2026 y solo Flujo, Flujo por hora, Tipificación y Abandonadas', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(D.HUECOS_REAL)), { '2026-07': ['flujo', 'flujo_hora', 'cdr', 'no_conectadas', 'abandonadas'] }); // Fase A32: + no_conectadas
  assert.ok(Object.isFrozen(D.HUECOS_REAL) && Object.isFrozen(D.HUECOS_REAL['2026-07']));
  assert.equal(auto.planDe({ ahora: AHORA, mes: '2026-07', destino: 'real', huecoReal: 'flujo' })[0].dias.length, 31);
  for (const [mes, mod] of [['2026-07', 'encuesta'], ['2026-08', 'flujo'], ['2026-06', 'cdr'], ['2026-10', 'cdr'], ['2026-11', 'flujo'], ['2025-11', 'flujo']]) {
    assert.deepEqual(auto.planDe({ ahora: AHORA, mes, destino: 'real', huecoReal: mod }), [], mes + ' ' + mod);
  }
  assert.deepEqual(auto.planDe({ ahora: AHORA, mes: '2026-07', destino: 'replica', huecoReal: 'flujo' }), [], 'solo el real');
  assert.deepEqual(auto.planDe({ ahora: AHORA, mes: '2026-07', destino: 'real' }), [], 'sin hueco, el corte de 2026-11 sigue');
  assert.throws(() => D.filasEnHueco(db, '2026-08', 'flujo'), /no permitido/);
});

test('apagado, sin interruptor o mes fuera de la lista: ni una consulta ni un cambio', async () => {
  const antes = otrosMeses() + huella(REAL, "substr(fecha, 1, 7) = '2026-07'");
  const falso = crearFalso();
  assert.equal((await correr(falso, { leerInterruptor: async () => false })).estado, 'apagada');
  assert.equal((await correr(falso, { leerInterruptor: async () => { throw new Error('x'); } })).estado, 'sin_interruptor');
  for (const mes of ['2026-08', '2026-06', '2026-11', '2025-11', 'x']) assert.equal((await correr(falso, { mes })).estado, 'no_permitido', mes);
  assert.equal(falso.apis.length, 0);
  assert.equal(otrosMeses() + huella(REAL, "substr(fecha, 1, 7) = '2026-07'"), antes);
});

test('julio vacío: llena las 4 pestañas (34 consultas), cuenta de pruebas fuera, una sola vez; los demás meses intactos', async () => {
  limpiarJulio();
  const otros = otrosMeses();
  const falso = crearFalso();
  const r = await correr(falso);
  assert.equal(r.estado, 'ok', r.detalle);
  assert.equal(r.consultas, 35); // Fase A32: + cdr_5
  assert.deepEqual(falso.apis.filter((a) => a !== 'skill_1'), ['skill_7', 'cdr_1', 'cdr_5', 'skill_2'], 'Flujo y después los módulos en orden');
  assert.equal(n("SELECT COUNT(*) n FROM llamadas_no_conectadas_meses WHERE campana = ? AND mes = '2026-07' AND filas = 0", REAL), 1, 'Fase A32: julio consultado (0 no conectadas)');
  assert.equal(falso.apis.filter((a) => a === 'skill_1').length, 31);
  assert.equal(n("SELECT COUNT(*) n FROM calidad_nivel_servicio_diario WHERE campana = ? AND substr(fecha,1,7) = '2026-07'", REAL), 31);
  assert.equal(n("SELECT COUNT(*) n FROM flujo_hora WHERE campana = ? AND substr(fecha,1,7) = '2026-07'", REAL), 2);
  // El AHT/espera del Flujo (que vino entero de la API) sí se completa con skill_7.
  assert.equal(db.prepare("SELECT ahtSegundos a FROM calidad_nivel_servicio_diario WHERE campana = ? AND fecha = '2026-07-05'").get(REAL).a, 180);
  const tip = db.prepare("SELECT agente FROM tipificaciones WHERE campana = ? AND substr(fecha,1,7) = '2026-07'").all(REAL);
  assert.equal(tip.length, 1, 'la cuenta de pruebas queda fuera');
  assert.ok(!tip.some((t) => /PRUEBA/.test(t.agente)));
  assert.equal(n("SELECT COUNT(*) n FROM llamadas_abandonadas WHERE campana = ? AND substr(fecha,1,7) = '2026-07'", REAL), 1);
  assert.equal(n("SELECT COUNT(*) n FROM encuestas WHERE campana = ? AND substr(fecha,1,7) = '2026-07'", REAL), 0, 'Encuesta no está en la lista');
  assert.equal(otrosMeses(), otros, 'agosto, octubre, noviembre y la réplica no cambian');
  assert.ok(db.prepare("SELECT detalle FROM historial WHERE accion = 'WOLKVOX_MODULO' AND detalle LIKE 'Hueco del real (mes 2026-07) · MOBILIZE · cdr%'").get().detalle.includes('agent_id 12319'));
  // Segunda vez: nada (cada pestaña ya tiene datos o ya corrió).
  const julio = huella(REAL, "substr(fecha, 1, 7) = '2026-07'");
  const falso2 = crearFalso();
  const r2 = await correr(falso2);
  assert.equal(falso2.apis.length, 0);
  assert.equal(r2.consultas, 0);
  assert.equal(huella(REAL, "substr(fecha, 1, 7) = '2026-07'"), julio);
});

test('julio con carga manual en Flujo y Tipificación: esas no se tocan (ni el AHT del Flujo manual); el resto se llena', async () => {
  limpiarJulio();
  cargarNivelServicioDiario(db, { campana: REAL, sede: null, archivoNombre: 'manual inventado A30', cargadoPorNombre: 'Prueba A30', filas: [{ fecha: '2026-07-05', skillName: SK, totalLlamadas: 9, contestadas: 9, ahtSegundos: 111, waitTimeSegundos: 7 }] });
  tipificacionManual('2026-07-06');
  const flujoManual = huella(REAL, "substr(fecha, 1, 7) = '2026-07' AND archivoNombre = 'manual inventado A30'");
  const falso = crearFalso();
  const r = await correr(falso);
  assert.equal(r.estado, 'ok', r.detalle);
  assert.deepEqual(falso.apis, ['skill_7', 'cdr_5', 'skill_2'], 'Flujo y Tipificación con datos: ni se consultan');
  assert.deepEqual(r.partes.map((p) => p.modulo + ':' + p.estado), ['flujo:con_datos', 'flujo_hora:ok', 'cdr:con_datos', 'no_conectadas:ok', 'abandonadas:ok']);
  assert.equal(huella(REAL, "substr(fecha, 1, 7) = '2026-07' AND archivoNombre = 'manual inventado A30'"), flujoManual, 'Flujo y Tipificación manuales intactos');
  const f = db.prepare("SELECT ahtSegundos a, waitTimeSegundos w FROM calidad_nivel_servicio_diario WHERE campana = ? AND fecha = '2026-07-05'").get(REAL);
  assert.deepEqual([f.a, f.w], [111, 7], 'el AHT y la espera del Flujo manual no cambian');
  assert.equal(n("SELECT COUNT(*) n FROM flujo_hora WHERE campana = ? AND substr(fecha,1,7) = '2026-07'", REAL), 2);
  assert.equal(n("SELECT COUNT(*) n FROM llamadas_abandonadas WHERE campana = ? AND substr(fecha,1,7) = '2026-07'", REAL), 1);
});

test('si alguien carga la pestaña mientras se consulta, no se escribe (se vuelve a mirar justo antes)', async () => {
  limpiarJulio();
  const falso = crearFalso({ cdr_1: () => tipificacionManual('2026-07-07') });
  const r = await correr(falso);
  assert.equal(r.partes.find((p) => p.modulo === 'cdr').estado, 'ok');
  const tip = db.prepare("SELECT archivoNombre FROM tipificaciones WHERE campana = ? AND substr(fecha,1,7) = '2026-07'").all(REAL);
  assert.deepEqual(tip.map((t) => t.archivoNombre), ['manual inventado A30'], 'solo la carga manual; la API no escribió');
  assert.ok(db.prepare("SELECT detalle FROM historial WHERE accion = 'WOLKVOX_MODULO' AND detalle LIKE 'Hueco del real (mes 2026-07) · MOBILIZE · cdr%' ORDER BY id DESC").get().detalle.includes('no se toca'));
});

test('ruta: solo el administrador, solo meses de la lista, interruptor y espera de 10 min', async () => {
  rutaWv._reiniciarEspera();
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const otro = await tokenFor('crodriguez', SEED.crodriguez);
  let llamadas = 0;
  app.locals.wolkvoxFetch = () => { llamadas++; return nada(); };
  app.locals.wolkvoxInterruptor = async () => false;
  const post = (t, body) => request(app).post('/api/wolkvox/real/hueco').set(t ? { Authorization: 'Bearer ' + t } : {}).send(body);
  assert.equal((await post(null, { mes: '2026-07' })).status, 401);
  assert.equal((await post(otro, { mes: '2026-07' })).status, 403);
  assert.equal((await post(admin, { mes: '2026-08' })).status, 400);
  assert.equal((await post(admin, {})).status, 400);
  const r = await post(admin, { mes: '2026-07' });
  assert.equal(r.status, 409);
  assert.equal(r.body.codigo, 'apagada');
  assert.equal((await post(admin, { mes: '2026-07' })).status, 429, 'una vez cada 10 min');
  assert.equal(llamadas, 0);
  delete app.locals.wolkvoxFetch;
  delete app.locals.wolkvoxInterruptor;
});

test('una sola vez por pestaña: aunque julio se vacíe después, no se vuelve a consultar', async () => {
  limpiarJulio();
  await correr(crearFalso());
  for (const t of TABLAS) db.prepare("DELETE FROM " + t + " WHERE campana = ? AND substr(fecha, 1, 7) = '2026-07'").run(REAL);
  const falso = crearFalso();
  const r = await correr(falso);
  assert.equal(falso.apis.length, 0);
  assert.deepEqual(r.partes.map((p) => p.estado), ['ya_corrida', 'ya_corrida', 'ya_corrida', 'ya_corrida', 'ya_corrida']);
  assert.equal(n("SELECT COUNT(*) n FROM wolkvox_auto_corridas WHERE franja LIKE 'hueco real 2026-07 %'"), 5);
});
