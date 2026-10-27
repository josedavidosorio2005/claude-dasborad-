// fase193-encuesta-base-completa.test.js — Fase 193 (Mobilize, Encuesta):
// Edwin manda ahora el export HistIVR COMPLETO de Wolkvox (25 columnas,
// encabezado en la fila 1). Se sube tal cual; las graficas salen de las 9
// columnas de siempre; el ID de la llamada (CONN_ID) va en los comentarios y
// en el Excel; el telefono (ANI), AGENT_DNI y CUSTOMER_ID nunca salen del
// navegador (regla de la Fase 131). Todo con datos SINTETICOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
// helpers primero: arma el entorno de prueba antes de cargar el servidor.
const { request, app, tokenFor, MASTER_PASSWORD, db } = require('./helpers');
const L = require('../../public/js/encuesta-logic.js');
const { CARGAS, columnasDeCarga } = require('../../scripts/plantillas/modulos');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
// Centinelas: si alguno aparece en lo que va al servidor, en la base o en una respuesta, la prueba falla.
const ANI = '3009998877';
const DNI = '1099887766';
const CLIENTE = 'CLIENTE-CENTINELA-77';
const HISTIVR = ['AGENT_ID', 'AGENT_NAME', 'AGENT_DNI', 'SKILL_ID', 'SKILL_NAME', 'DATE', 'CONN_ID', 'ANI', 'CUSTOMER_ID',
  'Q01', 'Q02', 'Q03', 'Q04', 'Q05', 'Q06', 'Q07', 'Q08', 'Q09', 'Q10',
  'VOICE_MESSAGE_DURATION', 'TYPE_INTERACTION', 'RESULT', 'TIME', 'VOICE_MESSAGE', 'FEELING'];
// fila HistIVR: (asesor, fecha, conn, q1..q4, comentario)
const fila = (asesor, fecha, conn, q, comentario) => [
  77, asesor, DNI, 101, 'SKILL SAC', fecha, conn, Number(ANI), CLIENTE,
  q[0], q[1], q[2], q[3], '-', '-', '-', '-', '-', '-',
  12, 'inbound', 'SINTETICO', 30, comentario || '-', comentario ? 'POSITIVO' : '-',
];
const OCT = [
  HISTIVR,
  fila('Asesor Uno', new Date(2025, 2, 3, 9, 0), 'CONN-0001', [10, 5, 1, 5], 'Muy buena atencion'),
  fila('Asesor Uno', new Date(2025, 2, 3, 10, 0), 'CONN-0002', ['-', '-', '-', '-']),
  fila('Asesor Dos', new Date(2025, 2, 4, 11, 0), 'CONN-0003', [7, 4, 2, '-'], 'Tardaron en contestar'),
  fila('Asesor Dos', new Date(2025, 2, 5, 12, 0), 'CONN-0004', [9, '-', 1, 4]),
];

test('base completa HistIVR: entra tal cual (encabezado en la fila 1), 4 filas, sin avisos', () => {
  const r = L.encuestaParseFilas(OCT);
  assert.equal(r.error, undefined);
  assert.equal(r.filas.length, 4);
  assert.deepEqual(r.avisos, []);
  assert.deepEqual([r.desde, r.hasta, r.dias], ['2025-03-03', '2025-03-05', 3]);
  assert.deepEqual(r.columnasUsadas, ['AGENT_NAME', 'SKILL_NAME', 'DATE', 'Q01', 'Q02', 'Q03', 'Q04', 'VOICE_MESSAGE', 'CONN_ID']);
  assert.equal(r.columnasIgnoradas, 16);
  assert.equal(r.conConnId, 4);
  // Las graficas: respondieron P1 3 de 4, P3 = Si 2 / No 1, 2 comentarios.
  assert.equal(r.conteos.total - r.conteos.preguntas.q1.sinRespuesta, 3);
  assert.deepEqual([r.conteos.preguntas.q3.valores[1], r.conteos.preguntas.q3.valores[2]], [2, 1]);
  assert.equal(r.conteos.comentarios, 2);
  assert.deepEqual(r.filas.map((f) => f[8]), ['CONN-0001', 'CONN-0002', 'CONN-0003', 'CONN-0004']);
});

test('privacidad: ANI, AGENT_DNI, CUSTOMER_ID, Q05-Q10, RESULT y FEELING nunca llegan a las filas', () => {
  const r = L.encuestaParseFilas(OCT);
  const json = JSON.stringify(r.filas);
  for (const c of [ANI, DNI, CLIENTE, 'POSITIVO', 'SINTETICO']) assert.ok(!json.includes(c), 'se colo ' + c);
  assert.ok(r.filas.every((f) => f.length === L.ENCUESTA_ORDEN_ARRAY.length));
  assert.ok(!L.ENCUESTA_COLUMNAS.some((c) => ['ANI', 'AGENT_DNI', 'CUSTOMER_ID', 'TELEPHONE'].includes(c.label)));
});

