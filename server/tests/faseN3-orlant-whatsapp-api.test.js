// faseN3-orlant-whatsapp-api.test.js — Fase N3 (autorización escrita del usuario, 24/11/2026): WhatsApp por API
// (chat_1) SOLO en la réplica «ORLANT PRUEBAS API», APAGADO como las demás réplicas, descartando en memoria
// customer_name, customer_email, customer_phone, comment, comments y extra_field. El abandono queda «¿Edwin?».
// Wolkvox FALSO y datos INVENTADOS; nunca sale a la red.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('./helpers');
const auto = require('../wolkvox-auto');
const M = require('../wolkvox-modulos');
const D = require('../wolkvox-destinos');

const R = 'ORLANT PRUEBAS API';
const ENV = { NODE_ENV: 'test', WOLKVOX_ORLANT_TOKEN: 'TOKEN-FALSO-N3-no-es-real', WOLKVOX_ORLANT_SERVIDOR: 'servidorfalson3', WOLKVOX_MOBILIZE_TOKEN: 'TOKEN-FALSO-N3-MOB', WOLKVOX_MOBILIZE_SERVIDOR: 'servidorfalsomob3' };
const AHORA = new Date('2026-11-05T12:05:00Z');
const PII = { customer_name: 'CLIENTE INVENTADO N3', customer_email: 'inventado-n3@ejemplo.invalid', customer_phone: '3000000333', comment: 'COMENTARIO INVENTADO N3', comments: 'OTRO COMENTARIO N3', extra_field: 'EXTRA INVENTADO N3' };
const chat = (x) => Object.assign({ conn_id: 'CHAT-INV', channel: 'whatsapp', date: '2026-10-02 08:15:02', skill_id: '4327', agent_id: '501', agent_name: 'ASESORA INVENTADA N3', first_response_time: '00:02:00', chat_duration: '00:10:00', description_cod_act: 'CITA INVENTADA' }, PII, x);
const DATOS = () => [
  chat(),                                                    // General, 120 s
  chat({ first_response_time: 400, date: '2026-10-02 09:00:00' }), // General, 400 s (número)
  chat({ agent_id: '', agent_name: '', first_response_time: '' }), // General, sin asesor
  chat({ skill_id: '4306', first_response_time: '30' }),      // 3P, 30 s
  chat({ skill_id: '0' }),                                    // salida: fuera
  chat({ skill_id: '9999', date: '2026-10-03 10:00:00' }),     // skill sin nombre en el mapa
  chat({ date: 'no es fecha' }),                              // sin fecha: fuera
];
const ok = (cuerpo) => Promise.resolve({ status: 200, json: () => Promise.resolve(cuerpo) });
function falso() {
  const f = { llamadas: [] };
  f.fetch = (url) => { const api = new URL(url).searchParams.get('api'); f.llamadas.push(api); return ok({ code: 200, msg: '7 records were found', data: api === 'chat_1' ? DATOS() : [] }); };
  return f;
}
const n = (sql, ...a) => db.prepare(sql).get(...a).n;

test('hojaWhatsapp: descarta los datos del cliente en memoria, deja fuera la salida y lo sin fecha, y arma tráfico y tiempos', () => {
  const data = DATOS();
  const h = M.hojaWhatsapp(data, new Map([['4327', 'WHATSAPP GENERAL'], ['4306', 'WHATSAPP 3P']]));
  for (const f of data) for (const k of M.WA_DESCARTADAS) assert.ok(!(k in f), k + ' borrado de la fila en memoria');
  const txt = JSON.stringify(h);
  for (const v of Object.values(PII)) assert.ok(!txt.includes(v), 'sin ' + v);
  assert.equal(h.salida, 1);
  assert.equal(h.sinFecha, 1);
  const g = h.trafico.find((t) => t.colaWhatsapp === 'WHATSAPP GENERAL');
  assert.deepEqual([g.fechaInicio, g.fechaFin, g.totalWhatsapp, g.contestados, g.abandonados, g.asaSegundos], ['2026-10-02', '2026-10-02', 3, 2, null, 260]);
  assert.equal(h.trafico.find((t) => t.colaWhatsapp === 'WHATSAPP 3P').asaSegundos, 30);
  assert.ok(h.trafico.some((t) => t.colaWhatsapp === 'Skill 9999' && t.fechaInicio === '2026-10-03'));
  assert.deepEqual(h.tiempos.filter((t) => t[0] === 'WHATSAPP GENERAL').map((t) => [t[2], t[3]]), [[8, 120], [9, 400]], '[cola, fecha, hora, segundos]');
  assert.ok(h.trafico.every((t) => t.abandonados === null), '¿Edwin?: nunca recibidos − contestados');
});

