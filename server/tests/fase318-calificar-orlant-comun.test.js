// fase318-calificar-orlant-comun.test.js — Fase 318 (10/11/2026, pedido de Edwin): ORLANT
// califica con el formulario comun «Calificar» (el de Mobilize/Aurora) sin tocar su
// plantilla ni el calculo. Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const C = require('../../public/js/calidad-calificar-logic.js');
const calc = require('../calidad-logic');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const pub = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');
let admin, orlant;
before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  const row = db.prepare("SELECT * FROM calidad_plantillas WHERE campana = 'ORLANT' AND principal = 1").get();
  orlant = { id: row.id, campana: 'ORLANT', engine: row.engine, principal: true, campos: row.campos ? JSON.parse(row.campos) : null, items: JSON.parse(row.items) };
});

test('cc2CamposDe: ORLANT (sin campos) usa el formulario comun; las plantillas con campos, los suyos; SURA y las demas sin campos, el de antes', () => {
  assert.equal(orlant.campos, null, 'la plantilla de ORLANT no se toca (sigue sin campos)');
  assert.deepEqual(C.cc2CamposDe(orlant).map((c) => c.k), ['asesor', 'fecha', 'idLlamada', 'telefono', 'codificacion', 'evaluador', 'canal', 'observaciones']);
  const mob = { campana: 'MOBILIZE', campos: [{ k: 'asesor', etiqueta: 'A' }, { k: 'placa', etiqueta: 'P' }] };
  assert.equal(C.cc2CamposDe(mob), mob.campos, 'Mobilize/Aurora: sus propios campos, igual que hoy');
  assert.equal(C.cc2CamposDe({ campana: 'SURA', engine: 'sura', campos: null }), null);
  assert.equal(C.cc2CamposDe({ campana: 'ORLANT', engine: 'sura', campos: null }), null, 'motor de descuento nunca');
  assert.equal(C.cc2CamposDe({ campana: 'OTRA', campos: null }), null);
  assert.equal(C.cc2CamposDe(null), null);
});

test('ORLANT: 17 items, 7 criticos, pesos 100, todos admiten N/A (como el formulario de antes); textos del item como Mobilize', () => {
  assert.equal(orlant.items.length, 17);
  assert.equal(orlant.items.filter((i) => i.critico).length, 7);
  assert.equal(orlant.items.reduce((s, i) => s + i.weight, 0), 100);
  assert.ok(orlant.items.every((i) => i.admiteNA !== false), 'ningun item de ORLANT tenia N/A bloqueado');
  const crit = orlant.items.find((i) => i.critico), normal = orlant.items.find((i) => !i.critico);
  assert.equal(C.cc2SubItem(crit), '⚠ Crítico · peso ' + crit.weight + '% · NO = −20 pts');
  assert.equal(C.cc2SubItem(normal), 'Peso ' + normal.weight + '% · NO = −' + normal.weight + ' pts');
});

test('nota en vivo del formulario comun = calculo del servidor de ORLANT para un monitoreo completo (todas las combinaciones probadas)', () => {
  const vals = ['SI', 'NO', 'N/A'];
  let semilla = 7;
  const azar = () => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla; };
  for (let k = 0; k < 400; k++) {
    const a = {};
    orlant.items.forEach((it) => { a[it.n] = vals[azar() % 3]; });
    assert.equal(C.cc2Nota(orlant.items, a), calc.computeScore(orlant.items, a, orlant.engine).puntaje, JSON.stringify(a));
  }
  const todoSi = Object.fromEntries(orlant.items.map((i) => [i.n, 'SI']));
  assert.equal(C.cc2Nota(orlant.items, todoSi), 100);
  assert.equal(C.cc2Faltantes(orlant.items, todoSi).length, 0);
});

test('guardar como lo manda el formulario comun para ORLANT: sin plantillaId (la principal), canal elegido, mismo puntaje que el servidor; editar conserva respuestas', async () => {
  const answers = Object.fromEntries(orlant.items.map((i) => [i.n, i.n === 6 ? 'NO' : (i.n === 17 ? 'N/A' : 'SI')]));
  const body = { campana: 'ORLANT', asesor: 'Asesor Ficticio 318', fecha: new Date().toISOString().slice(0, 10), canal: 'WPP', idLlamada: 'ID-FICTICIO', telefono: '', codificacion: '', observaciones: 'Observación ficticia', answers, extras: {}, evaluador: 'Administrador' };
  const r = await request(app).post('/api/monitoreos').set(H(admin)).send(body);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const fila = db.prepare('SELECT * FROM monitoreos WHERE id = ?').get(r.body.id);
  assert.equal(fila.plantillaId, null, 'igual que el formulario de antes');
  assert.equal(fila.canal, 'WPP');
  assert.equal(Number(fila.puntaje), calc.computeScore(orlant.items, answers, 'standard').puntaje);
  assert.equal(Number(fila.puntaje), C.cc2Nota(orlant.items, answers));
  const ed = await request(app).put('/api/monitoreos/' + r.body.id).set(H(admin)).send({ ...body, observaciones: 'Editada ficticia' });
  assert.equal(ed.status, 200, JSON.stringify(ed.body));
  const f2 = db.prepare('SELECT * FROM monitoreos WHERE id = ?').get(r.body.id);
  assert.equal(f2.puntaje, fila.puntaje); assert.equal(f2.answers, fila.answers);
});

test('front: el formulario comun se elige con cc2CamposDe, tiene canal, y editar un monitoreo viejo sin plantillaId abre la principal', () => {
  const src = pub('calidad-calificar.js');
  assert.doesNotThrow(() => new vm.Script(src)); assert.doesNotThrow(() => new vm.Script(pub('calidad-calificar-logic.js')));
  assert.match(src, /var usar = !!cc2CamposDe\(p\);/);
  assert.match(src, /var b = cc2Bloques\(cc2CamposDe\(p\)\);/);
  assert.match(src, /if \(c\.k === 'canal'\) return .*<option value="LLAMADA">Llamada<\/option><option value="WPP">WhatsApp \/ Chat<\/option>/);
  assert.match(src, /canal: _cc2Val\('canal'\) \|\| 'LLAMADA'/);
  assert.match(src, /if \(p\.campos \|\| !p\.principal\) body\.plantillaId = p\.id;/);
  assert.match(src, /m\.plantillaId == null \? CAL_PLANTILLAS_TODAS\.find\(function \(x\) \{ return x\.campana === m\.campana && x\.principal; \}\)/);
  assert.match(src, /set\('canal', m\.canal \|\| 'LLAMADA'\)/);
  assert.match(src, /Ítems de la plantilla<\/h3><span class="cc2-tag">' \+ \(cc2EsDescuento\(_cc2Eng\(\)\) \? '⚠ Crítico en NO: nota 0 % · sin N\/A' : '⚠ Crítico: NO resta 20 pts · N\/A = no aplica'\)/); // Fase 322
});
