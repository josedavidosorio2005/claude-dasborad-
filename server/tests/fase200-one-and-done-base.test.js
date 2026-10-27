// Fase 200 (Mobilize): One & Done / FCR = encuestas con "Sí" en la pregunta 3
// ÷ encuestas que contestaron la pregunta 1 (las que empezaron la encuesta),
// no el total. Octubre real: 19 / 28 = 67,9 % (antes 19 / 82 = 23,2 %).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const L = require('../../public/js/encuesta-logic.js');
const { CONFIGS } = require('../dashboard-config-seed');
const PC = require('../plantillas-cliente');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const panelFlujo = (layout) => layout.tabs.find((t) => t.key === 'flujo').panels.find((p) => p.tipo === 'trafico_combo');

test('lógica: base "empezaron" divide por las que contestaron la pregunta 1; fracción y nota lo dicen', () => {
  assert.deepEqual(L.encuestaFcr(19, 82, 22, 'empezaron', 28), { num: 19, den: 28, pct: 67.9 });
  assert.deepEqual(L.encuestaFcr(19, 82, 22, 'total', 28), { num: 19, den: 82, pct: 23.2 }, 'las otras bases no cambian');
  assert.deepEqual(L.encuestaFcr(19, 82, 22, 'respondieron', 28), { num: 19, den: 22, pct: 86.4 });
  assert.equal(L.encuestaFcr(0, 5, 0, 'empezaron', 0).pct, null, 'nadie empezó: sin %');
  assert.equal(L.encuestaFcrFraccion(19, 28, 'empezaron'), '19 de 28 que contestaron la pregunta 1');
  assert.equal(L.encuestaFcrBase('empezaron'), 'empezaron');
  assert.equal(L.encuestaFcrBase('otra'), 'total');
  assert.match(L.encuestaFcrNota('empezaron'), /÷ las encuestas que contestaron la pregunta 1 \(las que empezaron la encuesta\)/);
  const serie = L.encuestaOneAndDoneSerie([{ periodo: '2026-10', si: 19, total: 82, respondieron: 22, empezaron: 28 }], ['2026-10'], 'empezaron');
  assert.deepEqual([serie[0].pct, serie[0].den, serie[0].empezaron], [67.9, 28, 28]);
});

test('API: /calidad/encuestas/fcr con base "empezaron" (ago 5/6, sep 3/5, oct 19/28 como los archivos reales)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  // [fecha, agente, skill, q1, q2, q3, q4, comentario, connId]
  const fila = (mes, q1, q3) => ['2025-' + mes + '-10', 'Asesor', 'SKILL SAC', q1, null, q3, null, '', ''];
  const mes = (m, total, siConQ1, noConQ1, soloQ1) => [
    ...Array.from({ length: siConQ1 }, () => fila(m, 9, 1)),
    ...Array.from({ length: noConQ1 }, () => fila(m, 5, 2)),
    ...Array.from({ length: soloQ1 }, () => fila(m, 8, null)),
    ...Array.from({ length: total - siConQ1 - noConQ1 - soloQ1 }, () => fila(m, null, null)),
  ];
  // Mismos conteos que ago/sep/oct reales: total, Si, No (con q1), solo q1.
  const filas = [...mes('05', 21, 5, 1, 0), ...mes('06', 45, 3, 1, 1), ...mes('07', 82, 19, 3, 6)];
  const r = await request(app).post('/api/calidad/encuestas/carga').set(auth(admin)).send({ campana: 'MOBILIZE', archivoNombre: 'enc.xlsx', filas });
  assert.equal(r.status, 201);
  const pedir = async (base) => (await request(app).get('/api/calidad/encuestas/fcr').query({ campana: 'MOBILIZE', desde: '2025-05-01', hasta: '2025-07-31', base }).set(auth(admin))).body;
  const nueva = await pedir('empezaron');
  assert.deepEqual(nueva.map((m) => [m.periodo, m.si, m.den, m.pct]), [['2025-05', 5, 6, 83.3], ['2025-06', 3, 5, 60], ['2025-07', 19, 28, 67.9]]);
  const antes = await pedir('total');
  assert.deepEqual(antes.map((m) => [m.si, m.den, m.pct]), [[5, 21, 23.8], [3, 45, 6.7], [19, 82, 23.2]]);
  const mala = await request(app).get('/api/calidad/encuestas/fcr').query({ campana: 'MOBILIZE', base: 'otra' }).set(auth(admin));
  assert.equal(mala.status, 400);
});

test('config: seed y plantilla de Mobilize con fcrBase "empezaron"; ORLANT sin fcrBase', () => {
  assert.equal(panelFlujo(CONFIGS.find((c) => c.cliente === 'MOBILIZE').layout).fcrBase, 'empezaron');
  assert.equal(PC.PERFILES_ACTUALES.MOBILIZE.ajustes.flujo_llamadas.panel.fcrBase, 'empezaron');
  assert.ok(!JSON.stringify(CONFIGS.find((c) => c.cliente === 'ORLANT').layout).includes('fcrBase'));
});

test('migración: "total" pasa a "empezaron"; idempotente; otra base o forma desconocida intacta', () => {
  const leer = () => JSON.parse(db.prepare("SELECT layout FROM dashboards_config WHERE cliente='MOBILIZE'").get().layout);
  const guardar = (l) => db.prepare("UPDATE dashboards_config SET layout=? WHERE cliente='MOBILIZE'").run(JSON.stringify(l));
  const original = leer();
  assert.equal(panelFlujo(original).fcrBase, 'empezaron', 'base nueva = seed');
  const prod = JSON.parse(JSON.stringify(original)); panelFlujo(prod).fcrBase = 'total';
  guardar(prod);
  db.migrarMobilizeFcrEmpezaron();
  assert.deepEqual(leer(), original, 'solo cambia fcrBase');
  db.migrarMobilizeFcrEmpezaron();
  assert.deepEqual(leer(), original, 'idempotente');
  const elegida = JSON.parse(JSON.stringify(original)); panelFlujo(elegida).fcrBase = 'respondieron';
  guardar(elegida);
  db.migrarMobilizeFcrEmpezaron();
  assert.deepEqual(leer(), elegida, 'no pisa otra base elegida');
  guardar(original);
});
