// fase103-gd-modal-pantalla-completa.test.js — Fase 103 (InCo pidio que el
// dashboard de cliente se vea a pantalla completa, para visualizar mejor
// las graficas). #gd-modal compartia una sola regla CSS con otros 5
// modales (Calidad, Cargas, constructor de dashboards, detalle de
// monitoreo, supervisar lider) -- width:96vw;max-width:1180px;max-height:
// 93vh;border-radius:18px (ventana flotante). Esta prueba confirma que
// #gd-modal salio de esa regla compartida hacia una propia SIN limite de
// ancho/alto, y que los otros 5 modales se quedaron exactamente igual que
// antes (no es aceptable "arreglar" el dashboard de cliente rompiendo los
// demas, que comparten la clase .aurora-header/selector por ids).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { request, app } = require('./helpers');

async function css() {
  const res = await request(app).get('/css/styles.css');
  assert.equal(res.status, 200);
  return res.text;
}

test('#gd-modal: regla propia, sin max-width/max-height limitado, cubre el viewport (100%/100dvh), sin bordes redondeados', async () => {
  const texto = await css();
  const m = texto.match(/#gd-modal\{([^}]*)\}/);
  assert.ok(m, 'deberia existir una regla CSS propia para #gd-modal (no solo dentro de una lista compartida)');
  const reglas = m[1];
  // Fase 105 (hallazgo real de la verificacion final en produccion: con un
  // Chrome real, no headless, `100vw` se calcula EXCLUYENDO el ancho de la
  // barra de scroll de la pagina de fondo si la hay -- el modal quedaba
  // ~15px mas angosto que el viewport real). `100%` hereda de #gd-overlay
  // (`position:fixed;inset:0`, inmune a esa barra) y, junto con el bloqueo
  // de scroll de fondo mientras el modal esta abierto (ver
  // fase105-gd-modal-scroll-fondo.test.js), da el ancho real siempre.
  assert.match(reglas, /width:\s*100%/, '#gd-modal deberia medir 100% de ancho (no 100vw, ver Fase 105)');
  assert.match(reglas, /height:\s*100dvh/, '#gd-modal deberia medir 100dvh de alto (dvh, no vh, para movil)');
  assert.match(reglas, /max-width:\s*none/, '#gd-modal no deberia tener un max-width limitado');
  assert.match(reglas, /max-height:\s*none/, '#gd-modal no deberia tener un max-height limitado');
  assert.match(reglas, /border-radius:\s*0/, '#gd-modal no deberia tener esquinas redondeadas a pantalla completa');
});

test('#gd-modal .aurora-header queda "sticky" (titulo/MES/Exportar/Cerrar visibles sin subir el scroll)', async () => {
  const texto = await css();
  const m = texto.match(/#gd-modal \.aurora-header\{([^}]*)\}/);
  assert.ok(m, 'deberia existir una regla #gd-modal .aurora-header con position sticky');
  assert.match(m[1], /position:\s*sticky/);
  assert.match(m[1], /top:\s*0/);
});

test('los otros 5 modales (Calidad/Cargas/constructor/detalle de monitoreo/supervisar lider) NO cambiaron: siguen con max-width:1180px y border-radius:18px, y #gd-modal ya no esta en esa lista', async () => {
  const texto = await css();
  const m = texto.match(/#calidad-modal,[^{]*\{([^}]*)\}/);
  assert.ok(m, 'deberia seguir existiendo la regla compartida de los otros 5 modales');
  const selector = texto.match(/(#calidad-modal,[^{]*)\{/)[1];
  assert.ok(!selector.includes('#gd-modal'), '#gd-modal no deberia seguir en la lista compartida de los otros modales');
  ['#calidad-modal', '#detalle-monitoreo-modal', '#supervisar-lider-modal', '#cargas-modal', '#dashcfg-modal'].forEach((id) => {
    assert.ok(selector.includes(id), `${id} deberia seguir compartiendo la regla de ventana flotante`);
  });
  assert.match(m[1], /max-width:\s*1180px/, 'los otros modales deberian seguir limitados a 1180px (sin cambios)');
  assert.match(m[1], /border-radius:\s*18px/, 'los otros modales deberian seguir con esquinas redondeadas (sin cambios)');
});

test('boton de pantalla completa: existe en el HTML, oculto por defecto (se muestra solo si el navegador soporta la Fullscreen API)', async () => {
  const res = await request(app).get('/');
  assert.equal(res.status, 200);
  const btn = res.text.match(/<button[^>]*id="gd-fullscreen-btn"[^>]*>/);
  assert.ok(btn, 'deberia existir el boton #gd-fullscreen-btn en la cabecera del dashboard de cliente');
  assert.match(btn[0], /class="[^"]*\bhidden\b[^"]*"/, 'el boton deberia empezar oculto (JS lo muestra solo si hay soporte)');
  assert.match(btn[0], /onclick="toggleGdFullscreen\(\)"/);
});

test('dashboard-generic.js: expone toggleGdFullscreen y sale de pantalla completa al cerrar el dashboard', async () => {
  const res = await request(app).get('/js/dashboard-generic.js');
  assert.equal(res.status, 200);
  assert.match(res.text, /function toggleGdFullscreen\(\)/);
  assert.match(res.text, /function _gdOnFullscreenChange\(\)/);
  assert.match(res.text, /addEventListener\('fullscreenchange', ?_gdOnFullscreenChange\)/);
  // closeGenericDashboard debe salir de fullscreen ANTES de ocultar el overlay.
  const cierre = res.text.match(/function closeGenericDashboard\(\)\{([^}]*)\}/);
  assert.ok(cierre);
  assert.match(cierre[1], /document\.exitFullscreen\(\)/);
  // toggleGdFullscreen pide pantalla completa sobre TODA la pagina (nunca
  // solo #gd-overlay) -- hallazgo real probando con Playwright: el menu de
  // "Exportar" se agrega como hijo de <body>, fuera del subarbol de
  // #gd-overlay, y queda sin poder recibir clics si solo #gd-overlay (y no
  // la pagina completa) es el elemento en fullscreen.
  const toggle = res.text.match(/function toggleGdFullscreen\(\)\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/);
  assert.ok(toggle);
  assert.match(toggle[1], /document\.documentElement/);
  assert.ok(!/getElementById\('gd-overlay'\)\.requestFullscreen/.test(toggle[1]));
});

test('state.js: la cabecera del dashboard de cliente se corre igual que el navbar cuando se ve el banner de "DATOS DE DEMOSTRACION"', async () => {
  // Hallazgo real probando con seed:demo: el banner (position:sticky,
  // z-index:4000, solo visible con datos de demo) tapaba la parte de
  // arriba de la cabecera del dashboard a pantalla completa, porque esta
  // ahora arranca justo en el y=0 del viewport (antes, siendo una ventana
  // flotante mas chica y centrada, nunca llegaba hasta ahi). Mismo ajuste
  // que ya existia para .navbar.
  //
  // Fase 133 (hallazgo real, 412px): el offset fijo "34px" asumia que el
  // banner siempre ocupa 1 sola linea -- a 412px de ancho el texto completo
  // no entra y hace wrap a 2 lineas (~56-60px reales), asi que el offset
  // fijo se quedaba corto y el banner volvia a tapar la cabecera. Ahora se
  // mide la altura REAL del banner (getBoundingClientRect) en vez de asumir
  // un numero -- corrige cualquier ancho, incluido un resize en caliente.
  //
  // Fase 133 (2do hallazgo, mas grave): correr .aurora-header con
  // style.top=Xpx (como se hacia antes) NO le reserva espacio extra a
  // #gd-tabs (su hermano siguiente en el HTML) -- el header "stuck"
  // quedaba pintado ENCIMA de las pestanas (mismo DOM, z-index mas alto),
  // Playwright lo confirmo: un clic en la 1ra pestana agarraba el boton
  // Exportar en su lugar. Arreglo real: el offset ahora se le da al MODAL
  // completo (#gd-modal, margin-top + height recalculado), nunca al
  // header -- header y pestanas quedan en el mismo marco de referencia,
  // cero invasion posible sea cual sea la altura real de cada uno.
  const res = await request(app).get('/js/state.js');
  assert.equal(res.status, 200);
  assert.match(res.text, /function renderSeedDemoBanner\(\)/);
  assert.match(res.text, /function aplicarOffsetSeedDemoBanner\(\)/);
  assert.match(res.text, /getBoundingClientRect\(\)\.height/);
  assert.match(res.text, /getElementById\('gd-modal'\)/);
  assert.match(res.text, /gdModal\.style\.marginTop/);
  assert.match(res.text, /gdModal\.style\.height/);
  assert.ok(!/gdHeader\.style\.top/.test(res.text), 'el header ya no deberia correrse a si mismo (eso tapaba las pestanas) -- el offset va en el modal completo');
  assert.ok(!/'34px'/.test(res.text), 'no deberia quedar el offset viejo hardcodeado en 34px');
  // Un resize de ventana (o rotar el telefono) tiene que reaplicar el
  // offset -- el wrap del banner puede cambiar con el ancho.
  assert.match(res.text, /addEventListener\('resize',/);
});
