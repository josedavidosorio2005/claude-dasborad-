// faseA24-wolkvox-mobilize-real.test.js — Fase A24 (20/11/2026): la consulta automática puede
// escribir en el MOBILIZE real SOLO desde 2026-11 (Fase A29, 20/11/2026: antes 2026-12; octubre y
// anteriores nunca se tocan), SOLO desde el programador y SOLO con
// WOLKVOX_REAL_ACTIVO exactamente «1». Con el interruptor apagado, sin el parámetro, con otro valor
// o con SSM caído: ni una consulta ni una escritura en el MOBILIZE real. Campaña destino de una
// lista cerrada (réplica y MOBILIZE). Wolkvox FALSO y datos INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('./helpers');
const auto = require('../wolkvox-auto');
const M = require('../wolkvox-modulos');
const D = require('../wolkvox-destinos');
const ing = require('../wolkvox-ingesta');
const { cargarNivelServicioDiario } = require('../nivel-servicio-diario');

const REAL = 'MOBILIZE';
const SKILL_MAPEADA = 'SKILL INVENTADA A24 MAPEADA';
const SKILL_SIN_MAPEO = 'SKILL INVENTADA A24 SIN MAPEO';
const ENV_BASE = { NODE_ENV: 'test', WOLKVOX_MOBILIZE_TOKEN: 'TOKEN-FALSO-A24-no-es-real-0123456789', WOLKVOX_MOBILIZE_SERVIDOR: 'servidorfalsoa24' };

const n = (sql, ...a) => db.prepare(sql).get(...a).n;
const ok = (cuerpo) => Promise.resolve({ status: 200, json: () => Promise.resolve(cuerpo) });
function crearFalso() {
  const f = { urls: [] };
  f.fetch = (url) => {
    f.urls.push(url);
    const api = new URL(url).searchParams.get('api');
    if (api === 'skill_1') {
      return ok({ code: 200, msg: '2 records were found', data: [
        { skill_name: SKILL_MAPEADA, inbound_calls: '9', answer_calls: '8', abandon_calls: '1', service_level_20seg: '80.0 %', asa: '0:0:10', ata: '0:1:0' },
        { skill_name: SKILL_SIN_MAPEO, inbound_calls: '3', answer_calls: '3', abandon_calls: '0' },
      ] });
    }
    return ok({ code: 200, msg: '0 records were found', data: [] });
  };
  return f;
}
// Huella de todo lo del MOBILIZE real: Flujo, Flujo por hora, tipificaciones, encuestas, salida y abandonadas.
function huellaReal() {
  return ['calidad_nivel_servicio_diario', 'flujo_hora', 'tipificaciones', 'encuestas', 'llamadas_no_conectadas', 'llamadas_abandonadas']
    .map((t) => t + ':' + n('SELECT COUNT(*) n FROM ' + t + ' WHERE campana = ?', REAL)).join(' ') +
    ' corridas-real:' + n("SELECT COUNT(*) n FROM wolkvox_auto_corridas WHERE franja LIKE '% real%'") +
    ' respaldos:' + n('SELECT COUNT(*) n FROM cargas_versiones WHERE campana = ?', REAL) +
    ' historial:' + n("SELECT COUNT(*) n FROM historial WHERE accion LIKE 'WOLKVOX_%' AND detalle LIKE 'MOBILIZE ·%'");
}
auto.asegurarTablas(db);
// Fase A29: un día de OCTUBRE cargado a mano en el MOBILIZE real (antes del corte: nunca se toca) y uno
// de NOVIEMBRE cargado a mano (desde el corte: la API lo reemplaza, con respaldo).
cargarNivelServicioDiario(db, { campana: REAL, sede: null, archivoNombre: 'manual inventado A29 oct', cargadoPorNombre: 'Prueba A29', filas: [{ fecha: '2026-10-10', skillName: SKILL_MAPEADA, totalLlamadas: 5, contestadas: 5 }] });
cargarNivelServicioDiario(db, { campana: REAL, sede: null, archivoNombre: 'manual inventado A29 nov', cargadoPorNombre: 'Prueba A29', filas: [{ fecha: '2026-11-10', skillName: SKILL_MAPEADA, totalLlamadas: 7, contestadas: 7 }] });
const ts = new Date().toISOString();
db.prepare('INSERT INTO trafico_skill_mapeo (skillName, campana, sede, createdAt, updatedAt) VALUES (?, ?, NULL, ?, ?)').run(SKILL_MAPEADA, REAL, ts, ts);

