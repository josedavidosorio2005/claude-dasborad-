// faseA33-encuesta-conn-id-real.test.js — Fase A33 (autorización escrita del usuario, 24/11/2026): la Encuesta
// (diagram_4) del MOBILIZE REAL guarda el CONN_ID (solo el ID de la llamada) para que Calidad de encuestas
// enlace las mal calificadas con sus monitoreos. Teléfono, comentarios y demás datos se siguen descartando;
// la réplica sigue sin CONN_ID. Wolkvox FALSO; IDs, teléfonos, nombres y respuestas INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('./helpers');
const M = require('../wolkvox-modulos');
const E = require('../encuesta-monitoreo');

const REAL = 'MOBILIZE', REP = 'MOBILIZE PRUEBAS API';
const ENV = { NODE_ENV: 'test', WOLKVOX_MOBILIZE_TOKEN: 'TOKEN-FALSO-A33-no-es-real-0123456789', WOLKVOX_MOBILIZE_SERVIDOR: 'servidorfalsoa33' };
const AHORA = new Date('2026-11-05T12:30:00Z');
const ANI = '3000000333', DNI = 'DNI-INVENTADO-333', CLIENTE = 'CC-INVENTADA-333', COMENTARIO = 'comentario inventado secreto 333';
function enc(conn, date, q01, extra) {
  return Object.assign({
    agent_dni: DNI, agent_id: '2033', agent_name: 'ASESORA INVENTADA A33', ani: ANI, conn_id: conn, customer_id: CLIENTE, date, feeling: 'neutral',
    q01, q02: '5', q03: '1', q04: '4', q05: '-', q06: '-', q07: '-', q08: '-', q09: '-', q10: '-', result: 'ok', skill_id: '5',
    skill_name: 'SKILL INVENTADA A33', time: '09:10:00', type_interaction: 'inbound', voice_message: COMENTARIO, voice_message_duration: '12',
  }, extra || {});
}
// Formatos de ID posibles en la API: texto, número y con espacios. Dos mal calificadas (q01 = 2) y una bien.
const DATA = [enc('A33-CONN-0001', '2026-11-02', '2'), enc(900000333, '2026-11-03', '1'), enc('  A33-CONN-0003 ', '2026-11-04', '10')];
function falso(data) {
  const f = { urls: [] };
  f.fetch = (url) => { f.urls.push(url); return Promise.resolve({ status: 200, json: () => Promise.resolve({ code: 200, msg: data.length + ' records were found', data }) }); };
  return f;
}
const filas = (c) => db.prepare('SELECT fecha, connId, telefono, comentario FROM encuestas WHERE campana = ? ORDER BY fecha').all(c);
// Monitoreos guardados ANTES, cuando noviembre venía del archivo manual (el ID a veces con una comilla adelante).
function monitoreo(conn, fecha) {
  db.prepare("INSERT INTO monitoreos (campana, asesor, fecha, mes, evaluador, answers, createdAt, origen, encuestaConnId) VALUES ('MOBILIZE', 'ASESORA INVENTADA A33', ?, '2026-11', 'Evaluador inventado', '{}', 'x', 'encuesta', ?)")
    .run(fecha, conn);
}

test('A33: la hoja trae CONN_ID solo cuando se pide (el real); nunca teléfono, documento, cliente ni comentario', () => {
  const sin = M.hojaEncuesta(DATA);
  assert.deepEqual(sin[0], ['AGENT_NAME', 'SKILL_NAME', 'DATE', 'Q01', 'Q02', 'Q03', 'Q04']);
  assert.ok(!JSON.stringify(sin).includes('A33-CONN'));
  const con = M.hojaEncuesta(DATA, true);
  assert.deepEqual(con[0], ['AGENT_NAME', 'SKILL_NAME', 'DATE', 'Q01', 'Q02', 'Q03', 'Q04', 'CONN_ID']);
  assert.deepEqual(con.slice(1).map((r) => r[7]), ['A33-CONN-0001', '900000333', 'A33-CONN-0003']);
  const txt = JSON.stringify(con);
  for (const x of [ANI, DNI, CLIENTE, COMENTARIO]) assert.ok(!txt.includes(x), x);
});

test('A33: solo el destino real tiene encuestaConnId', () => {
  const D = require('../wolkvox-destinos');
  assert.equal(D.destino('real').encuestaConnId, true);
  assert.equal(D.destino('orlant_replica').encuestaConnId, false);
  assert.equal(D.DESTINOS.orlant_replica.encuestaConnId, false);
});

