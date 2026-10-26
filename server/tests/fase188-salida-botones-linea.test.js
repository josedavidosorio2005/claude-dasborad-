// fase188-salida-botones-linea.test.js — Fase 188 (pedido de Edwin, 26/10,
// ORLANT, pestaña "Llamadas y WhatsApp de salida"): botones "Total", "Línea
// General" y "Línea 3P" que cambian tarjetas, barras y tabla; Total incluye
// "Sin clasificar". "Línea de cada asesor" pasa arriba. General + 3P + Sin
// clasificar = Total en cada mes y canal. Todo SINTETICO.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { salidaCombinadaPorMes } = require('../salida-cdr');
const { salidaPorLinea } = require('../clasificacion-asesores');
const L = require('../../public/js/salida-logic.js');
const { request, app, tokenFor, MASTER_PASSWORD, db } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const JS = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');
const tip = (agente, fecha, skill, tipo) => [agente, fecha, '09:00:00', null, 'AGENDADA', skill, null, null, tipo, null, null];
const veces = (n, f) => Array.from({ length: n }, f);

test('botones de linea: cada boton da su cantidad y Total = General + 3P + Sin clasificar', () => {
  const f = { mes: '2025-09', llamadas3p: 40, llamadasGeneral: 55, llamadasSinAsignar: 5, wpp3p: 12, wppGeneral: 7, wppSinAsignar: 1 };
  assert.deepEqual(['TOTAL', 'GENERAL', '3P'].map((l) => L.salidaValorLinea(f, 'llamadas', l)), [100, 55, 40]);
  assert.deepEqual(['TOTAL', 'GENERAL', '3P'].map((l) => L.salidaValorLinea(f, 'wpp', l)), [20, 7, 12]);
  assert.deepEqual(L.SALIDA_LINEAS_BOTONES.map((b) => b.etiqueta), ['Total', 'Línea General', 'Línea 3P']);
  // Un mes del archivo mensual (sin "Sin clasificar"): Total = 3P + General.
  assert.equal(L.salidaValorLinea({ llamadas3p: 10, llamadasGeneral: 20 }, 'llamadas', 'TOTAL'), 30);
});

test('General + 3P + Sin clasificar = Total en cada mes y canal (contra el conteo independiente del CDR)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const post = async (canal, filas) => assert.equal((await request(app).post('/api/calidad/tipificacion/carga').set(auth(admin)).send({ campana: 'ORLANT', canal, archivoNombre: 's.xlsx', filas })).status, 201);
  // Agosto: Gen 6, P3 4, Sin 2 en llamadas; WhatsApp Gen 3, P3 5, Sin 1. Septiembre: otras cifras.
  await post('LLAMADAS', [...veces(6, () => tip('Gen1', '2025-08-04', '-', 'outbound_ma')), ...veces(4, () => tip('Tres1', '2025-08-05', '-', 'otro')),
    ...veces(2, () => tip('Nadie', '2025-08-06', '-', 'outbound_ma')), ...veces(3, () => tip('Gen1', '2025-08-07', 'CALL INBOUND ORLANT GENERAL', 'inbound'))]);
  await post('LLAMADAS', [...veces(9, () => tip('Gen1', '2025-09-04', '-', 'outbound_ma')), ...veces(1, () => tip('Tres1', '2025-09-05', '-', 'outbound_ma'))]);
  await post('WHATSAPP', [...veces(3, () => tip('Gen1', '2025-08-04', 'WHATSAPP DE SALIDA', 'outbound_ma')), ...veces(5, () => tip('Tres1', '2025-08-05', 'WHATSAPP DE SALIDA', 'outbound_ma')),
    tip('Nadie', '2025-08-06', 'WHATSAPP DE SALIDA', 'outbound_ma'), ...veces(4, () => tip('Tres1', '2025-08-07', 'WHATSAPP 3P', 'inbound'))]);
  await post('WHATSAPP', [...veces(2, () => tip('Nadie', '2025-09-04', 'WHATSAPP DE SALIDA', 'outbound_ma')), ...veces(7, () => tip('Tres1', '2025-09-05', 'WHATSAPP DE SALIDA', 'outbound_ma'))]);
  assert.equal((await request(app).put('/api/calidad/tipificacion/clasificacion-asesores').set(auth(admin))
    .send({ campana: 'ORLANT', asignaciones: [{ agente: 'Gen1', linea: 'GENERAL' }, { agente: 'Tres1', linea: '3P' }] })).status, 200);

  const porMes = Object.fromEntries(salidaCombinadaPorMes(db, 'ORLANT').map((f) => [f.mes, f]));
  const esperado = {
    '2025-08': { llamadas: { GENERAL: 6, '3P': 4, TOTAL: 12 }, wpp: { GENERAL: 3, '3P': 5, TOTAL: 9 } },
    '2025-09': { llamadas: { GENERAL: 9, '3P': 1, TOTAL: 10 }, wpp: { GENERAL: 0, '3P': 7, TOTAL: 9 } },
  };
  for (const [mes, porCanal] of Object.entries(esperado)) {
    for (const [canal, cifras] of Object.entries(porCanal)) {
      const f = porMes[mes];
      for (const linea of ['GENERAL', '3P', 'TOTAL']) assert.equal(L.salidaValorLinea(f, canal, linea), cifras[linea], mes + ' ' + canal + ' ' + linea);
      // El Total de la pestaña es la salida contada fila por fila en el CDR (no la suma de las partes).
      const cdr = salidaPorLinea(db, { campana: 'ORLANT', canal: canal === 'llamadas' ? 'LLAMADAS' : 'WHATSAPP', mes });
      const pre = canal === 'llamadas' ? 'llamadas' : 'wpp';
      assert.equal(f[pre + 'General'] + f[pre + '3p'] + f[pre + 'SinAsignar'], cdr.salida, 'General + 3P + Sin clasificar = Total, ' + mes + ' ' + canal);
      assert.equal(L.salidaValorLinea(f, canal, 'TOTAL'), cdr.salida);
    }
  }
});

test('vista: "Línea de cada asesor" arriba, botones con el activo marcado; cambiar de linea no vuelve a pedir datos', () => {
  const s = JS('salida.js');
  const iAse = s.indexOf("html += '<div id=\"sal-asesores-'+i+'\"></div>';");
  const iLin = s.indexOf("html += '<div id=\"sal-lineas-'+i+'\"></div>';");
  const iTar = s.indexOf("html += '<div id=\"sal-tarjetas-wrap-'+i+'\"></div>';");
  assert.ok(iAse > 0 && iAse < iLin && iLin < iTar, 'orden: Línea de cada asesor, botones, tarjetas');
  assert.ok(s.includes("'<button type=\"button\" class=\"cc-selector-op'+(on?' on':'')+'\" aria-pressed=\"'+on+'\""));
  const pintar = s.slice(s.indexOf('function _salPintar(i){'), s.indexOf('// ── Fase 170: linea'));
  assert.doesNotMatch(pintar, /apiRequest/);
  assert.ok(pintar.includes("var totalLlam = salidaValorLinea(delMes, 'llamadas', linea);"));
  assert.ok(pintar.includes("linea === 'TOTAL' ? _salTablaHtml(filasMeses, mesSel) : _salTablaLineaHtml(filasMeses, mesSel, linea)"));
  assert.ok(s.includes("data: filas.map(function(f){ return salidaValorLinea(f, canal, linea || 'TOTAL'); })"));
  assert.ok(s.includes('Clasifícalos arriba, en "Clasificación de asesores".'));
});
