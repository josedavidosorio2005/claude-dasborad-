// fase214-ranking-agendas-tema.test.js — Fase 214 (pedidos de Edwin, 29/10 tarde, solo ORLANT).
// 2) Ranking por asesor: filtro "Todos / 3P / General" de las agendas (arranca
//    en Todos); las contestadas no cambian.
// 3) Agendamiento: "Total de agendas" junto a "Aplicar filtros".
// 4) Tema oscuro: ejes y leyendas con el color del tema (no el #666 de Chart.js).
// Datos SIEMPRE inventados.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, tokenFor, MASTER_PASSWORD, db } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const JS = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');

test('ranking ORLANT: linea GENERAL / 3P filtra solo las agendas', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  await request(app).put('/api/calidad/agendas/codigos-entidad').set(auth(admin)).send({ campana: 'ORLANT', codigos: [{ codigo: 'EPSG', linea: 'GENERAL' }] });
  await request(app).put('/api/calidad/agendas/usuarios').set(auth(admin)).send({ campana: 'ORLANT', usuarios: [{ usuario: 'L1', asesor: 'Persona Linea' }] });
  // 3 agendas General (EPSG) y 2 en 3P (codigo sin linea -> 3P), en julio.
  const fila = (dia, cod) => ['L1', '01', 'EX', 'ESP', 'PROF', '2026-07-' + dia + ' 09:00:00', cod, 'ENT'];
  const c = await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({ campana: 'ORLANT', formato: 'cruda',
    filas: [fila('02', 'EPSG'), fila('03', 'EPSG'), fila('04', 'EPSG'), fila('05', 'OTRA'), fila('06', 'OTRA')] });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  const ins = db.prepare(`INSERT INTO tipificaciones (campana, canal, agente, fecha, tipificacion, skill, tipoInteraccion, createdAt)
    VALUES ('ORLANT', 'LLAMADAS', 'PERSONA LINEA', '2026-07-02', 'X', '4060 AGENDAMIENTO', 'inbound', '2026-11-29T00:00:00Z')`);
  for (let k = 0; k < 10; k++) ins.run();

  const pedir = (extra) => request(app).get('/api/calidad/efectividad-agendamiento/ranking?campana=ORLANT&meses=2026-07' + extra).set(auth(admin));
  const fila_ = (r) => r.body.filas.find((f) => f.asesor.toUpperCase() === 'PERSONA LINEA');
  const todos = await pedir('');
  assert.equal(todos.status, 200, JSON.stringify(todos.body));
  assert.equal(todos.body.linea, null);
  assert.deepEqual([fila_(todos).agendas, fila_(todos).gestiones], [5, 10]);
  const gen = await pedir('&linea=GENERAL');
  assert.equal(gen.body.linea, 'GENERAL');
  assert.deepEqual([fila_(gen).agendas, fila_(gen).gestiones, fila_(gen).efectividad], [3, 10, 0.3]);
  const tp = await pedir('&linea=3P');
  assert.deepEqual([fila_(tp).agendas, fila_(tp).gestiones], [2, 10], 'las contestadas no cambian con el filtro');
  const malo = await pedir('&linea=OTRA');
  assert.equal(malo.status, 400);
});

test('panel del ranking: filtro Todos / 3P / General junto a las metricas, en el export y en el reinicio', () => {
  const ea = JS('efectividad-agendamiento.js');
  assert.match(ea, /var EA_LINEAS = \[\['', 'Todos'\], \['3P', '3P'\], \['GENERAL', 'General'\]\];/);
  assert.ok(ea.includes("tarjetasEl.innerHTML = '<div class=\"aurora-kpis\">' + (contactos ? _eaFiltroLineaHtml(campana, i) : '') +"));
  assert.ok(ea.includes("return _eaLinea[campana] ? url + '&linea=' + encodeURIComponent(_eaLinea[campana]) : url;"));
  // Fase 219: la nota larga (que explicaba el filtro) ya no se muestra.
  assert.doesNotMatch(ea, /solo cambian las agendas; las contestadas son todas las del asesor/);
  const gen = JS('dashboard-generic.js');
  assert.ok(gen.includes("'_eaUltimoRanking', '_eaLinea',"), 'el filtro se reinicia con los demas');
  assert.ok(gen.includes("_eaRankingUrl(campana, mesesEaExp)"), 'el export usa el mismo filtro');
  assert.ok(gen.includes("var colAg = ranking.linea ? 'Agendas ' + (ranking.linea === 'GENERAL' ? 'General' : ranking.linea) : 'Agendas';"));
});

test('Agendamiento: "Total de agendas" va junto a "Aplicar filtros" (no arriba)', () => {
  const js = JS('agendas.js');
  const render = js.slice(js.indexOf('async function _agendasRenderPanel'), js.indexOf('function _agendasLeerFiltros'));
  const boton = render.indexOf('Aplicar filtros</button></div>');
  const tarjeta = render.indexOf('<div class="agendas-total-junto" id="agendas-total-');
  assert.ok(boton > -1 && tarjeta > boton, 'la tarjeta va despues del boton');
  assert.ok(render.indexOf('agendas-total-') > render.indexOf('class="form-row"'), 'ya no va arriba de los filtros');
  assert.ok(tarjeta < render.indexOf("html += '</div>';\n  html += _agendasBotonesClasifHtml"), 'dentro de la misma fila de filtros');
  assert.ok(js.includes('<div class="aurora-kpi gd-kpi agendas-total-kpi">'));
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'css', 'styles.css'), 'utf8');
  assert.ok(css.includes('.agendas-total-junto:empty{display:none;}'));
});

test('tema oscuro: color por defecto de Chart.js = CHART_TICK del tema; ejes del ranking con color', () => {
  const ch = JS('charts.js');
  const tema = ch.slice(ch.indexOf('function aplicarTemaCharts'), ch.indexOf('aplicarTemaCharts();'));
  assert.ok(tema.includes('Chart.defaults.color = CHART_TICK;'));
  // CHART_TICK oscuro (#8fb4bf) contra la tarjeta oscura: claro, no el #666 de Chart.js.
  assert.match(tema, /CHART_TICK='#8fb4bf'/);
  const ea = JS('efectividad-agendamiento.js');
  const ejes = ea.slice(ea.indexOf('o.scales = {'), ea.indexOf('o.plugins.datalabels = {'));
  assert.equal((ejes.match(/color:_eaTick\(\)/g) || []).length, 3);
});

test('tema oscuro: toda leyenda con generateLabels propio pone fontColor (Chart.js 4 pinta con el del item)', () => {
  assert.ok(JS('charts.js').includes('function leyendaColorTexto(){ return CHART_TICK; }'));
  for (const f of ['efectividad-agendamiento.js', 'efectividad-citas.js', 'dashboard-generic.js']) {
    const src = JS(f);
    const items = src.match(/\{ text: [^}]*fillStyle[^}]*\}/g) || [];
    assert.ok(items.length > 0, f);
    items.forEach((it) => assert.ok(it.includes('fontColor: leyendaColorTexto()'), f + ': ' + it.slice(0, 60)));
  }
});
