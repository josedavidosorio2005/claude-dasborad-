// faseA1-wolkvox-auto.test.js — Plan A de Wolkvox, fase A1: consulta automatica desde el
// servidor (7:00 y 13:00 Colombia), solo la replica «MOBILIZE PRUEBAS API» y solo Flujo.
// Todo con un Wolkvox FALSO (fetch inyectado) y datos INVENTADOS: nunca se llama a la API real.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const auto = require('../wolkvox-auto');
const wv = require('../wolkvox');
const { cargarNivelServicioDiario } = require('../nivel-servicio-diario');

const R = auto.CAMPANA;
const TOKEN = 'TOKEN-FALSO-A1-no-es-real-0123456789';
const SERVIDOR = 'servidorfalsoa1';
const SKILL_A = 'SKILL INVENTADA A1 UNO';
const SKILL_B = 'SKILL INVENTADA A1 DOS';
const ENV = { NODE_ENV: 'test', WOLKVOX_MOBILIZE_TOKEN: TOKEN, WOLKVOX_MOBILIZE_SERVIDOR: SERVIDOR };
// 18/11/2026 07:30 en Colombia (12:30 UTC): pide del 1 al 17 de noviembre.
const AHORA = new Date('2026-11-18T12:30:00Z');

// Wolkvox falso: cuenta las llamadas, guarda las URLs y responde lo que diga `responder`.
function crearFalso(responder) {
  const f = { llamadas: 0, urls: [], headers: [] };
  f.fetch = (url, opts) => {
    f.llamadas++;
    f.urls.push(url);
    f.headers.push(opts && opts.headers);
    return responder(url, opts, f);
  };
  return f;
}
const ok = (cuerpo) => Promise.resolve({ status: 200, json: () => Promise.resolve(cuerpo) });
// Dos skills + una fila de total sin skill (como skill_3 en B0), con los formatos de Wolkvox.
function diaNormal() {
  return ok({
    code: 200, error: false, msg: '3 records were found',
    data: [
      { skill_name: SKILL_A, inbound_calls: '10', answer_calls: '8', abandon_calls: '2', service_level_20seg: '75.0 %', abandon: '20.0 %', asa: '0:0:12', ata: '0:1:30' },
      { skill_name: SKILL_B, inbound_calls: '4', answer_calls: '4', abandon_calls: '0', service_level_20seg: '100 %', abandon: '0 %', asa: '0:0:5', ata: '0:2:0' },
      { skill_name: '', inbound_calls: '14', answer_calls: '12', abandon_calls: '2' },
    ],
  });
}
const filasMes = (mes) => db.prepare('SELECT fecha, skillName, totalLlamadas, contestadas, llamadasAbandonadas, serviceLevel20secPct, asaSegundos, ataSegundos, ahtSegundos, archivoNombre FROM calidad_nivel_servicio_diario WHERE campana = ? AND substr(fecha,1,7) = ? ORDER BY fecha, skillName').all(R, mes);
const contar = (sql, ...a) => db.prepare(sql).get(...a).n;
let nFranja = 0;
const franja = () => 'prueba ' + (++nFranja);

test('plan: mes en curso hasta ayer; los dias 1 a 3 tambien el mes anterior completo', () => {
  const p = auto.plan(AHORA);
  assert.equal(p.length, 1);
  assert.equal(p[0].mes, '2026-11');
  assert.equal(p[0].dias.length, 17);
  assert.equal(p[0].dias[0], '2026-11-01');
  assert.equal(p[0].dias[16], '2026-11-17');
  // 2 de diciembre: noviembre completo (30) + 1 de diciembre.
  const d2 = auto.plan(new Date('2026-12-02T12:00:00Z'));
  assert.deepEqual(d2.map((x) => [x.mes, x.dias.length]), [['2026-11', 30], ['2026-12', 1]]);
  // 1 de enero: solo diciembre del año anterior.
  assert.deepEqual(auto.plan(new Date('2027-01-01T12:00:00Z')).map((x) => [x.mes, x.dias.length]), [['2026-12', 31]]);
  // 4 de marzo: ya no pide febrero.
  assert.deepEqual(auto.plan(new Date('2027-03-04T12:00:00Z')).map((x) => [x.mes, x.dias.length]), [['2027-03', 3]]);
  // A las 23:30 de Colombia del 3 (04:30 UTC del 4) sigue siendo el dia 3.
  assert.equal(auto.plan(new Date('2026-12-04T04:30:00Z'))[0].mes, '2026-11');
});

