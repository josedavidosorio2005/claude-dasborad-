// fase130-inventario-meses.js — Fase 130, Parte 1. Script de un solo uso,
// SOLO LECTURA: por cada base de datos de ORLANT, que meses (AAAA-MM)
// tienen filas y cuantas. Nunca imprime una fila cruda ni un nombre --
// solo meses + conteos. No llama ningun endpoint de escritura.
//
// Playwright DIRECTO desde Node (headless:false), NO la extension de
// Claude in Chrome (CLAUDE.md). Login manual en la ventana (hasta 10 min).
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));

const BASE = 'https://informa.inconexion.com.co';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
const CAMPANA = 'ORLANT';

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

// Agrupa una lista de fechas 'AAAA-MM-DD' (o 'AAAA-MM...') en conteo por mes.
function contarPorMes(fechas) {
  const out = {};
  for (const f of fechas) {
    const m = String(f || '').slice(0, 7);
    if (!m) continue;
    out[m] = (out[m] || 0) + 1;
  }
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
    if (!logueado) throw new Error('Se agotó el tiempo de espera de login (10 min) sin detectar sesión iniciada.');
    log('Login detectado, continuando automáticamente.');
    await page.waitForTimeout(500);

    // Defensa: bloquea CUALQUIER peticion de escritura (este script es
    // 100% solo lectura, nunca deberia intentar una).
    const peticionesBloqueadas = [];
    await page.route('**/*', (route) => {
      const req = route.request();
      const m = req.method();
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(m)) {
        peticionesBloqueadas.push(m + ' ' + new URL(req.url()).pathname);
        return route.abort();
      }
      return route.continue();
    });

    // --- Bases con /opciones ya agregado (traen 'meses' directo) ---
    const agendasOpc = await page.evaluate((c) => apiRequest('GET', `/calidad/agendas/opciones?campana=${c}`), CAMPANA);
    reporte.agendas = { meses: agendasOpc.meses || [] };

    const inasistOpc = await page.evaluate((c) => apiRequest('GET', `/calidad/inasistencia/opciones?campana=${c}`), CAMPANA);
    reporte.inasistencia = { meses: inasistOpc.meses || [], mesesFormatoViejo: inasistOpc.mesesFormatoViejo || [] };

    const efAgOpc = await page.evaluate((c) => apiRequest('GET', `/calidad/efectividad-agendamiento/opciones?campana=${c}`), CAMPANA);
    reporte.efectividad_agendamiento = { meses: efAgOpc.meses || [] };

    const efCitasOpc = await page.evaluate((c) => apiRequest('GET', `/calidad/efectividad-citas/opciones?campana=${c}`), CAMPANA);
    reporte.efectividad_citas = { meses: efCitasOpc.meses || [] };

    const salidaOpc = await page.evaluate((c) => apiRequest('GET', `/calidad/salida/opciones?campana=${c}`), CAMPANA);
    reporte.salida = { meses: salidaOpc.meses || [] };

    const tipifLlamOpc = await page.evaluate((c) => apiRequest('GET', `/calidad/tipificacion/opciones?campana=${c}&canal=LLAMADAS`), CAMPANA);
    reporte.tipificacion_llamadas = { meses: tipifLlamOpc.meses || [] };

    const tipifWppOpc = await page.evaluate((c) => apiRequest('GET', `/calidad/tipificacion/opciones?campana=${c}&canal=WHATSAPP`), CAMPANA);
    reporte.tipificacion_whatsapp = { meses: tipifWppOpc.meses || [] };

    // --- Bases SIN /opciones de meses: derivar de las filas crudas, sin
    // imprimir ninguna fila -- solo el conteo por mes. ---
    const traficoLlamadas = await page.evaluate((c) => apiRequest('GET', `/calidad/nivel-servicio/diario?campana=${c}`), CAMPANA);
    reporte.trafico_llamadas = { porMes: contarPorMes(traficoLlamadas.map((r) => r.fecha)), filasTotales: traficoLlamadas.length };

    const traficoWpp = await page.evaluate((c) => apiRequest('GET', `/calidad/trafico/whatsapp?campana=${c}`), CAMPANA);
    reporte.trafico_whatsapp = { porMes: contarPorMes(traficoWpp.map((r) => r.fechaInicio)), filasTotales: traficoWpp.length };

    // Monitoreos (Calidad): trae asesor (nombre real) -- NUNCA se imprime,
    // solo se usa 'mes' y el conteo.
    const monitoreos = await page.evaluate((c) => apiRequest('GET', `/monitoreos?campana=${c}`), CAMPANA);
    const monPorMes = {};
    monitoreos.forEach((r) => { monPorMes[r.mes] = (monPorMes[r.mes] || 0) + 1; });
    reporte.monitoreos = { porMes: monPorMes, filasTotales: monitoreos.length };

    // Cronograma/Metas: trae liderNombre -- NUNCA se imprime, solo 'mes'.
    const metas = await page.evaluate((c) => apiRequest('GET', `/metas?campana=${c}`), CAMPANA);
    const metasPorMes = {};
    metas.forEach((r) => { metasPorMes[r.mes] = (metasPorMes[r.mes] || 0) + 1; });
    reporte.cronograma_metas = { porMes: metasPorMes, filasTotales: metas.length };

    reporte.peticionesBloqueadas = peticionesBloqueadas;
    reporte.ok = true;

    console.log('\n=== INVENTARIO DE MESES POR BASE (ORLANT) — JSON ===');
    console.log(JSON.stringify(reporte, null, 2));
    console.log('\nPeticiones de escritura bloqueadas (debe ser 0):', peticionesBloqueadas.length);
  } catch (e) {
    console.error('FALLO:', e.message);
    ok = false;
  } finally {
    if (browser) await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
