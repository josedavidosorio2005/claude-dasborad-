// cargas-logic-fase79-reconocimiento-encabezados.test.js — Fase 79 (bug
// real de produccion): los archivos ORIGINALES de Edwin (AGENDAS.xlsx,
// BASE_PARA_TORTAS_DE_TIPIFICACION.xlsx) traen la hoja "DATA", nunca
// "AGENDAS"/"TIPIFICACION_LLAMADAS" -- cargasEncabezadosCoinciden
// (public/js/cargas-logic.js) es la pieza PURA de esa deteccion: dado un
// header ya leido, dice si calza con el formato de un plan (todas las
// columnas OBLIGATORIAS presentes, por nombre normalizado). La
// orquestacion real (elegir CUAL hoja de un workbook usar) vive en
// cargas.js (DOM/XLSX real) y se verifica con Playwright, no aqui. Datos
// SIEMPRE inventados.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargasEncabezadosCoinciden, cargasDetectarCanalTrafico } = require('../../public/js/cargas-logic.js');
const { AGENDAS_COLUMNAS } = require('../../public/js/agendas-logic.js');
const { TIPIFICACION_COLUMNAS } = require('../../public/js/tipificacion-logic.js');
const { EFECTIVIDAD_AGENDAMIENTO_COLUMNAS } = require('../../public/js/efectividad-agendamiento-logic.js');
const { CITAS_ATENDIDAS_COLUMNAS } = require('../../public/js/citas-atendidas-logic.js');
const { traficoColIndexMap } = require('../../public/js/trafico-logic.js');
const { traficoWppColIndexMap } = require('../../public/js/trafico-whatsapp-logic.js');

function comoColumnasPlan(columnas) {
  return columnas.map((c) => ({ label: c.label, opcional: !c.obligatoria }));
}

test('cargasEncabezadosCoinciden: hoja "DATA" con las 8 columnas exactas de Agendas (archivo real de Edwin) calza', () => {
  const header = ['NOMBRE DE AGENTE', 'SEDE', 'NOMBRE_EXAMEN', 'ESPECIALIDAD', 'PROFESIONAL', 'FECHA_SOLICITUD', 'TIPO DE LINEA', 'NOMBRE_ENTIDAD'];
  assert.ok(cargasEncabezadosCoinciden(header, comoColumnasPlan(AGENDAS_COLUMNAS)));
});

test('cargasEncabezadosCoinciden: falta una columna obligatoria de Agendas -> no calza', () => {
  const header = ['NOMBRE DE AGENTE', 'SEDE', 'NOMBRE_EXAMEN', 'ESPECIALIDAD', 'PROFESIONAL', 'TIPO DE LINEA', 'NOMBRE_ENTIDAD']; // sin FECHA_SOLICITUD
  assert.ok(!cargasEncabezadosCoinciden(header, comoColumnasPlan(AGENDAS_COLUMNAS)));
});

test('cargasEncabezadosCoinciden: la columna OPCIONAL de Agendas (NOMBRE_ENTIDAD) puede faltar y aun asi calza', () => {
  const header = ['NOMBRE DE AGENTE', 'SEDE', 'NOMBRE_EXAMEN', 'ESPECIALIDAD', 'PROFESIONAL', 'FECHA_SOLICITUD', 'TIPO DE LINEA'];
  assert.ok(cargasEncabezadosCoinciden(header, comoColumnasPlan(AGENDAS_COLUMNAS)));
});

test('cargasEncabezadosCoinciden: orden de columnas no importa, ni mayusculas/espacios', () => {
  const header = ['  tipo de linea  ', 'NOMBRE_EXAMEN', 'Nombre De Agente', 'Sede', 'especialidad', 'profesional', 'fecha_solicitud'];
  assert.ok(cargasEncabezadosCoinciden(header, comoColumnasPlan(AGENDAS_COLUMNAS)));
});

test('cargasEncabezadosCoinciden: una hoja totalmente distinta (ej. "GRAFICA", un pivote) nunca calza con ningun formato', () => {
  const headerGrafica = ['Tipificacion', 'Cantidad', '% del total'];
  assert.ok(!cargasEncabezadosCoinciden(headerGrafica, comoColumnasPlan(AGENDAS_COLUMNAS)));
  assert.ok(!cargasEncabezadosCoinciden(headerGrafica, comoColumnasPlan(TIPIFICACION_COLUMNAS)));
});

test('cargasEncabezadosCoinciden: hoja "DATA" con las 6 columnas de Tipificacion (archivo real de Edwin) calza', () => {
  const header = ['AGENT_NAME', 'DATE', 'HORA', 'TIME_MIN', 'DESCRIPTION_COD_ACT', 'SKILL_NAME', 'MES'];
  assert.ok(cargasEncabezadosCoinciden(header, comoColumnasPlan(TIPIFICACION_COLUMNAS)));
});

