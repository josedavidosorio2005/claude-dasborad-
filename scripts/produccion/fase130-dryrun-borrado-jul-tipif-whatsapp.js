// fase130-dryrun-borrado-jul-tipif-whatsapp.js — Fase 130, Parte 1.
// Dry-run (NUNCA confirmar:true) del borrado del unico mes fuera de
// ago-sep/2026 que el inventario de esta fase encontro: Tipificacion de
// WhatsApp de ORLANT, Jul-2026 (71 filas conocidas desde fases
// anteriores). Confirma el conteo real por 2 caminos independientes
// (por-tipo con mes=2026-07, y el propio dry-run del endpoint de
// borrado) antes de pedir el "si" del usuario para borrar de verdad.
//
// Playwright DIRECTO desde Node, NO la extension de Claude in Chrome.
// SOLO LECTURA: confirmar siempre false.
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));
const { instalarDryRunSeguro, leerConfirmsCapturados } = require('./lib/dry-run-seguro.js');

const BASE = 'https://informa.inconexion.com.co';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
const CAMPANA = 'ORLANT';
const FILAS_ESPERADAS = 71;

function log(...args) { console.log(new Date().toISOString(), ...args); }

async function esperarLogin(page) {
  log('=== INICIA SESIÓN AHORA === (ventana de Chromium abierta, esperando hasta 10 min)');
  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const logueado = await page.evaluate(() => typeof authToken !== 'undefined' && !!authToken).catch(() => false);
    if (logueado) return true;
    await page.waitForTimeout(3000);
  }
  return false;
}

(async () => {
  let browser;
  let ok = true;
  const reporte = {};
  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Se agotó el tiempo de espera de login.');
    log('Login detectado.');
    await page.waitForTimeout(500);

    // El unico POST que este script necesita que pase es el dry-run del
    // propio endpoint de borrado -- `confirmar:false` va escrito literal
    // mas abajo en este archivo, nunca leido de un dialog/DOM de la pagina
    // (a diferencia del incidente de la Fase 129), asi que dejarlo pasar
    // via la lista exacta de dry-run-seguro.js es seguro.
    const peticionesBloqueadas = [];
    await instalarDryRunSeguro(page, peticionesBloqueadas, ['/admin/borrado-rango']);

    const porTipoJul = await page.evaluate((c) => apiRequest('GET', `/calidad/tipificacion/por-tipo?campana=${c}&canal=WHATSAPP&mes=2026-07`), CAMPANA);
    reporte.porTipoJulTotal = porTipoJul.total;
    log('Tipificación de WhatsApp, Jul-26 (por-tipo, total):', porTipoJul.total);

    const dryRun = await page.evaluate((args) => apiRequest('POST', '/admin/borrado-rango', {
      base: 'tipificacion_whatsapp', campana: args.campana, mesDesde: '2026-07', mesHasta: '2026-07',
      filasEsperadas: args.filasEsperadas, confirmar: false,
    }), { campana: CAMPANA, filasEsperadas: FILAS_ESPERADAS });
    log('Dry-run borrado-rango (tipificacion_whatsapp, 2026-07):', JSON.stringify(dryRun));
    reporte.dryRun = dryRun;
    reporte.peticionesBloqueadas = peticionesBloqueadas;

    const coincide = dryRun.dryRun === true && dryRun.filas === FILAS_ESPERADAS && porTipoJul.total === FILAS_ESPERADAS;
    log('¿Coincide con 71 EXACTO por los 2 caminos, y es dry-run (nunca borró)?', coincide);
    log('Peticiones de escritura bloqueadas fuera de /admin/borrado-rango (debe ser 0):', peticionesBloqueadas.length);
    const confirms = await leerConfirmsCapturados(page);
    log('window.confirm() interceptados (debe seguir vacio -- este script nunca pasa por un dialog):', JSON.stringify(confirms));
    reporte.confirmsCapturados = confirms;

    if (!coincide) {
      throw new Error('El conteo NO coincide con 71 por ambos caminos, o el servidor no confirmó dryRun:true -- NO BORRAR: ' + JSON.stringify({ porTipoJulTotal: porTipoJul.total, dryRun }));
    }

    reporte.ok = true;
    console.log('\n=== RESUMEN FINAL (JSON) ===');
    console.log(JSON.stringify(reporte, null, 2));
  } catch (e) {
    console.error('FALLO:', e.message);
    ok = false;
  } finally {
    if (browser) await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
