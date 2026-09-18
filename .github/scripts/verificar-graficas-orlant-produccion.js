// verificar-graficas-orlant-produccion.js — QA de un solo uso, invocado por
// .github/workflows/verificar-graficas-orlant-produccion.yml.
//
// Verifica en produccion real (fase "graficas del PDF de InCo para ORLANT",
// 2026-09-18) que el dashboard de ORLANT abre y que los tabs
// ajustados/nuevos se ven: Trafico (abandono/AHT agregados al panel
// existente), Salida (filtroSerie), Tipificacion (filtroCampo + glosario),
// Agendamiento (nota_kpi + variacion %) y Gestion STA (agendada/anual/%).
//
// De SOLO LECTURA: nunca sube ni borra ninguna carga de ORLANT, los datos
// reales de esa campana (oct/nov-2026) no se tocan. El unico usuario
// temporal (rol ADMIN, para que openGenericDashboard funcione sin depender
// del scoping por cliente) se crea y se borra directo en la base de datos
// (nunca via la API), mismo criterio que
// verificar-filtros-colores-produccion.js.
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const os = require('os');

const BASE = process.env.PROD_URL || 'https://inconexionpruebasclaude.duckdns.org';
const ADMIN_USER = process.env.TEMP_ADMIN_USER;
const ADMIN_PW = process.env.TEMP_ADMIN_PW;
const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || os.tmpdir();

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
    await page.waitForTimeout(1500);
    const sub = await page.locator('#gd-sub').innerText().catch(() => '');
    resultado.dashboardAbreOk = sub.includes('ORLANT');
    resultado.subtitulo = sub;

    // ── Trafico: 3 canvases (principal + abandono + AHT) dentro del mismo panel ──
    await page.evaluate(() => switchGenericTab('trafico'));
    await page.waitForTimeout(2500); // trafico_combo carga datos via fetch aparte
    resultado.traficoTresCanvasesOk = await page.evaluate(() => {
      var host = document.getElementById('gd-p0');
      if (!host) return false;
      return !!host.querySelector('#tv-canvas-0') && !!host.querySelector('#tv-canvas-ab-0') && !!host.querySelector('#tv-canvas-aht-0');
    });
    await shot(page, '1-orlant-trafico.png');

    // ── Salida: 2 paneles con selector de linea ("filtroSerie") ──
    await page.evaluate(() => switchGenericTab('salida'));
    await page.waitForTimeout(1000);
    resultado.salidaFiltroSerieOk = await page.evaluate(() => {
      var sels = document.querySelectorAll('select[id^="gd-serief-"]');
      return sels.length === 2 && Array.from(sels).every((s) => s.options.length === 2);
    });
    await shot(page, '2-orlant-salida.png');

    // ── Tipificacion: 1 pie con filtro de linea + glosario ──
    await page.evaluate(() => switchGenericTab('tipificacion'));
    await page.waitForTimeout(1000);
    resultado.tipificacionOk = await page.evaluate(() => {
      var filtro = document.querySelector('select[id^="gd-catf-"]');
      var notas = document.querySelector('[id^="gd-notas-"]');
      return !!filtro && !!notas && notas.textContent.includes('INFORMACION_3P');
    });
    await shot(page, '3-orlant-tipificacion.png');

    // ── Agendamiento: nota_kpi (KPI anual con texto) + variacion % ──
    await page.evaluate(() => switchGenericTab('agendamiento'));
    await page.waitForTimeout(1000);
    resultado.notaKpiOk = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.aurora-card-title')).some((el) => el.textContent.includes('Efectividad del año'));
    });
    resultado.variacionPanelOk = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.aurora-card-title span')).some((el) => el.textContent.includes('variacion % mes a mes'));
    });
    await shot(page, '4-orlant-agendamiento.png');

    // ── Inasistencia: sin cambios, solo confirmar que sigue igual ──
    await page.evaluate(() => switchGenericTab('inasistencia'));
    await page.waitForTimeout(800);
    await shot(page, '5-orlant-inasistencia.png');

    // ── Gestion STA: barra "Agendada" + % del total en servicio/estado ──
    await page.evaluate(() => switchGenericTab('sta'));
    await page.waitForTimeout(1000);
    resultado.staOk = await page.evaluate(() => {
      var titulos = Array.from(document.querySelectorAll('.aurora-card-title')).map((el) => el.textContent);
      return titulos.some((t) => t.includes('Ordenes por servicio (año)')) && titulos.some((t) => t.includes('Estado de ordenes cargadas al STA (año)'));
    });
    await shot(page, '6-orlant-sta.png');

    await page.evaluate(() => closeGenericDashboard());

    ok =
      resultado.loginOk &&
      resultado.dashboardAbreOk &&
      resultado.traficoTresCanvasesOk &&
      resultado.salidaFiltroSerieOk &&
      resultado.tipificacionOk &&
      resultado.notaKpiOk &&
      resultado.variacionPanelOk &&
      resultado.staOk;

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
