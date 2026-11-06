// fase277-aurora-tipif-sin-lineas.test.js — Fase 277 (pedido de Edwin, 06/11):
// Clinica Aurora › Tipificacion sin el filtro «Línea (General / 3P)», sin las
// tarjetas «Salida General / Salida 3P / Sin clasificar» y sin «Clasificación de
// asesores»: en Aurora no hay lineas. Conserva la vista de salida de ORLANT
// (cabecera sin Mes/Desde/Hasta y el filtro «Entrada o salida»). ORLANT, HLM y
// Mobilize no cambian. Datos SINTETICOS (asesores y chats inventados).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const T = require('../../public/js/tipificacion-logic.js');
const tip = require('../tipificaciones');
const { db } = require('./helpers');

const AURORA = 'CLINICA AURORA';
const PUB = path.join(__dirname, '..', '..', 'public', 'js');
const H = ['CONN_ID', 'CHANNEL', 'DATE', 'DATE_CLOSE', 'AGENT_NAME', 'DESCRIPTION_COD_ACT', 'SKILL_ID'];
const chats = (n, skillId) => Array.from({ length: n }, (_, k) => ['C' + skillId + k, 'whatsapp', '2026-10-0' + (1 + (k % 9)) + ' 09:00:00', '2026-10-0' + (1 + (k % 9)) + ' 10:00:00', 'ASESORA ' + (k % 3), 'AGENDADA', skillId]);

function cargar(campana) {
  const r = T.tipificacionParseFilas([H, ...chats(6, '4019'), ...chats(4, '0')], null, 'WHATSAPP', { skillsWhatsapp: { 0: 'WHATSAPP DE SALIDA' } });
  tip.cargarTipificaciones(db, { campana, canal: 'WHATSAPP', archivoNombre: 's.xlsx', cargadoPorNombre: 'test', filas: r.filas.map(T.tipificacionFilaComoArray) });
}

// _tipificacionRenderPanel REAL con las /opciones que da el servidor (base de prueba).
async function renderPanel(campana) {
  const host = { innerHTML: '' };
  const ctx = {
    console, setTimeout,
    document: { getElementById: (id) => (id === 'gd-p0' ? host : null), querySelectorAll: () => [], addEventListener() {} },
    apiRequest: async (m, url) => {
      const q = new URLSearchParams(url.split('?')[1]);
      return tip.tipificacionesOpciones(db, q.get('campana'), q.get('canal'));
    },
    esc: (s) => String(s == null ? '' : s),
    textoFormatoNombre: (s) => s,
    tipificacionEtiquetaSkill: T.tipificacionEtiquetaSkill,
    isFullAdmin: () => true,
    fechaLimitesFinDeMesActual: () => '2026-11-30',
    mesNombreLargo: (m) => m,
    _gdAvisoSinDatosMesHtml: () => '',
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(PUB, 'tipificacion.js'), 'utf8'), ctx, { filename: 'tipificacion.js' });
  ctx._tipificacionSincronizarConMesGlobal = () => false;
  ctx._tipificacionDibujarTodos = async () => {};
  await ctx._tipificacionRenderPanel({ tipo: 'tipificacion_panel', campana, titulo: 'Tipificación', mostrarTarjetasSalida: true, mostrarFiltroTipo: true }, 0);
  return host.innerHTML;
}

test('servidor: Aurora sin clasificacion General/3P pero con la vista de salida; ORLANT y HLM igual; Mobilize sin ninguna', () => {
  const op = (c) => { const o = tip.tipificacionesOpciones(db, c, 'WHATSAPP'); return [o.clasificacionAsesores, o.vistaSalida]; };
  assert.deepEqual(op(AURORA), [false, true]);
  assert.deepEqual(op('ORLANT'), [true, true]);
  assert.deepEqual(op('HOSPITAL LA MARIA'), [true, true]);
  assert.deepEqual(op('MOBILIZE'), [false, false]);
  assert.equal(tip.usaClasificacionAsesores(AURORA), false);
  assert.equal(tip.salidaPorGuion(AURORA), true, 'la regla de salida de Aurora no cambia');
});

test('Aurora: sin filtro Línea, sin tarjetas por línea y sin «Clasificación de asesores»; con «Entrada o salida»', async () => {
  cargar(AURORA);
  const html = await renderPanel(AURORA);
  assert.doesNotMatch(html, /Línea \(General \/ 3P\)/);
  assert.doesNotMatch(html, /tipif-lineas-/, 'sin las tarjetas Salida General / 3P / Sin clasificar');
  assert.doesNotMatch(html, /Clasificación de asesores/);
  assert.match(html, />Entrada o salida</, 'conserva el filtro de ORLANT');
  assert.match(html, /tipif-cabecera/, 'conserva la cabecera de ORLANT (sin Mes/Desde/Hasta)');
  assert.doesNotMatch(html, /tipif-f-desde-/);
});

test('ORLANT: todo como antes (filtro Línea, tarjetas por línea y Clasificación de asesores)', async () => {
  cargar('ORLANT');
  const html = await renderPanel('ORLANT');
  assert.match(html, /Línea \(General \/ 3P\)/);
  assert.match(html, /tipif-lineas-0-WHATSAPP/);
  assert.match(html, /Clasificación de asesores/);
  assert.match(html, />Entrada o salida</);
});

test('Aurora: un filtro de línea viejo no recorta los conteos (se ignora)', () => {
  const base = { campana: AURORA, canal: 'WHATSAPP', mes: '2026-10' };
  const todos = tip.tipificacionesPorTipo(db, base).total;
  assert.ok(todos > 0);
  assert.equal(tip.tipificacionesPorTipo(db, { ...base, linea: 'GENERAL' }).total, todos);
  assert.equal(tip.tipificacionesPorTipo(db, { ...base, sentido: 'salida' }).total, 4, '«Entrada o salida» sigue funcionando (SKILL_ID 0)');
});