test('cargasEncabezadosCoinciden: MES (formula de Excel) es opcional -- sin esa columna tambien calza', () => {
  const header = ['AGENT_NAME', 'DATE', 'HORA', 'TIME_MIN', 'DESCRIPTION_COD_ACT', 'SKILL_NAME'];
  assert.ok(cargasEncabezadosCoinciden(header, comoColumnasPlan(TIPIFICACION_COLUMNAS)));
});

test('cargasEncabezadosCoinciden: sin HORA/TIME_MIN (opcionales) tambien calza -- solo las 4 obligatorias importan', () => {
  const header = ['AGENT_NAME', 'DATE', 'DESCRIPTION_COD_ACT', 'SKILL_NAME'];
  assert.ok(cargasEncabezadosCoinciden(header, comoColumnasPlan(TIPIFICACION_COLUMNAS)));
});

test('cargasEncabezadosCoinciden: falta SKILL_NAME (obligatoria) -> no calza', () => {
  const header = ['AGENT_NAME', 'DATE', 'HORA', 'TIME_MIN', 'DESCRIPTION_COD_ACT'];
  assert.ok(!cargasEncabezadosCoinciden(header, comoColumnasPlan(TIPIFICACION_COLUMNAS)));
});

test('cargasEncabezadosCoinciden: encabezado vacio o ausente -> no calza (nunca revienta)', () => {
  assert.ok(!cargasEncabezadosCoinciden([], comoColumnasPlan(AGENDAS_COLUMNAS)));
  assert.ok(!cargasEncabezadosCoinciden(null, comoColumnasPlan(AGENDAS_COLUMNAS)));
  assert.ok(!cargasEncabezadosCoinciden(undefined, comoColumnasPlan(TIPIFICACION_COLUMNAS)));
});

// Nota importante (pedido explicito): Tipificacion de WhatsApp comparte
// EXACTAMENTE los mismos encabezados que Llamadas -- por diseno, la
// deteccion por encabezados SOLO se activa para el slot LLAMADAS (ver el
// gate `h.tipo==='tipificacion' && h.canalTipificacion==='LLAMADAS'` en
// cargas.js, _cargasBuscarHojaPorEncabezados). Como cargasEncabezadosCoinciden
// es una funcion generica (no sabe de "canal"), la misma hoja "DATA" de
// tipificacion SI calza contra las columnas de Tipificacion sin importar el
// canal -- lo que impide la ambiguedad es la orquestacion en cargas.js, no
// esta funcion. Se deja constancia aqui para que quede explicito el
// contrato: esta funcion NUNCA debe usarse sola para decidir el canal.
test('cargasEncabezadosCoinciden: (nota) el mismo header de tipificacion calza igual sin importar el canal -- el canal lo decide cargas.js, no esta funcion', () => {
  const header = ['AGENT_NAME', 'DATE', 'HORA', 'TIME_MIN', 'DESCRIPTION_COD_ACT', 'SKILL_NAME'];
  assert.ok(cargasEncabezadosCoinciden(header, comoColumnasPlan(TIPIFICACION_COLUMNAS)));
});

// Fase 111 (ORLANT, pedido textual de Edwin): el archivo real de
// EFECTIVIDAD_AGENDAMIENTO trae su unica hoja llamada "Hoja1" (nunca
// "EFECTIVIDAD_AGENDAMIENTO") -- mismo caso que AGENDAS/TIPIFICACION, el
// reconocimiento por encabezados es lo que rescata el archivo tal cual.
test('cargasEncabezadosCoinciden: hoja "Hoja1" con las 4 columnas obligatorias de Efectividad de Agendamiento (archivo real de Edwin) calza', () => {
  const header = ['NOMBRE DE AGENTE', 'MES', 'CANTIDAD DE GESTIONES', 'AGENDAS', 'EFECTIVIDAD'];
  assert.ok(cargasEncabezadosCoinciden(header, comoColumnasPlan(EFECTIVIDAD_AGENDAMIENTO_COLUMNAS)));
});

test('cargasEncabezadosCoinciden: Efectividad de Agendamiento sin la columna EFECTIVIDAD (opcional, se recalcula) tambien calza', () => {
  const header = ['NOMBRE DE AGENTE', 'MES', 'CANTIDAD DE GESTIONES', 'AGENDAS'];
  assert.ok(cargasEncabezadosCoinciden(header, comoColumnasPlan(EFECTIVIDAD_AGENDAMIENTO_COLUMNAS)));
});

