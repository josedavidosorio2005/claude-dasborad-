// cargas-logic-fase84-plantilla-orlant.test.js — cubre que la plantilla
// DESCARGABLE de ORLANT trae una hoja por cada tipo de dato que el cargador
// acepta hoy, con los encabezados EXACTOS que el cargador espera (mismo
// texto/orden que agendas-logic.js/tipificacion-logic.js, la fuente real
// que usa el parseo al subir), y en el orden pedido (Trafico+Tipificacion+
// Agendas primero). Si a futuro alguien agrega un tipo de dato nuevo al
// plan de ORLANT (cargasPlanConsolidado) y se olvida de la plantilla, la
// prueba "hojasEsperadas === plan sin filtrar" de mas abajo debe fallar --
// ver esa prueba para el detalle de por que. Datos SIEMPRE inventados.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  cargasPlanConsolidado,
  cargasPlanOrdenParaDescarga,
  cargasPlanSinTipificacionSuperada,
  CARGAS_HOJA_TRAFICO_LLAMADAS,
  CARGAS_HOJA_TRAFICO_WHATSAPP,
  CARGAS_HOJA_TIPIFICACION_LLAMADAS,
  CARGAS_HOJA_TIPIFICACION_WHATSAPP,
  CARGAS_HOJA_AGENDAS,
  CARGAS_HOJA_CALIDAD,
} = require('../../public/js/cargas-logic.js');
const { AGENDAS_COLUMNAS } = require('../../public/js/agendas-logic.js');
const { TIPIFICACION_COLUMNAS } = require('../../public/js/tipificacion-logic.js');

// Misma forma vieja de SECCIONES.ORLANT (resumen/salida/tipificacion vieja/
// sta_categorias) que ya usan las demas pruebas de este archivo -- la real
// (dashboard-secciones.js) trae mas columnas, pero para esta prueba solo
// importan los NOMBRES de hoja, no el detalle de cada columna.
const SECCIONES_ORLANT = {
  resumen: { titulo: 'Resumen', cadencia: 'mensual', periodo: 'mes', filaUnica: true, columnas: [{ key: 'x', label: 'X', tipo: 'entero' }] },
  salida: { titulo: 'Salida', cadencia: 'diaria', periodo: 'mes', filaUnica: false, columnas: [{ key: 'fecha', label: 'Fecha', tipo: 'fecha' }] },
  tipificacion: { titulo: 'Tipificacion vieja', cadencia: 'mensual', periodo: 'mes', filaUnica: false, columnas: [{ key: 'linea', label: 'Linea', tipo: 'texto' }] },
  sta_categorias: { titulo: 'STA', cadencia: 'mensual', periodo: 'mes', filaUnica: false, columnas: [{ key: 'dimension', label: 'Dimension', tipo: 'texto' }] },
};

function agendasCols() {
  return AGENDAS_COLUMNAS.map((c) => ({ label: c.label, opcional: !c.obligatoria }));
}
function tipificacionCols() {
  return TIPIFICACION_COLUMNAS.map((c) => ({ label: c.label, opcional: !c.obligatoria }));
}
// Mismo shape que _cargasTraficoLlamadasColumnasUnificado/
// _cargasTraficoWhatsappColumnasUnificado (cargas.js) -- el detalle exacto
// de estas 2 no es lo nuevo de esta fase, solo importa que EXISTAN.
const traficoLlamadasCols = () => [{ label: 'SKILL_NAME' }, { label: 'DATE' }, { label: 'TOTAL LLAMADAS' }, { label: 'LLAMADAS CONTESTADAS' }];
const traficoWppCols = () => [{ label: 'NOMBRE_COLA_WHATSAPP' }, { label: 'FECHA INICIO' }, { label: 'FECHA FIN' }, { label: 'TOTAL WHATSAPP' }, { label: 'WHATSAPP CONTESTADOS' }];
const calidadCols = () => [{ key: 'asesor', label: 'ASESOR' }, { key: 'fecha', label: 'FECHA' }];

function planOrlantCompleto() {
  return cargasPlanConsolidado(SECCIONES_ORLANT, calidadCols(), traficoLlamadasCols(), traficoWppCols(), agendasCols(), tipificacionCols());
}

test('la plantilla descargable de ORLANT trae TODAS las hojas nuevas (Fases 77-78): LLAMADAS, WHATSAPP, TIPIFICACION_LLAMADAS, TIPIFICACION_WHATSAPP, AGENDAS', () => {
  const plan = planOrlantCompleto();
  const descarga = cargasPlanOrdenParaDescarga(plan);
  const hojas = descarga.map((h) => h.hoja);
  for (const esperada of [CARGAS_HOJA_TRAFICO_LLAMADAS, CARGAS_HOJA_TRAFICO_WHATSAPP, CARGAS_HOJA_TIPIFICACION_LLAMADAS, CARGAS_HOJA_TIPIFICACION_WHATSAPP, CARGAS_HOJA_AGENDAS]) {
    assert.ok(hojas.includes(esperada), `falta la hoja "${esperada}" en la plantilla descargable`);
  }
});

