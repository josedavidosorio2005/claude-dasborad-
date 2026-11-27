// faseCM1-carga-masiva-plantilla.test.js — Fase CM1 (27/11/2026, pedido de Edwin): la carga masiva de Calidad
// elige la plantilla (una campaña con varias, p. ej. las dos sedes de Hospital La María) y cada monitoreo queda
// guardado y calificado con ella. Sin plantillaId, la principal, como siempre. Y la corrección del ítem 3 de la
// plantilla «Sede 33». Datos y plantillas INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const dbMod = require('../db');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const PW = 'Clave#FaseCM1xyz';
const hoy = new Date().toISOString().slice(0, 10);
let admin, principalId, segundaId, inactivaId, ajenaId;

async function crear(user, rol, perms) {
  const r = await request(app).post('/api/users').set(auth(admin)).send({ nombre: 'Persona ' + user, user, password: PW, rol, perms });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { id: r.body.id, token: await tokenFor(user, PW) };
}
const fila = (asesor, idLlamada, answers) => ({ asesor, fecha: hoy, canal: 'LLAMADA', idLlamada, answers });
const bulk = (token, body) => request(app).post('/api/monitoreos/bulk').set(auth(token)).send(Object.assign({ campana: 'ORLANT', archivoNombre: 'inventado.xlsx' }, body));
const ins = (campana, nombre, items, activo) => Number(db.prepare('INSERT INTO calidad_plantillas (campana, nombre, principal, engine, items, activo, updatedAt) VALUES (?, ?, 0, ?, ?, ?, ?)')
  .run(campana, nombre, 'standard', JSON.stringify(items), activo, new Date().toISOString()).lastInsertRowid);

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  principalId = db.prepare("SELECT id FROM calidad_plantillas WHERE campana = 'ORLANT' AND principal = 1").get().id;
  // segunda plantilla de ORLANT (inventada): 2 ítems, el 1 vale 30 y el 2 (crítico) 70.
  segundaId = ins('ORLANT', 'ORLANT Sede inventada', [{ n: 1, cat: 'A', label: 'Ítem uno', weight: 30, critico: false }, { n: 2, cat: 'B', label: 'Ítem dos', weight: 70, critico: true }], 1);
  inactivaId = ins('ORLANT', 'ORLANT vieja inventada', [{ n: 1, cat: 'A', label: 'X', weight: 100, critico: false }], 0);
  ajenaId = ins('MOBILIZE', 'MOBILIZE otra inventada', [{ n: 1, cat: 'A', label: 'Y', weight: 100, critico: false }], 1);
});

test('sin plantillaId: la principal, como siempre (plantillaId NULL si la principal no tiene campos)', async () => {
  const r = await bulk(admin, { filas: [fila('Asesor Inventado CM1', 'cm1-a', { 1: 'SI', 2: 'SI' })] });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.insertadas, 1);
  const m = db.prepare("SELECT plantillaId FROM monitoreos WHERE idLlamada = 'cm1-a'").get();
  const p = db.prepare('SELECT campos FROM calidad_plantillas WHERE id = ?').get(principalId);
  assert.equal(m.plantillaId, p.campos ? principalId : null);
});

test('con plantillaId: califica con ESA plantilla y la guarda en cada monitoreo; el Historial dice cuál', async () => {
  const r = await bulk(admin, { plantillaId: segundaId, filas: [fila('Asesor Inventado CM1', 'cm1-b', { 1: 'NO', 2: 'SI' }), fila('Asesor Inventado CM1', 'cm1-c', { 1: 'SI', 2: 'NO' })] });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.insertadas, 2);
  const b = db.prepare("SELECT plantillaId, puntaje, fallos FROM monitoreos WHERE idLlamada = 'cm1-b'").get();
  const c = db.prepare("SELECT plantillaId, puntaje, fallos FROM monitoreos WHERE idLlamada = 'cm1-c'").get();
  assert.equal(b.plantillaId, segundaId);
  assert.equal(c.plantillaId, segundaId);
  assert.equal(b.puntaje, 70, 'solo el ítem 2 (70 %) cumple: pesos de la plantilla elegida');
  assert.equal(c.fallos, 1, 'el ítem 2 es crítico en la plantilla elegida');
  const h = db.prepare("SELECT * FROM historial ORDER BY id DESC LIMIT 1").get();
  assert.match(JSON.stringify(h), /ORLANT Sede inventada/);
});

