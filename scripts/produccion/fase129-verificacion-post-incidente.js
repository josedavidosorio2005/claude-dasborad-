// fase129-verificacion-post-incidente.js — Script de un solo uso, Fase 129.
// Verificación de SOLO LECTURA (ningún POST/PUT/DELETE) después de la
// escritura accidental de hoy: confirma agosto contra los números de
// control, septiembre sin cambios, y la pestaña Inasistencia sin canvas en
// blanco ni errores de consola. Playwright DIRECTO desde Node
// (headless:false) -- NO la extensión de Claude in Chrome (CLAUDE.md).
//
// PRIVACIDAD: nunca imprime NOMBRE ENTIDAD -- solo conteos/porcentajes.
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));

const BASE = 'https://informa.inconexion.com.co';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

// Números de control de agosto (dados por el usuario, confirmados contra
// el archivo real en el diagnóstico de esta misma fase).
const CONTROL_AGO = { total: 11189, cancelada: 2459, inasistencia: 786, pendiente: 48, atendidas: 7896, especialidades: 18, pct: 7.45 };
const CONTROL_SEDES_AGO = { 'SEDE PRINCIPAL': { total: 6367, inasistencia: 417 }, 'SEDE 34': { total: 3384, inasistencia: 263 }, 'SEDE POBLADO': { total: 754, inasistencia: 67 }, 'SEDE RIONEGRO': { total: 584, inasistencia: 30 }, 'SEDE LLANOGRANDE': { total: 100, inasistencia: 9 } };
// Septiembre tal como quedó documentado antes de hoy (Fase 126/128): no
// debe haber cambiado -- esta carga solo tocó meses='2026-08'.
const CONTROL_SEP_ANTES = { total: 1483, inasistencia: 94, pendiente: 2, especialidades: 1 };

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
  const hallazgos = [];
  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const erroresConsola = [];
    page.on('pageerror', (e) => erroresConsola.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push('console.error: ' + m.text()); });

    // Esta corrida es PURAMENTE de lectura -- si algo intenta escribir,
    // abortar (defensa adicional, no solo "no hacemos clic en guardar").
    await page.route('**/calidad/**', (route) => {
      const method = route.request().method();
      if (method !== 'GET') {
        erroresConsola.push('BLOQUEADO (verificacion de solo lectura): ' + method + ' ' + route.request().url());
        return route.abort();
      }
      return route.continue();
    });

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Se agotó el tiempo de espera de login (10 min) sin detectar sesión iniciada.');
    log('Login detectado, continuando automáticamente.');
    await page.waitForTimeout(500);

    // ── Agosto: resumen + por especialidad + por sede ────────────────
    const resumenAgo = await page.evaluate(() => apiRequest('GET', '/calidad/inasistencia/resumen?campana=ORLANT&mes=2026-08'));
    log('Resumen Ago-26 (ahora):', JSON.stringify(resumenAgo));
    ['cancelada', 'inasistencia', 'pendiente', 'atendidas', 'total'].forEach((k) => {
      if (resumenAgo[k] !== CONTROL_AGO[k]) hallazgos.push(`Ago-26 ${k}: esperado ${CONTROL_AGO[k]}, real ${resumenAgo[k]}`);
    });
    if (resumenAgo.pct !== CONTROL_AGO.pct) hallazgos.push(`Ago-26 pct: esperado ${CONTROL_AGO.pct}, real ${resumenAgo.pct}`);

    const especialidadAgo = await page.evaluate(() => apiRequest('GET', '/calidad/inasistencia/especialidad?campana=ORLANT&mes=2026-08'));
    log('Especialidades distintas en Ago-26 (ahora):', especialidadAgo.length);
    if (especialidadAgo.length !== CONTROL_AGO.especialidades) hallazgos.push(`Ago-26 especialidades: esperado ${CONTROL_AGO.especialidades}, real ${especialidadAgo.length}`);

    const porSede = {};
    for (const sede of Object.keys(CONTROL_SEDES_AGO)) {
      const r = await page.evaluate((s) => apiRequest('GET', '/calidad/inasistencia/resumen?campana=ORLANT&mes=2026-08&sede=' + encodeURIComponent(s)), sede);
      porSede[sede] = { total: r.total, inasistencia: r.inasistencia };
      if (r.total !== CONTROL_SEDES_AGO[sede].total || r.inasistencia !== CONTROL_SEDES_AGO[sede].inasistencia) {
        hallazgos.push(`Ago-26 sede ${sede}: esperado ${JSON.stringify(CONTROL_SEDES_AGO[sede])}, real ${JSON.stringify(porSede[sede])}`);
      }
    }
    log('Por sede, Ago-26 (ahora):', JSON.stringify(porSede, null, 2));

    // ── Septiembre: debe seguir EXACTO a como estaba antes de hoy ────
    const mensual = await page.evaluate(() => apiRequest('GET', '/calidad/inasistencia/mensual?campana=ORLANT'));
    const sep = mensual.filter((f) => f.mes === '2026-09');
    const sepTotales = sep.reduce((a, f) => ({ total: a.total + f.total, inasistencia: a.inasistencia + f.inasistencia, pendiente: a.pendiente + f.pendiente }), { total: 0, inasistencia: 0, pendiente: 0 });
    sepTotales.especialidades = sep.length;
    log('Septiembre (ahora):', JSON.stringify(sepTotales));
    ['total', 'inasistencia', 'pendiente', 'especialidades'].forEach((k) => {
      if (sepTotales[k] !== CONTROL_SEP_ANTES[k]) hallazgos.push(`Sep-26 ${k}: esperado (sin cambios) ${CONTROL_SEP_ANTES[k]}, real ${sepTotales[k]}`);
    });

    // ── Entidades (SOLO el conteo, nunca la lista) ───────────────────
    const opciones = await page.evaluate(() => apiRequest('GET', '/calidad/inasistencia/opciones?campana=ORLANT'));
    log('Entidades distintas (conteo, ahora, global Ago+Sep):', opciones.entidades.length);
    log('Meses en formato viejo:', JSON.stringify(opciones.mesesFormatoViejo));

    // ── Visual: pestaña Inasistencia, las 2 sub-pestañas, sin canvas en
    // blanco ni errores de consola ────────────────────────────────────
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);
    await page.evaluate(() => { if (typeof _gdIrAMes === 'function') _gdIrAMes('2026-08'); });
    await page.waitForTimeout(500);
    await page.evaluate(() => switchGenericTab('inasistencia'));
    await page.waitForTimeout(1500);

    const visualPorMes = await page.evaluate(() => {
      const canvases = Array.from(document.querySelectorAll('#gd-panels canvas'));
      return { canvases: canvases.length, canvasesConDibujo: canvases.filter((c) => c.getContext && c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v) => v !== 0)).length };
    });
    log('Visual "Resumen por mes":', JSON.stringify(visualPorMes));
    if (visualPorMes.canvases > 0 && visualPorMes.canvasesConDibujo === 0) hallazgos.push('Resumen por mes: canvas presente pero en blanco.');

    await page.evaluate(() => switchGenericSubtab('porespecialidad'));
    await page.waitForTimeout(1500);
    const visualPorEsp = await page.evaluate(() => {
      const canvases = Array.from(document.querySelectorAll('#gd-panels canvas'));
      return { canvases: canvases.length, canvasesConDibujo: canvases.filter((c) => c.getContext && c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v) => v !== 0)).length };
    });
    log('Visual "Por especialidad":', JSON.stringify(visualPorEsp));
    if (visualPorEsp.canvases > 0 && visualPorEsp.canvasesConDibujo === 0) hallazgos.push('Por especialidad: canvas presente pero en blanco.');

    if (erroresConsola.length) {
      log('ERRORES DE CONSOLA/BLOQUEOS DE ESCRITURA:', JSON.stringify(erroresConsola));
      hallazgos.push(...erroresConsola);
    } else {
      log('0 errores de consola, 0 peticiones de escritura bloqueadas (ninguna se intentó).');
    }

    console.log('\n=== HALLAZGOS ===');
    console.log(hallazgos.length ? JSON.stringify(hallazgos, null, 2) : 'NINGUNO -- todo coincide con el control.');
    ok = hallazgos.length === 0;
  } catch (e) {
    console.error('FALLO:', e.message);
    ok = false;
  } finally {
    if (browser) await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
