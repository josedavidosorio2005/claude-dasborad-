// faseA19-wolkvox-abandonadas.test.js — llenar la réplica con la API: skill_2 → Llamadas únicas,
// abandonadas. Solo la réplica; el teléfono (ANI) solo sirve en memoria para la clave día+teléfono
// y nunca se guarda, ni CONN_ID, cliente o tiempo de abandono. Wolkvox FALSO; datos INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('./helpers');
const M = require('../wolkvox-modulos');

const R = 'MOBILIZE'; // Fase W10: antes la réplica «MOBILIZE PRUEBAS API» (borrada); ahora el destino real
const ENV = { NODE_ENV: 'test', WOLKVOX_MOBILIZE_TOKEN: 'TOKEN-FALSO-A19-no-es-real-0123456789', WOLKVOX_MOBILIZE_SERVIDOR: 'servidorfalsoa19' };
const AHORA = new Date('2026-11-19T20:30:00Z');
const TEL = '3000000191', TEL2 = '3000000192', CLIENTE = 'CC-INVENTADA-191', CONN = 'CONN-INVENTADO-191';
const ab = (date, extra) => ({ abandon_time: '00:00:41', ani: TEL, conn_id: CONN, customer_id: CLIENTE, date, result: 'ABANDON', skill_id: '77', skill_name: 'SKILL INVENTADA A19', type_interaction: 'inbound', ...extra });
const DATA = [
  ab('2026-11-14 14:07:31'),
  ab('2026-11-14 16:40:02'), // mismo día y teléfono: repetida
  ab('2026-11-15 09:00:00'), // mismo teléfono, otro día: cuenta
  ab('2026-11-15 10:00:00', { ani: TEL2 }),
  ab('2026-11-16 11:00:00', { ani: TEL2, result: 'ANSWER' }), // no es abandono
];
function falso(data) {
  const f = { urls: [] };
  f.fetch = (url) => { f.urls.push(url); return Promise.resolve({ status: 200, json: () => Promise.resolve({ code: 200, msg: data.length + ' records were found', data }) }); };
  return f;
}

test('hoja de abandonadas: sin CONN_ID, cliente, skill_id ni tiempo de abandono', () => {
  const h = M.hojaAbandonadas(DATA);
  assert.deepEqual(h[0], ['DATE', 'ANI', 'SKILL_NAME', 'RESULT', 'TYPE_INTERACTION']);
  const txt = JSON.stringify(h);
  for (const x of [CLIENTE, CONN, '00:00:41']) assert.ok(!txt.includes(x), x);
});

test('corrida: una consulta del mes, únicas por día+teléfono, reemplaza el mes de la réplica con respaldo; nada sensible; MOBILIZE real intacto', async () => {
  const ins = db.prepare("INSERT INTO llamadas_abandonadas (campana, fecha, skill, archivoNombre, cargadoPorNombre, createdAt) VALUES (?, ?, 'X', 'x', 'x', 'x')");
  ins.run(R, '2026-11-28'); // vieja del mes: sale (mes completo)
  ins.run(R, '2026-10-30'); // otro mes: se queda
  ins.run('ORLANT', '2026-11-14');
  const versiones = db.prepare('SELECT COUNT(*) n FROM cargas_versiones WHERE campana = ?').get(R).n;
  const f = falso(DATA);
  const r = await M.correrModulo('abandonadas', { db, destino: 'real', env: ENV, ahora: AHORA, fetchImpl: f.fetch, franja: 'a19-1' });
  assert.equal(r.estado, 'ok', r.detalle);
  assert.equal(f.urls.length, 1);
  const u = new URL(f.urls[0]);
  assert.equal(u.searchParams.get('api'), 'skill_2');
  assert.equal(u.searchParams.get('date_ini'), '20261101000000');
  assert.equal(u.searchParams.get('date_end'), '20261118235959');
  const filas = db.prepare("SELECT * FROM llamadas_abandonadas WHERE campana = ? AND fecha LIKE '2026-11%' ORDER BY fecha").all(R);
  assert.deepEqual(filas.map((x) => [x.fecha, x.skill]), [['2026-11-14', 'SKILL INVENTADA A19'], ['2026-11-15', 'SKILL INVENTADA A19'], ['2026-11-15', 'SKILL INVENTADA A19']]);
  const txt = JSON.stringify(db.prepare('SELECT * FROM llamadas_abandonadas WHERE campana = ?').all(R)) + r.detalle;
  for (const x of [TEL, TEL2, CLIENTE, CONN]) assert.ok(!txt.includes(x), 'se guardó ' + x);
  assert.match(r.detalle, /5 filas → 3 abandonadas únicas \(1 repetidas día\+teléfono, 1 avisos; reemplazó 1, con respaldo\)/);
  assert.ok(db.prepare('SELECT COUNT(*) n FROM cargas_versiones WHERE campana = ?').get(R).n > versiones, 'respaldo');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM llamadas_abandonadas WHERE campana = ? AND fecha = '2026-10-30'").get(R).n, 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM llamadas_abandonadas WHERE campana = 'ORLANT'").get().n, 1);
});

test('sin abandonadas válidas o sin filas: el mes no cambia y no es error', async () => {
  const antes = db.prepare('SELECT COUNT(*) n FROM llamadas_abandonadas WHERE campana = ?').get(R).n;
  const r1 = await M.correrModulo('abandonadas', { db, destino: 'real', env: ENV, ahora: AHORA, fetchImpl: falso([ab('2026-11-14 10:00:00', { result: 'ANSWER' })]).fetch, franja: 'a19-2' });
  assert.equal(r1.estado, 'ok', r1.detalle);
  assert.match(r1.detalle, /0 abandonadas válidas/);
  const r2 = await M.correrModulo('abandonadas', { db, destino: 'real', env: ENV, ahora: AHORA, fetchImpl: falso([]).fetch, franja: 'a19-3' });
  assert.equal(r2.estado, 'ok', r2.detalle);
  assert.match(r2.detalle, /no trajo abandonadas, sin cambios/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM llamadas_abandonadas WHERE campana = ?').get(R).n, antes);
});

test('una fila de otro mes: error, el mes no cambia', async () => {
  const antes = db.prepare('SELECT COUNT(*) n FROM llamadas_abandonadas WHERE campana = ?').get(R).n;
  const r = await M.correrModulo('abandonadas', { db, destino: 'real', env: ENV, ahora: AHORA, fetchImpl: falso([ab('2026-10-14 10:00:00')]).fetch, franja: 'a19-4' });
  assert.equal(r.estado, 'error');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM llamadas_abandonadas WHERE campana = ?').get(R).n, antes);
});

test('el módulo está en la lista y arranca apagado', () => {
  assert.equal(M.MODULOS.abandonadas.api, 'skill_2');
  assert.deepEqual(M.modulosDe('flujo_hora,cdr,encuesta,no_conectadas'), ['flujo_hora', 'cdr', 'encuesta', 'no_conectadas']);
  assert.deepEqual(M.modulosDe('flujo_hora,cdr,encuesta,no_conectadas,abandonadas'), ['flujo_hora', 'cdr', 'encuesta', 'no_conectadas', 'abandonadas']);
});