test('franjas: solo 7:00 a 7:59 y 13:00 a 13:59 hora Colombia', () => {
  assert.equal(auto.franjaActual(new Date('2026-11-18T12:00:00Z')), '2026-11-18 07');
  assert.equal(auto.franjaActual(new Date('2026-11-18T12:59:59Z')), '2026-11-18 07');
  assert.equal(auto.franjaActual(new Date('2026-11-18T18:15:00Z')), '2026-11-18 13');
  for (const h of ['11:59:59', '13:00:00', '17:59:00', '19:00:00', '05:00:00']) {
    assert.equal(auto.franjaActual(new Date('2026-11-18T' + h + 'Z')), null, h);
  }
});

test('lector de skill_1: porcentajes, tiempos, fila de total y campos faltantes', () => {
  assert.equal(auto.aPorcentaje('75.3 %'), 75.3);
  assert.equal(auto.aPorcentaje('75,3%'), 75.3);
  assert.equal(auto.aSegundos('0:1:5'), 65);
  assert.equal(auto.aSegundos('01:00:00'), 3600);
  assert.equal(auto.aSegundos('12'), 12);
  const c = auto.convertirFila({ Skill_Name: ' X ', Inbound_Calls: '5', ANSWER_CALLS: 3, asa: 'raro' }, '2026-11-02');
  assert.deepEqual(c.fila, { fecha: '2026-11-02', skillName: 'X', totalLlamadas: 5, contestadas: 3 });
  assert.equal(auto.convertirFila({ skill_name: '', inbound_calls: '5', answer_calls: '3' }, 'd').omitida, true);
  assert.ok(auto.convertirFila({ skill_name: 'X', calls_total_raro: '5' }, 'd').error);
  assert.deepEqual(auto.filasDelDia({ code: 200, msg: '0 records were found' }, 'd'), { filas: [], omitidas: 0, sinLlamadas: 0 });
  assert.throws(() => auto.filasDelDia({ code: 500, msg: 'otra cosa' }, 'd'), (e) => e.codigo === 'respuesta_invalida');
});

