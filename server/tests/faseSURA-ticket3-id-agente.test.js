// faseSURA-ticket3-id-agente.test.js — Ticket #3 de SURA (supervisora, 23/11/2026): en «Calificar» de
// Calidad, al elegir el asesor, «ID de agente» se llena solo (editable) y, si no hay dato, lo dice.
// Fuente: enlace con Wolkvox de la campaña (malla_agente_enlace) o el último monitoreo del asesor.
// Datos INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const { idAgenteDe } = require('../calidad-id-agente');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const CAMP = 'SURA';
const tk = {};
const ids = {};
function crear(user, rol, perms, asesorCampana) {
  return Number(db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, asesorCampana, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,?,0)`)
    .run('Persona Inventada ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms || {}), asesorCampana || null, new Date().toISOString()).lastInsertRowid);
}
function monitoreo(userId, extras, campana) {
  db.prepare(`INSERT INTO monitoreos (campana, asesor, fecha, mes, evaluador, answers, createdAt, asesorUserId, extras) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(campana || CAMP, 'Persona Inventada', '2026-11-20', '2026-11', 'Evaluadora Inventada', '{}', new Date().toISOString(), userId, extras === null ? null : JSON.stringify(extras));
}

before(async () => {
  tk.admin = await tokenFor('admin', MASTER_PASSWORD);
  crear('t3_cal', 'CALIDAD', { campana_SURA: true });
  crear('t3_calm', 'CALIDAD', { campana_MOBILIZE: true });
  crear('t3_rep', 'REPORTES', { campana_SURA: true });
  ids.wv = crear('t3_as_wv', 'ASESOR', { campana_SURA: true }, CAMP);
  ids.mon = crear('t3_as_mon', 'ASESOR', { campana_SURA: true }, CAMP);
  ids.sin = crear('t3_as_sin', 'ASESOR', { campana_SURA: true }, CAMP);
  ids.mob = crear('t3_as_mob', 'ASESOR', { campana_MOBILIZE: true }, 'MOBILIZE');
  tk.cal = await tokenFor('t3_cal', 'Clave#2026x');
  tk.calm = await tokenFor('t3_calm', 'Clave#2026x');
  tk.rep = await tokenFor('t3_rep', 'Clave#2026x');
  // 1) enlazado con Wolkvox (gana sobre sus monitoreos)
  db.prepare('INSERT INTO malla_agente_enlace (campana, agentId, userId, creadoPor, createdAt) VALUES (?,?,?,?,?)').run(CAMP, 'WV-INVENTADO-7', ids.wv, 'prueba', new Date().toISOString());
  monitoreo(ids.wv, { idAgente: 'VIEJO-1' });
  // 2) sin enlace: el último monitoreo con ID (los vacíos y los de otra campaña no cuentan)
  monitoreo(ids.mon, { idAgente: 'MON-ANTIGUO' });
  monitoreo(ids.mon, { idAgente: 'MON-RECIENTE' });
  monitoreo(ids.mon, { idAgente: '   ' });
  monitoreo(ids.mon, null);
  monitoreo(ids.mon, { idAgente: 'OTRA-CAMPANA' }, 'MOBILIZE');
  // 3) sin nada
  monitoreo(ids.sin, { placa: 'ABC123' });
});

test('origen: enlace de Wolkvox primero, después el último monitoreo con ID, si no null', () => {
  assert.deepEqual(idAgenteDe(db, CAMP, ids.wv), { id: 'WV-INVENTADO-7', origen: 'wolkvox' });
  assert.deepEqual(idAgenteDe(db, CAMP, ids.mon), { id: 'MON-RECIENTE', origen: 'monitoreo' });
  assert.deepEqual(idAgenteDe(db, CAMP, ids.sin), { id: null, origen: null });
  assert.deepEqual(idAgenteDe(db, CAMP, 'x'), { id: null, origen: null });
});

test('ruta: quien califica la campaña; solo asesores de esa campaña; sin caché', async () => {
  const G = (t, q) => request(app).get('/api/calidad/id-agente' + q).set(H(t));
  const r = await G(tk.cal, '?campana=SURA&userId=' + ids.mon);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { id: 'MON-RECIENTE', origen: 'monitoreo' });
  assert.equal(r.headers['cache-control'], 'no-store');
  assert.deepEqual((await G(tk.admin, '?campana=SURA&userId=' + ids.wv)).body, { id: 'WV-INVENTADO-7', origen: 'wolkvox' });
  assert.equal((await G(tk.calm, '?campana=SURA&userId=' + ids.mon)).status, 403, 'Calidad de otra campaña');
  assert.equal((await G(tk.rep, '?campana=SURA&userId=' + ids.mon)).status, 403, 'Reportes no califica');
  assert.equal((await G(tk.cal, '?campana=SURA&userId=' + ids.mob)).status, 404, 'asesor de otra campaña');
  assert.equal((await G(tk.cal, '?campana=SURA')).status, 400);
  assert.equal((await request(app).get('/api/calidad/id-agente?campana=SURA&userId=' + ids.mon)).status, 401);
});

