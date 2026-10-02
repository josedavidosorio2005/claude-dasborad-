// generar-capturas-guia-uso.js — Fase 100 (Tema B, guía de uso). Genera las
// capturas de pantalla que ilustran `docs/guia-uso-orlant.md` y
// `docs/guia-uso-orlant.md` y `server/paginas/guia-uso.html`, SIEMPRE con datos de demo (`npm run seed:demo`,
// http://localhost:3000) -- nunca datos reales de clientes. Se guardan en
// `docs/img/guia-uso/` (repo) y se copian a `public/img/guia/` (servidas
// por la app dentro de la guía web).
//
// Playwright directo desde Node (regla fija del proyecto, CLAUDE.md) -- NO
// la extension de Claude in Chrome.
'use strict';
const fs = require('fs');
const path = require('path');

const SERVER_DIR = path.join(__dirname, '..', '..', 'server');
const { chromium } = require(path.join(SERVER_DIR, 'node_modules', 'playwright'));

const BASE = process.env.LOCAL_URL || 'http://localhost:3000';
const DIR_DOCS = path.join(__dirname, '..', '..', 'docs', 'img', 'guia-uso');
const DIR_PUBLIC = path.join(__dirname, '..', '..', 'public', 'img', 'guia');
const CRED_FILE = path.join(SERVER_DIR, 'data', 'seed-demo-credenciales.txt');

function log(...args) { console.log(new Date().toISOString(), ...args); }

function leerCredenciales() {
  const texto = fs.readFileSync(CRED_FILE, 'utf8');
  const creds = {};
  texto.split('\n').forEach((linea) => {
    const m = linea.match(/^(\w+)\s+user:\s*(\S+)\s+password:\s*(\S+)/);
    if (m) creds[m[1]] = { user: m[2], password: m[3] };
  });
  return creds;
}

async function shot(page, name) {
  const p1 = path.join(DIR_DOCS, name);
  await page.screenshot({ path: p1, fullPage: false });
  fs.copyFileSync(p1, path.join(DIR_PUBLIC, name));
  log('Captura:', name);
}

(async () => {
  fs.mkdirSync(DIR_DOCS, { recursive: true });
  fs.mkdirSync(DIR_PUBLIC, { recursive: true });
  const creds = leerCredenciales();

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    // 1. Pantalla de login (sin sesion).
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);
    await shot(page, '01-login.png');

    // Login como admin de demo.
    await page.fill('#username', creds.ADMIN.user);
    await page.fill('#password', creds.ADMIN.password);
    await page.click('.btn-login');
    await page.waitForFunction(() => typeof authToken !== 'undefined' && !!authToken, { timeout: 10000 });
    await page.waitForTimeout(600);
    await page.evaluate(() => { if (typeof aplicarTema === 'function') aplicarTema('light'); });

    // 2. Dashboard de ORLANT, con las 6 pestañas visibles.
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1500);
    await page.evaluate(() => { if (typeof _gdIrAMes === 'function') _gdIrAMes('2026-08'); });
    await page.waitForTimeout(1000);
    await shot(page, '02-dashboard-orlant.png');

    // 3. Inasistencia, sub-pestaña "Por mes" (vista principal desde la Fase 101).
    await page.evaluate(() => switchGenericTab('inasistencia'));
    await page.waitForTimeout(1500);
    await shot(page, '03-inasistencia-por-mes.png');
    await page.evaluate(() => closeGenericDashboard());
    await page.waitForTimeout(300);

    // 4. Cargar Datos (plantilla consolidada).
    await page.evaluate(() => openCargas());
    await page.waitForTimeout(800);
    await page.selectOption('#carga-cliente', 'ORLANT').catch(() => {});
    await page.waitForTimeout(600);
    await shot(page, '04-cargar-datos.png');
    await page.evaluate(() => closeCargas());
    await page.waitForTimeout(300);

    // 5. Calidad, formulario de "Nuevo monitoreo" (sin guardar).
    await page.evaluate(() => openCalidad());
    await page.waitForTimeout(800);
    await page.selectOption('#cal-campana-sel', 'ORLANT').catch(() => {});
    await page.waitForTimeout(500);
    await page.evaluate(() => switchCalTab('nuevo'));
    await page.waitForTimeout(600);
    await shot(page, '05-calidad-nuevo-monitoreo.png');
    await page.evaluate(() => closeCalidad());
    await page.waitForTimeout(300);

    // 6. Administracion -> Usuarios (misma pagina, sin recargar).
    await page.evaluate(() => { if (typeof showSection === 'function') showSection('users'); });
    await page.waitForTimeout(800);
    await shot(page, '06-usuarios.png');

    log('Listo. Capturas en', DIR_DOCS, 'y', DIR_PUBLIC);
  } finally {
    await browser.close();
  }
})();