test('corrida completa: pide skill_1 un dia por consulta, reemplaza el mes de la replica con respaldo, conserva AHT y no toca Mobilize', async () => {
  // «Archivo manual» previo en la replica: AHT del 3 de noviembre para la skill A y una fila que ya no vendra.
  cargarNivelServicioDiario(db, { campana: R, sede: null, archivoNombre: 'manual inventado', cargadoPorNombre: 'Prueba', filas: [
    { fecha: '2026-11-03', skillName: SKILL_A, totalLlamadas: 1, contestadas: 1, ahtSegundos: 200 },
    { fecha: '2026-11-05', skillName: 'SKILL VIEJA INVENTADA', totalLlamadas: 3, contestadas: 3 },
  ] });
  const mobAntes = contar("SELECT COUNT(*) n FROM calidad_nivel_servicio_diario WHERE campana = 'MOBILIZE'");
  const octAntes = filasMes('2026-10').length;
  const versionesAntes = contar('SELECT COUNT(*) n FROM cargas_versiones WHERE campana = ?', R);
  const usoAntes = wv.usoDelDia(db, 'MOBILIZE', AHORA);
  const falso = crearFalso(diaNormal);
  const logs = [];
  const logOrig = console.log;
  console.log = (...a) => { logs.push(a.join(' ')); };
  let r;
  try {
    r = await auto.correrUnaVez({ db, env: ENV, ahora: AHORA, fetchImpl: falso.fetch, franja: franja(), logEvent: require('../routes/shared').logEvent });
  } finally { console.log = logOrig; }

  assert.equal(r.estado, 'ok', r.detalle);
  assert.equal(falso.llamadas, 17);
  assert.equal(r.consultas, 17);
  assert.equal(wv.usoDelDia(db, 'MOBILIZE', AHORA) - usoAntes, 17);
  // Cada consulta: skill_1, un dia completo, token solo en el encabezado.
  const u = new URL(falso.urls[2]);
  assert.equal(u.searchParams.get('api'), 'skill_1');
  assert.equal(u.searchParams.get('date_ini'), '20261103000000');
  assert.equal(u.searchParams.get('date_end'), '20261103235959');
  assert.ok(!falso.urls[2].includes(TOKEN));
  assert.equal(falso.headers[2]['wolkvox-token'], TOKEN);

  const filas = filasMes('2026-11');
  assert.equal(filas.length, 34); // 17 dias x 2 skills; la fila de total no entra y la skill vieja sale
  assert.ok(!filas.some((f) => f.skillName === 'SKILL VIEJA INVENTADA' || f.skillName === ''));
  const a3 = filas.find((f) => f.fecha === '2026-11-03' && f.skillName === SKILL_A);
  assert.deepEqual(
    { t: a3.totalLlamadas, c: a3.contestadas, ab: a3.llamadasAbandonadas, sl: a3.serviceLevel20secPct, asa: a3.asaSegundos, ata: a3.ataSegundos, aht: a3.ahtSegundos, arch: a3.archivoNombre },
    { t: 10, c: 8, ab: 2, sl: 75, asa: 12, ata: 90, aht: 200, arch: auto.ARCHIVO }
  );
  assert.equal(filas.find((f) => f.fecha === '2026-11-04' && f.skillName === SKILL_A).ahtSegundos, null); // sin archivo manual: vacio, no inventado
  assert.ok(contar('SELECT COUNT(*) n FROM cargas_versiones WHERE campana = ?', R) > versionesAntes, 'respaldo antes de reemplazar');
  assert.equal(contar("SELECT COUNT(*) n FROM calidad_nivel_servicio_diario WHERE campana = 'MOBILIZE'"), mobAntes);
  assert.equal(filasMes('2026-10').length, octAntes);
  const mensual = db.prepare('SELECT llamadasTotales FROM calidad_nivel_servicio WHERE campana = ? AND mes = ?').get(R, '2026-11');
  assert.equal(mensual.llamadasTotales, 17 * 14);

  // Historial y logs: sin token, sin servidor, sin nombres de skills.
  const h = db.prepare("SELECT actor, detalle FROM historial WHERE accion = 'WOLKVOX_AUTO' ORDER BY id DESC LIMIT 1").get();
  assert.ok(h && /2026-11: 17 días, 34 filas, 2 skills/.test(h.detalle), h && h.detalle);
  assert.equal(h.actor, auto.QUIEN);
  const todo = logs.join('\n') + '\n' + h.detalle;
  for (const s of [TOKEN, SERVIDOR, SKILL_A, SKILL_B, 'wolkvox.com']) assert.ok(!todo.includes(s), 'se filtro ' + s);
});

test('la misma franja no corre dos veces', async () => {
  const f = franja();
  const falso = crearFalso(diaNormal);
  assert.equal((await auto.correrUnaVez({ db, env: ENV, ahora: AHORA, fetchImpl: falso.fetch, franja: f })).estado, 'ok');
  const n = falso.llamadas;
  assert.equal((await auto.correrUnaVez({ db, env: ENV, ahora: AHORA, fetchImpl: falso.fetch, franja: f })).estado, 'ya_corrida');
  assert.equal(falso.llamadas, n);
});

