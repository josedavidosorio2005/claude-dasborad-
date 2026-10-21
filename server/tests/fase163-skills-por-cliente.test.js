// fase163-skills-por-cliente.test.js — Fase 163, punto 1 (reunion con Edwin,
// 21/10): "el nombre del skill que yo suba es el que se debe reflejar". El
// cliente lo define el Centro de cargas, no un registro previo: las skills
// nuevas se registran solas para ese cliente, la skill es por cliente
// (nombre + cliente) y una skill con el mismo nombre en otro cliente nunca
// se mezcla. La pantalla de Trafico de varios clientes sigue igual. Tambien
// los numeros con separador de miles ("1,871.35" del archivo real de HLM).
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, db, request, tokenFor, MASTER_PASSWORD, SEED, cleanup } = require('./helpers');
const traficoSkills = require('../trafico-skills');
const { migrarSkillPorCliente } = require('../db');
const T = require('../../public/js/trafico-logic.js');
const W = require('../../public/js/trafico-whatsapp-logic.js');
const CC = require('../../public/js/centro-cargas-logic.js');

after(cleanup);
const auth = (t) => ({ Authorization: 'Bearer ' + t });
const HLM = 'HOSPITAL LA MARIA';
const fila = (skillName, fecha, total, contestadas, extra) => ({ fecha, skillName, totalLlamadas: total, contestadas, llamadasAbandonadas: total - contestadas, ...extra });
const foto = (campana) =>
  db
    .prepare('SELECT skillName, fecha, totalLlamadas, contestadas, serviceLevel20secPct FROM calidad_nivel_servicio_diario WHERE campana = ? ORDER BY skillName, fecha')
    .all(campana);
const mensual = (campana) => db.prepare('SELECT mes, sede, contestadas20s, llamadasTotales FROM calidad_nivel_servicio WHERE campana = ? ORDER BY mes, sede').all(campana);

test('la tabla de mapeo queda con una fila por skill y cliente (migracion idempotente)', () => {
  const cols = db.prepare('PRAGMA table_info(trafico_skill_mapeo)').all().map((c) => c.name);
  assert.deepEqual(cols, ['id', 'skillName', 'campana', 'sede', 'createdAt', 'updatedAt']);
  const now = new Date().toISOString();
  const ins = db.prepare('INSERT INTO trafico_skill_mapeo (skillName, campana, sede, createdAt, updatedAt) VALUES (?, ?, NULL, ?, ?)');
  ins.run('F163 REPETIDA', 'ORLANT', now, now);
  ins.run('F163 REPETIDA', HLM, now, now);
  assert.throws(() => ins.run('F163 REPETIDA', HLM, now, now), /UNIQUE/, 'la misma skill dos veces en el mismo cliente no');
  ins.run('F163 SIN', null, now, now);
  assert.throws(() => ins.run('F163 SIN', null, now, now), /UNIQUE/, 'una sola fila "sin asignar" por skill');
  migrarSkillPorCliente();
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM trafico_skill_mapeo WHERE skillName = 'F163 REPETIDA'").get().n, 2, 'correrla otra vez no cambia nada');
  const triggers = db.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'trafico_skill_mapeo'").all();
  assert.equal(triggers.length, 3, 'conserva los triggers de datos_version (Fase 161)');
});