test('A33: la corrida del real guarda el CONN_ID (sin teléfono ni comentarios); la réplica sigue sin él', async () => {
  // Noviembre del real venía del archivo manual: 2 encuestas mal calificadas, con su monitoreo (IDs con comilla adelante y número como texto).
  const ins = db.prepare("INSERT INTO encuestas (campana, fecha, agente, skill, q1, q2, q3, q4, comentario, connId, hora, telefono, archivoNombre, cargadoPorNombre, createdAt) VALUES ('MOBILIZE', ?, 'ASESORA INVENTADA A33', 'SKILL INVENTADA A33', 2, 5, 1, 4, 'comentario del archivo', ?, '09:10', ?, 'archivo manual', 'x', 'x')");
  ins.run('2026-11-02', "'A33-CONN-0001", '3000000999');
  ins.run('2026-11-03', '900000333', '3000000998');
  monitoreo("'A33-CONN-0001", '2026-11-04');
  monitoreo('900000333', '2026-11-04');
  assert.equal(E.listar(db, { campana: REAL, estado: 'resueltas' }, null).conteo.resueltas, 2, 'antes de la API: 2 resueltas');

  const f = falso(DATA);
  const r = await M.correrModulo('encuesta', { db, env: ENV, ahora: AHORA, fetchImpl: f.fetch, franja: 'a33-real', destino: 'real' });
  assert.equal(r.estado, 'ok', r.detalle);
  const real = filas(REAL);
  assert.deepEqual(real.map((x) => x.connId), ['A33-CONN-0001', '900000333', 'A33-CONN-0003']);
  assert.ok(real.every((x) => x.telefono === '' && x.comentario === ''), 'sin teléfono ni comentario');
  const txt = JSON.stringify(db.prepare("SELECT * FROM encuestas WHERE campana = 'MOBILIZE'").all());
  for (const x of [ANI, DNI, CLIENTE, COMENTARIO]) assert.ok(!txt.includes(x), 'se guardó ' + x);
  // Fase W10: la parte «la réplica de MOBILIZE sigue sin CONN_ID» se fue con la réplica.
});

test('A33: con el ID de la API, los monitoreos de antes vuelven a enlazarse (también con comilla adelante o número)', () => {
  const l = E.listar(db, { campana: REAL, estado: 'todas' }, null);
  assert.deepEqual(l.conteo, { pendientes: 0, resueltas: 2, sinId: 0 }, JSON.stringify(l.conteo));
  assert.deepEqual(l.filas.map((x) => [x.connId, x.estado]).sort(), [['900000333', 'resuelta'], ['A33-CONN-0001', 'resuelta']]);
  // fechaLlamada del monitoreo (que guardó el ID con comilla) se encuentra.
  assert.deepEqual(E.fechasLlamada(db, REAL, ["'A33-CONN-0001", '900000333', 'NO-EXISTE']), { "'A33-CONN-0001": '2026-11-02', 900000333: '2026-11-03' });
  // No se puede calificar dos veces la misma llamada aunque el ID venga en otro formato.
  assert.equal(E.validarParaGuardar(db, { campana: REAL, connId: 'A33-CONN-0001', actor: { id: 1, nombre: 'x' } }).status, 409);
  assert.ok(E.monitoreoDeLlamada(db, REAL, ' ‘A33-CONN-0001'));
  assert.equal(E.monitoreoDeLlamada(db, REAL, 'A33-CONN-000'), null, 'no enlaza por parecido');
  assert.equal(E.claveId("  'X-1 "), 'X-1');
});

test('A33: una mal calificada nueva de la API sale «pendiente» (antes caía en «sin ID»)', async () => {
  const f = falso(DATA.concat([enc('A33-CONN-0004', '2026-11-04', '3')]));
  const r = await M.correrModulo('encuesta', { db, env: ENV, ahora: AHORA, fetchImpl: f.fetch, franja: 'a33-real-2', destino: 'real' });
  assert.equal(r.estado, 'ok', r.detalle);
  const l = E.listar(db, { campana: REAL, estado: 'pendientes' }, null);
  assert.deepEqual(l.conteo, { pendientes: 1, resueltas: 2, sinId: 0 });
  assert.equal(l.filas[0].connId, 'A33-CONN-0004');
});