async function tick(ahora, deps) {
  const p = auto.iniciar(db, Object.assign({ reloj: () => ahora, cadaMs: 3600 * 1000 }, deps));
  try { return await p.tick(); } finally { p.detener(); }
}

test('lista cerrada: la réplica, el MOBILIZE real y (Fase N6) la réplica de ORLANT; nunca el ORLANT real', () => {
  assert.deepEqual([...D.CAMPANAS_PERMITIDAS], ['MOBILIZE', 'ORLANT PRUEBAS API', 'CLINICA AURORA PRUEBAS API']); // Fase AU2: + la réplica de Aurora // Fase W10: sin la réplica de MOBILIZE
  assert.throws(() => D.destino(), /Falta el destino/);
  assert.equal(D.destino('real').campana, 'MOBILIZE');
  for (const malo of ['ORLANT', 'SURA', 'MOBILIZE', { campana: 'MOBILIZE' }, 'toString', 5]) assert.throws(() => D.destino(malo), /no permitido/, String(malo));
  const filas = [{ fecha: '2026-12-01', skillName: 'X', totalLlamadas: 1, contestadas: 1 }];
  assert.throws(() => ing.reemplazarMesFlujo(db, { mes: '2026-12', filas, cargadoPorNombre: 'x', campana: 'ORLANT' }), /no permitida/);
  assert.throws(() => M.reemplazarMesFlujoHora(db, '2026-12', [], 'ORLANT'), /no permitida/);
  assert.throws(() => M.actualizarAhtEspera(db, '2026-12', new Map(), 'SURA'), /no permitida/);
  assert.equal(D.campanaLista(db, 'real'), true);
  assert.throws(() => D.campanaLista(db, 'replica'), /no permitido/); // Fase W10
});

test('corte (Fase A29): el real nunca pide meses anteriores a 2026-11; la réplica no cambia', () => {
  const at = (iso) => new Date(iso);
  assert.equal(D.DESDE_MES_REAL, '2026-11');
  assert.deepEqual(auto.planDe({ ahora: at('2026-10-25T12:00:00Z'), destino: 'real' }), []);
  assert.deepEqual(auto.planDe({ ahora: at('2026-11-01T12:00:00Z'), destino: 'real' }), [], 'el 1/11 octubre queda fuera');
  assert.deepEqual(auto.planDe({ ahora: at('2026-11-03T12:00:00Z'), destino: 'real' }).map((m) => [m.mes, m.dias.length]), [['2026-11', 2]], 'el 3/11 octubre queda fuera');
  // 21/11 00:05 Colombia (05:05 UTC): noviembre del 1 al 20, la primera franja tras el cambio.
  assert.deepEqual(auto.planDe({ ahora: at('2026-11-21T05:05:00Z'), destino: 'real' }).map((m) => [m.mes, m.dias.length]), [['2026-11', 20]]);
  assert.deepEqual(auto.planDe({ ahora: at('2026-12-02T12:00:00Z'), destino: 'real' }).map((m) => [m.mes, m.dias.length]), [['2026-11', 30], ['2026-12', 1]], 'en diciembre, los días 1 a 3 cierra noviembre');
  assert.deepEqual(auto.planDe({ ahora: at('2026-12-04T12:00:00Z'), destino: 'real' }).map((m) => [m.mes, m.dias.length]), [['2026-12', 3]]);
  assert.deepEqual(auto.planDe({ ahora: at('2026-12-03T12:00:00Z'), mes: '2026-10', destino: 'real' }), [], 'octubre ni pedido a mano');
  assert.deepEqual(auto.planDe({ ahora: at('2026-11-03T12:00:00Z'), destino: 'orlant_replica' }).map((m) => m.mes), ['2026-10', '2026-11'], 'una réplica sí'); // Fase W10: la de ORLANT
  for (let t = Date.UTC(2026, 9, 1); t <= Date.UTC(2027, 1, 28); t += 3600 * 1000) {
    for (const m of auto.planDe({ ahora: new Date(t), destino: 'real' })) assert.ok(m.mes >= '2026-11', 'nunca antes de noviembre: ' + m.mes);
  }
});

