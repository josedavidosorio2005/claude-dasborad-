// cargas-logic-fase77-tipificacion.test.js — cubre el aporte de la Fase 77
// (ORLANT, pedido de Edwin/Jairo) a cargasPlanConsolidado/cargasProcesarHoja
// (public/js/cargas-logic.js): 2 hojas nuevas (TIPIFICACION_LLAMADAS/
// TIPIFICACION_WHATSAPP) que REEMPLAZAN el panel del dashboard que antes
// leia la hoja vieja "tipificacion" -- pero esa hoja vieja sigue existiendo
// en el plan (compatibilidad hacia atras: un archivo viejo con esa hoja
// sigue cargando exactamente igual). Datos SIEMPRE inventados.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargasPlanConsolidado, cargasProcesarHoja, CARGAS_HOJA_TIPIFICACION_LLAMADAS, CARGAS_HOJA_TIPIFICACION_WHATSAPP } = require('../../public/js/cargas-logic.js');
const { TIPIFICACION_COLUMNAS } = require('../../public/js/tipificacion-logic.js');

// Forma minima de `secciones` que trae GET /dashboard/secciones/:cliente --
// incluye la hoja vieja "tipificacion" (minuscula) tal cual la trae
// dashboard-secciones.js para ORLANT, para probar que sigue en el plan.
const SECCIONES_ORLANT = {
  tipificacion: {
    titulo: 'Tipificacion (Llamada 3P y General)',
    descripcion: 'Una fila por tipificacion y linea, con la cantidad del mes.',
    cadencia: 'mensual', periodo: 'mes', filaUnica: false,
    columnas: [
      { key: 'linea', label: 'Linea (3P / GENERAL)', tipo: 'texto' },
      { key: 'tipificacion', label: 'Tipificacion', tipo: 'texto' },
      { key: 'cantidad', label: 'Cantidad', tipo: 'entero' },
    ],
  },
};

function tipificacionCols(){
  return TIPIFICACION_COLUMNAS.map((c) => ({ label: c.label, opcional: !c.obligatoria }));
}

test('cargasPlanConsolidado: sin tipificacionCols (resto de campanas) -> solo la hoja vieja "tipificacion", nada nuevo', () => {
  const plan = cargasPlanConsolidado(SECCIONES_ORLANT, null, [], null, null, null);
  const nuevas = plan.filter((h) => h.tipo === 'tipificacion');
  assert.equal(nuevas.length, 0);
  const vieja = plan.find((h) => h.hoja === 'tipificacion');
  assert.ok(vieja, 'la hoja vieja "tipificacion" (seccion generica) sigue en el plan');
  assert.equal(vieja.tipo, 'seccion');
});

test('cargasPlanConsolidado: con tipificacionCols (ORLANT) -> agrega las 2 hojas nuevas ADEMAS de la vieja', () => {
  const plan = cargasPlanConsolidado(SECCIONES_ORLANT, null, [], null, null, tipificacionCols());

  const vieja = plan.find((h) => h.hoja === 'tipificacion');
  assert.ok(vieja, 'la hoja vieja sigue en el plan -- compatibilidad hacia atras, un archivo viejo sigue cargando igual');
  assert.equal(vieja.tipo, 'seccion');

  const llamadas = plan.find((h) => h.hoja === CARGAS_HOJA_TIPIFICACION_LLAMADAS);
  const whatsapp = plan.find((h) => h.hoja === CARGAS_HOJA_TIPIFICACION_WHATSAPP);
  assert.ok(llamadas, 'debe existir la hoja TIPIFICACION_LLAMADAS');
  assert.ok(whatsapp, 'debe existir la hoja TIPIFICACION_WHATSAPP');
  assert.equal(llamadas.tipo, 'tipificacion');
  assert.equal(whatsapp.tipo, 'tipificacion');
  assert.equal(llamadas.canalTipificacion, 'LLAMADAS');
  assert.equal(whatsapp.canalTipificacion, 'WHATSAPP');

  // Las columnas son EXACTAS a TIPIFICACION_COLUMNAS (AGENT_NAME, DATE,
  // HORA, TIME_MIN, DESCRIPTION_COD_ACT, SKILL_NAME) en las 2 hojas.
  assert.deepEqual(llamadas.columnas.map((c) => c.label), TIPIFICACION_COLUMNAS.map((c) => c.label));
  assert.deepEqual(whatsapp.columnas.map((c) => c.label), TIPIFICACION_COLUMNAS.map((c) => c.label));

  // WhatsApp trae la nota del cruce de codigo de cola -> nombre real (Wolkvox).
  assert.ok(whatsapp.notasExtra.some((n) => /BUSCARV|VLOOKUP/.test(n)), 'debe explicar el cruce de codigo de cola con BUSCARV/VLOOKUP');
  assert.ok(!llamadas.notasExtra.some((n) => /BUSCARV|VLOOKUP/.test(n)), 'esa nota es solo de WhatsApp, no de Llamadas');
});

test('cargasProcesarHoja: hoja AUSENTE (ej. pegado en una hoja llamada "DATA") dice EXACTAMENTE el nombre de hoja correcto', () => {
  const plan = cargasPlanConsolidado(SECCIONES_ORLANT, null, [], null, null, tipificacionCols());
  const llamadas = plan.find((h) => h.hoja === CARGAS_HOJA_TIPIFICACION_LLAMADAS);
  const r = cargasProcesarHoja(llamadas, null, undefined, () => ({ error: 'no deberia llamarse' }), ['DATA', 'AGENDAS']);
  assert.ok(r.error, 'debe fallar con un error de hoja ausente');
  assert.match(r.error, /TIPIFICACION_LLAMADAS/, 'el mensaje debe decir exactamente que hoja usar');
  assert.match(r.error, /DATA, AGENDAS/, 'debe listar las hojas que si trae el archivo, para que el usuario vea su error');
});

test('cargasProcesarHoja: propaga canalTipificacion al resultado (lo necesita cargas.js para saber que canal guardar)', () => {
  const plan = cargasPlanConsolidado(SECCIONES_ORLANT, null, [], null, null, tipificacionCols());
  const whatsapp = plan.find((h) => h.hoja === CARGAS_HOJA_TIPIFICACION_WHATSAPP);
  const aoa = [
    ['AGENT_NAME', 'DATE', 'HORA', 'TIME_MIN', 'DESCRIPTION_COD_ACT', 'SKILL_NAME'],
    ['ASESOR DEMO', '2026-08-01', '18:00:00', 2, 'AGENDADA_InConexion', 'WHATSAPP ORLANT 3P'],
  ];
  const ws = {}; // no vacio ni con formula sin valor -- lo unico que cargasHojaVacia/cargasDetectarFormulaSinValor miran es aoa/ws reales; aca basta con que ws sea truthy
  const r = cargasProcesarHoja(whatsapp, aoa, ws, (a) => ({ filas: [{ agente: a[1][0] }], avisos: [] }), []);
  assert.equal(r.canalTipificacion, 'WHATSAPP');
  assert.ok(r.filas);
});
