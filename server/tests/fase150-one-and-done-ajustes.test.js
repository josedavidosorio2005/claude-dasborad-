// fase150-one-and-done-ajustes.test.js — Fase 150 (pendientes de la 149):
// One & Done con el mes en letras en el eje, un error de red que se muestra
// como error (no como "Sin encuestas"), el titulo "One & Done" al exportar,
// y el Excel de WhatsApp por rangos que no exporta sin xlsxFilasSeguras.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('../../public/js/encuesta-logic.js');
const { mesNombreLargo } = require('../../public/js/mes-nombre-logic.js');

const JS = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');
function extraer(src, nombre) {
  const ini = src.indexOf(nombre);
  assert.ok(ini >= 0, nombre);
  const fin = src.indexOf('\nfunction ', ini + 1);
  const finAsync = src.indexOf('\nasync function ', ini + 1);
  const cortes = [fin, finAsync].filter((x) => x > 0);
  return src.slice(ini, cortes.length ? Math.min(...cortes) : undefined);
}

function domOneAndDone() {
  const els = {};
  const mk = (id) => (els[id] = { id, innerHTML: '', textContent: '' });
  mk('tv-oad-kpi-0'); mk('tv-oad-q3-0');
  const wrapPadre = { innerHTML: '<canvas>' };
  els['tv-canvas-oad-0'] = { parentNode: wrapPadre };
  return { els, wrapPadre, document: { getElementById: (id) => els[id] || null } };
}

async function dibujar(apiRequest) {
  const enc = JS('encuesta.js');
  // Fase 203: con sus ayudantes de los meses de MESES.
  const fn = 'var _encuestaOadUltimo = {};\n' + extraer(enc, 'async function _encuestaDibujarOneAndDone') +
    ['function _encuestaMesesTarjeta', 'function _encuestaMesesLbl(', 'function _encuestaMesesLblTarjeta', 'function _encuestaPorMesHtml'].map((n) => extraer(enc, n)).join('\n');
  const d = domOneAndDone();
  const charts = [];
  const ctx = Object.assign({}, L, {
    document: d.document, apiRequest, mesNombreLargo, charts,
    esc: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'),
    _gdChart: (id, cfg) => charts.push(cfg),
  });
  vm.createContext(ctx);
  vm.runInContext(fn, ctx);
  await vm.runInContext('_encuestaDibujarOneAndDone(0, "MOBILIZE", "2026-08-01", "2026-09-30", "total")', ctx);
  return { d, charts, ctx };
}

test('eje X de One & Done con el mes en letras ("Septiembre 2026")', async () => {
  const { charts } = await dibujar(async () => [{ periodo: '2026-09', si: 3, total: 45, respondieron: 4, pct: 6.7, den: 45, base: 'total' }]);
  assert.equal(charts.length, 1);
  assert.deepEqual(charts[0].data.labels, ['Agosto 2026', 'Septiembre 2026']);
});

test('error de red: mensaje de error (role=alert), nunca "Sin encuestas"; nada viejo para exportar', async () => {
  const { d, charts, ctx } = await dibujar(async () => { throw new Error('Failed to fetch'); });
  assert.equal(charts.length, 0);
  assert.match(d.wrapPadre.innerHTML, /role="alert"/);
  assert.match(d.wrapPadre.innerHTML, /No se pudo cargar One &amp; Done/);
  assert.doesNotMatch(d.wrapPadre.innerHTML, /Sin encuestas/);
  assert.equal(vm.runInContext('_encuestaOadUltimo[0].length', ctx), 0);
});

test('sin encuestas en el rango (respuesta OK vacia) sigue diciendo "Sin encuestas en el período"', async () => {
  const { d } = await dibujar(async () => []);
  assert.match(d.wrapPadre.innerHTML, /Sin encuestas en el período/);
});

test('Exportar con One & Done activa: titulo "One & Done"; en otra sub-pestaña: "Trafico de Llamadas"', () => {
  const traf = JS('trafico.js');
  const ctx = {
    _traficoSubtabActivo: {},
    _encuestaOadDatosExport: () => [],
    document: { getElementById: () => ({ dataset: { campana: 'MOBILIZE' } }) },
  };
  vm.createContext(ctx);
  vm.runInContext([extraer(traf, 'function _traficoClaveEstado'), extraer(traf, 'function _traficoExportEsOneAndDone'), extraer(traf, 'function _traficoExportEsEficacia'), extraer(traf, 'function _traficoExportTitulo')].join('\n'), ctx);
  assert.equal(vm.runInContext('_traficoExportTitulo(0)', ctx), 'Trafico de Llamadas');
  ctx._traficoSubtabActivo.MOBILIZE = 'oneanddone';
  assert.equal(vm.runInContext('_traficoExportTitulo(0)', ctx), 'One & Done');
  ctx._traficoSubtabActivo.MOBILIZE = 'aht';
  assert.equal(vm.runInContext('_traficoExportTitulo(0)', ctx), 'Trafico de Llamadas');
  // El Exportar del tablero completo usa ese titulo.
  assert.match(JS('dashboard-generic.js'), /_traficoExportTitulo\(i\)/);
});

test('Excel de WhatsApp por rangos: sin xlsxFilasSeguras no exporta y muestra un error', () => {
  const src = extraer(JS('whatsapp-tiempos.js'), 'function _wppTiemposExportExcel');
  const correr = (conProteccion) => {
    const ctx = {
      toasts: [], escritos: [],
      document: { getElementById: () => ({ dataset: { campana: 'ORLANT' } }) },
      _wppTiemposDatosExport: () => [{ Skill: '=HYPERLINK("x")' }],
      // Fase 165: hojas "PorCola" y "PorMes", tambien con la proteccion.
      _wppTiemposDatosPorCola: () => [{ Cola: '=HYPERLINK("y")' }],
      _wppTiemposDatosPorMes: () => [{ Mes: '=1+1' }],
      _wppTiemposUltimo: { ORLANT: { mes: '2026-09' } },
      XLSX: { utils: { book_new: () => ({ hojas: [] }), json_to_sheet: (f) => f, book_append_sheet: (wb, ws) => wb.hojas.push(ws) }, writeFile: (wb) => ctx.escritos.push(wb) },
    };
    ctx.showToast = (m, t) => ctx.toasts.push(t);
    if (conProteccion) ctx.xlsxFilasSeguras = (f) => f.map(() => ({ Skill: "'=" }));
    vm.createContext(ctx);
    vm.runInContext(src + '\n_wppTiemposExportExcel(0);', ctx);
    return ctx;
  };
  const sin = correr(false);
  assert.equal(sin.escritos.length, 0);
  assert.deepEqual(sin.toasts, ['error']);
  const con = correr(true);
  assert.equal(con.escritos.length, 1);
  assert.equal(con.escritos[0].hojas[0][0].Skill, "'=");
  assert.equal(con.escritos[0].hojas.length, 3);
  con.escritos[0].hojas.forEach((h) => assert.deepEqual(h[0], { Skill: "'=" }, 'cada hoja pasa por xlsxFilasSeguras'));
});