test('AGENDAS: los encabezados de la plantilla son EXACTOS a AGENDAS_COLUMNAS (agendas-logic.js, la fuente real que usa el parseo al subir) -- mismo texto y mismo orden', () => {
  const plan = planOrlantCompleto();
  const hojaAgendas = plan.find((h) => h.hoja === CARGAS_HOJA_AGENDAS);
  assert.ok(hojaAgendas, 'la hoja AGENDAS debe existir en el plan de ORLANT');
  const labelsEnPlantilla = hojaAgendas.columnas.map((c) => c.label);
  const labelsEsperados = AGENDAS_COLUMNAS.map((c) => c.label);
  assert.deepEqual(labelsEnPlantilla, labelsEsperados);
});

test('TIPIFICACION_LLAMADAS y TIPIFICACION_WHATSAPP: los encabezados son EXACTOS a TIPIFICACION_COLUMNAS -- mismo texto y mismo orden en las 2 hojas', () => {
  const plan = planOrlantCompleto();
  const labelsEsperados = TIPIFICACION_COLUMNAS.map((c) => c.label);
  for (const hoja of [CARGAS_HOJA_TIPIFICACION_LLAMADAS, CARGAS_HOJA_TIPIFICACION_WHATSAPP]) {
    const h = plan.find((x) => x.hoja === hoja);
    assert.ok(h, `la hoja ${hoja} debe existir en el plan de ORLANT`);
    assert.deepEqual(h.columnas.map((c) => c.label), labelsEsperados, `encabezados de ${hoja} no coinciden con TIPIFICACION_COLUMNAS`);
  }
});

test('orden de descarga: Trafico + Tipificacion + Agendas van primero (en ese orden), el resto despues sin perder ninguna hoja', () => {
  const plan = planOrlantCompleto();
  const descarga = cargasPlanOrdenParaDescarga(plan);
  const hojas = descarga.map((h) => h.hoja);
  const primeras5 = hojas.slice(0, 5);
  assert.deepEqual(primeras5, [
    CARGAS_HOJA_TRAFICO_LLAMADAS, CARGAS_HOJA_TRAFICO_WHATSAPP,
    CARGAS_HOJA_TIPIFICACION_LLAMADAS, CARGAS_HOJA_TIPIFICACION_WHATSAPP,
    CARGAS_HOJA_AGENDAS,
  ]);
  // Nada se pierde en el reordenamiento, salvo la hoja vieja "tipificacion"
  // (superada, ver la prueba de abajo) -- el resto de hojas del plan
  // original (resumen/salida/sta_categorias/Calidad) siguen presentes.
  const hojasPlanOriginal = plan.map((h) => h.hoja).filter((h) => h !== 'tipificacion');
  for (const h of hojasPlanOriginal) {
    assert.ok(hojas.includes(h), `la hoja "${h}" del plan original se perdio al ordenar para descarga`);
  }
});

test('la hoja vieja "tipificacion" (minuscula, anterior a la Fase 77) se quita de la plantilla DESCARGABLE cuando el sistema nuevo esta presente -- pero el cargador la sigue aceptando (el PLAN real no se toca)', () => {
  const plan = planOrlantCompleto();
  assert.ok(plan.some((h) => h.hoja === 'tipificacion'), 'el plan real (lo que acepta el cargador) sigue trayendo la hoja vieja');
  const descarga = cargasPlanOrdenParaDescarga(plan);
  assert.ok(!descarga.some((h) => h.hoja === 'tipificacion'), 'la plantilla descargable ya no debe ofrecer la hoja vieja superada');
});

test('cargasPlanSinTipificacionSuperada: si el sistema nuevo NO esta presente (otros clientes), la hoja vieja "tipificacion" NO se quita', () => {
  const planSinNuevo = cargasPlanConsolidado(SECCIONES_ORLANT, null, [], null, null, null);
  const resultado = cargasPlanSinTipificacionSuperada(planSinNuevo);
  assert.ok(resultado.some((h) => h.hoja === 'tipificacion'), 'sin el sistema nuevo, la hoja vieja sigue siendo el unico mecanismo -- nunca se quita');
});

// Fase 84: esta es la prueba que "falla si a futuro alguien agrega un tipo
// de dato y olvida ponerlo en la plantilla" -- lista EXACTA y cerrada de
// las hojas que la plantilla descargable de ORLANT debe traer hoy. Si una
// fase futura agrega un tipo de dato nuevo a cargasPlanConsolidado (ej. una
// hoja "ENCUESTAS"), este plan de prueba la recogera automaticamente (viene
// de las mismas columnas que se le pasan arriba) y esta prueba EMPEZARA A
// FALLAR porque la hoja nueva no esta en `ESPERADAS` -- la correccion es
// agregarla aqui A PROPOSITO, nunca borrar la prueba.
test('lista CERRADA de hojas que la plantilla descargable de ORLANT debe traer hoy (falla si se agrega un tipo de dato nuevo y no se actualiza esta lista)', () => {
  const plan = planOrlantCompleto();
  const descarga = cargasPlanOrdenParaDescarga(plan);
  const ESPERADAS = [
    CARGAS_HOJA_TRAFICO_LLAMADAS, CARGAS_HOJA_TRAFICO_WHATSAPP,
    CARGAS_HOJA_TIPIFICACION_LLAMADAS, CARGAS_HOJA_TIPIFICACION_WHATSAPP,
    CARGAS_HOJA_AGENDAS,
    'resumen', 'salida', 'sta_categorias',
    CARGAS_HOJA_CALIDAD,
  ];
  assert.deepEqual(descarga.map((h) => h.hoja), ESPERADAS);
});
