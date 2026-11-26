// faseW9-retirar-replica-mobilize.test.js — Fase W9 (pedido del usuario, 26/11/2026): se retira la
// réplica «MOBILIZE PRUEBAS API». En SSM quedan WOLKVOX_AUTO_ACTIVO=0 y WOLKVOX_AUTO_MODULOS=ninguno;
// la migración solo la saca de los tableros (dashboard = 0) SIN borrar nada. El MOBILIZE real sigue
// igual: con WOLKVOX_REAL_ACTIVO=1 corre UNA vez por franja, también si la app se reinicia en la misma hora.
// Wolkvox FALSO, token y datos INVENTADOS; nunca sale a la red.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { db, app, request, tokenFor, MASTER_PASSWORD } = require('./helpers');
const dbMod = require('../db');
const auto = require('../wolkvox-auto');
const reg = require('../clientes-registro');

const R = 'MOBILIZE PRUEBAS API';
const REAL = 'MOBILIZE';
const SKILL = 'SKILL INVENTADA W9';
const TOKEN = 'TOKEN-FALSO-W9-no-es-real-0123456789';
// Como queda SSM después del cambio del usuario (26/11).
const ENV = {
  NODE_ENV: 'test', WOLKVOX_MOBILIZE_TOKEN: TOKEN, WOLKVOX_MOBILIZE_SERVIDOR: 'servidorfalsow9',
  WOLKVOX_AUTO_ACTIVO: '0', WOLKVOX_AUTO_MODULOS: 'ninguno', WOLKVOX_REAL_ACTIVO: '1', WOLKVOX_REAL_MODULOS: 'flujo_hora',
};
const H = (t) => ({ Authorization: 'Bearer ' + t });
const n = (sql, ...a) => db.prepare(sql).get(...a).n;
const ok = (cuerpo) => Promise.resolve({ status: 200, json: () => Promise.resolve(cuerpo) });
function crearFalso() {
  const f = { apis: [] };
  f.fetch = (url) => {
    const api = new URL(url).searchParams.get('api');
    f.apis.push(api);
    if (api === 'skill_1') return ok({ code: 200, msg: '1 records were found', data: [{ skill_name: SKILL, inbound_calls: '5', answer_calls: '4', abandon_calls: '1', service_level_20seg: '80.0 %' }] });
    return ok({ code: 200, msg: '0 records were found', data: [] });
  };
  return f;
}
// Una «instancia» nueva del programador en cada llamada: así se simula un reinicio de la app.
async function tick(ahora, falso) {
  const p = auto.iniciar(db, { reloj: () => ahora, cadaMs: 3600 * 1000, env: ENV, fetchImpl: falso.fetch, logEvent: () => {} });
  try { return await p.tick(); } finally { p.detener(); }
}
function huellaReplica() {
  return ['calidad_nivel_servicio_diario', 'flujo_hora', 'tipificaciones', 'encuestas', 'llamadas_no_conectadas', 'llamadas_abandonadas']
    .map((t) => t + ':' + n('SELECT COUNT(*) n FROM ' + t + ' WHERE campana = ?', R)).join(' ');
}
auto.asegurarTablas(db);
const ts = new Date().toISOString();
db.prepare('INSERT INTO trafico_skill_mapeo (skillName, campana, sede, createdAt, updatedAt) VALUES (?, ?, NULL, ?, ?)').run(SKILL, REAL, ts, ts);
let admin;
before(async () => { admin = await tokenFor('admin', MASTER_PASSWORD); });

test('migración: la réplica sale de los tableros (dashboard = 0) sin borrar nada; sigue interna; idempotente', () => {
  const fila = () => db.prepare('SELECT * FROM clientes_registro WHERE nombre = ?').get(R);
  const f = fila();
  assert.ok(f, 'la fila del registro sigue');
  assert.equal(f.dashboard, 0);
  assert.equal(JSON.parse(f.parametros).interno, true, 'sigue interna');
  assert.ok(db.prepare('SELECT 1 FROM dashboards_config WHERE cliente = ? AND activo = 1').get(R), 'su tablero sigue guardado');
  assert.ok(!reg.listaClientes(db).includes(R), 'fuera de las tarjetas de tableros');
  assert.ok(reg.listaClientes(db).includes(REAL), 'el MOBILIZE real sigue');
  const antes = JSON.stringify([fila(), db.prepare('SELECT * FROM clientes_registro WHERE nombre = ?').get(REAL), db.prepare('SELECT * FROM dashboards_config WHERE cliente = ?').get(R)]);
  dbMod.retirarReplicaMobilizeApi();
  assert.equal(JSON.stringify([fila(), db.prepare('SELECT * FROM clientes_registro WHERE nombre = ?').get(REAL), db.prepare('SELECT * FROM dashboards_config WHERE cliente = ?').get(R)]), antes, 'correrla otra vez no cambia nada');
});

test('réplica en 0 y real en 1: el real corre UNA vez por franja (aunque la app se reinicie en la misma hora); la réplica nada', async () => {
  const replicaAntes = huellaReplica();
  // 05/11/2026 07:05 Colombia: el real pide del 1 al 4 de noviembre (4 skill_1) y su Flujo por hora (1 skill_7).
  const ahora = new Date('2026-11-05T12:05:00Z');
  const f1 = crearFalso();
  await tick(ahora, f1);
  assert.deepEqual(f1.apis, ['skill_1', 'skill_1', 'skill_1', 'skill_1', 'skill_7'], 'solo el real: Flujo y Flujo por hora');
  assert.equal(n("SELECT COUNT(*) n FROM calidad_nivel_servicio_diario WHERE campana = ? AND fecha LIKE '2026-11%'", REAL), 4, 'el Flujo del real quedó');
  // La réplica no corrió: ni su franja, ni datos nuevos.
  assert.equal(n("SELECT COUNT(*) n FROM wolkvox_auto_corridas WHERE franja = '2026-11-05 07'"), 0, 'sin la franja de la réplica');
  assert.equal(n("SELECT COUNT(*) n FROM wolkvox_auto_corridas WHERE franja LIKE '2026-11-05 07 real%'"), 2, 'el Flujo y el Flujo por hora del real');
  assert.equal(huellaReplica(), replicaAntes);
  // «Reinicio» en la misma hora (07:40): ni una consulta más.
  const f2 = crearFalso();
  await tick(new Date('2026-11-05T12:40:00Z'), f2);
  assert.deepEqual(f2.apis, [], 'la misma franja no se repite');
  // La franja siguiente (13:00) sí corre, otra vez una sola vez.
  const f3 = crearFalso();
  await tick(new Date('2026-11-05T18:05:00Z'), f3);
  assert.deepEqual(f3.apis, ['skill_1', 'skill_1', 'skill_1', 'skill_1', 'skill_7']);
  const f4 = crearFalso();
  await tick(new Date('2026-11-05T18:30:00Z'), f4);
  assert.deepEqual(f4.apis, []);
  assert.equal(huellaReplica(), replicaAntes);
});

test('el administrador sigue revisando el real por /wolkvox/estado (la réplica sigue interna)', async () => {
  const r = await request(app).get('/api/wolkvox/estado').query({ campana: R }).set(H(admin));
  assert.equal(r.status, 200);
  assert.equal(r.body.auto.real.campana, REAL);
  assert.equal(r.body.auto.real.interruptor, 'WOLKVOX_REAL_ACTIVO');
  assert.ok(!JSON.stringify(r.body).includes(TOKEN));
});
