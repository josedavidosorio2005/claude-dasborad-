// faseE5-malla-pausas.test.js — Pedido de Edwin (24/11, 11 a. m.): en el horario de cada grupo, por día, pausa
// activa 1 (mañana, 15 min), almuerzo (hora y 30 min o 1 h) y pausa activa 2 (tarde, 10 min); horas por día y por
// semana = salida − entrada − almuerzo (debería dar 42; si no, aviso sin bloquear). La asesora lo ve en su vista.
// Los horarios ya guardados (solo entrada y salida) siguen funcionando. Datos SINTÉTICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor } = require('./helpers');
const L = require('../../public/js/malla-logic.js');
const { fechaLimitesHoyColombia } = require('../fecha-limites');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const C = 'ORLANT';
const DIA = (extra) => Object.assign({ entrada: '08:00', salida: '17:00', pausa1: '10:00', almuerzo: '12:30', almuerzoMin: 60, pausa2: '15:30' }, extra || {});
// 5 × (9 h − 1 h) + sábado 08:00–10:00 sin almuerzo = 40 + 2 = 42 h.
const HOR42 = { 1: DIA(), 2: DIA(), 3: DIA(), 4: DIA(), 5: DIA(), 6: { entrada: '08:00', salida: '10:00' }, 7: null };
const VIEJO = { 1: { entrada: '07:00', salida: '16:00' }, 2: { entrada: '07:00', salida: '16:00' }, 3: null, 4: null, 5: null, 6: null, 7: null };
const tk = {}, id = {};
function crear(user, rol, perms, camp) {
  const r = db.prepare('INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password, asesorCampana) VALUES (?,?,?,1,?,?,?,0,?)')
    .run('Persona ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), new Date().toISOString(), camp || null);
  return Number(r.lastInsertRowid);
}
before(async () => {
  id.a1 = crear('fe5_a1', 'ASESOR', {}, C);
  crear('fe5_sup', 'SUPERVISOR', { supervisa_ORLANT: true });
  tk.sup = await tokenFor('fe5_sup', 'Clave#2026x');
  tk.a1 = await tokenFor('fe5_a1', 'Clave#2026x');
});

test('E5: un horario de antes (solo entrada y salida) se valida y se guarda igual que siempre', () => {
  const v = L.mallaValidarHorario(VIEJO);
  assert.ok(v.ok, v.error);
  assert.deepEqual(v.horario[1], { entrada: '07:00', salida: '16:00' }, 'sin campos nuevos');
  assert.equal(L.mallaMinutosDia(v.horario[1]), 9 * 60, 'sin almuerzo: salida − entrada');
  assert.equal(L.mallaPausasTexto(v.horario[1]), '');
});

test('E5: pausas y almuerzo se validan y se normalizan; las horas descuentan solo el almuerzo', () => {
  const v = L.mallaValidarHorario(Object.assign({}, HOR42, { 2: DIA({ almuerzoMin: '30', pausa1: '', pausa2: null }) }));
  assert.ok(v.ok, v.error);
  // 26/11: cada pausa guarda su duración (sin elegir: 15 y 10 min, como antes).
  assert.deepEqual(v.horario[1], { entrada: '08:00', salida: '17:00', pausa1: '10:00', pausa1Min: 15, almuerzo: '12:30', almuerzoMin: 60, pausa2: '15:30', pausa2Min: 10 });
  assert.deepEqual(v.horario[2], { entrada: '08:00', salida: '17:00', almuerzo: '12:30', almuerzoMin: 30 }, 'vacías no se guardan; 30 como número');
  assert.equal(L.mallaMinutosDia(v.horario[1]), 8 * 60);
  assert.equal(L.mallaMinutosDia(v.horario[2]), 8 * 60 + 30);
  assert.equal(L.mallaPausasTexto(v.horario[1]), 'Pausa 10:00–10:15 · Almuerzo 12:30–13:30 · Pausa 15:30–15:40');
  assert.equal(L.mallaHorasTexto(510), '8 h 30 min');
  assert.equal(L.mallaHorasTexto(480), '8 h');
});

test('E5: errores claros (fuera del turno, duración, orden), y el festivo no cambia', () => {
  const err = (dia) => L.mallaValidarHorario({ 1: dia }).error;
  assert.match(err(DIA({ pausa1: '07:30' })), /Lunes: la pausa activa 1 debe quedar dentro del turno/);
  assert.match(err(DIA({ pausa2: '16:55' })), /pausa activa 2 debe quedar dentro del turno/, '16:55 + 10 min pasa de las 17:00');
  assert.match(err(DIA({ almuerzoMin: 45 })), /el almuerzo dura 30 min o 1 h/);
  assert.equal(err(DIA({ almuerzo: '12:5' })), 'Lunes: escribe la hora del almuerzo (HH:MM) o déjala vacía');
  assert.match(err(DIA({ pausa1: '12:20' })), /la pausa activa 1 va antes del almuerzo/);
  assert.match(err(DIA({ pausa2: '13:00' })), /la pausa activa 2 va después del almuerzo/);
  assert.match(err(DIA({ almuerzo: '', pausa1: '15:00', pausa2: '10:00' })), /la pausa activa 1 va antes de la pausa activa 2/);
  assert.ok(L.mallaValidarHorario({ 1: DIA({ pausa1: '08:00', pausa2: '16:50' }) }).ok, 'en los bordes del turno vale');
  const f = L.mallaValidarHorario({ 1: DIA(), festivo: { entrada: '08:00', salida: '12:00', pausa1: '09:00' } });
  assert.deepEqual(f.horario.festivo, { entrada: '08:00', salida: '12:00' }, 'el festivo sigue con solo entrada y salida');
});

test('E5: total de la semana; 42 h sin aviso, otro total con aviso que no bloquea', () => {
  const s = L.mallaHorasSemana(HOR42);
  assert.equal(s.minutos, 42 * 60);
  assert.equal(s.cumple, true);
  assert.equal(L.mallaAvisoHoras(HOR42), '');
  assert.equal(L.mallaHorasSemana(HOR42).porDia[6], 120);
  const corto = Object.assign({}, HOR42, { 6: null });
  assert.equal(L.mallaAvisoHoras(corto), 'La semana suma 40 h y debería sumar 42 h (salida − entrada − almuerzo). Puedes guardar igual.');
  assert.ok(L.mallaValidarHorario(corto).ok, 'no bloquea');
  assert.equal(L.mallaHorasSemana(Object.assign({}, HOR42, { festivo: { entrada: '08:00', salida: '18:00' } })).minutos, 42 * 60, 'el festivo no suma');
});

test('E5: el supervisor guarda pausas y almuerzo; la asesora los ve en su vista, con las horas de la semana', async () => {
  const lunes = L.mallaLunesDe(fechaLimitesHoyColombia());
  const r = await request(app).post('/api/malla/grupos').set(H(tk.sup)).send({ campana: C, semana: lunes, nombre: 'Con pausas', horario: HOR42 });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.deepEqual(r.body.grupo.horario[1], DIA({ pausa1Min: 15, pausa2Min: 10 }), '26/11: con la duracion de cada pausa (por defecto 15 y 10)');
  assert.equal((await request(app).put(`/api/malla/grupos/${r.body.grupo.id}/asesoras`).set(H(tk.sup)).send({ asesoras: [id.a1] })).status, 200);
  const mal = await request(app).put(`/api/malla/grupos/${r.body.grupo.id}`).set(H(tk.sup)).send({ horario: Object.assign({}, HOR42, { 1: DIA({ pausa1: '06:00' }) }) });
  assert.equal(mal.status, 400);
  assert.match(mal.body.error, /pausa activa 1 debe quedar dentro del turno/);
  const mia = (await request(app).get('/api/malla/mia').set(H(tk.a1))).body;
  const turno = mia.semanas[0].turno;
  // Un día de la semana que no sea festivo (la prueba usa la semana actual).
  const n = [1, 2, 3, 4, 5].find((d) => !(turno.festivos && (turno.festivos[d] || turno.festivos[String(d)])));
  assert.equal(turno.horario[n].almuerzo, '12:30');
  global.esc = require('../../public/js/esc.js').esc;
  Object.assign(global, L);
  const UI = require('../../public/js/malla.js');
  const html = UI.mallaMiaHtml(mia);
  // Fase M3 (Edwin, 27/11): cada pausa en su columna (antes, una línea pegada al horario).
  assert.ok(html.includes('<th scope="col" class="ml-mia-pz">Pausa 1</th><th scope="col" class="ml-mia-pz">Almuerzo</th><th scope="col" class="ml-mia-pz">Pausa 2</th>'));
  assert.ok(html.includes('<td class="ml-mia-pz" data-etq="Pausa 1">10:00–10:15</td><td class="ml-mia-pz" data-etq="Almuerzo">12:30–13:30</td><td class="ml-mia-pz" data-etq="Pausa 2">15:30–15:40</td>'));
  if (!Object.keys(turno.festivos || {}).length) assert.ok(html.includes('Horas de la semana: <strong>42 h</strong>'));
});

test('E5: un grupo guardado antes sigue igual en la API y en la vista (sin pausas ni líneas de más)', async () => {
  const r = await request(app).post('/api/malla/grupos').set(H(tk.sup)).send({ campana: C, semana: '2030-03-04', nombre: 'Antes', horario: VIEJO });
  assert.equal(r.status, 201);
  assert.deepEqual(r.body.grupo.horario[1], { entrada: '07:00', salida: '16:00' });
  global.esc = require('../../public/js/esc.js').esc;
  Object.assign(global, L);
  const UI = require('../../public/js/malla.js');
  const html = UI.mallaMiaHtml({ semanas: [{ semana: '2030-03-04', turno: { grupo: 'Antes', horario: VIEJO, especiales: [], festivos: {}, color: 1 }, novedades: [] }] });
  assert.ok(!html.includes('ml-mia-pz'), 'sin columnas de pausas'); // Fase M3
  assert.ok(html.includes('Horas de la semana: <strong>18 h</strong>'));
});

test('E5: editor del grupo — pausas con horas por día, total y aviso; deshabilitadas en descanso (26/11: en el cuadro único)', () => {
  global.esc = require('../../public/js/esc.js').esc;
  Object.assign(global, L);
  const UI = require('../../public/js/malla.js');
  const ed = UI.mallaHorarioTablaHtml({ horario: Object.assign({}, HOR42, { 6: null }) }, 'ml-g0', '');
  assert.match(ed, /<table class="ml-tabla ml-tabla-dia"/);
  assert.match(ed, /id="ml-g0-p11" value="10:00"/);
  assert.match(ed, /id="ml-g0-al1" value="12:30"/);
  assert.match(ed, /<select id="ml-g0-am1"[^>]*><option value="30">30 min<\/option><option value="60" selected>1 h<\/option>/);
  assert.match(ed, /id="ml-g0-p26" value="" disabled/, 'sábado de descanso: deshabilitado');
  assert.match(ed, /id="ml-g0-hd1">8 h</);
  assert.match(ed, /Total de la semana: <strong>40 h<\/strong>/);
  assert.match(ed, /class="ml-horas-aviso" id="ml-g0-ha" role="status">La semana suma 40 h y debería sumar 42 h/);
  const ok = UI.mallaHorarioTablaHtml({ horario: HOR42 }, 'ml-g1', '');
  assert.match(ok, /class="ml-horas-aviso hidden" id="ml-g1-ha"/);
  const ro = UI.mallaHorarioTablaHtml({ horario: HOR42 }, 'ml-g2', ' disabled');
  assert.match(ro, /id="ml-g2-p11" value="10:00" disabled/, 'solo lectura');
  const g = UI.mallaGrupoHtml({ id: 1, nombre: 'G', horario: HOR42, asesoras: [] }, true, [], 0, { ajustes: [], novedades: [] });
  assert.ok(g.includes('oninput="mallaRecalcularHoras(0)"') && g.includes('class="ml-tabla ml-tabla-dia"'));
  assert.ok(!UI.mallaGrupoHtml({ id: 1, nombre: 'G', horario: HOR42, asesoras: [] }, false, [], 0, { ajustes: [], novedades: [] }).includes('oninput='), 'solo lectura: sin recálculo');
});
