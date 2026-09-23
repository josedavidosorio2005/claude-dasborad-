// cargas-logic-fase66-plantilla-unificada.test.js — Fase 66: plantilla
// unificada de Trafico para ORLANT (hojas LLAMADAS + WHATSAPP en un solo
// archivo, en vez de la hoja generica "DATA" de una sola campana a la vez).
// Cubre: cargasPlanConsolidado con el 4to parametro (traficoWppCols),
// cargasResolverHojaTrafico (decide de que hoja real del archivo sale el
// dato de cada slot, con fallback a "DATA" para archivos viejos de un solo
// canal), y el flujo completo de parseo contra el archivo de prueba REAL
// (PLANTILLA_TRAFICO_UNIFICADA_ORLANT_PRUEBA_AGOSTO_2026.xlsx) cruzado
// contra los numeros de referencia de agosto 2026 que dio el usuario.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { leerHojaXlsxComoAoA } = require('./helpers/xlsx-lite');
const {
  cargasPlanConsolidado,
  cargasResolverHojaTrafico,
  cargasProcesarHoja,
  cargasDetectarCanalTrafico,
  cargasHojaVacia,
  CARGAS_HOJA_TRAFICO,
  CARGAS_HOJA_TRAFICO_LLAMADAS,
  CARGAS_HOJA_TRAFICO_WHATSAPP,
} = require('../../public/js/cargas-logic.js');
const { traficoColIndexMap, traficoParseFilas, traficoAhtPromedioPeriodo } = require('../../public/js/trafico-logic.js');
const { traficoWppColIndexMap, traficoWppParseFilas, traficoWppResumen } = require('../../public/js/trafico-whatsapp-logic.js');

const FIXTURE_UNIFICADA = path.join(__dirname, 'fixtures', 'PLANTILLA_TRAFICO_UNIFICADA_ORLANT_PRUEBA_AGOSTO_2026.xlsx');
const FIXTURE_TRAFICO_VOZ = path.join(__dirname, 'fixtures', 'EJEMPLO.xlsx'); // archivo viejo, hoja "DATA", voz
const FIXTURE_TRAFICO_WPP = path.join(__dirname, 'fixtures', 'PLANTILLA_TRAFICO_WHATSAPP_EJEMPLO.xlsx'); // archivo viejo, hoja "DATA", whatsapp

// Mismo dispatcher que _cargasParseTraficoAuto (cargas.js), reproducido
// aqui sin DOM para probar el flujo completo con los parsers reales.
function parseTraficoAuto(aoa) {
  const canal = cargasDetectarCanalTrafico(aoa[0] || [], traficoColIndexMap, traficoWppColIndexMap);
  const res = canal === 'whatsapp' ? traficoWppParseFilas(aoa) : traficoParseFilas(aoa);
  if (!res.error) res.canal = canal;
  return res;
}

// ── cargasPlanConsolidado: 4to parametro (traficoWppCols) ───────────────
test('cargasPlanConsolidado: sin 4to parametro, comportamiento identico al de siempre (1 sola hoja "DATA") -- ningun otro cliente cambia', () => {
  const secciones = { resumen: { titulo: 'Resumen', filaUnica: true, columnas: [] } };
  const plan = cargasPlanConsolidado(secciones, null, [{ label: 'SKILL_NAME' }]);
  assert.deepEqual(plan.map((h) => h.hoja), ['resumen', CARGAS_HOJA_TRAFICO]);
  assert.equal(plan[1].canalFijo, undefined);
});

