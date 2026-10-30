// fase219-total-trafico.test.js — Fase 219 (pedido de Edwin, 30/10): pestaña
// "Total tráfico" de ORLANT. Entrada (Trafico de Llamadas y de WhatsApp) +
// salida (llamadas y WhatsApp de salida); cada salida cuenta como contestada
// (decision de Edwin, opcion A). Datos SIEMPRE inventados.
'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { app, db, request, tokenFor, MASTER_PASSWORD, cleanup } = require('./helpers');
const { totalTraficoPorMes, totalTraficoSuma } = require('../total-trafico');

after(cleanup);
const ahora = new Date().toISOString();
const insLlam = db.prepare('INSERT INTO calidad_nivel_servicio_diario (campana, fecha, skillName, totalLlamadas, contestadas, createdAt) VALUES (?,?,?,?,?,?)');
const insWpp = db.prepare('INSERT INTO trafico_whatsapp (campana, colaWhatsapp, fechaInicio, fechaFin, totalWhatsapp, contestados, createdAt) VALUES (?,?,?,?,?,?,?)');
const insSal = db.prepare('INSERT INTO salida_mensual (campana, mes, llamadas3p, llamadasGeneral, wpp3p, wppGeneral, createdAt) VALUES (?,?,?,?,?,?,?)');
// Agosto: llamadas 100 / 90 (2 dias), WhatsApp 40 / 30, salida 10 + 5 llamadas y 3 + 2 WhatsApp.
insLlam.run('ORLANT', '2026-08-01', 'SKILL A', 60, 55, ahora);
insLlam.run('ORLANT', '2026-08-02', 'SKILL A', 40, 35, ahora);
insWpp.run('ORLANT', 'COLA', '2026-08-01', '2026-08-31', 40, 30, ahora);
insSal.run('ORLANT', '2026-08', 10, 5, 3, 2, ahora);
// Septiembre: solo entrada de llamadas (sin WhatsApp ni salida).
insLlam.run('ORLANT', '2026-09-01', 'SKILL A', 50, 25, ahora);
// Otro cliente: no se mezcla.
insLlam.run('MOBILIZE', '2026-08-01', 'SKILL M', 999, 999, ahora);

test('por mes: ingresados = entrada + salida; contestados = contestados de entrada + TODAS las salidas', () => {
  const r = totalTraficoPorMes(db, 'ORLANT');
  assert.deepEqual(r.map((f) => f.mes), ['2026-08', '2026-09']);
  const ago = r[0];
  assert.deepEqual(
    [ago.llamadasEntrada, ago.llamadasContestadas, ago.whatsappEntrada, ago.whatsappContestados, ago.llamadasSalida, ago.whatsappSalida],
    [100, 90, 40, 30, 15, 5]
  );
  assert.equal(ago.ingresados, 160);
  assert.equal(ago.contestados, 140);
  assert.equal(ago.nivelAtencion, 140 / 160);
  assert.deepEqual([r[1].ingresados, r[1].contestados, r[1].nivelAtencion], [50, 25, 0.5]);
});

test('varios meses: totales sumados, nunca el promedio de los %', () => {
  const s = totalTraficoSuma(totalTraficoPorMes(db, 'ORLANT'));
  assert.deepEqual(s, { ingresados: 210, contestados: 165, nivelAtencion: 165 / 210 });
  assert.equal(totalTraficoSuma([]).nivelAtencion, null);
});

test('ruta: el administrador la lee; sin campana valida, 400', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const r = await request(app).get('/api/calidad/total-trafico/mensual?campana=ORLANT').set('Authorization', 'Bearer ' + t);
  assert.equal(r.status, 200);
  assert.equal(r.body.length, 2);
  assert.equal((await request(app).get('/api/calidad/total-trafico/mensual').set('Authorization', 'Bearer ' + t)).status, 400);
  assert.equal((await request(app).get('/api/calidad/total-trafico/mensual?campana=ORLANT')).status, 401);
});

test('migracion fase219_total_trafico_v1: la pestaña va justo despues de "salida" y es idempotente', () => {
  const fila = () => JSON.parse(db.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'ORLANT'").get().layout);
  const leer = () => fila().tabs.map((t) => t.key);
  const original = fila();
  // Como en produccion: un layout sin la pestaña (la base nueva ya la trae al final).
  const sinTab = JSON.parse(JSON.stringify(original));
  sinTab.tabs = sinTab.tabs.filter((t) => t.key !== 'total_trafico');
  db.prepare("UPDATE dashboards_config SET layout = ? WHERE cliente = 'ORLANT'").run(JSON.stringify(sinTab));
  db.agregarTotalTraficoOrlant();
  const una = leer();
  db.agregarTotalTraficoOrlant();
  const keys = leer();
  assert.deepEqual(keys, una, 'no la duplica');
  assert.equal(keys.filter((k) => k === 'total_trafico').length, 1);
  assert.equal(keys.indexOf('total_trafico'), keys.indexOf('salida') + 1);
  const tab = JSON.parse(db.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'ORLANT'").get().layout).tabs.find((t) => t.key === 'total_trafico');
  assert.equal(tab.label, 'Total tráfico');
  assert.deepEqual(tab.panels, [{ tipo: 'total_trafico_panel', campana: 'ORLANT', titulo: 'Total tráfico' }]);
  db.prepare("UPDATE dashboards_config SET layout = ? WHERE cliente = 'ORLANT'").run(JSON.stringify(original));
  const mob = db.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'MOBILIZE'").get();
  if (mob) assert.ok(!JSON.parse(mob.layout).tabs.some((t) => t.key === 'total_trafico'), 'Mobilize no cambia');
});

test('vista: tarjetas con descripcion corta ("Incluye todas las salidas") y 2 barras por mes; tipo registrado', () => {
  const RAIZ = path.join(__dirname, '..', '..', 'public');
  const js = fs.readFileSync(path.join(RAIZ, 'js', 'total-trafico.js'), 'utf8');
  assert.match(js, /'Total ingresados · llamadas y WhatsApp, de entrada y de salida · '/);
  assert.match(js, /'Total contestados · incluye todas las salidas · '/);
  assert.match(js, /'Nivel de atención total · contestados ÷ ingresados · '/);
  assert.match(js, /label: 'Total llamadas \+ WhatsApp'/);
  assert.match(js, /label: 'Total contestados'/);
  const { totalTraficoSumaFilas } = require('../../public/js/total-trafico.js');
  assert.deepEqual(totalTraficoSumaFilas([{ ingresados: 10, contestados: 8 }, { ingresados: 30, contestados: 12 }]), { ingresados: 40, contestados: 20, nivelAtencion: 0.5 });
  const gen = fs.readFileSync(path.join(RAIZ, 'js', 'dashboard-generic.js'), 'utf8');
  assert.ok(gen.includes("if(p.tipo === 'total_trafico_panel'){ _totalTraficoRenderPanel(p, i); return; }"));
  assert.ok(gen.includes('async function _gdExportarTotalTrafico(p, i){'));
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  assert.ok(html.includes('<script src="js/total-trafico.js"></script>'));
});
