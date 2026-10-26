// Fase 184 (pedido del usuario, Mobilize): cada comentario de la Encuesta
// lleva el ID de la llamada (CONN_ID del archivo), en la lista y en el Excel.
// Sin telefono (regla de la Fase 131). Un archivo sin CONN_ID deja el campo
// vacio, sin cruzar con el CDR. Todo SINTETICO.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const L = require('../../public/js/encuesta-logic.js');
const { request, app, tokenFor, MASTER_PASSWORD, db } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const HEADER = ['AGENT_NAME', 'SKILL_NAME', 'DATE', 'Q01', 'Q02', 'Q03', 'Q04', 'VOICE_MESSAGE'];
const JS = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');

test('lector: CONN_ID se lee como texto; TELEPHONE sigue sin leerse; sin CONN_ID queda vacio con aviso', () => {
  const con = L.encuestaParseFilas([
    HEADER.concat(['CONN_ID', 'TELEPHONE']),
    ['Asesor Uno', 'SKILL A', '2026-09-01 10:00', 9, 5, 1, 5, 'Excelente', 'ABC-123-XYZ', '3000000000'],
    ['Asesor Dos', 'SKILL A', '2026-09-02 10:00', 7, 3, 2, 3, '-', '-', '3000000001'],
  ]);
  assert.deepEqual(con.filas, [
    ['2026-09-01', 'Asesor Uno', 'SKILL A', 9, 5, 1, 5, 'Excelente', 'ABC-123-XYZ'],
    ['2026-09-02', 'Asesor Dos', 'SKILL A', 7, 3, 2, 3, '', ''],
  ]);
  assert.ok(!JSON.stringify(con.filas).includes('3000000000'), 'el telefono nunca viaja');
  assert.ok(!con.avisos.some((a) => /CONN_ID/.test(a)));

  const sin = L.encuestaParseFilas([HEADER, ['Asesor Uno', 'SKILL A', '2026-09-01 10:00', 9, 5, 1, 5, 'Excelente']]);
  assert.deepEqual(sin.filas, [['2026-09-01', 'Asesor Uno', 'SKILL A', 9, 5, 1, 5, 'Excelente', '']]);
  assert.ok(sin.avisos.includes('El archivo no trae la columna CONN_ID: los comentarios quedan sin ID de llamada.'));
});

test('API: la carga guarda CONN_ID y los comentarios lo devuelven; una carga con la forma vieja (8 campos) sigue valida', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const c = await request(app).post('/api/calidad/encuestas/carga').set(auth(admin)).send({ campana: 'MOBILIZE', archivoNombre: 'sintetico.xlsx', filas: [
    ['2025-04-01', 'Asesor Uno', 'SKILL A', 9, 5, 1, 5, 'Excelente', 'ABC-123-XYZ'],
    ['2025-04-02', 'Asesor Dos', 'SKILL A', 7, 3, 2, 3, 'Regular', ''],
  ] });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  const r = await request(app).get('/api/calidad/encuestas/comentarios').query({ campana: 'MOBILIZE', desde: '2025-04-01', hasta: '2025-04-30' }).set(auth(admin));
  assert.equal(r.status, 200);
  const lista = Array.isArray(r.body) ? r.body : r.body.comentarios;
  assert.deepEqual(lista.map((x) => [x.comentario, x.connId]), [['Regular', ''], ['Excelente', 'ABC-123-XYZ']]);

  const vieja = await request(app).post('/api/calidad/encuestas/carga').set(auth(admin)).send({ campana: 'MOBILIZE', filas: [['2025-05-01', 'Asesor Uno', 'SKILL A', 9, 5, 1, 5, 'Bien']] });
  assert.equal(vieja.status, 201, JSON.stringify(vieja.body));
  assert.equal(db.prepare("SELECT connId FROM encuestas WHERE campana = 'MOBILIZE' AND fecha = '2025-05-01'").get().connId, '');
  assert.ok(!db.prepare('PRAGMA table_info(encuestas)').all().some((x) => /tel/i.test(x.name)), 'la tabla sigue sin telefono');
});

test('vista: columna "ID de llamada" en la lista de comentarios y en el Excel', () => {
  const s = JS('encuesta.js');
  assert.ok(s.includes('<th class="th-izq">ID de llamada</th>'));
  assert.ok(s.includes("esc(c.connId || '')"));
  assert.ok(s.includes("f['ID de llamada'] = c.connId || '';"));
  assert.ok(s.includes('<th class="th-izq">Comentario</th><th class="th-izq">ID de llamada</th>'), 'al final, despues del comentario');
});

test('MES: los meses de los paneles (Encuesta, Resumen de calidad...) se suman sin pisarse entre fuentes', async () => {
  const s = JS('dashboard-generic.js');
  assert.ok(!s.includes('mesesSoloPanel.concat((await'), 'leer la lista antes del await hace que la ultima fuente pise a las otras');
  assert.ok(s.includes('var mesesFuente = (await fuente()) || []; mesesSoloPanel = mesesSoloPanel.concat(mesesFuente);'));
  // El patron viejo, reproducido: con 2 fuentes, la mas lenta (vacia) borraba la otra.
  let viejo = [];
  const lenta = () => new Promise((r) => setTimeout(() => r([]), 20));
  const rapida = async () => ['2025-04'];
  await Promise.all([lenta, rapida].map(async (f) => { viejo = viejo.concat((await f()) || []); }));
  assert.deepEqual(viejo, []);
  let nuevo = [];
  await Promise.all([lenta, rapida].map(async (f) => { const m = (await f()) || []; nuevo = nuevo.concat(m); }));
  assert.deepEqual(nuevo, ['2025-04']);
});
