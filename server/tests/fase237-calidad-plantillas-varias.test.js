// fase237-calidad-plantillas-varias.test.js — Fase 237 (plan de Calidad,
// sec. 3 y 4): base para VARIAS plantillas por cliente y acceso por
// plantilla (plantilla_<id>), sin romper la plantilla de hoy. Datos y
// plantillas SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const dbMod = require('../db');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const PW = 'Clave#Fase237x';
const hoy = new Date().toISOString().slice(0, 10);
let admin;
let orlantPrincipalId;
let orlantSegundaId;

async function crear(user, rol, perms) {
  const r = await request(app).post('/api/users').set(auth(admin)).send({ nombre: 'Persona ' + user, user, password: PW, rol, perms });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { id: r.body.id, token: await tokenFor(user, PW) };
}
const monitoreo = (extra) => Object.assign({ campana: 'ORLANT', asesor: 'Asesor Sintetico', fecha: hoy, canal: 'LLAMADA', answers: { 1: 'SI', 2: 'NO' } }, extra);

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  orlantPrincipalId = db.prepare("SELECT id FROM calidad_plantillas WHERE campana = 'ORLANT'").get().id;
  // segunda plantilla de ORLANT (sintetica): 2 items, otro motor
  const info = db.prepare("INSERT INTO calidad_plantillas (campana, nombre, principal, engine, items, activo, updatedAt) VALUES ('ORLANT', 'ORLANT WhatsApp (prueba)', 0, 'sura', ?, 1, ?)")
    .run(JSON.stringify([{ n: 1, cat: 'A', label: 'Item 1', weight: 60, critico: false }, { n: 2, cat: 'A', label: 'Item 2', weight: 40, critico: true }]), new Date().toISOString());
  orlantSegundaId = Number(info.lastInsertRowid);
});

test('migración: sin UNIQUE(campana), con nombre y principal; ORLANT y MOBILIZE conservan su id como principales', () => {
  const cols = db.prepare('PRAGMA table_info(calidad_plantillas)').all().map((c) => c.name);
  assert.ok(cols.includes('nombre') && cols.includes('principal'));
  assert.ok(db.prepare('PRAGMA table_info(monitoreos)').all().some((c) => c.name === 'plantillaId'));
  const princ = db.prepare('SELECT campana, nombre, principal FROM calidad_plantillas WHERE principal = 1 ORDER BY campana').all();
  assert.deepEqual(princ.map((r) => [r.campana, r.nombre]), [['MOBILIZE', 'MOBILIZE'], ['ORLANT', 'ORLANT']]);
  // una sola principal por campaña
  assert.throws(() => db.prepare("UPDATE calidad_plantillas SET principal = 1 WHERE id = ?").run(orlantSegundaId), /UNIQUE/);
});

test('migración idempotente: correrla otra vez no cambia nada ni pierde filas; los triggers de datos siguen', () => {
  const antes = JSON.stringify(db.prepare('SELECT * FROM calidad_plantillas ORDER BY id').all());
  dbMod.migrarCalidadPlantillasVarias();
  dbMod.migrarCalidadPlantillasVarias();
  assert.equal(JSON.stringify(db.prepare('SELECT * FROM calidad_plantillas ORDER BY id').all()), antes);
  const v0 = db.prepare('SELECT n FROM datos_version WHERE id = 1').get().n;
  db.prepare('UPDATE calidad_plantillas SET updatedAt = updatedAt WHERE id = ?').run(orlantPrincipalId);
  assert.ok(db.prepare('SELECT n FROM datos_version WHERE id = 1').get().n > v0, 'trigger de datos_version recreado');
});

