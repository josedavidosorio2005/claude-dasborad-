// fase254-calidad-calificar.test.js — Fase 254 (plan de Calidad B3): formulario
// "Calificar" como el HTML de Edwin (logica del navegador), el rol CALIDAD ve
// solo los monitoreos que el califico, y las versiones inactivas se pueden
// pedir para ver/editar (nunca usables). Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const calc = require('../calidad-logic');
const F = require('../../public/js/calidad-calificar-logic.js');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const PW = 'Clave#Fase254x';
const hoy = new Date().toISOString().slice(0, 10);
let admin, calA, calB, sup, plantillaId;

const ITEMS = [
  { n: 1, cat: 'Apertura', label: 'Saluda', weight: 10, critico: false },
  { n: 2, cat: 'Normativo', label: 'Valida', weight: 15, critico: true },
  { n: 3, cat: 'Normativo', label: 'Graba', weight: 25, critico: true },
  { n: 4, cat: 'Gestion', label: 'Registra', weight: 30, critico: false },
  { n: 5, cat: 'Cierre', label: 'Despide', weight: 20, critico: false, admiteNA: false },
];

async function crear(user, rol, perms) {
  const r = await request(app).post('/api/users').set(auth(admin)).send({ nombre: 'Persona ' + user, user, password: PW, rol, perms });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { id: r.body.id, token: await tokenFor(user, PW) };
}
const mon = (tok, extra) => request(app).post('/api/monitoreos').set(auth(tok)).send(Object.assign({ campana: 'MOBILIZE', plantillaId, asesor: 'Asesor Sintetico', fecha: hoy, canal: 'LLAMADA',
  answers: { 1: 'SI', 2: 'SI', 3: 'SI', 4: 'SI', 5: 'SI' }, observaciones: 'ok' }, extra));

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  const campos = JSON.stringify([{ k: 'asesor', etiqueta: 'Asesor' }, { k: 'fecha', etiqueta: 'Fecha' }, { k: 'motivo', etiqueta: 'Motivo' }, { k: 'observaciones', etiqueta: 'Observaciones' }]);
  plantillaId = Number(db.prepare(`INSERT INTO calidad_plantillas (campana, nombre, principal, engine, items, activo, updatedAt, campos, version, completoObligatorio)
    VALUES ('MOBILIZE', 'Sintetica 254', 0, 'standard', ?, 1, ?, ?, 1, 1)`).run(JSON.stringify(ITEMS), new Date().toISOString(), campos).lastInsertRowid);
  calA = await crear('cal254a', 'CALIDAD', { Calidad: true, campana_MOBILIZE: true });
  calB = await crear('cal254b', 'CALIDAD', { Calidad: true, campana_MOBILIZE: true });
  sup = await crear('sup254', 'SUPERVISOR', { campana_MOBILIZE: true, cliente_MOBILIZE: true });
});

test('formulario: nota en vivo igual al servidor, faltantes, motivo, alerta y observacion sugerida', () => {
  const casos = [{ 1: 'SI', 2: 'SI', 3: 'SI', 4: 'SI', 5: 'SI' }, { 1: 'NO', 2: 'SI', 3: 'SI', 4: 'N/A', 5: 'SI' }, { 1: 'SI', 2: 'NO', 3: 'NO', 4: 'NO', 5: 'NO' }, { 1: 'SI', 2: 'NO', 3: 'SI', 4: 'SI', 5: 'SI' }];
  for (const a of casos) assert.equal(F.cc2Nota(ITEMS, a), calc.computeScore(ITEMS, a, 'standard').puntaje, JSON.stringify(a));
  assert.equal(F.cc2Nota(ITEMS, {}), null);
  assert.deepEqual(F.cc2Faltantes(ITEMS, { 1: 'SI', 5: 'N/A' }).map((i) => i.n), [2, 3, 4, 5], 'item 5 no admite N/A');
  assert.equal(F.cc2Motivo(ITEMS, { 1: 'NO', 3: 'NO' }), '1. Saluda · 3. Graba');
  assert.deepEqual(F.cc2Deducciones(ITEMS, { 1: 'NO', 3: 'NO' }).map((d) => d.puntos), [10, 20]);
  assert.equal(F.cc2Alerta(0), null);
  assert.match(F.cc2Alerta(1).t, /1 crítico/);
  assert.match(F.cc2Alerta(2).t, /absoluto/);
  assert.deepEqual([F.cc2Clase(null).k, F.cc2Clase(69.9).k, F.cc2Clase(70).k, F.cc2Clase(90).k], ['na', 'bad', 'warn', 'ok']);
  assert.equal(F.cc2SugerirObs(ITEMS, { 1: 'SI' }), null);
  assert.match(F.cc2SugerirObs(ITEMS, { 1: 'SI', 2: 'SI', 3: 'SI', 4: 'SI', 5: 'SI' }), /Felicitaciones/);
  assert.equal(F.cc2SugerirObs(ITEMS, { 1: 'NO', 2: 'NO', 3: 'SI', 4: 'SI', 5: 'SI' }), 'Ítem 1 – Saluda: no cumple (−10 pts).\nÍtem 2 – Valida: no cumple (ítem crítico, −20 pts).');
  assert.equal(F.cc2SubItem(ITEMS[1]), '⚠ Crítico · peso 15% · NO = −20 pts');
  assert.equal(F.cc2SubItem(ITEMS[0]), 'Peso 10% · NO = −10 pts');
  assert.deepEqual(F.cc2PorCategoria(ITEMS).map((g) => [g.cat, g.items.length]), [['Apertura', 1], ['Normativo', 2], ['Gestion', 1], ['Cierre', 1]]);
  const b = F.cc2Bloques([{ k: 'asesor' }, { k: 'motivo' }, { k: 'fecha' }, { k: 'observaciones' }]);
  assert.deepEqual([b.generales.map((c) => c.k), b.detalle.map((c) => c.k)], [['asesor', 'fecha'], ['motivo', 'observaciones']]);
});