test('programador: sin WOLKVOX_REAL_ACTIVO, con otro valor o con SSM caído, nunca consulta ni escribe en el MOBILIZE real', async () => {
  const antes = huellaReal();
  const falso = crearFalso();
  let dia = 11;
  const proxima = () => new Date('2026-12-' + String(dia++) + 'T12:05:00Z'); // un día distinto por caso (07:05 Colombia)
  // 1) sin el parámetro (lectura local de process.env), aunque la lista de módulos del real esté llena
  await tick(proxima(), { env: Object.assign({}, ENV_BASE, { WOLKVOX_REAL_MODULOS: 'flujo_hora,cdr,encuesta,no_conectadas,abandonadas' }), fetchImpl: falso.fetch });
  // 2) otros valores que no son «1»
  for (const v of ['0', 'true', 'si', '', '11', 'on']) {
    await tick(proxima(), { env: Object.assign({}, ENV_BASE, { WOLKVOX_REAL_ACTIVO: v, WOLKVOX_REAL_MODULOS: 'cdr' }), fetchImpl: falso.fetch });
  }
  // 3) SSM caído al leer el interruptor del real
  await tick(proxima(), { env: ENV_BASE, fetchImpl: falso.fetch, leerInterruptor: async (e, nombre) => { if (nombre === 'WOLKVOX_REAL_ACTIVO') throw Object.assign(new Error('x'), { name: 'AccessDeniedException' }); return false; },
    leerValor: async (e, nombre) => (nombre === 'WOLKVOX_REAL_MODULOS' ? 'cdr' : '') });
  // 4) Fase W10: el caso «interruptor de la réplica encendido» se fue con la réplica de MOBILIZE.
  assert.equal(huellaReal(), antes, 'el MOBILIZE real quedó igual');
  assert.equal(n("SELECT COUNT(*) n FROM wolkvox_auto_corridas WHERE franja LIKE '% real%'"), 0);
});

test('programador: con WOLKVOX_REAL_ACTIVO=1 antes del corte (el 1/11) no hace nada (ni lee SSM)', async () => {
  const antes = huellaReal();
  const falso = crearFalso();
  const leidos = [];
  await tick(new Date('2026-11-01T12:05:00Z'), { env: ENV_BASE, fetchImpl: falso.fetch, leerInterruptor: async (e, nombre) => { leidos.push(nombre); return nombre === 'WOLKVOX_REAL_ACTIVO'; }, leerValor: async (e, nombre) => (nombre === 'WOLKVOX_REAL_MODULOS' ? 'cdr' : '') });
  assert.equal(falso.urls.length, 0);
  assert.ok(!leidos.includes('WOLKVOX_REAL_ACTIVO'));
  assert.equal(huellaReal(), antes);
});

test('«Ejecutar ahora» nunca escribe en el MOBILIZE real, aunque se le pida', async () => {
  const antes = huellaReal();
  const falso = crearFalso();
  const r = await auto.ejecutarAhora({ db, env: ENV_BASE, ahora: new Date('2026-12-10T15:00:00Z'), destino: 'real', campana: REAL, fetchImpl: falso.fetch, leerInterruptor: async () => true, logEvent: () => {} });
  // Fase N6: antes ignoraba el destino y corría la réplica; ahora un destino real se rechaza sin consultar.
  assert.equal(r.estado, 'no_permitido');
  assert.equal(falso.urls.length, 0, 'ninguna consulta');
  assert.equal(huellaReal(), antes);
});

