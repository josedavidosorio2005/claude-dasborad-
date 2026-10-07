// dry-run-seguro.js — Fase 129. Helper SEGURO POR CONSTRUCCION para los
// scripts de scripts/produccion/*.js que hacen un dry-run (preview sin
// guardar) contra la interfaz real de producción con Playwright.
//
// Nace de un incidente real: un script de esta misma fase usaba
// `page.exposeFunction('_cap', fn)` para interceptar `window.confirm` y
// forzarlo a `false`. `exposeFunction` SIEMPRE devuelve una Promise del
// lado de la página (aunque la función de Node sea síncrona) -- y una
// Promise es "truthy". El código real de la app hace
// `if (!confirm(msg)) return;` -- con `confirm(msg)` devolviendo una
// Promise, `!confirm(msg)` fue siempre `false`, el `if` nunca se cumplió,
// y el "dry-run" terminó llamando al POST real de guardado. Quedó escrito
// en producción sin el "sí" explícito del usuario y sin respaldo previo.
//
// 2 defensas INDEPENDIENTES, cualquiera de las 2 sola ya evita la
// escritura real:
//   1. Un `window.confirm` que SIEMPRE devuelve `false` de forma
//      SINCRÓNICA -- inyectado con `page.evaluate` (nunca con
//      `exposeFunction`), ver `instalarDryRunSeguro`.
//   2. Un interceptor de red (`page.route`) que aborta cualquier petición
//      de escritura (POST/PUT/PATCH/DELETE) que no sea un endpoint
//      "/.../impacto" -- la única excepción permitida, porque los
//      endpoints de impacto son POST por necesidad (llevan body) pero
//      están documentados en el servidor como "no escribe nada"
//      (impactoAgendas/impactoTipificaciones/impactoInasistencias/...).
//
// `esPeticionDeEscrituraBloqueable` es lógica PURA (sin Playwright, sin
// navegador) para poder probarla con `node --test` sin un browser real --
// ver server/tests/fase129-dryrun-seguro-logic.test.js.
'use strict';

const METODOS_ESCRITURA = ['POST', 'PUT', 'PATCH', 'DELETE'];
const METODOS_ESCRITURA_SET = new Set(METODOS_ESCRITURA);

function esPeticionDeEscrituraBloqueable(method, url) {
  if (!METODOS_ESCRITURA_SET.has(String(method || '').toUpperCase())) return false;
  let pathname;
  try {
    pathname = new URL(url).pathname;
  } catch (e) {
    pathname = String(url || '');
  }
  return !/\/impacto$/.test(pathname);
}

// Instala las 2 defensas sobre una página de Playwright ya abierta.
// `peticionesBloqueadas` es un array del llamador -- esta función le hace
// push de cada petición de escritura real que haya intentado salir
// (idealmente queda vacío siempre: la defensa 1 ya debería haber evitado
// que la app intentara la petición).
async function instalarDryRunSeguro(page, peticionesBloqueadas) {
  await page.route('**/*', (route) => {
    const req = route.request();
    if (esPeticionDeEscrituraBloqueable(req.method(), req.url())) {
      peticionesBloqueadas.push({ method: req.method(), url: req.url() });
      return route.abort();
    }
    return route.continue();
  });
  // SINCRONICO -- nunca page.exposeFunction (ver comentario de arriba).
  await page.evaluate(() => {
    window.__dryRunConfirms = [];
    window.confirm = function (msg) {
      window.__dryRunConfirms.push(msg);
      return false;
    };
  });
}

async function leerConfirmsCapturados(page) {
  return page.evaluate(() => window.__dryRunConfirms || []);
}

module.exports = {
  METODOS_ESCRITURA,
  esPeticionDeEscrituraBloqueable,
  instalarDryRunSeguro,
  leerConfirmsCapturados,
};
