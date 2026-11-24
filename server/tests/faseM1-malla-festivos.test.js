// faseM1-malla-festivos.test.js — Fase M1 (B): festivos de Colombia en la malla. Personas, grupos y
// festivos agregados INVENTADOS (semanas de 2031, lejos de hoy).
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const L = require('../../public/js/malla-logic.js');
const M = require('../malla');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const R = 'MOBILIZE PRUEBAS API';
const S = '2031-03-03'; // lunes
const HOR = { 1: { entrada: '08:00', salida: '17:00' }, 2: { entrada: '08:00', salida: '17:00' }, 3: { entrada: '08:00', salida: '17:00' }, 4: { entrada: '08:00', salida: '17:00' }, 5: { entrada: '08:00', salida: '17:00' }, 6: null, 7: null };
function crear(user, rol, perms, camp) {
  const r = db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password, asesorCampana) VALUES (?,?,?,1,?,?,?,0,?)`)
    .run('Persona Inventada ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), new Date().toISOString(), camp || null);
  return Number(r.lastInsertRowid);
}
const id = {}, tk = {};
before(async () => {
  id.a1 = crear('m1b_a1', 'ASESOR', {}, 'MOBILIZE');
  crear('m1b_supm', 'SUPERVISOR', { supervisa_MOBILIZE: true });
  crear('m1b_cli', 'CLIENTES_DASH', { ClientesDash: true, cliente_MOBILIZE: true });
  tk.master = await tokenFor('admin', MASTER_PASSWORD);
  for (const u of ['supm', 'cli', 'a1']) tk[u] = await tokenFor('m1b_' + u, 'Clave#2026x');
  const g = await request(app).post('/api/malla/grupos').set(H(tk.master)).send({ campana: R, semana: S, nombre: 'Grupo M1B', horario: HOR });
  assert.equal(g.status, 201, JSON.stringify(g.body));
  const a = await request(app).put('/api/malla/grupos/' + g.body.grupo.id + '/asesoras').set(H(tk.master)).send({ asesoras: [id.a1] });
  assert.equal(a.status, 200, JSON.stringify(a.body));
});

test('B: calendario de festivos de Colombia (Ley Emiliani y Pascua), 2026 y 2027', () => {
  assert.deepEqual(L.mallaFestivosColombia(2026).map((f) => f.fecha.slice(5)), ['01-01', '01-12', '03-23', '04-02', '04-03', '05-01', '05-18', '06-08', '06-15', '06-29', '07-20', '08-07', '08-17', '10-12', '11-02', '11-16', '12-08', '12-25']);
  assert.deepEqual(L.mallaFestivosColombia(2027).map((f) => f.fecha.slice(5)), ['01-01', '01-11', '03-22', '03-25', '03-26', '05-01', '05-10', '05-31', '06-07', '07-05', '07-20', '08-07', '08-16', '10-18', '11-01', '11-15', '12-08', '12-25']);
  assert.equal(L.mallaFestivosColombia(2026).find((f) => f.fecha === '2026-11-16').nombre, 'Independencia de Cartagena');
  assert.deepEqual(L.mallaFestivosColombia('x'), []);
});

test('B: el horario del grupo acepta «festivo» (opcional); el festivo descansa por defecto', () => {
  const ok = L.mallaValidarHorario(Object.assign({}, HOR, { festivo: { entrada: '09:00', salida: '13:00' } }));
  assert.deepEqual(ok.horario.festivo, { entrada: '09:00', salida: '13:00' });
  assert.ok(!('festivo' in L.mallaValidarHorario(HOR).horario), 'sin la clave: no se agrega');
  assert.match(L.mallaValidarHorario(Object.assign({}, HOR, { festivo: { entrada: '13:00', salida: '09:00' } })).error, /^Festivos:/);
  assert.match(L.mallaValidarHorario(Object.assign({}, HOR, { festivo: 'x' })).error, /^Festivos:/);
  const fest = { '2031-03-05': 'Festivo inventado', '2031-03-08': 'Festivo en sábado' };
  const a = L.mallaAplicarFestivos(HOR, S, fest);
  assert.equal(a.horario[3], null, 'miércoles festivo: descansa');
  assert.deepEqual(a.horario[1], HOR[1], 'los otros días no cambian');
  assert.deepEqual(a.festivos, { 3: 'Festivo inventado', 6: 'Festivo en sábado' });
  const b = L.mallaAplicarFestivos(Object.assign({}, HOR, { festivo: { entrada: '09:00', salida: '13:00' } }), S, fest);
  assert.deepEqual(b.horario[3], { entrada: '09:00', salida: '13:00' });
  assert.equal(b.horario[6], null, 'festivo en un día que no trabaja: sigue en descanso');
});

test('B: festivos del año: leer quien lee la malla; agregar, quitar y volver a poner solo el ADMIN; Historial', async () => {
  const get = (t) => request(app).get('/api/malla/festivos?anio=2031').set(H(t));
  const sup = await get(tk.supm);
  assert.equal(sup.status, 200);
  assert.equal(sup.body.puedeAdministrar, false);
  assert.equal(sup.body.festivos.length, 18);
  assert.equal((await get(tk.cli)).status, 403);
  assert.equal((await get(tk.a1)).status, 403);
  assert.equal((await request(app).get('/api/malla/festivos?anio=2031')).status, 401);
  assert.equal((await request(app).get('/api/malla/festivos?anio=1999').set(H(tk.master))).status, 400);
  const post = (t, b) => request(app).post('/api/malla/festivos').set(H(t)).send(b);
  assert.equal((await post(tk.supm, { fecha: '2031-03-05', nombre: 'Festivo inventado' })).status, 403);
  const a = await post(tk.master, { fecha: '2031-03-05', nombre: 'Festivo inventado' });
  assert.equal(a.status, 201, JSON.stringify(a.body));
  assert.equal((await post(tk.master, { fecha: '2031-03-05', nombre: 'Otra vez' })).status, 409);
  assert.equal((await post(tk.master, { fecha: '2031-02-30', nombre: 'Fecha mala' })).status, 400);
  assert.equal((await post(tk.master, { fecha: '2031-03-06', nombre: '<b>' })).status, 400);
  assert.equal((await post(tk.master, { fecha: '2031-03-06', nombre: 'Valido', otro: 1 })).status, 400);
  assert.equal((await post(tk.master, { fecha: '2031-01-01', nombre: 'Ya es' })).status, 409, 'Año Nuevo ya es festivo');
  const del = (t, f) => request(app).delete('/api/malla/festivos/' + f).set(H(t));
  assert.equal((await del(tk.supm, '2031-12-25')).status, 403);
  assert.equal((await del(tk.master, '2031-12-24')).status, 404);
  assert.equal((await del(tk.master, 'x')).status, 404);
  assert.equal((await del(tk.master, '2031-12-25')).status, 200);
  const adm = await get(tk.master);
  assert.equal(adm.body.festivos.find((f) => f.fecha === '2031-12-25').quitado, true, 'el ADMIN ve el quitado');
  assert.ok(!(await get(tk.supm)).body.festivos.some((f) => f.fecha === '2031-12-25'), 'los demás ya no lo ven');
  const vuelve = await post(tk.master, { fecha: '2031-12-25' });
  assert.equal(vuelve.status, 201);
  assert.equal(vuelve.body.restaurado, true);
  assert.equal((await get(tk.supm)).body.festivos.length, 19, '18 de ley + 1 agregado');
  const h = db.prepare("SELECT accion, detalle FROM historial WHERE accion LIKE 'MALLA_FESTIVO%' ORDER BY id").all();
  assert.deepEqual(h.map((x) => x.accion), ['MALLA_FESTIVO', 'MALLA_FESTIVO_QUITADO', 'MALLA_FESTIVO']);
  assert.match(h[2].detalle, /vuelve el festivo de ley/);
});

test('B: el festivo descansa en la puntualidad y en la semana; con horario de festivo, trabaja; el horario especial manda', async () => {
  const punt = async () => (await request(app).get('/api/malla/puntualidad?campana=' + encodeURIComponent(R) + '&semana=' + S).set(H(tk.master))).body;
  let p = await punt();
  assert.ok(!p.filas.some((f) => f.fecha === '2031-03-05'), 'el festivo (miércoles) no tiene turno');
  assert.ok(p.filas.some((f) => f.fecha === '2031-03-06'));
  const sem = await request(app).get('/api/malla?campana=' + encodeURIComponent(R) + '&semana=' + S).set(H(tk.master));
  assert.deepEqual(sem.body.festivos, [{ fecha: '2031-03-05', nombre: 'Festivo inventado' }]);
  assert.equal(sem.body.puedeAdministrarFestivos, true);
  const t = M.turnoDe(db, id.a1, R, S);
  assert.equal(t.horario[3], null);
  assert.deepEqual(t.festivos, { 3: 'Festivo inventado' });
  const g = sem.body.grupos[0];
  const put = await request(app).put('/api/malla/grupos/' + g.id).set(H(tk.master)).send({ horario: Object.assign({}, HOR, { festivo: { entrada: '09:00', salida: '13:00' } }) });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  p = await punt();
  const f1 = p.filas.find((f) => f.userId === id.a1 && f.fecha === '2031-03-05');
  assert.deepEqual([f1.entrada, f1.salida], ['09:00', '13:00']);
  const aj = await request(app).put('/api/malla/ajustes').set(H(tk.master)).send({ campana: R, semana: S, asesorId: id.a1, dias: [3], descanso: false, entrada: '10:00', salida: '12:00' });
  assert.equal(aj.status, 200, JSON.stringify(aj.body));
  p = await punt();
  const f2 = p.filas.find((f) => f.userId === id.a1 && f.fecha === '2031-03-05');
  assert.deepEqual([f2.entrada, f2.salida], ['10:00', '12:00'], 'el horario especial pesa sobre el festivo');
  const c = await request(app).post('/api/malla/copiar').set(H(tk.master)).send({ campana: R, desde: S, hasta: '2031-03-10' });
  assert.equal(c.status, 200);
  assert.deepEqual(M.semana(db, R, '2031-03-10')[0].horario.festivo, { entrada: '09:00', salida: '13:00' }, 'copiar conserva el horario de festivo');
});

test('B (pantalla): aviso de la semana, fila «Festivos» del grupo, panel del ADMIN y «Mi malla»; todo escapado', () => {
  Object.assign(global, L, { esc: require('../../public/js/esc.js').esc });
  const UI = require('../../public/js/malla.js');
  assert.equal(UI.mallaFestivosSemanaTexto([]), '');
  assert.match(UI.mallaFestivosSemanaTexto([{ fecha: '2031-03-05', nombre: 'Festivo inventado' }]), /^Festivo esta semana: Miércoles 05\/03 \(Festivo inventado\)\. Los grupos sin horario de festivo descansan/);
  const g = UI.mallaGrupoHtml({ id: 1, nombre: 'G', horario: Object.assign({}, HOR, { festivo: { entrada: '09:00', salida: '13:00' } }), asesoras: [] }, true, [], 0, {});
  assert.match(g, /id="ml-g0-tf" class="ml-trabaja" checked/);
  assert.match(g, /id="ml-g0-ef" value="09:00"/);
  assert.match(g, /el grupo descansa los festivos/);
  const sin = UI.mallaGrupoHtml({ id: 1, nombre: 'G', horario: HOR, asesoras: [] }, false, [], 0, {});
  assert.match(sin, /id="ml-g0-tf" class="ml-trabaja" disabled/);
  const panel = UI.mallaFestivosHtml({ anio: 2031, puedeAdministrar: true, festivos: [
    { fecha: '2031-01-01', nombre: 'Año <b>Nuevo</b>', origen: 'ley', quitado: false },
    { fecha: '2031-12-25', nombre: 'Navidad', origen: 'ley', quitado: true },
    { fecha: '2031-03-05', nombre: 'Inventado', origen: 'manual', quitado: false }] });
  assert.ok(!panel.includes('<b>Nuevo'));
  assert.match(panel, /mallaFestivoQuitar\('2031-01-01'\)/);
  assert.match(panel, /<s>[^<]*Navidad<\/s>[\s\S]*mallaFestivoPoner\('2031-12-25'\)/);
  assert.match(panel, /Inventado \(agregado\)/);
  assert.ok(!/mallaFestivoQuitar|<form/.test(UI.mallaFestivosHtml({ anio: 2031, puedeAdministrar: false, festivos: [{ fecha: '2031-01-01', nombre: 'Año Nuevo', origen: 'ley', quitado: false }] })));
  const mia = UI.mallaMiaHtml({ semanas: [{ semana: S, turno: { grupo: 'G', horario: { 1: HOR[1], 3: null }, festivos: { 3: 'Festivo <i>x</i>' } } }] });
  assert.match(mia, /Miércoles 05\/03<\/th><td>Descanso <span class="vis-pill vis-gris ml-festivo">Festivo: Festivo &lt;i&gt;x&lt;\/i&gt;<\/span>/);
});