test('volver a subir el mismo archivo con la plantilla: actualiza, no duplica, y conserva la plantilla', async () => {
  const r = await bulk(admin, { plantillaId: segundaId, filas: [fila('Asesor Inventado CM1', 'cm1-b', { 1: 'SI', 2: 'SI' })] });
  assert.equal(r.status, 201);
  assert.equal(r.body.actualizadas, 1);
  assert.equal(r.body.insertadas, 0);
  const b = db.prepare("SELECT COUNT(*) n, MAX(plantillaId) p, MAX(puntaje) s FROM monitoreos WHERE idLlamada = 'cm1-b'").get();
  assert.deepEqual([b.n, b.p, b.s], [1, segundaId, 100]);
});

test('plantilla de otra campaña o inactiva: 400; sin acceso a esa plantilla: 403; nada se guarda', async () => {
  const antes = db.prepare('SELECT COUNT(*) n FROM monitoreos').get().n;
  for (const id of [ajenaId, inactivaId, 999999]) {
    const r = await bulk(admin, { plantillaId: id, filas: [fila('Asesor Inventado CM1', 'cm1-x' + id, { 1: 'SI' })] });
    assert.equal(r.status, 400, String(id));
    assert.match(r.body.error, /no es de esta campaña o no está activa/);
  }
  const soloPrincipal = await crear('cm1cal', 'CALIDAD', { Calidad: true, campana_ORLANT: true, ['plantilla_' + principalId]: true });
  const r = await bulk(soloPrincipal.token, { plantillaId: segundaId, filas: [fila('Asesor Inventado CM1', 'cm1-y', { 1: 'SI' })] });
  assert.equal(r.status, 403);
  assert.equal((await bulk(soloPrincipal.token, { filas: [fila('Asesor Inventado CM1', 'cm1-z', { 1: 'SI' })] })).status, 201, 'con la principal sí puede');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM monitoreos').get().n, antes + 1);
  assert.equal((await bulk(admin, { plantillaId: 'abc', filas: [fila('A', 'cm1-w', { 1: 'SI' })] })).status, 400);
});

test('pantalla: el selector sale solo con 2+ plantillas usables; descarga, lectura y POST usan la elegida', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'calidad-carga-masiva.js'), 'utf8');
  const el = {};
  const ctx = {
    _ccampana: 'X', esc: (s) => String(s), showToast: () => {}, console,
    CAL_PLANTILLAS: { X: { items: [{ n: 1, label: 'P' }] }, Y: { items: [{ n: 1 }] } },
    TODAS: [],
    document: { getElementById: (id) => (el[id] = el[id] || { innerHTML: '', style: {}, value: '' }) },
  };
  ctx.calItemsPrincipal = (c) => (ctx.CAL_PLANTILLAS[c] || {}).items || [];
  ctx.calPlantillasUsables = (c) => ctx.TODAS.filter((p) => p.campana === c && p.usable);
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  // una sola plantilla: sin selector, la principal
  ctx.TODAS = [{ id: 1, campana: 'X', nombre: 'Principal X', principal: true, usable: true, items: [{ n: 1, label: 'P' }] }];
  ctx.cmRenderPlantillaSel();
  assert.equal(el['cm-plantilla-sel'].innerHTML, '');
  assert.equal(ctx.cmPlantillaElegida(), null);
  assert.equal(ctx.cmItems()[0].label, 'P');
  // dos: selector con las dos, la principal por defecto; al elegir otra, se usa esa
  ctx.TODAS.push({ id: 2, campana: 'X', nombre: 'Sede 2 X', principal: false, usable: true, items: [{ n: 1, label: 'S2' }] });
  ctx.TODAS.push({ id: 3, campana: 'X', nombre: 'Sin acceso', principal: false, usable: false, items: [] });
  ctx.cmRenderPlantillaSel();
  assert.match(el['cm-plantilla-sel'].innerHTML, /Principal X \(principal\)/);
  assert.match(el['cm-plantilla-sel'].innerHTML, /Sede 2 X/);
  assert.doesNotMatch(el['cm-plantilla-sel'].innerHTML, /Sin acceso/);
  assert.equal(ctx.cmPlantillaElegida().id, 1);
  ctx.cmElegirPlantilla('2');
  assert.equal(ctx.cmPlantillaElegida().id, 2);
  assert.equal(ctx.cmItems()[0].label, 'S2');
  assert.match(el['cm-plantilla-sel'].innerHTML, /value="2" selected/);
  // la elección es por campaña
  ctx._ccampana = 'Y';
  assert.equal(ctx.cmPlantillaElegida(), null);
  // el POST lleva plantillaId y la descarga usa los ítems elegidos
  assert.match(src, /_cmParsed\.plantillaId = plantilla\.id/);
  assert.match(src, /var items = cmItems\(\); \/\/ Fase CM1/);
});

