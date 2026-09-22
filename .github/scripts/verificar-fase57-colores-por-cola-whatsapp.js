// verificar-fase57-colores-por-cola-whatsapp.js — QA de un solo uso para la
// Fase 57: confirma que cada cola de Trafico de WhatsApp tiene su propio
// color (borde de barra + leyenda), sin cambiar el significado semantico
// de azul/verde/rojo (Total/Contestados/Abandonados), y que Trafico de
// Llamadas no cambio ni un color -- lee los datasets reales de Chart.js
// (backgroundColor/borderColor), no solo capturas.
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
const OUT_DIR = path.join(REPO, 'docs', 'capturas-demo', 'fase57-colores-por-servicio-whatsapp');

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
async function leerChart(page, canvasId) {
  return page.evaluate((cid) => {
    var chart = (window._gd && window._gd.charts) ? window._gd.charts[cid] : null;
    if (!chart) return null;
    return {
      labels: chart.data.labels,
      datasets: chart.data.datasets.map(function (d) {
        return { label: d.label, backgroundColor: d.backgroundColor, borderColor: d.borderColor, borderWidth: d.borderWidth };
      }),
    };
  }, canvasId);
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

    // ══ ORLANT: Trafico de WhatsApp -- 3 sub-pestanas ══
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);
    await page.evaluate(() => switchGenericTab('trafico_whatsapp'));
    await page.waitForTimeout(1200);

    resultado.leyendaColas = await page.evaluate(() => {
      var el = document.getElementById('tww-colaleyenda-0');
      return el ? el.textContent.trim() : null;
    });

    await shot(page, `01-whatsapp-volumen-claro-desktop-${STATE}.png`);
    resultado.chartVolumen = await leerChart(page, 'tww-canvas-0');

    await page.evaluate(() => _traficoWppSwitchSubtab(0, 'sl'));
    await page.waitForTimeout(900);
    await shot(page, `02-whatsapp-sl-claro-desktop-${STATE}.png`);
    resultado.chartSl = await leerChart(page, 'tww-canvas-0');

    await page.evaluate(() => _traficoWppSwitchSubtab(0, 'asaata'));
    await page.waitForTimeout(900);
    await shot(page, `03-whatsapp-asaata-claro-desktop-${STATE}.png`);
    resultado.chartAsaAta = await leerChart(page, 'tww-canvas-0');

    // ── oscuro, escritorio ──
    await setTema(page, 'dark');
    await page.waitForTimeout(400);
    await page.evaluate(() => _traficoWppSwitchSubtab(0, 'volumen'));
    await page.waitForTimeout(900);
    await shot(page, `04-whatsapp-volumen-oscuro-desktop-${STATE}.png`);
    await page.evaluate(() => _traficoWppSwitchSubtab(0, 'sl'));
    await page.waitForTimeout(900);
    await shot(page, `05-whatsapp-sl-oscuro-desktop-${STATE}.png`);
    await page.evaluate(() => _traficoWppSwitchSubtab(0, 'asaata'));
    await page.waitForTimeout(900);
    await shot(page, `06-whatsapp-asaata-oscuro-desktop-${STATE}.png`);

    // ── movil, claro ──
    await page.setViewportSize(MOBILE);
    await setTema(page, 'light');
    await page.waitForTimeout(500);
    await page.evaluate(() => _traficoWppSwitchSubtab(0, 'volumen'));
    await page.waitForTimeout(700);
    await page.evaluate(() => { var el = document.getElementById('tww-subtabs-0'); if (el) el.scrollIntoView({ block: 'start' }); });
    await page.waitForTimeout(300);
    await shot(page, `07-whatsapp-volumen-claro-movil-${STATE}.png`);
    await page.evaluate(() => _traficoWppSwitchSubtab(0, 'sl'));
    await page.waitForTimeout(700);
    await shot(page, `08-whatsapp-sl-claro-movil-${STATE}.png`);
    await page.evaluate(() => _traficoWppSwitchSubtab(0, 'asaata'));
    await page.waitForTimeout(700);
    await shot(page, `09-whatsapp-asaata-claro-movil-${STATE}.png`);

    // ── movil, oscuro ──
    await setTema(page, 'dark');
    await page.waitForTimeout(500);
    await shot(page, `10-whatsapp-asaata-oscuro-movil-${STATE}.png`);

    await page.evaluate(() => closeGenericDashboard());
    await page.setViewportSize(DESKTOP);
    await setTema(page, 'light');
    await page.waitForTimeout(300);

    // ══ Regresion: Trafico de Llamadas de ORLANT -- confirmar colores intactos ══
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);
    await page.evaluate(() => switchGenericTab('trafico'));
    await page.waitForTimeout(1500);
    resultado.chartLlamadasPrincipal = await page.evaluate(() => {
      var chart = (window._gd && window._gd.charts) ? window._gd.charts['tv-canvas-0'] : null;
      if (!chart) return null;
      return chart.data.datasets.map(function (d) { return { label: d.label, backgroundColor: d.backgroundColor, borderColor: d.borderColor }; });
    });
    await shot(page, `11-trafico-llamadas-claro-desktop-${STATE}.png`);
    await page.evaluate(() => closeGenericDashboard());

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
