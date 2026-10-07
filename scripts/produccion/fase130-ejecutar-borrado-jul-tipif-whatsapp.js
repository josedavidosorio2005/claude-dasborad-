// fase130-ejecutar-borrado-jul-tipif-whatsapp.js — Fase 130, Parte 1.
// Ejecuta el borrado REAL (confirmar:true) de Tipificacion de WhatsApp de
// ORLANT, Jul-2026 (71 filas) -- ya con: inventario completo (solo esta
// base/mes estaba fuera de ago-sep), dry-run confirmado por 2 caminos
// (71 EXACTO), respaldo manual confirmado (integrity_check:ok, S3:OK) y el
// "si" explicito del usuario. Verifica despues que tipificacion_whatsapp
// quede SOLO ago-sep y que ninguna otra base cambio (snapshot antes/despues
// de los totales del inventario de la Parte 1).
//
// Playwright DIRECTO desde Node, NO la extension de Claude in Chrome.
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));

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

async function snapshot(page) {
  const out = {};
  const agendasOpc = await page.evaluate((c) => apiRequest('GET', `/calidad/agendas/opciones?campana=${c}`), CAMPANA);
  out.agendas = agendasOpc.meses || [];
  const inasistOpc = await page.evaluate((c) => apiRequest('GET', `/calidad/inasistencia/opciones?campana=${c}`), CAMPANA);
  out.inasistencia = inasistOpc.meses || [];
  const efAgOpc = await page.evaluate((c) => apiRequest('GET', `/calidad/efectividad-agendamiento/opciones?campana=${c}`), CAMPANA);
  out.efectividad_agendamiento = efAgOpc.meses || [];
  const efCitasOpc = await page.evaluate((c) => apiRequest('GET', `/calidad/efectividad-citas/opciones?campana=${c}`), CAMPANA);
  out.efectividad_citas = efCitasOpc.meses || [];
  const salidaOpc = await page.evaluate((c) => apiRequest('GET', `/calidad/salida/opciones?campana=${c}`), CAMPANA);
  out.salida = salidaOpc.meses || [];
  const tipifLlamOpc = await page.evaluate((c) => apiRequest('GET', `/calidad/tipificacion/opciones?campana=${c}&canal=LLAMADAS`), CAMPANA);
  out.tipificacion_llamadas = tipifLlamOpc.meses || [];
  const tipifWppOpc = await page.evaluate((c) => apiRequest('GET', `/calidad/tipificacion/opciones?campana=${c}&canal=WHATSAPP`), CAMPANA);
  out.tipificacion_whatsapp = tipifWppOpc.meses || [];
  const traficoLlamadas = await page.evaluate((c) => apiRequest('GET', `/calidad/nivel-servicio/diario?campana=${c}`), CAMPANA);
  out.trafico_llamadas_total = traficoLlamadas.length;
  const traficoWpp = await page.evaluate((c) => apiRequest('GET', `/calidad/trafico/whatsapp?campana=${c}`), CAMPANA);
  out.trafico_whatsapp_total = traficoWpp.length;
  return out;
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

    const peticionesBloqueadas = [];
    await page.route('**/*', (route) => {
      const req = route.request();
      const m = req.method();
      const pathname = new URL(req.url()).pathname;
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(m) && !/\/admin\/borrado-rango$/.test(pathname)) {
        peticionesBloqueadas.push(m + ' ' + pathname);
        return route.abort();
      }
      return route.continue();
    });

    log('Snapshot ANTES del borrado...');
    const antes = await snapshot(page);
    reporte.antes = antes;
    log('Antes:', JSON.stringify(antes));

    // Re-confirma el conteo exacto justo antes de borrar (nunca asumido).
    const dryRun = await page.evaluate((args) => apiRequest('POST', '/admin/borrado-rango', {
      base: 'tipificacion_whatsapp', campana: args.campana, mesDesde: '2026-07', mesHasta: '2026-07',
      filasEsperadas: args.filasEsperadas, confirmar: false,
    }), { campana: CAMPANA, filasEsperadas: FILAS_ESPERADAS });
    if (dryRun.dryRun !== true || dryRun.filas !== FILAS_ESPERADAS) {
      throw new Error('El conteo cambió justo antes de borrar -- ABORTA: ' + JSON.stringify(dryRun));
    }
    log('Re-confirmado 71 filas exactas, procediendo a borrar de verdad...');

    const borrado = await page.evaluate((args) => apiRequest('POST', '/admin/borrado-rango', {
      base: 'tipificacion_whatsapp', campana: args.campana, mesDesde: '2026-07', mesHasta: '2026-07',
      filasEsperadas: args.filasEsperadas, confirmar: true,
    }), { campana: CAMPANA, filasEsperadas: FILAS_ESPERADAS });
    log('Resultado del borrado real:', JSON.stringify(borrado));
    reporte.borrado = borrado;

    log('Snapshot DESPUES del borrado...');
    const despues = await snapshot(page);
    reporte.despues = despues;
    log('Despues:', JSON.stringify(despues));

    // Verificacion: tipificacion_whatsapp queda SOLO ago-sep; ninguna otra
    // base cambio (comparacion profunda de arrays/numeros, campo por campo).
    const tipifWppOk = JSON.stringify(despues.tipificacion_whatsapp) === JSON.stringify(['2026-08', '2026-09']);
    const otrasBasesIguales =
      JSON.stringify(antes.agendas) === JSON.stringify(despues.agendas) &&
      JSON.stringify(antes.inasistencia) === JSON.stringify(despues.inasistencia) &&
      JSON.stringify(antes.efectividad_agendamiento) === JSON.stringify(despues.efectividad_agendamiento) &&
      JSON.stringify(antes.efectividad_citas) === JSON.stringify(despues.efectividad_citas) &&
      JSON.stringify(antes.salida) === JSON.stringify(despues.salida) &&
      JSON.stringify(antes.tipificacion_llamadas) === JSON.stringify(despues.tipificacion_llamadas) &&
      antes.trafico_llamadas_total === despues.trafico_llamadas_total &&
      antes.trafico_whatsapp_total === despues.trafico_whatsapp_total;

    reporte.peticionesBloqueadas = peticionesBloqueadas;
    reporte.tipifWppOk = tipifWppOk;
    reporte.otrasBasesIguales = otrasBasesIguales;
    log('¿tipificacion_whatsapp queda SOLO en [2026-08, 2026-09]?', tipifWppOk);
    log('¿Ninguna otra base cambió?', otrasBasesIguales);
    log('Peticiones de escritura bloqueadas fuera de /admin/borrado-rango (debe ser 0):', peticionesBloqueadas.length);

    if (borrado.ok !== true || borrado.borradas !== FILAS_ESPERADAS) {
      throw new Error('El borrado no devolvió ok:true con 71 filas borradas: ' + JSON.stringify(borrado));
    }
    if (!tipifWppOk || !otrasBasesIguales) {
      throw new Error('Verificación post-borrado falló -- revisar manualmente.');
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
