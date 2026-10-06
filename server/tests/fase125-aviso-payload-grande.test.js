// fase125-aviso-payload-grande.test.js — Fase 125, Parte 1.
//
// Agendas y Tipificacion comparten RUTAS_LIMITE_MAYOR (8mb, server.js) por
// ser las 2 rutas con mas filas por carga. Ese limite es por carga (una
// peticion), no acumulado -- corrige el hallazgo mal planteado de la Fase
// 124 que lo trataba como un margen que se agota mes a mes (ver
// docs/pendientes.md §4). Antes de esta fase, si alguien subia un archivo
// que de verdad superaba el limite (varios meses juntos en un solo .xlsx),
// el aviso solo llegaba despues de mandar todo el body y recibir un 413 del
// servidor. cargasPayloadDemasiadoGrande() deja avisar ANTES de enviar nada,
// con el mismo umbral (85% del limite de la ruta) usado en cargas.js
// (_cargasGuardarAgendas / _cargasGuardarTipificacion). Datos SIEMPRE
// inventados.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  cargasPayloadDemasiadoGrande,
  CARGAS_LIMITE_MAYOR_BYTES,
  CARGAS_MSG_PAYLOAD_GRANDE,
} = require('../../public/js/cargas-logic.js');

test('CARGAS_LIMITE_MAYOR_BYTES coincide con el limite real de la ruta (server.js: 8mb)', () => {
  assert.equal(CARGAS_LIMITE_MAYOR_BYTES, 8 * 1024 * 1024);
});

test('un archivo mensual normal de Agendas (~12.100 filas, medido ~213 bytes/fila) NO dispara el aviso', () => {
  const filas = Array.from({ length: 12100 }, (_, i) => (
    ['ASESOR_' + (i % 20), 'SEDE', 'EXAMEN_' + (i % 19), 'ESPECIALIDAD_' + (i % 19),
      'PROFESIONAL_' + (i % 30), '2026-08-01 08:00:00', 'GENERAL', 'ENTIDAD_' + (i % 15)]
  ));
  const parsed = { campana: 'ORLANT', archivoNombre: 'AGENDAS_AGOSTO_2026.xlsx', filas };
  assert.equal(cargasPayloadDemasiadoGrande(parsed, CARGAS_LIMITE_MAYOR_BYTES), false);
});

test('un archivo que junta varios meses (>85% del limite de 8mb) SI dispara el aviso, antes de enviar nada', () => {
  // Con estos datos sinteticos (~110 bytes/fila; el archivo real de
  // produccion pesa mas por fila, ~213 bytes/fila -- ver docs/pendientes.md
  // §4) hacen falta ~68.000 filas para pasar del 85% de 8mb. El punto del
  // test no es reproducir el bytes/fila real, sino que el umbral SI se
  // dispare antes de llegar al 100% (al servidor) con un archivo grande,
  // como el que resulta de juntar varios meses de Agendas en un .xlsx.
  const filas = Array.from({ length: 68000 }, (_, i) => (
    ['ASESOR_' + (i % 20), 'SEDE', 'EXAMEN_' + (i % 19), 'ESPECIALIDAD_' + (i % 19),
      'PROFESIONAL_' + (i % 30), '2026-08-01 08:00:00', 'GENERAL', 'ENTIDAD_' + (i % 15)]
  ));
  const parsed = { campana: 'ORLANT', archivoNombre: 'AGENDAS_VARIOS_MESES.xlsx', filas };
  assert.equal(cargasPayloadDemasiadoGrande(parsed, CARGAS_LIMITE_MAYOR_BYTES), true);
});

test('el umbral es el 85% del limite, no el 100% -- un payload que SI cabria en el body de 8mb igual avisa si pasa de 6.8mb', () => {
  // Construye un payload de ~7mb (menor que 8mb, pero mayor que el 85%).
  const relleno = 'X'.repeat(7 * 1024 * 1024);
  const parsed = { campana: 'ORLANT', archivoNombre: relleno, filas: [] };
  assert.equal(cargasPayloadDemasiadoGrande(parsed, CARGAS_LIMITE_MAYOR_BYTES), true);
});

test('CARGAS_MSG_PAYLOAD_GRANDE es un texto claro, sin tecnicismos, y dice que no se guardo nada', () => {
  assert.match(CARGAS_MSG_PAYLOAD_GRANDE, /grande/i);
  assert.match(CARGAS_MSG_PAYLOAD_GRANDE, /no se guard[oó] nada/i);
  assert.doesNotMatch(CARGAS_MSG_PAYLOAD_GRANDE, /413|payload|bytes|json/i);
});
