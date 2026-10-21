// fase162-cache-tope-memoria.test.js — Fase 162: la cache de respuestas de
// datos (cache-datos.js) tiene un tope TOTAL de memoria, ademas del tope por
// respuesta y de entradas. Al pasarlo saca las entradas mas viejas, nunca las
// recien guardadas. Configurable con CACHE_DATOS_MAX_MB (por defecto 64).
// Sin base ni servidor: peticiones falsas sobre el middleware.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearCacheDatos, MAX_BYTES_TOTAL } = require('../cache-datos');

const dbFalsa = { prepare: () => ({ get: () => ({ n: 1 }) }) }; // firma fija
const actorDeLaPeticion = () => ({ isMasterAdmin: true });
const RUTA = '/calidad/agendas/linea';

// Pasa una peticion por el middleware; si no sale de la cache, la "ruta"
// responde `cuerpo`. Devuelve true si salio de la cache.
function pedir(cache, mes, cuerpo) {
  let desdeCache = false;
  const res = {
    statusCode: 200,
    set() { return this; },
    type() { return this; },
    send() { desdeCache = true; return this; },
    json() { return this; },
  };
  cache({ method: 'GET', path: RUTA, query: { mes } }, res, () => res.json(cuerpo));
  return desdeCache;
}
const cuerpoDe = (kb) => ({ x: 'a'.repeat(kb * 1024) });

test('por defecto el tope total es 64 MB', () => {
  assert.equal(MAX_BYTES_TOTAL, 64 * 1024 * 1024);
});

test('al pasar el tope total saca las entradas mas viejas y conserva las nuevas', () => {
  const cache = crearCacheDatos(dbFalsa, { actorDeLaPeticion, maxBytesTotal: 100 * 1024 });
  for (let i = 1; i <= 5; i++) pedir(cache, 'm' + i, cuerpoDe(30)); // 5 x ~30 KB
  assert.ok(cache.bytes() <= 100 * 1024, 'bytes ' + cache.bytes());
  assert.equal(cache.tamano(), 3);
  assert.ok(pedir(cache, 'm5', null), 'la mas nueva sigue');
  assert.ok(pedir(cache, 'm3', null), 'm3 sigue');
  assert.ok(!pedir(cache, 'm1', cuerpoDe(1)), 'la mas vieja salio');
});

test('una respuesta mas grande que el tope total no se guarda ni vacia la cache', () => {
  const cache = crearCacheDatos(dbFalsa, { actorDeLaPeticion, maxBytesTotal: 50 * 1024 });
  pedir(cache, 'chica', cuerpoDe(10));
  pedir(cache, 'grande', cuerpoDe(60));
  assert.equal(cache.tamano(), 1);
  assert.ok(pedir(cache, 'chica', null));
});

test('limpiar deja la cuenta de bytes en cero', () => {
  const cache = crearCacheDatos(dbFalsa, { actorDeLaPeticion, maxBytesTotal: 1024 * 1024 });
  pedir(cache, 'a', cuerpoDe(10));
  assert.ok(cache.bytes() > 0);
  cache.limpiar();
  assert.equal(cache.bytes(), 0);
  assert.equal(cache.tamano(), 0);
});

test('CACHE_DATOS_MAX_MB cambia el tope', () => {
  const antes = process.env.CACHE_DATOS_MAX_MB;
  process.env.CACHE_DATOS_MAX_MB = '0.05'; // ~51 KB
  try {
    const cache = crearCacheDatos(dbFalsa, { actorDeLaPeticion });
    for (let i = 1; i <= 4; i++) pedir(cache, 'e' + i, cuerpoDe(20));
    assert.ok(cache.bytes() <= 0.05 * 1024 * 1024, 'bytes ' + cache.bytes());
    assert.equal(cache.tamano(), 2);
  } finally {
    if (antes === undefined) delete process.env.CACHE_DATOS_MAX_MB;
    else process.env.CACHE_DATOS_MAX_MB = antes;
  }
});