test('Wolkvox no responde (tiempo agotado): una sola consulta, lo registra, no reintenta y no toca el mes', async () => {
  const antes = filasMes('2026-11');
  const falso = crearFalso((url, opts) => new Promise((_, mal) => {
    opts.signal.addEventListener('abort', () => mal(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  }));
  const r = await auto.correrUnaVez({ db, env: { ...ENV, WOLKVOX_TIEMPO_MAXIMO_MS: '30' }, ahora: AHORA, fetchImpl: falso.fetch, franja: franja(), logEvent: require('../routes/shared').logEvent });
  assert.equal(r.estado, 'error');
  assert.equal(r.error, 'tiempo_agotado');
  assert.equal(falso.llamadas, 1, 'no reintenta ni sigue con los otros dias');
  assert.deepEqual(filasMes('2026-11'), antes);
  const h = db.prepare("SELECT detalle FROM historial WHERE accion = 'WOLKVOX_AUTO' ORDER BY id DESC LIMIT 1").get();
  assert.match(h.detalle, /error tiempo_agotado .*mes sin cambios, sin reintento/);
  assert.equal(db.prepare('SELECT estado FROM wolkvox_auto_corridas ORDER BY inicio DESC, rowid DESC LIMIT 1').get().estado, 'error');
});

test('falla a mitad de mes (sin conexion el dia 9): el mes no se reemplaza; 401 tampoco se reintenta', async () => {
  const antes = filasMes('2026-11');
  const falso = crearFalso((url, o, f) => (f.llamadas === 9 ? Promise.reject(Object.assign(new Error('x'), { cause: { code: 'ECONNRESET' } })) : diaNormal()));
  const r = await auto.correrUnaVez({ db, env: ENV, ahora: AHORA, fetchImpl: falso.fetch, franja: franja() });
  assert.equal(r.error, 'red');
  assert.equal(falso.llamadas, 9);
  assert.deepEqual(filasMes('2026-11'), antes);
  const f401 = crearFalso(() => Promise.resolve({ status: 401, json: () => Promise.resolve({}) }));
  const r2 = await auto.correrUnaVez({ db, env: ENV, ahora: AHORA, fetchImpl: f401.fetch, franja: franja() });
  assert.equal(r2.error, 'autorizacion');
  assert.equal(f401.llamadas, 1);
});

test('respuesta con campos desconocidos: el mes no cambia y el Historial dice solo los NOMBRES de los campos', async () => {
  const antes = filasMes('2026-11');
  const falso = crearFalso(() => ok({ code: 200, msg: '1 records were found', data: [{ skill_name: SKILL_A, llamadas_x: '5', otro_campo: 'valor secreto inventado' }] }));
  const r = await auto.correrUnaVez({ db, env: ENV, ahora: AHORA, fetchImpl: falso.fetch, franja: franja(), logEvent: require('../routes/shared').logEvent });
  assert.equal(r.error, 'respuesta_invalida');
  assert.equal(falso.llamadas, 1);
  assert.deepEqual(filasMes('2026-11'), antes);
  const h = db.prepare("SELECT detalle FROM historial WHERE accion = 'WOLKVOX_AUTO' ORDER BY id DESC LIMIT 1").get().detalle;
  assert.match(h, /campos: llamadas_x,otro_campo,skill_name/);
  assert.ok(!h.includes('valor secreto inventado') && !h.includes(SKILL_A));
});

test('validacion del mes: contestadas mayor que el total -> no reemplaza', async () => {
  const antes = filasMes('2026-11');
  const falso = crearFalso(() => ok({ code: 200, data: [{ skill_name: SKILL_A, inbound_calls: '3', answer_calls: '9' }] }));
  const r = await auto.correrUnaVez({ db, env: ENV, ahora: AHORA, fetchImpl: falso.fetch, franja: franja() });
  assert.equal(r.estado, 'error');
  assert.equal(r.meses[0].estado, 'invalido');
  assert.deepEqual(filasMes('2026-11'), antes);
});

test('tope diario: si lo que hay que pedir no cabe, no consulta nada', async () => {
  const falso = crearFalso(diaNormal);
  const usadas = wv.usoDelDia(db, 'MOBILIZE', AHORA);
  const r = await auto.correrUnaVez({ db, env: { ...ENV, WOLKVOX_MAX_CONSULTAS_DIA: String(usadas + 16) }, ahora: AHORA, fetchImpl: falso.fetch, franja: franja() });
  assert.equal(r.estado, 'omitida');
  assert.equal(falso.llamadas, 0);
  assert.match(r.detalle, /no alcanza el tope del día/);
  // Nunca por encima de 3000 aunque se configure mas.
  assert.equal(wv.topeDiario({ WOLKVOX_MAX_CONSULTAS_DIA: '9999' }), 3000);
  assert.equal(wv.topeDiario({}), 2800);
});

test('sin token/servidor: no consulta y lo registra', async () => {
  const falso = crearFalso(diaNormal);
  const r = await auto.correrUnaVez({ db, env: { NODE_ENV: 'test' }, ahora: AHORA, fetchImpl: falso.fetch, franja: franja() });
  assert.equal(r.estado, 'omitida');
  assert.equal(falso.llamadas, 0);
});

test('programador: apagado no consulta ni deja rastro; encendido corre una vez por franja; fuera de franja nada; SSM caido no corre', async () => {
  const filasCorridas = () => contar('SELECT COUNT(*) n FROM wolkvox_auto_corridas');
  let ahora = new Date('2026-11-19T12:05:00Z'); // 19/11 07:05 Colombia
  let encendido = false;
  const falso = crearFalso(diaNormal);
  const p = auto.iniciar(db, { env: ENV, reloj: () => ahora, leerInterruptor: async () => encendido, fetchImpl: falso.fetch, cadaMs: 3600 * 1000 });
  try {
    const n0 = filasCorridas();
    assert.equal(await p.tick(), null);
    assert.equal(falso.llamadas, 0);
    assert.equal(filasCorridas(), n0, 'apagado no deja rastro');

    encendido = true;
    ahora = new Date('2026-11-19T18:10:00Z'); // 13:10
    const r = await p.tick();
    assert.equal(r.estado, 'ok');
    assert.equal(falso.llamadas, 18);
    ahora = new Date('2026-11-19T18:40:00Z'); // misma franja
    assert.equal(await p.tick(), null);
    assert.equal(falso.llamadas, 18);
    ahora = new Date('2026-11-19T20:00:00Z'); // 15:00, fuera de franja
    assert.equal(await p.tick(), null);
    assert.equal(falso.llamadas, 18);
  } finally { p.detener(); }

  // Interruptor ilegible (SSM caido): no corre.
  const errores = [];
  const errOrig = console.error;
  console.error = (...a) => errores.push(a.join(' '));
  const p2 = auto.iniciar(db, { env: ENV, reloj: () => new Date('2026-11-20T12:01:00Z'), leerInterruptor: async () => { throw Object.assign(new Error('x'), { name: 'AccessDeniedException' }); }, fetchImpl: falso.fetch, cadaMs: 3600 * 1000 });
  try {
    assert.equal(await p2.tick(), null);
  } finally { p2.detener(); console.error = errOrig; }
  assert.equal(falso.llamadas, 18);
  assert.ok(errores.some((e) => /no se pudo leer el interruptor en SSM \(AccessDeniedException\)/.test(e)));
});

test('interruptor local (sin SSM): solo «1» enciende', async () => {
  assert.equal(await auto.leerInterruptor({ WOLKVOX_AUTO_ACTIVO: '1' }), true);
  assert.equal(await auto.leerInterruptor({ WOLKVOX_AUTO_ACTIVO: ' 1\n' }), true);
  for (const v of [undefined, '', '0', 'si', 'true', '11']) assert.equal(await auto.leerInterruptor({ WOLKVOX_AUTO_ACTIVO: v }), false, String(v));
});

test('estado del administrador: horarios y ultima corrida, sin secretos; el resto sigue sin acceso', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const r = await request(app).get('/api/wolkvox/estado?campana=' + encodeURIComponent(R)).set({ Authorization: 'Bearer ' + admin });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.auto.horariosColombia, ['07:00', '13:00']);
  assert.equal(r.body.auto.reporte, 'skill_1');
  assert.ok(r.body.auto.ultimaCorrida && r.body.auto.ultimaCorrida.franja);
  assert.ok(r.body.reportes.includes('skill_1'));
  const txt = JSON.stringify(r.body);
  for (const s of [TOKEN, SERVIDOR, SKILL_A]) assert.ok(!txt.includes(s));
  const m = await request(app).get('/api/wolkvox/estado?campana=MOBILIZE').set({ Authorization: 'Bearer ' + admin });
  assert.equal(m.status, 404);
});
