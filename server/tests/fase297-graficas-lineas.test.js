// fase297-graficas-lineas.test.js — Fase 297 (pedido del supervisor de Aurora,
// 09/11/2026; igual en Hospital La María): Total tráfico en 3 líneas de
// ingreso, la salida en línea con variación mes a mes, y el orden de pestañas.
// Solo presentación: los números salen de los mismos campos que ya existían.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const G = require('../../public/js/graficas-lineas-logic.js');
const { contrasteRazon } = require('../../public/js/contraste-logic.js');

const JS = path.join(__dirname, '..', '..', 'public', 'js');

test('solo Aurora y HLM usan las graficas de lineas; ORLANT y Mobilize siguen igual', () => {
  assert.equal(G.graficasLineasAplica('CLINICA AURORA'), true);
  assert.equal(G.graficasLineasAplica('hospital la maria'), true);
  for (const c of ['ORLANT', 'MOBILIZE', 'SURA', '', undefined]) assert.equal(G.graficasLineasAplica(c), false, String(c));
});

test('Total = llamadas ingresadas + WhatsApp ingresados (sin contestados ni salida)', () => {
  const filas = [
    { mes: '2026-09', llamadasEntrada: 100, whatsappEntrada: 40, llamadasSalida: 999, whatsappSalida: 999, contestados: 5, ingresados: 2138 },
    { mes: '2026-10', llamadasEntrada: 120, whatsappEntrada: 0 },
    { mes: '2026-11' },
  ];
  assert.deepEqual(G.totalTraficoSeriesIngreso(filas), { total: [140, 120, 0], llamadas: [100, 120, 0], whatsapp: [40, 0, 0] });
});

test('variacion mes a mes: contra el mes inmediatamente anterior', () => {
  const v = G.variacionMesAMes([100, 108, 105, 0, 50], ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
  assert.equal(v[0], null);
  assert.ok(Math.abs(v[1] - 8) < 1e-9);
  assert.ok(Math.abs(v[2] - (-300 / 108)) < 1e-9);
  assert.equal(v[3], -100);
  assert.equal(v[4], null, 'mes anterior en 0: sin variacion (no hay base)');
  assert.deepEqual(G.variacionMesAMes([10, 20], ['2026-07', '2026-09']), [null, null], 'falta un mes en medio: no se compara');
  assert.deepEqual(G.variacionMesAMes([10, 20], ['2025-12', '2026-01']), [null, 100], 'cruza el año');
});

test('texto y sentido de la variacion: "+8 %", "−3 %", "0 %"', () => {
  assert.equal(G.variacionTexto(8.2), '+8 %');
  assert.equal(G.variacionTexto(-2.8), '−3 %');
  assert.equal(G.variacionTexto(0.4), '0 %');
  assert.equal(G.variacionTexto(1234), '+1.234 %');
  assert.equal(G.variacionTexto(null), '');
  assert.equal(G.variacionSentido(8), 'sube');
  assert.equal(G.variacionSentido(-3), 'baja');
  assert.equal(G.variacionSentido(0.2), 'igual');
  assert.equal(G.variacionSentido(null), null);
});

test('colores: >= 3:1 contra la tarjeta en los 2 temas (WCAG 1.4.11) y bien distintos entre si', () => {
  const fondos = { claro: '#ffffff', oscuro: '#132c35' };
  for (const [tema, fondo] of Object.entries(fondos)) {
    const c = G.graficasLineasColores(tema === 'oscuro');
    for (const k of ['total', 'llamadas', 'whatsapp', 'sube', 'baja']) {
      const r = contrasteRazon(c[k], fondo);
      assert.ok(r >= 3, `${tema} ${k} ${c[k]}: ${r.toFixed(2)}:1`);
    }
    assert.notEqual(c.total, c.llamadas);
    assert.notEqual(c.llamadas, c.whatsapp);
  }
});

test('salida en linea: mismos numeros que las barras (salidaValorLinea) y nota de variacion', () => {
  const src = fs.readFileSync(path.join(JS, 'salida.js'), 'utf8');
  assert.match(src, /function _salDibujarLinea\(/);
  assert.match(src, /var valores = filas\.map\(function\(f\)\{ return salidaValorLinea\(f, canal, linea \|\| 'TOTAL'\); \}\);/);
  assert.match(src, /variación frente al mes anterior/);
  assert.match(src, /'Variación vs\. ' \+ mesNombreLargo/);
});

test('Total tráfico: titulo pedido y 3 lineas, nunca "contestados" en la grafica de lineas', () => {
  const src = fs.readFileSync(path.join(JS, 'total-trafico.js'), 'utf8');
  assert.ok(src.includes('Flujo de llamadas &amp; WhatsApp – líneas de ingreso por mes'));
  const cuerpo = src.slice(src.indexOf('function _ttDibujarLineas'), src.indexOf('if (typeof module'));
  assert.equal((cuerpo.match(/linea\('/g) || []).length, 3);
  assert.doesNotMatch(cuerpo, /contestad/i);
});

test('orden de pestañas de Aurora y HLM: el pedido, y las demas al final sin perder ninguna', () => {
  const tabs = ['trafico', 'trafico_whatsapp', 'salida', 'total_trafico', 'agendas_usuaria', 'errores', 'tipificacion', 'calidad'].map((key) => ({ key }));
  for (const c of ['CLINICA AURORA', 'HOSPITAL LA MARIA']) {
    assert.deepEqual(G.pestanasOrdenCliente(tabs, c).map((t) => t.key),
      ['total_trafico', 'trafico', 'trafico_whatsapp', 'salida', 'agendas_usuaria', 'errores', 'tipificacion', 'calidad'], c);
  }
  // HLM hoy solo tiene 3 visibles: mismo orden relativo.
  assert.deepEqual(G.pestanasOrdenCliente([{ key: 'trafico' }, { key: 'trafico_whatsapp' }, { key: 'total_trafico' }], 'HOSPITAL LA MARIA').map((t) => t.key),
    ['total_trafico', 'trafico', 'trafico_whatsapp']);
  assert.deepEqual(G.pestanasOrdenCliente(tabs, 'ORLANT').map((t) => t.key), tabs.map((t) => t.key), 'ORLANT no cambia');
  assert.notEqual(G.pestanasOrdenCliente(tabs, 'CLINICA AURORA'), tabs, 'no muta la lista original');
});

test('el orden se aplica al mostrar (dashboard-generic.js), no en la base', () => {
  const src = fs.readFileSync(path.join(JS, 'dashboard-generic.js'), 'utf8');
  const f = src.slice(src.indexOf('function _gdTabsVisibles(){'), src.indexOf('function renderGenericTabs(){'));
  assert.ok(f.includes('pestanasOrdenCliente(tabs, _gd.cliente)'));
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  assert.ok(html.includes('src="js/graficas-lineas-logic.js"'));
});
