// fase213-agendas-efectividad-inasistencia.test.js — Fase 213 (pedidos de Edwin, 29/10, ORLANT).
// 2) Agendamiento: tarjeta "Total de agendas" arriba que sigue a MESES y a los
//    filtros en las 3 vistas (en las series de todos los meses, el total se
//    pide aparte con el mes).
// 3) Efectividad de Citas: barras de contestadas y de agendas por mes y una
//    linea del % (eje derecho); la formula no cambia.
// 4) Inasistencia por especialidad: sin el letrero ni el * de "Base baja".
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const JS = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');

test('Agendamiento: tarjeta "Total de agendas" arriba, con MESES y filtros', () => {
  const js = JS('agendas.js');
  const render = js.slice(js.indexOf('async function _agendasRenderPanel'), js.indexOf('function _agendasLeerFiltros'));
  assert.ok(render.indexOf('agendas-total-') > -1 && render.indexOf('agendas-total-') < render.indexOf('class="form-row"'), 'la tarjeta va arriba de los filtros');
  assert.match(js, /if\(def\.incluirMes\) total = datos\.reduce\(/);
  assert.match(js, /_AGENDAS_VISTAS\.especialidad\.endpoint\+'\?'\+_agendasQueryString\(campana, filtros, true\)/);
  assert.match(js, /'<div class="kl">Total de agendas · '\+esc\(_agendasPeriodoTexto\(filtros\)\)/);
  // La respuesta vieja tampoco pisa la tarjeta (el chequeo va despues del total).
  const dib = js.slice(js.indexOf('async function _agendasDibujar'));
  assert.ok(dib.indexOf('if(_agendasDibujoN[i] !== n) return;') > dib.indexOf('total = porEsp.reduce'));
});

test('Efectividad de Citas: barras de contestadas y agendas + linea del % en eje derecho', () => {
  const ec = JS('efectividad-citas.js');
  const f = ec.slice(ec.indexOf('function _ecDibujarGraficaContactos'), ec.indexOf('function _ecTablaContactosHtml'));
  assert.match(f, /label: 'Contestadas \(llamadas \+ WhatsApp\)', data: filas\.map\(function\(f\)\{ return f\.contactos; \}\)/);
  assert.match(f, /label: 'Agendas', data: filas\.map\(function\(f\)\{ return f\.agendas; \}\)/);
  assert.match(f, /label: '% Efectividad'/);
  assert.match(f, /gdComboDatasets\(barras, linea\)/);
  assert.match(f, /y2: \{ position:'right'/);
  assert.match(ec, /if\(desdeContactos\) _ecDibujarGraficaContactos\(i, filasMeses\);/);
  assert.ok(!/_ecDibujarGraficaPct/.test(ec));
});

test('Inasistencia por especialidad: sin "Base baja" ni asterisco', () => {
  const ina = JS('inasistencia.js');
  assert.match(ina, /var ordenadas = inasistenciaPorPct\(conPct\);/);
  assert.ok(!/INASISTENCIA_BASE_BAJA_UMBRAL/.test(ina));
  assert.ok(!/Base baja: menos de/.test(ina));
  assert.ok(!/inasist-esp-nota-/.test(ina));
  assert.ok(!/f\.baseBaja \? ' \*'/.test(ina));
  // Una especialidad con pocas citas ya no se manda al final: de mayor a menor %.
  const ini = ina.indexOf('function inasistenciaPorPct');
  const inasistenciaPorPct = new Function(ina.slice(ini, ina.indexOf('\n}', ini) + 2) + '; return inasistenciaPorPct;')();
  const r = inasistenciaPorPct([{ especialidad: 'A', pct: 10, total: 500 }, { especialidad: 'B', pct: 50, total: 2 }]);
  assert.deepEqual(r.map((x) => x.especialidad), ['B', 'A']);
  const gen = JS('dashboard-generic.js');
  assert.match(gen, /var ordenadas = inasistenciaPorPct\(conPct\);/);
  assert.ok(!/f\.baseBaja\?' \*'/.test(gen));
});
