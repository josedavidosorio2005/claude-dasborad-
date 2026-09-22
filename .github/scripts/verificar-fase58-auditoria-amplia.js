// verificar-fase58-auditoria-amplia.js — QA de un solo uso para la Parte D
// de la Fase 58: pasada amplia por navegador (ORLANT, CLINICA AURORA,
// HOSPITAL LA MARIA, ANDRES YEPES, BIVETT) recorriendo TODAS las pestanas
// visibles de cada cliente (descubiertas en vivo desde el DOM, no
// hardcodeadas) con clics reales, confirmando que todo lo cerrado en las
// Fases 45-57 sigue funcionando -- foto de salud general, no
// re-verificacion fase por fase.
//
// Credenciales: lee server/data/seed-demo-credenciales.txt (gitignored,
// nunca se imprime aqui), usuario ADMIN sembrado.
'use strict';
const fs = require('fs');
const path = require('path');
const REPO = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(REPO, 'server', 'node_modules', 'playwright'));
const BASE = process.env.APP_URL || 'http://localhost:3000';
const CRED_FILE = path.join(REPO, 'server', 'data', 'seed-demo-credenciales.txt');
const OUT_DIR = path.join(REPO, 'docs', 'capturas-demo', 'fase58-unificacion-y-auditoria-completa');

const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 412, height: 915 };

function leerCredencialAdmin() {
  const txt = fs.readFileSync(CRED_FILE, 'utf8');
  const linea = txt.split('\n').find((l) => l.startsWith('ADMIN\t'));
  return { user: linea.match(/user:\s*(\S+)/)[1], password: linea.match(/password:\s*(\S+)/)[1] };
}
async function shot(page, name) { await page.screenshot({ path: path.join(OUT_DIR, name) }); }
async function setTema(page, tema) {
  await page.evaluate((t) => { if (typeof aplicarTema === 'function') aplicarTema(t); }, tema);
  await page.waitForTimeout(200);
}
async function textoSospechoso(page) {
  return page.evaluate(() => {
    var t = document.body.innerText || '';
    var hallazgos = [];
    if (/\bNaN\b/.test(t)) hallazgos.push('NaN visible');
    if (/\bundefined\b/.test(t)) hallazgos.push('undefined visible');
    if (/\[object Object\]/.test(t)) hallazgos.push('[object Object] visible');
    return hallazgos;
  });
}

const CLIENTES = ['ORLANT', 'CLINICA AURORA', 'HOSPITAL LA MARIA', 'ANDRES YEPES', 'BIVETT'];

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { user, password } = leerCredencialAdmin();
  const browser = await chromium.launch();
  const resultado = { clientes: {} };
  const consoleErroresGlobal = [];

  try {
    const page = await browser.newPage({ viewport: DESKTOP });
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErroresGlobal.push(msg.text()); });
    page.on('pageerror', (e) => consoleErroresGlobal.push('pageerror: ' + e.message));
    page.on('dialog', (d) => d.accept());
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#username', user);
    await page.fill('#password', password);
    await page.click('button.btn-login');
    await page.waitForTimeout(1200);
    await setTema(page, 'light');

    for (const nombre of CLIENTES) {
      const key = nombre.replace(/[^A-Z0-9]+/gi, '_');
      const infoCliente = { tabs: [], erroresConsolaPorTab: {}, textoSospechosoPorTab: {} };
      const inicioErrores = consoleErroresGlobal.length;

      await page.evaluate((c) => openGenericDashboard(c), nombre);
      await page.waitForTimeout(1200);

      const tabTextos = await page.evaluate(() => Array.from(document.querySelectorAll('.aurora-tabs .atab')).map((b) => b.textContent.trim()));
      infoCliente.tabs = tabTextos;

      await shot(page, `01-${key}-claro-desktop-inicial.png`);

      for (let ti = 0; ti < tabTextos.length; ti++) {
        const texto = tabTextos[ti];
        const before = consoleErroresGlobal.length;
        await page.locator('.aurora-tabs .atab').nth(ti).click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1300);
        infoCliente.erroresConsolaPorTab[texto] = consoleErroresGlobal.slice(before);
        infoCliente.textoSospechosoPorTab[texto] = await textoSospechoso(page);
      }

      await setTema(page, 'dark');
      await page.waitForTimeout(400);
      await shot(page, `02-${key}-oscuro-desktop-ultimotab.png`);

      await page.setViewportSize(MOBILE);
      await setTema(page, 'light');
      await page.waitForTimeout(500);
      await shot(page, `03-${key}-claro-movil.png`);
      await setTema(page, 'dark');
      await page.waitForTimeout(500);
      await shot(page, `04-${key}-oscuro-movil.png`);
      await page.setViewportSize(DESKTOP);
      await setTema(page, 'light');
      await page.waitForTimeout(300);

      await page.evaluate(() => closeGenericDashboard());
      await page.waitForTimeout(300);

      infoCliente.erroresConsolaTotal = consoleErroresGlobal.length - inicioErrores;
      resultado.clientes[nombre] = infoCliente;
    }

    // Gestion de base: modal "Cargar Datos de Dashboards".
    await page.evaluate(() => openCargas());
    await page.waitForTimeout(800);
    await page.selectOption('#carga-cliente', 'ORLANT').catch(() => {});
    await page.waitForTimeout(500);
    await shot(page, '15-gestion-de-base-modal-claro-desktop.png');
    await setTema(page, 'dark');
    await page.waitForTimeout(400);
    await shot(page, '16-gestion-de-base-modal-oscuro-desktop.png');
    await page.setViewportSize(MOBILE);
    await setTema(page, 'light');
    await page.waitForTimeout(400);
    await shot(page, '17-gestion-de-base-modal-claro-movil.png');
    await page.evaluate(() => closeCargas());

    resultado.consoleErroresGlobal = consoleErroresGlobal;
    resultado.ok = true;
  } catch (e) {
    resultado.ok = false;
    resultado.error = e.message;
    resultado.consoleErroresGlobal = consoleErroresGlobal;
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(OUT_DIR, 'hallazgos-navegador.json'), JSON.stringify(resultado, null, 2));
  console.log(JSON.stringify(resultado, null, 2));
})();
