// faseA8-wolkvox-cdr.test.js — llenar la réplica con la API, paso 2: cdr_1 → Tipificación (Llamadas),
// de donde salen Eficacia, contestadas únicas y conectadas de salida. Solo la réplica; los datos
// sensibles se descartan antes de guardar. Wolkvox FALSO; nombres, teléfonos y clientes INVENTADOS
// (centinelas que nunca deben quedar guardados).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('./helpers');
const M = require('../wolkvox-modulos');
const auto = require('../wolkvox-auto');

const R = 'MOBILIZE PRUEBAS API';
const ENV = { NODE_ENV: 'test', WOLKVOX_MOBILIZE_TOKEN: 'TOKEN-FALSO-A8-no-es-real-0123456789', WOLKVOX_MOBILIZE_SERVIDOR: 'servidorfalsoa8' };
const AHORA = new Date('2026-11-04T12:30:00Z'); // 04/11 07:30 Colombia: pide 1, 2 y 3
const TEL = '3000000088', CLIENTE = 'CC-INVENTADA-88', COMENTARIO = 'comentario inventado secreto', DESTINO = '6010000088';
const ok = (cuerpo) => Promise.resolve({ status: 200, json: () => Promise.resolve(cuerpo) });
function llamada(date, extra) {
  return {
    agent_id: '1001', agent_name: 'ASESORA INVENTADA A8', campaign_id: '9', cod_act: '11', cod_act_2: '', comment: COMENTARIO,
    conn_id: 'CONN-INVENTADO-88', cost: '0', customer_id: CLIENTE, date, description_cod_act: 'Venta inventada', description_cod_act_2: '',
    destiny: DESTINO, hang_up: 'agent', skill_id: '5', skill_name: 'SKILL INVENTADA A8', telephone: TEL, time_min: '2', time_seg: '120',
    type_interaction: 'inbound', ...extra,
  };
}
const porDia = {
  '20261101': [],
  '20261102': [
    llamada('2026-11-02 08:10:00'),
    llamada('2026-11-02 09:20:00'), // mismo teléfono y día: no es única
    llamada('2026-11-02 10:00:00', { telephone: '3000000099', description_cod_act: 'PRUEBA' }), // de prueba: fuera
    llamada('2026-11-02 11:00:00', { skill_name: '-', type_interaction: 'outbound_ma', telephone: '3000000077' }), // salida
  ],
  '20261103': [llamada('2026-11-03 07:59:59', { telephone: '3000000066' })],
};
function falso(mapa) {
  const f = { urls: [] };
  f.fetch = (url) => {
    f.urls.push(url);
    const d = new URL(url).searchParams.get('date_ini').slice(0, 8);
    const data = (mapa || porDia)[d] || [];
    return ok({ code: 200, msg: data.length + ' records were found', data });
  };
  return f;
}
const tip = (mes) => db.prepare("SELECT * FROM tipificaciones WHERE campana = ? AND canal = 'LLAMADAS' AND substr(fecha,1,7) = ? ORDER BY fecha, hora").all(R, mes);

test('hoja del CDR: solo las columnas que lee la plataforma; lo sensible nunca entra', () => {
  const hoja = M.hojaCdr([llamada('2026-11-02 08:10:00')]);
  assert.deepEqual(hoja[0], ['AGENT_NAME', 'DATE', 'DESCRIPTION_COD_ACT', 'SKILL_NAME', 'TIME_MIN', 'TIME_SEC', 'COD_ACT', 'TYPE_INTERACTION', 'HUNG_UP', 'SKILL_ID', 'TELEPHONE']);
  const txt = JSON.stringify(hoja);
  for (const x of [CLIENTE, COMENTARIO, DESTINO, 'CONN-INVENTADO-88']) assert.ok(!txt.includes(x), x);
  for (const c of M.CDR_DESCARTADAS) assert.ok(!hoja[0].includes(c.toUpperCase()), c);
});

