// fase122-cargas-tipificacion-labelalt.test.js — Fase 122 (HALLAZGO GRAVE,
// confirmado contra produccion real): _cargasTipificacionColumnasUnificado
// (cargas.js) nunca copiaba `labelAlt` al armar las columnas del plan de
// carga -- la columna `skill` de TIPIFICACION_COLUMNAS gano
// `labelAlt: ['NOMBRE DE SKILL']` en la Parte 1.1 de esta fase (export
// HistChat de WhatsApp, que no trae SKILL_NAME), pero
// cargasEncabezadosCoinciden (cargas-logic.js) nunca llegaba a verlo: el
// reconocimiento por encabezados de Tipificacion de WhatsApp SIEMPRE
// fallaba en la pagina real (_cargasResultados quedaba vacio, sin ningun
// error visible), aunque las pruebas unitarias de tipificacionColIndexMap/
// cargasDetectarCanalTipificacion (que no pasan por esta funcion) seguian
// en verde.
//
// cargas.js es un archivo SOLO NAVEGADOR (sin modo doble, sin
// module.exports): requerirlo en Node exige stubs minimos de `document`
// (un solo addEventListener de nivel de archivo) y de los globals que
// normalmente cargan los <script> anteriores en index.html (TIPIFICACION_COLUMNAS).
// Esta es la UNICA forma de que este hallazgo quede cubierto por una
// prueba automatica -- antes de esta fase, cargas.js no tenia ninguna.
'use strict';
const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { TIPIFICACION_COLUMNAS } = require(path.join('..', '..', 'public', 'js', 'tipificacion-logic.js'));
const { cargasEncabezadosCoinciden, cargasDetectarCanalTipificacion } = require(path.join('..', '..', 'public', 'js', 'cargas-logic.js'));

// cargas.js es SOLO navegador (sin module.exports, sin modo doble) -- se
// evalua con `vm` en un sandbox minimo (mismo mecanismo que un <script>
// cargado en el navegador, sin depender de que cargas.js cambie su forma
// de exportar) y se recupera la funcion por su nombre desde ese scope.
// Stub minimo de `document`: cargas.js tiene UNA sola linea de nivel de
// archivo (fuera de cualquier funcion) que registra un listener del modal.
const vm = require('vm');
const fs = require('fs');
const cargasJsPath = path.join(__dirname, '..', '..', 'public', 'js', 'cargas.js');
const codigo = fs.readFileSync(cargasJsPath, 'utf8');
const sandbox = {
  document: { getElementById: () => ({ addEventListener: () => {} }) },
  TIPIFICACION_COLUMNAS,
  console,
};
vm.createContext(sandbox);
vm.runInContext(codigo, sandbox, { filename: cargasJsPath });

test('HALLAZGO GRAVE: _cargasTipificacionColumnasUnificado SI preserva labelAlt (antes del fix: undefined, el header-fallback de WhatsApp nunca encontraba la hoja)', () => {
  const cols = sandbox._cargasTipificacionColumnasUnificado();
  const colSkill = cols.find((c) => c.label === 'SKILL_NAME');
  assert.ok(colSkill, 'debe existir la columna SKILL_NAME');
  assert.deepEqual(colSkill.labelAlt, ['NOMBRE DE SKILL'], 'labelAlt debe preservarse tal cual viene de TIPIFICACION_COLUMNAS');
});

test('END-TO-END (la prueba que habria atrapado el hallazgo real): un header HistChat real (NOMBRE DE SKILL, sin SKILL_NAME) SI coincide con las columnas del plan de WhatsApp', () => {
  const HEADER_HISTCHAT = ['CONN_ID', 'CHANNEL', 'DATE', 'DATE_CLOSE', 'AGENT_NAME', 'DESCRIPTION_COD_ACT', 'NOMBRE DE SKILL'];
  const colsPlan = sandbox._cargasTipificacionColumnasUnificado();
  assert.equal(cargasEncabezadosCoinciden(HEADER_HISTCHAT, colsPlan), true, 'con labelAlt preservado, el header real de HistChat debe coincidir con las columnas del plan');
  assert.equal(cargasDetectarCanalTipificacion(HEADER_HISTCHAT), 'WHATSAPP');
});

test('Un header de Llamadas (SKILL_NAME real, sin NOMBRE DE SKILL) tambien sigue coincidiendo (sin regresion)', () => {
  const HEADER_LLAMADAS = ['AGENT_NAME', 'DATE', 'HORA', 'TIME_MIN', 'DESCRIPTION_COD_ACT', 'SKILL_NAME'];
  const colsPlan = sandbox._cargasTipificacionColumnasUnificado();
  assert.equal(cargasEncabezadosCoinciden(HEADER_LLAMADAS, colsPlan), true);
  assert.equal(cargasDetectarCanalTipificacion(HEADER_LLAMADAS), 'LLAMADAS');
});
