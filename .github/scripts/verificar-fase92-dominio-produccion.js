// verificar-fase92-dominio-produccion.js — Fase 92. Verificacion visual EN
// PRODUCCION del dominio nuevo https://informa.inconexion.com.co: login
// real del usuario, recorrido de las 5 pestanas visibles de ORLANT
// (Calidad, Trafico de Llamadas, Trafico de WhatsApp, Agendamiento,
// Tipificacion) y conteo de errores de consola / peticiones fallidas /
// recursos servidos por HTTP plano (mixed content).
//
// Playwright DIRECTO desde Node (headless:false, navegador visible) -- NO
// la extension de Claude in Chrome (regla fija del proyecto, CLAUDE.md). El
// usuario inicia sesion a mano en la ventana que abre este script; el
// script nunca ve ni escribe la contrasena, y no persiste storageState ni
// cookies en disco -- todo vive en memoria de esta sola ejecucion de Node.
//
// Solo lectura: no sube archivos, no borra ni cambia ningun dato. Capturas
// fuera del repo, en "bases edwin/capturas-produccion/fase92-dominio/".
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'https://informa.inconexion.com.co';
const DIR_EDWIN = 'C:\\Users\\filid\\Documents\\trabajo inconexion\\bases edwin';
const OUT_DIR = path.join(DIR_EDWIN, 'capturas-produccion', 'fase92-dominio');
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

const TABS = ['calidad', 'trafico', 'trafico_whatsapp', 'agendamiento', 'tipificacion'];

function log(...args) { console.log(new Date().toISOString(), ...args); }

async function shot(page, name) {
  try { await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: false }); } catch (e) { log('WARN screenshot fallo:', e.message); }
}

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
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const erroresConsola = [];
  const peticionesFallidas = [];
  const recursosHttp = [];
  const reporte = { dominio: BASE, tabs: {} };
  let ok = true;
  let browser;

  try {
    browser = await chromium.launch({ headless: false });
    // Contexto nuevo, sin storageState -- nunca se persiste sesion/cookies en disco.
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    page.on('pageerror', (e) => erroresConsola.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push('console.error: ' + m.text()); });
    page.on('requestfinished', async (req) => {
      const url = req.url();
      if (url.startsWith('http://')) recursosHttp.push(url);
    });
    page.on('response', (res) => {
      if (res.status() >= 400) peticionesFallidas.push(res.status() + ' ' + res.url());
    });
    page.on('requestfailed', (req) => {
      peticionesFallidas.push('FAILED ' + req.url() + ' (' + (req.failure() && req.failure().errorText) + ')');
    });

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await shot(page, '0-landing.png');

    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Se agoto el tiempo de espera de login (10 min) sin detectar sesion iniciada.');
    log('Login detectado, continuando automaticamente.');
    await page.waitForTimeout(1000);
    await shot(page, '1-post-login.png');

    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1500);
    await shot(page, '2-orlant-abierto.png');

    for (let i = 0; i < TABS.length; i++) {
      const tab = TABS[i];
      log('Pestaña:', tab);
      await page.evaluate((t) => switchGenericTab(t), tab);
      await page.waitForTimeout(1800);
      await shot(page, `${3 + i}-tab-${tab}.png`);
      reporte.tabs[tab] = { visitada: true };
    }

    reporte.erroresConsola = erroresConsola;
    reporte.peticionesFallidas = peticionesFallidas;
    reporte.recursosHttp = recursosHttp;
    ok = erroresConsola.length === 0 && peticionesFallidas.length === 0 && recursosHttp.length === 0;
    reporte.ok = ok;

    console.log(JSON.stringify(reporte, null, 2));
  } catch (e) {
    console.error('FALLO:', e.message);
    reporte.erroresConsola = erroresConsola;
    reporte.peticionesFallidas = peticionesFallidas;
    reporte.recursosHttp = recursosHttp;
    console.log(JSON.stringify(reporte, null, 2));
    ok = false;
  } finally {
    if (browser) await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
