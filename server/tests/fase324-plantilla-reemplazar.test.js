// fase324-plantilla-reemplazar.test.js — Fase 324 (10/11/2026): reemplazar EN SU LUGAR (misma
// id) una plantilla de Calidad que no tiene monitoreos, por el importador de Calidad › Plantillas.
// Con monitoreos se rechaza (ninguna nota se recalcula nunca). Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const H = (t) => ({ Authorization: 'Bearer ' + t });
const pub = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');

const base = (items, nombre) => ({ formato: 'inconexion-plantilla-calidad', version: 1, nombre: nombre || 'Plantilla Ficticia 324', campana: 'SURA', motor: 'descuento',
  campos: ['asesor', 'fecha', 'observaciones'], items });
const V1 = base([{ n: 1, nombre: 'Item viejo uno', critico: true }, { n: 2, nombre: 'Item viejo dos', descuento: 10 }]);
const V2 = base([{ n: 1, nombre: 'Item nuevo uno', opciones: [{ texto: 'Cumple', descuento: 0 }, { texto: 'Parcial', descuento: 5 }] }, { n: 2, nombre: 'Item nuevo dos', critico: true }, { n: 3, nombre: 'Item nuevo tres', descuento: 20 }], 'Plantilla Ficticia 324 corregida');
let admin, sup, id;
before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
    .run('Supervisor Ficticio 324', 'f324_sup', 'SUPERVISOR', bcrypt.hashSync('Clave#2026x', 4), JSON.stringify({ campana_SURA: true }), new Date().toISOString());
  sup = await tokenFor('f324_sup', 'Clave#2026x');
  const r = await request(app).post('/api/calidad/plantillas/importar').set(H(admin)).send({ archivo: V1, confirmar: true, principal: true });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  id = r.body.plantilla.id;
});
const fila = () => db.prepare('SELECT * FROM calidad_plantillas WHERE id = ?').get(id);

test('reemplazar sin monitoreos: vista previa sin escribir y luego la misma id con los ítems nuevos (versión y principal iguales)', async () => {
  const antes = fila();
  const vp = await request(app).post('/api/calidad/plantillas/importar').set(H(admin)).send({ archivo: V2, reemplazarId: id });
  assert.equal(vp.status, 200, JSON.stringify(vp.body));
  assert.equal(vp.body.confirmado, false); assert.equal(vp.body.plan.accion, 'reemplazar');
  assert.deepEqual(fila(), antes, 'la vista previa no cambia nada');
  const n0 = db.prepare('SELECT COUNT(*) AS n FROM calidad_plantillas').get().n;
  const ok = await request(app).post('/api/calidad/plantillas/importar').set(H(admin)).send({ archivo: V2, reemplazarId: id, confirmar: true });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const d = fila();
  assert.equal(d.id, id); assert.equal(d.version, antes.version); assert.equal(d.principal, antes.principal); assert.equal(d.activo, 1);
  assert.equal(d.nombre, 'Plantilla Ficticia 324 corregida');
  assert.deepEqual(JSON.parse(d.items).map((i) => i.label), ['Item nuevo uno', 'Item nuevo dos', 'Item nuevo tres']);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM calidad_plantillas').get().n, n0, 'no se crea otra plantilla');
});

test('con monitoreos, otra campaña, plantilla inexistente o sin ser administrador: no se reemplaza', async () => {
  const otra = Object.assign({}, V2, { campana: 'ORLANT' });
  assert.equal((await request(app).post('/api/calidad/plantillas/importar').set(H(admin)).send({ archivo: otra, reemplazarId: id, confirmar: true })).status, 400);
  assert.equal((await request(app).post('/api/calidad/plantillas/importar').set(H(admin)).send({ archivo: V2, reemplazarId: 999999, confirmar: true })).status, 404);
  assert.equal((await request(app).post('/api/calidad/plantillas/importar').set(H(sup)).send({ archivo: V2, reemplazarId: id, confirmar: true })).status, 403);
  const m = await request(app).post('/api/monitoreos').set(H(sup)).send({ campana: 'SURA', asesor: 'Asesor Ficticio', fecha: new Date().toISOString().slice(0, 10), canal: 'LLAMADA', observaciones: 'Obs ficticia', answers: { 1: 'SI', 2: 'SI', 3: 'SI' }, extras: {} });
  assert.equal(m.status, 201, JSON.stringify(m.body));
  const antes = fila();
  const r = await request(app).post('/api/calidad/plantillas/importar').set(H(admin)).send({ archivo: V1, reemplazarId: id, confirmar: true });
  assert.equal(r.status, 400); assert.match(r.body.error, /monitoreo/);
  assert.deepEqual(fila(), antes, 'con monitoreos no cambia nada');
});

test('front: botón «Reemplazar» solo sin monitoreos; diccionario del motor descuento con afectación máxima y saltos de línea', () => {
  const pl = pub('js/calidad-plantillas.js'), an = pub('js/calidad-analisis.js');
  for (const s of [pl, an, pub('js/calidad-plantillas-logic.js'), pub('js/calidad-calificar.js')]) assert.doesNotThrow(() => new vm.Script(s));
  assert.match(pl, /\(p\.activo && !p\.monitoreos \? ' <button type="button" class="btn-sm btn-edit" data-cpl-reemplazar=/);
  assert.match(pl, /_cplReemplazarId \? \{ reemplazarId: _cplReemplazarId \} : \{\}/);
  assert.match(an, /Afectación máxima ' \+ \(it\.critico \? '100' : esc\(it\.weight\)\) \+ ' %/);
  assert.match(pub('css/styles.css'), /\.ca-desc-lineas\{white-space:pre-line\}/);
  const L = require('../../public/js/calidad-plantillas-logic.js');
  assert.match(L.cplPlanTexto({ accion: 'reemplazar', version: 1, reemplaza: { nombre: 'X', version: 1 } }, 'X', 'SURA')[0], /ninguna nota cambia/);
});
