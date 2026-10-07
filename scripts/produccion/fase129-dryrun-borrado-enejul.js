// fase129-dryrun-borrado-enejul.js — Script de un solo uso, Fase 129.
// Paso 2 de la Opción B aprobada: dry-run del borrado por rango
// (POST /admin/borrado-rango SIN confirmar -- dry-run por diseño del
// propio servidor, nunca escribe) de ene-jul 2026, base `inasistencia`,
// SOLO ORLANT. Muestra el conteo real (que el servidor devuelve) y, por
// separado, confirma por lectura independiente que Tipificación de
// WhatsApp de julio (71 filas reales) no tiene ninguna razón para
// cambiar -- el candado de `base` en admin-borrado-rango.js hace
// IMPOSIBLE que este endpoint toque otra tabla, pero se verifica de
// todos modos, nunca solo se asume.
//
// Playwright DIRECTO desde Node (headless:false) -- NO la extensión de
// Claude in Chrome (CLAUDE.md). SOLO LECTURA: el POST que manda es,
// por diseño del servidor, un dry-run mientras `confirmar` no sea true
// -- este script JAMAS manda confirmar:true.
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));

const BASE = 'https://informa.inconexion.com.co';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
const FILAS_ESPERADAS = 2312; // Fase 126 ya borro exactamente este numero una vez

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

    // Defensa de red: cualquier peticion de escritura que NO sea
    // /admin/borrado-rango queda bloqueada; la de borrado-rango se deja
    // pasar (es el propio endpoint cuyo dry-run estamos probando -- su
    // seguridad es que el SERVIDOR nunca borra sin confirmar:true, nunca
    // este script).
    const peticionesBloqueadas = [];
    await page.route('**/*', (route) => {
      const req = route.request();
      const m = req.method();
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(m) && !/\/admin\/borrado-rango$/.test(new URL(req.url()).pathname)) {
        peticionesBloqueadas.push(m + ' ' + new URL(req.url()).pathname);
        return route.abort();
      }
      return route.continue();
    });

    const dryRun = await page.evaluate((filasEsperadas) => apiRequest('POST', '/admin/borrado-rango', {
      base: 'inasistencia', campana: 'ORLANT', mesDesde: '2026-01', mesHasta: '2026-07',
      filasEsperadas, confirmar: false,
    }), FILAS_ESPERADAS);
    log('Respuesta del dry-run (base=inasistencia, ene-jul 2026):', JSON.stringify(dryRun));
    reporte.dryRun = dryRun;

    // Cruce independiente: Tipificacion de WhatsApp de julio, sin tocar
    // nada -- debe seguir en 71 (archivo real ya cargado, sin relacion
    // con Inasistencia).
    const tipifWppJul = await page.evaluate(() => apiRequest('GET', '/calidad/tipificacion/por-tipo?campana=ORLANT&canal=WHATSAPP&mes=2026-07'));
    log('Tipificación de WhatsApp, Jul-26 (total, cruce independiente):', tipifWppJul.total);
    reporte.tipifWppJulTotal = tipifWppJul.total;
    reporte.peticionesBloqueadas = peticionesBloqueadas;

    const coincide = dryRun.dryRun === true && dryRun.filas === FILAS_ESPERADAS;
    const tipifOk = tipifWppJul.total === 71;
    log('¿Coincide con 2.312 EXACTO (y es dry-run, nunca borró)?', coincide);
    log('¿Tipificación WhatsApp Jul-26 sigue en 71?', tipifOk);
    log('Peticiones de escritura bloqueadas (debe ser 0):', JSON.stringify(peticionesBloqueadas));

    if (!coincide) {
      throw new Error('El conteo NO coincide con 2.312 (o el servidor no devolvió dryRun:true) -- NO se debe borrar nada: ' + JSON.stringify(dryRun));
    }
    if (!tipifOk) {
      throw new Error('Tipificación de WhatsApp Jul-26 cambió de 71 -- esto nunca debería pasar, deteniendo todo: ' + tipifWppJul.total);
    }
    if (peticionesBloqueadas.length > 0) {
      throw new Error('Alguna petición de escritura ajena a /admin/borrado-rango intentó salir: ' + JSON.stringify(peticionesBloqueadas));
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
