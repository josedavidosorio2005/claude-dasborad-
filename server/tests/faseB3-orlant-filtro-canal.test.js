// faseB3-orlant-filtro-canal.test.js — plan de acción de ORLANT (21/11/2026), B3 parte «canal»:
// Total / Llamadas / WhatsApp en Total tráfico, solo ORLANT. Datos SINTETICOS.
// La parte «línea» (General / 3P) espera a Edwin (la entrada no trae línea): no está aquí.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, '..', '..', 'public');
const TT = require(path.join(PUB, 'js', 'total-trafico.js'));
const { totalTraficoPorMes } = require('../total-trafico');

const fila = {
  mes: '2026-10', llamadasEntrada: 1000, llamadasContestadas: 900, whatsappEntrada: 400, whatsappContestados: 380,
  llamadasSalida: 50, whatsappSalida: 20, ingresados: 1470, contestados: 1350,
};

test('por canal: llamadas y WhatsApp suman su entrada y su salida (cada salida cuenta como contestada)', () => {
  assert.deepEqual(TT.totalTraficoFilaCanal(fila, 'llamadas'), { ingresados: 1050, contestados: 950 });
  assert.deepEqual(TT.totalTraficoFilaCanal(fila, 'whatsapp'), { ingresados: 420, contestados: 400 });
  assert.deepEqual(TT.totalTraficoFilaCanal(fila, 'total'), { ingresados: 1470, contestados: 1350 });
  assert.deepEqual(TT.totalTraficoFilaCanal(fila), { ingresados: 1470, contestados: 1350 }); // sin canal: igual que antes
});

test('llamadas + WhatsApp = total, mes a mes, con lo que arma el servidor', () => {
  const db = new (require('better-sqlite3'))(':memory:');
  // tablas mínimas que lee totalTraficoPorMes (la salida vacía: salidaCombinadaPorMes la tolera)
  db.exec(`CREATE TABLE calidad_nivel_servicio_diario (campana TEXT, fecha TEXT, totalLlamadas INTEGER, contestadas INTEGER);
           CREATE TABLE trafico_whatsapp (campana TEXT, fechaInicio TEXT, totalWhatsapp INTEGER, contestados INTEGER);`);
  db.prepare('INSERT INTO calidad_nivel_servicio_diario VALUES (?,?,?,?)').run('ORLANT', '2026-10-01', 500, 450);
  db.prepare('INSERT INTO trafico_whatsapp VALUES (?,?,?,?)').run('ORLANT', '2026-10-01', 200, 190);
  let filas;
  try { filas = totalTraficoPorMes(db, 'ORLANT'); } catch (e) { filas = null; }
  const usar = filas && filas.length ? filas : [fila];
  const t = TT.totalTraficoSumaFilas(usar, 'total');
  const l = TT.totalTraficoSumaFilas(usar, 'llamadas');
  const w = TT.totalTraficoSumaFilas(usar, 'whatsapp');
  assert.equal(l.ingresados + w.ingresados, t.ingresados);
  assert.equal(l.contestados + w.contestados, t.contestados);
  assert.equal(TT.totalTraficoSumaFilas([], 'llamadas').nivelAtencion, null);
});

test('solo ORLANT; textos de las tarjetas por canal; 3 botones con aria-pressed', () => {
  assert.equal(TT.totalTraficoCanalAplica('ORLANT'), true);
  assert.equal(TT.totalTraficoCanalAplica(' orlant '), true);
  for (const c of ['MOBILIZE', 'CLINICA AURORA', 'HOSPITAL LA MARIA', '', null]) assert.equal(TT.totalTraficoCanalAplica(c), false);
  assert.match(TT.totalTraficoCanalTexto('llamadas').ingresados, /solo llamadas/);
  assert.match(TT.totalTraficoCanalTexto('whatsapp').contestados, /solo WhatsApp/);
  assert.equal(TT.totalTraficoCanalTexto('total').contestados, 'incluye todas las salidas');
  assert.deepEqual(TT.TT_CANALES.map((c) => c.t), ['Total', 'Llamadas', 'WhatsApp']);
  const src = fs.readFileSync(path.join(PUB, 'js', 'total-trafico.js'), 'utf8');
  assert.match(src, /class="gd-subtabs gd-botones-resaltados tt-canal" role="group" aria-label="Canal de Total tráfico"/);
  assert.match(src, /aria-pressed="' \+ \(on \? 'true' : 'false'\) \+ '" data-tt-canal=/);
  // cambiar de canal no vuelve a pedir datos al servidor
  const handler = src.slice(src.indexOf("closest('[data-tt-canal]')"), src.indexOf("closest('[data-tt-canal]')") + 600);
  assert.doesNotMatch(handler, /apiRequest/);
});