test('cargasPlanConsolidado: CON traficoWppCols, la hoja "DATA" se reemplaza por 2 hojas LLAMADAS/WHATSAPP con canalFijo', () => {
  const secciones = { resumen: { titulo: 'Resumen', filaUnica: true, columnas: [] } };
  const plan = cargasPlanConsolidado(
    secciones, null,
    [{ label: 'SKILL_NAME' }],
    [{ label: 'NOMBRE_COLA_WHATSAPP' }]
  );
  assert.deepEqual(plan.map((h) => h.hoja), ['resumen', CARGAS_HOJA_TRAFICO_LLAMADAS, CARGAS_HOJA_TRAFICO_WHATSAPP]);
  assert.equal(plan[1].canalFijo, 'voz');
  assert.equal(plan[2].canalFijo, 'whatsapp');
  // Ninguna de las 2 hojas nuevas se llama "DATA" -- son nombres explicitos.
  assert.ok(plan.every((h) => h.hoja !== CARGAS_HOJA_TRAFICO));
});

// ── cargasResolverHojaTrafico: decision pura de que hoja real usar ──────
test('cargasResolverHojaTrafico: la hoja ya viene con el nombre nuevo -- se usa directo, sin tocar "DATA"', () => {
  const slot = { hoja: 'LLAMADAS', canalFijo: 'voz' };
  const r = cargasResolverHojaTrafico(slot, ['INSTRUCCIONES', 'LLAMADAS', 'WHATSAPP'], true, 'voz', false);
  assert.deepEqual(r, { hojaReal: 'LLAMADAS', usoData: false });
});

test('cargasResolverHojaTrafico: archivo viejo -- la hoja nueva no esta, pero "DATA" si y su canal coincide -> usa "DATA"', () => {
  const slot = { hoja: 'LLAMADAS', canalFijo: 'voz' };
  const r = cargasResolverHojaTrafico(slot, ['INSTRUCCIONES', 'DATA'], true, 'voz', false);
  assert.deepEqual(r, { hojaReal: 'DATA', usoData: true });
});

test('cargasResolverHojaTrafico: "DATA" existe pero es del OTRO canal -- este slot queda ausente (no se le asigna un canal que no es el suyo)', () => {
  const slot = { hoja: 'LLAMADAS', canalFijo: 'voz' };
  const r = cargasResolverHojaTrafico(slot, ['INSTRUCCIONES', 'DATA'], true, 'whatsapp', false);
  assert.deepEqual(r, { hojaReal: null, usoData: false });
});

test('cargasResolverHojaTrafico: "DATA" ya fue reclamada por el otro slot -- no se le asigna dos veces', () => {
  const slot = { hoja: 'WHATSAPP', canalFijo: 'whatsapp' };
  const r = cargasResolverHojaTrafico(slot, ['INSTRUCCIONES', 'DATA'], true, 'whatsapp', true /* dataYaUsada */);
  assert.deepEqual(r, { hojaReal: null, usoData: false });
});

test('cargasResolverHojaTrafico: sin hoja nueva y sin "DATA" en el archivo -- ausente, tal cual', () => {
  const slot = { hoja: 'WHATSAPP', canalFijo: 'whatsapp' };
  const r = cargasResolverHojaTrafico(slot, ['INSTRUCCIONES', 'resumen'], false, null, false);
  assert.deepEqual(r, { hojaReal: null, usoData: false });
});

test('cargasResolverHojaTrafico: entradas SIN canalFijo (resto de campanas, hoja "DATA" generica) se comportan igual que siempre -- nunca intentan el fallback', () => {
  const slot = { hoja: CARGAS_HOJA_TRAFICO }; // sin canalFijo
  const r = cargasResolverHojaTrafico(slot, ['INSTRUCCIONES', 'resumen'], false, null, false);
  assert.deepEqual(r, { hojaReal: null, usoData: false });
  // Si "DATA" SI esta presente con su nombre real, se usa por el camino normal (no el fallback).
  const r2 = cargasResolverHojaTrafico(slot, ['INSTRUCCIONES', 'DATA'], true, 'voz', false);
  assert.deepEqual(r2, { hojaReal: 'DATA', usoData: false });
});