test('Centro de cargas de HLM: registra solas sus skills, aunque ORLANT tenga una con el mismo nombre, y ORLANT no cambia', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  // ORLANT ya tiene "PROGRAMAS ESPECIALES F163" con datos de agosto.
  const put = await request(app).put('/api/calidad/trafico/skills/' + encodeURIComponent('PROGRAMAS ESPECIALES F163')).set(auth(t)).send({ campana: 'ORLANT' });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  const orl = await request(app)
    .post('/api/calidad/trafico/carga')
    .set(auth(t))
    .send({ filas: [fila('PROGRAMAS ESPECIALES F163', '2026-08-01', 40, 30), fila('PROGRAMAS ESPECIALES F163', '2026-08-02', 20, 19)] });
  assert.equal(orl.status, 201);
  assert.deepEqual(orl.body.campanas, ['ORLANT']);
  const orlantAntes = { diario: foto('ORLANT'), mensual: mensual('ORLANT') };
  const mobilizeAntes = { diario: foto('MOBILIZE'), mensual: mensual('MOBILIZE') };

  const body = {
    campana: HLM,
    archivoNombre: 'hlm.xlsx',
    filas: [
      fila('LINEA ENTRADA F163', '2026-08-01', 150, 60, { asaSegundos: 1871.35 }),
      fila('LINEA ENTRADA F163', '2026-08-02', 345, 190),
      fila('PROGRAMAS ESPECIALES F163', '2026-08-01', 100, 90),
    ],
  };
  const imp = await request(app).post('/api/calidad/trafico/carga/impacto').set(auth(t)).send(body);
  assert.equal(imp.status, 200, JSON.stringify(imp.body));
  assert.ok(imp.body.every((p) => p.filasExistentes === 0 && p.filasABorrar === 0), 'las filas de ORLANT con el mismo nombre no cuentan');

  const g = await request(app).post('/api/calidad/trafico/carga').set(auth(t)).send(body);
  assert.equal(g.status, 201, JSON.stringify(g.body));
  assert.deepEqual(g.body.campanas, [HLM]);
  assert.deepEqual(g.body.skillsSinAsignar, []);
  assert.deepEqual(g.body.skillsRegistradas.sort(), ['LINEA ENTRADA F163', 'PROGRAMAS ESPECIALES F163']);

  assert.deepEqual(foto(HLM).map((r) => [r.skillName, r.fecha, r.totalLlamadas]), [
    ['LINEA ENTRADA F163', '2026-08-01', 150],
    ['LINEA ENTRADA F163', '2026-08-02', 345],
    ['PROGRAMAS ESPECIALES F163', '2026-08-01', 100],
  ]);
  assert.equal(db.prepare('SELECT asaSegundos FROM calidad_nivel_servicio_diario WHERE campana = ? AND fecha = ? AND skillName = ?').get(HLM, '2026-08-01', 'LINEA ENTRADA F163').asaSegundos, 1871.35);
  assert.deepEqual({ diario: foto('ORLANT'), mensual: mensual('ORLANT') }, orlantAntes, 'ORLANT no cambia');
  assert.deepEqual({ diario: foto('MOBILIZE'), mensual: mensual('MOBILIZE') }, mobilizeAntes, 'MOBILIZE no cambia');

  const skills = (await request(app).get('/api/calidad/trafico/skills').set(auth(t))).body.filter((s) => s.skillName === 'PROGRAMAS ESPECIALES F163');
  assert.deepEqual(skills.map((s) => [s.campana, s.filas]).sort(), [[HLM, 1], ['ORLANT', 2]], 'dos mapeos, cada uno con sus filas');

  // Volver a subir el mismo archivo de HLM: reemplaza, no duplica, y ya no son nuevas.
  const otra = await request(app).post('/api/calidad/trafico/carga').set(auth(t)).send(body);
  assert.deepEqual(otra.body.skillsRegistradas, []);
  assert.equal(foto(HLM).length, 3);
  assert.deepEqual({ diario: foto('ORLANT'), mensual: mensual('ORLANT') }, orlantAntes);

  // La pantalla de Trafico de varios clientes (sin campana) sigue mandando esa skill a ORLANT (su mapeo mas viejo).
  const vieja = await request(app).post('/api/calidad/trafico/carga').set(auth(t)).send({ filas: [fila('PROGRAMAS ESPECIALES F163', '2026-08-03', 10, 9)] });
  assert.deepEqual(vieja.body.campanas, ['ORLANT']);
  assert.equal(foto(HLM).length, 3, 'HLM no recibe filas de la pantalla de varios clientes');
});

test('una skill "sin asignar" sin filas pasa a ser del cliente; con filas guardadas se deja quieta', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const now = new Date().toISOString();
  db.prepare('INSERT INTO trafico_skill_mapeo (skillName, campana, sede, createdAt, updatedAt) VALUES (?, NULL, NULL, ?, ?)').run('F163 VACIA', now, now);
  await request(app).post('/api/calidad/trafico/carga').set(auth(t)).send({ filas: [fila('F163 CON FILAS', '2026-07-01', 5, 5)] });
  const g = await request(app)
    .post('/api/calidad/trafico/carga')
    .set(auth(t))
    .send({ campana: 'CLINICA AURORA', filas: [fila('F163 VACIA', '2026-07-01', 5, 4), fila('F163 CON FILAS', '2026-07-01', 5, 4)] });
  assert.equal(g.status, 201, JSON.stringify(g.body));
  const mapeos = (s) => db.prepare('SELECT campana FROM trafico_skill_mapeo WHERE skillName = ? ORDER BY id').all(s).map((r) => r.campana);
  assert.deepEqual(mapeos('F163 VACIA'), ['CLINICA AURORA']);
  assert.deepEqual(mapeos('F163 CON FILAS'), [null, 'CLINICA AURORA'], 'la de "sin asignar" con datos sigue a la vista del admin');
});

