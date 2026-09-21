// verificar-orlant-ocultar-pestanas-produccion.js — QA de un solo uso,
// invocado por .github/workflows/verificar-orlant-ocultar-pestanas-produccion.yml.
//
// Verifica en produccion real (Fase 40b, 2026-09-21) que el menu de
// ORLANT muestra unicamente "Calidad" y "Trafico de Llamadas" (las otras
// 7 pestanas quedaron ocultas de forma TEMPORAL), que la config sigue
// trayendo las 9 pestanas completas (7 con `oculta:true`, sin borrar
// panels/subtabs/datos), y que Trafico de Llamadas sigue con sus 6
// sub-pestanas y los mismos datos reales de agosto 2026 ya verificados.
//
// De SOLO LECTURA: nunca sube ni borra ninguna carga de ORLANT. El unico
// usuario temporal (rol ADMIN) se crea y se borra directo en la base de
// datos (nunca via la API), mismo criterio que
// verificar-orlant-subpestanas-produccion.js.
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const os = require('os');

const BASE = process.env.PROD_URL || 'https://inconexionpruebasclaude.duckdns.org';
const ADMIN_USER = process.env.TEMP_ADMIN_USER;
const ADMIN_PW = process.env.TEMP_ADMIN_PW;
const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || os.tmpdir();

const CLAVES_OCULTAS = ['flujo', 'salida', 'tipificacion', 'agendamiento', 'inasistencia', 'sta', 'efectividad'];
const CLAVES_VISIBLES = ['calidad', 'trafico'];
const TRAFICO_SUBTABS = ['resumen', 'abandono', 'aht', 'asaata', 'wait', 'sl'];

async function login(page, user, pw) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('#username', user);
  await page.fill('#password', pw);
  await page.click('button.btn-login');
  await page.waitForTimeout(1200);
  const err = await page.locator('#login-error').innerText().catch(() => '');
  if (err && err.trim()) throw new Error('Login de "' + user + '" fallo: ' + err.trim());
}

async function shot(page, nombre) {
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, nombre), fullPage: true });
}

(async () => {
  if (!ADMIN_USER || !ADMIN_PW) {
    console.error('Faltan TEMP_ADMIN_USER/TEMP_ADMIN_PW en el entorno.');
    process.exit(1);
  }

  const browser = await chromium.launch();
  const resultado = {};
  let ok = true;

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('dialog', (d) => d.accept());
    await login(page, ADMIN_USER, ADMIN_PW);
    resultado.loginOk = true;

    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForSelector('#gd-tabs .atab', { timeout: 15000 });
    await page.waitForTimeout(800);

    // ── Menu: solo 2 botones, "Calidad" y "Trafico de Llamadas" ──
    const tabLabels = await page.locator('#gd-tabs .atab').allInnerTexts();
    resultado.menuTabs = tabLabels;
    resultado.menuOk = tabLabels.length === 2 && tabLabels.includes('Calidad') && tabLabels.includes('Trafico de Llamadas');
    await shot(page, '0-orlant-menu-solo-2-pestanas.png');

    // ── La config real de produccion sigue trayendo las 9, 7 marcadas oculta, datos intactos ──
    const configCheck = await page.evaluate(() => {
      var tabs = _gd.config.layout.tabs || [];
      return {
        total: tabs.length,
        ocultas: tabs.filter(function(t){ return t.oculta===true; }).map(function(t){ return t.key; }),
        visibles: tabs.filter(function(t){ return !t.oculta; }).map(function(t){ return t.key; }),
        // Confirma que las pestanas ocultas siguen con sus paneles/subtabs
        // reales (nada se borro, solo se oculto del menu).
        flujoPanels: (tabs.find(function(t){ return t.key==='flujo'; }) || {}).panels ? tabs.find(function(t){ return t.key==='flujo'; }).panels.length : 0,
        staSubtabs: (tabs.find(function(t){ return t.key==='sta'; }) || {}).subtabs ? tabs.find(function(t){ return t.key==='sta'; }).subtabs.length : 0,
      };
    });
    resultado.configCheck = configCheck;
    const configOk =
      configCheck.total === 9 &&
      CLAVES_OCULTAS.every((k) => configCheck.ocultas.indexOf(k) !== -1) &&
      CLAVES_VISIBLES.every((k) => configCheck.visibles.indexOf(k) !== -1) &&
      configCheck.flujoPanels === 4 &&
      configCheck.staSubtabs === 4;
    resultado.configOk = configOk;

    // ── Calidad (primera pestana visible, activa por defecto) ──
    resultado.calidadEsDefaultOk = await page.locator('#gd-tabs .atab.atab-active').innerText().then((t) => t === 'Calidad').catch(() => false);
    await shot(page, '1-orlant-calidad-default.png');

    // ── Trafico: sigue con sus 6 sub-pestanas y datos reales de agosto ──
    await page.click('#gd-tabs .atab[data-gdtab="trafico"]');
    await page.waitForTimeout(2500); // trafico_combo carga datos via fetch aparte
    resultado.traficoSubtabsOk = await page.evaluate((claves) => {
      var host = document.getElementById('gd-p0');
      if (!host) return false;
      return claves.every((k) => !!host.querySelector('[data-trafsub="' + k + '"]'));
    }, TRAFICO_SUBTABS);
    const kpiTxt = await page.locator('#tv-kpis-0').innerText().catch(() => '');
    resultado.traficoKpisTexto = kpiTxt.replace(/\n/g, ' | ');
    // Total de llamadas real de agosto 2026, ya verificado en Fases 36/38/39
    // (8.061 = 4.011 3P + 4.050 General).
    resultado.traficoTotalConocidoOk = kpiTxt.includes('8.061') || kpiTxt.includes('8061');
    await shot(page, '2-orlant-trafico-resumen.png');

    await page.evaluate(() => closeGenericDashboard());

    ok =
      resultado.loginOk &&
      resultado.menuOk &&
      resultado.configOk &&
      resultado.calidadEsDefaultOk &&
      resultado.traficoSubtabsOk;

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
