// capturas-tema-oscuro.js — QA de un solo uso para el tema oscuro (dark
// mode) de toda la plataforma.
//
// Captura, en claro Y oscuro, y en escritorio Y movil (~412px), 4 pantallas
// representativas pedidas por InCo:
//   1. Login (con el boton de tema flotante).
//   2. Una pantalla de admin con tabla (Usuarios).
//   3. El dashboard de ORLANT (Aurora), con sus graficas -- confirma que el
//      semaforo (verde/amarillo/rojo) y la paleta categorica siguen
//      correctos y legibles en oscuro.
//   4. El modal de Previsualizar (reutiliza openGenericDashboard, el mismo
//      Aurora del punto 3, pero disparado desde el listado de Dashboards).
//
// Solo lectura: nunca crea, edita ni borra datos. No toca los datos de
// prueba PRUEBA_QA_GRAFICAS_ORLANT que InCo dejo vivos a proposito
// (PROGRESS.md Fase 34) -- este script no sube cargas ni cambia
// configuracion, solo navega y hace toggle de tema.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.APP_URL || 'http://localhost:3000';
const ADMIN_USER = process.env.QA_ADMIN_USER || 'admin';
const ADMIN_PW = process.env.QA_ADMIN_PW;
const OUT_DIR = process.env.OUT_DIR ||
  path.join(__dirname, '..', '..', 'docs', 'capturas-demo', 'tema-oscuro');

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 412, height: 915 };

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: false });
}

async function setTema(page, tema) {
  await page.evaluate((t) => { if (typeof aplicarTema === 'function') aplicarTema(t); }, tema);
  await page.waitForTimeout(200);
}