test('cliente inexistente o sin acceso: se rechaza sin escribir nada', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const antes = db.prepare('SELECT COUNT(*) AS n FROM trafico_skill_mapeo').get().n;
  const body = (campana) => ({ campana, filas: [fila('F163 X', '2026-08-01', 1, 1)] });
  assert.equal((await request(app).post('/api/calidad/trafico/carga').set(auth(t)).send(body('CLIENTE QUE NO EXISTE'))).status, 400);
  assert.equal((await request(app).post('/api/calidad/trafico/carga').set(auth(t)).send(body('(SIN ASIGNAR)'))).status, 400);

  // CALIDAD con permiso del modulo y acceso solo a MOBILIZE.
  const u = db.prepare("SELECT perms FROM users WHERE user = 'crodriguez'").get();
  const p = JSON.parse(u.perms || '{}');
  Object.assign(p, { cargar_flujo_llamadas: true, campana_MOBILIZE: true, ['campana_' + HLM]: false, campana_ORLANT: false });
  db.prepare("UPDATE users SET perms = ? WHERE user = 'crodriguez'").run(JSON.stringify(p));
  const tc = await tokenFor('crodriguez', SEED.crodriguez);
  assert.equal((await request(app).post('/api/calidad/trafico/carga').set(auth(tc)).send(body(HLM))).status, 403);
  assert.equal((await request(app).post('/api/calidad/trafico/carga/impacto').set(auth(tc)).send(body(HLM))).status, 403);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM trafico_skill_mapeo').get().n, antes);
  // Con acceso al cliente, su permiso de modulo alcanza: la skill nueva queda de MOBILIZE, nunca "sin asignar".
  const ok = await request(app).post('/api/calidad/trafico/carga').set(auth(tc)).send(body('MOBILIZE'));
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.deepEqual(ok.body.skillsRegistradas, ['F163 X']);
});

test('cambiar el mapeo: se dice cual (campanaActual); "nuevo" registra sin mover el de otro cliente', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const S = 'F163 REMAP';
  await request(app).post('/api/calidad/trafico/carga').set(auth(t)).send({ campana: 'ORLANT', filas: [fila(S, '2026-08-05', 10, 9)] });
  await request(app).post('/api/calidad/trafico/carga').set(auth(t)).send({ campana: HLM, filas: [fila(S, '2026-08-05', 20, 15)] });
  const url = '/api/calidad/trafico/skills/' + encodeURIComponent(S);

  const ambigua = await request(app).put(url).set(auth(t)).send({ campana: 'MOBILIZE' });
  assert.equal(ambigua.status, 409);
  assert.match(ambigua.body.error, /varios clientes/);

  const choque = await request(app).put(url).set(auth(t)).send({ campana: 'ORLANT', campanaActual: HLM });
  assert.equal(choque.status, 409, 'ya existe en ORLANT: no se mezclan');

  const mover = await request(app).put(url).set(auth(t)).send({ campana: 'MOBILIZE', campanaActual: HLM });
  assert.equal(mover.status, 200, JSON.stringify(mover.body));
  assert.equal(mover.body.movidas, 1, 'solo la fila de HLM');
  const totales = db.prepare('SELECT campana, totalLlamadas FROM calidad_nivel_servicio_diario WHERE skillName = ? ORDER BY campana').all(S);
  assert.deepEqual(totales.map((r) => [r.campana, r.totalLlamadas]), [['MOBILIZE', 20], ['ORLANT', 10]]);

  const nuevo = await request(app).put(url).set(auth(t)).send({ campana: 'CLINICA AURORA', nuevo: true });
  assert.equal(nuevo.status, 200);
  assert.equal(nuevo.body.movidas, 0);
  assert.equal((await request(app).put(url).set(auth(t)).send({ campana: 'CLINICA AURORA', nuevo: true })).status, 409);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM trafico_skill_mapeo WHERE skillName = ?').get(S).n, 3);
});

