// texto-formato-logic.test.js — cubre public/js/texto-formato-logic.js
// (Fase 87, tema C: "unificar tipo de letra / letra capital"). Corre la
// MISMA logica que usa el navegador para formatear nombres que vienen de
// los datos (skills, colas, tipificaciones, especialidades, sedes,
// asesores) para MOSTRARLOS -- nunca toca el valor original.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  textoFormatoNombre,
  TEXTO_SIGLAS,
  TEXTO_ESPECIALES,
  TEXTO_FUENTE,
  TEXTO_CONFIG,
} = require('../../public/js/texto-formato-logic.js');

test('ejemplos EXACTOS del pedido: mayuscula inicial por palabra, siglas intactas, "WhatsApp" con su propia capitalizacion', () => {
  assert.equal(textoFormatoNombre('CALL INBOUND ORLANT 3P'), 'Call Inbound ORLANT 3P');
  assert.equal(textoFormatoNombre('AGENDADA InConexion'), 'Agendada InConexion');
  assert.equal(textoFormatoNombre('NO CONTESTAN'), 'No Contestan');
});

test('"_" se lee como espacio', () => {
  assert.equal(textoFormatoNombre('WHATSAPP_ORLANT_3P'), 'WhatsApp ORLANT 3P');
  assert.equal(textoFormatoNombre('no_contestan'), 'No Contestan');
});

test('siglas de la lista CERRADA se quedan en mayusculas sin importar como vengan', () => {
  TEXTO_SIGLAS.forEach((sigla) => {
    assert.equal(textoFormatoNombre(sigla.toLowerCase()), sigla, `"${sigla}" debe quedar en mayusculas`);
  });
});

test('WhatsApp/InConexion se reconocen sin importar mayusculas/minusculas de entrada', () => {
  assert.equal(textoFormatoNombre('whatsapp'), 'WhatsApp');
  assert.equal(textoFormatoNombre('WHATSAPP'), 'WhatsApp');
  assert.equal(textoFormatoNombre('WhatsApp'), 'WhatsApp');
  assert.equal(textoFormatoNombre('inconexion'), 'InConexion');
  assert.equal(textoFormatoNombre('INCONEXION'), 'InConexion');
});

test('palabras normales: solo la primera letra en mayuscula, el resto en minuscula (no respeta MAYUSCULAS de origen)', () => {
  assert.equal(textoFormatoNombre('FONOAUDIOLOGIA'), 'Fonoaudiologia');
  assert.equal(textoFormatoNombre('audifonos'), 'Audifonos');
});

test('null/undefined/vacio no truenan -- se devuelven tal cual (o vacio)', () => {
  assert.equal(textoFormatoNombre(null), null);
  assert.equal(textoFormatoNombre(undefined), undefined);
  assert.equal(textoFormatoNombre(''), '');
  assert.equal(textoFormatoNombre('   '), '');
});

test('espacios multiples se colapsan a uno solo', () => {
  assert.equal(textoFormatoNombre('CALL   INBOUND    3P'), 'Call Inbound 3P');
});

test('numeros sueltos (no en la lista de siglas) no truenan', () => {
  assert.equal(textoFormatoNombre('SEDE 33'), 'Sede 33');
});

test('TEXTO_CONFIG.modoMayusculas: cambiar UN solo interruptor pone todo en mayusculas (pedido explicito del jefe, si aplica)', () => {
  assert.equal(TEXTO_CONFIG.modoMayusculas, false, 'hoy el modo por defecto es mayuscula inicial');
  try {
    TEXTO_CONFIG.modoMayusculas = true;
    assert.equal(textoFormatoNombre('call inbound orlant 3p'), 'CALL INBOUND ORLANT 3P');
    assert.equal(textoFormatoNombre('agendada_inconexion'), 'AGENDADA INCONEXION');
  } finally {
    TEXTO_CONFIG.modoMayusculas = false; // no debe afectar las demas pruebas de este archivo
  }
});

test('TEXTO_FUENTE: fuente unica, la misma familia que --font-sans (styles.css) para HTML y Chart.js', () => {
  assert.equal(typeof TEXTO_FUENTE, 'string');
  assert.ok(TEXTO_FUENTE.indexOf('Segoe UI') !== -1);
});

test('TEXTO_ESPECIALES: lista CERRADA -- si se agrega una marca nueva con capitalizacion propia, se agrega aqui a proposito', () => {
  assert.deepEqual(Object.keys(TEXTO_ESPECIALES).sort(), ['INCONEXION', 'WHATSAPP']);
});