// ── Archivo unificado REAL (PLANTILLA_..._PRUEBA_AGOSTO_2026.xlsx) ──────
// Los 2 escenarios de mas peso del pedido: las dos hojas llenas a la vez,
// cruzado contra los numeros de referencia de agosto 2026 dados por el
// usuario -- y la fila con "----" en AHT (17/08, 0 contestadas en las 2
// skills) que debe quedar FUERA del promedio ponderado, no contar como 0.
test('archivo unificado con las 2 hojas llenas: LLAMADAS parsea 50 filas, 2 skills, coincide EXACTO con los numeros de referencia de agosto 2026', () => {
  const aoa = leerHojaXlsxComoAoA(FIXTURE_UNIFICADA, 'LLAMADAS');
  const res = traficoParseFilas(aoa);
  assert.equal(res.error, undefined);
  assert.equal(res.filas.length, 50);
  assert.deepEqual(res.skills.sort(), ['CALL INBOUND ORLANT 3P', 'CALL INBOUND ORLANT GENERAL']);
  assert.deepEqual(res.meses, ['2026-08']);

  const porSkill = {};
  res.filas.forEach((f) => {
    porSkill[f.skillName] = porSkill[f.skillName] || { tot: 0, cont: 0, aband: 0, n: 0 };
    porSkill[f.skillName].tot += f.totalLlamadas;
    porSkill[f.skillName].cont += f.contestadas;
    porSkill[f.skillName].aband += f.llamadasAbandonadas || 0;
    porSkill[f.skillName].n++;
  });
  assert.deepEqual(porSkill['CALL INBOUND ORLANT 3P'], { tot: 4011, cont: 3937, aband: 74, n: 25 });
  assert.deepEqual(porSkill['CALL INBOUND ORLANT GENERAL'], { tot: 4050, cont: 3222, aband: 828, n: 25 });

  const totTot = res.filas.reduce((a, f) => a + f.totalLlamadas, 0);
  const totCont = res.filas.reduce((a, f) => a + f.contestadas, 0);
  const totAband = res.filas.reduce((a, f) => a + (f.llamadasAbandonadas || 0), 0);
  assert.equal(totTot, 8061);
  assert.equal(totCont, 7159);
  assert.equal(totAband, 902);
  assert.equal(Math.round((totCont / totTot) * 10000) / 100, 88.81);
  assert.equal(Math.round((totAband / totTot) * 10000) / 100, 11.19);
});

test('archivo unificado: WHATSAPP parsea 5 colas, coincide EXACTO con las Fases 55-56 (7.305/7.109/196, 97.32%/2.68%)', () => {
  const aoa = leerHojaXlsxComoAoA(FIXTURE_UNIFICADA, 'WHATSAPP');
  const res = traficoWppParseFilas(aoa);
  assert.equal(res.error, undefined);
  assert.equal(res.filas.length, 5);
  assert.deepEqual(res.colas.sort(), [
    'WHATSAPP AUDIFONOS', 'WHATSAPP FONIATRIA', 'WHATSAPP FONOAUDIOLOGIA', 'WHATSAPP ORLANT 3P', 'WHATSAPP ORLANT GENERAL',
  ]);
  const resumen = traficoWppResumen(res.filas);
  assert.equal(resumen.totalWhatsapp, 7305);
  assert.equal(resumen.contestados, 7109);
  assert.equal(resumen.abandonados, 196);
  assert.equal(resumen.nivelAtencionPct, 97.32);
  assert.equal(resumen.tasaAbandonoPct, 2.68);
});

test('archivo unificado: "----" en AHT (17/08, 0 contestadas en las 2 skills) queda FUERA del promedio ponderado, nunca cuenta como 0', () => {
  const aoa = leerHojaXlsxComoAoA(FIXTURE_UNIFICADA, 'LLAMADAS');
  const res = traficoParseFilas(aoa);
  const filas17ago = res.filas.filter((f) => f.fecha === '2026-08-17');
  assert.equal(filas17ago.length, 2); // las 2 skills tienen fila ese dia
  filas17ago.forEach((f) => {
    assert.equal(f.contestadas, 0);
    assert.equal(f.ahtSegundos, undefined, 'AHT "----" no debe quedar en 0 ni en ningun numero -- ausente');
  });
  const conAht = res.filas.filter((f) => f.ahtSegundos != null);
  assert.equal(conAht.length, 48, '50 filas totales - 2 con "----" = 48 con AHT real');
  // El promedio ponderado (Fase 65) usa solo esas 48 -- sin reventar ni
  // tratar las 2 excluidas como peso 0-con-valor-0.
  const aht = traficoAhtPromedioPeriodo(res.filas);
  assert.ok(aht !== null && aht > 0);
});