test('migración: «Conformación» → «Confirmación» solo en la Sede 33 de Hospital La María; idempotente', () => {
  const items = [{ n: 1, cat: 'APERTURA', label: 'Saludo', weight: 10, critico: false }, { n: 3, cat: 'GESTIÓN', label: 'Conformación de datos', weight: 10, critico: false }];
  const id = ins('HOSPITAL LA MARIA', 'Hospital La María · Sede 33', items, 1);
  const otra = ins('MOBILIZE', 'Otra con el mismo texto', items, 1);
  assert.equal(dbMod.corregirItemSede33HLM(), 1);
  const nuevo = JSON.parse(db.prepare('SELECT items FROM calidad_plantillas WHERE id = ?').get(id).items);
  assert.equal(nuevo[1].label, 'Confirmación de datos');
  assert.deepEqual(nuevo.map((x) => [x.n, x.cat, x.weight, x.critico]), items.map((x) => [x.n, x.cat, x.weight, x.critico]), 'pesos, secciones y críticos iguales');
  assert.equal(nuevo[0].label, 'Saludo');
  assert.equal(JSON.parse(db.prepare('SELECT items FROM calidad_plantillas WHERE id = ?').get(otra).items)[1].label, 'Conformación de datos', 'otra campaña no se toca');
  assert.equal(dbMod.corregirItemSede33HLM(), 0, 'la segunda vez no hace nada');
});

test('la pestaña «Carga masiva» se ve en campañas con tablero solo si tienen 2+ plantillas; «Cargar datos» no las califica con la principal', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'calidad.js'), 'utf8');
  const i = src.indexOf('function _calCargaMasivaVisible'); const j = src.indexOf('function _calActualizarTabCarga');
  assert.ok(i > 0 && j > i);
  const ctx = { CON: ['HOSPITAL LA MARIA', 'ORLANT'], N: { 'HOSPITAL LA MARIA': 2, ORLANT: 1, 'SIN TABLERO': 1 } };
  ctx._calCampanaTieneDashboard = (c) => ctx.CON.includes(c);
  ctx.calPlantillasUsables = (c) => new Array(ctx.N[c] || 0).fill({});
  vm.createContext(ctx);
  vm.runInContext(src.slice(i, j), ctx);
  assert.equal(ctx._calCargaMasivaVisible('HOSPITAL LA MARIA'), true, 'con tablero y 2 plantillas');
  assert.equal(ctx._calCargaMasivaVisible('ORLANT'), false, 'con tablero y 1 plantilla: como siempre, por Cargar datos');
  assert.equal(ctx._calCargaMasivaVisible('SIN TABLERO'), true, 'sin tablero: como siempre');
  assert.match(src, /if\(t==='carga' && !_calCargaMasivaVisible\(_ccampana\)\) t='monitoreos';/);
  const cargas = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'cargas.js'), 'utf8');
  assert.match(cargas, /if\(\(_cargasCalidadVarias\[cliente\] \|\| 0\) > 1\) return \{ error: 'Esta campaña tiene /);
  assert.match(cargas, /apiRequest\('GET','\/calidad\/plantillas\/todas'\)/);
});
