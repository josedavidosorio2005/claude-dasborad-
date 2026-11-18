// fase363-malla-puntualidad.test.js — Fase 363 (Malla fase 2): puntualidad con el login de
// Wolkvox (agent_7). Solo la replica «MOBILIZE PRUEBAS API» (con las asesoras de MOBILIZE, solo
// lectura). Wolkvox FALSO; personas, agentes y horas INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const P = require('../puntualidad');
const auto = require('../wolkvox-auto');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const R = 'MOBILIZE PRUEBAS API';
const S = '2030-02-04'; // lunes, lejos de «hoy»
const HOR = { 1: { entrada: '08:00', salida: '17:00' }, 2: { entrada: '08:00', salida: '17:00' }, 3: { entrada: '08:00', salida: '17:00' }, 4: null, 5: { entrada: '08:00', salida: '17:00' }, 6: null, 7: null };
const ENV = { NODE_ENV: 'test', WOLKVOX_MOBILIZE_TOKEN: 'TOKEN-FALSO-363-no-es-real-0123456789', WOLKVOX_MOBILIZE_SERVIDOR: 'servidorfalso363' };
function crear(user, rol, perms, camp) {
  const r = db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password, asesorCampana) VALUES (?,?,?,1,?,?,?,0,?)`)
    .run('Persona Inventada ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), new Date().toISOString(), camp || null);
  return Number(r.lastInsertRowid);
}
const id = {}, tk = {};
let grupoId;
before(async () => {
  id.a1 = crear('f363_a1', 'ASESOR', {}, 'MOBILIZE');
  id.a2 = crear('f363_a2', 'ASESOR', {}, 'MOBILIZE');
  id.a3 = crear('f363_a3', 'ASESOR', {}, 'MOBILIZE');
  crear('f363_supm', 'SUPERVISOR', { supervisa_MOBILIZE: true });
  crear('f363_rep', 'REPORTES', { Calidad: true, campana_MOBILIZE: true });
  crear('f363_cli', 'CLIENTES_DASH', { ClientesDash: true, cliente_MOBILIZE: true });
  tk.master = await tokenFor('admin', MASTER_PASSWORD);
  for (const u of ['supm', 'rep', 'cli', 'a1', 'a2']) tk[u] = await tokenFor('f363_' + u, 'Clave#2026x');
});

test('lector de agent_7: varias sesiones -> primer login, último logout, sesiones y tiempo', () => {
  assert.equal(P.momento('2030-02-04 7:59:58'), '2030-02-04 07:59:58');
  assert.equal(P.momento('08:01', '20300204'), '2030-02-04 08:01:00');
  assert.equal(P.momento('0000-00-00 00:00:00'), null);
  assert.equal(P.segundosDe('1:02:03'), 3723);
  const r = P.resumirSesiones([
    { agent_id: '9001', agent_name: 'AGENTE INVENTADO UNO', date: '2030-02-04', login: '2030-02-04 12:30:00', logout: '2030-02-04 17:05:00', login_time: '4:35:00' },
    { agent_id: '9001', agent_name: 'AGENTE INVENTADO UNO', date: '2030-02-04', login: '2030-02-04 07:59:58', logout: '2030-02-04 12:00:00', login_time: '4:00:02' },
    { AGENT_ID: '9002', AGENT_NAME: 'AGENTE INVENTADO DOS', DATE: '2030-02-04', LOGIN: '2030-02-04 08:00:01', LOGOUT: '', LOGIN_TIME: '' },
  ]);
  const a = r.dias.get('2030-02-04|9001');
  assert.deepEqual([a.primerLogin, a.ultimoLogout, a.sesiones, a.segundos], ['2030-02-04 07:59:58', '2030-02-04 17:05:00', 2, 30902]);
  const b = r.dias.get('2030-02-04|9002');
  assert.deepEqual([b.primerLogin, b.ultimoLogout, b.sesiones], ['2030-02-04 08:00:01', null, 1]);
  assert.ok(P.resumirSesiones([{ agent_id: '1', login: 'raro' }]).error);
  assert.ok(P.resumirSesiones('no').error);
});

test('estado del día: tolerancia cero, sin ingreso, pendiente, excepción, sin enlace y salida anticipada aparte', () => {
  const base = { fecha: '2030-02-04', turno: { entrada: '08:00', salida: '17:00' }, enlazado: true, excepcion: null, ahora: '2030-02-05 10:00:00', hastaDatos: '2030-02-05 07:00:00' };
  const L = (p, u) => ({ primerLogin: '2030-02-04 ' + p, ultimoLogout: u ? '2030-02-04 ' + u : null });
  assert.equal(P.estadoDelDia({ ...base, login: L('08:00:00', '17:00:00') }).estado, 'a_tiempo');
  assert.deepEqual(P.estadoDelDia({ ...base, login: L('08:00:01', '17:30:00') }), { estado: 'tarde', tardeSeg: 1, salidaAnticipadaSeg: null });
  assert.deepEqual(P.estadoDelDia({ ...base, login: L('07:50:00', '16:35:00') }), { estado: 'a_tiempo', tardeSeg: null, salidaAnticipadaSeg: 1500 });
  assert.equal(P.estadoDelDia({ ...base, login: null }).estado, 'sin_ingreso');
  // Datos de login que no llegan hasta la hora de entrada: aún no se puede decir «Sin ingreso».
  assert.equal(P.estadoDelDia({ ...base, login: null, hastaDatos: '2030-02-04 07:00:00' }).estado, 'pendiente');
  assert.equal(P.estadoDelDia({ ...base, login: null, ahora: '2030-02-04 07:59:59' }).estado, 'pendiente');
  // Salida anticipada solo cuando los datos cubren la hora de salida.
  assert.equal(P.estadoDelDia({ ...base, login: L('07:50:00', '12:00:00'), hastaDatos: '2030-02-04 13:00:00' }).salidaAnticipadaSeg, null);
  assert.equal(P.estadoDelDia({ ...base, login: null, excepcion: { id: 1 } }).estado, 'excepcion');
  assert.equal(P.estadoDelDia({ ...base, login: null, enlazado: false }).estado, 'sin_enlace');
});

test('la réplica usa las asesoras de MOBILIZE solo para leerlas; sus cuentas no cambian', async () => {
  const g = await request(app).post('/api/malla/grupos').set(H(tk.master)).send({ campana: R, semana: S, nombre: 'Mañana', horario: HOR });
  assert.equal(g.status, 201, JSON.stringify(g.body));
  grupoId = g.body.grupo.id;
  const a = await request(app).put('/api/malla/grupos/' + grupoId + '/asesoras').set(H(tk.master)).send({ asesoras: [id.a1, id.a2, id.a3] });
  assert.equal(a.status, 200, JSON.stringify(a.body));
  for (const k of ['a1', 'a2', 'a3']) assert.equal(db.prepare('SELECT asesorCampana FROM users WHERE id = ?').get(id[k]).asesorCampana, 'MOBILIZE');
  // La asesora no ve los turnos de la réplica en «Mi malla» (su campaña es MOBILIZE).
  const mia = await request(app).get('/api/malla/mia').set(H(tk.a1));
  assert.ok(mia.body.semanas.every((s) => s.turno === null));
});

test('consulta automática de agent_7: un tramo hasta ahora, guarda el resumen, Historial sin nombres', async () => {
  const urls = [];
  const fetchImpl = (url) => {
    urls.push(url);
    return Promise.resolve({ status: 200, json: () => Promise.resolve({ code: 200, msg: '3 records were found', data: [
      { agent_id: '9001', agent_name: 'Persona Inventada f363_a1', date: '2030-02-04', login: '2030-02-04 07:59:58', logout: '2030-02-04 12:00:00', login_time: '4:00:02' },
      { agent_id: '9001', agent_name: 'Persona Inventada f363_a1', date: '2030-02-04', login: '2030-02-04 12:30:00', logout: '2030-02-04 16:40:00', login_time: '4:10:00' },
      { agent_id: '9002', agent_name: 'AGENTE INVENTADO SIN PAR', date: '2030-02-05', login: '2030-02-05 08:03:00', logout: '2030-02-05 17:00:00', login_time: '8:57:00' },
    ] }) });
  };
  const ahora = new Date('2030-02-10T15:00:00Z'); // 10/02 10:00 Colombia
  const r = await auto.correrLogin({ db, env: ENV, ahora, fetchImpl, franja: 'f363-1', logEvent: require('../routes/shared').logEvent });
  assert.equal(r.estado, 'ok', r.detalle);
  assert.equal(urls.length, 1);
  const u = new URL(urls[0]);
  assert.deepEqual(Object.fromEntries(u.searchParams), { api: 'agent_7', date_ini: '20300201000000', date_end: '20300210100000' });
  assert.equal(db.prepare("SELECT COUNT(*) n FROM wolkvox_login_diario WHERE operacion = 'MOBILIZE'").get().n, 2);
  assert.equal(db.prepare("SELECT hasta FROM wolkvox_login_hasta WHERE operacion = 'MOBILIZE'").get().hasta, '2030-02-10 10:00:00');
  const h = db.prepare("SELECT detalle FROM historial WHERE accion = 'WOLKVOX_LOGIN' ORDER BY id DESC LIMIT 1").get().detalle;
  assert.match(h, /2030-02: 3 sesiones, 2 agentes, 2 agente-días/);
  assert.ok(!h.includes('Inventad') && !h.includes('9001'));
  // Días 1 a 3: también el mes anterior (2 consultas).
  assert.equal(auto.planLogin(new Date('2030-03-02T15:00:00Z')).length, 2);
});

test('agent_7 con error o respuesta rara: no cambia nada y no reintenta', async () => {
  const antes = db.prepare('SELECT * FROM wolkvox_login_diario ORDER BY fecha, agentId').all();
  let n = 0;
  const raro = () => { n++; return Promise.resolve({ status: 200, json: () => Promise.resolve({ code: 200, msg: '1 records were found', data: [{ agente: 'x', entrada: 'y' }] }) }); };
  const r = await auto.correrLogin({ db, env: ENV, ahora: new Date('2030-02-10T15:00:00Z'), fetchImpl: raro, franja: 'f363-2' });
  assert.equal(r.estado, 'error');
  assert.match(r.detalle, /campos: agente,entrada/);
  let m = 0;
  const caido = () => { m++; return Promise.reject(Object.assign(new Error('x'), { cause: { code: 'ECONNRESET' } })); };
  const r2 = await auto.correrLogin({ db, env: ENV, ahora: new Date('2030-02-10T15:00:00Z'), fetchImpl: caido, franja: 'f363-3' });
  assert.equal(r2.error, 'red');
  assert.deepEqual([n, m], [1, 1]);
  assert.deepEqual(db.prepare('SELECT * FROM wolkvox_login_diario ORDER BY fecha, agentId').all(), antes);
});

test('programador: el login corre solo con WOLKVOX_LOGIN_ACTIVO, aparte del Flujo', async () => {
  let llamadas = [];
  const fetchImpl = (url) => { llamadas.push(new URL(url).searchParams.get('api')); return Promise.resolve({ status: 200, json: () => Promise.resolve({ code: 200, msg: '0 records were found', data: [] }) }); };
  const p = auto.iniciar(db, { env: ENV, reloj: () => new Date('2030-02-11T12:05:00Z'), leerInterruptor: async (e, n) => n === 'WOLKVOX_LOGIN_ACTIVO', fetchImpl, cadaMs: 3600 * 1000 });
  try { await p.tick(); } finally { p.detener(); }
  assert.deepEqual(llamadas, ['agent_7']);
  llamadas = [];
  const p2 = auto.iniciar(db, { env: ENV, reloj: () => new Date('2030-02-11T18:05:00Z'), leerInterruptor: async () => false, fetchImpl, cadaMs: 3600 * 1000 });
  try { await p2.tick(); } finally { p2.detener(); }
  assert.deepEqual(llamadas, []);
});

test('enlazar agentes: solo quien edita; una asesora, un agente; Historial', async () => {
  const ag = await request(app).get('/api/malla/agentes?campana=' + encodeURIComponent(R)).set(H(tk.master));
  assert.equal(ag.status, 200);
  const a9001 = ag.body.agentes.find((x) => x.agentId === '9001');
  assert.equal(a9001.sugerencia, id.a1, 'nombre exacto: sugerida, no enlazada');
  assert.equal(a9001.userId, null);
  const put = (t, agentId, userId) => request(app).put('/api/malla/agentes/' + agentId).set(H(t)).send({ campana: R, userId });
  assert.equal((await put(tk.master, '9001', id.a1)).status, 200);
  assert.equal((await put(tk.master, '9002', id.a1)).status, 409, 'la asesora ya tiene agente');
  assert.equal((await put(tk.master, '9999', id.a2)).status, 404, 'agente sin datos');
  assert.equal((await put(tk.master, '9002', 999999)).status, 400);
  for (const k of ['supm', 'rep', 'cli', 'a1']) assert.ok([403, 404].includes((await put(tk[k], '9002', id.a2)).status), k);
  const h = db.prepare("SELECT nombre, detalle FROM historial WHERE accion = 'MALLA_ENLACE' ORDER BY id DESC LIMIT 1").get();
  assert.deepEqual(h, { nombre: 'Persona Inventada f363_a1', detalle: 'agente 9001' });
});

test('excepciones por día o rango, con Historial; quitar también queda', async () => {
  const post = (t, b) => request(app).post('/api/malla/excepciones').set(H(t)).send({ campana: R, ...b });
  assert.equal((await post(tk.master, { userId: id.a2, tipo: 'vacaciones', desde: '2030-02-05', hasta: '2030-02-08' })).status, 201);
  const uno = await post(tk.master, { userId: id.a3, tipo: 'permiso', desde: '2030-02-04' });
  assert.equal(uno.status, 201);
  assert.equal((await post(tk.master, { userId: id.a2, tipo: 'paseo', desde: '2030-02-05' })).status, 400);
  assert.equal((await post(tk.master, { userId: id.a2, tipo: 'permiso', desde: '2030-02-09', hasta: '2030-02-05' })).status, 400);
  assert.equal((await post(tk.master, { userId: id.a2, tipo: 'permiso', desde: '2030-02-01', hasta: '2030-06-01' })).status, 400);
  assert.ok([403, 404].includes((await post(tk.supm, { userId: id.a2, tipo: 'permiso', desde: '2030-02-05' })).status));
  assert.match(db.prepare("SELECT detalle FROM historial WHERE accion = 'MALLA_EXCEPCION' ORDER BY id DESC LIMIT 1").get().detalle, /^Permiso · 2030-02-04$/);
  const tmp = await post(tk.master, { userId: id.a3, tipo: 'incapacidad', desde: '2030-02-11' });
  assert.equal((await request(app).delete('/api/malla/excepciones/' + tmp.body.id).set(H(tk.master))).status, 200);
  assert.ok(db.prepare("SELECT 1 FROM historial WHERE accion = 'MALLA_EXCEPCION_QUITADA'").get());
});

test('puntualidad de la semana: estados por asesora y día; el cliente y la asesora no la ven', async () => {
  const r = await request(app).get('/api/malla/puntualidad?campana=' + encodeURIComponent(R) + '&semana=' + S).set(H(tk.master));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const est = (uid, fecha) => (r.body.filas.find((f) => f.userId === uid && f.fecha === fecha) || {}).estado;
  assert.equal(est(id.a1, '2030-02-04'), 'a_tiempo'); // 07:59:58, primer login
  const f = r.body.filas.find((x) => x.userId === id.a1 && x.fecha === '2030-02-04');
  assert.equal(f.salidaAnticipadaSeg, 1200); // último logout 16:40 vs 17:00, dato aparte
  // La ruta usa la hora real: un día de 2030 sin login todavía es «Pendiente».
  assert.equal(est(id.a1, '2030-02-05'), 'pendiente');
  // Con «ahora» después del turno y datos hasta el 10/02: «Sin ingreso».
  const c = P.calcular(db, R, S, '2030-02-10', { ahora: '2030-02-10 10:00:00' });
  assert.equal(c.filas.find((x) => x.userId === id.a1 && x.fecha === '2030-02-05').estado, 'sin_ingreso');
  assert.deepEqual([c.resumen.a_tiempo, c.resumen.sin_ingreso, c.resumen.excepcion, c.resumen.sin_enlace, c.resumen.salidaAnticipada], [1, 3, 4, 4, 1]);
  assert.equal(est(id.a2, '2030-02-05'), 'excepcion');
  assert.equal(est(id.a3, '2030-02-04'), 'excepcion');
  assert.equal(est(id.a3, '2030-02-05'), 'sin_enlace');
  assert.equal(est(id.a1, '2030-02-07'), undefined, 'jueves es descanso');
  assert.ok(r.body.agentesSinEnlace.some((x) => x.agentId === '9002'));
  for (const k of ['supm', 'cli', 'a1']) assert.ok([403, 404].includes((await request(app).get('/api/malla/puntualidad?campana=' + encodeURIComponent(R) + '&semana=' + S).set(H(tk[k]))).status), k);
  assert.equal((await request(app).get('/api/malla/puntualidad?campana=MOBILIZE&semana=' + S).set(H(tk.master))).status, 404, 'MOBILIZE real todavía no');
});

test('Mi puntualidad: en la réplica nadie la ve; con una campaña que lo permita, solo lo suyo', async () => {
  assert.deepEqual((await request(app).get('/api/malla/mi-puntualidad').set(H(tk.a1))).body.semanas, []);
  assert.deepEqual((await request(app).get('/api/malla/mi-puntualidad').set(H(tk.supm))).body.semanas, []);
  P._configurarParaPruebas({ [R]: { operacion: 'MOBILIZE', asesorasDe: 'MOBILIZE', asesoraVe: true } });
  try {
    const r = await request(app).get('/api/malla/mi-puntualidad').set(H(tk.a1));
    assert.equal(r.status, 200);
    assert.equal(r.body.semanas.length, 2);
    assert.ok(!r.text.includes('f363_a2') && !r.text.includes('f363_a3') && !r.text.includes('userId'));
  } finally { P._configurarParaPruebas(null); }
});

test('navegador: textos de los estados y tabla escapada', () => {
  global.mallaFechaDelDia = require('../../public/js/malla-logic.js').mallaFechaDelDia;
  global.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  try {
    const UI = require(path.join(__dirname, '..', '..', 'public', 'js', 'malla-puntualidad.js'));
    assert.deepEqual(UI.mpEstadoTexto({ estado: 'tarde', tardeSeg: 61, primerLogin: '08:01:01' }), { texto: '! Tarde 1 min 1 s · 08:01', clase: 'vis-amarillo' });
    assert.equal(UI.mpEstadoTexto({ estado: 'excepcion', excepcion: { tipo: 'vacaciones' } }, { vacaciones: 'Vacaciones' }).texto, 'Vacaciones');
    assert.equal(UI.mpSalidaTexto({ salidaAnticipadaSeg: 1500 }), 'Salió 25 min antes');
    const html = UI.mpTablaHtml({ semana: S, tipos: {}, filas: [{ userId: 1, nombre: '<b>X</b>', fecha: S, entrada: '08:00', salida: '17:00', estado: 'sin_ingreso' }] });
    assert.ok(html.includes('&lt;b&gt;X&lt;/b&gt;') && !html.includes('<b>X'));
    assert.match(html, /✕ Sin ingreso/);
  } finally { delete global.mallaFechaDelDia; delete global.esc; }
});
