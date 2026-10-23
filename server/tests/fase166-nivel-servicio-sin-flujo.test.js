// fase166-nivel-servicio-sin-flujo.test.js — Fase 166 (hallazgo al verificar
// la Fase 165 en produccion): con el MES de arriba en octubre y sin Flujo de
// WhatsApp de octubre, el panel de Trafico de WhatsApp de ORLANT decia "sin
// datos" y escondia TODAS sus sub-pestañas, tambien "Nivel de Servicio",
// aunque los tiempos de octubre estaban cargados. Ahora, para las campañas
// con esa vista, queda el aviso y debajo la sub-pestaña "Nivel de Servicio"
// (con Excel/PDF); las demas campañas siguen igual. Corre el
// trafico-whatsapp.js real en vm; solo se reemplaza lo externo.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { traficoDecidirRango, traficoFinDeMes } = require('../../public/js/trafico-logic.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'trafico-whatsapp.js'), 'utf8');
const FLUJO_SEP = [{ colaWhatsapp: 'WHATSAPP GENERAL', fechaInicio: '2026-09-01', fechaFin: '2026-09-30', totalWhatsapp: 10, contestados: 9 }];

async function dibujar({ campana, mesSel, filas, usaTiempos }) {
  const el = {};
  const tiempos = [];
  const ctx = {
    document: { getElementById: (id) => (el[id] = el[id] || { id, innerHTML: '', dataset: {} }), querySelector: () => null },
    window: { location: { search: '', pathname: '/' }, history: { replaceState() {} } },
    URLSearchParams,
    _gd: { mesSel },
    esc: (s) => String(s),
    traficoDecidirRango, traficoFinDeMes,
    fechaLimitesRecortar: (x) => x,
    _gdAvisoSinDatosMesHtml: (etq, mes) => '<div class="gd-aviso-sin-datos">Sin datos de ' + etq + ' para ' + mes + '.</div>',
    TRAFICO_WPP_SUBTABS: [{ key: 'resumen', label: 'Flujo de WhatsApp' }, { key: 'abandono', label: 'Abandono' }, { key: 'sl', label: 'Nivel de Servicio' }],
    _traficoSubtabsNavHTML: (pref, i, activo, fn, attr, subtabs) => subtabs.map((s) => '<button class="gd-subtab-btn' + (activo === s.key ? ' on' : '') + '" data-' + attr + '="' + s.key + '">' + s.label + '</button>').join(''),
    wppTiemposUsa: (c) => usaTiempos.includes(c),
    _wppTiemposRender: (i, c) => tiempos.push([i, c]),
    _wppTiemposFiltrosPanel: () => {},
    // De trafico.js / trafico-logic.js, solo para el panel completo.
    traficoRangoTexto: (d, h) => 'Mostrando: ' + d + ' – ' + h,
    _traficoFiltroLineaHTML: () => '',
    _traficoSubtabContentHTML: () => '',
    TRAFICO_WPP_SUBTAB_TITULOS: {},
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  ctx._traficoWppCargarDatos = async () => ({ filas });
  ctx._traficoWppEstadoDesdeURL = () => ({ skills: null, desde: '', hasta: '', granularidad: 'mes', combinar: true });
  ctx._traficoWppRenderContenido = () => {};
  await ctx._traficoWppRenderPanel({ campana }, 0);
  return { html: el['gd-p0'].innerHTML, tiempos, ctx };
}

test('ORLANT, MES octubre sin Flujo de octubre: aviso + sub-pestaña "Nivel de Servicio" activa, con Excel/PDF, y se dibuja la vista de rangos', async () => {
  const { html, tiempos, ctx } = await dibujar({ campana: 'ORLANT', mesSel: '2026-10', filas: FLUJO_SEP, usaTiempos: ['ORLANT'] });
  assert.match(html, /Sin datos de Tráfico de WhatsApp para 2026-10\./, 'el aviso de siempre sigue');
  assert.match(html, /<button class="gd-subtab-btn on" data-trafwppsub="sl">Nivel de Servicio<\/button>/);
  assert.doesNotMatch(html, /data-trafwppsub="resumen"|data-trafwppsub="abandono"/, 'las demas sub-pestañas no tienen datos de ese mes');
  assert.match(html, /_traficoWppExportExcel\(0\)/);
  assert.match(html, /_traficoWppExportPrint\(0\)/);
  assert.match(html, /<div id="tww-content-0"><\/div>/);
  assert.deepEqual(tiempos, [[0, 'ORLANT']]);
  assert.equal(ctx._traficoWppSubtabActivo.ORLANT, 'sl', 'los botones Excel/PDF exportan los rangos');
});

test('ORLANT sin ningun Flujo de WhatsApp cargado: tambien muestra "Nivel de Servicio"', async () => {
  const { html, tiempos } = await dibujar({ campana: 'ORLANT', mesSel: '2026-10', filas: [], usaTiempos: ['ORLANT'] });
  assert.match(html, /Sin datos de Flujo de WhatsApp cargados todavia\./);
  assert.match(html, /data-trafwppsub="sl"/);
  assert.equal(tiempos.length, 1);
});

test('una campaña sin la vista de rangos sigue igual que antes: solo el aviso, sin sub-pestañas', async () => {
  const mes = await dibujar({ campana: 'MOBILIZE', mesSel: '2026-10', filas: FLUJO_SEP, usaTiempos: ['ORLANT'] });
  assert.match(mes.html, /Sin datos de Tráfico de WhatsApp para 2026-10\./);
  assert.doesNotMatch(mes.html, /gd-subtab-btn/);
  assert.equal(mes.tiempos.length, 0);
  const vacio = await dibujar({ campana: 'MOBILIZE', mesSel: '2026-10', filas: [], usaTiempos: ['ORLANT'] });
  assert.match(vacio.html, /Sin datos cargados todavia\. Un usuario con permiso de administrador/);
  assert.doesNotMatch(vacio.html, /gd-subtab-btn/);
});

test('ORLANT con Flujo del mes: el panel completo de siempre, con todas sus sub-pestañas', async () => {
  const { html } = await dibujar({ campana: 'ORLANT', mesSel: '2026-09', filas: FLUJO_SEP, usaTiempos: ['ORLANT'] });
  assert.doesNotMatch(html, /Sin datos de Tráfico de WhatsApp/);
  for (const k of ['resumen', 'abandono', 'sl']) assert.match(html, new RegExp('data-trafwppsub="' + k + '"'));
  assert.match(html, /id="tww-f-desde-0"/, 'con sus filtros Desde/Hasta');
});