test('GET /calidad/plantillas sigue dando UNA por campaña (la principal); /todas da las dos de ORLANT', async () => {
  const r = await request(app).get('/api/calidad/plantillas').set(auth(admin));
  assert.equal(r.status, 200);
  const orl = r.body.filter((p) => p.campana === 'ORLANT');
  assert.equal(orl.length, 1);
  assert.equal(orl[0].id, orlantPrincipalId);
  assert.equal(orl[0].items.length, 17, 'la plantilla de ORLANT de siempre');
  const t = await request(app).get('/api/calidad/plantillas/todas').set(auth(admin));
  assert.deepEqual(t.body.filter((p) => p.campana === 'ORLANT').map((p) => [p.id, p.principal, p.usable]), [[orlantPrincipalId, true, true], [orlantSegundaId, false, true]]);
});

test('sin plantillaId: la principal, como siempre (plantillaId NULL); con plantillaId: esa, con su motor', async () => {
  const cal = await crear('f237cal', 'CALIDAD', { Calidad: true, campana_ORLANT: true });
  const a = await request(app).post('/api/monitoreos').set(auth(cal.token)).send(monitoreo());
  assert.equal(a.status, 201, JSON.stringify(a.body));
  assert.equal(a.body.plantillaId, null);
  const b = await request(app).post('/api/monitoreos').set(auth(cal.token)).send(monitoreo({ plantillaId: orlantSegundaId }));
  assert.equal(b.status, 201, JSON.stringify(b.body));
  assert.equal(b.body.plantillaId, orlantSegundaId);
  assert.equal(b.body.puntaje, 60, 'motor sura: solo SI suma (60), el crítico en NO no resta');
  assert.equal(b.body.fallos, 1);
  // editar (admin) recalcula con la plantilla del monitoreo, no con la principal
  const e = await request(app).put('/api/monitoreos/' + b.body.id).set(auth(admin)).send({ answers: { 1: 'SI', 2: 'SI' } });
  assert.equal(e.status, 200, JSON.stringify(e.body));
  assert.equal(e.body.puntaje, 100);
});

test('una plantilla de otra campaña o inactiva no se acepta', async () => {
  const mob = db.prepare("SELECT id FROM calidad_plantillas WHERE campana = 'MOBILIZE'").get().id;
  const r = await request(app).post('/api/monitoreos').set(auth(admin)).send(monitoreo({ plantillaId: mob }));
  assert.equal(r.status, 400);
  assert.match(r.body.error, /no es de esta campaña/);
});

test('acceso por plantilla: sin ninguna marcada, todas; con alguna marcada, esas y la principal de su campaña (Fase 342)', async () => {
  const solo2 = await crear('f237solo2', 'CALIDAD', { Calidad: true, campana_ORLANT: true, ['plantilla_' + orlantSegundaId]: true });
  assert.equal((await request(app).post('/api/monitoreos').set(auth(solo2.token)).send(monitoreo({ plantillaId: orlantSegundaId }))).status, 201);
  // Fase 342: la principal de la campaña que califica queda habilitada sola.
  const principal = await request(app).post('/api/monitoreos').set(auth(solo2.token)).send(monitoreo());
  assert.equal(principal.status, 201, JSON.stringify(principal.body));
  const t = await request(app).get('/api/calidad/plantillas/todas').set(auth(solo2.token));
  assert.deepEqual(t.body.filter((p) => p.campana === 'ORLANT').map((p) => p.usable), [true, true]);
  // la plantilla no salta la campaña
  const sinCampana = await crear('f237sincamp', 'CALIDAD', { Calidad: true, campana_MOBILIZE: true, ['plantilla_' + orlantSegundaId]: true });
  assert.equal((await request(app).post('/api/monitoreos').set(auth(sinCampana.token)).send(monitoreo({ plantillaId: orlantSegundaId }))).status, 403);
});

test('un auxiliar admin no da una plantilla que él no tiene (misma regla de la Fase 222)', async () => {
  const aux = await crear('f237aux', 'AUX_ADMIN', { crearUsuarios: true, editarUsuarios: true, campana_ORLANT: true });
  const r = await request(app).post('/api/users').set(auth(aux.token)).send({ nombre: 'Persona f237x', user: 'f237x', password: PW, rol: 'CALIDAD', perms: { Calidad: true, campana_ORLANT: true, ['plantilla_' + orlantSegundaId]: true } });
  assert.equal(r.status, 403);
  assert.match(r.body.error, /plantillas/);
});

