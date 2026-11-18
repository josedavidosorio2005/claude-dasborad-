// fase368-mi-malla-puntual.test.js — Fase 368 (pedido de Edwin 18/11, D3): la asesora ve en «Mi malla»
// el día en verde con «Puntual» o en rojo con «Llegaste tarde» (solo lo suyo; en SURA, por archivo).
// Personas, agentes y horas INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const L = require('../../public/js/malla-logic.js');
const { fechaLimitesHoyColombia } = require('../fecha-limites');

const HD = (t) => ({ Authorization: 'Bearer ' + t });
const LUNES = L.mallaLunesDe(fechaLimitesHoyColombia()); // esta semana (la que ve la asesora)
const HOR = { 1: { entrada: '08:00', salida: '17:00' }, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null };
function crear(user, nombre, camp) {
  return Number(db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password, asesorCampana) VALUES (?,?, 'ASESOR', 1, ?, '{}', ?, 0, ?)`)
    .run(nombre, user, bcrypt.hashSync('Clave#2026x', 4), new Date().toISOString(), camp).lastInsertRowid);
}
const id = {}, tk = {};
before(async () => {
  id.a = crear('f368_a', 'Asesora Inventada Puntual', 'SURA');
  id.b = crear('f368_b', 'Asesora Inventada Tarde', 'SURA');
  tk.admin = await tokenFor('admin', MASTER_PASSWORD);
  tk.a = await tokenFor('f368_a', 'Clave#2026x');
  tk.b = await tokenFor('f368_b', 'Clave#2026x');
  const g = await request(app).post('/api/malla/grupos').set(HD(tk.admin)).send({ campana: 'SURA', semana: LUNES, nombre: 'Lunes', horario: HOR });
  await request(app).put('/api/malla/grupos/' + g.body.grupo.id + '/asesoras').set(HD(tk.admin)).send({ asesoras: [id.a, id.b] });
  const filas = [
    { agent_id: '901', agent_name: 'Asesora Inventada Puntual', date: LUNES, login: LUNES + ' 07:59:00', logout: LUNES + ' 17:00:00', login_time: '9:01:00' },
    { agent_id: '902', agent_name: 'Asesora Inventada Tarde', date: LUNES, login: LUNES + ' 08:10:00', logout: LUNES + ' 17:00:00', login_time: '8:50:00' },
  ];
  const r = await request(app).post('/api/malla/horarios/carga').set(HD(tk.admin)).send({ campana: 'SURA', mes: LUNES.slice(0, 7), filas });
  assert.equal(r.status, 201, JSON.stringify(r.body));
});

test('cada asesora recibe solo lo suyo: Puntual (a tiempo) o Llegaste tarde', async () => {
  const a = await request(app).get('/api/malla/mi-puntualidad').set(HD(tk.a));
  const fa = a.body.semanas[0].filas.find((f) => f.fecha === LUNES);
  assert.equal(fa.estado, 'a_tiempo');
  assert.ok(!a.text.includes('Inventada Tarde'));
  const b = await request(app).get('/api/malla/mi-puntualidad').set(HD(tk.b));
  const fb = b.body.semanas[0].filas.find((f) => f.fecha === LUNES);
  assert.deepEqual([fb.estado, fb.tardeSeg], ['tarde', 600]);
});

test('textos y colores para la asesora (verde «Puntual», rojo «Llegaste tarde»)', () => {
  const UI = require(path.join(__dirname, '..', '..', 'public', 'js', 'malla-puntualidad.js'));
  assert.deepEqual(UI.mpMiaDia({ estado: 'a_tiempo' }), { texto: '✓ Puntual', clase: 'vis-verde', fila: 'ml-dia-puntual' });
  assert.deepEqual(UI.mpMiaDia({ estado: 'tarde', tardeSeg: 600 }), { texto: '✕ Llegaste tarde (10 min)', clase: 'vis-rojo', fila: 'ml-dia-tarde' });
  assert.equal(UI.mpMiaDia({ estado: 'sin_ingreso' }).clase, 'vis-rojo');
  assert.equal(UI.mpMiaDia({ estado: 'pendiente' }), null);
  assert.equal(UI.mpMiaDia({ estado: 'sin_enlace' }), null);
});

test('la tabla de «Mi malla» trae la fecha y la celda donde se pinta la puntualidad', () => {
  global.esc = (s) => String(s);
  global.MALLA_DIAS = L.MALLA_DIAS; global.mallaFechaDelDia = L.mallaFechaDelDia; global.mallaSemanaTexto = L.mallaSemanaTexto; global.mallaTurnoTexto = L.mallaTurnoTexto;
  try {
    const M = require(path.join(__dirname, '..', '..', 'public', 'js', 'malla.js'));
    const html = M.mallaMiaHtml({ semanas: [{ semana: LUNES, turno: { grupo: 'Lunes', horario: HOR } }] });
    assert.match(html, new RegExp('<tr data-fecha="' + LUNES + '"><th scope="row">'));
    assert.equal((html.match(/class="ml-punt-celda"/g) || []).length, 7);
  } finally { for (const k of ['esc', 'MALLA_DIAS', 'mallaFechaDelDia', 'mallaSemanaTexto', 'mallaTurnoTexto']) delete global[k]; }
});
