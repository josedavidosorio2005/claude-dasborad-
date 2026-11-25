// faseQA-wolkvox-cambio-mes.test.js — Revisión del 25/11/2026: la corrida del 01/12 a las 00:05 (hora de
// Colombia), la primera del mes, de punta a punta con el programador real (iniciar/tick). Con la réplica y el
// MOBILIZE real encendidos y los 5 módulos de cada uno:
//   - cierra noviembre completo (30 días) en los dos, con respaldo, y no pide ni escribe nada de diciembre;
//   - gasta 35 consultas por destino (30 de skill_1, un día por consulta, + 1 por módulo): 70 en total;
//   - el real no toca octubre (corte de la Fase A29) y reemplaza el noviembre manual;
//   - la franja de las 7:00 del mismo día vuelve a cerrar noviembre igual (sin duplicar filas).
// Wolkvox FALSO; skills, asesoras, teléfonos e IDs INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('./helpers');
const auto = require('../wolkvox-auto');
const wv = require('../wolkvox');
const { cargarNivelServicioDiario } = require('../nivel-servicio-diario');
const { logEvent } = require('../routes/shared');

const REAL = 'MOBILIZE', REP = 'MOBILIZE PRUEBAS API';
const SK = 'SKILL INVENTADA CAMBIO MES';
const MODULOS = 'flujo_hora,cdr,encuesta,no_conectadas,abandonadas';
const ENV = {
  NODE_ENV: 'test', WOLKVOX_MOBILIZE_TOKEN: 'TOKEN-FALSO-CAMBIO-MES-no-es-real-0123456789', WOLKVOX_MOBILIZE_SERVIDOR: 'servidorfalsocm',
  WOLKVOX_AUTO_ACTIVO: '1', WOLKVOX_AUTO_MODULOS: MODULOS, WOLKVOX_REAL_ACTIVO: '1', WOLKVOX_REAL_MODULOS: MODULOS,
};
const MEDIANOCHE = new Date('2026-12-01T05:05:30Z'); // 01/12 00:05 Colombia
const SIETE = new Date('2026-12-01T12:00:30Z'); // 01/12 07:00 Colombia
const TABLAS = ['calidad_nivel_servicio_diario', 'flujo_hora', 'tipificaciones', 'encuestas', 'llamadas_no_conectadas', 'llamadas_abandonadas'];

