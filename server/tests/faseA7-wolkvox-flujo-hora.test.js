// faseA7-wolkvox-flujo-hora.test.js — llenar la réplica con la API, paso 1: skill_7 → Flujo por hora
// + AHT y espera del Flujo diario. Solo la réplica; apagado salvo WOLKVOX_REAL_MODULOS. Wolkvox
// FALSO y datos INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const M = require('../wolkvox-modulos');
const auto = require('../wolkvox-auto');
const { cargarNivelServicioDiario } = require('../nivel-servicio-diario');

const R = 'MOBILIZE'; // Fase W10: antes la réplica «MOBILIZE PRUEBAS API» (borrada); ahora el destino real
const ENV = { NODE_ENV: 'test', WOLKVOX_MOBILIZE_TOKEN: 'TOKEN-FALSO-A7-no-es-real-0123456789', WOLKVOX_MOBILIZE_SERVIDOR: 'servidorfalsoa7' };
const AHORA = new Date('2026-11-05T12:30:00Z'); // 05/11 07:30 Colombia: pide del 1 al 4
const SK = 'SKILL INVENTADA A7';
const ok = (cuerpo) => Promise.resolve({ status: 200, json: () => Promise.resolve(cuerpo) });
const fila = (date, hour, inb, ans, ab, extra) => ({ date, hour, skill_id: '5', skill_name: SK, inbound_calls: String(inb), answer_calls: String(ans), abandon_calls: String(ab), wait_time: '0:0:10', aht: '0:3:0', service_level_20seg: '90 %', ...extra });
function falso(data) {
  const f = { urls: [] };
  f.fetch = (url) => { f.urls.push(url); return ok({ code: 200, msg: data.length + ' records were found', data }); };
  return f;
}
const fh = (mes) => db.prepare('SELECT fecha, hora, skill, ingresadas, contestadas, abandonadas FROM flujo_hora WHERE campana = ? AND substr(fecha,1,7) = ? ORDER BY fecha, hora').all(R, mes);
const n = (sql, ...a) => db.prepare(sql).get(...a).n;

test('lector: la «hoja» del Excel por hora sale de skill_7 y pasa por el mismo lector', () => {
  const FH = require('../../public/js/flujo-hora-logic.js');
  const p = FH.flujoHoraParseFilas(M.hojaFlujoHora([fila('20261103', '8', 3, 2, 1), { DATE: 20261103, HOUR: 9, SKILL_NAME: SK, INBOUND_CALLS: 1, ANSWER_CALLS: 1, ABANDON_CALLS: 0 }]));
  assert.deepEqual(p.filas, [['2026-11-03', 8, SK, 3, 2, 1], ['2026-11-03', 9, SK, 1, 1, 0]]);
  assert.deepEqual(p.avisos, []);
});

test('AHT y espera del día: promedio ponderado (AHT por contestadas, espera por ingresadas)', () => {
  const m = M.ahtEsperaDiarios([
    fila('20261103', 8, 4, 3, 1, { aht: '0:2:0', wait_time: '0:0:20' }),
    fila('20261103', 9, 1, 1, 0, { aht: '0:6:0', wait_time: '0:0:5' }),
    fila('20261103', 10, 0, 0, 0, { aht: '345600', wait_time: '345600' }), // hora vacía: no pesa
  ]);
  assert.deepEqual(m.get('2026-11-03|' + SK), { aht: 180, espera: 17 }); // (120·3+360·1)/4 = 180; (20·4+5·1)/5 = 17
});

