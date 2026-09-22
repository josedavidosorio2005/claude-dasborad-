// verificar-fase59-fixes-post-auditoria.js — QA de un solo uso para la
// Fase 59: confirma que la franja global de SASCHA FITNESS y BIVETT quedo
// con solo 3 tarjetas (WhatsApp Entrada/AHT Promedio/Pedidos-Agendas) tras
// quitar las 3 duplicadas con la pestana real de Trafico de Llamadas, y que
// esa pestana real no cambio en nada. Pasa STATE=antes|despues por env var
// para correr este mismo script dos veces (con git stash) y comparar.
//
// Credenciales: lee server/data/seed-demo-credenciales.txt (gitignored,
// nunca se imprime aqui), usuario ADMIN sembrado.
'use strict';
const fs = require('fs');
const path = require('path');
const REPO = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(REPO, 'server', 'node_modules', 'playwright'));
const BASE = process.env.APP_URL || 'http://localhost:3000';
const STATE = process.env.STATE || 'despues';
const CRED_FILE = path.join(REPO, 'server', 'data', 'seed-demo-credenciales.txt');
const OUT_DIR = path.join(REPO, 'docs', 'capturas-demo', 'fase59-fixes-post-auditoria');

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
async function leerKpisGlobales(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('#gd-kpis .aurora-kpi')).map((el) => ({
    valor: (el.querySelector('.kv') || {}).textContent, etiqueta: (el.querySelector('.kl') || {}).textContent,
  })));
}

const CLIENTES = ['SASCHA FITNESS', 'BIVETT'];

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { user, password } = leerCredencialAdmin();
  const browser = await chromium.launch();
  const resultado = { state: STATE, clientes: {} };
  const consoleErrores = [];

  try {
    const page = await browser.newPage({ viewport: DESKTOP });
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrores.push(msg.text()); });
    page.on('pageerror', (e) => consoleErrores.push('pageerror: ' + e.message));
    page.on('dialog', (d) => d.accept());
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#username', user);
    await page.fill('#password', password);
    await page.click('button.btn-login');
    await page.waitForTimeout(1200);
    await setTema(page, 'light');

    for (const nombre of CLIENTES) {
      const key = nombre.replace(/[^A-Z0-9]+/gi, '_');
      await page.evaluate((c) => openGenericDashboard(c), nombre);
      await page.waitForTimeout(1200);

      resultado.clientes[nombre] = { kpisGlobales: await leerKpisGlobales(page) };
      await shot(page, `01-${key}-claro-desktop-${STATE}.png`);

      await setTema(page, 'dark');
      await page.waitForTimeout(400);
      await shot(page, `02-${key}-oscuro-desktop-${STATE}.png`);

      await page.setViewportSize(MOBILE);
      await setTema(page, 'light');
      await page.waitForTimeout(400);
      await shot(page, `03-${key}-claro-movil-${STATE}.png`);
      await setTema(page, 'dark');
      await page.waitForTimeout(400);
      await shot(page, `04-${key}-oscuro-movil-${STATE}.png`);
      await page.setViewportSize(DESKTOP);
      await setTema(page, 'light');
      await page.waitForTimeout(300);

      // Confirmar que la pestana real de Trafico de Llamadas sigue igual.
      await page.evaluate(() => { if (typeof switchGenericTab === 'function') switchGenericTab('trafico'); });
      await page.waitForTimeout(1500);
      resultado.clientes[nombre].traficoResumen = await page.evaluate(() => {
        var els = document.querySelectorAll('#tv-kpis-0 .aurora-kpi');
        return Array.from(els).map((el) => ({ etiqueta: (el.querySelector('.kl') || {}).textContent, valor: (el.querySelector('.kv') || {}).textContent }));
      });
      await shot(page, `05-${key}-trafico-claro-desktop-${STATE}.png`);

      await page.evaluate(() => closeGenericDashboard());
      await page.waitForTimeout(300);
    }

    resultado.consoleErrores = consoleErrores;
    resultado.ok = true;
  } catch (e) {
    resultado.ok = false;
    resultado.error = e.message;
    resultado.consoleErrores = consoleErrores;
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(OUT_DIR, `hallazgos-${STATE}.json`), JSON.stringify(resultado, null, 2));
  console.log(JSON.stringify(resultado, null, 2));
})();
