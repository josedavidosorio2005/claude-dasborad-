// fase130-parte8-verificacion-clientes-dash.js — Fase 130 (cierre). SOLO el
// bloque CLIENTES_DASH de revision-final.js (el de ADMIN ya paso 2 veces
// identico en esta misma fase, no hace falta repetirlo). Reutiliza las
// funciones ya auditadas de ese archivo (correrChequeosCliente,
// paginaFresca, esperarLoginYDecodificar, esClienteDash) -- no reimplementa
// nada, asi nunca se desalinea del codigo real. SOLO LECTURA, UNA sola
// ventana, el usuario escribe el login del cliente real de ORLANT.
//
// Playwright DIRECTO desde Node (headless:false), NO la extension de
// Claude in Chrome (CLAUDE.md).
'use strict';
const {
  correrChequeosCliente,
  paginaFresca,
  esperarLoginYDecodificar,
  esClienteDash,
} = require('./revision-final.js');
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));

function log(...args) { console.log(new Date().toISOString(), ...args); }

(async () => {
  let browser;
  let ok = true;
  try {
    browser = await chromium.launch({ headless: false });
    const { context, page } = await paginaFresca(browser);

    const token = await esperarLoginYDecodificar(page, 'con LA CUENTA REAL DEL CLIENTE de ORLANT (rol CLIENTES_DASH)');
    if (!token) throw new Error('Se agoto el tiempo de espera de login (10 min).');
    if (!esClienteDash(token)) {
      throw new Error('La cuenta que inicio sesion NO es CLIENTES_DASH (token: ' + JSON.stringify(token) + '). Revisa con que cuenta entraste.');
    }
    log('Identidad confirmada por JWT: CLIENTES_DASH.');
    await page.waitForTimeout(1000);

    const reporte = await correrChequeosCliente(page);
    await context.close();

    log('=== REPORTE CLIENTES_DASH ===');
    console.log(JSON.stringify(reporte, null, 2));
    ok = reporte.ok;
    log(ok ? 'OK: CLIENTES_DASH verificado, 0 errores, 0 canvas en blanco, exports OK.' : 'REVISAR -- ver hallazgos arriba.');
  } catch (e) {
    console.error('FALLO:', e.message);
    ok = false;
  } finally {
    if (browser) await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
