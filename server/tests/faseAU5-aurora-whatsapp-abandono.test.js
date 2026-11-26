// faseAU5-aurora-whatsapp-abandono.test.js — Fase AU5 (26/11/2026, pedido del usuario): en la réplica de Aurora, el
// Tráfico de WhatsApp toma las abandonadas y el ATA de skill_1 (la consulta del Flujo: trae una fila por skill y día
// también para las skills de WhatsApp), nunca de recibidos − contestados. Sirve en los dos órdenes (Flujo antes o
// después de WhatsApp). ORLANT no cambia. Wolkvox FALSO, token y datos INVENTADOS; nunca el Aurora real.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('./helpers');
const auto = require('../wolkvox-auto');
const M = require('../wolkvox-modulos');
const AG = require('../wolkvox-agentes');
const WA = require('../wolkvox-wa-skill1');

const R = 'CLINICA AURORA PRUEBAS API';
const AU = 'CLINICA AURORA';
const ENV = { NODE_ENV: 'test', WOLKVOX_AURORA_TOKEN: 'TOKEN-FALSO-AU5-no-es-real', WOLKVOX_AURORA_SERVIDOR: 'servidorfalsoau5' };
const AHORA = new Date('2026-11-26T20:00:00Z');
const UNO = 'AGENTE INVENTADO AU5';
const ok = (cuerpo) => Promise.resolve({ status: 200, json: () => Promise.resolve(cuerpo) });
const n = (sql, ...a) => db.prepare(sql).get(...a).n;

// skill_1 de un día: LINEA DE ENTRADA, dos skills de WhatsApp de la lista y una que no es de la lista.
const skill1 = (dia) => [
  { skill_id: '4009', skill_name: 'LINEA DE ENTRADA', inbound_calls: '10', answer_calls: '9', abandon_calls: '1', asa: '0:0:12', ata: '0:0:30' },
  { skill_id: '50', skill_name: 'WHATSAPP', inbound_calls: '20', answer_calls: '17', abandon_calls: dia === '20261002' ? '3' : '1', ata: '0:2:0' },
  { skill_id: '51', skill_name: 'CONFIRMACIONES WHATSAPP', inbound_calls: '5', answer_calls: '5', abandon_calls: '0', ata: '0:0:0' },
  { skill_id: '60', skill_name: 'AREA PATOLOGIA', inbound_calls: '7', answer_calls: '6', abandon_calls: '1', ata: '0:9:9' },
];
const chat = (x) => Object.assign({ conn_id: 'c', channel: 'whatsapp', date: '2026-10-02 08:00:00', date_close: '2026-10-02 08:30:00', agent_id: '1', agent_name: UNO, skill_id: '50', first_response_time: '30', cod_act: '7', description_cod_act: 'CITA INVENTADA', customer_phone: '3000000005' }, x || {});
function falso() {
  const f = { apis: [] };
  f.fetch = (url) => {
    const u = new URL(url);
    const api = u.searchParams.get('api');
    f.apis.push(api);
    if (api === 'skill_1') return ok({ code: 200, msg: '4 records were found', data: skill1(u.searchParams.get('date_ini').slice(0, 8)) });
    if (api === 'chat_1') return ok({ code: 200, msg: '3 records were found', data: [chat(), chat({ date: '2026-10-02 09:00:00', agent_id: '0', agent_name: '' }), chat({ skill_id: '51', date: '2026-10-03 10:00:00' })] });
    return ok({ code: 200, msg: '0 records were found', data: [] });
  };
  return f;
}
const flujo = (f) => auto.correrUnaVez({ db, destino: 'aurora_replica', env: ENV, ahora: AHORA, mes: '2026-10', fetchImpl: f.fetch, franja: 'au5 ' + Math.random(), logEvent: () => {} });
const whatsapp = (f) => M.correrModulo('whatsapp', { db, destino: 'aurora_replica', env: ENV, ahora: AHORA, mes: '2026-10', fetchImpl: f.fetch, logEvent: () => {} });
const traf = () => db.prepare("SELECT colaWhatsapp, fechaInicio, totalWhatsapp, contestados, abandonados, ataSegundos FROM trafico_whatsapp WHERE campana = ? AND fechaInicio LIKE '2026-10%' ORDER BY fechaInicio, colaWhatsapp").all(R);

