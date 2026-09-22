// verificar-fase54-kpis-whatsapp-globales.js — QA de un solo uso para la
// Fase 54: confirma que las 4 tarjetas de WhatsApp de la franja global de
// KPIs de ORLANT (WhatsApp 3P / Nivel Atencion WPP 3P / WhatsApp Linea
// General / WhatsApp Salida) desaparecen tras el fix, que las tarjetas de
// Llamadas y las dos pestanas de Trafico (voz y WhatsApp) NO se tocan, y
// que CLINICA AURORA (cuyas propias tarjetas de WhatsApp SI son su unica
// fuente real, sin modulo automatico) tampoco se ve afectada.
//
// Pasa STATE=antes|despues por env var para correr este mismo script dos
// veces (antes del fix, con `git stash`, y despues) contra el MISMO seed
// de datos y comparar -- mismo patron que capturas-fase45-trafico.js.
//
// Credenciales: lee server/data/seed-demo-credenciales.txt (gitignored,
// nunca se imprime aqui), usuario ADMIN sembrado.
'use strict';
const fs = require('fs');
const path = require('path');
const REPO = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(REPO, 'server', 'node_modules', 'playwright'));
const BASE = process.env.APP_URL || 'http://localhost:3000';
const STATE = process.env.STATE || 'despues'; // 'antes' | 'despues'
const CRED_FILE = path.join(REPO, 'server', 'data', 'seed-demo-credenciales.txt');
const OUT_DIR = path.join(REPO, 'docs', 'capturas-demo', 'fase54-kpis-whatsapp-globales');

const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 412, height: 915 };

function leerCredencialAdmin() {
  const txt = fs.readFileSync(CRED_FILE, 'utf8');
  const linea = txt.split('\n').find((l) => l.startsWith('ADMIN\t'));
  return { user: linea.match(/user:\s*(\S+)/)[1], password: linea.match(/password:\s*(\S+)/)[1] };
}
async function shot(page, name) { await page.screenshot({ path: path.join(OUT_DIR, name) }); }
async function shotFull(page, name) { await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: true }); }
async function setTema(page, tema) {
  await page.evaluate((t) => { if (typeof aplicarTema === 'function') aplicarTema(t); }, tema);
  await page.waitForTimeout(200);
}

async function leerKpisGlobales(page) {
  return page.evaluate(() => {
    var els = Array.from(document.querySelectorAll('#gd-kpis .aurora-kpi'));
    return els.map(function (el) {
      return { valor: (el.querySelector('.kv') || {}).textContent || null, etiqueta: (el.querySelector('.kl') || {}).textContent || null };
    });
  });
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { user, password } = leerCredencialAdmin();
  const browser = await chromium.launch();
  const resultado = { state: STATE };
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

    // ── ORLANT: franja global + Trafico de Llamadas + Trafico de WhatsApp ──
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);

    resultado.orlantKpisGlobales = await leerKpisGlobales(page);
    await shot(page, `01-orlant-franja-global-claro-desktop-${STATE}.png`);

    await page.evaluate(() => { if (typeof switchGenericTab === 'function') switchGenericTab('trafico'); });
    await page.waitForTimeout(1200);
    resultado.orlantTraficoLlamadasResumen = await page.evaluate(() => {
      var els = document.querySelectorAll('#tv-kpis-0 .aurora-kpi');
      return Array.from(els).map(function (el) { return { valor: (el.querySelector('.kv') || {}).textContent, etiqueta: (el.querySelector('.kl') || {}).textContent }; });
    });
    await shot(page, `02-orlant-trafico-llamadas-claro-desktop-${STATE}.png`);

    await page.evaluate(() => { if (typeof switchGenericTab === 'function') switchGenericTab('trafico_whatsapp'); });
    await page.waitForTimeout(1200);
    resultado.orlantTraficoWhatsappResumen = await page.evaluate(() => {
      var els = document.querySelectorAll('#tww-kpis-0 .aurora-kpi');
      return Array.from(els).map(function (el) { return { valor: (el.querySelector('.kv') || {}).textContent, etiqueta: (el.querySelector('.kl') || {}).textContent }; });
    });
    await shot(page, `03-orlant-trafico-whatsapp-claro-desktop-${STATE}.png`);

    // ── oscuro, escritorio ──
    await setTema(page, 'dark');
    await page.waitForTimeout(400);
    await shot(page, `04-orlant-trafico-whatsapp-oscuro-desktop-${STATE}.png`);

    // Franja global en oscuro tambien (volviendo a la pestana Calidad, la que abre por defecto).
    await page.evaluate(() => { if (typeof switchGenericTab === 'function') switchGenericTab('calidad'); });
    await page.waitForTimeout(600);
    await shot(page, `05-orlant-franja-global-oscuro-desktop-${STATE}.png`);

    // ── movil, claro ──
    await page.setViewportSize(MOBILE);
    await setTema(page, 'light');
    await page.waitForTimeout(500);
    await shotFull(page, `06-orlant-franja-global-claro-movil-${STATE}.png`);
    await page.evaluate(() => { if (typeof switchGenericTab === 'function') switchGenericTab('trafico_whatsapp'); });
    await page.waitForTimeout(1000);
    await page.evaluate(() => { var el = document.getElementById('tww-subtabs-0'); if (el) el.scrollIntoView({ block: 'start' }); });
    await page.waitForTimeout(300);
    await shot(page, `07-orlant-trafico-whatsapp-claro-movil-${STATE}.png`);

    // ── movil, oscuro ──
    await setTema(page, 'dark');
    await page.waitForTimeout(500);
    await shot(page, `08-orlant-trafico-whatsapp-oscuro-movil-${STATE}.png`);

    await page.evaluate(() => closeGenericDashboard());
    await page.setViewportSize(DESKTOP);
    await setTema(page, 'light');
    await page.waitForTimeout(300);

    // ── CLINICA AURORA: confirmar que sus propias tarjetas de WhatsApp (que SI son su unica fuente, sin modulo automatico) no se tocaron ──
    await page.evaluate(() => openGenericDashboard('CLINICA AURORA'));
    await page.waitForTimeout(1200);
    resultado.auroraKpisGlobales = await leerKpisGlobales(page);
    await shot(page, `09-aurora-franja-global-claro-desktop-${STATE}.png`);
    await page.evaluate(() => closeGenericDashboard());
    await page.waitForTimeout(300);

    resultado.consoleErrores = consoleErrores;
    resultado.ok = true;
  } catch (e) {
    resultado.ok = false;
    resultado.error = e.message;
    resultado.consoleErrores = consoleErrores;
  } finally {
    await browser.close();
  }

  const outFile = path.join(OUT_DIR, `hallazgos-${STATE}.json`);
  fs.writeFileSync(outFile, JSON.stringify(resultado, null, 2));
  console.log(JSON.stringify(resultado, null, 2));
})();
