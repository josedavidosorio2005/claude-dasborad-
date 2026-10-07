// fase129-dryrun-seguro-logic.test.js — Fase 129. Prueba de la lógica PURA
// (sin Playwright, sin navegador) de scripts/produccion/lib/dry-run-seguro.js
// -- nace de un incidente real: un script de dry-run de esta fase usaba
// `page.exposeFunction` para forzar `window.confirm` a `false`, pero
// `exposeFunction` siempre devuelve una Promise del lado de la página (y
// una Promise es "truthy"), así que el guard `if (!confirm(msg))` de la
// app real nunca se cumplió y el "dry-run" terminó escribiendo de verdad
// en producción. Esta prueba cubre la función que decide qué peticiones
// de red debe bloquear la defensa de respaldo (`page.route`), y documenta
// explícitamente la causa raíz (una Promise siempre es truthy).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  METODOS_ESCRITURA,
  esPeticionDeEscrituraBloqueable,
} = require('../../scripts/produccion/lib/dry-run-seguro.js');

test('GET nunca se bloquea, sin importar la ruta', () => {
  assert.equal(esPeticionDeEscrituraBloqueable('GET', 'https://informa.inconexion.com.co/calidad/inasistencia/carga'), false);
  assert.equal(esPeticionDeEscrituraBloqueable('get', 'https://informa.inconexion.com.co/calidad/inasistencia/carga/impacto'), false);
});

test('POST al endpoint real de guardado SI se bloquea', () => {
  assert.equal(esPeticionDeEscrituraBloqueable('POST', 'https://informa.inconexion.com.co/calidad/inasistencia/carga'), true);
});

test('POST a un endpoint que termina en /impacto NO se bloquea (documentado "no escribe nada")', () => {
  assert.equal(esPeticionDeEscrituraBloqueable('POST', 'https://informa.inconexion.com.co/calidad/inasistencia/carga/impacto'), false);
  assert.equal(esPeticionDeEscrituraBloqueable('POST', 'https://informa.inconexion.com.co/calidad/agendas/carga/impacto'), false);
});

test('un nombre de endpoint que contiene "impacto" pero no termina asi SI se bloquea (nunca un match parcial)', () => {
  assert.equal(esPeticionDeEscrituraBloqueable('POST', 'https://informa.inconexion.com.co/calidad/impacto-falso/carga'), true);
});

test('query string en la URL no rompe el chequeo de /impacto', () => {
  assert.equal(esPeticionDeEscrituraBloqueable('POST', 'https://informa.inconexion.com.co/calidad/inasistencia/carga/impacto?x=1'), false);
  assert.equal(esPeticionDeEscrituraBloqueable('POST', 'https://informa.inconexion.com.co/calidad/inasistencia/carga?x=1'), true);
});

for (const metodo of METODOS_ESCRITURA) {
  test(`${metodo} a un endpoint que no es /impacto se bloquea`, () => {
    assert.equal(esPeticionDeEscrituraBloqueable(metodo, 'https://informa.inconexion.com.co/calidad/inasistencia/carga'), true);
  });
}

test('metodos de lectura (HEAD) nunca se bloquean', () => {
  assert.equal(esPeticionDeEscrituraBloqueable('HEAD', 'https://informa.inconexion.com.co/calidad/inasistencia/carga'), false);
});

test('una URL invalida no revienta la funcion (se trata como string, sigue clasificando por metodo)', () => {
  assert.doesNotThrow(() => esPeticionDeEscrituraBloqueable('POST', 'no-es-una-url-valida'));
});

// Documenta la CAUSA RAIZ del incidente: page.exposeFunction envuelve el
// valor de retorno en una Promise, y una Promise SIEMPRE es truthy -- por
// eso `if (!confirm(msg))` nunca abortaba. La defensa correcta (ver
// instalarDryRunSeguro) nunca usa exposeFunction para esto, siempre un
// valor booleano sincronico devuelto directamente dentro de page.evaluate.
test('causa raiz documentada: una Promise (lo que exposeFunction fuerza como retorno) siempre es truthy', () => {
  const comoExposeFunctionLoHabriaDevuelto = Promise.resolve(false);
  assert.equal(!comoExposeFunctionLoHabriaDevuelto, false, 'una Promise nunca debe tratarse como el booleano que envuelve sin esperarla');
  const valorSincronicoCorrecto = false;
  assert.equal(!valorSincronicoCorrecto, true, 'un booleano sincronico si permite que "if (!confirm(msg))" aborte como se espera');
});