const n = (sql, ...a) => db.prepare(sql).get(...a).n;
const ok = (data) => Promise.resolve({ status: 200, json: () => Promise.resolve({ code: 200, msg: data.length + ' records were found', data }) });
// Días AAAA-MM-DD entre date_ini y date_end (AAAAMMDDhhmmss).
function dias(ini, fin) {
  const out = [];
  const d = new Date(Date.UTC(+ini.slice(0, 4), +ini.slice(4, 6) - 1, +ini.slice(6, 8)));
  const f = Date.UTC(+fin.slice(0, 4), +fin.slice(4, 6) - 1, +fin.slice(6, 8));
  for (; d.getTime() <= f; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
}
let k = 0;
function filaDe(api, dia) {
  k++;
  const tel = '300' + String(1000000 + k).slice(-7);
  const base = { skill_id: '5', skill_name: SK, agent_id: '4001', agent_name: 'ASESORA INVENTADA CM', conn_id: 'CM-CONN-' + k, customer_id: 'CC-INVENTADA-CM', telephone: tel };
  if (api === 'skill_7') return { date: dia.replace(/-/g, ''), hour: '9', skill_id: '5', skill_name: SK, inbound_calls: '3', answer_calls: '3', abandon_calls: '0', wait_time: '0:0:10', aht: '0:3:0', service_level_20seg: '100 %' };
  if (api === 'cdr_1') return { ...base, campaign_id: '9', cod_act: '11', cod_act_2: '', comment: 'comentario inventado', cost: '0', date: dia + ' 09:00:00', description_cod_act: 'Venta inventada', description_cod_act_2: '', destiny: '6010000000', hang_up: 'agent', time_min: '2', time_seg: '120', type_interaction: 'inbound' };
  if (api === 'diagram_4') return { ...base, agent_dni: 'DNI-INVENTADO-CM', ani: tel, date: dia, feeling: 'neutral', q01: '9', q02: '5', q03: '1', q04: '4', result: 'ok', time: '09:10:00', type_interaction: 'inbound', voice_message: 'inventado', voice_message_duration: '5' };
  if (api === 'cdr_5') return { ...base, campaign_id: '9', date: dia + ' 10:00:00', destiny: '6010000000', result: 'NO ANSWER', ring_time: '30', type_interaction: 'outbound_ma' };
  if (api === 'skill_2') return { abandon_time: '00:00:41', ani: tel, conn_id: 'CM-AB-' + k, customer_id: 'CC-INVENTADA-CM', date: dia + ' 11:00:00', result: 'ABANDON', skill_id: '5', skill_name: SK, type_interaction: 'inbound' };
  throw new Error('api no esperada: ' + api);
}
function crearFalso() {
  const f = { pedidos: [] };
  f.fetch = (url) => {
    const p = new URL(url).searchParams;
    const api = p.get('api'), ini = p.get('date_ini'), fin = p.get('date_end');
    f.pedidos.push({ api, ini, fin });
    if (api === 'skill_1') {
      assert.equal(ini.slice(0, 8), fin.slice(0, 8), 'skill_1: un día por consulta');
      return ok([{ skill_name: SK, inbound_calls: '9', answer_calls: '8', abandon_calls: '1', service_level_20seg: '80.0 %', asa: '0:0:10', ata: '0:1:0' }]);
    }
    return ok(dias(ini, fin).map((d) => filaDe(api, d)));
  };
  return f;
}
async function tick(ahora, falso) {
  const p = auto.iniciar(db, { reloj: () => ahora, cadaMs: 3600 * 1000, env: ENV, fetchImpl: falso.fetch, logEvent });
  try { return await p.tick(); } finally { p.detener(); }
}
const porMes = (tabla, campana, prefijo) => n('SELECT COUNT(*) n FROM ' + tabla + ' WHERE campana = ? AND fecha LIKE ?', campana, prefijo + '%');
const diasDistintos = (tabla, campana) => n("SELECT COUNT(DISTINCT substr(fecha,1,10)) n FROM " + tabla + " WHERE campana = ? AND fecha LIKE '2026-11%'", campana);
const foto = () => JSON.stringify(TABLAS.map((t) => [t, porMes(t, REP, '2026-11'), porMes(t, REAL, '2026-11')]));

auto.asegurarTablas(db);
// El real tiene octubre (antes del corte: nunca se toca) y un día de noviembre cargados a mano.
cargarNivelServicioDiario(db, { campana: REAL, sede: null, archivoNombre: 'manual inventado oct', cargadoPorNombre: 'Prueba', filas: [{ fecha: '2026-10-15', skillName: SK, totalLlamadas: 5, contestadas: 5 }] });
cargarNivelServicioDiario(db, { campana: REAL, sede: null, archivoNombre: 'manual inventado nov', cargadoPorNombre: 'Prueba', filas: [{ fecha: '2026-11-20', skillName: SK, totalLlamadas: 7, contestadas: 7 }] });
const ts = new Date().toISOString();
db.prepare('INSERT INTO trafico_skill_mapeo (skillName, campana, sede, createdAt, updatedAt) VALUES (?, ?, NULL, ?, ?)').run(SK, REAL, ts, ts);

test('plan del 01/12: a las 00:05 y a las 7:00 cierra noviembre completo; diciembre todavía no tiene días', () => {
  assert.equal(auto.franjaActual(MEDIANOCHE), '2026-12-01 00');
  assert.equal(auto.franjaActual(SIETE), '2026-12-01 07');
  for (const destino of ['replica', 'real']) {
    for (const ahora of [MEDIANOCHE, SIETE]) {
      const plan = auto.planDe({ ahora, destino });
      assert.deepEqual(plan.map((m) => [m.mes, m.dias.length, m.dias[0], m.dias[m.dias.length - 1]]), [['2026-11', 30, '2026-11-01', '2026-11-30']], destino);
    }
  }
});

test('01/12 00:05: réplica y real cierran noviembre (30 días) con respaldo, 70 consultas y nada de diciembre', async () => {
  const octubre0 = JSON.stringify(db.prepare("SELECT fecha, totalLlamadas FROM calidad_nivel_servicio_diario WHERE campana = ? AND fecha LIKE '2026-10%'").all(REAL));
  const falso = crearFalso();
  await tick(MEDIANOCHE, falso);

  // Consultas: 2 destinos × (30 de skill_1 + 5 módulos), todas de noviembre.
  const cuenta = {};
  for (const p of falso.pedidos) cuenta[p.api] = (cuenta[p.api] || 0) + 1;
  assert.deepEqual(cuenta, { skill_1: 60, skill_7: 2, cdr_1: 2, diagram_4: 2, cdr_5: 2, skill_2: 2 });
  assert.ok(falso.pedidos.every((p) => p.ini.startsWith('202611') && p.fin.startsWith('202611')), 'ninguna consulta pide diciembre');
  for (const p of falso.pedidos.filter((x) => x.api !== 'skill_1')) assert.deepEqual([p.ini, p.fin], ['20261101000000', '20261130235959'], p.api + ': el mes completo');
  assert.equal(wv.usoDelDia(db, auto.OPERACION, MEDIANOCHE), 70, 'uso del día');

  // Corridas: las 12 (Flujo + 5 módulos, réplica y real) quedan «ok».
  const corridas = db.prepare("SELECT franja, estado FROM wolkvox_auto_corridas WHERE franja LIKE '2026-12-01 00%' ORDER BY franja").all();
  assert.equal(corridas.length, 12, JSON.stringify(corridas));
  assert.ok(corridas.every((c) => c.estado === 'ok'), JSON.stringify(corridas));

  // Datos: noviembre con sus 30 días en las 6 tablas, en los dos destinos; diciembre vacío.
  for (const c of [REP, REAL]) {
    for (const t of TABLAS) {
      assert.equal(diasDistintos(t, c), 30, c + ' · ' + t + ': los 30 días de noviembre');
      assert.equal(porMes(t, c, '2026-12'), 0, c + ' · ' + t + ': nada de diciembre');
    }
  }
  assert.equal(porMes('calidad_nivel_servicio_diario', REAL, '2026-11'), 30, 'el día manual del 20/11 se reemplazó, sin duplicar');
  assert.equal(n("SELECT COUNT(*) n FROM calidad_nivel_servicio_diario WHERE campana = ? AND archivoNombre = 'manual inventado nov'", REAL), 0);

  // Respaldo antes de reemplazar noviembre del real; octubre del real intacto; nada respaldado de diciembre.
  assert.ok(n("SELECT COUNT(*) n FROM cargas_versiones WHERE campana = ? AND mes = '2026-11'", REAL) >= 1, 'respaldo de noviembre del real');
  assert.equal(n("SELECT COUNT(*) n FROM cargas_versiones WHERE mes = '2026-12'"), 0);
  assert.equal(JSON.stringify(db.prepare("SELECT fecha, totalLlamadas FROM calidad_nivel_servicio_diario WHERE campana = ? AND fecha LIKE '2026-10%'").all(REAL)), octubre0, 'octubre del real intacto');

  // Historial: el Flujo de cada destino dice «2026-11: 30 días».
  for (const c of [REP, REAL]) {
    const h = db.prepare("SELECT detalle FROM historial WHERE accion = 'WOLKVOX_AUTO' AND detalle LIKE ? ORDER BY id DESC").get(c + ' · skill_1 · 2026-11: 30 días%');
    assert.ok(h, c + ': historial del Flujo con 30 días');
  }
});

test('01/12 7:00: vuelve a cerrar noviembre igual (mismas filas, sin duplicar) y 00:05 no se repite', async () => {
  const antes = foto();
  const r1 = crearFalso();
  await tick(MEDIANOCHE, r1);
  assert.equal(r1.pedidos.length, 0, 'la franja de las 00:05 ya corrió: no consulta otra vez');
  const r2 = crearFalso();
  await tick(SIETE, r2);
  assert.equal(r2.pedidos.length, 70);
  assert.equal(foto(), antes, 'mismas filas por tabla y destino');
  for (const t of TABLAS) assert.equal(porMes(t, REAL, '2026-12') + porMes(t, REP, '2026-12'), 0, t);
  assert.equal(wv.usoDelDia(db, auto.OPERACION, SIETE), 140);
});