// ── Navegador: el formulario (calidad-calificar.js) con un DOM mínimo ──
function formulario(respuestas) {
  const els = {};
  const el = (id, extra) => (els[id] = Object.assign({ id, value: '', hidden: true, textContent: '', attrs: {},
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
    setAttribute(k, v) { this.attrs[k] = String(v); }, removeAttribute(k) { delete this.attrs[k]; },
    classList: { _s: new Set(), toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } } }, extra || {}));
  const opt = (uid, nombre) => ({ value: nombre, getAttribute: (k) => (k === 'data-user-id' ? String(uid) : null) });
  el('cc2-f-asesor'); el('cc2-asesor-info'); el('cc2-f-idAgente'); el('cc2-idagente-info');
  const pedidos = [];
  const ctx = {
    console, _ccampana: CAMP,
    users: [{ id: 1, nombre: 'Asesora Uno', rol: 'ASESOR', asesorCampana: CAMP, active: true }, { id: 2, nombre: 'Asesora Dos', rol: 'ASESOR', asesorCampana: CAMP, active: true }],
    esc: (s) => String(s == null ? '' : s), textoFormatoNombre: (s) => String(s),
    apiRequest: (m, p) => { pedidos.push(p); const uid = Number(/userId=(\d+)/.exec(p)[1]); return Promise.resolve(respuestas[uid]); },
    document: { getElementById: (id) => els[id] || null, addEventListener: () => {}, querySelectorAll: () => [] },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'calidad-calificar.js'), 'utf8'), ctx);
  const elegir = async (uid, nombre, sinAuto) => { els['cc2-f-asesor'].selectedOptions = [opt(uid, nombre)]; ctx._cc2AsesorElegido(sinAuto); await new Promise((r) => setImmediate(r)); };
  return { els, ctx, elegir, pedidos };
}

test('formulario: al elegir el asesor llena el ID y dice de dónde salió; si no hay, avisa', async () => {
  const f = formulario({ 1: { id: 'WV-1', origen: 'wolkvox' }, 2: { id: null, origen: null } });
  await f.elegir(1, 'Asesora Uno');
  assert.equal(f.els['cc2-f-idAgente'].value, 'WV-1');
  assert.match(f.els['cc2-idagente-info'].textContent, /enlace con Wolkvox/);
  assert.equal(f.els['cc2-idagente-info'].hidden, false);
  assert.match(f.pedidos[0], /^\/calidad\/id-agente\?campana=SURA&userId=1$/);
  // cambia a una asesora sin ID: se quita el que se llenó solo y avisa
  await f.elegir(2, 'Asesora Dos');
  assert.equal(f.els['cc2-f-idAgente'].value, '');
  assert.match(f.els['cc2-idagente-info'].textContent, /no tiene ID de agente registrado/);
  assert.ok(f.els['cc2-idagente-info'].classList.contains('cc2-hint-aviso'));
});

test('formulario: no pisa lo que escribió la persona ni el valor de un monitoreo que se edita', async () => {
  const f = formulario({ 1: { id: 'WV-1', origen: 'wolkvox' } });
  f.els['cc2-f-idAgente'].value = 'ESCRITO-A-MANO';
  await f.elegir(1, 'Asesora Uno');
  assert.equal(f.els['cc2-f-idAgente'].value, 'ESCRITO-A-MANO');
  const g = formulario({ 1: { id: 'WV-1', origen: 'wolkvox' } });
  await g.elegir(1, 'Asesora Uno', true); // editar un monitoreo guardado
  assert.equal(g.pedidos.length, 0);
  assert.equal(g.els['cc2-f-idAgente'].value, '');
});

test('el campo lleva su aviso solo cuando la plantilla trae «ID de agente»', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'calidad-calificar.js'), 'utf8');
  assert.match(src, /c\.k === 'idAgente'[^\n]*cc2-idagente-info/);
  assert.match(src, /_cc2AsesorElegido\(true\)/, 'al editar no se autollena');
});