// ── Navegador ──
test('formulario de usuario: casillas de plantilla sin marcar por defecto, solo CALIDAD/SUPERVISOR; guardar pone true/false', async () => {
  const els = {};
  const el = (id) => (els[id] = els[id] || { id, innerHTML: '', style: {} });
  const inputs = [];
  const ctx = {
    document: { getElementById: el, querySelectorAll: () => inputs },
    esc: (s) => String(s), apiRequest: async () => [{ id: 1, campana: 'ORLANT', nombre: 'ORLANT' }, { id: 9, campana: 'ORLANT', nombre: 'WhatsApp' }],
  };
  vm.createContext(ctx);
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'users.js'), 'utf8');
  vm.runInContext(src.slice(src.indexOf('var _usersPlantillas'), src.indexOf('function closeUserModal')), ctx);
  await ctx.buildPlantillaCheckboxes(null, 'CALIDAD');
  assert.equal(el('mu-plantillas-section').style.display, 'block');
  assert.doesNotMatch(el('mu-plantillas-grid').innerHTML, /checked/);
  assert.match(el('mu-plantillas-grid').innerHTML, /data-plantilla="9" >ORLANT — WhatsApp/);
  await ctx.buildPlantillaCheckboxes({ plantilla_9: true }, 'SUPERVISOR');
  assert.match(el('mu-plantillas-grid').innerHTML, /data-plantilla="9" checked/);
  await ctx.buildPlantillaCheckboxes(null, 'REPORTES');
  assert.equal(el('mu-plantillas-section').style.display, 'none');
  inputs.push({ dataset: { plantilla: '1' }, checked: false }, { dataset: { plantilla: '9' }, checked: true });
  assert.deepEqual({ ...ctx.aplicarPlantillas({ plantilla_1: true }, 'CALIDAD') }, { plantilla_1: false, plantilla_9: true });
  assert.deepEqual({ ...ctx.aplicarPlantillas({ plantilla_9: true }, 'ASESOR') }, { plantilla_9: false });
});

test('formulario de monitoreo: selector solo con 2+ plantillas usables; la principal por defecto; la carga masiva usa la principal', () => {
  const ctx = { esc: (s) => String(s), _ccampana: 'ORLANT' };
  vm.createContext(ctx);
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'calidad.js'), 'utf8');
  vm.runInContext('var CAL_PLANTILLAS = { ORLANT: { items: [{ n: 1 }], engine: "standard" } };\n' +
    src.slice(src.indexOf('var CAL_PLANTILLAS_TODAS'), src.indexOf('// ── Cache de datos por campana')), ctx);
  ctx.CAL_PLANTILLAS_TODAS = [{ id: 1, campana: 'ORLANT', nombre: 'ORLANT', principal: true, usable: true, items: [{ n: 1 }] }];
  assert.equal(ctx.calPlantillaSelectorHtml('ORLANT', false), '', 'con una sola, nada cambia en pantalla');
  ctx.CAL_PLANTILLAS_TODAS.push({ id: 9, campana: 'ORLANT', nombre: 'WhatsApp', principal: false, usable: true, items: [{ n: 1 }, { n: 2 }], engine: 'sura' });
  assert.match(ctx.calPlantillaSelectorHtml('ORLANT', false), /<option value="1" selected>ORLANT<\/option><option value="9">WhatsApp<\/option>/);
  ctx._calPlantillaElegida.ORLANT = 9;
  assert.equal(ctx.calItems('ORLANT').length, 2);
  assert.equal(ctx.calEngine('ORLANT'), 'sura');
  assert.equal(ctx.calItemsPrincipal('ORLANT').length, 1);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'calidad-carga-masiva.js'), 'utf8'), /var items = calItemsPrincipal\(_ccampana\);/);
});
