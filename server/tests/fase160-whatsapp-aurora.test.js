// fase160-whatsapp-aurora-hlm.test.js — Fase 160 (verificacion de Aurora en
// local): Flujo de WhatsApp de un cliente con ese modulo pero sin el resto de
// la plantilla de ORLANT se rechazaba con "No se encontro la hoja DATA" (su
// unica hoja de Trafico solo reconocia columnas de voz). Ahora todo cliente
// con Flujo de WhatsApp usa Trafico en 2 hojas (LLAMADAS/WHATSAPP), con las
// mismas columnas que ORLANT; el resto (Agendas, Inasistencia...) sigue solo
// para ORLANT.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const XLSX = require('../../public/js/vendor/xlsx-0.20.3.full.min.js');
const CL = require('../../public/js/cargas-logic.js');
const { REGISTRO_CLIENTES, derivarListasRegistro } = require('../../public/js/registro-clientes.js');

const RAIZ = path.join(__dirname, '..', '..');
const AURORA = { nombre: 'CLINICA AURORA', modulos: ['flujo_llamadas', 'flujo_whatsapp', 'calidad'],
  parametros: { sedes: [], asesorVisibleCliente: false, traficoDosHojas: false, especificos: [] }, logo: null };

test('Aurora (Flujo de WhatsApp sin la plantilla de ORLANT) va con Trafico en 2 hojas; MOBILIZE no cambia', () => {
  const l = derivarListasRegistro(REGISTRO_CLIENTES.concat([AURORA]));
  assert.deepEqual(l.traficoWhatsapp, ['ORLANT', 'CLINICA AURORA']);
  assert.deepEqual(l.traficoUnificado, ['ORLANT'], 'Agendas, Inasistencia, etc. siguen solo para ORLANT');
  assert.ok(!l.traficoWhatsapp.includes('MOBILIZE'));
  const js = fs.readFileSync(path.join(RAIZ, 'public', 'js', 'cargas.js'), 'utf8');
  assert.match(js, /var dosHojasTrafico = esUnificado \|\| LISTAS_REGISTRO\.traficoWhatsapp\.indexOf\(cliente\) !== -1;/);
  assert.match(js, /var traficoWpp = dosHojasTrafico \?/);
  assert.match(js, /var agendasCols = esUnificado \?/);
});

test('la plantilla oficial de Flujo de WhatsApp trae la hoja que el plan de 2 hojas busca por nombre', () => {
  const wb = XLSX.read(fs.readFileSync(path.join(RAIZ, 'server', 'plantillas', 'PLANTILLA_FLUJO_WHATSAPP.xlsx')));
  assert.equal(wb.SheetNames[0], CL.CARGAS_HOJA_TRAFICO_WHATSAPP);
});