auto.asegurarTablas(db);
AG.guardar(db, R, { incluidos: [], agregar: [UNO] }, 'prueba');

test('lector: solo las skills de WhatsApp de la lista, con solo abandonadas y ATA', () => {
  const filas = [{ fecha: '2026-10-02', skillName: 'WHATSAPP', totalLlamadas: 20, contestadas: 17, llamadasAbandonadas: 3, ataSegundos: 120, asaSegundos: 4 },
    { fecha: '2026-10-02', skillName: 'LINEA DE ENTRADA', totalLlamadas: 10, contestadas: 9, llamadasAbandonadas: 1 },
    { fecha: '2026-10-02', skillName: 'Confirmaciones WhatsApp', totalLlamadas: 5, contestadas: 5 }];
  assert.deepEqual(WA.filasWhatsapp(filas, ['CONFIRMACIONES WHATSAPP', 'WHATSAPP']), [
    { fecha: '2026-10-02', skill: 'WHATSAPP', abandonados: 3, ataSegundos: 120 },
    { fecha: '2026-10-02', skill: 'Confirmaciones WhatsApp', abandonados: null, ataSegundos: null },
  ]);
});

test('Flujo y después WhatsApp: el Tráfico de WhatsApp lleva las abandonadas y el ATA de skill_1 (no la resta)', async () => {
  const r1 = await flujo(falso());
  assert.equal(r1.estado, 'ok', r1.detalle);
  assert.match(r1.detalle, /WhatsApp de skill_1: \d+ filas día-skill/);
  assert.equal(n("SELECT COUNT(*) n FROM calidad_nivel_servicio_diario WHERE campana = ? AND fecha LIKE '2026-10%' AND skillName <> 'LINEA DE ENTRADA'", R), 0, 'el Flujo sigue solo con LINEA DE ENTRADA');
  const r2 = await whatsapp(falso());
  assert.equal(r2.estado, 'ok', r2.detalle);
  assert.match(r2.detalle, /abandonadas y ATA de skill_1 en 2 de 2 filas día-cola/);
  assert.ok(!/abandono sin dato/.test(r2.detalle));
  const t = traf();
  const wa02 = t.find((x) => x.fechaInicio === '2026-10-02' && x.colaWhatsapp === 'WHATSAPP');
  assert.deepEqual([wa02.totalWhatsapp, wa02.contestados, wa02.abandonados, wa02.ataSegundos], [2, 1, 3, 120], 'abandonadas 3 de skill_1, no 2 − 1');
  const conf03 = t.find((x) => x.fechaInicio === '2026-10-03');
  assert.deepEqual([conf03.colaWhatsapp, conf03.abandonados, conf03.ataSegundos], ['CONFIRMACIONES WHATSAPP', 0, 0]);
  assert.equal(n("SELECT COUNT(*) n FROM wolkvox_wa_skill1_dia WHERE campana = ? AND skill = 'AREA PATOLOGIA'", R), 0, 'otras skills, nada');
});

test('WhatsApp antes que el Flujo: el Flujo completa las filas ya cargadas; sin Flujo quedan vacías', async () => {
  db.prepare("DELETE FROM wolkvox_wa_skill1_dia WHERE campana = ?").run(R);
  const r = await whatsapp(falso());
  assert.match(r.detalle, /en 0 de 2 filas día-cola \(corre el Flujo del mes para traerlas\)/);
  assert.ok(traf().every((x) => x.abandonados === null && x.ataSegundos === null), 'sin skill_1, vacío (nunca la resta)');
  const r2 = await flujo(falso());
  assert.match(r2.detalle, /2 filas de Tráfico de WhatsApp completadas/);
  assert.deepEqual(traf().map((x) => [x.fechaInicio, x.abandonados]), [['2026-10-02', 3], ['2026-10-03', 0]]);
});

test('nunca el Aurora real; ORLANT sin cambios (sigue sin abandono)', async () => {
  assert.equal(n('SELECT COUNT(*) n FROM trafico_whatsapp WHERE campana = ?', AU), 0);
  assert.equal(n('SELECT COUNT(*) n FROM wolkvox_wa_skill1_dia WHERE campana <> ?', R), 0);
  const D = require('../wolkvox-destinos');
  assert.ok(!D.DESTINOS.orlant_replica.filtros, 'ORLANT no tiene filtros: no entra en este camino');
});
