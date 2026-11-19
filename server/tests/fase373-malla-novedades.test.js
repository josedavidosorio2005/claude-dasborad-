// fase373-malla-novedades.test.js — Fase 373 (reunión con Edwin, 19/11): en la «Malla de turnos»,
// cada grupo con un color, novedades por asesora (las ve en «Mi malla»; historial de la semana; el
// Historial general nunca lleva el texto) y horario especial de una asesora en uno o varios días,
// que pesa en «Mi malla» y en la puntualidad. Sin botón «Esta semana». Datos SINTÉTICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const L = require('../../public/js/malla-logic.js');
const { fechaLimitesHoyColombia } = require('../fecha-limites');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const C = 'ORLANT';
const S = '2030-02-04'; // lunes lejos de hoy
const HOR = { 1: { entrada: '07:00', salida: '16:00' }, 2: { entrada: '07:00', salida: '16:00' }, 3: { entrada: '07:00', salida: '16:00' }, 4: { entrada: '07:00', salida: '16:00' }, 5: { entrada: '07:00', salida: '16:00' }, 6: null, 7: null };
function crear(user, rol, perms, camp) {
  return Number(db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password, asesorCampana) VALUES (?,?,?,1,?,?,?,0,?)`)
    .run('Persona ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), new Date().toISOString(), camp || null).lastInsertRowid);
}
const id = {}, tk = {}, g = {};
before(async () => {
  id.a1 = crear('f373_a1', 'ASESOR', {}, C);
  id.a2 = crear('f373_a2', 'ASESOR', {}, C);
  id.a3 = crear('f373_a3', 'ASESOR', {}, C); // sin grupo
  crear('f373_sup', 'SUPERVISOR', { supervisa_ORLANT: true });
  crear('f373_rep', 'REPORTES', { Calidad: true, campana_ORLANT: true });
  tk.master = await tokenFor('admin', MASTER_PASSWORD);
  for (const u of ['sup', 'rep', 'a1', 'a2']) tk[u] = await tokenFor('f373_' + u, 'Clave#2026x');
  for (const [k, nombre, asesoras] of [['b', 'Grupo B', [id.a2]], ['a', 'Grupo A', [id.a1]]]) {
    const r = await request(app).post('/api/malla/grupos').set(H(tk.sup)).send({ campana: C, semana: S, nombre, horario: HOR });
    g[k] = r.body.grupo.id;
    await request(app).put('/api/malla/grupos/' + g[k] + '/asesoras').set(H(tk.sup)).send({ asesoras });
  }
});
const leer = async (t) => (await request(app).get('/api/malla?campana=' + C + '&semana=' + S).set(H(t || tk.sup))).body;
const hist = (accion) => db.prepare('SELECT detalle FROM historial WHERE accion = ? ORDER BY id DESC').all(accion);

test('cada grupo con su color, en el orden de la semana', async () => {
  const d = await leer();
  assert.deepEqual(d.grupos.map((x) => [x.nombre, x.color]), [['Grupo A', 1], ['Grupo B', 2]]);
  assert.deepEqual(d.novedades, []);
  assert.deepEqual(d.ajustes, []);
});

test('novedades: solo quien edita, solo asesoras de un grupo de la semana; quitar deja historial; sin texto en el Historial general', async () => {
  const jue = L.mallaFechaDelDia(S, 4);
  const b = { campana: C, semana: S, asesorId: id.a1, fecha: jue, texto: 'Cita médica inventada, entra a las 9:00' };
  assert.equal((await request(app).post('/api/malla/novedades').set(H(tk.rep)).send(b)).status, 403);
  assert.equal((await request(app).post('/api/malla/novedades').set(H(tk.a1)).send(b)).status, 403);
  for (const [x, re] of [
    [{ ...b, asesorId: id.a3 }, /no está en un grupo/],
    [{ ...b, fecha: '2030-02-11' }, /de esta semana/],
    [{ ...b, texto: 'ok' }, /3 a 300/],
    [{ ...b, semana: '2030-02-05' }, /su lunes/],
    [{ ...b, otra: 1 }, /Datos no válidos/],
  ]) assert.match((await request(app).post('/api/malla/novedades').set(H(tk.sup)).send(x)).body.error, re);
  const r = await request(app).post('/api/malla/novedades').set(H(tk.sup)).send(b);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const r2 = await request(app).post('/api/malla/novedades').set(H(tk.master)).send({ campana: C, semana: S, asesorId: id.a1, texto: 'Otra novedad inventada de la semana' });
  assert.equal(r2.status, 201);
  assert.equal(hist('MALLA_NOVEDAD')[1].detalle, 'semana ' + S + ' · día ' + jue);
  assert.ok(!JSON.stringify(db.prepare("SELECT * FROM historial WHERE accion LIKE 'MALLA_NOVEDAD%'").all()).includes('inventada'), 'el Historial general nunca lleva el texto');
  // Quitar: la asesora deja de verla; queda tachada en el historial de la semana.
  assert.equal((await request(app).delete('/api/malla/novedades/' + r2.body.novedad.id).set(H(tk.rep))).status, 403);
  assert.equal((await request(app).delete('/api/malla/novedades/' + r2.body.novedad.id).set(H(tk.sup))).status, 200);
  assert.equal((await request(app).delete('/api/malla/novedades/' + r2.body.novedad.id).set(H(tk.sup))).status, 400, 'ya quitada');
  const d = await leer(tk.rep); // Reportes lee
  assert.equal(d.novedades.length, 2);
  assert.ok(d.novedades.find((n) => n.id === r2.body.novedad.id).quitada.por);
  assert.equal(hist('MALLA_NOVEDAD_QUITADA').length, 1);
});

test('horario especial: un día o varios, descanso; validaciones; quitar', async () => {
  const base = { campana: C, semana: S, asesorId: id.a2 };
  assert.equal((await request(app).put('/api/malla/ajustes').set(H(tk.rep)).send({ ...base, dias: [2], entrada: '09:00', salida: '18:00' })).status, 403);
  for (const [x, re] of [
    [{ ...base, dias: [] }, /uno o más días/],
    [{ ...base, dias: [8], entrada: '09:00', salida: '18:00' }, /uno o más días/],
    [{ ...base, dias: [2], entrada: '18:00', salida: '09:00' }, /después de la entrada/],
    [{ ...base, asesorId: id.a3, dias: [2], entrada: '09:00', salida: '18:00' }, /no está en un grupo/],
  ]) assert.match((await request(app).put('/api/malla/ajustes').set(H(tk.sup)).send(x)).body.error, re);
  const r = await request(app).put('/api/malla/ajustes').set(H(tk.sup)).send({ ...base, dias: [2, 3], entrada: '09:00', salida: '18:00' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.fechas, [L.mallaFechaDelDia(S, 2), L.mallaFechaDelDia(S, 3)]);
  assert.equal((await request(app).put('/api/malla/ajustes').set(H(tk.sup)).send({ ...base, dias: [3, 6], descanso: true })).status, 200, 'reemplaza el miércoles y agrega el sábado');
  const d = await leer();
  assert.deepEqual(d.ajustes.map((a) => [a.fecha, a.turno]), [[L.mallaFechaDelDia(S, 2), { entrada: '09:00', salida: '18:00' }], [L.mallaFechaDelDia(S, 3), null], [L.mallaFechaDelDia(S, 6), null]]);
  assert.match(hist('MALLA_HORARIO_ESPECIAL')[1].detalle, /09:00 – 18:00$/);
  assert.match(hist('MALLA_HORARIO_ESPECIAL')[0].detalle, /Descanso$/);
  const sab = d.ajustes.find((a) => a.fecha === L.mallaFechaDelDia(S, 6));
  assert.equal((await request(app).delete('/api/malla/ajustes/' + sab.id).set(H(tk.sup))).status, 200);
  assert.equal((await request(app).delete('/api/malla/ajustes/' + sab.id).set(H(tk.sup))).status, 404);
  assert.equal(hist('MALLA_HORARIO_ESPECIAL_QUITADO').length, 1);
  // El turno de la semana con el horario especial encima (lo que ve en «Mi malla»).
  const M = require('../malla');
  const t = M.turnoDe(db, id.a2, C, S);
  assert.deepEqual([t.horario[2], t.horario[3], t.horario[4], t.especiales, t.color], [{ entrada: '09:00', salida: '18:00' }, null, { entrada: '07:00', salida: '16:00' }, [2, 3], 2]);
});

test('«Mi malla»: la asesora ve su horario especial y solo sus novedades vigentes (semana actual)', async () => {
  const actual = L.mallaLunesDe(fechaLimitesHoyColombia());
  const r = await request(app).post('/api/malla/grupos').set(H(tk.sup)).send({ campana: C, semana: actual, nombre: 'Grupo actual', horario: HOR });
  await request(app).put('/api/malla/grupos/' + r.body.grupo.id + '/asesoras').set(H(tk.sup)).send({ asesoras: [id.a1, id.a2] });
  await request(app).post('/api/malla/novedades').set(H(tk.sup)).send({ campana: C, semana: actual, asesorId: id.a1, texto: 'Novedad inventada para la asesora uno' });
  await request(app).post('/api/malla/novedades').set(H(tk.sup)).send({ campana: C, semana: actual, asesorId: id.a2, texto: 'Novedad inventada para la asesora dos' });
  await request(app).put('/api/malla/ajustes').set(H(tk.sup)).send({ campana: C, semana: actual, asesorId: id.a1, dias: [5], entrada: '10:00', salida: '19:00' });
  const m = (await request(app).get('/api/malla/mia').set(H(tk.a1))).body;
  assert.equal(m.semanas[0].semana, actual);
  assert.deepEqual(m.semanas[0].novedades.map((n) => n.texto), ['Novedad inventada para la asesora uno']);
  assert.ok(!('creadoPor' in m.semanas[0].novedades[0]));
  assert.deepEqual([m.semanas[0].turno.horario[5], m.semanas[0].turno.especiales], [{ entrada: '10:00', salida: '19:00' }, [5]]);
  assert.deepEqual(m.semanas[1].novedades, []);
});

test('puntualidad: el horario especial pesa sobre el del grupo (descanso = sin turno ese día)', () => {
  const fila = db.prepare('SELECT entrada, salida FROM malla_ajustes WHERE campana = ? AND asesorId = ? AND fecha = ?').get(C, id.a2, L.mallaFechaDelDia(S, 3));
  assert.deepEqual(fila, { entrada: null, salida: null }, 'descanso guardado sin horas');
  assert.match(require('fs').readFileSync(path.join(__dirname, '..', 'puntualidad.js'), 'utf8'), /ajusteStmt\.get\(campana, a\.id, fecha\)/);
});

test('interfaz: sin «Esta semana», color del grupo, casos, historial de novedades y «Mi malla» escapados', () => {
  const html = require('fs').readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  assert.ok(!html.includes('mallaIrHoy'), 'sin botón «Esta semana»');
  Object.assign(global, L, { esc: (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) });
  try {
    const UI = require(path.join(__dirname, '..', '..', 'public', 'js', 'malla.js'));
    const gr = { id: 5, nombre: 'G', horario: HOR, color: 3, asesoras: [{ id: 9, nombre: 'Ana <b>' }] };
    const sem = { ajustes: [{ id: 1, asesorId: 9, fecha: L.mallaFechaDelDia(S, 2), turno: null }], novedades: [{ id: 2, asesorId: 9, fecha: null, texto: 'Nota <i>x</i>' }] };
    const g1 = UI.mallaGrupoHtml(gr, true, [{ id: 9, nombre: 'Ana <b>' }], 0, sem);
    assert.ok(g1.includes('ml-color-3') && g1.includes('Novedades y horarios especiales') && g1.includes('Martes 05/02: Descanso'));
    assert.ok(g1.includes('Nota &lt;i&gt;x&lt;/i&gt;') && !g1.includes('<i>x'));
    assert.ok(!UI.mallaGrupoHtml(gr, false, [], 0, sem).includes('>Novedad<'), 'solo lectura: sin botones');
    const h = UI.mallaNovedadesSemanaHtml([{ asesorNombre: 'Ana', fecha: null, texto: 'a <b>', creadoPor: 'x', createdAt: '2030-02-04T12:00:00Z', quitada: { por: 'y', en: '2030-02-04T13:00:00Z' } }]);
    assert.ok(h.includes('<s>a &lt;b&gt;</s>') && h.includes('quitada por y'));
    const mia = UI.mallaMiaHtml({ semanas: [{ semana: S, turno: { grupo: 'G', horario: HOR, especiales: [2], color: 4 }, novedades: [{ fecha: null, texto: 'n <x>' }] }] });
    assert.ok(mia.includes('ml-color-4') && mia.includes('Horario especial') && mia.includes('n &lt;x&gt;') && mia.includes('Novedades de la semana'));
  } finally { delete global.esc; }
});
