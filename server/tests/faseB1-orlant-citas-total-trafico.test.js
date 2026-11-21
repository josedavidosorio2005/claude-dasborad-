// faseB1-orlant-citas-total-trafico.test.js — Fase B1 (plan de acción de ORLANT, entrega «mejoras» 27/11):
// en «Total tráfico», «Citas asignadas» (tabla agendas, General + 3P) y «Efectividad de agendamiento» =
// citas asignadas ÷ interacciones atendidas y realizadas (entrada contestada + todas las salidas, llamadas +
// WhatsApp). Un mes sin agendas cargadas queda «—» y no entra al %. Datos SIEMPRE inventados.
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { app, db, request, tokenFor, MASTER_PASSWORD, cleanup } = require('./helpers');
const { totalTraficoPorMes, totalTraficoSuma } = require('../total-trafico');
const front = require('../../public/js/total-trafico.js');

after(cleanup);
const C = 'CLIENTE INVENTADO B1';
const ahora = new Date().toISOString();
const insLlam = db.prepare('INSERT INTO calidad_nivel_servicio_diario (campana, fecha, skillName, totalLlamadas, contestadas, createdAt) VALUES (?,?,?,?,?,?)');
const insWpp = db.prepare('INSERT INTO trafico_whatsapp (campana, colaWhatsapp, fechaInicio, fechaFin, totalWhatsapp, contestados, createdAt) VALUES (?,?,?,?,?,?,?)');
const insSal = db.prepare('INSERT INTO salida_mensual (campana, mes, llamadas3p, llamadasGeneral, wpp3p, wppGeneral, createdAt) VALUES (?,?,?,?,?,?,?)');
const insAg = db.prepare("INSERT INTO agendas (campana, asesor, sede, examen, especialidad, profesional, fechaSolicitud, tipoLinea, entidad, createdAt) VALUES (?, 'ASESORA INVENTADA', 'SEDE X', 'EXAMEN X', 'ESP X', 'PROF X', ?, ?, 'ENT X', ?)");
// Agosto: contestados = 90 llamadas + 30 WhatsApp + salida (15 llamadas + 5 WhatsApp) = 140; 7 citas (4 General, 3 3P).
insLlam.run(C, '2026-08-01', 'SKILL A', 100, 90, ahora);
insWpp.run(C, 'COLA', '2026-08-01', '2026-08-31', 40, 30, ahora);
insSal.run(C, '2026-08', 10, 5, 3, 2, ahora);
for (let k = 0; k < 4; k++) insAg.run(C, '2026-08-1' + k + ' 09:00:00', 'GENERAL', ahora);
for (let k = 0; k < 3; k++) insAg.run(C, '2026-08-2' + k + ' 10:00:00', '3P', ahora);
// Septiembre: contestados 60, sin agendas cargadas. Octubre: contestados 50, 10 citas.
insLlam.run(C, '2026-09-01', 'SKILL A', 80, 60, ahora);
insLlam.run(C, '2026-10-01', 'SKILL A', 70, 50, ahora);
for (let k = 0; k < 10; k++) insAg.run(C, '2026-10-0' + (k % 9 + 1) + ' 08:00:00', 'GENERAL', ahora);

test('por mes: citas asignadas (General + 3P) y efectividad = citas ÷ contestados (entrada + todas las salidas)', () => {
  const r = Object.fromEntries(totalTraficoPorMes(db, C).map((f) => [f.mes, f]));
  assert.equal(r['2026-08'].contestados, 140);
  assert.deepEqual([r['2026-08'].citasAsignadas, r['2026-08'].citasGeneral, r['2026-08'].citas3p], [7, 4, 3]);
  assert.equal(r['2026-08'].efectividadAgendamiento, 7 / 140);
  assert.deepEqual([r['2026-09'].citasAsignadas, r['2026-09'].efectividadAgendamiento], [null, null], 'sin agendas: null, no 0');
  assert.equal(r['2026-10'].efectividadAgendamiento, 10 / 50);
});

test('varios meses: suma de citas ÷ contestados de los meses CON agendas (nunca promedio de %); servidor = pantalla', () => {
  const filas = totalTraficoPorMes(db, C);
  const s = totalTraficoSuma(filas);
  assert.deepEqual([s.citasAsignadas, s.contestadosConCitas, s.efectividadAgendamiento], [17, 190, 17 / 190]);
  assert.deepEqual(s.mesesSinCitas, ['2026-09']);
  assert.equal(s.contestados, 250, 'el total contestados sigue con todos los meses');
  const f = front.totalTraficoSumaFilas(filas);
  for (const k of ['citasAsignadas', 'contestadosConCitas', 'efectividadAgendamiento', 'mesesSinCitas', 'ingresados', 'contestados', 'nivelAtencion']) assert.deepEqual(f[k], s[k], k);
  const solo9 = totalTraficoSuma(filas.filter((x) => x.mes === '2026-09'));
  assert.deepEqual([solo9.citasAsignadas, solo9.efectividadAgendamiento], [null, null]);
});

test('ruta: trae las citas; solo ORLANT muestra las tarjetas; textos y exportación', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const r = await request(app).get('/api/calidad/total-trafico/mensual?campana=' + encodeURIComponent(C)).set('Authorization', 'Bearer ' + t);
  assert.equal(r.status, 200);
  assert.equal(r.body.find((x) => x.mes === '2026-08').citasAsignadas, 7);
  assert.equal(front.totalTraficoMuestraCitas('ORLANT'), true);
  assert.equal(front.totalTraficoMuestraCitas('CLINICA AURORA'), false);
  assert.equal(front.totalTraficoMuestraCitas('HOSPITAL LA MARIA'), false);
  const RAIZ = path.join(__dirname, '..', '..', 'public', 'js');
  const js = fs.readFileSync(path.join(RAIZ, 'total-trafico.js'), 'utf8');
  assert.match(js, /'Citas asignadas · agendas de Línea General y 3P · '/);
  assert.match(js, /'Efectividad de agendamiento · citas asignadas ÷ interacciones atendidas y realizadas · '/);
  const gen = fs.readFileSync(path.join(RAIZ, 'dashboard-generic.js'), 'utf8');
  assert.ok(gen.includes("o['Citas asignadas'] ="));
  assert.ok(gen.includes("o['Efectividad de agendamiento (citas ÷ interacciones atendidas y realizadas)'] ="));
});
