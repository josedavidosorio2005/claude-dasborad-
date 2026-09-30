// verificar-fase95-calidad-produccion.js — Fase 95. Verificacion visual EN
// PRODUCCION (https://informa.inconexion.com.co), SOLO LECTURA: confirma
// "v1.0.0" visible y en /api/health, el formulario de monitoreo de Calidad
// con fecha y evaluador bloqueados, la pantalla del catalogo de
// codificaciones (vacia, nadie la ha cargado todavia en produccion), y las
// 5 pestañas de ORLANT con 0 errores de consola / peticiones fallidas.
//
// Playwright DIRECTO desde Node (headless:false, navegador visible) -- NO
// la extension de Claude in Chrome (regla fija del proyecto, CLAUDE.md). El
// usuario inicia sesion a mano en la ventana que abre este script; el
// script nunca ve ni escribe la contrasena, y no persiste storageState ni
// cookies en disco -- todo vive en memoria de esta sola ejecucion de Node.
//
// Solo lectura: NO guarda ningun monitoreo ni codificacion -- solo abre las
// pantallas e inspecciona su estado. No sube archivos, no borra ni cambia
// ningun dato. Capturas fuera del repo, en
// "bases edwin/capturas-produccion/fase95-calidad/".
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'https://informa.inconexion.com.co';
const DIR_EDWIN = 'C:\\Users\\filid\\Documents\\trabajo inconexion\\bases edwin';
const OUT_DIR = path.join(DIR_EDWIN, 'capturas-produccion', 'fase95-calidad');
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

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
  const reporte = {};
  let ok = true;
  let browser;

  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    page.on('pageerror', (e) => erroresConsola.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push('console.error: ' + m.text()); });
    page.on('response', (res) => { if (res.status() >= 400) peticionesFallidas.push(res.status() + ' ' + res.url()); });
    page.on('requestfailed', (req) => peticionesFallidas.push('FAILED ' + req.url()));

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });

    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Se agoto el tiempo de espera de login (10 min) sin detectar sesion iniciada.');
    log('Login detectado, continuando automaticamente.');
    await page.waitForTimeout(1000);

    // ── version: "v1.0.0" visible + /api/health ────────────────────────────
    const healthRes = await page.evaluate(async () => {
      const r = await fetch('/api/health');
      return r.json();
    });
    reporte.health = healthRes;
    log('/api/health:', JSON.stringify(healthRes));
    await page.waitForTimeout(500);
    const versionVisible = await page.evaluate(() => {
      var els = document.querySelectorAll('.navbar-app-version');
      return Array.from(els).map((e) => e.textContent).find((t) => t && t.trim());
    });
    reporte.versionVisibleEnMenu = versionVisible;
    log('Version visible en el menu:', versionVisible);
    await shot(page, '1-version-menu-usuario.png');

    // ── formulario de monitoreo: fecha y evaluador bloqueados ──────────────
    await page.evaluate(() => openCalidad());
    await page.waitForTimeout(800);
    await page.selectOption('#cal-campana-sel', 'ORLANT').catch(() => {});
    await page.waitForTimeout(800);
    await page.evaluate(() => switchCalTab('nuevo'));
    await page.waitForTimeout(500);
    const formulario = await page.evaluate(() => ({
      fechaDisabled: document.getElementById('cf-fecha').disabled,
      fechaValor: document.getElementById('cf-fecha').value,
      evaluadorDisabled: document.getElementById('cf-evaluador').disabled,
      evaluadorValor: document.getElementById('cf-evaluador').value,
    }));
    reporte.formularioMonitoreo = formulario;
    log('Formulario de monitoreo (ORLANT):', JSON.stringify(formulario));
    await shot(page, '2-formulario-monitoreo-fecha-evaluador-bloqueados.png');

    // ── catalogo de codificaciones (vacio, nadie lo ha cargado aun) ────────
    await page.evaluate(() => switchCalTab('config'));
    await page.waitForTimeout(800);
    const catalogo = await page.evaluate(() => {
      var tabla = document.getElementById('cal-codificaciones-table');
      return { filas: tabla ? tabla.querySelectorAll('tr').length - 1 : null, texto: tabla ? tabla.innerText : null };
    });
    reporte.catalogoCodificaciones = catalogo;
    log('Catalogo de codificaciones (ORLANT):', JSON.stringify(catalogo));
    await shot(page, '3-catalogo-codificaciones-vacio.png');
    await page.evaluate(() => closeCalidad());
    await page.waitForTimeout(500);

    // ── las 5 pestañas de ORLANT, 0 errores de consola ─────────────────────
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1500);
    const tabsInfo = await page.evaluate(() => ({ tabsVisibles: _gdTabsVisibles().map((t) => t.key), tabActiva: _gd.tab }));
    reporte.tabsOrlant = tabsInfo;
    log('Pestañas visibles de ORLANT:', JSON.stringify(tabsInfo));
    for (const tabKey of tabsInfo.tabsVisibles) {
      await page.evaluate((k) => switchGenericTab(k), tabKey);
      await page.waitForTimeout(1500);
      await shot(page, `4-tab-${tabKey}.png`);
    }

    reporte.erroresConsola = erroresConsola;
    reporte.peticionesFallidas = peticionesFallidas;
    ok = erroresConsola.length === 0 && peticionesFallidas.length === 0
      && formulario.fechaDisabled === true
      && formulario.evaluadorDisabled === true
      && healthRes.version === '1.0.0'
      && !!versionVisible;
    reporte.ok = ok;

    console.log(JSON.stringify(reporte, null, 2));
    fs.writeFileSync(path.join(OUT_DIR, 'reporte.json'), JSON.stringify(reporte, null, 2));
  } catch (e) {
    console.error('FALLO:', e.message);
    reporte.erroresConsola = erroresConsola;
    reporte.peticionesFallidas = peticionesFallidas;
    console.log(JSON.stringify(reporte, null, 2));
    ok = false;
  } finally {
    if (browser) await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