(async () => {
  if (!ADMIN_PW) {
    console.error('Falta QA_ADMIN_PW en el entorno.');
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const resultado = {};
  let ok = true;

  try {
    // ══ 1. LOGIN (claro / oscuro, escritorio / movil) ══════════════════
    for (const [vpName, vp] of [['desktop', DESKTOP], ['movil', MOBILE]]) {
      const page = await browser.newPage({ viewport: vp });
      await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
      await setTema(page, 'light');
      await shot(page, `1-login-claro-${vpName}.png`);
      await setTema(page, 'dark');
      resultado['loginDataThemeDark_' + vpName] =
        await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      await shot(page, `1-login-oscuro-${vpName}.png`);
      await page.close();
    }

    // ══ Sesion principal (escritorio) para las pantallas de admin ══════
    const page = await browser.newPage({ viewport: DESKTOP });
    page.on('dialog', (d) => d.accept());
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#username', ADMIN_USER);
    await page.fill('#password', ADMIN_PW);
    await page.click('button.btn-login');
    await page.waitForTimeout(1200);
    const loginErr = await page.locator('#login-error').innerText().catch(() => '');
    if (loginErr && loginErr.trim()) throw new Error('Login fallo: ' + loginErr.trim());
    resultado.loginOk = true;

    // ══ 2. USUARIOS (tabla de admin) — claro / oscuro, escritorio ══════
    await setTema(page, 'light');
    await page.evaluate(() => { if (typeof showSection === 'function') showSection('users'); });
    await page.waitForTimeout(600);
    await shot(page, '2-usuarios-claro-desktop.png');
    await setTema(page, 'dark');
    await page.waitForTimeout(300);
    await shot(page, '2-usuarios-oscuro-desktop.png');

    // ══ 3. ORLANT (Aurora) — semaforo + paleta categorica ══════════════
    await setTema(page, 'light');
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1500);
    await shot(page, '3-orlant-claro-desktop.png');
    const infoClaroSemaforo = await page.evaluate(() => {
      var celdas = Array.from(document.querySelectorAll('.aurora-kpi[class*="kpi-"]'))
        .map(function (el) { return el.className; });
      var colorMap = {};
      ['kpi-green', 'kpi-org', 'kpi-red'].forEach(function (cls) {
        var el = document.querySelector('.' + cls);
        if (el) colorMap[cls] = getComputedStyle(el).borderLeftColor;
      });
      return { clases: celdas, colores: colorMap };
    });
    resultado.orlantSemaforoClaroOk = Object.keys(infoClaroSemaforo.colores).length > 0;
    resultado.orlantSemaforoClaro = infoClaroSemaforo.colores;

    // Tab de tipificacion (pie con paleta categorica) — confirma colores.
    await page.evaluate(() => { if (typeof switchGenericTab === 'function') switchGenericTab('tipificacion'); });
    await page.waitForTimeout(700);
    const paletaClaro = await page.evaluate(() => {
      var chart = (typeof _gd !== 'undefined' && _gd.charts) ? _gd.charts['gd-c0'] : null;
      return chart ? { labels: chart.data.labels.slice(), colores: chart.data.datasets[0].backgroundColor.slice() } : null;
    });
    resultado.orlantPaletaClaro = paletaClaro;
    await shot(page, '3b-orlant-tipificacion-claro-desktop.png');

    await setTema(page, 'dark');
    await page.waitForTimeout(500);
    await shot(page, '3b-orlant-tipificacion-oscuro-desktop.png');
    const paletaOscuro = await page.evaluate(() => {
      var chart = (typeof _gd !== 'undefined' && _gd.charts) ? _gd.charts['gd-c0'] : null;
      return chart ? { labels: chart.data.labels.slice(), colores: chart.data.datasets[0].backgroundColor.slice() } : null;
    });
    resultado.orlantPaletaOscuro = paletaOscuro;
    resultado.paletaDistinguiblesOscuroOk = !!(paletaOscuro && new Set(paletaOscuro.colores).size === paletaOscuro.colores.length);

    await page.evaluate(() => { if (typeof switchGenericTab === 'function') switchGenericTab('flujo'); });
    await page.waitForTimeout(700);
    await shot(page, '3-orlant-oscuro-desktop.png');
    const infoOscuroSemaforo = await page.evaluate(() => {
      var colorMap = {};
      ['kpi-green', 'kpi-org', 'kpi-red'].forEach(function (cls) {
        var el = document.querySelector('.' + cls);
        if (el) colorMap[cls] = getComputedStyle(el).borderLeftColor;
      });
      return colorMap;
    });
    resultado.orlantSemaforoOscuro = infoOscuroSemaforo;
    resultado.semaforoColoresDistintosEnOscuroOk =
      new Set(Object.values(infoOscuroSemaforo)).size === Object.keys(infoOscuroSemaforo).length;

    await page.evaluate(() => { if (typeof closeGenericDashboard === 'function') closeGenericDashboard(); });

    // ── Movil: mismo dashboard, mismo par claro/oscuro ──
    await page.setViewportSize(MOBILE);
    await setTema(page, 'light');
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1500);
    await shot(page, '3-orlant-claro-movil.png');
    await setTema(page, 'dark');
    await page.waitForTimeout(400);
    await shot(page, '3-orlant-oscuro-movil.png');
    await page.evaluate(() => { if (typeof closeGenericDashboard === 'function') closeGenericDashboard(); });
    await page.setViewportSize(DESKTOP);

    // ══ 4. MODAL "Previsualizar" (dashboards-admin.js) ══════════════════
    await setTema(page, 'light');
    await page.evaluate(() => { if (typeof showSection === 'function') showSection('dashboards'); });
    await page.waitForTimeout(800);
    const previewBtn = page.locator('button[data-dcaction="preview"][data-cliente="ORLANT"]');
    resultado.previewBtnVisible = await previewBtn.isVisible().catch(() => false);
    if (resultado.previewBtnVisible) {
      await previewBtn.click();
      await page.waitForTimeout(1200);
      await shot(page, '4-previsualizar-claro-desktop.png');
      await setTema(page, 'dark');
      await page.waitForTimeout(400);
      await shot(page, '4-previsualizar-oscuro-desktop.png');

      await page.setViewportSize(MOBILE);
      await page.waitForTimeout(300);
      await shot(page, '4-previsualizar-oscuro-movil.png');
      await page.setViewportSize(DESKTOP);
      await page.evaluate(() => { if (typeof closeGenericDashboard === 'function') closeGenericDashboard(); });
    }

    // ══ Persistencia: localStorage recuerda el tema entre recargas ═════
    await setTema(page, 'dark');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    resultado.persisteTrasRecargaOk =
      (await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'dark';

    await page.close();

    ok =
      resultado.loginOk &&
      resultado.paletaDistinguiblesOscuroOk &&
      resultado.previewBtnVisible &&
      resultado.persisteTrasRecargaOk;

    resultado.ok = ok;
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
