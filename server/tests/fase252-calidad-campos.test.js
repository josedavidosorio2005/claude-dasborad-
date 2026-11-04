// fase252-calidad-campos.test.js — Fase 252 (plan de Calidad C2, pedido de
// Edwin 04/11): campos del formulario por plantilla (lista cerrada), monitoreo
// completo obligatorio, extras (placa, tipo de llamada, ID de agente, motivo),
// columnas preparadas para la auditoria desde el NPS (origen, encuestaId) y
// CALIDAD edita lo que ella califico. Plantilla y datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const dbMod = require('../db');
const calc = require('../calidad-logic');
const L = require('../calidad-campos');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const PW = 'Clave#Fase252x';
const hoy = new Date().toISOString().slice(0, 10);
let admin, cal1, cal2, plantillaId;

// 6 items sinteticos, 2 criticos, pesos 100
const ITEMS = [
  { n: 1, cat: 'Apertura', label: 'Item uno', weight: 10, critico: false },
  { n: 2, cat: 'Normativo', label: 'Item dos', weight: 15, critico: true },
  { n: 3, cat: 'Gestion', label: 'Item tres', weight: 25, critico: true },
  { n: 4, cat: 'Gestion', label: 'Item cuatro', weight: 20, critico: false },
  { n: 5, cat: 'Cierre', label: 'Item cinco', weight: 20, critico: false },
  { n: 6, cat: 'Cierre', label: 'Item seis', weight: 10, critico: false, admiteNA: false },
];
const CAMPOS = [{ k: 'asesor', etiqueta: 'Nombre del asesor' }, { k: 'fecha', etiqueta: 'Fecha' }, { k: 'placa', etiqueta: 'Placa VH' },
  { k: 'tipoLlamada', etiqueta: 'Tipo de llamada' }, { k: 'idLlamada', etiqueta: 'ID de grabación' }, { k: 'codificacion', etiqueta: 'Tipificación' },
  { k: 'evaluador', etiqueta: 'Evaluador' }, { k: 'motivo', etiqueta: 'Motivo de afectación' }, { k: 'observaciones', etiqueta: 'Observaciones generales' }];

async function crear(user, rol, perms) {
  const r = await request(app).post('/api/users').set(auth(admin)).send({ nombre: 'Persona ' + user, user, password: PW, rol, perms });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { id: r.body.id, token: await tokenFor(user, PW) };
}
const completo = { 1: 'SI', 2: 'SI', 3: 'NO', 4: 'N/A', 5: 'NO', 6: 'SI' };
const body = (extra) => Object.assign({ campana: 'MOBILIZE', plantillaId, asesor: 'Asesor Sintetico', fecha: hoy, canal: 'LLAMADA', answers: completo,
  extras: { placa: 'ABC123', tipoLlamada: 'Salida' } }, extra);

// Formula "ponderado" del HTML de Edwin: 100 − (NO critico: 20; NO no critico: su peso), 0..100.
function notaHtml(items, a) {
  const ded = items.reduce((s, it) => s + (a[it.n] === 'NO' ? (it.critico ? 20 : it.weight) : 0), 0);
  return Math.max(0, Math.min(100, 100 - ded));
}

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  const info = db.prepare(`INSERT INTO calidad_plantillas (campana, nombre, principal, engine, items, activo, updatedAt, campos, version, completoObligatorio)
    VALUES ('MOBILIZE', 'Mobilize sintetica', 0, 'standard', ?, 1, ?, ?, 2, 1)`).run(JSON.stringify(ITEMS), new Date().toISOString(), JSON.stringify(CAMPOS));
  plantillaId = Number(info.lastInsertRowid);
  cal1 = await crear('cal252a', 'CALIDAD', { campana_MOBILIZE: true });
  cal2 = await crear('cal252b', 'CALIDAD', { campana_MOBILIZE: true });
});

test('migracion: columnas nuevas y opcionales; idempotente; filas viejas intactas', () => {
  const pl = db.prepare('PRAGMA table_info(calidad_plantillas)').all().map((c) => c.name);
  const mon = db.prepare('PRAGMA table_info(monitoreos)').all().map((c) => c.name);
  for (const c of ['campos', 'version', 'completoObligatorio']) assert.ok(pl.includes(c), c);
  for (const c of ['extras', 'origen', 'encuestaId']) assert.ok(mon.includes(c), c);
  const antes = JSON.stringify(db.prepare('SELECT * FROM calidad_plantillas ORDER BY id').all());
  dbMod.migrarCalidadCamposPorPlantilla();
  assert.equal(JSON.stringify(db.prepare('SELECT * FROM calidad_plantillas ORDER BY id').all()), antes);
  const viejas = db.prepare("SELECT campos, version, completoObligatorio FROM calidad_plantillas WHERE campana = 'ORLANT'").all();
  viejas.forEach((r) => { assert.equal(r.campos, null); assert.equal(r.version, 1); assert.equal(r.completoObligatorio, 0); });
});

