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
const { cargasEncabezadosCoinciden } = require('../../public/js/cargas-logic.js');
const { AGENDAS_COLUMNAS } = require('../../public/js/agendas-logic.js');
const { TIPIFICACION_COLUMNAS } = require('../../public/js/tipificacion-logic.js');
const { EFECTIVIDAD_AGENDAMIENTO_COLUMNAS } = require('../../public/js/efectividad-agendamiento-logic.js');

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
