// fase116-cargas-canal-wpp-diario.test.js — Fase 116: cargasDetectarCanalTrafico
// (cargas-logic.js) gana un 4to parametro opcional `esWppDiario` para
// reconocer el formato diario real de WhatsApp (SKILL_NAME+DATE+INBOUND_CALLS+
// ANSWER_CALLS) -- sin esto, colIndexMapWpp().colaWhatsapp nunca se activa
// para este formato (NOMBRE_COLA_WHATSAPP no esta en su encabezado) y el
// archivo quedaria mal detectado como "voz" (SKILL_NAME+DATE tambien calzan
// ahi). Sin el 4to parametro, el comportamiento es EXACTAMENTE igual al de
// siempre (ver cargas-logic.test.js, que lo sigue llamando con 3).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargasDetectarCanalTrafico } = require('../../public/js/cargas-logic.js');
const { traficoColIndexMap } = require('../../public/js/trafico-logic.js');
const { traficoWppColIndexMap, traficoWppEsFormatoDiario } = require('../../public/js/trafico-whatsapp-logic.js');

const HEADER_WPP_DIARIO = ['SKILL_NAME', 'DATE', 'INBOUND_CALLS', 'ANSWER_CALLS', 'ABANDON_CALLS', 'ASA', 'ATA', 'AHT'];
const HEADER_VOZ = ['SKILL_NAME', 'DATE', 'TOTAL LLAMADAS', 'LLAMADAS CONTESTADAS', 'LLAMADAS ABANDONADAS'];
const HEADER_WPP_PERIODO = ['NOMBRE_COLA_WHATSAPP', 'FECHA INICIO', 'FECHA FIN', 'TOTAL WHATSAPP', 'WHATSAPP CONTESTADOS'];

test('SIN el 4to parametro: el formato diario de WhatsApp (SKILL_NAME+DATE) se detecta mal como "voz" (comportamiento viejo, documentado aqui a proposito)', () => {
  assert.equal(cargasDetectarCanalTrafico(HEADER_WPP_DIARIO, traficoColIndexMap, traficoWppColIndexMap), 'voz');
});

test('CON el 4to parametro (traficoWppEsFormatoDiario): el formato diario de WhatsApp se detecta correctamente como "whatsapp"', () => {
  assert.equal(cargasDetectarCanalTrafico(HEADER_WPP_DIARIO, traficoColIndexMap, traficoWppColIndexMap, traficoWppEsFormatoDiario), 'whatsapp');
});

test('CON el 4to parametro: un encabezado de voz real sigue detectandose como "voz" (INBOUND_CALLS/ANSWER_CALLS son unicos de WhatsApp, no hay falso positivo)', () => {
  assert.equal(cargasDetectarCanalTrafico(HEADER_VOZ, traficoColIndexMap, traficoWppColIndexMap, traficoWppEsFormatoDiario), 'voz');
});

test('CON el 4to parametro: el formato viejo de periodo de WhatsApp sigue detectandose como "whatsapp" (via colaWhatsapp, sin cambios)', () => {
  assert.equal(cargasDetectarCanalTrafico(HEADER_WPP_PERIODO, traficoColIndexMap, traficoWppColIndexMap, traficoWppEsFormatoDiario), 'whatsapp');
});
