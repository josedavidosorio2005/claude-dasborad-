// fase131-tipificacion-cdr-mobilize.test.js — Fase 131 (Parte 3). Reglas de
// negocio NUEVAS de la Tipificacion CDR de Mobilize, sobre el MISMO motor
// de ORLANT (tipificacion-logic.js / tipificaciones.js / validation.js --
// contrato de 3 archivos, ver sus propios comentarios). El header real de
// Mobilize (export completo HistCDR de Wolkvox) es ESTRUCTURALMENTE
// IDENTICO al que ya usa ORLANT (ver fase116-tipificacion-histcdr.test.js/
// fase118-histcdr-privacidad.test.js) -- las pruebas de privacidad de esos
// 2 archivos ya cubren el caso general; aqui se fijan las reglas de
// negocio ESPECIFICAS que pidio Edwin para Mobilize (exclusion de
// "PRUEBA", conectada/no conectada). Datos SIEMPRE inventados.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  TIPIFICACION_COLUMNAS,
  TIPIFICACION_CDR_COLUMNAS_PII_PROHIBIDAS,
  TIPIFICACION_CDR_EXCLUIR_POR_DEFECTO,
  TIPIFICACION_CDR_NO_CONECTADA_POR_DEFECTO,
  tipificacionColIndexMap,
  tipificacionParseFilas,
  tipificacionEsConectada,
} = require('../../public/js/tipificacion-logic.js');
const db = require('../db');
const { tipificacionesResumenSalida, cargarTipificaciones } = require('../tipificaciones');

// Header real de Mobilize (20 columnas, mismo export HistCDR de Wolkvox que
// ya usa ORLANT) -- confirmado contra el archivo real, solo ESTRUCTURA.
const HEADER_CDR = [
  'AGENT_NAME', 'DATE', 'DESTINY', 'TELEPHONE', 'COST', 'TIME_SEC', 'TIME_MIN',
  'COD_ACT', 'DESCRIPTION_COD_ACT', 'COD_ACT_2', 'DESCRIPTION_COD_ACT_2',
  'TYPE_INTERACTION', 'CUSTOMER_ID', 'HUNG_UP', 'CAMPAIGN_ID', 'CONN_ID',
  'SKILL_ID', 'SKILL_NAME', 'AGENT_ID', 'COMMENT',
];
const IDX = {};
HEADER_CDR.forEach((h, i) => { IDX[h] = i; });

function filaCdr(over) {
  const row = new Array(HEADER_CDR.length).fill(null);
  row[IDX.AGENT_NAME] = 'Asesor Ficticio';
  row[IDX.DATE] = '2026-09-10';
  row[IDX.TIME_SEC] = 95;
  row[IDX.COD_ACT] = 401;
  row[IDX.DESCRIPTION_COD_ACT] = 'Agendamiento_de_mantenimientos';
  row[IDX.COD_ACT_2] = '-';
  row[IDX.DESCRIPTION_COD_ACT_2] = '-';
  row[IDX.TYPE_INTERACTION] = 'inbound';
  row[IDX.HUNG_UP] = 'agent';
  row[IDX.SKILL_ID] = '12345';
  row[IDX.SKILL_NAME] = 'SKILL SAC';
  Object.assign(row, over || {});
  return row;
}

test('TIPIFICACION_COLUMNAS: ninguna de las 7 columnas prohibidas (PII) del CDR real esta en la lista reconocida', () => {
  const labelsReconocidas = TIPIFICACION_COLUMNAS.map((c) => c.label);
  TIPIFICACION_CDR_COLUMNAS_PII_PROHIBIDAS.forEach((prohibida) => {
    assert.ok(!labelsReconocidas.includes(prohibida), `${prohibida} no deberia estar en TIPIFICACION_COLUMNAS`);
  });
  const map = tipificacionColIndexMap(HEADER_CDR);
  assert.equal(Object.keys(map).length, 10, 'solo 10 columnas del CDR deberian resolver (agente/fecha/duracionMin/tipificacion/skill/duracionSeg/codAct/tipoInteraccion/hungUp/skillId)');
});

test('COD_ACT se guarda SIEMPRE como texto, aunque la celda real sea un numero (y aunque traiga "TIMEOUTACW")', () => {
  const aoa = [HEADER_CDR, filaCdr({ [IDX.COD_ACT]: 400 }), filaCdr({ [IDX.COD_ACT]: 'TIMEOUTACW', [IDX.DESCRIPTION_COD_ACT]: 'Timeout_ACW' })];
  const res = tipificacionParseFilas(aoa);
  assert.ok(!res.error, JSON.stringify(res));
  assert.equal(typeof res.filas[0].codAct, 'string');
  assert.equal(res.filas[0].codAct, '400');
  assert.equal(res.filas[1].codAct, 'TIMEOUTACW');
});

test('TYPE_INTERACTION: inbound/outbound_ma se conservan tal cual; cualquier otro valor se normaliza a "otro" con 1 solo aviso resumen', () => {
  const aoa = [
    HEADER_CDR,
    filaCdr({ [IDX.DATE]: '2026-09-10', [IDX.TYPE_INTERACTION]: 'inbound' }),
    filaCdr({ [IDX.DATE]: '2026-09-11', [IDX.TYPE_INTERACTION]: 'outbound_ma' }),
    filaCdr({ [IDX.DATE]: '2026-09-12', [IDX.TYPE_INTERACTION]: 'chat_raro' }),
    filaCdr({ [IDX.DATE]: '2026-09-13', [IDX.TYPE_INTERACTION]: 'otro_valor_raro' }),
  ];
  const res = tipificacionParseFilas(aoa);
  assert.ok(!res.error, JSON.stringify(res));
  assert.deepEqual(res.filas.map((f) => f.tipoInteraccion), ['inbound', 'outbound_ma', 'otro', 'otro']);
  const avisosTipo = res.avisos.filter((a) => /TYPE_INTERACTION/.test(a));
  assert.equal(avisosTipo.length, 1, 'un solo aviso resumen, no uno por fila');
});

