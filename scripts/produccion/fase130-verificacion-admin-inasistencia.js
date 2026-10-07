// fase130-verificacion-admin-inasistencia.js — Fase 130, Parte 2 (cierre).
// Corre SOLO el bloque de ADMINISTRADOR de revision-final.js (reusado TAL
// CUAL, sin duplicar logica) -- cubre las 8 pestañas de ORLANT (canvas con
// pixeles reales, 0 errores de consola, 0 peticiones fallidas, numeros de
// control incluida la Inasistencia nueva) sin esperar los 10 min de la
// 2da ventana (CLIENTES_DASH, sin contraseña de cliente a mano todavia --
// ver docs/pendientes.md). SOLO LECTURA.
//
// Playwright DIRECTO desde Node, NO la extension de Claude in Chrome.
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));
const { correrChequeosAdmin } = require('./revision-final.js');

const BASE = process.env.APP_URL || 'https://informa.inconexion.com.co';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

function log(...args) { console.log(new Date().toISOString(), ...args); }

async function esperarLogin(page) {
  log('=== INICIA SESIÓN AHORA, CON TU CUENTA DE ADMINISTRADOR === (ventana abierta, esperando hasta 10 min)');
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
  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Se agotó el tiempo de espera de login.');
    log('Login detectado, corriendo los chequeos de administrador...');

    // Selecciona SOLO 'meses' dentro del propio callback -- nunca reenvia
    // el objeto 'opciones' crudo completo (mismo criterio que el resto de
    // scripts/produccion/, ver fase129-scripts-produccion-sin-texto-crudo.test.js).
    const tipifWppMeses = await page.evaluate(async () => {
      const opc = await apiRequest('GET', '/calidad/tipificacion/opciones?campana=ORLANT&canal=WHATSAPP');
      return opc.meses;
    });
    log('Tipificación de WhatsApp -- meses (debe ser SOLO 2026-08/2026-09, sin 2026-07):', JSON.stringify(tipifWppMeses));
    const tipifWppJul = await page.evaluate(() => apiRequest('GET', '/calidad/tipificacion/por-tipo?campana=ORLANT&canal=WHATSAPP&mes=2026-07'));
    log('Tipificación de WhatsApp, Jul-26 (debe ser 0 tras el borrado):', tipifWppJul.total);

    const reporte = await correrChequeosAdmin(page);

    console.log('\n=== REPORTE ADMIN (JSON) ===');
    console.log(JSON.stringify(reporte, null, 2));

    log('¿Inasistencia solo ago-sep?', reporte.inasistenciaIntegridad.soloAgoSep);
    log('¿SEDE 34 unica (sin "(AUDIFONOS)")?', reporte.inasistenciaIntegridad.sede34Unica);
    log('¿Sin meses de formato viejo?', reporte.inasistenciaIntegridad.sinFormatoViejo);
    log('Discrepancias de numeros (debe ser 0):', reporte.discrepanciasNumeros.length, JSON.stringify(reporte.discrepanciasNumeros));
    log('Canvas sin dibujar (debe ser 0):', reporte.canvasesSinDibujar.length, JSON.stringify(reporte.canvasesSinDibujar));
    log('Errores de consola (debe ser 0):', reporte.erroresConsola.length, JSON.stringify(reporte.erroresConsola));
    log('Peticiones fallidas (debe ser 0):', reporte.peticionesFallidas.length, JSON.stringify(reporte.peticionesFallidas));
    log('¿Tipificación de WhatsApp tiene SOLO ago-sep (sin julio)?', JSON.stringify(reporte.numeros && reporte.numeros.tipificacionTotal));

    ok = reporte.ok;
  } catch (e) {
    console.error('FALLO:', e.message);
    ok = false;
  } finally {
    if (browser) await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