test('compatibilidad: el formato viejo (fila de texto antes del encabezado, sin CONN_ID) sigue entrando, con aviso', () => {
  const viejo = [['Reporte de encuesta'], ['AGENT_NAME', 'SKILL_NAME', 'DATE', 'Q01', 'Q02', 'Q03', 'Q04', 'VOICE_MESSAGE'],
    ['Asesor Uno', 'SKILL SAC', '2025-03-03 09:00', 9, 5, 1, 4, 'Bien']];
  const r = L.encuestaParseFilas(viejo);
  assert.equal(r.filas.length, 1);
  assert.equal(r.conConnId, 0);
  assert.ok(r.avisos.some((a) => /no trae la columna CONN_ID/.test(a)));
});

test('plantilla del Centro = las 25 columnas del export de Wolkvox, en su orden; el lector la reconoce', () => {
  const c = CARGAS.find((x) => x.archivo === 'PLANTILLA_ENCUESTA.xlsx');
  assert.deepEqual(columnasDeCarga(c).map((x) => x.encabezado), HISTIVR);
  assert.equal(L.encuestaBuscarEncabezado([HISTIVR], 20), 0);
  const ficha = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'plantillas', 'encuesta.md'), 'utf8');
  assert.ok(ficha.includes('ANI') && ficha.includes('nunca la lee ni la guarda'));
});

test('vista previa: dice las columnas usadas y cuantas filas traen ID de llamada', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'cargas.js'), 'utf8');
  assert.ok(s.includes("'; columnas usadas: '+r.columnasUsadas.join(', ')"));
  assert.ok(s.includes("'; con ID de llamada '+r.filas.filter(function(f){ return !!f[8]; }).length+' de '+r.filas.length"));
});

test('API: la base completa se guarda; resumen y comentarios salen de ella, con el ID de la llamada y sin telefono', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const r = L.encuestaParseFilas(OCT);
  const cuerpo = { campana: 'MOBILIZE', archivoNombre: 'RESULTADO DE ENCUESTA SINTETICO.xlsx', filas: r.filas };
  assert.ok(![ANI, DNI, CLIENTE].some((c) => JSON.stringify(cuerpo).includes(c)), 'el cuerpo no lleva datos personales');
  const imp = await request(app).post('/api/calidad/encuestas/carga/impacto').set(auth(admin)).send(cuerpo);
  assert.equal(imp.status, 200);
  const c = await request(app).post('/api/calidad/encuestas/carga').set(auth(admin)).send(cuerpo);
  assert.equal(c.status, 201);
  const q = { campana: 'MOBILIZE', desde: '2025-03-01', hasta: '2025-03-31' };
  const res = (await request(app).get('/api/calidad/encuestas/resumen').query(q).set(auth(admin))).body;
  assert.equal(res.total, 4);
  const q3 = res.preguntas.find((p) => p.key === 'q3');
  assert.deepEqual(q3.valores, [{ valor: 1, cantidad: 2 }, { valor: 2, cantidad: 1 }]);
  assert.deepEqual([q3.respondieron, q3.sinRespuesta], [3, 1]);
  const com = (await request(app).get('/api/calidad/encuestas/comentarios').query(q).set(auth(admin))).body;
  const lista = Array.isArray(com) ? com : com.comentarios;
  assert.deepEqual(lista.map((x) => [x.comentario, x.connId]).sort(), [['Muy buena atencion', 'CONN-0001'], ['Tardaron en contestar', 'CONN-0003']]);
  // Subir el mismo mes otra vez reemplaza (no duplica).
  await request(app).post('/api/calidad/encuestas/carga').set(auth(admin)).send(cuerpo);
  assert.equal((await request(app).get('/api/calidad/encuestas/resumen').query(q).set(auth(admin))).body.total, 4);
  const guardado = JSON.stringify(db.prepare("SELECT * FROM encuestas WHERE campana = 'MOBILIZE'").all());
  const respuestas = JSON.stringify([res, com]);
  for (const x of [ANI, DNI, CLIENTE]) {
    assert.ok(!guardado.includes(x), 'la base guarda ' + x);
    assert.ok(!respuestas.includes(x), 'una respuesta trae ' + x);
  }
  assert.ok(!db.prepare('PRAGMA table_info(encuestas)').all().some((col) => /tel|ani|dni|customer/i.test(col.name)));
});
