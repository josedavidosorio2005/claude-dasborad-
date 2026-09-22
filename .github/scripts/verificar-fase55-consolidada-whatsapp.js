// verificar-fase55-consolidada-whatsapp.js — QA de un solo uso para la
// Fase 55: verificacion final consolidada del modulo de Trafico de
// WhatsApp de ORLANT -- lee la instancia real de Chart.js en las 3
// sub-pestanas (Volumen/Niveles de Servicio/ASA y ATA), los 5 KPI del
// periodo, y la franja global de KPIs (9 tarjetas tras el fix de la Fase
// 54, ninguna de WhatsApp), en claro/oscuro y escritorio/movil. Tambien
// confirma que CLINICA AURORA no se vio afectada por el fix de la Fase 54.
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
const OUT_DIR = path.join(REPO, 'docs', 'capturas-demo', 'fase55-verificacion-final-consolidada');

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
    return { labels: chart.data.labels, datasets: chart.data.datasets.map(function (d) { return { label: d.label, data: d.data }; }) };
  }, canvasId);
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
  const resultado = {};
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

    // ══ PASO 3: franja global de ORLANT (9 tarjetas, sin WhatsApp) ══
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);
    resultado.orlantKpisGlobales = await leerKpisGlobales(page);
    await shot(page, '01-orlant-franja-global-claro-desktop.png');

    // ══ PASO 2: pestana Trafico de WhatsApp, 3 sub-pestanas ══
    await page.evaluate(() => switchGenericTab('trafico_whatsapp'));
    await page.waitForTimeout(1200);
    resultado.kpisPeriodo = await page.evaluate(() => Array.from(document.querySelectorAll('#tww-kpis-0 .aurora-kpi')).map(function(el){
      return { valor: (el.querySelector('.kv')||{}).textContent, etiqueta: (el.querySelector('.kl')||{}).textContent };
    }));
    await shot(page, '02-whatsapp-volumen-claro-desktop.png');
    resultado.chartVolumen = await leerChart(page, 'tww-canvas-0');

    await page.evaluate(() => _traficoWppSwitchSubtab(0, 'sl'));
    await page.waitForTimeout(900);
    await shot(page, '03-whatsapp-sl-claro-desktop.png');
    resultado.chartSl = await leerChart(page, 'tww-canvas-0');

    await page.evaluate(() => _traficoWppSwitchSubtab(0, 'asaata'));
    await page.waitForTimeout(900);
    await shot(page, '04-whatsapp-asaata-claro-desktop.png');
    resultado.chartAsaAta = await leerChart(page, 'tww-canvas-0');

    // ── oscuro, escritorio ──
    await setTema(page, 'dark');
    await page.waitForTimeout(400);
    await page.evaluate(() => _traficoWppSwitchSubtab(0, 'volumen'));
    await page.waitForTimeout(900);
    await shot(page, '05-whatsapp-volumen-oscuro-desktop.png');
    await page.evaluate(() => _traficoWppSwitchSubtab(0, 'sl'));
    await page.waitForTimeout(900);
    await shot(page, '06-whatsapp-sl-oscuro-desktop.png');
    await page.evaluate(() => _traficoWppSwitchSubtab(0, 'asaata'));
    await page.waitForTimeout(900);
    await shot(page, '07-whatsapp-asaata-oscuro-desktop.png');

    // franja global en oscuro
    await page.evaluate(() => switchGenericTab('calidad'));
    await page.waitForTimeout(600);
    await shot(page, '08-orlant-franja-global-oscuro-desktop.png');

    // ── movil, claro ──
    await page.setViewportSize(MOBILE);
    await setTema(page, 'light');
    await page.waitForTimeout(500);
    await shot(page, '09-orlant-franja-global-claro-movil.png');
    await page.evaluate(() => switchGenericTab('trafico_whatsapp'));
    await page.waitForTimeout(1000);
    await page.evaluate(() => { var el = document.getElementById('tww-subtabs-0'); if (el) el.scrollIntoView({block:'start'}); });
    await page.waitForTimeout(300);
    await shot(page, '10-whatsapp-volumen-claro-movil.png');
    await page.evaluate(() => _traficoWppSwitchSubtab(0, 'sl'));
    await page.waitForTimeout(700);
    await shot(page, '11-whatsapp-sl-claro-movil.png');
    await page.evaluate(() => _traficoWppSwitchSubtab(0, 'asaata'));
    await page.waitForTimeout(700);
    await shot(page, '12-whatsapp-asaata-claro-movil.png');

    // ── movil, oscuro ──
    await setTema(page, 'dark');
    await page.waitForTimeout(500);
    await shot(page, '13-whatsapp-asaata-oscuro-movil.png');
    await page.evaluate(() => switchGenericTab('calidad'));
    await page.waitForTimeout(600);
    await shot(page, '14-orlant-franja-global-oscuro-movil.png');

    await page.evaluate(() => closeGenericDashboard());
    await page.setViewportSize(DESKTOP);
    await setTema(page, 'light');
    await page.waitForTimeout(300);

    // ══ CLINICA AURORA: confirmar que sus propias tarjetas de WhatsApp siguen ahi ══
    await page.evaluate(() => openGenericDashboard('CLINICA AURORA'));
    await page.waitForTimeout(1200);
    resultado.auroraKpisGlobales = await leerKpisGlobales(page);
    await shot(page, '15-aurora-franja-global-claro-desktop.png');
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

  fs.writeFileSync(path.join(OUT_DIR, 'hallazgos.json'), JSON.stringify(resultado, null, 2));
  console.log(JSON.stringify(resultado, null, 2));
})();
