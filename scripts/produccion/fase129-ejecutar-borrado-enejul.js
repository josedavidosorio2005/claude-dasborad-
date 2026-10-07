// fase129-ejecutar-borrado-enejul.js — Script de un solo uso, Fase 129.
// Paso 2 de la Opción B, ejecución real (dry-run ya confirmado: 2.312
// filas exactas, "sí" explícito del usuario dado): POST
// /admin/borrado-rango con confirmar:true, base 'inasistencia',
// campana ORLANT, ene-jul 2026. El servidor revalida el conteo real
// DENTRO de la misma transacción antes de borrar (admin-borrado-rango.js)
// -- si algo cambió desde el dry-run, no borra nada y devuelve 409.
//
// Playwright DIRECTO desde Node (headless:false) -- NO la extensión de
// Claude in Chrome (CLAUDE.md).
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));

const BASE = 'https://informa.inconexion.com.co';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
const FILAS_ESPERADAS = 2312;

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
    if (!logueado) throw new Error('Se agotó el tiempo de espera de login (10 min) sin detectar sesión iniciada.');
    log('Login detectado, continuando automáticamente.');
    await page.waitForTimeout(500);

    const resultado = await page.evaluate((filasEsperadas) => apiRequest('POST', '/admin/borrado-rango', {
      base: 'inasistencia', campana: 'ORLANT', mesDesde: '2026-01', mesHasta: '2026-07',
      filasEsperadas, confirmar: true,
    }), FILAS_ESPERADAS);
    log('Resultado del borrado real:', JSON.stringify(resultado));
    reporte.resultado = resultado;

    if (!resultado.ok || resultado.borradas !== FILAS_ESPERADAS) {
      throw new Error('El borrado no terminó como se esperaba (ok:true, borradas:2312): ' + JSON.stringify(resultado));
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
