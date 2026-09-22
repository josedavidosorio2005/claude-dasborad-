// verificar-fase51-trafico-whatsapp.js — QA de un solo uso para la Fase 51
// (verificacion final del modulo de Trafico de WhatsApp: sube la plantilla
// real por el flujo real de la UI de admin, y deja en hallazgos.json todo lo
// necesario para comparar archivo -> base de datos -> pantalla).
//
// Credenciales: lee server/data/seed-demo-credenciales.txt (gitignored,
// nunca se imprime aqui), usuario ADMIN sembrado.
//
// `playwright` no es dependencia del proyecto (mismo motivo que
// server/tests/helpers/xlsx-lite.js: mantener `npm audit` limpio) -- se
// resuelve explicito contra server/node_modules, donde se instala solo para
// correr este tipo de script de QA.
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(REPO, 'server', 'node_modules', 'playwright'));
const BASE = process.env.APP_URL || 'http://localhost:3000';
const OUT_DIR = process.env.OUT_DIR || path.join(REPO, 'docs', 'capturas-demo', 'fase51-verificacion-whatsapp');
const CRED_FILE = path.join(REPO, 'server', 'data', 'seed-demo-credenciales.txt');
const FIXTURE = path.join(REPO, 'server', 'tests', 'fixtures', 'PLANTILLA_TRAFICO_WHATSAPP_EJEMPLO.xlsx');

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 412, height: 915 };

function leerCredencialAdmin() {
  const txt = fs.readFileSync(CRED_FILE, 'utf8');
  const linea = txt.split('\n').find((l) => l.startsWith('ADMIN\t'));
  if (!linea) throw new Error('No se encontro un usuario ADMIN en ' + CRED_FILE);
  return { user: linea.match(/user:\s*(\S+)/)[1], password: linea.match(/password:\s*(\S+)/)[1] };
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: false });
}

async function setTema(page, tema) {
  await page.evaluate((t) => { if (typeof aplicarTema === 'function') aplicarTema(t); }, tema);
  await page.waitForTimeout(200);
}

async function leerKpis(page, idx) {
  return page.evaluate((i) => {
    var els = document.querySelectorAll('#tww-kpis-' + i + ' .aurora-kpi');
    return Array.from(els).map(function (el) {
      return { valor: (el.querySelector('.kv') || {}).textContent || null, etiqueta: (el.querySelector('.kl') || {}).textContent || null };
    });
  }, idx);
}