test('programador (Fase A29): con WOLKVOX_REAL_ACTIVO=1 desde noviembre escribe solo skills mapeadas, respalda el noviembre manual y no toca octubre', async () => {
  const { logEvent } = require('../routes/shared');
  const falso = crearFalso();
  const octubre = () => db.prepare("SELECT fecha, skillName, totalLlamadas FROM calidad_nivel_servicio_diario WHERE campana = ? AND fecha LIKE '2026-10%'").all(REAL);
  const oct0 = JSON.stringify(octubre());
  assert.equal(JSON.parse(oct0).length, 1);
  // Noviembre ya tenía un día cargado a mano: el primer reemplazo lo respalda.
  assert.equal(n("SELECT COUNT(*) n FROM cargas_versiones WHERE campana = ? AND mes = '2026-11'", REAL), 0);
  // 05/11 07:05 Colombia: pide del 1 al 4 de noviembre. La réplica apagada; el real con cdr y encuesta.
  await tick(new Date('2026-11-05T12:05:00Z'), { env: Object.assign({}, ENV_BASE, { WOLKVOX_REAL_ACTIVO: '1', WOLKVOX_REAL_MODULOS: 'encuesta,cdr,nada' }), fetchImpl: falso.fetch, logEvent });
  const apis = falso.urls.map((u) => new URL(u).searchParams.get('api'));
  assert.deepEqual(apis, ['skill_1', 'skill_1', 'skill_1', 'skill_1', 'cdr_1', 'diagram_4'], 'Flujo y después los módulos en el orden de MODULOS');
  const nov = db.prepare("SELECT fecha, skillName, totalLlamadas, contestadas FROM calidad_nivel_servicio_diario WHERE campana = ? AND fecha LIKE '2026-11%' ORDER BY fecha").all(REAL);
  assert.equal(nov.length, 4, 'noviembre completo reemplazado: el día manual (10/11) ya no está');
  assert.ok(nov.every((f) => f.skillName === SKILL_MAPEADA && f.totalLlamadas === 9 && f.contestadas === 8));
  assert.ok(n("SELECT COUNT(*) n FROM cargas_versiones WHERE campana = ? AND mes = '2026-11'", REAL) >= 1, 'respaldo del noviembre manual antes de reemplazar');
  assert.equal(n("SELECT COUNT(*) n FROM trafico_skill_mapeo WHERE skillName = ?", SKILL_SIN_MAPEO), 0, 'el mapeo no se toca');
  assert.equal(JSON.stringify(octubre()), oct0, 'octubre del real intacto');
  // Segunda franja (06/11): se respalda otra vez antes de reemplazar.
  const resp1 = n("SELECT COUNT(*) n FROM cargas_versiones WHERE campana = ? AND mes = '2026-11'", REAL);
  await tick(new Date('2026-11-06T12:05:00Z'), { env: Object.assign({}, ENV_BASE, { WOLKVOX_REAL_ACTIVO: '1' }), fetchImpl: falso.fetch, logEvent });
  assert.ok(n("SELECT COUNT(*) n FROM cargas_versiones WHERE campana = ? AND mes = '2026-11'", REAL) > resp1, 'respaldo antes de reemplazar');
  assert.equal(n("SELECT COUNT(*) n FROM calidad_nivel_servicio_diario WHERE campana = ? AND fecha LIKE '2026-11%'", REAL), 5);
  assert.equal(JSON.stringify(octubre()), oct0, 'octubre sigue intacto');
  assert.equal(n("SELECT COUNT(*) n FROM wolkvox_auto_corridas WHERE franja LIKE '2026-10%'"), 0);
  const h = db.prepare("SELECT detalle FROM historial WHERE accion = 'WOLKVOX_AUTO' AND detalle LIKE 'MOBILIZE · skill_1 · 2026-11: 4 días%'").get();
  assert.ok(h && h.detalle.includes('4 filas de skills sin mapear fuera'), h && h.detalle);
  assert.equal(n("SELECT COUNT(*) n FROM wolkvox_auto_corridas WHERE franja = '2026-11-05 07 real'"), 1);
  assert.equal(n("SELECT COUNT(*) n FROM wolkvox_auto_corridas WHERE franja IN ('2026-11-05 07 real cdr', '2026-11-05 07 real encuesta')"), 2);
  assert.equal(n("SELECT COUNT(*) n FROM wolkvox_auto_corridas WHERE franja = '2026-11-05 07'"), 0, 'la réplica apagada no corrió');
});