test('archivo unificado: LLAMADAS y WHATSAPP resuelven por su propio nombre de hoja (nunca necesitan el fallback a "DATA") -- el archivo ni siquiera tiene hoja "DATA"', () => {
  // Confirma la premisa del fallback: un archivo unificado real no trae
  // "DATA" en absoluto (cargasResolverHojaTrafico ni se activa para el).
  assert.throws(() => leerHojaXlsxComoAoA(FIXTURE_UNIFICADA, 'DATA'), /No se encontro la hoja "DATA"/);
});

// ── Solo una hoja llena, la otra vacia (solo encabezado) -- se omite sin
// error, la vista previa la marca "vacia" ─────────────────────────────────
test('solo LLAMADAS llena, WHATSAPP vacia (solo encabezado): LLAMADAS procesa normal, WHATSAPP queda "vacia", NUNCA error', () => {
  const aoaLlamadas = leerHojaXlsxComoAoA(FIXTURE_UNIFICADA, 'LLAMADAS');
  const wsLlamadas = {}; // no se usa cargasDetectarFormulaSinValor en este test
  const rLlamadas = cargasProcesarHoja(
    { tipo: 'trafico', canalFijo: 'voz', hoja: CARGAS_HOJA_TRAFICO_LLAMADAS, titulo: 'Trafico de Llamadas', filaUnica: false },
    aoaLlamadas, wsLlamadas, parseTraficoAuto
  );
  assert.equal(rLlamadas.error, undefined);
  assert.equal(rLlamadas.filas.length, 50);

  const aoaWppVacia = [['NOMBRE_COLA_WHATSAPP', 'FECHA INICIO', 'FECHA FIN', 'TOTAL WHATSAPP', 'WHATSAPP CONTESTADOS']];
  const wsWppVacia = {};
  const rWpp = cargasProcesarHoja(
    { tipo: 'trafico', canalFijo: 'whatsapp', hoja: CARGAS_HOJA_TRAFICO_WHATSAPP, titulo: 'Trafico de WhatsApp', filaUnica: false },
    aoaWppVacia, wsWppVacia, parseTraficoAuto
  );
  assert.equal(rWpp.vacia, true);
  assert.equal(rWpp.error, undefined);
  assert.equal(rWpp.filas, undefined);
});

test('solo WHATSAPP llena, LLAMADAS vacia (solo encabezado): WHATSAPP procesa normal, LLAMADAS queda "vacia", NUNCA error', () => {
  const aoaWpp = leerHojaXlsxComoAoA(FIXTURE_UNIFICADA, 'WHATSAPP');
  const rWpp = cargasProcesarHoja(
    { tipo: 'trafico', canalFijo: 'whatsapp', hoja: CARGAS_HOJA_TRAFICO_WHATSAPP, titulo: 'Trafico de WhatsApp', filaUnica: false },
    aoaWpp, {}, parseTraficoAuto
  );
  assert.equal(rWpp.error, undefined);
  assert.equal(rWpp.filas.length, 5);

  const aoaLlamadasVacia = [['SKILL_NAME', 'DATE', 'TOTAL LLAMADAS', 'LLAMADAS CONTESTADAS']];
  const rLlamadas = cargasProcesarHoja(
    { tipo: 'trafico', canalFijo: 'voz', hoja: CARGAS_HOJA_TRAFICO_LLAMADAS, titulo: 'Trafico de Llamadas', filaUnica: false },
    aoaLlamadasVacia, {}, parseTraficoAuto
  );
  assert.equal(rLlamadas.vacia, true);
  assert.equal(rLlamadas.error, undefined);
});

