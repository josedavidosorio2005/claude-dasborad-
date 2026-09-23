// verificar-fase64-auditoria-completa.js — QA de un solo uso, Fase 64, Parte E.
//
// Recorre Calidad / Trafico de Llamadas / Trafico de WhatsApp en ORLANT +
// 4 clientes mas (CLINICA AURORA, HOSPITAL LA MARIA, TELEVENTAS COMFAMA,
// BIVETT), claro/oscuro y escritorio/movil, capturando errores de consola y
// datos incorrectos visibles (NaN/undefined/[object Object]). Solo lectura.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.APP_URL || 'http://localhost:3000';
const ADMIN_USER = process.env.QA_ADMIN_USER || 'demo_admin';
const ADMIN_PW = process.env.QA_ADMIN_PW;
const OUT_DIR = process.env.OUT_DIR ||
  path.join(__dirname, '..', '..', 'docs', 'capturas-demo', 'fase64-auditoria-completa');

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 412, height: 915 };

const CLIENTES = [
  { cliente: 'ORLANT', tabs: ['calidad', 'trafico', 'trafico_whatsapp'] },
  { cliente: 'CLINICA AURORA', tabs: ['calidad', 'trafico'] },
  { cliente: 'HOSPITAL LA MARIA', tabs: ['trafico'] }, // sin Calidad, ver Fase 61/63
  { cliente: 'TELEVENTAS COMFAMA', tabs: ['calidad', 'trafico'] },
  { cliente: 'BIVETT', tabs: ['calidad', 'trafico'] },
];

const TEXTO_MALO_RE = /\bNaN\b|\bundefined\b|\[object Object\]/;

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: false });
}
async function setTema(page, tema) {
  await page.evaluate((t) => { if (typeof aplicarTema === 'function') aplicarTema(t); }, tema);
  await page.waitForTimeout(200);
}

(async () => {
  if (!ADMIN_PW) { console.error('Falta QA_ADMIN_PW en el entorno.'); process.exit(1); }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const consoleErrors = [];
  const resultado = { clientes: {} };
  let ok = true;

  try {
    const page = await browser.newPage({ viewport: DESKTOP });
    page.on('dialog', (d) => d.accept());
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#username', ADMIN_USER);
    await page.fill('#password', ADMIN_PW);
    await page.click('button.btn-login');
    await page.waitForTimeout(1200);
    const loginErr = await page.locator('#login-error').innerText().catch(() => '');
    if (loginErr && loginErr.trim()) throw new Error('Login fallo: ' + loginErr.trim());
    resultado.loginOk = true;

    for (const { cliente, tabs } of CLIENTES) {
      const slug = cliente.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const entry = { tabs: {} };
      await page.evaluate((c) => openGenericDashboard(c), cliente);
      await page.waitForTimeout(1200);

      for (const tab of tabs) {
        const errAntes = consoleErrors.length;
        await page.evaluate((t) => switchGenericTab(t), tab);
        await page.waitForTimeout(1100);

        const bodyText = await page.evaluate(() => document.body.innerText);
        const textoMaloOk = !TEXTO_MALO_RE.test(bodyText);

        for (const [vpName, vp, tema] of [['desktop', DESKTOP, 'light'], ['desktop', DESKTOP, 'dark'], ['movil', MOBILE, 'light']]) {
          await page.setViewportSize(vp);
          await setTema(page, tema);
          await page.waitForTimeout(300);
          await shot(page, slug + '-' + tab + '-' + tema + '-' + vpName + '.png');
        }
        await page.setViewportSize(DESKTOP);
        await setTema(page, 'light');

        entry.tabs[tab] = {
          consoleErrorsNuevos: consoleErrors.slice(errAntes),
          textoMaloOk: textoMaloOk,
        };
      }

      await page.evaluate(() => { if (typeof closeGenericDashboard === 'function') closeGenericDashboard(); });
      resultado.clientes[cliente] = entry;
      console.log(cliente + ':', JSON.stringify(entry, null, 2));
    }

    await page.close();
    resultado.consoleErrorsTotal = consoleErrors;
    ok = resultado.loginOk && consoleErrors.length === 0 &&
      Object.values(resultado.clientes).every((e) => Object.values(e.tabs).every((t) => t.textoMaloOk && t.consoleErrorsNuevos.length === 0));
    resultado.ok = ok;
    console.log('=== RESULTADO FINAL ===');
    console.log(JSON.stringify(resultado, null, 2));
  } catch (e) {
    console.error('FALLO la verificacion:', e.message);
    console.log(JSON.stringify(resultado, null, 2));
    ok = false;
  } finally {
    await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