test('vista previa del Centro: no quita skills y dice cuales se registran', () => {
  const filas = [
    { fecha: '2026-08-01', skillName: 'LINEA ENTRADA' },
    { fecha: '2026-08-02', skillName: 'PROGRAMAS ESPECIALES' },
    { fecha: '2026-08-02', skillName: 'YA REGISTRADA' },
    { fecha: '2026-07-31', skillName: 'LINEA ENTRADA' },
  ];
  const r = CC.centroFiltrarResultado({ tipo: 'trafico', canal: 'voz', filas, avisos: [] }, 'flujo_llamadas', '2026-08');
  assert.equal(r.filas.length, 3, 'solo se quita la fila de otro mes');
  assert.equal(r.centroIgnoradas, 1);
  assert.equal(
    CC.centroAvisoSkillsNuevas(HLM, r.filas, { 'YA REGISTRADA': true }),
    'Skills nuevas que se registran para HOSPITAL LA MARIA: LINEA ENTRADA, PROGRAMAS ESPECIALES.'
  );
  assert.equal(CC.centroAvisoSkillsNuevas(HLM, r.filas, { 'LINEA ENTRADA': true, 'PROGRAMAS ESPECIALES': true, 'YA REGISTRADA': true }), null);
});

test('numeros con separador de miles: formato de EE. UU. y de Colombia', () => {
  for (const [txt, n] of [
    ['1,871.35', 1871.35],
    ['1.871,35', 1871.35],
    ['1,100.63', 1100.63],
    ['884.99', 884.99],
    ['5,5', 5.5],
    ['1,234,567', 1234567],
    ['1.234.567', 1234567],
    ['106.41', 106.41],
    ['12', 12],
  ]) {
    assert.equal(T.traficoNumero(txt), n, txt);
  }
  assert.equal(T.traficoNumero('----'), null);
  assert.equal(T.traficoSegundosDesdeTextoOTexto('1,871.35'), 1871.35, 'ASA de HLM: 1871,35 s, nunca 1,871');
  assert.equal(T.traficoSegundosDesdeFraccionDia('----'), null, 'AHT "----" = sin dato');
  // WhatsApp: una coma sola sigue siendo de miles, como siempre; y ahora tambien el formato de Colombia.
  assert.equal(W.traficoWppNumero('9,230.35'), 9230.35);
  assert.equal(W.traficoWppNumero('9.230,35'), 9230.35);
  assert.equal(W.traficoWppNumero('9,230'), 9230);
});

test('el lector de Flujo de Llamadas toma el ASA "1,871.35" como 1871,35 segundos', () => {
  const aoa = [
    ['SKILL_NAME', 'DATE', 'INBOUND_CALLS', 'ANSWER_CALLS', 'ABANDON_CALLS', 'SERVICE_LEVEL_20SEC', 'ASA', 'ATA', 'AHT'],
    ['LINEA ENTRADA', '2026-08-01', 150, 60, 90, '0.67 %', '1,871.35', '1,100.63', '----'],
    ['LINEA ENTRADA', '2026-08-02', 345, 190, 155, '1.74 %', '1.312,22', '884.99', 0.0025],
  ];
  const r = T.traficoParseFilas(aoa);
  assert.equal(r.error, undefined, r.error);
  assert.deepEqual(r.filas.map((f) => [f.asaSegundos, f.ataSegundos, f.ahtSegundos]), [
    [1871.35, 1100.63, undefined],
    [1312.22, 884.99, 216],
  ]);
});

test('trafico-skills: sin cliente, una skill repetida se resuelve a su mapeo mas viejo', () => {
  const now = new Date().toISOString();
  const ins = db.prepare('INSERT INTO trafico_skill_mapeo (skillName, campana, sede, createdAt, updatedAt) VALUES (?, ?, NULL, ?, ?)');
  ins.run('F163 VIEJA', 'MOBILIZE', now, now);
  ins.run('F163 VIEJA', 'ORLANT', now, now);
  assert.equal(traficoSkills.mapeoDeSkill(db, 'F163 VIEJA').campana, 'MOBILIZE');
  assert.deepEqual(traficoSkills.skillsNuevasDeCliente(db, ['F163 VIEJA', 'F163 OTRA'], 'ORLANT'), ['F163 OTRA']);
});
