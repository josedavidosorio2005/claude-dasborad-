// fase132-08-verificacion-visual-logo-mobilize.js — verificacion visual en
// PRODUCCION de la Fase 132 (Parte 8): el logo de Mobilize en el
// encabezado de su propio dashboard, y SOLO el suyo. SOLO LECTURA -- no
// crea, edita ni borra nada. Playwright DIRECTO desde Node (headless:
// false, navegador visible), NO la extension de Claude in Chrome
// (CLAUDE.md). El usuario inicia sesion a mano; el script nunca ve ni
// escribe la contrasena, no persiste storageState ni cookies en disco.
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

async function revisarLogoCliente(page, cliente) {
  const abierto = await page.evaluate((c) => {
    if (typeof openGenericDashboard !== 'function') return false;
    openGenericDashboard(c);
    return true;
  }, cliente).catch(() => false);
  if (!abierto) { log(`[${cliente}] no se pudo abrir el dashboard (openGenericDashboard no disponible)`); return null; }
  await page.waitForTimeout(1800);
  const info = await page.evaluate(() => {
    const el = document.getElementById('gd-cliente-logo');
    return el ? {
      display: getComputedStyle(el).display,
      src: el.getAttribute('src'),
      naturalWidth: el.naturalWidth,
      naturalHeight: el.naturalHeight,
    } : null;
  });
  log(`[${cliente}] gd-cliente-logo: ${JSON.stringify(info)}`);
  await page.evaluate(() => { if (typeof closeGenericDashboard === 'function') closeGenericDashboard(); });
  await page.waitForTimeout(500);
  return info;
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

  const mobilize = await revisarLogoCliente(page, 'MOBILIZE');
  if (!mobilize || mobilize.display !== 'block' || !mobilize.naturalWidth) {
    errores.push('MOBILIZE: el logo no se muestra o no cargo -- ' + JSON.stringify(mobilize));
  } else if (mobilize.naturalWidth > 140) {
    errores.push('MOBILIZE: el logo mide mas de 140px de ancho (' + mobilize.naturalWidth + 'px)');
  }

  const orlant = await revisarLogoCliente(page, 'ORLANT');
  if (!orlant || orlant.display !== 'none' || orlant.src) {
    errores.push('ORLANT: el logo de Mobilize NO deberia verse aqui -- ' + JSON.stringify(orlant));
  }

  log('');
  log('Errores de consola/pagina capturados durante la corrida: ' + consoleErrors.length);
  consoleErrors.slice(0, 10).forEach((e) => log('  consola: ' + e));

  log('');
  if (errores.length === 0) {
    log('OK -- el logo de Mobilize se ve solo en su propio dashboard (140px), ORLANT sin cambios.');
  } else {
    log('HALLAZGOS:');
    errores.forEach((e) => log('  - ' + e));
  }

  await browser.close();
  process.exit(errores.length === 0 ? 0 : 1);
})();