test('motor standard = formula "ponderado" del HTML (casos sinteticos)', () => {
  const casos = [
    {}, { 1: 'NO' }, { 2: 'NO' }, { 2: 'NO', 3: 'NO' }, { 1: 'NO', 4: 'NO', 5: 'NO', 6: 'NO' },
    { 2: 'NO', 3: 'NO', 1: 'NO', 4: 'NO', 5: 'NO', 6: 'NO' }, { 4: 'N/A', 5: 'N/A' }, { 3: 'NO', 5: 'NO' },
  ];
  for (const c of casos) {
    const a = Object.assign({ 1: 'SI', 2: 'SI', 3: 'SI', 4: 'SI', 5: 'SI', 6: 'SI' }, c);
    assert.equal(calc.computeScore(ITEMS, a, 'standard').puntaje, notaHtml(ITEMS, a), JSON.stringify(c));
  }
  const r = calc.computeScore(ITEMS, { 1: 'SI', 2: 'NO', 3: 'NO', 4: 'SI', 5: 'SI', 6: 'SI' }, 'standard');
  assert.equal(r.puntaje, 60);
  assert.match(r.clasificacion, /CRITICO/);
  assert.match(r.nivelCritico, /CRITICO ABSOLUTO/);
});

test('lista cerrada de campos: alias del HTML, obligatorios y campos no permitidos', () => {
  const ok = L.normalizarCampos(['asesor', 'fecha', 'codigo', 'obs', 'placa', 'placa'], { codigo: 'Tipificación' });
  assert.deepEqual(ok.campos.map((c) => c.k), ['asesor', 'fecha', 'codificacion', 'observaciones', 'placa']);
  assert.equal(ok.campos[2].etiqueta, 'Tipificación');
  assert.match(L.normalizarCampos(['asesor', 'cedula']).error, /no permitido/);
  assert.match(L.normalizarCampos(['asesor']).error, /Fecha/);
  assert.deepEqual(L.itemsFaltantes(ITEMS, { 1: 'SI', 2: 'NO', 3: 'SI', 4: 'SI', 5: 'SI', 6: 'N/A' }), [6], 'N/A donde no se admite');
  assert.equal(L.motivoDesdeItems(ITEMS, completo), '3. Item tres · 5. Item cinco');
});

test('no se guarda un monitoreo incompleto: 400 con la lista de faltantes', async () => {
  const r = await request(app).post('/api/monitoreos').set(auth(cal1.token)).send(body({ answers: { 1: 'SI', 2: 'SI', 3: 'NO' } }));
  assert.equal(r.status, 400);
  assert.match(r.body.error, /Faltan ítems por calificar/);
  assert.deepEqual(r.body.faltantes, [4, 5, 6]);
});

test('monitoreo completo: guarda extras de la lista, arma el motivo, origen manual; tipo de llamada invalido -> 400', async () => {
  const mal = await request(app).post('/api/monitoreos').set(auth(cal1.token)).send(body({ extras: { tipoLlamada: 'Otra' } }));
  assert.equal(mal.status, 400);
  assert.match(mal.body.error, /Tipo de llamada/);
  const r = await request(app).post('/api/monitoreos').set(auth(cal1.token)).send(body({ extras: { placa: 'ABC123', tipoLlamada: 'Salida', cedula: '123', idAgente: '77' } }));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.puntaje, notaHtml(ITEMS, completo));
  assert.deepEqual(r.body.extras, { placa: 'ABC123', tipoLlamada: 'Salida', motivo: '3. Item tres · 5. Item cinco' }, 'sin cedula ni idAgente: no los pide la plantilla');
  assert.equal(r.body.origen, 'manual');
  assert.equal(r.body.encuestaId, null);
  assert.equal(r.body.plantillaId, plantillaId);
});

test('editar: quien lo califico si; otra persona de Calidad no; las reglas de la plantilla se siguen aplicando', async () => {
  const c = await request(app).post('/api/monitoreos').set(auth(cal1.token)).send(body());
  assert.equal(c.status, 201);
  const otro = await request(app).put('/api/monitoreos/' + c.body.id).set(auth(cal2.token)).send({ answers: Object.assign({}, completo, { 5: 'SI' }) });
  assert.equal(otro.status, 403);
  const incompleto = await request(app).put('/api/monitoreos/' + c.body.id).set(auth(cal1.token)).send({ answers: { 1: 'SI' } });
  assert.equal(incompleto.status, 400);
  const ok = await request(app).put('/api/monitoreos/' + c.body.id).set(auth(cal1.token)).send({ answers: Object.assign({}, completo, { 5: 'SI' }) });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.puntaje, 80);
  assert.deepEqual(ok.body.extras, { placa: 'ABC123', tipoLlamada: 'Salida', motivo: '3. Item tres' }, 'extras previos se conservan; el motivo se recalcula');
  // aunque la plantilla quede reemplazada (inactiva), el monitoreo se puede seguir editando
  db.prepare('UPDATE calidad_plantillas SET activo = 0 WHERE id = ?').run(plantillaId);
  try {
    const sigue = await request(app).put('/api/monitoreos/' + c.body.id).set(auth(admin)).send({ observaciones: 'revisado' });
    assert.equal(sigue.status, 200, JSON.stringify(sigue.body));
  } finally {
    db.prepare('UPDATE calidad_plantillas SET activo = 1 WHERE id = ?').run(plantillaId);
  }
});

test('plantillas viejas (sin campos) siguen como siempre: se puede guardar con items sin calificar y sin extras', async () => {
  const r = await request(app).post('/api/monitoreos').set(auth(admin)).send({ campana: 'ORLANT', asesor: 'Asesor Sintetico', fecha: hoy, canal: 'LLAMADA', answers: { 1: 'SI' }, extras: { placa: 'X' } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.extras, null);
  const p = await request(app).get('/api/calidad/plantillas').set(auth(admin));
  const orl = p.body.find((x) => x.campana === 'ORLANT');
  assert.equal(orl.campos, null);
  assert.equal(orl.completoObligatorio, false);
  assert.equal(orl.version, 1);
});