test('las 2 hojas vacias (solo encabezado): ninguna da error, las 2 quedan "vacia" -- el caller (cargas.js) es quien muestra el mensaje claro de "sin datos en ninguna hoja"', () => {
  const aoaLlamadasVacia = [['SKILL_NAME', 'DATE', 'TOTAL LLAMADAS', 'LLAMADAS CONTESTADAS']];
  const aoaWppVacia = [['NOMBRE_COLA_WHATSAPP', 'FECHA INICIO', 'FECHA FIN', 'TOTAL WHATSAPP', 'WHATSAPP CONTESTADOS']];
  const rLlamadas = cargasProcesarHoja(
    { tipo: 'trafico', canalFijo: 'voz', hoja: CARGAS_HOJA_TRAFICO_LLAMADAS, titulo: 'Trafico de Llamadas', filaUnica: false },
    aoaLlamadasVacia, {}, parseTraficoAuto
  );
  const rWpp = cargasProcesarHoja(
    { tipo: 'trafico', canalFijo: 'whatsapp', hoja: CARGAS_HOJA_TRAFICO_WHATSAPP, titulo: 'Trafico de WhatsApp', filaUnica: false },
    aoaWppVacia, {}, parseTraficoAuto
  );
  assert.equal(rLlamadas.vacia, true);
  assert.equal(rWpp.vacia, true);
  assert.equal(rLlamadas.error, undefined);
  assert.equal(rWpp.error, undefined);
  // Simula el chequeo real de cargas.js: "sin datos en ninguna hoja" cuando
  // NINGUN resultado trae `filas`.
  const algunoConDatos = [rLlamadas, rWpp].some((r) => r.filas);
  assert.equal(algunoConDatos, false);
});

// ── Compatibilidad hacia atras: archivos VIEJOS de un solo canal, hoja
// "DATA" -- tienen que seguir funcionando exactamente igual que hoy ──────
test('archivo VIEJO de voz (hoja "DATA", EJEMPLO.xlsx): el slot LLAMADAS lo reconoce via el fallback, el slot WHATSAPP queda ausente sin bloquear nada', () => {
  const nombresHojas = ['DATA']; // archivo viejo real: una sola hoja de trafico
  const aoaData = leerHojaXlsxComoAoA(FIXTURE_TRAFICO_VOZ, 'DATA');
  const canalData = cargasDetectarCanalTrafico(aoaData[0], traficoColIndexMap, traficoWppColIndexMap);
  assert.equal(canalData, 'voz');

  let dataYaUsada = false;
  const slotLlamadas = { tipo: 'trafico', canalFijo: 'voz', hoja: CARGAS_HOJA_TRAFICO_LLAMADAS, titulo: 'Trafico de Llamadas', filaUnica: false };
  const resLlamadas = cargasResolverHojaTrafico(slotLlamadas, nombresHojas, true, canalData, dataYaUsada);
  assert.deepEqual(resLlamadas, { hojaReal: 'DATA', usoData: true });
  dataYaUsada = resLlamadas.usoData || dataYaUsada;

  const slotWpp = { tipo: 'trafico', canalFijo: 'whatsapp', hoja: CARGAS_HOJA_TRAFICO_WHATSAPP, titulo: 'Trafico de WhatsApp', filaUnica: false };
  const resWpp = cargasResolverHojaTrafico(slotWpp, nombresHojas, true, canalData, dataYaUsada);
  assert.deepEqual(resWpp, { hojaReal: null, usoData: false });

  // El slot LLAMADAS, usando la hoja "DATA" real, parsea exactamente igual
  // que antes de la Fase 66 (mismo archivo, mismo resultado).
  const rLlamadas = cargasProcesarHoja(slotLlamadas, aoaData, {}, parseTraficoAuto);
  assert.equal(rLlamadas.error, undefined);
  assert.equal(rLlamadas.canal, 'voz');
  assert.ok(rLlamadas.filas.length > 0);

  // El slot WHATSAPP, sin hoja real que usar, queda "ausente" (aviso, no
  // bloquea el guardado del otro slot).
  const rWpp = cargasProcesarHoja(slotWpp, null, undefined, parseTraficoAuto, nombresHojas);
  assert.match(rWpp.error, /No se encontro la hoja "WHATSAPP"/);
  assert.equal(rWpp.filas, undefined);
});