test('cargasEncabezadosCoinciden: falta una columna obligatoria de Efectividad de Agendamiento -> no calza', () => {
  const header = ['NOMBRE DE AGENTE', 'MES', 'AGENDAS']; // sin CANTIDAD DE GESTIONES
  assert.ok(!cargasEncabezadosCoinciden(header, comoColumnasPlan(EFECTIVIDAD_AGENDAMIENTO_COLUMNAS)));
});

// Fase 111 (ORLANT, pedido textual de InCo): el archivo real de
// CITAS_ATENDIDAS tambien trae su unica hoja llamada "Hoja1".
test('cargasEncabezadosCoinciden: hoja "Hoja1" con las 3 columnas obligatorias de Citas Atendidas (archivo real de Edwin) calza', () => {
  const header = ['MES', 'AGENDAS', 'ATENDIDAS', 'EFECTIVIDAD CITAS ATENDIDAS'];
  assert.ok(cargasEncabezadosCoinciden(header, comoColumnasPlan(CITAS_ATENDIDAS_COLUMNAS)));
});

test('cargasEncabezadosCoinciden: Citas Atendidas sin la columna EFECTIVIDAD CITAS ATENDIDAS (opcional, se recalcula) tambien calza', () => {
  const header = ['MES', 'AGENDAS', 'ATENDIDAS'];
  assert.ok(cargasEncabezadosCoinciden(header, comoColumnasPlan(CITAS_ATENDIDAS_COLUMNAS)));
});

test('cargasEncabezadosCoinciden: falta una columna obligatoria de Citas Atendidas -> no calza', () => {
  const header = ['MES', 'AGENDAS']; // sin ATENDIDAS
  assert.ok(!cargasEncabezadosCoinciden(header, comoColumnasPlan(CITAS_ATENDIDAS_COLUMNAS)));
});

// Fase 115 (ORLANT, archivo real de Edwin ago-sep/2026): Trafico de
// Llamadas tambien llega con su unica hoja llamada "Hoja1" (nunca
// "LLAMADAS" ni "DATA") -- mismo caso real que Efectividad de
// Agendamiento/Citas Atendidas arriba. A diferencia de Tipificacion
// (Llamadas/WhatsApp SI comparten encabezados), las columnas obligatorias
// de Trafico Llamadas (SKILL_NAME/DATE/TOTAL LLAMADAS/LLAMADAS CONTESTADAS)
// y WhatsApp (NOMBRE_COLA_WHATSAPP/FECHA INICIO/FECHA FIN/TOTAL WHATSAPP/
// WHATSAPP CONTESTADOS) son disjuntas: una hoja de un canal nunca calza con
// las columnas del otro, asi que cargasEncabezadosCoinciden por si sola ya
// alcanza (cargas.js ademas verifica el canal con cargasDetectarCanalTrafico
// como defensa adicional -- ver _cargasBuscarHojaPorEncabezados).
test('cargasEncabezadosCoinciden: hoja "Hoja1" con las columnas exactas de Trafico de Llamadas (archivo real de Edwin, ago-sep/2026) calza', () => {
  const header = ['SKILL_NAME', 'DATE', 'TOTAL LLAMADAS', 'LLAMADAS CONTESTADAS', 'LLAMADAS ABANDONADAS',
    'SERVICE_LEVEL_10SEC', 'SERVICE_LEVEL_20SEC', 'SERVICE_LEVEL_30SEC', 'ABANDON', 'ASA', 'ATA', 'WAIT_TIME', 'AHT'];
  const columnasLlamadas = [
    { label: 'SKILL_NAME', opcional: false },
    { label: 'DATE', opcional: false },
    { label: 'TOTAL LLAMADAS', opcional: false },
    { label: 'LLAMADAS CONTESTADAS', opcional: false },
  ];
  assert.ok(cargasEncabezadosCoinciden(header, columnasLlamadas));
  // y el canal detectado para esa hoja es 'voz' -- nunca se confundiria con
  // el slot de Trafico de WhatsApp (canalFijo distinto).
  assert.equal(cargasDetectarCanalTrafico(header, traficoColIndexMap, traficoWppColIndexMap), 'voz');
});

test('cargasEncabezadosCoinciden: columnas de Trafico de Llamadas nunca calzan contra las (disjuntas) de Trafico de WhatsApp', () => {
  const headerLlamadas = ['SKILL_NAME', 'DATE', 'TOTAL LLAMADAS', 'LLAMADAS CONTESTADAS'];
  const columnasWhatsapp = [
    { label: 'NOMBRE_COLA_WHATSAPP', opcional: false },
    { label: 'FECHA INICIO', opcional: false },
    { label: 'FECHA FIN', opcional: false },
    { label: 'TOTAL WHATSAPP', opcional: false },
    { label: 'WHATSAPP CONTESTADOS', opcional: false },
  ];
  assert.ok(!cargasEncabezadosCoinciden(headerLlamadas, columnasWhatsapp));
});