async function leerChart(page, canvasId) {
  return page.evaluate((cid) => {
    var chart = (window._gd && window._gd.charts) ? window._gd.charts[cid] : null;
    if (!chart) return null;
    return { labels: chart.data.labels, datasets: chart.data.datasets.map(function (d) { return { label: d.label, data: d.data }; }) };
  }, canvasId);
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { user, password } = leerCredencialAdmin();
  const browser = await chromium.launch();
  const resultado = {};
  const consoleErrores = [];
  let ok = true;

  try {
    const page = await browser.newPage({ viewport: DESKTOP });
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrores.push('console.error: ' + msg.text()); });
    page.on('pageerror', (e) => consoleErrores.push('pageerror: ' + e.message));
    page.on('dialog', (d) => d.accept());

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#username', user);
    await page.fill('#password', password);
    await page.click('button.btn-login');
    await page.waitForTimeout(1200);
    const loginErr = await page.locator('#login-error').innerText().catch(() => '');
    if (loginErr && loginErr.trim()) throw new Error('Login fallo: ' + loginErr.trim());
    resultado.loginOk = true;

    // ── PASO 1: subir la plantilla real por el flujo real de la UI ──
    await page.evaluate(() => { if (typeof showSection === 'function') showSection('metas'); });
    await page.waitForTimeout(500);
    await page.evaluate(() => { if (typeof switchMetasTab === 'function') switchMetasTab('trafico'); });
    await page.waitForTimeout(500);
    await page.selectOption('#tww-campana-sel', 'ORLANT');
    await page.setInputFiles('#tww-file', FIXTURE);
    await page.waitForTimeout(800);

    resultado.previewResumen = await page.locator('#tww-preview-resumen').innerText().catch(() => null);
    resultado.previewAvisos = await page.locator('#tww-errores').innerText().catch(() => '');
    await shot(page, '01-preview-carga.png');

    await page.click('#tww-save-btn');
    await page.waitForTimeout(1500);
    resultado.toastGuardado = await page.evaluate(() => {
      var t = document.querySelector('.toast, #toast, [class*="toast"]');
      return t ? t.textContent : null;
    });
    await shot(page, '02-toast-guardado.png');

    // ── PASO 4: pantalla del dashboard (claro, escritorio) ──
    await setTema(page, 'light');
    await page.evaluate(() => { if (typeof openGenericDashboard === 'function') openGenericDashboard('ORLANT'); });
    await page.waitForTimeout(1200);
    await page.evaluate(() => { if (typeof switchGenericTab === 'function') switchGenericTab('trafico_whatsapp'); });
    await page.waitForTimeout(1500);

    resultado.kpis = await leerKpis(page, 0);
    await shot(page, '03-tab-whatsapp-claro-desktop-volumen.png');
    resultado.chartVolumen = await leerChart(page, 'tww-canvas-0');

    await page.evaluate(() => { if (typeof _traficoWppSwitchSubtab === 'function') _traficoWppSwitchSubtab(0, 'sl'); });
    await page.waitForTimeout(900);
    await shot(page, '04-tab-whatsapp-claro-desktop-sl.png');
    resultado.chartSl = await leerChart(page, 'tww-canvas-0');

    await page.evaluate(() => { if (typeof _traficoWppSwitchSubtab === 'function') _traficoWppSwitchSubtab(0, 'asaata'); });
    await page.waitForTimeout(900);
    await shot(page, '05-tab-whatsapp-claro-desktop-asaata.png');
    resultado.chartAsaAta = await leerChart(page, 'tww-canvas-0');

    // Menu desplegable (Fase 46) sigue funcionando desde esta pestana nueva.
    const colapsadoAntes = await page.evaluate(() => document.documentElement.getAttribute('data-sidebar-collapsed') === '1');
    await page.evaluate(() => { var btn = document.querySelector('#admin-page .navbar-menu-toggle'); if (btn) toggleSidebar(btn); });
    await page.waitForTimeout(400);
    const colapsadoDespues = await page.evaluate(() => document.documentElement.getAttribute('data-sidebar-collapsed') === '1');
    resultado.menuDesplegableFunciona = colapsadoAntes !== colapsadoDespues;
    // revertir
    await page.evaluate(() => { var btn = document.querySelector('#admin-page .navbar-menu-toggle'); if (btn) toggleSidebar(btn); });
    await page.waitForTimeout(400);

    // ── oscuro, escritorio ──
    await setTema(page, 'dark');
    await page.waitForTimeout(400);
    await page.evaluate(() => { if (typeof _traficoWppSwitchSubtab === 'function') _traficoWppSwitchSubtab(0, 'volumen'); });
    await page.waitForTimeout(900);
    await shot(page, '06-tab-whatsapp-oscuro-desktop-volumen.png');

    // ── movil, claro y oscuro ──
    await page.setViewportSize(MOBILE);
    await setTema(page, 'light');
    await page.waitForTimeout(500);
    await page.evaluate(() => { var el = document.getElementById('tww-subtabs-0'); if (el) el.scrollIntoView({ block: 'start' }); });
    await page.waitForTimeout(300);
    await shot(page, '07-tab-whatsapp-claro-movil-volumen.png');

    await setTema(page, 'dark');
    await page.waitForTimeout(500);
    await shot(page, '08-tab-whatsapp-oscuro-movil-volumen.png');

    resultado.consoleErrores = consoleErrores;
    resultado.ok = true;
  } catch (e) {
    ok = false;
    resultado.ok = false;
    resultado.error = e.message;
    resultado.consoleErrores = consoleErrores;
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(OUT_DIR, 'hallazgos.json'), JSON.stringify(resultado, null, 2));
  console.log(JSON.stringify(resultado, null, 2));
  process.exit(ok ? 0 : 1);
})();