test('Exclusion configurable (codificacionesExcluidas): filas de "PRUEBA" se excluyen y se reportan en avisos, sin contarse como omitidas por dato faltante', () => {
  const aoa = [
    HEADER_CDR,
    filaCdr({ [IDX.DATE]: '2026-09-10', [IDX.DESCRIPTION_COD_ACT]: 'PRUEBA', [IDX.COD_ACT]: 400 }),
    filaCdr({ [IDX.DATE]: '2026-09-11', [IDX.DESCRIPTION_COD_ACT]: 'PRUEBA', [IDX.COD_ACT]: 400 }),
    filaCdr({ [IDX.DATE]: '2026-09-12' }),
  ];
  const sinExclusion = tipificacionParseFilas(aoa, null, 'LLAMADAS', {});
  assert.equal(sinExclusion.filas.length, 3, 'sin la lista, ninguna fila se excluye (ORLANT nunca la pasa)');

  const conExclusion = tipificacionParseFilas(aoa, null, 'LLAMADAS', { codificacionesExcluidas: TIPIFICACION_CDR_EXCLUIR_POR_DEFECTO });
  assert.ok(!conExclusion.error, JSON.stringify(conExclusion));
  assert.equal(conExclusion.filas.length, 1);
  assert.equal(conExclusion.excluidas, 2);
  assert.ok(conExclusion.avisos.some((a) => /Se excluyeron 2 fila\(s\)/.test(a) && /prueba/i.test(a)));
});

test('tipificacionEsConectada: Regla B -- "Cliente_no_contesta" (y solo esa, por defecto) cuenta como NO conectada', () => {
  assert.equal(tipificacionEsConectada('Cliente_no_contesta', TIPIFICACION_CDR_NO_CONECTADA_POR_DEFECTO), false);
  assert.equal(tipificacionEsConectada('Agendamiento_de_mantenimientos', TIPIFICACION_CDR_NO_CONECTADA_POR_DEFECTO), true);
  assert.equal(tipificacionEsConectada('Otros_motivos', TIPIFICACION_CDR_NO_CONECTADA_POR_DEFECTO), true);
});

test('COD_ACT_2/DESCRIPTION_COD_ACT_2 ("-" en el archivo real) nunca se leen -- no aportan ninguna clave al resultado', () => {
  const aoa = [HEADER_CDR, filaCdr()];
  const res = tipificacionParseFilas(aoa);
  assert.ok(!res.error, JSON.stringify(res));
  assert.ok(!('codAct2' in res.filas[0]));
  assert.ok(!('descripcionCodAct2' in res.filas[0]));
});

// ── Servidor: tarjetas de SALIDA (total/conectadas/no conectadas) ──────────
test('tipificacionesResumenSalida: cuenta total/conectadas/noConectadas SOLO de las salientes (outbound_ma), respetando mes/agente/skill', () => {
  const campana = 'MOBILIZE_TEST_FASE131_' + Math.random().toString(36).slice(2, 8);
  const filasObj = [
    { agente: 'A1', fecha: '2026-09-05', hora: null, duracionMin: null, tipificacion: 'Agendamiento_de_mantenimientos', skill: 'Llamadas de salida', duracionSeg: 60, codAct: '401', tipoInteraccion: 'outbound_ma', hungUp: 'agent', skillId: '1' },
    { agente: 'A2', fecha: '2026-09-06', hora: null, duracionMin: null, tipificacion: 'Cliente_no_contesta', skill: 'Llamadas de salida', duracionSeg: 30, codAct: '402', tipoInteraccion: 'outbound_ma', hungUp: 'customer', skillId: '1' },
    { agente: 'A1', fecha: '2026-09-07', hora: null, duracionMin: null, tipificacion: 'Otros_motivos', skill: 'SKILL SAC', duracionSeg: 90, codAct: '403', tipoInteraccion: 'inbound', hungUp: 'agent', skillId: '2' },
  ];
  const filas = filasObj.map((f) => [f.agente, f.fecha, f.hora, f.duracionMin, f.tipificacion, f.skill, f.duracionSeg, f.codAct, f.tipoInteraccion, f.hungUp, f.skillId]);
  cargarTipificaciones(db, { campana, canal: 'LLAMADAS', archivoNombre: 'prueba.xlsx', cargadoPorNombre: 'Test', filas });

  const resumen = tipificacionesResumenSalida(db, { campana, mes: '2026-09' });
  assert.deepEqual(resumen, { total: 2, conectadas: 1, noConectadas: 1 });

  // El filtro de agente respeta solo lo saliente de ESE agente.
  const resumenA1 = tipificacionesResumenSalida(db, { campana, mes: '2026-09', agente: 'A1' });
  assert.deepEqual(resumenA1, { total: 1, conectadas: 1, noConectadas: 0 });

  // Sin ninguna fila saliente en el filtro -> ceros, nunca un error.
  const resumenVacio = tipificacionesResumenSalida(db, { campana, mes: '2026-01' });
  assert.deepEqual(resumenVacio, { total: 0, conectadas: 0, noConectadas: 0 });
});