test('archivo VIEJO de WhatsApp (hoja "DATA", PLANTILLA_TRAFICO_WHATSAPP_EJEMPLO.xlsx): el slot WHATSAPP lo reconoce via el fallback, LLAMADAS queda ausente', () => {
  const nombresHojas = ['DATA'];
  const aoaData = leerHojaXlsxComoAoA(FIXTURE_TRAFICO_WPP, 'DATA');
  const canalData = cargasDetectarCanalTrafico(aoaData[0], traficoColIndexMap, traficoWppColIndexMap);
  assert.equal(canalData, 'whatsapp');

  const slotLlamadas = { tipo: 'trafico', canalFijo: 'voz', hoja: CARGAS_HOJA_TRAFICO_LLAMADAS, titulo: 'Trafico de Llamadas', filaUnica: false };
  const resLlamadas = cargasResolverHojaTrafico(slotLlamadas, nombresHojas, true, canalData, false);
  assert.deepEqual(resLlamadas, { hojaReal: null, usoData: false });

  const slotWpp = { tipo: 'trafico', canalFijo: 'whatsapp', hoja: CARGAS_HOJA_TRAFICO_WHATSAPP, titulo: 'Trafico de WhatsApp', filaUnica: false };
  const resWpp = cargasResolverHojaTrafico(slotWpp, nombresHojas, true, canalData, false);
  assert.deepEqual(resWpp, { hojaReal: 'DATA', usoData: true });

  const rWpp = cargasProcesarHoja(slotWpp, aoaData, {}, parseTraficoAuto);
  assert.equal(rWpp.error, undefined);
  assert.equal(rWpp.canal, 'whatsapp');
  assert.equal(rWpp.filas.length, 5);
  assert.equal(rWpp.filas[0].colaWhatsapp, 'WHATSAPP FONOAUDIOLOGIA');
});

// ── Hoja con encabezados mal escritos -- error claro, nada se guarda ────
test('LLAMADAS con encabezados mal escritos: error claro, cero filas -- nada se guarda de esa hoja', () => {
  const aoaMalo = [
    ['SKILL', 'FECHA', 'TOTAL'], // nombres incorrectos, ninguno coincide con TRAFICO_COLUMNAS
    ['CALL INBOUND ORLANT 3P', '2026-08-01', 100],
  ];
  const r = cargasProcesarHoja(
    { tipo: 'trafico', canalFijo: 'voz', hoja: CARGAS_HOJA_TRAFICO_LLAMADAS, titulo: 'Trafico de Llamadas', filaUnica: false },
    aoaMalo, {}, parseTraficoAuto
  );
  assert.ok(r.error, 'debe rechazar la hoja con un error, no guardar nada a medias');
  assert.match(r.error, /Faltan columnas obligatorias/);
  assert.equal(r.filas, undefined);
});

test('WHATSAPP con encabezados mal escritos: error claro, cero filas', () => {
  const aoaMalo = [
    ['COLA', 'INICIO', 'FIN'],
    ['WHATSAPP ORLANT 3P', '2026-08-01', '2026-08-31'],
  ];
  const r = cargasProcesarHoja(
    { tipo: 'trafico', canalFijo: 'whatsapp', hoja: CARGAS_HOJA_TRAFICO_WHATSAPP, titulo: 'Trafico de WhatsApp', filaUnica: false },
    aoaMalo, {}, parseTraficoAuto
  );
  assert.ok(r.error);
  assert.equal(r.filas, undefined);
});
