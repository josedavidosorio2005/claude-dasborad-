// fase156-b2-tiempos-flujo.test.js — Fase 156 (B2): WAIT_TIME y AHT del
// Flujo de Llamadas se leen igual que ASA/ATA: hora de Excel (fraccion de
// dia, < 1), segundos (>= 1) o texto "H:MM:SS"/"MM:SS". Antes, un archivo
// con segundos se multiplicaba por 86400 y la carga entera se rechazaba con
// un mensaje tecnico en ingles.
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { traficoSegundosDesdeFraccionDia, traficoParseFilas } = require('../../public/js/trafico-logic.js');
const { app, request, tokenFor, MASTER_PASSWORD, cleanup } = require('./helpers');

after(cleanup);

test('hora de Excel (fraccion de dia) se sigue leyendo igual', () => {
  assert.equal(traficoSegundosDesdeFraccionDia(0.002488425925925926), 215); // 0:03:35
  assert.equal(traficoSegundosDesdeFraccionDia(0.0002546296296296296), 22);
  assert.equal(traficoSegundosDesdeFraccionDia(0), 0);
  assert.equal(traficoSegundosDesdeFraccionDia(null), null);
  assert.equal(traficoSegundosDesdeFraccionDia(''), null);
});

test('segundos (>= 1) se toman como segundos, no como dias', () => {
  assert.equal(traficoSegundosDesdeFraccionDia(240), 240);
  assert.equal(traficoSegundosDesdeFraccionDia(15), 15);
  assert.equal(traficoSegundosDesdeFraccionDia(1), 1);
  assert.equal(traficoSegundosDesdeFraccionDia('240'), 240);
});

test('texto de reloj "H:MM:SS" / "MM:SS" se convierte a segundos', () => {
  assert.equal(traficoSegundosDesdeFraccionDia('0:03:35'), 215);
  assert.equal(traficoSegundosDesdeFraccionDia('03:35'), 215);
  assert.equal(traficoSegundosDesdeFraccionDia('1:00:00'), 3600);
  assert.equal(traficoSegundosDesdeFraccionDia('texto raro'), null);
});

test('un archivo con WAIT_TIME/AHT en segundos queda con los segundos reales', () => {
  const enc = ['SKILL_NAME', 'DATE', 'TOTAL LLAMADAS', 'LLAMADAS CONTESTADAS', 'WAIT_TIME', 'AHT'];
  const r = traficoParseFilas([enc, ['SKILL B2', '2026-08-01', 100, 90, 15, 240]]);
  assert.equal(r.error, undefined);
  assert.equal(r.filas[0].waitTimeSegundos, 15);
  assert.equal(r.filas[0].ahtSegundos, 240);
});

test('un tiempo fuera de rango se rechaza con un mensaje en espanol', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/calidad/trafico/carga/impacto').set('Authorization', 'Bearer ' + t)
    .send({ archivoNombre: 'b2.xlsx', filas: [{ fecha: '2026-08-01', skillName: 'SKILL B2', totalLlamadas: 10, contestadas: 9, ahtSegundos: 2000000 }] });
  assert.equal(res.status, 400);
  assert.doesNotMatch(res.body.error, /expected|Too big/i);
  assert.match(res.body.error, /tiempo/i);
});