// Fase 329: la regla cambio -- CALIDAD ve TODOS los monitoreos de su campaña (antes solo los suyos).
// Fase 334: vuelve la regla de la Fase 254 (la Fase 329 se reemplazo): CALIDAD ve solo lo que
// califico (por id; los viejos sin id, por el nombre del evaluador). Supervisor (sin vista=propios,
// el consolidado del dashboard) y admin, todos.
test('CALIDAD ve solo los monitoreos que ella califico; supervisor (dashboard) y admin ven todos (Fase 334)', async () => {
  const a = await mon(calA.token); assert.equal(a.status, 201, JSON.stringify(a.body));
  const b = await mon(calB.token); assert.equal(b.status, 201);
  // monitoreo viejo sin evaluadorUserId con el nombre de calA (cuenta como suyo)
  db.prepare("UPDATE monitoreos SET evaluadorUserId = NULL, evaluador = 'Persona cal254a' WHERE id = ?").run(b.body.id);
  const c = await mon(calB.token); assert.equal(c.status, 201);
  const ids = async (tok) => (await request(app).get('/api/monitoreos?campana=MOBILIZE').set(auth(tok))).body.map((m) => m.id);
  const deA = await ids(calA.token);
  assert.ok(deA.includes(a.body.id) && deA.includes(b.body.id), 'los suyos (por id y por nombre)');
  assert.ok(!deA.includes(c.body.id), 'no el de otra persona');
  const deB = await ids(calB.token);
  assert.ok(deB.includes(c.body.id) && !deB.includes(a.body.id));
  for (const tok of [sup.token, admin]) {
    const todos = await ids(tok);
    assert.ok([a, b, c].every((x) => todos.includes(x.body.id)), 'supervisor/admin: todos');
  }
  const mes = hoy.slice(0, 7);
  const conMes = (await request(app).get('/api/monitoreos?campana=MOBILIZE&mes=' + mes).set(auth(calA.token))).body.map((m) => m.id);
  assert.ok(conMes.includes(a.body.id) && !conMes.includes(c.body.id), 'con mes, el mismo filtro');
});

test('/calidad/plantillas/todas?inactivas=1 trae las versiones viejas, nunca usables', async () => {
  db.prepare('UPDATE calidad_plantillas SET activo = 0 WHERE id = ?').run(plantillaId);
  try {
    const sin = await request(app).get('/api/calidad/plantillas/todas').set(auth(calA.token));
    assert.ok(!sin.body.some((p) => p.id === plantillaId));
    const con = await request(app).get('/api/calidad/plantillas/todas?inactivas=1').set(auth(calA.token));
    const p = con.body.find((x) => x.id === plantillaId);
    assert.ok(p, 'aparece');
    assert.equal(p.activo, false);
    assert.equal(p.usable, false);
  } finally {
    db.prepare('UPDATE calidad_plantillas SET activo = 1 WHERE id = ?').run(plantillaId);
  }
});