test('solo la réplica de ORLANT tiene el módulo; MOBILIZE (réplica y real) no, y sin consultar a Wolkvox', async () => {
  assert.ok(M.MODULOS.whatsapp && M.MODULOS.whatsapp.api === 'chat_1');
  assert.equal(D.moduloPermitido('orlant_replica', 'whatsapp'), true);
  assert.equal(D.moduloPermitido('replica', 'whatsapp'), false);
  assert.equal(D.moduloPermitido('real', 'whatsapp'), false);
  for (const m of ['flujo_hora', 'cdr', 'encuesta', 'no_conectadas', 'abandonadas']) {
    assert.equal(D.moduloPermitido('replica', m), true, 'MOBILIZE réplica sigue con ' + m);
    assert.equal(D.moduloPermitido('real', m), true, 'MOBILIZE real sigue con ' + m);
  }
  const f = falso();
  for (const destino of ['replica', 'real']) {
    const r = await M.correrModulo('whatsapp', { db, env: ENV, ahora: AHORA, mes: '2026-10', fetchImpl: f.fetch, destino, franja: 'prueba n3 ' + destino, logEvent: () => {} });
    assert.equal(r.estado, 'omitida', destino);
  }
  assert.equal(f.llamadas.length, 0);
});

test('apagado: «Ejecutar ahora» de WhatsApp en la réplica de ORLANT no corre sin WOLKVOX_ORLANT_AUTO_ACTIVO', async () => {
  const f = falso();
  const r = await auto.ejecutarAhora({ db, env: ENV, ahora: AHORA, fetchImpl: f.fetch, logEvent: () => {}, destino: 'orlant_replica', modulo: 'whatsapp', leerInterruptor: async () => false });
  assert.equal(r.estado, 'apagada');
  assert.equal(f.llamadas.length, 0);
});

test('la réplica de ORLANT guarda tráfico y tiempos del mes, sin datos del cliente; el ORLANT real no se toca', async () => {
  auto.asegurarTablas(db);
  const real = () => n('SELECT COUNT(*) n FROM trafico_whatsapp WHERE campana = ?', 'ORLANT') + ':' + n('SELECT COUNT(*) n FROM whatsapp_tiempos WHERE campana = ?', 'ORLANT');
  const antes = real();
  const f = falso();
  const hist = [];
  const r = await M.correrModulo('whatsapp', { db, env: ENV, ahora: AHORA, mes: '2026-10', fetchImpl: f.fetch, destino: 'orlant_replica', franja: 'prueba n3 orlant', logEvent: (a, b, c, d) => hist.push(d) });
  assert.equal(r.estado, 'ok', r.detalle);
  assert.deepEqual(f.llamadas, ['chat_1'], 'una consulta por mes');
  assert.equal(real(), antes, 'el ORLANT real no cambia');
  const filas = db.prepare('SELECT * FROM trafico_whatsapp WHERE campana = ? ORDER BY fechaInicio, colaWhatsapp').all(R);
  assert.equal(filas.length, 3);
  assert.ok(filas.every((x) => x.abandonados === null && x.archivoNombre === 'API Wolkvox (chat_1)'));
  assert.equal(n('SELECT COUNT(*) n FROM whatsapp_tiempos WHERE campana = ?', R), 4);
  const todo = JSON.stringify(db.prepare('SELECT * FROM trafico_whatsapp WHERE campana = ?').all(R)) + JSON.stringify(db.prepare('SELECT * FROM whatsapp_tiempos WHERE campana = ?').all(R)) + hist.join('\n');
  for (const v of Object.values(PII)) assert.ok(!todo.includes(v), 'nada guardado con ' + v);
  assert.match(hist.join('\n'), /ORLANT PRUEBAS API · whatsapp \(chat_1\) · 2026-10: 7 chats → 5 de entrada .*abandono sin dato \(¿Edwin\?\); con respaldo/);
  assert.ok(!hist.join('\n').includes('TOKEN-FALSO') && !hist.join('\n').includes('servidorfalso'));
  // Volver a correr el mes lo reemplaza (no duplica).
  await M.correrModulo('whatsapp', { db, env: ENV, ahora: AHORA, mes: '2026-10', fetchImpl: falso().fetch, destino: 'orlant_replica', franja: 'prueba n3 orlant 2', logEvent: () => {} });
  assert.equal(n('SELECT COUNT(*) n FROM trafico_whatsapp WHERE campana = ?', R), 3);
  assert.equal(n('SELECT COUNT(*) n FROM whatsapp_tiempos WHERE campana = ?', R), 4);
});
