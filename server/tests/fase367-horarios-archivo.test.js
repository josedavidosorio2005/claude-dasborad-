// fase367-horarios-archivo.test.js — Fase 367 (pedido de Edwin 18/11, D2): puntualidad por ARCHIVO
// (reporte de Login/Logout de Wolkvox, «HistAgent») para la réplica y SURA. Mismo lector y mismo
// cálculo que la API (agent_7). Enlace por nombre exacto; los que no coinciden, aparte. Personas,
// agentes y horas INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const P = require('../puntualidad');
const auto = require('../wolkvox-auto');
const H = require('../../public/js/horarios-logic.js');

const HD = (t) => ({ Authorization: 'Bearer ' + t });
const S = '2030-03-04'; // lunes
const HOR = { 1: { entrada: '08:00', salida: '17:00' }, 2: { entrada: '08:00', salida: '17:00' }, 3: null, 4: null, 5: null, 6: null, 7: null };
// Serial de Excel de «AAAA-MM-DD HH:MM:SS» (como lo trae el archivo real).
const serial = (t) => (Date.parse(t.replace(' ', 'T') + 'Z') / 86400000) + 25569;
function crear(user, nombre, rol, perms, camp) {
  return Number(db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password, asesorCampana) VALUES (?,?,?,1,?,?,?,0,?)`)
    .run(nombre, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), new Date().toISOString(), camp || null).lastInsertRowid);
}
const id = {}, tk = {};
before(async () => {
  id.s1 = crear('f367_s1', 'Asesora Inventada Uno', 'ASESOR', {}, 'SURA');
  id.s2 = crear('f367_s2', 'Asesora Inventada Dos', 'ASESOR', {}, 'SURA');
  crear('f367_sups', 'Supervisora Inventada SURA', 'SUPERVISOR', { supervisa_SURA: true });
  crear('f367_supm', 'Supervisora Inventada MOB', 'SUPERVISOR', { supervisa_MOBILIZE: true });
  tk.admin = await tokenFor('admin', MASTER_PASSWORD);
  for (const u of ['sups', 'supm', 's1']) tk[u] = await tokenFor('f367_' + u, 'Clave#2026x');
});

// Hoja como la del archivo real: encabezado y valores crudos (fechas como serial de Excel).
const ENC = ['DATE', 'AGENT_ID', 'LOGIN', 'LOGOUT', 'LOGIN_TIME', 'AGENT_NAME', 'AGENT_DNI'];
const filaHoja = (fecha, agentId, nombre, login, logout) => [serial(fecha + ' 00:00:00'), agentId, serial(fecha + ' ' + login), serial(fecha + ' ' + logout), 0.3, nombre, 1234567890];

test('lector del archivo: columnas, fechas de Excel a texto, sin documento; columnas que faltan', () => {
  const p = H.horariosFilasDesdeHoja([ENC, filaHoja('2030-03-04', 501, 'ASESORA INVENTADA UNO', '07:59:59', '17:00:00')]);
  assert.equal(p.error, undefined);
  assert.deepEqual(p.filas[0], { agent_id: '501', agent_name: 'ASESORA INVENTADA UNO', date: '2030-03-04', login: '2030-03-04 07:59:59', logout: '2030-03-04 17:00:00', login_time: '7:12:00' });
  assert.ok(!JSON.stringify(p.filas).includes('1234567890'), 'el documento no se envía');
  assert.equal(p.mesUnico, '2030-03');
  assert.match(H.horariosFilasDesdeHoja([['DATE', 'LOGIN']]).error, /Faltan columnas: AGENT_ID/);
});

test('SURA: carga por archivo (supervisor de SURA), enlace por nombre exacto, sin coincidencia aparte, Historial', async () => {
  const g = await request(app).post('/api/malla/grupos').set(HD(tk.sups)).send({ campana: 'SURA', semana: S, nombre: 'Mañana', horario: HOR });
  assert.equal(g.status, 201, JSON.stringify(g.body));
  assert.equal((await request(app).put('/api/malla/grupos/' + g.body.grupo.id + '/asesoras').set(HD(tk.sups)).send({ asesoras: [id.s1, id.s2] })).status, 200);
  const p = H.horariosFilasDesdeHoja([ENC,
    filaHoja('2030-03-04', 501, 'Asesora Inventada Uno', '07:59:59', '17:00:00'), // a tiempo
    filaHoja('2030-03-04', 502, 'ASESORA  INVENTADA DOS', '08:00:01', '16:30:00'), // nombre igual (mayúsculas/espacios): tarde 1 s
    filaHoja('2030-03-04', 599, 'Agente Inventado Sin Par', '09:00:00', '18:00:00'),
  ]);
  const ok = await request(app).post('/api/malla/horarios/carga').set(HD(tk.sups)).send({ campana: 'SURA', mes: '2030-03', archivoNombre: 'x.xlsx', filas: p.filas });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.deepEqual(ok.body.dias, ['2030-03-04']);
  assert.deepEqual(ok.body.sinCoincidencia, ['Agente Inventado Sin Par']);
  assert.match(db.prepare("SELECT detalle FROM historial WHERE accion = 'MALLA_HORARIOS_CARGA' ORDER BY id DESC LIMIT 1").get().detalle, /^2030-03 · 1 día\(s\) · 3 agente\(s\) · 3 sesión\(es\) · 1 sin coincidencia$/);
  const c = P.calcular(db, 'SURA', S, '2030-03-05', { ahora: '2030-03-06 10:00:00' });
  const e = (u, f) => c.filas.find((x) => x.userId === u && x.fecha === f);
  assert.equal(e(id.s1, '2030-03-04').estado, 'a_tiempo');
  assert.deepEqual([e(id.s2, '2030-03-04').estado, e(id.s2, '2030-03-04').tardeSeg, e(id.s2, '2030-03-04').salidaAnticipadaSeg], ['tarde', 1, 1800]);
  assert.equal(e(id.s1, '2030-03-05').estado, 'pendiente', 'el archivo solo trae el día 4: el 5 todavía no tiene datos');
  // Botones por mes.
  const m = await request(app).get('/api/malla/horarios?campana=SURA&anio=2030').set(HD(tk.sups));
  assert.equal(m.body.meses[2].dias, 1);
  assert.equal(m.body.meses.length, 12);
});

test('reemplaza solo los días del archivo; otro mes o sin permiso: no carga', async () => {
  const dia5 = H.horariosFilasDesdeHoja([ENC, filaHoja('2030-03-05', 501, 'Asesora Inventada Uno', '07:50:00', '17:00:00')]);
  assert.equal((await request(app).post('/api/malla/horarios/carga').set(HD(tk.admin)).send({ campana: 'SURA', mes: '2030-03', filas: dia5.filas })).status, 201);
  const dias = db.prepare("SELECT fecha, COUNT(*) n FROM wolkvox_login_diario WHERE operacion = 'ARCHIVO_SURA' GROUP BY fecha ORDER BY fecha").all();
  assert.deepEqual(dias.map((d) => [d.fecha, d.n]), [['2030-03-04', 3], ['2030-03-05', 1]], 'el día 4 sigue igual');
  assert.equal((await request(app).post('/api/malla/horarios/carga').set(HD(tk.admin)).send({ campana: 'SURA', mes: '2030-04', filas: dia5.filas })).status, 400);
  for (const k of ['supm', 's1']) assert.ok([403, 404].includes((await request(app).post('/api/malla/horarios/carga').set(HD(tk[k])).send({ campana: 'SURA', mes: '2030-03', filas: dia5.filas })).status), k);
  assert.equal((await request(app).post('/api/malla/horarios/carga').set(HD(tk.admin)).send({ campana: 'ORLANT', mes: '2030-03', filas: dia5.filas })).status, 404, 'campaña sin puntualidad');
});

test('el archivo y la API (agent_7) llegan al MISMO cálculo', async () => {
  const sesiones = [
    { fecha: '2030-05-06', id: '801', nombre: 'Agente Inventado Ocho', login: '08:00:01', logout: '12:00:00' },
    { fecha: '2030-05-06', id: '801', nombre: 'Agente Inventado Ocho', login: '12:30:00', logout: '16:40:00' },
    { fecha: '2030-05-06', id: '802', nombre: 'Agente Inventado Nueve', login: '07:58:00', logout: '17:01:00' },
  ];
  const OP = P.config('MOBILIZE PRUEBAS API').operacion;
  const foto = () => db.prepare('SELECT fecha, agentId, agentName, primerLogin, ultimoLogout, sesiones, segundos FROM wolkvox_login_diario WHERE operacion = ? AND substr(fecha,1,7) = ? ORDER BY fecha, agentId').all(OP, '2030-05');
  // API: agent_7 simulado (texto «AAAA-MM-DD HH:MM:SS»).
  const fetchImpl = () => Promise.resolve({ status: 200, json: () => Promise.resolve({ code: 200, msg: '3 records were found', data: sesiones.map((s) => ({ agent_id: s.id, agent_name: s.nombre, date: s.fecha, login: s.fecha + ' ' + s.login, logout: s.fecha + ' ' + s.logout, login_time: '4:00:00' })) }) });
  const env = { NODE_ENV: 'test', WOLKVOX_MOBILIZE_TOKEN: 'TOKEN-FALSO-367-no-es-real-0123456789', WOLKVOX_MOBILIZE_SERVIDOR: 'servidorfalso367' };
  const r = await auto.correrLogin({ db, env, ahora: new Date('2030-05-07T15:00:00Z'), fetchImpl, franja: 'f367-api' });
  assert.equal(r.estado, 'ok', r.detalle);
  const porApi = foto();
  db.prepare('DELETE FROM wolkvox_login_diario WHERE operacion = ? AND substr(fecha,1,7) = ?').run(OP, '2030-05');
  // Archivo: las mismas sesiones como serial de Excel.
  const p = H.horariosFilasDesdeHoja([ENC].concat(sesiones.map((s) => [serial(s.fecha + ' 00:00:00'), Number(s.id), serial(s.fecha + ' ' + s.login), serial(s.fecha + ' ' + s.logout), 4 / 24, s.nombre, 1])));
  const c = await request(app).post('/api/malla/horarios/carga').set(HD(tk.admin)).send({ campana: 'MOBILIZE PRUEBAS API', mes: '2030-05', filas: p.filas });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  assert.deepEqual(foto(), porApi);
});

test('interfaz: la sección «Horarios» y el resultado escapan los nombres', () => {
  global.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  try {
    const UI = require(path.join(__dirname, '..', '..', 'public', 'js', 'centro-horarios.js'));
    const html = UI.ccHorariosHtml({ anio: '2030', meses: Array.from({ length: 12 }, (_, i) => ({ mes: '2030-' + String(i + 1).padStart(2, '0'), dias: i === 2 ? 2 : 0 })) });
    assert.equal((html.match(/class="cc-mes /g) || []).length, 12);
    assert.match(html, /Marzo<\/span><span class="cc-mes-dato">2 días/);
    const res = UI.ccHorariosResultadoHtml({ dias: ['2030-03-04'], agentes: 2, sesiones: 2, sinCoincidencia: ['<b>X</b>'] });
    assert.ok(res.includes('&lt;b&gt;X&lt;/b&gt;') && !res.includes('<b>X'));
  } finally { delete global.esc; }
});

test('GET /malla/horarios: sin puntualidad o sin permiso, «no disponible» (sin error en la consola)', async () => {
  assert.deepEqual((await request(app).get('/api/malla/horarios?campana=ORLANT').set(HD(tk.admin))).body, { disponible: false });
  assert.deepEqual((await request(app).get('/api/malla/horarios?campana=SURA').set(HD(tk.supm))).body, { disponible: false });
  assert.equal((await request(app).get('/api/malla/horarios?campana=SURA').set(HD(tk.sups))).body.disponible, true);
});
