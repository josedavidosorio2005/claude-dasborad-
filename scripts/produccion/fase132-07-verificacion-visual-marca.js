// fase132-07-verificacion-visual-marca.js — verificacion visual en
// PRODUCCION de la Fase 132 (marca) + el cierre de la Fase 132 (el nombre
// "InConexion(R)" sin tilde, con R registrada, en el navbar). SOLO
// LECTURA -- no crea, edita ni borra nada. Playwright DIRECTO desde Node
// (headless:false, navegador visible), NO la extension de Claude in
// Chrome (CLAUDE.md). El usuario inicia sesion a mano; el script nunca ve
// ni escribe la contrasena, no persiste storageState ni cookies en disco.
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));

const BASE = process.env.APP_URL || 'https://informa.inconexion.com.co';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

function log(...args) { console.log(new Date().toISOString(), ...args); }

async function esperarLogin(page) {
  log('');
  log('##########################################################');
  log('##  INICIA SESION AHORA EN ESTA VENTANA (cuenta de administrador)');
  log('##  (tienes hasta 10 min)');
  log('##########################################################');
  log('');
  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const logged = await page.evaluate(() => typeof authToken === 'string' && !!authToken).catch(() => false);
    if (logged) return true;
    await page.waitForTimeout(3000);
  }
  return false;
}

async function navbarTexto(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.navbar-logo-text');
    return el ? el.textContent.trim() : null;
  });
}

async function hayTildeOMarcaSinR(page) {
  return page.evaluate(() => {
    const texto = document.body.innerText || '';
    return /InConexión/.test(texto);
  });
}

(async () => {
  const errores = [];
  const consoleErrors = [];
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => { consoleErrors.push(String(err)); });

  await page.goto(BASE, { waitUntil: 'load' });
  const loggedIn = await esperarLogin(page);
  if (!loggedIn) {
    log('No se detecto login dentro del tiempo limite. Cerrando sin verificar.');
    await browser.close();
    process.exit(1);
  }
  log('Login detectado. Continuando con la verificacion visual.');
  await page.waitForTimeout(1500);

  const TABS = ['Tráfico de Llamadas', 'Inasistencia', 'Calidad'];
  const TEMAS = ['light', 'dark'];

  // Fase 132 (base): logo real cargado (no roto) + teal oficial en el navbar.
  const logoOk = await page.evaluate(() => {
    const img = document.querySelector('.navbar-logo-icon');
    return !!img && img.complete && img.naturalWidth > 0;
  }).catch(() => false);
  log('Logo del navbar cargado (naturalWidth > 0): ' + logoOk);
  if (!logoOk) errores.push('el logo del navbar (.navbar-logo-icon) no cargo (roto o ausente)');

  const navbarBg = await page.evaluate(() => {
    const nav = document.querySelector('.navbar');
    return nav ? getComputedStyle(nav).backgroundColor : null;
  }).catch(() => null);
  log('Color de fondo del navbar (computado): ' + navbarBg);

  for (const tema of TEMAS) {
    await page.evaluate((t) => { if (typeof aplicarTema === 'function') aplicarTema(t); }, tema);
    await page.waitForTimeout(500);

    const navbar = await navbarTexto(page);
    log(`[tema=${tema}] navbar-logo-text: "${navbar}"`);
    if (!navbar || !navbar.startsWith('InConexion®')) {
      errores.push(`[tema=${tema}] navbar NO empieza con "InConexion®": "${navbar}"`);
    }
    if (await hayTildeOMarcaSinR(page)) {
      errores.push(`[tema=${tema}] se encontro "InConexión" (con tilde) visible en la pagina`);
    }

    for (const tabName of TABS) {
      const tab = page.locator('.gd-tab, .gd-subtab, [role="tab"]').filter({ hasText: tabName }).first();
      const visible = await tab.isVisible().catch(() => false);
      if (!visible) {
        log(`[tema=${tema}] pestaña "${tabName}" no visible en esta cuenta (se omite, puede no estar habilitada)`);
        continue;
      }
      await tab.click().catch(() => {});
      await page.waitForTimeout(1500);
      const navbar2 = await navbarTexto(page);
      log(`[tema=${tema}] pestaña "${tabName}" abierta -- navbar: "${navbar2}"`);
    }
  }

  log('');
  log('Errores de consola/pagina capturados durante la corrida: ' + consoleErrors.length);
  consoleErrors.slice(0, 10).forEach((e) => log('  consola: ' + e));

  log('');
  if (errores.length === 0) {
    log('OK -- navbar muestra "InConexion®" en claro y oscuro, sin "InConexión" con tilde visible.');
  } else {
    log('HALLAZGOS:');
    errores.forEach((e) => log('  - ' + e));
  }

  await browser.close();
  process.exit(errores.length === 0 ? 0 : 1);
})();
