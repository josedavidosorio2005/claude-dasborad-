// fase358-malla.test.js — Fase 358 (pedido de Edwin, 17/11): «Malla de turnos». Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const L = require('../../public/js/malla-logic.js');
const { fechaLimitesHoyColombia } = require('../fecha-limites');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const C = 'ORLANT';
const S1 = '2030-01-07', S2 = '2030-01-14'; // lejos de «hoy» (el último caso usa la semana actual)
const HOR = { 1: { entrada: '07:00', salida: '16:00' }, 2: { entrada: '07:00', salida: '16:00' }, 3: { entrada: '07:00', salida: '16:00' }, 4: { entrada: '07:00', salida: '16:00' }, 5: { entrada: '07:00', salida: '16:00' }, 6: { entrada: '08:00', salida: '12:00' }, 7: null };
function crear(user, rol, perms, camp) {
  const r = db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password, asesorCampana) VALUES (?,?,?,1,?,?,?,0,?)`)
    .run('Persona ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), new Date().toISOString(), camp || null);
  return Number(r.lastInsertRowid);
}
const id = {}, tk = {};
before(async () => {
  id.a1 = crear('f358_a1', 'ASESOR', {}, C);
  id.a2 = crear('f358_a2', 'ASESOR', {}, C);
  id.aM = crear('f358_am', 'ASESOR', {}, 'MOBILIZE');
  crear('f358_sup', 'SUPERVISOR', { supervisa_ORLANT: true });
  crear('f358_supm', 'SUPERVISOR', { supervisa_MOBILIZE: true });
  crear('f358_rep', 'REPORTES', { Calidad: true, campana_ORLANT: true });
  crear('f358_cli', 'CLIENTES_DASH', { ClientesDash: true, cliente_ORLANT: true });
  crear('f358_cal', 'CALIDAD', { Calidad: true, campana_ORLANT: true });
  tk.master = await tokenFor('admin', MASTER_PASSWORD);
  for (const u of ['sup', 'supm', 'rep', 'cli', 'cal', 'a1', 'am']) tk[u] = await tokenFor('f358_' + u, 'Clave#2026x');
});
const nuevo = (t, body) => request(app).post('/api/malla/grupos').set(H(t)).send(body);

test('lógica: semanas por su lunes, horario por día, sin turnos nocturnos', () => {
  assert.equal(L.mallaLunesDe('2026-11-22'), '2026-11-16'); // domingo
  assert.equal(L.mallaLunesDe('2026-11-16'), '2026-11-16');
  assert.equal(L.mallaEsLunes('2026-11-17'), false);
  assert.equal(L.mallaSumarSemanas('2026-12-28', 1), '2027-01-04');
  assert.equal(L.mallaFechaDelDia('2026-11-16', 6), '2026-11-21');
  assert.equal(L.mallaSemanaTexto('2026-11-30'), 'Semana del 30 de nov al 6 de dic de 2026');
  assert.equal(L.mallaValidarHorario(HOR).ok, true);
  assert.equal(L.mallaValidarHorario(HOR).horario[7], null);
  assert.match(L.mallaValidarHorario({ 1: { entrada: '22:00', salida: '06:00' } }).error, /nocturnos/);
  assert.match(L.mallaValidarHorario({ 1: { entrada: '7:00', salida: '16:00' } }).error, /HH:MM/);
  assert.match(L.mallaValidarHorario({ 1: null }).error, /al menos un día/);
  assert.equal(L.mallaTurnoTexto(null), 'Descanso');
});

test('crear grupos: supervisor de la campaña y ADMIN; nadie más', async () => {
  const r = await nuevo(tk.sup, { campana: C, semana: S1, nombre: 'Mañana', horario: HOR });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.grupo.horario[6].entrada, '08:00');
  assert.equal((await nuevo(tk.master, { campana: C, semana: S1, nombre: 'Tarde', horario: { 1: { entrada: '13:00', salida: '21:00' } } })).status, 201);
  for (const k of ['supm', 'rep', 'cli', 'cal', 'a1']) assert.equal((await nuevo(tk[k], { campana: C, semana: S1, nombre: 'X' + k, horario: HOR })).status, 403, k);
  assert.equal((await nuevo(tk.sup, { campana: C, semana: S1, nombre: 'Mañana', horario: HOR })).status, 409, 'nombre repetido en la semana');
  assert.equal((await nuevo(tk.sup, { campana: C, semana: '2030-01-08', nombre: 'Y', horario: HOR })).status, 400, 'la semana es su lunes');
  assert.equal((await nuevo(tk.sup, { campana: C, semana: S1, nombre: 'Z', horario: { 1: { entrada: '22:00', salida: '02:00' } } })).status, 400);
  assert.equal((await nuevo(tk.sup, { campana: C, semana: S1, nombre: 'Z', horario: HOR, extra: 1 })).status, 400);
});

test('leer: supervisor, ADMIN y Reportes de la campaña; el cliente y Calidad no', async () => {
  const r = await request(app).get(`/api/malla?campana=${C}&semana=${S1}`).set(H(tk.rep));
  assert.equal(r.status, 200);
  assert.equal(r.body.puedeEditar, false);
  assert.deepEqual(r.body.grupos.map((g) => g.nombre), ['Mañana', 'Tarde']);
  assert.ok(r.body.asesoras.some((a) => a.id === id.a1) && !r.body.asesoras.some((a) => a.id === id.aM), 'solo asesoras de la campaña');
  for (const k of ['supm', 'cli', 'cal', 'a1']) assert.equal((await request(app).get(`/api/malla?campana=${C}&semana=${S1}`).set(H(tk[k]))).status, 403, k);
  const camp = (await request(app).get('/api/malla/campanas').set(H(tk.cli))).body.campanas;
  assert.deepEqual(camp, [], 'el cliente no ve ninguna malla');
});

test('asignar asesoras: una asesora, un turno por semana; solo de la campaña', async () => {
  const g = (await request(app).get(`/api/malla?campana=${C}&semana=${S1}`).set(H(tk.sup))).body.grupos;
  const man = g.find((x) => x.nombre === 'Mañana'), tar = g.find((x) => x.nombre === 'Tarde');
  let r = await request(app).put(`/api/malla/grupos/${man.id}/asesoras`).set(H(tk.sup)).send({ asesoras: [id.a1, id.a2] });
  assert.equal(r.status, 200);
  assert.equal(r.body.grupo.asesoras.length, 2);
  r = await request(app).put(`/api/malla/grupos/${tar.id}/asesoras`).set(H(tk.sup)).send({ asesoras: [id.a2] });
  const ahora = (await request(app).get(`/api/malla?campana=${C}&semana=${S1}`).set(H(tk.sup))).body.grupos;
  assert.deepEqual(ahora.find((x) => x.nombre === 'Mañana').asesoras.map((a) => a.id), [id.a1], 'se movió de grupo');
  assert.deepEqual(ahora.find((x) => x.nombre === 'Tarde').asesoras.map((a) => a.id), [id.a2]);
  assert.equal((await request(app).put(`/api/malla/grupos/${man.id}/asesoras`).set(H(tk.sup)).send({ asesoras: [id.aM] })).status, 400, 'asesora de otra campaña');
  assert.equal((await request(app).put(`/api/malla/grupos/${man.id}/asesoras`).set(H(tk.rep)).send({ asesoras: [id.a1] })).status, 403, 'Reportes solo lee');
  assert.equal((await request(app).put(`/api/malla/grupos/${man.id}/asesoras`).set(H(tk.supm)).send({ asesoras: [id.a1] })).status, 404, 'otra campaña: no existe para él');
  const h = db.prepare("SELECT * FROM historial WHERE accion = 'MALLA_ASIGNACION' ORDER BY id DESC").get();
  assert.equal(h.rol, C);
  assert.match(h.detalle, /semana 2030-01-07 · 1 asesora/);
});

test('copiar semana: a una vacía; con malla, 409 y solo con «reemplazar»', async () => {
  let r = await request(app).post('/api/malla/copiar').set(H(tk.sup)).send({ campana: C, desde: S1, hasta: S2 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.grupos, 2);
  assert.equal(r.body.asesoras, 2);
  const s2 = (await request(app).get(`/api/malla?campana=${C}&semana=${S2}`).set(H(tk.sup))).body.grupos;
  assert.deepEqual(s2.map((g) => [g.nombre, g.asesoras.length]), [['Mañana', 1], ['Tarde', 1]]);
  r = await request(app).post('/api/malla/copiar').set(H(tk.sup)).send({ campana: C, desde: S1, hasta: S2 });
  assert.equal(r.status, 409);
  assert.equal(r.body.codigo, 'DESTINO_CON_MALLA');
  r = await request(app).post('/api/malla/copiar').set(H(tk.sup)).send({ campana: C, desde: S1, hasta: S2, reemplazar: true });
  assert.equal(r.status, 200);
  assert.equal(r.body.reemplazados, 2);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM malla_grupos WHERE campana = ? AND semana = ?').get(C, S2).n, 2, 'sin duplicados');
  assert.equal((await request(app).post('/api/malla/copiar').set(H(tk.sup)).send({ campana: C, desde: '2030-02-04', hasta: '2030-02-11' })).status, 400, 'origen vacío');
  assert.equal((await request(app).post('/api/malla/copiar').set(H(tk.rep)).send({ campana: C, desde: S1, hasta: '2030-02-11' })).status, 403);
  assert.match(db.prepare("SELECT detalle FROM historial WHERE accion = 'MALLA_COPIADA' ORDER BY id DESC").get().detalle, /reemplazó 2 grupo/);
});

test('editar y borrar un grupo (con su asignación); la asesora ve SOLO su turno', async () => {
  const lunes = L.mallaLunesDe(fechaLimitesHoyColombia());
  const g = (await nuevo(tk.sup, { campana: C, semana: lunes, nombre: 'Hoy', horario: HOR })).body.grupo;
  await request(app).put(`/api/malla/grupos/${g.id}/asesoras`).set(H(tk.sup)).send({ asesoras: [id.a1] });
  const e = await request(app).put(`/api/malla/grupos/${g.id}`).set(H(tk.sup)).send({ horario: Object.assign({}, HOR, { 1: { entrada: '06:30', salida: '15:30' } }) });
  assert.equal(e.status, 200);
  const mia = (await request(app).get('/api/malla/mia').set(H(tk.a1))).body;
  assert.equal(mia.semanas.length, 2);
  assert.equal(mia.semanas[0].semana, lunes);
  assert.equal(mia.semanas[0].turno.grupo, 'Hoy');
  assert.equal(mia.semanas[0].turno.horario[1].entrada, '06:30');
  assert.equal(mia.semanas[1].turno, null);
  assert.ok(!JSON.stringify(mia).includes('Persona f358_a2'), 'no ve a las demás');
  assert.deepEqual((await request(app).get('/api/malla/mia').set(H(tk.sup))).body.semanas, [], 'otros roles: nada');
  assert.equal((await request(app).delete('/api/malla/grupos/' + g.id).set(H(tk.rep))).status, 403);
  assert.equal((await request(app).delete('/api/malla/grupos/' + g.id).set(H(tk.sup))).status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM malla_asignaciones WHERE grupoId = ?').get(g.id).n, 0);
  assert.equal((await request(app).get('/api/malla/mia').set(H(tk.a1))).body.semanas[0].turno, null);
});

test('Fase 366 (D1): semanas de un mes para el selector (también futuras), y la ventana trae el selector', () => {
  assert.deepEqual(L.mallaSemanasDelMes('2026-12'), ['2026-11-30', '2026-12-07', '2026-12-14', '2026-12-21', '2026-12-28']);
  assert.deepEqual(L.mallaSemanasDelMes('2027-02'), ['2027-02-01', '2027-02-08', '2027-02-15', '2027-02-22']);
  assert.deepEqual(L.mallaSemanasDelMes('2026-13'), []);
  const idx = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  assert.match(idx, /<input type="month" id="ml-mes" onchange="mallaElegirMes\(\)">/);
  assert.match(idx, /id="ml-semanas-mes"/);
});

test('Fase 366 (D1): se puede crear un grupo en una semana de diciembre', async () => {
  const r = await nuevo(tk.sup, { campana: C, semana: '2026-12-14', nombre: 'Diciembre', horario: HOR });
  assert.equal(r.status, 201, JSON.stringify(r.body));
});