test('corrida: un día por consulta, reemplaza el mes de la réplica con respaldo, únicas y salida, sin teléfonos guardados', async () => {
  // Una fila vieja del mes (día que ya no vendrá) y una de MOBILIZE real.
  const ins = db.prepare("INSERT INTO tipificaciones (campana, canal, agente, fecha, tipificacion, skill, archivoNombre, cargadoPorNombre, createdAt) VALUES (?, 'LLAMADAS', 'X', ?, 'Vieja', 'S', 'x', 'x', 'x')");
  ins.run(R, '2026-11-20');
  ins.run('MOBILIZE', '2026-11-02');
  const versiones = db.prepare('SELECT COUNT(*) n FROM cargas_versiones WHERE campana = ?').get(R).n;
  const f = falso();
  const r = await M.correrModulo('cdr', { db, env: ENV, ahora: AHORA, fetchImpl: f.fetch, franja: 'a8-1', logEvent: require('../routes/shared').logEvent });
  assert.equal(r.estado, 'ok', r.detalle);
  assert.equal(f.urls.length, 3);
  assert.deepEqual(Object.fromEntries(new URL(f.urls[1]).searchParams), { api: 'cdr_1', date_ini: '20261102000000', date_end: '20261102235959' });
  const filas = tip('2026-11');
  assert.equal(filas.length, 4, 'la de PRUEBA sale; la vieja del 20 también (mes completo)');
  assert.ok(!filas.some((x) => x.tipificacion === 'Vieja'));
  const ingreso02 = filas.filter((x) => x.fecha === '2026-11-02' && x.tipoInteraccion !== 'outbound_ma');
  assert.deepEqual(ingreso02.map((x) => [x.hora, x.unicaDia]), [['08:10:00', 1], ['09:20:00', 0]]);
  const salida = filas.find((x) => x.tipoInteraccion === 'outbound_ma');
  assert.equal(salida.unicaDia, 0);
  assert.equal(filas.find((x) => x.fecha === '2026-11-03').hora, '07:59:59');
  assert.equal(filas[0].duracionSeg, 120);
  const txt = JSON.stringify(filas);
  for (const x of [TEL, '3000000077', '3000000066', CLIENTE, COMENTARIO, DESTINO, 'CONN-INVENTADO-88']) assert.ok(!txt.includes(x), 'se guardó ' + x);
  assert.ok(db.prepare('SELECT COUNT(*) n FROM cargas_versiones WHERE campana = ?').get(R).n > versiones, 'respaldo');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM tipificaciones WHERE campana = 'MOBILIZE' AND fecha = '2026-11-02'").get().n, 1);
  const h = db.prepare("SELECT detalle FROM historial WHERE accion = 'WOLKVOX_MODULO' ORDER BY id DESC LIMIT 1").get().detalle;
  assert.match(h, /cdr \(cdr_1\) · 2026-11: 4 llamadas \(1 de salida, 2 únicas de ingreso, 1 de prueba fuera\), reemplazó 1, con respaldo · 3 consultas/);
  for (const x of [TEL, 'ASESORA INVENTADA', CLIENTE]) assert.ok(!h.includes(x));
});

test('falla a mitad de mes o columnas que faltan: el mes no cambia y no reintenta', async () => {
  const antes = tip('2026-11');
  let k = 0;
  const caido = (url) => { k++; return k === 2 ? Promise.reject(Object.assign(new Error('x'), { cause: { code: 'ECONNRESET' } })) : falso().fetch(url); };
  const r = await M.correrModulo('cdr', { db, env: ENV, ahora: AHORA, fetchImpl: caido, franja: 'a8-2' });
  assert.equal(r.error, 'red');
  assert.equal(k, 2);
  const raro = falso({ '20261102': [{ agente: 'x', fecha: 'y' }] });
  const r2 = await M.correrModulo('cdr', { db, env: ENV, ahora: AHORA, fetchImpl: raro.fetch, franja: 'a8-3' });
  assert.equal(r2.error, 'respuesta_invalida');
  assert.match(r2.detalle, /campos: agente,fecha/);
  const vacio = await M.correrModulo('cdr', { db, env: ENV, ahora: AHORA, fetchImpl: falso({}).fetch, franja: 'a8-4' });
  assert.match(vacio.detalle, /Wolkvox no trajo llamadas, sin cambios/);
  assert.deepEqual(tip('2026-11'), antes);
});

test('apagado por defecto; con «cdr» en WOLKVOX_AUTO_MODULOS el programador lo corre', async () => {
  const apis = [];
  const fetchImpl = (url) => { apis.push(new URL(url).searchParams.get('api')); return ok({ code: 200, msg: '0 records were found', data: [] }); };
  const correr = async (valor, reloj) => {
    const p = auto.iniciar(db, { env: ENV, reloj: () => new Date(reloj), leerInterruptor: async () => false, leerValor: async (e, n) => (n === 'WOLKVOX_AUTO_MODULOS' ? valor : undefined), fetchImpl, cadaMs: 3600 * 1000 });
    try { await p.tick(); } finally { p.detener(); }
  };
  await correr('flujo_hora', '2026-11-04T18:05:00Z');
  assert.deepEqual(apis, ['skill_7']);
  apis.length = 0;
  await correr('cdr', '2026-11-05T12:05:00Z'); // 05/11: pide 1 a 4
  assert.deepEqual(apis, ['cdr_1', 'cdr_1', 'cdr_1', 'cdr_1']);
});