test('corrida: una consulta del mes, reemplaza el Flujo por hora de la réplica con respaldo, pone AHT/espera, no toca MOBILIZE', async () => {
  // Flujo diario de la réplica (lo escribe skill_1) y una fila vieja de flujo_hora que ya no vendrá.
  cargarNivelServicioDiario(db, { campana: R, sede: null, archivoNombre: 'prueba', cargadoPorNombre: 'Prueba', filas: [{ fecha: '2026-11-03', skillName: SK, totalLlamadas: 5, contestadas: 4 }] });
  db.prepare("INSERT INTO flujo_hora (campana, fecha, hora, skill, ingresadas, contestadas, abandonadas, archivoNombre, cargadoPorNombre, createdAt) VALUES (?, '2026-11-02', 7, 'VIEJA', 1, 1, 0, 'x', 'x', 'x')").run(R);
  db.prepare("INSERT INTO flujo_hora (campana, fecha, hora, skill, ingresadas, contestadas, abandonadas, archivoNombre, cargadoPorNombre, createdAt) VALUES ('ORLANT', '2026-11-03', 8, 'REAL', 9, 9, 0, 'x', 'x', 'x')").run();
  const versiones = n('SELECT COUNT(*) n FROM cargas_versiones WHERE campana = ?', R);
  const f = falso([
    fila('20261103', '8', 4, 3, 1, { aht: '0:2:0', wait_time: '0:0:20' }),
    fila('20261103', '9', 1, 1, 0, { aht: '0:6:0', wait_time: '0:0:5' }),
    fila('20261104', '10', 0, 0, 0), // en cero: fuera
  ]);
  const r = await M.correrModulo('flujo_hora', { db, destino: 'real', env: ENV, ahora: AHORA, fetchImpl: f.fetch, franja: 'a7-1', logEvent: require('../routes/shared').logEvent });
  assert.equal(r.estado, 'ok', r.detalle);
  assert.equal(f.urls.length, 1);
  assert.deepEqual(Object.fromEntries(new URL(f.urls[0]).searchParams), { api: 'skill_7', date_ini: '20261101000000', date_end: '20261104235959' });
  assert.deepEqual(fh('2026-11'), [
    { fecha: '2026-11-03', hora: 8, skill: SK, ingresadas: 4, contestadas: 3, abandonadas: 1 },
    { fecha: '2026-11-03', hora: 9, skill: SK, ingresadas: 1, contestadas: 1, abandonadas: 0 },
  ]);
  const d = db.prepare('SELECT ahtSegundos, waitTimeSegundos FROM calidad_nivel_servicio_diario WHERE campana = ? AND fecha = ? AND skillName = ?').get(R, '2026-11-03', SK);
  assert.deepEqual(d, { ahtSegundos: 180, waitTimeSegundos: 17 });
  assert.ok(n('SELECT COUNT(*) n FROM cargas_versiones WHERE campana = ?', R) > versiones, 'respaldo');
  assert.equal(n("SELECT COUNT(*) n FROM flujo_hora WHERE campana = 'ORLANT' AND skill = 'REAL'"), 1);
  const h = db.prepare("SELECT detalle FROM historial WHERE accion = 'WOLKVOX_MODULO' ORDER BY id DESC LIMIT 1").get().detalle;
  assert.match(h, /flujo_hora \(skill_7\) · 2026-11: 2 filas día-hora-skill \(1 en cero fuera\), reemplazó 1, AHT\/espera en 1 filas del Flujo, con respaldo · 1 consultas/);
  assert.ok(!h.includes(SK));
});

test('respuesta rara (hora 25) o vacía: no cambia nada; error sin reintento', async () => {
  const antes = fh('2026-11');
  const r = await M.correrModulo('flujo_hora', { db, destino: 'real', env: ENV, ahora: AHORA, fetchImpl: falso([fila('20261103', '25', 1, 1, 0)]).fetch, franja: 'a7-2' });
  assert.equal(r.error, 'respuesta_invalida');
  assert.match(r.detalle, /1 filas inválidas; campos: abandon_calls,aht,/);
  const r2 = await M.correrModulo('flujo_hora', { db, destino: 'real', env: ENV, ahora: AHORA, fetchImpl: falso([]).fetch, franja: 'a7-3' });
  assert.match(r2.detalle, /Wolkvox no trajo filas, sin cambios/);
  let k = 0;
  const caido = () => { k++; return Promise.reject(Object.assign(new Error('x'), { cause: { code: 'ECONNRESET' } })); };
  const r3 = await M.correrModulo('flujo_hora', { db, destino: 'real', env: ENV, ahora: AHORA, fetchImpl: caido, franja: 'a7-4' });
  assert.equal(r3.error, 'red');
  assert.equal(k, 1);
  assert.deepEqual(fh('2026-11'), antes);
});

test('apagado por defecto: el programador solo corre los módulos de WOLKVOX_REAL_MODULOS', async () => {
  assert.deepEqual(M.modulosDe(' flujo_hora , cdr_inventado,FLUJO_HORA'), ['flujo_hora', 'flujo_hora']);
  assert.deepEqual(M.modulosDe(undefined), []);
  const apis = [];
  const fetchImpl = (url) => { apis.push(new URL(url).searchParams.get('api')); return ok({ code: 200, msg: '0 records were found', data: [] }); };
  const correr = async (valor, reloj) => {
    const p = auto.iniciar(db, { env: ENV, reloj: () => new Date(reloj), leerInterruptor: async () => true, leerValor: async (e, nom) => (nom === 'WOLKVOX_REAL_MODULOS' ? valor : undefined), fetchImpl, cadaMs: 3600 * 1000 });
    try { await p.tick(); } finally { p.detener(); }
  };
  await correr(undefined, '2026-11-06T12:05:00Z');
  assert.deepEqual(apis.filter((a) => a !== 'skill_1'), []); // Fase W10: el real siempre pide su Flujo (skill_1)
  apis.length = 0;
  await correr('flujo_hora', '2026-11-06T18:05:00Z');
  assert.deepEqual(apis.filter((a) => a !== 'skill_1'), ['skill_7']);
});

