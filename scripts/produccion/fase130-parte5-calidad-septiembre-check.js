// fase130-parte5-calidad-septiembre-check.js — Fase 130 (continuacion).
// Script de un solo uso, SOLO LECTURA: cuantos monitoreos reales de
// Calidad ORLANT hay cargados para 2026-09 (septiembre), cuantos asesores
// y evaluadores DISTINTOS participan, y el promedio de puntaje. Nunca
// imprime un nombre -- solo conteos y el promedio numerico.
//
// Playwright DIRECTO desde Node (headless:false), NO la extension de
// Claude in Chrome (CLAUDE.md). Login manual en la ventana (hasta 10 min).
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));

const BASE = 'https://informa.inconexion.com.co';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
const CAMPANA = 'ORLANT';
const MES = '2026-09';

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

function clasificacionBucket(c) {
  const s = String(c || '');
  if (s.includes('SOBRESALIENTE')) return 'sobresaliente';
  if (s.includes('NO CRITICO') || s.includes('NO CRÍTICO')) return 'no_critico';
  if (s.includes('CRITICO') || s.includes('CRÍTICO')) return 'critico';
  return 'desconocido';
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
    if (!logueado) throw new Error('Se agotó el tiempo de espera de login (10 min) sin detectar sesión iniciada.');
    log('Login detectado, continuando automáticamente.');
    await page.waitForTimeout(500);

    // Defensa: este script es 100% solo lectura, bloquea cualquier
    // peticion de escritura por si algo la dispara por accidente.
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

    const monitoreos = await page.evaluate(
      ({ c, mes }) => apiRequest('GET', `/monitoreos?campana=${c}&mes=${mes}`),
      { c: CAMPANA, mes: MES }
    );

    const asesores = new Set();
    const evaluadores = new Set();
    const buckets = { sobresaliente: 0, no_critico: 0, critico: 0, desconocido: 0 };
    let sumaPuntaje = 0;
    let conPuntaje = 0;
    for (const r of monitoreos) {
      if (r.asesor) asesores.add(r.asesor.trim().toLowerCase());
      if (r.evaluador) evaluadores.add(r.evaluador.trim().toLowerCase());
      buckets[clasificacionBucket(r.clasificacion)]++;
      if (typeof r.puntaje === 'number') {
        sumaPuntaje += r.puntaje;
        conPuntaje++;
      }
    }
    const promedio = conPuntaje ? sumaPuntaje / conPuntaje : null;

    const reporte = {
      campana: CAMPANA,
      mes: MES,
      totalMonitoreos: monitoreos.length,
      asesoresDistintos: asesores.size,
      evaluadoresDistintos: evaluadores.size,
      promedioPuntaje: promedio === null ? null : Number(promedio.toFixed(2)),
      clasificacion: buckets,
      peticionesBloqueadas,
    };

    console.log('\n=== CALIDAD ORLANT — SEPTIEMBRE 2026-09 — JSON (sin nombres) ===');
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
