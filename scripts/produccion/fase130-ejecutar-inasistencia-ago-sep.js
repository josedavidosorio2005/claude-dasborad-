// fase130-ejecutar-inasistencia-ago-sep.js — Fase 130, Parte 2.
// Ejecuta el guardado REAL de Inasistencia ago+sep/2026 por la UI real
// (Cargar Datos de Dashboards -> ORLANT -> archivo real de Descargas),
// con "sí" explícito del usuario y respaldo manual ya confirmado
// (integrity_check:ok, S3:OK). A diferencia del dry-run, aquí SÍ se deja
// pasar window.confirm (que el propio flujo de guardado dispara una sola
// vez, con el resumen "Se cargará como Ago-26 (18 especialidades) y
// Sep-26 (19 especialidades)...") y SÍ se deja pasar el POST real de
// guardado -- pero bloqueando cualquier OTRA petición de escritura que no
// sea la de este guardado puntual (defensa en profundidad, mismo patrón
// que las fases anteriores).
//
// Playwright DIRECTO desde Node (headless:false), NO la extensión de
// Claude in Chrome. SOLO imprime conteos/meses -- nunca una fila cruda,
// nunca un nombre de entidad.
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));

const BASE = 'https://informa.inconexion.com.co';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
const ARCHIVO = path.join('C:', 'Users', 'filid', 'Downloads', 'INASISTENCIA DE AGOSTO Y SEPTIEMBRE.xlsx');

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
  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Se agotó el tiempo de espera de login.');
    log('Login detectado.');
    await page.waitForTimeout(500);

    // Defensa: cualquier escritura que NO sea la carga/impacto de
    // inasistencia queda bloqueada -- este script solo debe guardar ESO.
    const peticionesBloqueadas = [];
    await page.route('**/*', (route) => {
      const req = route.request();
      const m = req.method();
      const pathname = new URL(req.url()).pathname;
      const permitido = /\/calidad\/inasistencia\/carga(\/impacto)?$/.test(pathname);
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(m) && !permitido) {
        peticionesBloqueadas.push(m + ' ' + pathname);
        return route.abort();
      }
      return route.continue();
    });

    const confirmsVistos = [];
    await page.evaluate(() => {
      window.__confirmsVistos = [];
      const real = window.confirm;
      window.confirm = function (msg) {
        window.__confirmsVistos.push(msg);
        return true; // ya autorizado explicitamente por el usuario
      };
    });

    await page.evaluate(() => openCargas());
    await page.waitForSelector('#carga-cliente', { state: 'visible', timeout: 10000 });
    await page.selectOption('#carga-cliente', { label: 'ORLANT' });
    await page.waitForTimeout(800);

    log('Subiendo el archivo real (fuera del repo, Descargas)...');
    await page.setInputFiles('#carga-file', ARCHIVO);
    await page.waitForTimeout(3000);

    const errores = await page.evaluate(() => (document.getElementById('carga-errores') || {}).textContent || '');
    if (errores.trim()) log('Avisos mostrados en pantalla (preview):', errores.trim());

    log('Guardando de verdad (guardarCarga())...');
    await page.evaluate(() => guardarCarga());
    await page.waitForTimeout(3000);

    const confirmados = await page.evaluate(() => window.__confirmsVistos || []);
    log('Mensajes de confirmación mostrados (deben mencionar Ago-26/Sep-26):', JSON.stringify(confirmados));

    const toast = await page.evaluate(() => {
      const el = document.querySelector('.toast, #toast, [class*="toast"]');
      return el ? el.textContent : null;
    });
    log('Mensaje final (toast) tras guardar:', toast);

    log('Peticiones de escritura bloqueadas fuera de inasistencia/carga (debe ser 0):', peticionesBloqueadas.length, JSON.stringify(peticionesBloqueadas));
    if (peticionesBloqueadas.length > 0) {
      throw new Error('Alguna petición de escritura ajena a inasistencia/carga intentó salir.');
    }
    if (!confirmados.length || !/Ago-26/.test(confirmados[0]) || !/Sep-26/.test(confirmados[0])) {
      throw new Error('El mensaje de confirmación no menciona Ago-26 y Sep-26 como se esperaba: ' + JSON.stringify(confirmados));
    }

    console.log('\n=== OK: guardado ejecutado ===');
  } catch (e) {
    console.error('FALLO:', e.message);
    ok = false;
  } finally {
    if (browser) await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
